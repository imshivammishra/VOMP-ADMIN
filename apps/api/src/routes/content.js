import { Router } from "express";
import { collections, nowIso, paginationMeta, uid } from "../db.js";
import { asyncHandler, HttpError, ok, parse, parsePagination, slugify } from "../lib/http.js";
import { like, groupedCounts } from "../lib/query.js";
import { destinationSchema, postSchema, venueSchema } from "../lib/schemas.js";
import { destinationRow, postRow, venueRow } from "../lib/serializers.js";
import { actorName, logActivity } from "../lib/activity.js";
import { requireRole } from "../lib/auth.js";
import { broadcast } from "../lib/realtime.js";

export const venuesRouter = Router();
export const destinationsRouter = Router();
export const postsRouter = Router();

async function uniqueSlug(table, desired, excludeId = null) {
  const base = slugify(desired) || `item-${Date.now().toString(36)}`;
  let candidate = base;
  let counter = 1;
  while (true) {
    const row = await collections[table].findOne({ slug: candidate }, { projection: { id: 1 } });
    if (!row || row.id === excludeId) return candidate;
    counter += 1;
    candidate = `${base}-${counter}`;
  }
}

async function listQuery(table, query, mapper) {
  const { page, limit, offset } = parsePagination(query);
  const filter = {};
  const q = String(query.q || "").trim();
  if (q) {
    const columns =
      table === "posts"
        ? ["title", "slug", "category", "author", "excerpt"]
        : table === "destinations"
          ? ["name", "slug", "tagline", "description"]
          : ["name", "slug", "city", "area", "type"];
    filter.$or = columns.map((column) => ({ [column]: like(q) }));
  }
  if (query.status && query.status !== "all") filter.status = String(query.status);
  if (query.city && table === "venues") filter.city_slug = String(query.city);
  if (query.featured === "true" && table === "venues") filter.featured = true;

  const order =
    table === "posts"
      ? { published_on: -1, created_at: -1 }
      : table === "venues"
        ? { sort_order: 1, name: 1 }
        : { name: 1 };

  const [total, rows, statusCounts] = await Promise.all([
    collections[table].countDocuments(filter),
    collections[table].find(filter).sort(order).skip(offset).limit(limit).toArray(),
    groupedCounts(table, "status"),
  ]);
  const counts = { all: total, ...statusCounts };
  return { rows: rows.map(mapper), meta: { ...paginationMeta(total, page, limit), counts } };
}

// ── Venues ────────────────────────────────────────────────────────────────
venuesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows, meta } = await listQuery("venues", req.query, venueRow);
    ok(res, rows, meta);
  })
);

venuesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const row = await collections.venues.findOne({
      $or: [{ id: req.params.id }, { slug: req.params.id }],
    });
    if (!row) throw new HttpError(404, "NOT_FOUND", "Venue not found.");
    ok(res, venueRow(row));
  })
);

venuesRouter.post(
  "/",
  requireRole("admin", "editor"),
  asyncHandler(async (req, res) => {
    const input = parse(venueSchema)(req.body);
    const now = nowIso();
    const id = uid("ven_");
    const slug = await uniqueSlug("venues", input.slug || input.name);
    await collections.venues.insertOne({
      id,
      slug,
      name: input.name,
      city: input.city,
      city_slug: input.citySlug || slugify(input.city),
      area: input.area,
      type: input.type,
      setting: input.setting,
      capacity_min: input.capacityMin,
      capacity_max: input.capacityMax,
      price_hint: input.priceHint,
      image: input.image,
      image_alt: input.imageAlt,
      short_description: input.shortDescription,
      description: input.description,
      amenities: Array.isArray(input.amenities)
        ? input.amenities
        : String(input.amenities).split(",").map((s) => s.trim()).filter(Boolean),
      event_types: Array.isArray(input.eventTypes)
        ? input.eventTypes
        : String(input.eventTypes).split(",").map((s) => s.trim()).filter(Boolean),
      featured: Boolean(input.featured),
      status: input.status,
      sort_order: 0,
      created_at: now,
      updated_at: now,
    });
    const venue = venueRow(await collections.venues.findOne({ id }));
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const existing = await collections.venues.findOne({ id: req.params.id });
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Venue not found.");
    const input = parse(venueSchema)(req.body);
    const now = nowIso();
    const slug = await uniqueSlug("venues", input.slug || existing.slug, existing.id);
    const amenities = Array.isArray(input.amenities)
      ? input.amenities
      : String(input.amenities).split(",").map((s) => s.trim()).filter(Boolean);
    const eventTypes = Array.isArray(input.eventTypes)
      ? input.eventTypes
      : String(input.eventTypes).split(",").map((s) => s.trim()).filter(Boolean);
    await collections.venues.updateOne(
      { id: existing.id },
      {
        $set: {
          slug,
          name: input.name,
          city: input.city,
          city_slug: input.citySlug || slugify(input.city),
          area: input.area,
          type: input.type,
          setting: input.setting,
          capacity_min: input.capacityMin,
          capacity_max: input.capacityMax,
          price_hint: input.priceHint,
          image: input.image,
          image_alt: input.imageAlt,
          short_description: input.shortDescription,
          description: input.description,
          amenities,
          event_types: eventTypes,
          featured: Boolean(input.featured),
          status: input.status,
          updated_at: now,
        },
      }
    );
    const venue = venueRow(await collections.venues.findOne({ id: existing.id }));
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const row = await collections.venues.findOne({ id: req.params.id });
    if (!row) throw new HttpError(404, "NOT_FOUND", "Venue not found.");
    await collections.venues.deleteOne({ id: row.id });
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const { rows, meta } = await listQuery("destinations", req.query, destinationRow);
    ok(res, rows, meta);
  })
);

