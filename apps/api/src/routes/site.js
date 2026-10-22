import { Router } from "express";
import { collections, nowIso, paginationMeta, uid } from "../db.js";
import { asyncHandler, HttpError, ok, parse, parsePagination } from "../lib/http.js";
import { like } from "../lib/query.js";
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

async function nextSortOrder(collection, section) {
  const row = await collections[collection].findOne(
    { section },
    { sort: { sort_order: -1 }, projection: { sort_order: 1 } }
  );
  return Number(row?.sort_order || 0) + 10;
}

async function contentCounts() {
  const rows = await collections.content_blocks
    .aggregate([{ $group: { _id: { section: "$section", status: "$status" }, count: { $sum: 1 } } }])
    .toArray();
  const counts = {};
  for (const row of rows) {
    const section = row._id.section;
    const status = row._id.status;
    counts[section] = (counts[section] || 0) + row.count;
    counts[`${section}:${status}`] = row.count;
  }
  return counts;
}

async function reviewCounts() {
  const rows = await collections.reviews
    .aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
    .toArray();
  const counts = {};
  for (const row of rows) counts[row._id] = row.count;
  counts.all = (counts.published || 0) + (counts.draft || 0);
  return counts;
}

// ── Website content blocks ─────────────────────────────────────────────────
contentBlocksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query, { limit: 500, maxLimit: 500 });
    const filter = {};
    const section = String(req.query.section || "").trim();
    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || "").trim();

    if (section && section !== "all") filter.section = section;
    if (status && status !== "all") filter.status = status;
    if (q) {
      filter.$or = ["title", "subtitle", "body", "block_key"].map((field) => ({ [field]: like(q) }));
    }

    const [total, blockRows, counts] = await Promise.all([
      collections.content_blocks.countDocuments(filter),
      collections.content_blocks
        .aggregate([
          { $match: filter },
          {
            $addFields: {
              section_rank: {
                $switch: {
                  branches: SECTION_ORDER.map((value, index) => ({
                    case: { $eq: ["$section", value] },
                    then: index,
                  })),
                  default: 99,
                },
              },
            },
          },
          { $sort: { section_rank: 1, sort_order: 1, created_at: 1 } },
          { $skip: offset },
          { $limit: limit },
        ])
        .toArray(),
      contentCounts(),
    ]);
    ok(res, blockRows.map(contentBlockRow), {
      ...paginationMeta(total, page, limit),
      counts,
    });
  })
);

contentBlocksRouter.post(
  "/reorder",
  requireRole("admin", "editor"),
  asyncHandler(async (req, res) => {
    const input = parse(contentReorderSchema)(req.body);
    const now = nowIso();
    await collections.content_blocks.bulkWrite(
      input.ids.map((id, index) => ({
        updateOne: {
          filter: { id },
          update: { $set: { sort_order: index * 10, updated_at: now } },
        },
      })),
      { ordered: false }
    );
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const input = parse(contentBlockSchema)(req.body);
    const now = nowIso();
    const id = uid("blk_");
    const sortOrder =
      Number(input.sortOrder) > 0
        ? Number(input.sortOrder)
        : await nextSortOrder("content_blocks", input.section);
    await collections.content_blocks.insertOne({
      id,
      section: input.section,
      block_key: input.blockKey,
      title: input.title,
      subtitle: input.subtitle,
      body: input.body,
      image: input.image,
      image_alt: input.imageAlt,
      link_label: input.linkLabel,
      link_href: input.linkHref,
      icon: input.icon,
      meta: input.meta || {},
      sort_order: sortOrder,
      status: input.status,
      created_at: now,
      updated_at: now,
    });
    const block = contentBlockRow(await collections.content_blocks.findOne({ id }));
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const existing = await collections.content_blocks.findOne({ id: req.params.id });
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Content block not found.");
    const input = parse(contentBlockSchema)(req.body);
    const now = nowIso();
    const sortOrder = Number(input.sortOrder) > 0 ? Number(input.sortOrder) : existing.sort_order;
    await collections.content_blocks.updateOne(
      { id: existing.id },
      {
        $set: {
          section: input.section,
          block_key: input.blockKey,
          title: input.title,
          subtitle: input.subtitle,
          body: input.body,
          image: input.image,
          image_alt: input.imageAlt,
          link_label: input.linkLabel,
          link_href: input.linkHref,
          icon: input.icon,
          meta: input.meta || {},
          sort_order: sortOrder,
          status: input.status,
          updated_at: now,
        },
      }
    );
    const block = contentBlockRow(await collections.content_blocks.findOne({ id: existing.id }));
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const existing = await collections.content_blocks.findOne({ id: req.params.id });
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Content block not found.");
    await collections.content_blocks.deleteOne({ id: existing.id });
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query, { limit: 100, maxLimit: 500 });
    const filter = {};
    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || "").trim();
    if (status && status !== "all") filter.status = status;
    if (q) {
      filter.$or = ["name", "context", "quote"].map((field) => ({ [field]: like(q) }));
    }
    const [total, rows, counts] = await Promise.all([
      collections.reviews.countDocuments(filter),
      collections.reviews
        .find(filter)
        .sort({ featured: -1, sort_order: 1, created_at: -1 })
        .skip(offset)
        .limit(limit)
        .toArray(),
      reviewCounts(),
    ]);
    ok(res, rows.map(reviewRow), {
      ...paginationMeta(total, page, limit),
      counts,
    });
  })
);

reviewsRouter.post(
  "/reorder",
  requireRole("admin", "editor"),
  asyncHandler(async (req, res) => {
    const input = parse(contentReorderSchema)(req.body);
    const now = nowIso();
    await collections.reviews.bulkWrite(
      input.ids.map((id, index) => ({
        updateOne: {
          filter: { id },
          update: { $set: { sort_order: index * 10, updated_at: now } },
        },
      })),
      { ordered: false }
    );
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const input = parse(reviewSchema)(req.body);
    const now = nowIso();
    const id = uid("rev_");
    const featured = input.featured === false || input.featured === 0 || input.featured === "false" ? false : true;
    const sortOrder =
      Number(input.sortOrder) > 0
        ? Number(input.sortOrder)
        : (await nextSortOrder("reviews")) + 10;
    await collections.reviews.insertOne({
      id,
      name: input.name,
      context: input.context,
      quote: input.quote,
      rating: input.rating,
      image: input.image,
      venue_slug: input.venueSlug,
      featured,
      sort_order: sortOrder,
      status: input.status,
      created_at: now,
      updated_at: now,
    });
    const review = reviewRow(await collections.reviews.findOne({ id }));
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const existing = await collections.reviews.findOne({ id: req.params.id });
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Review not found.");
    const input = parse(reviewSchema)(req.body);
    const now = nowIso();
    const featured = input.featured === false || input.featured === 0 || input.featured === "false" ? false : true;
    const sortOrder = Number(input.sortOrder) > 0 ? Number(input.sortOrder) : existing.sort_order;
    await collections.reviews.updateOne(
      { id: existing.id },
      {
        $set: {
          name: input.name,
          context: input.context,
          quote: input.quote,
          rating: input.rating,
          image: input.image,
          venue_slug: input.venueSlug,
          featured,
          sort_order: sortOrder,
          status: input.status,
          updated_at: now,
        },
      }
    );
    const review = reviewRow(await collections.reviews.findOne({ id: existing.id }));
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const existing = await collections.reviews.findOne({ id: req.params.id });
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Review not found.");
    await collections.reviews.deleteOne({ id: existing.id });
    await logActivity({
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
