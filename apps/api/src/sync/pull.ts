import { prisma } from "../lib.js";
import { getSyncFirestore } from "./firestoreAdmin.js";
import { SYNC_COLLECTIONS, PRISMA_DELEGATE, fromFirestoreDoc, type SyncCollection } from "./collections.js";
import { ensureSyncState } from "./outbox.js";

type Delegate = {
  count: () => Promise<number>;
  upsert: (args: { where: { id: number }; create: object; update: object }) => Promise<unknown>;
  findUnique?: (args: { where: { key: string } }) => Promise<unknown>;
  upsertByKey?: never;
};

function delegate(name: SyncCollection): Delegate {
  const key = PRISMA_DELEGATE[name];
  return (prisma as unknown as Record<string, Delegate>)[key];
}

async function localIsEmpty() {
  const users = await prisma.user.count();
  return users === 0;
}

export async function pullAllFromFirestore(opts: { force?: boolean } = {}) {
  await ensureSyncState();
  const empty = await localIsEmpty();
  if (!empty && !opts.force) {
    throw new Error("Local DB is not empty. Pass force=1 to restore from cloud (overwrites matching ids).");
  }

  await prisma.syncState.update({ where: { id: 1 }, data: { status: "pulling", lastError: null } });
  const fs = getSyncFirestore();
  let collections = 0;
  let documents = 0;

  try {
    for (const name of SYNC_COLLECTIONS) {
      const snap = await fs.collection(name).get();
      collections++;
      const d = delegate(name);
      for (const doc of snap.docs) {
        const raw = fromFirestoreDoc(doc.data() as Record<string, unknown>);
        const id = Number(raw.id ?? doc.id);
        if (!Number.isFinite(id)) continue;
        // Strip relation-only junk if any
        const { id: _id, ...rest } = raw;
        const data = { id, ...rest };
        await d.upsert({
          where: { id },
          create: data,
          update: rest,
        });
        documents++;
      }
    }

    await prisma.syncState.update({
      where: { id: 1 },
      data: { status: "ok", lastPullAt: new Date(), lastError: null },
    });

    return { collections, documents, forced: !!opts.force, wasEmpty: empty };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.syncState.update({
      where: { id: 1 },
      data: { status: "error", lastError: message },
    });
    throw e;
  }
}
