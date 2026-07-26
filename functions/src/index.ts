import { onRequest } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import type { Request, Response } from "express";

// Must run before Express/API modules load (Firestore vs SQLite switch).
process.env.USE_FIRESTORE = "1";

if (!getApps().length) {
  initializeApp();
}

type ExpressApp = (req: Request, res: Response) => void;

let appPromise: Promise<ExpressApp> | null = null;

function loadApp() {
  if (!appPromise) {
    // Dynamic import so USE_FIRESTORE is set before lib.ts chooses Firestore.
    // api-dist is compiled JS copied at predeploy — no sibling .d.ts resolution.
    // @ts-expect-error compiled Express app bundle
    appPromise = import("../api-dist/app.js").then((m) => m.default as ExpressApp);
  }
  return appPromise;
}

export const api = onRequest(
  {
    region: "asia-south1",
    memory: "1GiB",
    timeoutSeconds: 120,
    cors: true,
  },
  async (req, res): Promise<void> => {
    const app = await loadApp();
    app(req, res);
  }
);
