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

  if (fs.existsSync(tmpDb)) return;

  const candidates = [
    path.join(process.cwd(), "apps/api/prisma/demo.db"),
    path.join(process.cwd(), "prisma/demo.db"),
  ];
  const bundled = candidates.find((p) => fs.existsSync(p));
  if (bundled) {
    fs.copyFileSync(bundled, tmpDb);
  }
}

function getApp() {
  if (!appPromise) {
    ensureSqliteOnVercel();
    // Vercel compiles this entry as CJS; dynamic import loads the ESM Express build.
    appPromise = import("../apps/api/dist/app.js").then((m) => m.default as ExpressApp);
  }
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp();
  return app(req, res);
}
