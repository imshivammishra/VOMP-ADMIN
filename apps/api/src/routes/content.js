import { Router } from "express";
import { nowIso, paginationMeta, sql, uid } from "../db.js";
import { asyncHandler, HttpError, ok, parse, parsePagination, slugify } from "../lib/http.js";
import { destinationSchema, postSchema, venueSchema } from "../lib/schemas.js";
import { destinationRow, postRow, venueRow } from "../lib/serializers.js";
import { actorName, logActivity } from "../lib/activity.js";
import { requireRole } from "../lib/auth.js";
import { broadcast } from "../lib/realtime.js";

export const venuesRouter = Router();
export const destinationsRouter = Router();
export const postsRouter = Router();

function uniqueSlug(table, desired, excludeId = null) {
  const base = slugify(desired) || `item-${Date.now().toString(36)}`;
  let candidate = base;
  let counter = 1;
  while (true) {
    const row = sql.get(`SELECT id FROM ${table} WHERE slug = ?`, candidate);
    if (!row || row.id === excludeId) return candidate;
    counter += 1;
    candidate = `${base}-${counter}`;
  }
}

function listQuery(table, query, mapper) {
  const { page, limit, offset } = parsePagination(query);
  const where = [];
  const params = [];
  const q = String(query.q || "").trim();
  if (q) {
    const columns =
      table === "posts"
        ? ["title", "slug", "category", "author", "excerpt"]
        : table === "destinations"
          ? ["name", "slug", "tagline", "description"]
          : ["name", "slug", "city", "area", "type"];
    where.push(`(${columns.map((column) => `${column} LIKE ?`).join(" OR ")})`);
    for (let index = 0; index < columns.length; index += 1) params.push(`%${q}%`);
  }
  if (query.status && query.status !== "all") {
    where.push("status = ?");
    params.push(String(query.status));
  }
  if (query.city && table === "venues") {
    where.push("city_slug = ?");
    params.push(String(query.city));
  }
  if (query.featured === "true" && table === "venues") where.push("featured = 1");
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = sql.get(`SELECT COUNT(*) AS count FROM ${table} ${clause}`, ...params).count;
  const order =
    table === "posts"
      ? "published_on DESC, created_at DESC"
      : table === "venues"
        ? "sort_order ASC, name ASC"
        : "name ASC";
  const rows = sql.all(
    `SELECT * FROM ${table} ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  );
  const counts = { all: total };
  for (const row of sql.all(`SELECT status, COUNT(*) AS count FROM ${table} GROUP BY status`)) {
    counts[row.status] = row.count;
  }
  return { rows: rows.map(mapper), meta: { ...paginationMeta(total, page, limit), counts } };
}

// ── Venues ────────────────────────────────────────────────────────────────
venuesRouter.get(
  "/",
  asyncHandler((req, res) => {
    const { rows, meta } = listQuery("venues", req.query, venueRow);
    ok(res, rows, meta);
  })
);

venuesRouter.get(
  "/:id",
  asyncHandler((req, res) => {
    const row = sql.get("SELECT * FROM venues WHERE id = ? OR slug = ?", req.params.id, req.params.id);
    if (!row) throw new HttpError(404, "NOT_FOUND", "Venue not found.");
    ok(res, venueRow(row));
  })
);

venuesRouter.post(
  "/",
  requireRole("admin", "editor"),
  asyncHandler((req, res) => {
    const input = parse(venueSchema)(req.body);
    const now = nowIso();
    const id = uid("ven_");
    const slug = uniqueSlug("venues", input.slug || input.name);
    sql.run(
      `INSERT INTO venues
        (id, slug, name, city, city_slug, area, type, setting, capacity_min, capacity_max,
         price_hint, image, image_alt, short_description, description, amenities, event_types,
         featured, status, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      id,
      slug,
      input.name,
      input.city,
      input.citySlug || slugify(input.city),
      input.area,
      input.type,
      input.setting,
      input.capacityMin,
      input.capacityMax,
      input.priceHint,
      input.image,
      input.imageAlt,
      input.shortDescription,
      input.description,
      JSON.stringify(Array.isArray(input.amenities) ? input.amenities : String(input.amenities).split(",").map((s) => s.trim()).filter(Boolean)),
      JSON.stringify(Array.isArray(input.eventTypes) ? input.eventTypes : String(input.eventTypes).split(",").map((s) => s.trim()).filter(Boolean)),
      input.featured ? 1 : 0,
      input.status,
      now,
      now
    );
    const venue = venueRow(sql.get("SELECT * FROM venues WHERE id = ?", id));
    logActivity({
      actor: actorName(req),
      action: "venue.created",
      entity: "venue",
      entityId: id,
      detail: `${venue.name} · ${venue.city}`,
    });
    broadcast("venue:changed", { venue });
    ok(res, venue, undefined, 201);
  })
);

