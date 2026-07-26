import { prisma } from "../lib.js";
import { getSyncFirestore } from "./firestoreAdmin.js";
import { SYNC_COLLECTIONS, PRISMA_DELEGATE, toFirestoreDoc, type SyncCollection } from "./collections.js";
import { ensureSyncState, flushOutbox } from "./outbox.js";

type Delegate = {
  findMany: (args?: object) => Promise<Record<string, unknown>[]>;
};

function delegate(name: SyncCollection): Delegate {
  const key = PRISMA_DELEGATE[name];
  return (prisma as unknown as Record<string, Delegate>)[key];
}

export async function pushAllToFirestore() {
  await ensureSyncState();
  await prisma.syncState.update({ where: { id: 1 }, data: { status: "pushing", lastError: null } });

  const fs = getSyncFirestore();
  let collections = 0;
  let documents = 0;

  try {
    for (const name of SYNC_COLLECTIONS) {
      const rows = await delegate(name).findMany();
      collections++;
      // Firestore batches max 500
      for (let i = 0; i < rows.length; i += 400) {
        const chunk = rows.slice(i, i + 400);
        const batch = fs.batch();
        for (const row of chunk) {
          const id = String(row.id);
          const ref = fs.collection(name).doc(id);
          batch.set(ref, toFirestoreDoc(row), { merge: true });
          documents++;
        }
        await batch.commit();
      }
      // Keep counter roughly in sync for fsdb-compatible cloud viewers
      const maxId = rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
      if (maxId > 0) {
        await fs.collection("counters").doc(name).set({ value: maxId }, { merge: true });
      }
    }

    const flushed = await flushOutbox(
      async (collection, id, data) => {
        await fs.collection(collection).doc(id).set(toFirestoreDoc(data), { merge: true });
      },
      async (collection, id) => {
        await fs.collection(collection).doc(id).delete();
      }
    );

    await prisma.syncState.update({
      where: { id: 1 },
      data: { status: "ok", lastPushAt: new Date(), lastError: null },
    });

    return { collections, documents, flushed };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.syncState.update({
      where: { id: 1 },
      data: { status: "error", lastError: message },
    });
    throw e;
  }
}
