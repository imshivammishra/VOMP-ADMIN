import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const folders = ["src", "seed", "scripts"];
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|mjs)$/.test(entry.name) && !full.endsWith("check.mjs")) files.push(full);
  }
}

for (const folder of folders) {
  const directory = path.join(root, folder);
  if (fs.existsSync(directory)) walk(directory);
}

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failed += 1;
    process.stderr.write(`\n${path.relative(root, file)}\n${result.stderr}`);
  }
}

if (failed) {
  console.error(`\n${failed} file(s) failed syntax checking.`);
  process.exit(1);
}

console.log(`Syntax check passed for ${files.length} API files.`);
