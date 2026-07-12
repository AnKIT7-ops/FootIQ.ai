/**
 * Architectural guard: dataset modules in src/data may only be imported by
 * the repository layer (and by each other). Everything else must go through
 * @/lib/repositories — that's what makes the backend swappable.
 *
 * Allowed from anywhere: @/data/types (types), @/data/images (URL mappers),
 * @/data/generators (presentation-layer procedural viz data).
 *
 * Run: node scripts/check-imports.mjs   (wired into `npm run verify` flow)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC = join(ROOT, "src");
const DATASETS = ["players", "teams", "matches", "news", "transfers", "predictions", "clips", "history", "fantasy", "content"];
const PATTERNS = DATASETS.flatMap((d) => [`"@/data/${d}"`, `'@/data/${d}'`]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(name)) yield full;
  }
}

const violations = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const parts = rel.split(sep);
  const inData = parts[1] === "data";
  const inRepositories = parts[1] === "lib" && parts[2] === "repositories";
  if (inData || inRepositories) continue;

  const text = readFileSync(file, "utf8");
  for (const p of PATTERNS) {
    if (text.includes(p)) violations.push(`${rel} imports ${p} — use @/lib/repositories instead`);
  }
}

if (violations.length) {
  console.error("Import guard failed:\n" + violations.map((v) => `  ${v}`).join("\n"));
  process.exit(1);
}
console.log("Import guard passed: dataset access goes through the repository layer.");
