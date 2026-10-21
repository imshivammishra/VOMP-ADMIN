import { Router } from "express";
import { nowIso, paginationMeta, sql, toJson, uid } from "../db.js";
import { asyncHandler, HttpError, ok, parse, parsePagination } from "../lib/http.js";
import {
  contentBlockSchema,
  contentReorderSchema,
  reviewSchema,
} from "../lib/schemas.js";
import { contentBlockRow, reviewRow } from "../lib/serializers.js";
import { actorName, logActivity } from "../lib/activity.js";
import { requireRole } from "../lib/auth.js";
import { broadcast } from "../lib/realtime.js";

export const contentBlocksRouter = Router();
export const reviewsRouter = Router();

const SECTION_ORDER = [
  "heading",
  "hero",
  "ticker",
  "about",
  "category",
  "feature",
  "step",
  "gallery",
  "film",
  "faq",
  "seo",
  "cta",
];

function nextSortOrder(table, section) {
  const row = sql.get(`SELECT MAX(sort_order) AS max FROM ${table} WHERE section = ?`, section);
  return Number(row?.max || 0) + 10;
}

function contentCounts() {
  const counts = {};
  for (const row of sql.all("SELECT section, status, COUNT(*) AS count FROM content_blocks GROUP BY section, status")) {
    counts[row.section] = (counts[row.section] || 0) + row.count;
    counts[`${row.section}:${row.status}`] = row.count;
  }
  return counts;
}

function reviewCounts() {
  const counts = {};
  for (const row of sql.all("SELECT status, COUNT(*) AS count FROM reviews GROUP BY status")) {
    counts[row.status] = row.count;
  }
  counts.all = (counts.published || 0) + (counts.draft || 0);
  return counts;
}

