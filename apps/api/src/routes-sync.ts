import { Router } from "express";
import { requireAuth, requireRoles } from "./auth.js";
import { ok, fail } from "./lib.js";
import {
  getSyncStatus,
  runPush,
  runPull,
  syncEnabled,
  setAutoSyncEnabled,
} from "./sync/index.js";

const router = Router();

function assertLocalHybrid() {
  if (process.env.USE_FIRESTORE === "1") {
    throw new Error(
      "Hybrid sync requires local SQLite (unset USE_FIRESTORE). Cloud-only mode is already on Firestore."
    );
  }
}

router.get("/sync/status", requireAuth, async (_req, res) => {
  try {
    if (process.env.USE_FIRESTORE === "1") {
      return res.json(
        ok({
          enabled: false,
          mode: "firestore-primary",
          connectionMode: "auto-sync",
          credentialsConfigured: true,
          userEnabled: true,
          message: "Running in cloud Firestore mode (no local SQLite sync).",
        })
      );
    }
    const status = await getSyncStatus();
    res.json(ok({ ...status, mode: "local-sqlite" }));
  } catch (e) {
    res.status(500).json(fail(e instanceof Error ? e.message : "Status failed", 500));
  }
});

router.post("/sync/auto", requireAuth, requireRoles("Admin"), async (req, res) => {
  try {
    assertLocalHybrid();
    const enabled = req.body?.enabled === true || req.body?.enabled === 1 || req.body?.enabled === "1";
    const status = await setAutoSyncEnabled(enabled);
    res.json(
      ok(
        { ...status, mode: "local-sqlite" },
        enabled ? "Cloud auto-sync turned ON" : "Cloud auto-sync turned OFF"
      )
    );
  } catch (e) {
    res.status(400).json(fail(e instanceof Error ? e.message : "Failed to update sync preference"));
  }
});

router.post("/sync/push", requireAuth, async (_req, res) => {
  try {
    assertLocalHybrid();
    if (!syncEnabled()) {
      return res.status(400).json(fail("Turn on Cloud auto-sync in Settings → Connection"));
    }
    const result = await runPush();
    res.json(ok(result, "Pushed local DB to Firestore"));
  } catch (e) {
    res.status(500).json(fail(e instanceof Error ? e.message : "Push failed", 500));
  }
});

router.post("/sync/pull", requireAuth, async (req, res) => {
  try {
    assertLocalHybrid();
    if (!syncEnabled()) {
      return res.status(400).json(fail("Turn on Cloud auto-sync in Settings → Connection"));
    }
    const force = req.query.force === "1" || req.body?.force === true;
    const result = await runPull(force);
    res.json(ok(result, "Pulled Firestore into local DB"));
  } catch (e) {
    res.status(500).json(fail(e instanceof Error ? e.message : "Pull failed", 500));
  }
});

export default router;
