import fs from "fs";

const keyPath = "C:/Users/p/Downloads/quantumexe-pos-test-firebase-adminsdk-fbsvc-f492038edb.json";
const j = JSON.parse(fs.readFileSync(keyPath, "utf8"));
const envPath = new URL("../.env", import.meta.url);
const path = envPath.pathname.startsWith("/") && process.platform === "win32" ? envPath.pathname.slice(1) : envPath.pathname;
let env = fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const pk = j.private_key.replace(/\n/g, "\\n");
for (const k of [
  "SYNC_TO_FIRESTORE",
  "SYNC_INTERVAL_MINUTES",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
]) {
  env = env.replace(new RegExp(`^${k}=.*$`, "gm"), "");
}
const block = `
# Hybrid cloud backup sync
SYNC_TO_FIRESTORE=1
SYNC_INTERVAL_MINUTES=5
FIREBASE_PROJECT_ID=${j.project_id}
FIREBASE_CLIENT_EMAIL=${j.client_email}
FIREBASE_PRIVATE_KEY="${pk}"
`;
env = `${env.replace(/\n{3,}/g, "\n\n").trimEnd()}\n${block}`;
fs.writeFileSync(path, env);
console.log("ENV_UPDATED_SYNC_KEYS");
