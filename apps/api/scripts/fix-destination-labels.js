import { sql } from "../src/db.js";

const result = sql.run(
  "UPDATE destinations SET venue_count_label = ?, updated_at = ?",
  "Curated venue selection",
  new Date().toISOString()
);
console.log("updated destinations", result.changes);
