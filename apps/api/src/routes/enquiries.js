import { Router } from "express";
import { collections, nowIso, paginationMeta, parseJson, uid } from "../db.js";
import { asyncHandler, HttpError, ok, parse, parsePagination, toCsv } from "../lib/http.js";
import { like, groupedCounts } from "../lib/query.js";
import { bulkEnquirySchema, enquiryUpdateSchema } from "../lib/schemas.js";
import { enquiryRow } from "../lib/serializers.js";
import { actorName, logActivity } from "../lib/activity.js";
import { broadcast } from "../lib/realtime.js";

export const enquiriesRouter = Router();

const STATUSES = ["new", "contacted", "qualified", "won", "lost", "closed"];
const SORTS = {
  newest: { created_at: -1 },
  oldest: { created_at: 1 },
  priority: { priority_rank: 1, created_at: -1 },
  updated: { updated_at: -1 },
};

function buildFilters(query, { includeStatus = true } = {}) {
  const filter = {};
  const q = String(query.q || "").trim();
  if (q) {
    filter.$or = ["name", "phone", "email", "reference", "city", "message"].map((field) => ({
      [field]: like(q),
    }));
  }
  if (includeStatus && query.status && query.status !== "all") filter.status = String(query.status);
  if (query.source && query.source !== "all") filter.source = String(query.source);
  if (query.city && query.city !== "all") filter.city = String(query.city);
  if (query.priority && query.priority !== "all") filter.priority = String(query.priority);
  if (query.assignee && query.assignee !== "all") filter.assignee = String(query.assignee);
  if (query.from || query.to) {
    filter.created_at = {};
    if (query.from) filter.created_at.$gte = `${String(query.from)}T00:00:00.000Z`;
    if (query.to) filter.created_at.$lte = `${String(query.to)}T23:59:59.999Z`;
  }
  return filter;
}

enquiriesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const filter = buildFilters(req.query);
    const sort = SORTS[String(req.query.sort || "newest")] || SORTS.newest;
    const [total, rows, statusCounts] = await Promise.all([
      collections.enquiries.countDocuments(filter),
      sort.priority_rank
        ? collections.enquiries
            .aggregate([
              { $match: filter },
              {
                $addFields: {
                  priority_rank: {
                    $switch: {
                      branches: [
                        { case: { $eq: ["$priority", "urgent"] }, then: 0 },
                        { case: { $eq: ["$priority", "high"] }, then: 1 },
                        { case: { $eq: ["$priority", "normal"] }, then: 2 },
                      ],
                      default: 3,
                    },
                  },
                },
              },
              { $sort: sort },
              { $skip: offset },
              { $limit: limit },
            ])
            .toArray()
        : collections.enquiries.find(filter).sort(sort).skip(offset).limit(limit).toArray(),
      groupedCounts("enquiries", "status", buildFilters(req.query, { includeStatus: false })),
    ]);
    const counts = {};
    for (const status of STATUSES) counts[status] = statusCounts[status] || 0;
    counts.all = Object.values(counts).reduce((sum, value) => sum + value, 0);
    ok(res, rows.map(enquiryRow), { ...paginationMeta(total, page, limit), counts });
  })
);

enquiriesRouter.get(
  "/export.csv",
  asyncHandler(async (req, res) => {
    const filter = buildFilters(req.query);
    const rows = (await collections.enquiries.find(filter).sort({ created_at: -1 }).toArray()).map(
      enquiryRow
    );
    const csv = toCsv(rows, [
      { label: "Reference", value: (row) => row.reference },
      { label: "Name", value: (row) => row.name },
      { label: "Phone", value: (row) => row.phone },
      { label: "Email", value: (row) => row.email },
      { label: "City", value: (row) => row.city },
      { label: "Event type", value: (row) => row.eventType },
      { label: "Event date", value: (row) => row.eventDate },
      { label: "Guests", value: (row) => row.guestCount },
      { label: "Source", value: (row) => row.source },
      { label: "Status", value: (row) => row.status },
      { label: "Priority", value: (row) => row.priority },
      { label: "Assignee", value: (row) => row.assignee },
      { label: "Message", value: (row) => row.message },
      { label: "Created", value: (row) => row.createdAt },
    ]);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="vomp-enquiries-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(csv);
  })
);

enquiriesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const row = await collections.enquiries.findOne({ id: req.params.id });
    if (!row) throw new HttpError(404, "NOT_FOUND", "Enquiry not found.");
    ok(res, enquiryRow(row));
  })
);

enquiriesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = parse(enquiryUpdateSchema)(req.body);
    const row = await collections.enquiries.findOne({ id: req.params.id });
    if (!row) throw new HttpError(404, "NOT_FOUND", "Enquiry not found.");

    const updates = {};
    const now = nowIso();
    let firstResponseAt = row.first_response_at;

    if (input.status && input.status !== row.status) {
      updates.status = input.status;
      if (!firstResponseAt) firstResponseAt = now;
    }
    if (input.priority) updates.priority = input.priority;
    if (input.assignee !== undefined) updates.assignee = input.assignee;
    if (input.tags) updates.tags = input.tags;
    if (input.note) {
      const notes = parseJson(row.notes, []);
      notes.unshift({
        id: uid("note_"),
        text: input.note,
        author: actorName(req),
        at: now,
      });
      updates.notes = notes.slice(0, 200);
      if (!firstResponseAt) firstResponseAt = now;
    }
    if (firstResponseAt && firstResponseAt !== row.first_response_at) {
      updates.first_response_at = firstResponseAt;
    }
    updates.updated_at = now;

    await collections.enquiries.updateOne({ id: row.id }, { $set: updates });
    const updated = enquiryRow(await collections.enquiries.findOne({ id: row.id }));

    await logActivity({
      actor: actorName(req),
      action: input.note ? "enquiry.note" : "enquiry.updated",
      entity: "enquiry",
      entityId: row.id,
      detail: input.note
        ? `${row.reference} · note added`
        : `${row.reference} · ${Object.keys(input).join(", ")} updated`,
    });
    broadcast("enquiry:updated", { enquiry: updated });
    ok(res, updated);
  })
);

enquiriesRouter.post(
  "/bulk",
  asyncHandler(async (req, res) => {
    const input = parse(bulkEnquirySchema)(req.body);
    const now = nowIso();
    let changed = 0;

    if (input.action === "delete") {
      const result = await collections.enquiries.deleteMany({ id: { $in: input.ids } });
      changed = result.deletedCount;
    } else {
      const column =
        input.action === "status" ? "status" : input.action === "priority" ? "priority" : "assignee";
      const value = input.value || "";
      if (input.action === "status" && !STATUSES.includes(value)) {
        throw new HttpError(422, "VALIDATION_ERROR", "Unknown status value.");
      }
      if (input.action === "priority" && !["low", "normal", "high", "urgent"].includes(value)) {
        throw new HttpError(422, "VALIDATION_ERROR", "Unknown priority value.");
      }
      const result = await collections.enquiries.updateMany(
        { id: { $in: input.ids } },
        { $set: { [column]: value, updated_at: now } }
      );
      changed = result.modifiedCount;
    }

    await logActivity({
      actor: actorName(req),
      action: `enquiry.bulk_${input.action}`,
      entity: "enquiry",
      entityId: null,
      detail: `${changed} enquiries · ${input.value || "removed"}`,
    });
    broadcast("enquiry:bulk", { action: input.action, ids: input.ids });
    ok(res, { changed });
  })
);

enquiriesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const row = await collections.enquiries.findOne({ id: req.params.id });
    if (!row) throw new HttpError(404, "NOT_FOUND", "Enquiry not found.");
    await collections.enquiries.deleteOne({ id: req.params.id });
    await logActivity({
      actor: actorName(req),
      action: "enquiry.deleted",
      entity: "enquiry",
      entityId: req.params.id,
      detail: `${row.reference} · ${row.name}`,
    });
    broadcast("enquiry:deleted", { id: req.params.id });
    ok(res, { ok: true });
  })
);
