import { Router } from "express";
import { z } from "zod";
import { nowIso, sql, uid, uniqueReference } from "../db.js";
import { asyncHandler, created, ok, parse, slugify } from "../lib/http.js";
import { partnerApplicationSchema } from "../lib/schemas.js";
import { destinationRow, enquiryRow, postRow, venueRow, contentBlockRow, reviewRow } from "../lib/serializers.js";
import { getSettings } from "../lib/settings.js";
import { appendCustomerMessage, submitEnquiry } from "../services/leads.js";
import { logActivity } from "../lib/activity.js";
import { broadcast } from "../lib/realtime.js";

export const publicRouter = Router();

function cache(res, seconds = 60) {
  res.setHeader("Cache-Control", `public, max-age=${seconds}, stale-while-revalidate=300`);
}

publicRouter.get(
  "/venues",
  asyncHandler((req, res) => {
    const { city, event, featured, limit } = req.query;
    const where = ["status = 'published'"];
    const params = [];
    if (city) {
      where.push("city_slug = ?");
      params.push(String(city).toLowerCase());
    }
    if (event) {
      where.push("event_types LIKE ?");
      params.push(`%${String(event)}%`);
    }
    if (featured === "true") where.push("featured = 1");
    const max = Math.min(500, Math.max(1, Number(limit) || 500));
    const rows = sql.all(
      `SELECT * FROM venues WHERE ${where.join(" AND ")}
       ORDER BY featured DESC, sort_order ASC, name ASC LIMIT ?`,
      ...params,
      max
    );
    cache(res, 120);
    ok(res, rows.map(venueRow));
  })
);

publicRouter.get(
  "/venues/:slug",
  asyncHandler((req, res) => {
    const row = sql.get(
      "SELECT * FROM venues WHERE slug = ? AND status = 'published'",
      req.params.slug
    );
    if (!row) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Venue not found." } });
    }
    cache(res, 120);
    ok(res, venueRow(row));
  })
);

publicRouter.get(
  "/cities",
  asyncHandler((_req, res) => {
    const rows = sql.all(
      "SELECT * FROM destinations WHERE status = 'published' ORDER BY name ASC"
    );
    cache(res, 300);
    ok(res, rows.map(destinationRow));
  })
);

publicRouter.get(
  "/cities/:slug",
  asyncHandler((req, res) => {
    const row = sql.get(
      "SELECT * FROM destinations WHERE slug = ? AND status = 'published'",
      req.params.slug
    );
    if (!row) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Destination not found." } });
    }
    cache(res, 300);
    ok(res, destinationRow(row));
  })
);

publicRouter.get(
  "/blogs",
  asyncHandler((_req, res) => {
    const rows = sql.all(
      "SELECT * FROM posts WHERE status = 'published' ORDER BY published_on DESC, created_at DESC"
    );
    cache(res, 120);
    ok(res, rows.map(postRow));
  })
);

publicRouter.get(
  "/blogs/:slug",
  asyncHandler((req, res) => {
    const row = sql.get(
      "SELECT * FROM posts WHERE slug = ? AND status = 'published'",
      req.params.slug
    );
    if (!row) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Journal entry not found." } });
    }
    cache(res, 120);
    ok(res, postRow(row));
  })
);

publicRouter.get(
  "/settings",
  asyncHandler((_req, res) => {
    const settings = getSettings();
    cache(res, 300);
    ok(res, { general: settings.general, notifications: undefined, api: { apiUrl: settings.api.apiUrl } });
  })
);

publicRouter.get(
  "/content",
  asyncHandler((_req, res) => {
    const rows = sql.all(
      `SELECT * FROM content_blocks WHERE status = 'published'
       ORDER BY sort_order ASC, created_at ASC`
    );
    cache(res, 60);
    ok(res, rows.map(contentBlockRow));
  })
);

publicRouter.get(
  "/reviews",
  asyncHandler((req, res) => {
    const venueSlug = String(req.query.venue || "").trim();
    const where = ["status = 'published'"];
    const params = [];
    if (venueSlug) {
      where.push("(venue_slug = ? OR venue_slug = '')");
      params.push(venueSlug);
    }
    const rows = sql.all(
      `SELECT * FROM reviews WHERE ${where.join(" AND ")}
       ORDER BY featured DESC, sort_order ASC, created_at DESC`,
      ...params
    );
    cache(res, 60);
    ok(res, rows.map(reviewRow));
  })
);

