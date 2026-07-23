import { cpSync, mkdirSync, rmSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const src = resolve(root, "apps/api/dist");
const dest = resolve(__dirname, "../api-dist");

if (!existsSync(src)) {
  console.error("Missing apps/api/dist — run: npm run build -w apps/api");
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("Copied apps/api/dist → functions/api-dist");
