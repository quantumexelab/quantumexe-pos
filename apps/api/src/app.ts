import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import core from "./routes-core.js";
import ops from "./routes-ops.js";
import syncRoutes from "./routes-sync.js";
import masterRoutes from "./routes-master.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", core);
app.use("/api", ops);
app.use("/api", syncRoutes);
app.use("/api", masterRoutes);

/** Desktop / production: serve built React UI from the same port as the API. */
export function attachWebStatic(webDist?: string) {
  const candidates = [
    webDist,
    process.env.WEB_DIST,
    path.resolve(__dirname, "../../web/dist"),
    path.resolve(process.cwd(), "apps/web/dist"),
    path.resolve(process.cwd(), "web-dist"),
    path.resolve(process.cwd(), "resources/web-dist"),
  ].filter(Boolean) as string[];

  const root = candidates.find((p) => fs.existsSync(path.join(p, "index.html")));
  if (!root) {
    console.warn("[web] No web dist found — API only");
    return null;
  }

  app.use(express.static(root));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") return next();
    res.sendFile(path.join(root, "index.html"));
  });
  console.log(`[web] Serving UI from ${root}`);
  return root;
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ success: false, message: err instanceof Error ? err.message : "Server error" });
});

export default app;
