import { runPush, getSyncStatus } from "../src/sync/index.js";

async function main() {
  const statusBefore = await getSyncStatus();
  console.log(
    "STATUS_BEFORE",
    JSON.stringify({ enabled: statusBefore.enabled, cloudReachable: statusBefore.cloudReachable })
  );
  const result = await runPush();
  console.log("PUSH_OK", JSON.stringify(result));
  const statusAfter = await getSyncStatus();
  console.log(
    "STATUS_AFTER",
    JSON.stringify({
      status: statusAfter.status,
      lastPushAt: statusAfter.lastPushAt,
      lastError: statusAfter.lastError,
    })
  );
}

main().catch((e) => {
  console.error("VERIFY_FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
