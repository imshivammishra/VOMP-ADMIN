import { Router } from "express";
import { collections, nowIso, paginationMeta, uid } from "../db.js";
import { asyncHandler, HttpError, ok, parse, parsePagination, slugify } from "../lib/http.js";
import { like, groupedCounts } from "../lib/query.js";
import { partnerUpdateSchema } from "../lib/schemas.js";
import { partnerRow, venueRow } from "../lib/serializers.js";
import { actorName, logActivity } from "../lib/activity.js";
import { requireRole } from "../lib/auth.js";
import { broadcast } from "../lib/realtime.js";

export const partnersRouter = Router();

partnersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const filter = {};
    const q = String(req.query.q || "").trim();
    if (q) {
      filter.$or = ["venue_name", "contact_name", "email", "reference", "city"].map((field) => ({
        [field]: like(q),
      }));
    }
    if (req.query.status && req.query.status !== "all") filter.status = String(req.query.status);
    const [total, rows, statusCounts] = await Promise.all([
      collections.partners.countDocuments(filter),
      collections.partners.find(filter).sort({ created_at: -1 }).skip(offset).limit(limit).toArray(),
      groupedCounts("partners", "status"),
    ]);
    const counts = { all: 0, ...statusCounts };
    counts.all = Object.values(statusCounts).reduce((sum, value) => sum + value, 0);
    ok(res, rows.map(partnerRow), { ...paginationMeta(total, page, limit), counts });
  })
);

partnersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const row = await collections.partners.findOne({ id: req.params.id });
    if (!row) throw new HttpError(404, "NOT_FOUND", "Partner application not found.");
    ok(res, partnerRow(row));
  })
);

partnersRouter.patch(
  "/:id",
  requireRole("admin", "editor"),
  asyncHandler(async (req, res) => {
    const row = await collections.partners.findOne({ id: req.params.id });
    if (!row) throw new HttpError(404, "NOT_FOUND", "Partner application not found.");
    const input = parse(partnerUpdateSchema)(req.body);
    await collections.partners.updateOne(
      { id: row.id },
      {
        $set: {
          status: input.status || row.status,
          message: input.message ?? row.message,
          updated_at: nowIso(),
        },
      }
    );
    const partner = partnerRow(await collections.partners.findOne({ id: row.id }));
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const row = await collections.partners.findOne({ id: req.params.id });
    if (!row) throw new HttpError(404, "NOT_FOUND", "Partner application not found.");
    const now = nowIso();
    const id = uid("ven_");
    const base = slugify(`${row.venue_name}-${row.city}`) || `venue-${Date.now().toString(36)}`;
    let slug = base;
    let counter = 1;
    while (await collections.venues.findOne({ slug }, { projection: { id: 1 } })) {
      counter += 1;
      slug = `${base}-${counter}`;
    }
    await collections.venues.insertOne({
      id,
      slug,
      name: row.venue_name,
      city: row.city,
      city_slug: slugify(row.city),
      area: "",
      type: row.venue_type,
      setting: "Indoor + Outdoor",
      capacity_min: 0,
      capacity_max: 0,
      price_hint: "",
      image: "",
      image_alt: "",
      short_description: `Partner application ${row.reference}.`,
      description: row.message,
      amenities: [],
      event_types: [],
      featured: false,
      status: "draft",
      sort_order: 0,
      created_at: now,
      updated_at: now,
    });
    await collections.partners.updateOne(
      { id: row.id },
      { $set: { status: "verified", updated_at: now } }
    );
    const venue = venueRow(await collections.venues.findOne({ id }));
    await logActivity({
      actor: actorName(req),
      action: "partner.converted",
      entity: "venue",
      entityId: id,
      detail: `${row.venue_name} · draft venue created from ${row.reference}`,
    });
    broadcast("venue:changed", { venue });
    broadcast("partner:updated", {
      partner: partnerRow(await collections.partners.findOne({ id: row.id })),
    });
    ok(res, { venue }, undefined, 201);
  })
);

partnersRouter.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const row = await collections.partners.findOne({ id: req.params.id });
    if (!row) throw new HttpError(404, "NOT_FOUND", "Partner application not found.");
    await collections.partners.deleteOne({ id: row.id });
    await logActivity({
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
