import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";

const confirmed = process.argv.includes("--yes");
if (!confirmed) {
  console.error("This deletes the local database and uploaded media.");
  console.error("Re-run with:  npm run reset --workspace api -- --yes");
  process.exit(1);
}

for (const file of [config.dbPath, `${config.dbPath}-wal`, `${config.dbPath}-shm`]) {
  try {
    fs.rmSync(file, { force: true });
  } catch {
    /* ignore */
  }
}

const library = path.join(config.uploadsDir, "library");
if (fs.existsSync(library)) {
  for (const entry of fs.readdirSync(library)) {
    fs.rmSync(path.join(library, entry), { force: true, recursive: true });
  }
}

console.log("[reset] local data cleared — reseeding…");
const { ensureSeed } = await import("../seed/seed.js");
ensureSeed();
console.log("[reset] done");
process.exit(0);
