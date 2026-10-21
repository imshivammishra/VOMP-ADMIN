import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
fs.mkdirSync(config.uploadsDir, { recursive: true });

const schema = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

export const db = new DatabaseSync(config.dbPath);
db.exec(schema);

// Lightweight, additive migrations for databases created by earlier builds.
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn("content_blocks", "block_key", "TEXT NOT NULL DEFAULT ''");

const cache = new Map();

function prepared(sql) {
  let statement = cache.get(sql);
  if (!statement) {
    statement = db.prepare(sql);
    cache.set(sql, statement);
  }
  return statement;
}

export const sql = {
  all(query, ...params) {
    return prepared(query).all(...params);
  },
  get(query, ...params) {
    return prepared(query).get(...params);
  },
  run(query, ...params) {
    return prepared(query).run(...params);
  },
  exec(query) {
    return db.exec(query);
  },
};

export function transaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function uid(prefix = "") {
  return `${prefix}${crypto.randomUUID().replaceAll("-", "")}`;
}

export function reference(prefix) {
  return `${prefix}-${Date.now().toString(36).slice(-5).toUpperCase()}${crypto
    .randomBytes(2)
    .toString("hex")
    .toUpperCase()}`;
}

export function uniqueReference(table, prefix) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = reference(prefix);
    const exists = sql.get(`SELECT 1 AS found FROM ${table} WHERE reference = ?`, candidate);
    if (!exists) return candidate;
  }
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export function parseJson(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function toJson(value, fallback = []) {
  return JSON.stringify(value ?? fallback);
}

export function paginationMeta(total, page, limit) {
  return {
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    hasMore: page * limit < total,
  };
}

export function closeDb() {
  try {
    db.close();
  } catch {
    /* already closed */
  }
}