publicRouter.post(
  "/enquiries",
  asyncHandler((req, res) => {
    const result = submitEnquiry(req.body, req);
    return created(res, { id: result.id, reference: result.reference });
  })
);

publicRouter.post(
  "/partners",
  asyncHandler((req, res) => {
    const input = parse(partnerApplicationSchema)(req.body);
    const now = nowIso();
    const id = uid("prt_");
    const reference = uniqueReference("partners", "PRT");
    sql.run(
      `INSERT INTO partners
        (id, reference, venue_name, contact_name, email, phone, city, venue_type, rooms,
         website, message, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
      id,
      reference,
      input.venueName,
      input.contactName,
      input.email,
      input.phone,
      input.city,
      input.venueType,
      input.rooms,
      input.website,
      input.message,
      now,
      now
    );
    logActivity({
      actor: input.contactName,
      action: "partner.applied",
      entity: "partner",
      entityId: id,
      detail: `${reference} · ${input.venueName} · ${input.city}`,
    });
    broadcast("partner:new", { id, reference, venueName: input.venueName, city: input.city });
    return created(res, { id, reference });
  })
);

publicRouter.post(
  "/chat",
  asyncHandler((req, res) => {
    const result = appendCustomerMessage(req.body);
    return created(res, {
      threadId: result.threadId,
      reference: result.thread.reference,
      message: result.message,
    });
  })
);

// ── Legacy bridge used by older public website builds ─────────────────────
export const legacyRouter = Router();

legacyRouter.post(
  "/enquiries",
  asyncHandler((req, res) => {
    const result = submitEnquiry(req.body, req);
    return created(res, { ok: true, id: result.id, reference: result.reference });
  })
);

legacyRouter.post(
  "/partners",
  asyncHandler((req, res) => {
    const input = parse(partnerApplicationSchema)(req.body);
    const now = nowIso();
    const id = uid("prt_");
    const reference = uniqueReference("partners", "PRT");
    sql.run(
      `INSERT INTO partners
        (id, reference, venue_name, contact_name, email, phone, city, venue_type, rooms,
         website, message, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
      id,
      reference,
      input.venueName,
      input.contactName,
      input.email,
      input.phone,
      input.city,
      input.venueType,
      input.rooms,
      input.website,
      input.message,
      now,
      now
    );
    broadcast("partner:new", { id, reference, venueName: input.venueName, city: input.city });
    return created(res, { ok: true, id, reference });
  })
);

legacyRouter.post(
  "/chat/threads",
  asyncHandler((req, res) => {
    const payload = {
      threadId: req.body.threadId,
      name: req.body.customer || req.body.name,
      phone: req.body.phone,
      city: req.body.city,
      message: req.body.message,
      channel: req.body.channel || "website-chat",
    };
    const result = appendCustomerMessage(payload);
    return created(res, { ok: true, threadId: result.threadId, reference: result.thread.reference });
  })
);

legacyRouter.post(
  "/chat/messages",
  asyncHandler((req, res) => {
    const result = appendCustomerMessage({
      threadId: req.body.threadId,
      message: req.body.text || req.body.message,
      name: req.body.name,
      phone: req.body.phone,
    });
    return created(res, { ok: true, threadId: result.threadId, message: result.message });
  })
);

legacyRouter.get(
  "/enquiries/:reference",
  asyncHandler((req, res) => {
    const row = sql.get("SELECT * FROM enquiries WHERE reference = ?", req.params.reference);
    if (!row) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Enquiry not found." } });
    }
    ok(res, enquiryRow(row));
  })
);

// Tiny helper endpoint so deployments can smoke-test URL/slug generation.
publicRouter.get(
  "/utils/slug",
  asyncHandler((req, res) => {
    const value = parse(z.object({ value: z.string().min(1).max(200) }))({ value: req.query.value });
    ok(res, { slug: slugify(value.value) });
  })
);
