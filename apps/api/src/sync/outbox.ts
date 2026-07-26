import { PrismaClient } from "@prisma/client";
import { prisma } from "../lib.js";

export async function enqueueOutbox(
  collection: string,
  recordId: string | number,
  op: "upsert" | "delete",
  payload: unknown
) {
  await prisma.syncOutbox.create({
    data: {
      collection,
      recordId: String(recordId),
      op,
      payload: JSON.stringify(payload ?? {}),
    },
  });
}

export async function pendingOutboxCount() {
  return prisma.syncOutbox.count();
}

export async function flushOutbox(writeDoc: (collection: string, id: string, data: Record<string, unknown>) => Promise<void>, deleteDoc: (collection: string, id: string) => Promise<void>) {
  const rows = await prisma.syncOutbox.findMany({ orderBy: { id: "asc" }, take: 200 });
  let flushed = 0;
  for (const row of rows) {
    try {
      if (row.op === "delete") {
        await deleteDoc(row.collection, row.recordId);
      } else {
        const payload = JSON.parse(row.payload) as Record<string, unknown>;
        await writeDoc(row.collection, row.recordId, payload);
      }
      await prisma.syncOutbox.delete({ where: { id: row.id } });
      flushed++;
    } catch (e) {
      await prisma.syncOutbox.update({
        where: { id: row.id },
        data: {
          attempts: row.attempts + 1,
          lastError: e instanceof Error ? e.message : String(e),
        },
      });
    }
  }
  return flushed;
}

export async function ensureSyncState(db: PrismaClient = prisma) {
  const existing = await db.syncState.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return db.syncState.create({ data: { id: 1, status: "idle" } });
}
