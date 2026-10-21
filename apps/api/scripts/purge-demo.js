/**
 * One-time cleanup for databases created by the early demo seed.
 *
 * It removes only records the old seed created (fixed reference prefixes,
 * seed media and the hard-coded editor account). Real enquiries, partners,
 * conversations and uploads are left untouched.
 *
 * Run with: node scripts/purge-demo.js
 */
import { sql, toJson, transaction } from "../src/db.js";

const seedReviews = [
  "Ananya & Reyansh",
  "Karan & Meera Iyer",
  "Sana & Thomas",
];

const aboutMeta = {
  phone: "+91 94624 60555",
  badge: "Private, quote-led shortlists",
  stats: [
    { value: "Venue-only", label: "No decor or catering commissions" },
    { value: "Human", label: "Assisted follow-up" },
    { value: "Private", label: "Quote-led proposals" },
  ],
};

const result = transaction(() => {
  const threadIds = sql.all("SELECT id FROM threads WHERE reference LIKE 'THR-26%'").map((row) => row.id);

  const counts = {
    messages: threadIds.reduce((sum, id) => sum + sql.run("DELETE FROM messages WHERE thread_id = ?", id).changes, 0),
    threads: sql.run("DELETE FROM threads WHERE reference LIKE 'THR-26%'").changes,
    enquiries: sql.run("DELETE FROM enquiries WHERE reference LIKE 'ENQ-26%'").changes,
    partners: sql.run("DELETE FROM partners WHERE reference LIKE 'PRT-26%'").changes,
    media: sql.run("DELETE FROM media WHERE uploaded_by = 'Seed'").changes,
    reviews: seedReviews.reduce((sum, name) => sum + sql.run("DELETE FROM reviews WHERE name = ?", name).changes, 0),
    activity: sql.run(
      "DELETE FROM activity WHERE actor IN ('Aarav Mehta', 'Priya Sharma', 'Website visitor', 'Ritika Jain') OR detail LIKE 'ENQ-26%' OR detail LIKE 'THR-26%' OR detail LIKE 'PRT-26%'"
    ).changes,
    sessions: sql.run(
      "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = 'priya@venueonmyplate.in')"
    ).changes,
    users: sql.run("DELETE FROM users WHERE email = 'priya@venueonmyplate.in'").changes,
    about: sql.run(
      "UPDATE content_blocks SET meta = ?, updated_at = ? WHERE section = 'about'",
      toJson(aboutMeta),
      new Date().toISOString()
    ).changes,
  };

  return counts;
});

console.log("[cleanup] removed demo records", result);
