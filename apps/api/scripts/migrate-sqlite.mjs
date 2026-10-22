/**
 * One-way SQLite → MongoDB Atlas migration.
 *
 * Usage:
 *   node scripts/migrate-sqlite.mjs /path/to/vomp.sqlite --replace
 *
 * The SQLite file is only read. `--replace` clears the target collections
 * first so the migration is repeatable; without it, non-empty collections are
 * skipped. Secrets are read from the normal MONGODB_URI / MONGODB_DB env vars.
 */
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { MongoClient } from "mongodb";
import "dotenv/config";

const sqlitePath = path.resolve(process.argv[2] || process.env.SQLITE_PATH || "data/vomp.sqlite");
const replace = process.argv.includes("--replace");
const mongoUri = (process.env.MONGODB_URI || process.env.MONGO_URI || "").trim();
const mongoDb = (process.env.MONGODB_DB || process.env.MONGO_DB || "vomp").trim();

if (!mongoUri) throw new Error("MONGODB_URI is required.");
if (mongoUri === process.env.MIGRATION_SOURCE_URI) {
  throw new Error("Refusing to migrate into the source database.");
}

const JSON_FIELDS = {
  venues: ["amenities", "event_types"],
  destinations: ["popular_types"],
  posts: ["body"],
  enquiries: ["tags", "notes"],
  messages: ["meta"],
  content_blocks: ["meta"],
};

const BOOLEAN_FIELDS = {
  venues: ["featured"],
  reviews: ["featured"],
};

const COLLECTIONS = [
  "users",
  "sessions",
  "venues",
  "destinations",
  "posts",
  "enquiries",
  "threads",
  "messages",
  "partners",
  "media",
  "activity",
  "content_blocks",
  "reviews",
  "settings",
];

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function transform(table, row) {
  const output = { ...row };
  for (const field of JSON_FIELDS[table] || []) {
    output[field] = parseJson(row[field], field === "meta" ? {} : []);
  }
  for (const field of BOOLEAN_FIELDS[table] || []) {
    output[field] = Boolean(row[field]);
  }
  if (table === "settings") {
    output._id = row.key;
    output.value = parseJson(row.value, {});
  }
  return output;
}

const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 20_000 });
await client.connect();
const db = client.db(mongoDb);

const report = {};
try {
  for (const table of COLLECTIONS) {
    const collection = db.collection(table);
    const existing = await collection.countDocuments({});
    if (existing > 0 && !replace) {
      report[table] = { skipped: true, existing };
      continue;
    }
    if (existing > 0 && replace) await collection.deleteMany({});

    let rows = [];
    try {
      rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
    } catch {
      report[table] = { missingInSource: true };
      continue;
    }
    const documents = rows.map((row) => transform(table, row));
    for (let index = 0; index < documents.length; index += 500) {
      const batch = documents.slice(index, index + 500);
      if (batch.length) await collection.insertMany(batch, { ordered: false });
    }
    report[table] = { migrated: documents.length };
  }

  // Settings keys are the document ids; make sure the natural key remains queryable.
  await db.collection("settings").createIndex({ key: 1 }, { unique: true, sparse: true });

  console.log(JSON.stringify({ database: mongoDb, source: sqlitePath, report }, null, 2));
  const counts = {};
  for (const table of COLLECTIONS) {
    counts[table] = await db.collection(table).countDocuments({});
  }
  console.log("Target counts:", JSON.stringify(counts));
} finally {
  await client.close();
  sqlite.close();
}
