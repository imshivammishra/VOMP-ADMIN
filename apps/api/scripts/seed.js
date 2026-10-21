import { ensureSeed } from "../seed/seed.js";
import { sql } from "../src/db.js";

const result = ensureSeed();
const counts = {
  users: sql.get("SELECT COUNT(*) AS count FROM users").count,
  venues: sql.get("SELECT COUNT(*) AS count FROM venues").count,
  destinations: sql.get("SELECT COUNT(*) AS count FROM destinations").count,
  posts: sql.get("SELECT COUNT(*) AS count FROM posts").count,
  enquiries: sql.get("SELECT COUNT(*) AS count FROM enquiries").count,
  threads: sql.get("SELECT COUNT(*) AS count FROM threads").count,
  partners: sql.get("SELECT COUNT(*) AS count FROM partners").count,
  media: sql.get("SELECT COUNT(*) AS count FROM media").count,
};
console.log("[seed] workspace ready", counts);
if (result.created) {
  console.log(`[seed] sign in with ${result.email}`);
}
process.exit(0);
