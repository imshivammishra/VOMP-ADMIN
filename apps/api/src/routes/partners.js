import { Router } from "express";
import { nowIso, paginationMeta, sql, uid } from "../db.js";
import { asyncHandler, HttpError, ok, parse, parsePagination, slugify } from "../lib/http.js";
import { partnerUpdateSchema } from "../lib/schemas.js";
import { partnerRow, venueRow } from "../lib/serializers.js";
import { actorName, logActivity } from "../lib/activity.js";
import { requireRole } from "../lib/auth.js";
import { broadcast } from "../lib/realtime.js";

export const partnersRouter = Router();

partnersRouter.get(
  "/",
  asyncHandler((req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const where = [];
    const params = [];
    const q = String(req.query.q || "").trim();
    if (q) {
      where.push("(venue_name LIKE ? OR contact_name LIKE ? OR email LIKE ? OR reference LIKE ? OR city LIKE ?)");
      for (let i = 0; i < 5; i += 1) params.push(`%${q}%`);
    }
    if (req.query.status && req.query.status !== "all") {
      where.push("status = ?");
      params.push(String(req.query.status));
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = sql.get(`SELECT COUNT(*) AS count FROM partners ${clause}`, ...params).count;
    const rows = sql.all(
      `SELECT * FROM partners ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset
    );
    const counts = { all: 0 };
    for (const row of sql.all("SELECT status, COUNT(*) AS count FROM partners GROUP BY status")) {
      counts[row.status] = row.count;
      counts.all += row.count;
    }
    ok(res, rows.map(partnerRow), { ...paginationMeta(total, page, limit), counts });
  })
);

partnersRouter.get(
  "/:id",
  asyncHandler((req, res) => {
    const row = sql.get("SELECT * FROM partners WHERE id = ?", req.params.id);
    if (!row) throw new HttpError(404, "NOT_FOUND", "Partner application not found.");
    ok(res, partnerRow(row));
  })
);

partnersRouter.patch(
  "/:id",
  requireRole("admin", "editor"),
  asyncHandler((req, res) => {
    const row = sql.get("SELECT * FROM partners WHERE id = ?", req.params.id);
    if (!row) throw new HttpError(404, "NOT_FOUND", "Partner application not found.");
    const input = parse(partnerUpdateSchema)(req.body);
    sql.run(
      "UPDATE partners SET status = ?, message = ?, updated_at = ? WHERE id = ?",
      input.status || row.status,
      input.message ?? row.message,
      nowIso(),
      row.id
    );
    const partner = partnerRow(sql.get("SELECT * FROM partners WHERE id = ?", row.id));
    logActivity({
      actor: actorName(req),
      action: "partner.updated",
      entity: "partner",
      entityId: row.id,
      detail: `${partner.reference} · ${partner.status}`,
    });
    broadcast("partner:updated", { partner });
    ok(res, partner);
  })
);

partnersRouter.post(
  "/:id/convert",
  requireRole("admin", "editor"),
  asyncHandler((req, res) => {
    const row = sql.get("SELECT * FROM partners WHERE id = ?", req.params.id);
    if (!row) throw new HttpError(404, "NOT_FOUND", "Partner application not found.");
    const now = nowIso();
    const id = uid("ven_");
    const base = slugify(`${row.venue_name}-${row.city}`) || `venue-${Date.now().toString(36)}`;
    let slug = base;
    let counter = 1;
    while (sql.get("SELECT id FROM venues WHERE slug = ?", slug)) {
      counter += 1;
      slug = `${base}-${counter}`;
    }
    sql.run(
      `INSERT INTO venues
        (id, slug, name, city, city_slug, area, type, setting, capacity_min, capacity_max,
         price_hint, image, image_alt, short_description, description, amenities, event_types,
         featured, status, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '', ?, 'Indoor + Outdoor', 0, 0, '', '', '', ?, ?, '[]', '[]', 0, 'draft', 0, ?, ?)`,
      id,
      slug,
      row.venue_name,
      row.city,
      slugify(row.city),
      row.venue_type,
      `Partner application ${row.reference}.`,
      row.message,
      now,
      now
    );
    sql.run("UPDATE partners SET status = 'verified', updated_at = ? WHERE id = ?", now, row.id);
    const venue = venueRow(sql.get("SELECT * FROM venues WHERE id = ?", id));
    logActivity({
      actor: actorName(req),
      action: "partner.converted",
      entity: "venue",
      entityId: id,
      detail: `${row.venue_name} · draft venue created from ${row.reference}`,
    });
    broadcast("venue:changed", { venue });
    broadcast("partner:updated", { partner: partnerRow(sql.get("SELECT * FROM partners WHERE id = ?", row.id)) });
    ok(res, { venue }, undefined, 201);
  })
);

partnersRouter.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler((req, res) => {
    const row = sql.get("SELECT * FROM partners WHERE id = ?", req.params.id);
    if (!row) throw new HttpError(404, "NOT_FOUND", "Partner application not found.");
    sql.run("DELETE FROM partners WHERE id = ?", row.id);
    logActivity({
      actor: actorName(req),
      action: "partner.deleted",
      entity: "partner",
      entityId: row.id,
      detail: `${row.reference} · ${row.venue_name}`,
    });
    broadcast("partner:updated", { deleted: row.id });
    ok(res, { ok: true });
  })
);