destinationsRouter.post(
  "/",
  requireRole("admin", "editor"),
  asyncHandler(async (req, res) => {
    const input = parse(destinationSchema)(req.body);
    const id = uid("dst_");
    const slug = await uniqueSlug("destinations", input.slug || input.name);
    const now = nowIso();
    const popularTypes = Array.isArray(input.popularTypes)
      ? input.popularTypes
      : String(input.popularTypes).split(",").map((s) => s.trim()).filter(Boolean);
    await collections.destinations.insertOne({
      id,
      slug,
      name: input.name,
      tagline: input.tagline,
      description: input.description,
      image: input.image,
      image_alt: input.imageAlt,
      venue_count_label: input.venueCountLabel,
      popular_types: popularTypes,
      status: input.status,
      created_at: now,
      updated_at: now,
    });
    const destination = destinationRow(await collections.destinations.findOne({ id }));
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const existing = await collections.destinations.findOne({ id: req.params.id });
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Destination not found.");
    const input = parse(destinationSchema)(req.body);
    const slug = await uniqueSlug("destinations", input.slug || existing.slug, existing.id);
    const popularTypes = Array.isArray(input.popularTypes)
      ? input.popularTypes
      : String(input.popularTypes).split(",").map((s) => s.trim()).filter(Boolean);
    await collections.destinations.updateOne(
      { id: existing.id },
      {
        $set: {
          slug,
          name: input.name,
          tagline: input.tagline,
          description: input.description,
          image: input.image,
          image_alt: input.imageAlt,
          venue_count_label: input.venueCountLabel,
          popular_types: popularTypes,
          status: input.status,
          updated_at: nowIso(),
        },
      }
    );
    const destination = destinationRow(await collections.destinations.findOne({ id: existing.id }));
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const row = await collections.destinations.findOne({ id: req.params.id });
    if (!row) throw new HttpError(404, "NOT_FOUND", "Destination not found.");
    await collections.destinations.deleteOne({ id: row.id });
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const { rows, meta } = await listQuery("posts", req.query, postRow);
    ok(res, rows, meta);
  })
);

postsRouter.post(
  "/",
  requireRole("admin", "editor"),
  asyncHandler(async (req, res) => {
    const input = parse(postSchema)(req.body);
    const id = uid("pst_");
    const slug = await uniqueSlug("posts", input.slug || input.title);
    const now = nowIso();
    const body = Array.isArray(input.body)
      ? input.body
      : String(input.body).split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    await collections.posts.insertOne({
      id,
      slug,
      title: input.title,
      excerpt: input.excerpt,
      category: input.category,
      author: input.author,
      published_on: input.publishedOn || now.slice(0, 10),
      reading_minutes: input.readingMinutes,
      image: input.image,
      image_alt: input.imageAlt,
      body,
      status: input.status,
      created_at: now,
      updated_at: now,
    });
    const post = postRow(await collections.posts.findOne({ id }));
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const existing = await collections.posts.findOne({ id: req.params.id });
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Journal entry not found.");
    const input = parse(postSchema)(req.body);
    const slug = await uniqueSlug("posts", input.slug || existing.slug, existing.id);
    const body = Array.isArray(input.body)
      ? input.body
      : String(input.body).split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    await collections.posts.updateOne(
      { id: existing.id },
      {
        $set: {
          slug,
          title: input.title,
          excerpt: input.excerpt,
          category: input.category,
          author: input.author,
          published_on: input.publishedOn || existing.published_on,
          reading_minutes: input.readingMinutes,
          image: input.image,
          image_alt: input.imageAlt,
          body,
          status: input.status,
          updated_at: nowIso(),
        },
      }
    );
    const post = postRow(await collections.posts.findOne({ id: existing.id }));
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const row = await collections.posts.findOne({ id: req.params.id });
    if (!row) throw new HttpError(404, "NOT_FOUND", "Journal entry not found.");
    await collections.posts.deleteOne({ id: row.id });
    await logActivity({
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
