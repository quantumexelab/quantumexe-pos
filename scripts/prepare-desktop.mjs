import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "apps", "desktop", "resources");
const apiPkg = JSON.parse(fs.readFileSync(path.join(root, "apps", "api", "package.json"), "utf8"));

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}
function mkdir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function cp(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

console.log("Building API + Web...");
execSync("npm run build -w apps/api", { cwd: root, stdio: "inherit" });
execSync("npm run build -w apps/web", { cwd: root, stdio: "inherit" });

console.log("Preparing desktop resources...");
rmrf(out);
mkdir(path.join(out, "api"));
mkdir(path.join(out, "web-dist"));
mkdir(path.join(out, "prisma"));

cp(path.join(root, "apps", "api", "dist"), path.join(out, "api"));
cp(path.join(root, "apps", "web", "dist"), path.join(out, "web-dist"));
cp(path.join(root, "apps", "api", "prisma", "schema.prisma"), path.join(out, "prisma", "schema.prisma"));

// Seed SQLite for first launch
const seedUrl = "file:./demo.sqlite";
execSync(`npx prisma db push --schema prisma/schema.prisma --skip-generate --accept-data-loss`, {
  cwd: path.join(root, "apps", "api"),
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: seedUrl },
});
execSync(`npx tsx prisma/seed.ts`, {
  cwd: path.join(root, "apps", "api"),
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: seedUrl },
});
const seedSrc = path.join(root, "apps", "api", "prisma", "demo.sqlite");
if (fs.existsSync(seedSrc)) {
  cp(seedSrc, path.join(out, "prisma", "demo.sqlite"));
} else {
  // Prisma may write relative to schema dir
  const alt = path.join(root, "apps", "api", "prisma", "prisma", "demo.sqlite");
  if (fs.existsSync(alt)) cp(alt, path.join(out, "prisma", "demo.sqlite"));
}

// Minimal package.json for production node_modules inside the bundle
const runtimePkg = {
  name: "quantumexe-pos-runtime",
  private: true,
  type: "module",
  dependencies: {
    ...apiPkg.dependencies,
    prisma: apiPkg.devDependencies?.prisma || "^6.5.0",
  },
};
fs.writeFileSync(path.join(out, "package.json"), JSON.stringify(runtimePkg, null, 2));

console.log("Installing production dependencies into desktop resources (this may take a few minutes)...");
execSync("npm install --omit=dev", { cwd: out, stdio: "inherit" });
execSync("npx prisma generate --schema prisma/schema.prisma", { cwd: out, stdio: "inherit" });

// Optional sync env template (shop fills in) — don't overwrite a real desktop.env
const envExample = path.join(out, "desktop.env.example");
fs.writeFileSync(
  envExample,
  `# Same Firebase project as web (Master Admin + optional backup sync)
SYNC_TO_FIRESTORE=0
FIREBASE_PROJECT_ID=quantumexe-pos-test
# FIREBASE_CLIENT_EMAIL=
# FIREBASE_PRIVATE_KEY=
JWT_SECRET=change-me
`
);
const existingEnv = path.join(root, "apps", "desktop", "resources", "desktop.env");
// prepare wiped resources; restore from release/app-bundle or project copy if present
const envCandidates = [
  path.join(root, "apps", "desktop", "desktop.env"),
  path.join(process.env.LOCALAPPDATA || "", "Programs", "QUANTUMEXE POS", "resources", "app-bundle", "desktop.env"),
];
// Bake control-plane Firebase creds so Master Admin / shop registry work offline-online.
// Login stays local-first with cloud timeouts (see routes-core auth/login).
let baked = false;
for (const cand of envCandidates) {
  if (cand && fs.existsSync(cand)) {
    fs.copyFileSync(cand, path.join(out, "desktop.env"));
    console.log("Restored desktop.env from", cand);
    baked = true;
    break;
  }
}
if (!baked) {
  console.log("No desktop.env found — Master Admin cloud registry will be unavailable until configured");
}

console.log("Desktop resources ready:", out);
