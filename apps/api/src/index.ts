import express from "express";
import cors from "cors";
import core from "./routes-core.js";
import ops from "./routes-ops.js";

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", core);
app.use("/api", ops);
app.use("/api/analytics", (req, res, next) => {
  // already mounted under /api in ops as /analytics/dashboard
  next();
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ success: false, message: err instanceof Error ? err.message : "Server error" });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
