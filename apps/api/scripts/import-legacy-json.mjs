#!/usr/bin/env node
/**
 * Import the legacy VOMP Postgres exports into the new SQLite database.
 *
 * The Postgres container is never modified. Export the four JSON files first:
 *   venues.json, media.json, enquiries.json, settings.json
 *
 * Usage:
 *   DB_PATH=/opt/vomp-deploy/shared/data/vomp.sqlite \
 *   EXPORT_DIR=/opt/vomp-deploy/shared/backups/legacy-export \
 *   node apps/api/scripts/import-legacy-json.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const exportDir = path.resolve(process.env.EXPORT_DIR || "legacy-export");
const dbPath = path.resolve(process.env.DB_PATH || "data/vomp.sqlite");
const s3Base = (process.env.S3_PUBLIC_BASE_URL || "https://vomp-media.s3.ap-south-1.amazonaws.com").replace(/\/+$/, "");

function read(name) {
  const file = path.join(exportDir, name);
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`${file} is not a JSON array`);
  return parsed;
}

const clean = (value) =>
  String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const truncate = (value, length) => {
  const text = clean(value);
  return text.length > length ? `${text.slice(0, length - 1).trim()}…` : text;
};

const titleCase = (value) =>
  clean(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/\bNcr\b/g, "NCR")
    .replace(/\bDj\b/g, "DJ");

const arrayOf = (value) => {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [clean(value)];
  return [];
};

const unique = (values, limit = 40) => [...new Set(values.map(clean).filter(Boolean))].slice(0, limit);

const cityAliases = new Map([
  ["jim corbett", "Jim Corbett"],
  ["jhujhunu", "Jhunjhunu"],
]);

const normalizeCity = (value) => {
  const city = clean(value);
  return cityAliases.get(city.toLowerCase()) || city;
};

const slugify = (value) =>
  clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "india";

const iso = (value, fallback = new Date().toISOString()) => {
  if (!value) return fallback;
  const raw = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw) ? `${raw.replace(" ", "T")}Z` : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
};

const dateOnly = (value) => {
  if (!value) return "";
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
};

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function venueSetting(areas) {
  const text = areas.join(" ");
  const outdoor = /lawn|pool|amphitheatre|garden|terrace|outdoor|open air/i.test(text);
  const indoor = /banquet|hall|indoor|conference|ballroom/i.test(text);
  if (outdoor && indoor) return "Indoor + Outdoor";
  if (outdoor) return "Outdoor";
  return "Indoor";
}

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 10000;");

const venues = read("venues.json");
const media = read("media.json");
const enquiries = read("enquiries.json");
const settings = read("settings.json");

const summary = {
  venues: { imported: 0, published: 0, draft: 0, archived: 0, skipped: 0 },
  media: { imported: 0, skipped: 0 },
  enquiries: { imported: 0, skipped: 0 },
  settings: { imported: 0, skipped: 0 },
  destinations: { updated: 0 },
};

const insertVenue = db.prepare(`
  INSERT INTO venues (
    id, slug, name, city, city_slug, area, type, setting,
    capacity_min, capacity_max, price_hint, image, image_alt,
    short_description, description, amenities, event_types,
    featured, status, sort_order, created_at, updated_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?, ?, ?
  )
  ON CONFLICT(id) DO UPDATE SET
    slug = excluded.slug, name = excluded.name, city = excluded.city,
    city_slug = excluded.city_slug, area = excluded.area, type = excluded.type,
    setting = excluded.setting, capacity_min = excluded.capacity_min,
    capacity_max = excluded.capacity_max, price_hint = excluded.price_hint,
    image = excluded.image, image_alt = excluded.image_alt,
    short_description = excluded.short_description, description = excluded.description,
    amenities = excluded.amenities, event_types = excluded.event_types,
    featured = excluded.featured, status = excluded.status,
    sort_order = excluded.sort_order, updated_at = excluded.updated_at
`);

for (const venue of venues) {
  try {
    const id = String(venue.id || "").trim();
    const slug = String(venue.slug || "").trim();
    const name = clean(venue.name);
    if (!id || !slug || !name) throw new Error("missing id/slug/name");

    const areas = unique([...arrayOf(venue.venue_areas), ...arrayOf(venue.facilities), ...arrayOf(venue.amenities)]);
    const eventTypes = unique(arrayOf(venue.event_types).map(titleCase), 20);
    const description = truncate(venue.description || venue.summary, 8000);
    const shortDescription = truncate(venue.description || venue.summary, 480);
    const rawPrice = clean(venue.price_display);
    const priceHint = /imported pricing|requires admin review/i.test(rawPrice) ? "Price on request" : truncate(rawPrice, 80);
    const image = clean(venue.cover_image_url) || arrayOf(venue.gallery_image_urls)[0] || "";
    const statusRaw = clean(venue.status).toLowerCase();
    const status = ["published", "draft", "archived"].includes(statusRaw) ? statusRaw : "draft";
    const city = normalizeCity(venue.city) || "India";
    const area = truncate(venue.locality || venue.address_line, 160);
    const createdAt = iso(venue.created_at);
    const updatedAt = iso(venue.updated_at, createdAt);

    insertVenue.run(
      id, slug, name, city, slugify(city), area, truncate(venue.venue_type, 120), venueSetting(areas),
      number(venue.capacity_min), number(venue.capacity_max), priceHint, image, name,
      shortDescription, description, JSON.stringify(areas), JSON.stringify(eventTypes),
      venue.show_on_home ? 1 : 0, status, number(venue.home_sort_order), createdAt, updatedAt
    );
    summary.venues.imported += 1;
    summary.venues[status] += 1;
  } catch (error) {
    summary.venues.skipped += 1;
    console.warn(`venue skipped (${venue.slug || venue.id}): ${error.message}`);
  }
}

const insertMedia = db.prepare(`
  INSERT INTO media (id, filename, original_name, mime, size, url, alt, kind, uploaded_by, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
  ON CONFLICT(id) DO UPDATE SET
    filename = excluded.filename, original_name = excluded.original_name,
    mime = excluded.mime, size = excluded.size, url = excluded.url,
    alt = excluded.alt, kind = excluded.kind
`);

for (const item of media) {
  try {
    const id = String(item.id || "").trim();
    const key = clean(item.s3_key);
    if (!id || !key) throw new Error("missing id/s3_key");
    const filename = path.basename(key.split("?")[0]) || `${id}.webp`;
    const originalName = clean(item.file_name) || filename;
    const url = /^https?:\/\//i.test(key) ? key : `${s3Base}/${key.replace(/^\/+/, "")}`;
    insertMedia.run(
      id, filename, originalName, clean(item.content_type) || "image/webp",
      number(item.size_bytes), url, originalName, (clean(item.kind) || "IMAGE").toLowerCase(),
      iso(item.created_at)
    );
    summary.media.imported += 1;
  } catch (error) {
    summary.media.skipped += 1;
    console.warn(`media skipped (${item.id}): ${error.message}`);
  }
}

const sourceMap = {
  VENUE_DETAIL_QUOTE: "venue-detail",
  QUICK_QUOTE: "quick-quote",
  PRICE_BEAT_CHALLENGE: "price-beat",
  CONTACT: "contact",
};
const statusMap = {
  NEW: "new",
  CONTACTED: "contacted",
  QUALIFIED: "qualified",
  WON: "won",
  LOST: "lost",
  CLOSED: "closed",
  SPAM: "lost",
};

const insertEnquiry = db.prepare(`
  INSERT INTO enquiries (
    id, reference, name, phone, email, city, event_type, event_date,
    guest_count, message, source, status, priority, assignee, tags, notes,
    ip, user_agent, first_response_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    reference = excluded.reference, name = excluded.name, phone = excluded.phone,
    email = excluded.email, city = excluded.city, event_type = excluded.event_type,
    event_date = excluded.event_date, guest_count = excluded.guest_count,
    message = excluded.message, source = excluded.source, status = excluded.status,
    priority = excluded.priority, tags = excluded.tags, notes = excluded.notes,
    updated_at = excluded.updated_at
`);

const usedReferences = new Set();
for (const enquiry of enquiries) {
  try {
    const id = String(enquiry.id || "").trim();
    if (!id) throw new Error("missing id");
    const createdAt = iso(enquiry.created_at);
    const updatedAt = iso(enquiry.updated_at, createdAt);
    const statusRaw = clean(enquiry.status).toUpperCase();
    const status = statusMap[statusRaw] || "new";
    const isSpam = statusRaw === "SPAM";
    const source = sourceMap[clean(enquiry.source).toUpperCase()] || clean(enquiry.source).toLowerCase() || "website";
    let reference = `ENQ-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    if (usedReferences.has(reference)) reference = `${reference}-${usedReferences.size + 1}`;
    usedReferences.add(reference);

    const notes = [];
    const legacyNotes = [
      clean(enquiry.admin_notes),
      clean(enquiry.venue_name) && `Venue: ${clean(enquiry.venue_name)}`,
      clean(enquiry.locality_preference) && `Locality: ${clean(enquiry.locality_preference)}`,
      clean(enquiry.venue_type_preference) && `Venue type: ${clean(enquiry.venue_type_preference)}`,
      clean(enquiry.budget_range_label) && `Budget: ${clean(enquiry.budget_range_label)}`,
      clean(enquiry.food_preference) && `Food: ${clean(enquiry.food_preference)}`,
      number(enquiry.rooms_required) > 0 && `Rooms: ${number(enquiry.rooms_required)}`,
      clean(enquiry.preferred_time_window) && `Preferred time: ${clean(enquiry.preferred_time_window)}`,
      clean(enquiry.event_date_end) && `Event end: ${dateOnly(enquiry.event_date_end)}`,
    ].filter(Boolean);
    if (legacyNotes.length > 0) {
      notes.push({
        id: `legacy-${id}`,
        text: legacyNotes.join(" · "),
        author: "Legacy import",
        at: createdAt,
      });
    }

    const tags = [];
    if (isSpam) tags.push("legacy-spam");
    if (clean(enquiry.campaign_source)) tags.push(`campaign:${clean(enquiry.campaign_source)}`);

    insertEnquiry.run(
      id, reference, clean(enquiry.name) || "Unnamed enquiry", clean(enquiry.mobile), clean(enquiry.email) || null,
      clean(enquiry.city), titleCase(enquiry.event_type), dateOnly(enquiry.event_date),
      number(enquiry.guest_count) > 0 ? String(number(enquiry.guest_count)) : "",
      clean(enquiry.message), source, status, isSpam ? "low" : "normal", "",
      JSON.stringify(unique(tags, 10)), JSON.stringify(notes), createdAt, updatedAt
    );
    summary.enquiries.imported += 1;
  } catch (error) {
    summary.enquiries.skipped += 1;
    console.warn(`enquiry skipped (${enquiry.id}): ${error.message}`);
  }
}

const insertSetting = db.prepare(`
  INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)
`);
for (const row of settings) {
  const key = clean(row.key);
  if (!key) continue;
  const result = insertSetting.run(key, JSON.stringify(row.value), new Date().toISOString());
  if (result.changes > 0) summary.settings.imported += 1;
  else summary.settings.skipped += 1;
}

const updateDestination = db.prepare(`
  UPDATE destinations SET venue_count_label = ?, updated_at = ? WHERE slug = ? AND ? > 0
`);
for (const destination of db.prepare("SELECT slug FROM destinations").all()) {
  const count = db.prepare("SELECT COUNT(*) AS count FROM venues WHERE status = 'published' AND city_slug = ?").get(destination.slug).count;
  if (count > 0) {
    const result = updateDestination.run(`${count} ${count === 1 ? "venue" : "venues"}`, new Date().toISOString(), destination.slug, count);
    summary.destinations.updated += result.changes;
  }
}

db.prepare(`
  INSERT INTO activity (id, actor, action, entity, entity_id, detail, created_at)
  VALUES (?, ?, ?, ?, NULL, ?, ?)
`).run(
  `act_legacy_${Date.now()}`, "system", "legacy.import", "system",
  JSON.stringify({
    source: "legacy Docker Postgres",
    exportDir,
    ...summary,
    counts: {
      venues: db.prepare("SELECT COUNT(*) AS count FROM venues").get().count,
      media: db.prepare("SELECT COUNT(*) AS count FROM media").get().count,
      enquiries: db.prepare("SELECT COUNT(*) AS count FROM enquiries").get().count,
    },
  }),
  new Date().toISOString()
);

console.log(JSON.stringify({
  database: dbPath,
  exportDir,
  summary,
  totals: {
    venues: db.prepare("SELECT COUNT(*) AS count FROM venues").get().count,
    published: db.prepare("SELECT COUNT(*) AS count FROM venues WHERE status = 'published'").get().count,
    media: db.prepare("SELECT COUNT(*) AS count FROM media").get().count,
    enquiries: db.prepare("SELECT COUNT(*) AS count FROM enquiries").get().count,
    settings: db.prepare("SELECT COUNT(*) AS count FROM settings").get().count,
  },
}, null, 2));

db.close();
