import { collections } from "../src/db.js";
import { ensureSeed } from "../seed/seed.js";

const result = await ensureSeed();
const counts = {};
for (const name of [
  "users",
  "venues",
  "destinations",
  "posts",
  "enquiries",
  "threads",
  "partners",
  "media",
]) {
  counts[name] = await collections[name].countDocuments({});
}
console.log("[seed] workspace ready", counts);
if (result.created) {
  console.log(`[seed] sign in with ${result.email}`);
}
process.exit(0);
