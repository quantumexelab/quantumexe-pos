import type { VercelRequest, VercelResponse } from "@vercel/node";
import fs from "fs";
import path from "path";

type ExpressApp = (req: VercelRequest, res: VercelResponse) => unknown;

let appPromise: Promise<ExpressApp> | null = null;

function ensureSqliteOnVercel() {
  // Serverless FS is read-only except /tmp — copy bundled demo DB there once per instance.
  const tmpDb = "/tmp/quantumexe-pos.db";
  process.env.DATABASE_URL = `file:${tmpDb}`;
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "reox-clone-dev-secret";

  if (fs.existsSync(tmpDb) && fs.statSync(tmpDb).size > 0) return;

  const candidates = [
    path.join(process.cwd(), "api/demo.sqlite"),
    path.join(process.cwd(), "demo.sqlite"),
    path.join(process.cwd(), "apps/api/prisma/demo.sqlite"),
    path.join(process.cwd(), "prisma/demo.sqlite"),
  ];
  const bundled = candidates.find((p) => {
    try {
      return fs.existsSync(p) && fs.statSync(p).size > 0;
    } catch {
      return false;
    }
  });
  if (!bundled) {
    console.error("Bundled demo.sqlite not found. Tried:", candidates);
    return;
  }
  fs.copyFileSync(bundled, tmpDb);
  console.log("Copied demo DB from", bundled, "to", tmpDb);
}

function prepareRuntime() {
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "reox-clone-dev-secret";
  if (!process.env.FIREBASE_PROJECT_ID) process.env.FIREBASE_PROJECT_ID = "quantumexe-pos-test";

  // Firestore mode: skip ephemeral SQLite bootstrap.
  if (process.env.USE_FIRESTORE === "1") return;
  ensureSqliteOnVercel();
}

function getApp() {
  if (!appPromise) {
    prepareRuntime();
    // Vercel compiles this entry as CJS; dynamic import loads the ESM Express build.
    appPromise = import("../apps/api/dist/app.js").then((m) => m.default as ExpressApp);
  }
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp();
  return app(req, res);
}
