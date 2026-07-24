import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(root, "apps", "api");
const out = path.join(root, "functions", "api-dist");

console.log("Building API for Firebase Functions...");
execSync("npm run build -w apps/api", { cwd: root, stdio: "inherit" });

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(apiDir, "dist"), out, { recursive: true });
console.log("Copied API dist -> functions/api-dist");