venuesRouter.patch(
  "/:id",
  requireRole("admin", "editor"),
  asyncHandler((req, res) => {
    const existing = sql.get("SELECT * FROM venues WHERE id = ?", req.params.id);
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Venue not found.");
    const input = parse(venueSchema)(req.body);
    const now = nowIso();
    const slug = uniqueSlug("venues", input.slug || existing.slug, existing.id);
    const amenities = Array.isArray(input.amenities)
      ? input.amenities
      : String(input.amenities).split(",").map((s) => s.trim()).filter(Boolean);
    const eventTypes = Array.isArray(input.eventTypes)
      ? input.eventTypes
      : String(input.eventTypes).split(",").map((s) => s.trim()).filter(Boolean);
    sql.run(
      `UPDATE venues SET slug = ?, name = ?, city = ?, city_slug = ?, area = ?, type = ?, setting = ?,
        capacity_min = ?, capacity_max = ?, price_hint = ?, image = ?, image_alt = ?,
        short_description = ?, description = ?, amenities = ?, event_types = ?, featured = ?,
        status = ?, updated_at = ? WHERE id = ?`,
      slug,
      input.name,
      input.city,
      input.citySlug || slugify(input.city),
      input.area,
      input.type,
      input.setting,
      input.capacityMin,
      input.capacityMax,
      input.priceHint,
      input.image,
      input.imageAlt,
      input.shortDescription,
      input.description,
      JSON.stringify(amenities),
      JSON.stringify(eventTypes),
      input.featured ? 1 : 0,
      input.status,
      now,
      existing.id
    );
    const venue = venueRow(sql.get("SELECT * FROM venues WHERE id = ?", existing.id));
    logActivity({
      actor: actorName(req),
      action: "venue.updated",
      entity: "venue",
      entityId: existing.id,
      detail: `${venue.name} · ${venue.status}`,
    });
    broadcast("venue:changed", { venue });
    ok(res, venue);
  })
);

venuesRouter.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler((req, res) => {
    const row = sql.get("SELECT * FROM venues WHERE id = ?", req.params.id);
    if (!row) throw new HttpError(404, "NOT_FOUND", "Venue not found.");
    sql.run("DELETE FROM venues WHERE id = ?", row.id);
    logActivity({
      actor: actorName(req),
      action: "venue.deleted",
      entity: "venue",
      entityId: row.id,
      detail: `${row.name} · ${row.city}`,
    });
    broadcast("venue:changed", { deleted: row.id });
    ok(res, { ok: true });
  })
);

// ── Destinations ──────────────────────────────────────────────────────────
destinationsRouter.get(
  "/",
  asyncHandler((req, res) => {
    const { rows, meta } = listQuery("destinations", req.query, destinationRow);
    ok(res, rows, meta);
  })
);

destinationsRouter.post(
  "/",
  requireRole("admin", "editor"),
  asyncHandler((req, res) => {
    const input = parse(destinationSchema)(req.body);
    const id = uid("dst_");
    const slug = uniqueSlug("destinations", input.slug || input.name);
    const now = nowIso();
    const popularTypes = Array.isArray(input.popularTypes)
      ? input.popularTypes
      : String(input.popularTypes).split(",").map((s) => s.trim()).filter(Boolean);
    sql.run(
      `INSERT INTO destinations
        (id, slug, name, tagline, description, image, image_alt, venue_count_label, popular_types, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      slug,
      input.name,
      input.tagline,
      input.description,
      input.image,
      input.imageAlt,
      input.venueCountLabel,
      JSON.stringify(popularTypes),
      input.status,
      now,
      now
    );
    const destination = destinationRow(sql.get("SELECT * FROM destinations WHERE id = ?", id));
    logActivity({
      actor: actorName(req),
      action: "destination.created",
      entity: "destination",
      entityId: id,
      detail: destination.name,
    });
    broadcast("destination:changed", { destination });
    ok(res, destination, undefined, 201);
  })
);

destinationsRouter.patch(
  "/:id",
  requireRole("admin", "editor"),
  asyncHandler((req, res) => {
    const existing = sql.get("SELECT * FROM destinations WHERE id = ?", req.params.id);
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Destination not found.");
    const input = parse(destinationSchema)(req.body);
    const slug = uniqueSlug("destinations", input.slug || existing.slug, existing.id);
    const popularTypes = Array.isArray(input.popularTypes)
      ? input.popularTypes
      : String(input.popularTypes).split(",").map((s) => s.trim()).filter(Boolean);
    sql.run(
      `UPDATE destinations SET slug = ?, name = ?, tagline = ?, description = ?, image = ?,
        image_alt = ?, venue_count_label = ?, popular_types = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      slug,
      input.name,
      input.tagline,
      input.description,
      input.image,
      input.imageAlt,
      input.venueCountLabel,
      JSON.stringify(popularTypes),
      input.status,
      nowIso(),
      existing.id
    );
    const destination = destinationRow(sql.get("SELECT * FROM destinations WHERE id = ?", existing.id));
    logActivity({
      actor: actorName(req),
      action: "destination.updated",
      entity: "destination",
      entityId: existing.id,
      detail: destination.name,
    });
    broadcast("destination:changed", { destination });
    ok(res, destination);
  })
);

