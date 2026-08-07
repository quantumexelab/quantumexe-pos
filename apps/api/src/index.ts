import app, { attachWebStatic } from "./app.js";
import { startSyncInterval, syncEnabled, loadUserSyncPreference } from "./sync/index.js";
import { ensureMasterAdmin, ensureDemoShopApproved } from "./routes-master.js";
import { startRetentionInterval } from "./retention/index.js";
import { ensureDesktopDemoAdmin } from "./ensureDesktopDemo.js";

const PORT = Number(process.env.PORT || 4000);

if (process.env.SERVE_WEB === "1" || process.env.ELECTRON === "1") {
  attachWebStatic(process.env.WEB_DIST);
}

app.listen(PORT, () => {
  console.log(`API+UI listening on http://localhost:${PORT}`);
  void ensureDesktopDemoAdmin().catch((e) => console.warn("[desktop] demo admin:", e));
  void ensureMasterAdmin().catch((e) => console.error("[master] seed failed:", e));
  void ensureDemoShopApproved().catch((e) => console.warn("[master] demo shop:", e));
  if (process.env.USE_FIRESTORE === "1") return;
  void loadUserSyncPreference()
    .then(() => {
      if (syncEnabled()) startSyncInterval();
    })
    .catch((e) => console.error("[sync] Failed to load preference:", e));
  startRetentionInterval();
});

process.on("unhandledRejection", (err) => {
  console.error("[api] unhandledRejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("[api] uncaughtException:", err);
});