// ── Website content blocks ─────────────────────────────────────────────────
contentBlocksRouter.get(
  "/",
  asyncHandler((req, res) => {
    const { page, limit, offset } = parsePagination(req.query, { limit: 500, maxLimit: 500 });
    const where = [];
    const params = [];
    const section = String(req.query.section || "").trim();
    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || "").trim();

    if (section && section !== "all") {
      where.push("section = ?");
      params.push(section);
    }
    if (status && status !== "all") {
      where.push("status = ?");
      params.push(status);
    }
    if (q) {
      where.push("(title LIKE ? OR subtitle LIKE ? OR body LIKE ? OR block_key LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = sql.get(`SELECT COUNT(*) AS count FROM content_blocks ${clause}`, ...params).count;
    const rows = sql.all(
      `SELECT * FROM content_blocks ${clause}
       ORDER BY CASE section ${SECTION_ORDER.map((value, index) => `WHEN '${value}' THEN ${index}`).join(" ")} ELSE 99 END,
                sort_order ASC, created_at ASC
       LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset
    );
    ok(res, rows.map(contentBlockRow), {
      ...paginationMeta(total, page, limit),
      counts: contentCounts(),
    });
  })
);

contentBlocksRouter.post(
  "/reorder",
  requireRole("admin", "editor"),
  asyncHandler((req, res) => {
    const input = parse(contentReorderSchema)(req.body);
    const now = nowIso();
    input.ids.forEach((id, index) => {
      sql.run("UPDATE content_blocks SET sort_order = ?, updated_at = ? WHERE id = ?", index * 10, now, id);
    });
    logActivity({
      actor: actorName(req),
      action: "content.reordered",
      entity: "content",
      entityId: null,
      detail: `${input.ids.length} blocks reordered`,
    });
    broadcast("content:changed", { reordered: true });
    ok(res, { ok: true });
  })
);

contentBlocksRouter.post(
  "/",
  requireRole("admin", "editor"),
  asyncHandler((req, res) => {
    const input = parse(contentBlockSchema)(req.body);
    const now = nowIso();
    const id = uid("blk_");
    const sortOrder = Number(input.sortOrder) > 0 ? Number(input.sortOrder) : nextSortOrder("content_blocks", input.section);
    sql.run(
      `INSERT INTO content_blocks
        (id, section, block_key, title, subtitle, body, image, image_alt, link_label,
         link_href, icon, meta, sort_order, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.section,
      input.blockKey,
      input.title,
      input.subtitle,
      input.body,
      input.image,
      input.imageAlt,
      input.linkLabel,
      input.linkHref,
      input.icon,
      toJson(input.meta || {}),
      sortOrder,
      input.status,
      now,
      now
    );
    const block = contentBlockRow(sql.get("SELECT * FROM content_blocks WHERE id = ?", id));
    logActivity({
      actor: actorName(req),
      action: "content.created",
      entity: "content",
      entityId: id,
      detail: `${block.section} · ${block.title || block.blockKey || "Untitled block"}`,
    });
    broadcast("content:changed", { block });
    ok(res, block, undefined, 201);
  })
);

contentBlocksRouter.patch(
  "/:id",
  requireRole("admin", "editor"),
  asyncHandler((req, res) => {
    const existing = sql.get("SELECT * FROM content_blocks WHERE id = ?", req.params.id);
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Content block not found.");
    const input = parse(contentBlockSchema)(req.body);
    const now = nowIso();
    const sortOrder = Number(input.sortOrder) > 0 ? Number(input.sortOrder) : existing.sort_order;
    sql.run(
      `UPDATE content_blocks SET section = ?, block_key = ?, title = ?, subtitle = ?, body = ?,
        image = ?, image_alt = ?, link_label = ?, link_href = ?, icon = ?, meta = ?,
        sort_order = ?, status = ?, updated_at = ? WHERE id = ?`,
      input.section,
      input.blockKey,
      input.title,
      input.subtitle,
      input.body,
      input.image,
      input.imageAlt,
      input.linkLabel,
      input.linkHref,
      input.icon,
      toJson(input.meta || {}),
      sortOrder,
      input.status,
      now,
      existing.id
    );
    const block = contentBlockRow(sql.get("SELECT * FROM content_blocks WHERE id = ?", existing.id));
    logActivity({
      actor: actorName(req),
      action: "content.updated",
      entity: "content",
      entityId: existing.id,
      detail: `${block.section} · ${block.title || block.blockKey || "Untitled block"}`,
    });
    broadcast("content:changed", { block });
    ok(res, block);
  })
);

contentBlocksRouter.delete(
  "/:id",
  requireRole("admin", "editor"),
  asyncHandler((req, res) => {
    const existing = sql.get("SELECT * FROM content_blocks WHERE id = ?", req.params.id);
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Content block not found.");
    sql.run("DELETE FROM content_blocks WHERE id = ?", existing.id);
    logActivity({
      actor: actorName(req),
      action: "content.deleted",
      entity: "content",
      entityId: existing.id,
      detail: `${existing.section} · ${existing.title || existing.block_key || "Untitled block"}`,
    });
    broadcast("content:changed", { deleted: existing.id });
    ok(res, { ok: true });
  })
);

// ── Reviews ───────────────────────────────────────────────────────────────
reviewsRouter.get(
  "/",
  asyncHandler((req, res) => {
    const { page, limit, offset } = parsePagination(req.query, { limit: 100, maxLimit: 500 });
    const where = [];
    const params = [];
    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || "").trim();
    if (status && status !== "all") {
      where.push("status = ?");
      params.push(status);
    }
    if (q) {
      where.push("(name LIKE ? OR context LIKE ? OR quote LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = sql.get(`SELECT COUNT(*) AS count FROM reviews ${clause}`, ...params).count;
    const rows = sql.all(
      `SELECT * FROM reviews ${clause}
       ORDER BY featured DESC, sort_order ASC, created_at DESC LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset
    );
    ok(res, rows.map(reviewRow), {
      ...paginationMeta(total, page, limit),
      counts: reviewCounts(),
    });
  })
);

reviewsRouter.post(
  "/reorder",
  requireRole("admin", "editor"),
  asyncHandler((req, res) => {
    const input = parse(contentReorderSchema)(req.body);
    const now = nowIso();
    input.ids.forEach((id, index) => {
      sql.run("UPDATE reviews SET sort_order = ?, updated_at = ? WHERE id = ?", index * 10, now, id);
    });
    logActivity({
      actor: actorName(req),
      action: "review.reordered",
      entity: "review",
      entityId: null,
      detail: `${input.ids.length} reviews reordered`,
    });
    broadcast("review:changed", { reordered: true });
    ok(res, { ok: true });
  })
);

reviewsRouter.post(
  "/",
  requireRole("admin", "editor"),
  asyncHandler((req, res) => {
    const input = parse(reviewSchema)(req.body);
    const now = nowIso();
    const id = uid("rev_");
    const featured = input.featured === false || input.featured === 0 || input.featured === "false" ? 0 : 1;
    const sortOrder = Number(input.sortOrder) > 0 ? Number(input.sortOrder) : (Number(sql.get("SELECT MAX(sort_order) AS max FROM reviews").max || 0) + 10);
    sql.run(
      `INSERT INTO reviews
        (id, name, context, quote, rating, image, venue_slug, featured, sort_order, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.name,
      input.context,
      input.quote,
      input.rating,
      input.image,
      input.venueSlug,
      featured,
      sortOrder,
      input.status,
      now,
      now
    );
    const review = reviewRow(sql.get("SELECT * FROM reviews WHERE id = ?", id));
    logActivity({
      actor: actorName(req),
      action: "review.created",
      entity: "review",
      entityId: id,
      detail: `${review.name} · ${review.rating}/5`,
    });
    broadcast("review:changed", { review });
    ok(res, review, undefined, 201);
  })
);

reviewsRouter.patch(
  "/:id",
  requireRole("admin", "editor"),
  asyncHandler((req, res) => {
    const existing = sql.get("SELECT * FROM reviews WHERE id = ?", req.params.id);
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Review not found.");
    const input = parse(reviewSchema)(req.body);
    const now = nowIso();
    const featured = input.featured === false || input.featured === 0 || input.featured === "false" ? 0 : 1;
    const sortOrder = Number(input.sortOrder) > 0 ? Number(input.sortOrder) : existing.sort_order;
    sql.run(
      `UPDATE reviews SET name = ?, context = ?, quote = ?, rating = ?, image = ?,
        venue_slug = ?, featured = ?, sort_order = ?, status = ?, updated_at = ? WHERE id = ?`,
      input.name,
      input.context,
      input.quote,
      input.rating,
      input.image,
      input.venueSlug,
      featured,
      sortOrder,
      input.status,
      now,
      existing.id
    );
    const review = reviewRow(sql.get("SELECT * FROM reviews WHERE id = ?", existing.id));
    logActivity({
      actor: actorName(req),
      action: "review.updated",
      entity: "review",
      entityId: existing.id,
      detail: `${review.name} · ${review.status}`,
    });
    broadcast("review:changed", { review });
    ok(res, review);
  })
);

reviewsRouter.delete(
  "/:id",
  requireRole("admin", "editor"),
  asyncHandler((req, res) => {
    const existing = sql.get("SELECT * FROM reviews WHERE id = ?", req.params.id);
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Review not found.");
    sql.run("DELETE FROM reviews WHERE id = ?", existing.id);
    logActivity({
      actor: actorName(req),
      action: "review.deleted",
      entity: "review",
      entityId: existing.id,
      detail: `${existing.name} · ${existing.rating}/5`,
    });
    broadcast("review:changed", { deleted: existing.id });
    ok(res, { ok: true });
  })
);