destinationsRouter.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler((req, res) => {
    const row = sql.get("SELECT * FROM destinations WHERE id = ?", req.params.id);
    if (!row) throw new HttpError(404, "NOT_FOUND", "Destination not found.");
    sql.run("DELETE FROM destinations WHERE id = ?", row.id);
    logActivity({
      actor: actorName(req),
      action: "destination.deleted",
      entity: "destination",
      entityId: row.id,
      detail: row.name,
    });
    broadcast("destination:changed", { deleted: row.id });
    ok(res, { ok: true });
  })
);

// ── Journal posts ─────────────────────────────────────────────────────────
postsRouter.get(
  "/",
  asyncHandler((req, res) => {
    const { rows, meta } = listQuery("posts", req.query, postRow);
    ok(res, rows, meta);
  })
);

postsRouter.post(
  "/",
  requireRole("admin", "editor"),
  asyncHandler((req, res) => {
    const input = parse(postSchema)(req.body);
    const id = uid("pst_");
    const slug = uniqueSlug("posts", input.slug || input.title);
    const now = nowIso();
    const body = Array.isArray(input.body)
      ? input.body
      : String(input.body).split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    sql.run(
      `INSERT INTO posts
        (id, slug, title, excerpt, category, author, published_on, reading_minutes, image, image_alt, body, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      slug,
      input.title,
      input.excerpt,
      input.category,
      input.author,
      input.publishedOn || now.slice(0, 10),
      input.readingMinutes,
      input.image,
      input.imageAlt,
      JSON.stringify(body),
      input.status,
      now,
      now
    );
    const post = postRow(sql.get("SELECT * FROM posts WHERE id = ?", id));
    logActivity({
      actor: actorName(req),
      action: "post.created",
      entity: "post",
      entityId: id,
      detail: post.title,
    });
    broadcast("post:changed", { post });
    ok(res, post, undefined, 201);
  })
);

postsRouter.patch(
  "/:id",
  requireRole("admin", "editor"),
  asyncHandler((req, res) => {
    const existing = sql.get("SELECT * FROM posts WHERE id = ?", req.params.id);
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Journal entry not found.");
    const input = parse(postSchema)(req.body);
    const slug = uniqueSlug("posts", input.slug || existing.slug, existing.id);
    const body = Array.isArray(input.body)
      ? input.body
      : String(input.body).split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    sql.run(
      `UPDATE posts SET slug = ?, title = ?, excerpt = ?, category = ?, author = ?, published_on = ?,
        reading_minutes = ?, image = ?, image_alt = ?, body = ?, status = ?, updated_at = ? WHERE id = ?`,
      slug,
      input.title,
      input.excerpt,
      input.category,
      input.author,
      input.publishedOn || existing.published_on,
      input.readingMinutes,
      input.image,
      input.imageAlt,
      JSON.stringify(body),
      input.status,
      nowIso(),
      existing.id
    );
    const post = postRow(sql.get("SELECT * FROM posts WHERE id = ?", existing.id));
    logActivity({
      actor: actorName(req),
      action: "post.updated",
      entity: "post",
      entityId: existing.id,
      detail: `${post.title} · ${post.status}`,
    });
    broadcast("post:changed", { post });
    ok(res, post);
  })
);

postsRouter.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler((req, res) => {
    const row = sql.get("SELECT * FROM posts WHERE id = ?", req.params.id);
    if (!row) throw new HttpError(404, "NOT_FOUND", "Journal entry not found.");
    sql.run("DELETE FROM posts WHERE id = ?", row.id);
    logActivity({
      actor: actorName(req),
      action: "post.deleted",
      entity: "post",
      entityId: row.id,
      detail: row.title,
    });
    broadcast("post:changed", { deleted: row.id });
    ok(res, { ok: true });
  })
);
