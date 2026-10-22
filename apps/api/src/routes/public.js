import { Router } from "express";
import { z } from "zod";
import { collections, nowIso, uid, uniqueReference } from "../db.js";
import { asyncHandler, created, ok, parse, slugify } from "../lib/http.js";
import { like } from "../lib/query.js";
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
  asyncHandler(async (req, res) => {
    const { city, event, featured, limit } = req.query;
    const filter = { status: "published" };
    if (city) filter.city_slug = String(city).toLowerCase();
    if (event) filter.event_types = like(event);
    if (featured === "true") filter.featured = true;
    const max = Math.min(500, Math.max(1, Number(limit) || 500));
    const rows = await collections.venues
      .find(filter)
      .sort({ featured: -1, sort_order: 1, name: 1 })
      .limit(max)
      .toArray();
    cache(res, 120);
    ok(res, rows.map(venueRow));
  })
);

publicRouter.get(
  "/venues/:slug",
  asyncHandler(async (req, res) => {
    const row = await collections.venues.findOne({ slug: req.params.slug, status: "published" });
    if (!row) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Venue not found." } });
    }
    cache(res, 120);
    return ok(res, venueRow(row));
  })
);

publicRouter.get(
  "/cities",
  asyncHandler(async (_req, res) => {
    const rows = await collections.destinations
      .find({ status: "published" })
      .sort({ name: 1 })
      .toArray();
    cache(res, 300);
    ok(res, rows.map(destinationRow));
  })
);

publicRouter.get(
  "/cities/:slug",
  asyncHandler(async (req, res) => {
    const row = await collections.destinations.findOne({
      slug: req.params.slug,
      status: "published",
    });
    if (!row) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Destination not found." } });
    }
    cache(res, 300);
    return ok(res, destinationRow(row));
  })
);

publicRouter.get(
  "/blogs",
  asyncHandler(async (_req, res) => {
    const rows = await collections.posts
      .find({ status: "published" })
      .sort({ published_on: -1, created_at: -1 })
      .toArray();
    cache(res, 120);
    ok(res, rows.map(postRow));
  })
);

publicRouter.get(
  "/blogs/:slug",
  asyncHandler(async (req, res) => {
    const row = await collections.posts.findOne({ slug: req.params.slug, status: "published" });
    if (!row) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Journal entry not found." } });
    }
    cache(res, 120);
    return ok(res, postRow(row));
  })
);

publicRouter.get(
  "/settings",
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    cache(res, 300);
    ok(res, { general: settings.general, notifications: undefined, api: { apiUrl: settings.api.apiUrl } });
  })
);

publicRouter.get(
  "/content",
  asyncHandler(async (_req, res) => {
    const rows = await collections.content_blocks
      .find({ status: "published" })
      .sort({ sort_order: 1, created_at: 1 })
      .toArray();
    cache(res, 60);
    ok(res, rows.map(contentBlockRow));
  })
);

publicRouter.get(
  "/reviews",
  asyncHandler(async (req, res) => {
    const venueSlug = String(req.query.venue || "").trim();
    const filter = { status: "published" };
    if (venueSlug) filter.$or = [{ venue_slug: venueSlug }, { venue_slug: "" }];
    const rows = await collections.reviews
      .find(filter)
      .sort({ featured: -1, sort_order: 1, created_at: -1 })
      .toArray();
    cache(res, 60);
    ok(res, rows.map(reviewRow));
  })
);

publicRouter.post(
  "/enquiries",
  asyncHandler(async (req, res) => {
    const result = await submitEnquiry(req.body, req);
    return created(res, { id: result.id, reference: result.reference });
  })
);

publicRouter.post(
  "/partners",
  asyncHandler(async (req, res) => {
    const input = parse(partnerApplicationSchema)(req.body);
    const now = nowIso();
    const id = uid("prt_");
    const reference = await uniqueReference("partners", "PRT");
    await collections.partners.insertOne({
      id,
      reference,
      venue_name: input.venueName,
      contact_name: input.contactName,
      email: input.email,
      phone: input.phone,
      city: input.city,
      venue_type: input.venueType,
      rooms: input.rooms,
      website: input.website,
      message: input.message,
      status: "new",
      created_at: now,
      updated_at: now,
    });
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const result = await appendCustomerMessage(req.body);
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
  asyncHandler(async (req, res) => {
    const result = await submitEnquiry(req.body, req);
    return created(res, { ok: true, id: result.id, reference: result.reference });
  })
);

legacyRouter.post(
  "/partners",
  asyncHandler(async (req, res) => {
    const input = parse(partnerApplicationSchema)(req.body);
    const now = nowIso();
    const id = uid("prt_");
    const reference = await uniqueReference("partners", "PRT");
    await collections.partners.insertOne({
      id,
      reference,
      venue_name: input.venueName,
      contact_name: input.contactName,
      email: input.email,
      phone: input.phone,
      city: input.city,
      venue_type: input.venueType,
      rooms: input.rooms,
      website: input.website,
      message: input.message,
      status: "new",
      created_at: now,
      updated_at: now,
    });
    broadcast("partner:new", { id, reference, venueName: input.venueName, city: input.city });
    return created(res, { ok: true, id, reference });
  })
);

legacyRouter.post(
  "/chat/threads",
  asyncHandler(async (req, res) => {
    const payload = {
      threadId: req.body.threadId,
      name: req.body.customer || req.body.name,
      phone: req.body.phone,
      city: req.body.city,
      message: req.body.message,
      channel: req.body.channel || "website-chat",
    };
    const result = await appendCustomerMessage(payload);
    return created(res, { ok: true, threadId: result.threadId, reference: result.thread.reference });
  })
);

legacyRouter.post(
  "/chat/messages",
  asyncHandler(async (req, res) => {
    const result = await appendCustomerMessage({
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
  asyncHandler(async (req, res) => {
    const row = await collections.enquiries.findOne({ reference: req.params.reference });
    if (!row) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Enquiry not found." } });
    }
    return ok(res, enquiryRow(row));
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
