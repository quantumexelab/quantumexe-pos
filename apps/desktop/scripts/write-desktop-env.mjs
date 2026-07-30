import fs from "fs";
import path from "path";

const keyPath =
  process.env.FIREBASE_SA_PATH ||
  "C:/Users/p/Downloads/quantumexe-pos-test-firebase-adminsdk-fbsvc-f492038edb.json";

if (!fs.existsSync(keyPath)) {
  console.error("Service account JSON not found:", keyPath);
  process.exit(1);
}

const j = JSON.parse(fs.readFileSync(keyPath, "utf8"));
const pk = String(j.private_key).replace(/\n/g, "\\n");
const body = [
  "SYNC_TO_FIRESTORE=1",
  "SYNC_INTERVAL_MINUTES=5",
  `FIREBASE_PROJECT_ID=${j.project_id}`,
  `FIREBASE_CLIENT_EMAIL=${j.client_email}`,
  `FIREBASE_PRIVATE_KEY="${pk}"`,
  "JWT_SECRET=quantumexe-desktop-secret",
  "",
].join("\n");

const dests = [
  path.join(
    process.env.LOCALAPPDATA || "",
    "Programs",
    "QUANTUMEXE POS",
    "resources",
    "app-bundle",
    "desktop.env"
  ),
  path.resolve("apps/desktop/resources/desktop.env"),
];

for (const d of dests) {
  if (!d || d.startsWith(path.sep) && !process.env.LOCALAPPDATA) continue;
  fs.mkdirSync(path.dirname(d), { recursive: true });
  fs.writeFileSync(d, body);
  console.log("WROTE", d, "bytes=" + fs.statSync(d).size);
}

console.log("PROJECT", j.project_id);
console.log("EMAIL_OK", Boolean(j.client_email));
