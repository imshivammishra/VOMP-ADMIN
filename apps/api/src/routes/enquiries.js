import { Router } from "express";
import { nowIso, paginationMeta, parseJson, sql, uid } from "../db.js";
import { asyncHandler, HttpError, ok, parse, parsePagination, toCsv } from "../lib/http.js";
import { bulkEnquirySchema, enquiryUpdateSchema } from "../lib/schemas.js";
import { enquiryRow } from "../lib/serializers.js";
import { actorName, logActivity } from "../lib/activity.js";
import { broadcast } from "../lib/realtime.js";

export const enquiriesRouter = Router();

const STATUSES = ["new", "contacted", "qualified", "won", "lost", "closed"];
const SORTS = {
  newest: "created_at DESC",
  oldest: "created_at ASC",
  priority: "CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, created_at DESC",
  updated: "updated_at DESC",
};

function buildFilters(query, { includeStatus = true } = {}) {
  const where = [];
  const params = [];
  const q = String(query.q || "").trim();
  if (q) {
    where.push("(name LIKE ? OR phone LIKE ? OR email LIKE ? OR reference LIKE ? OR city LIKE ? OR message LIKE ?)");
    const term = `%${q}%`;
    params.push(term, term, term, term, term, term);
  }
  if (includeStatus && query.status && query.status !== "all") {
    where.push("status = ?");
    params.push(String(query.status));
  }
  if (query.source && query.source !== "all") {
    where.push("source = ?");
    params.push(String(query.source));
  }
  if (query.city && query.city !== "all") {
    where.push("city = ?");
    params.push(String(query.city));
  }
  if (query.priority && query.priority !== "all") {
    where.push("priority = ?");
    params.push(String(query.priority));
  }
  if (query.assignee && query.assignee !== "all") {
    where.push("assignee = ?");
    params.push(String(query.assignee));
  }
  if (query.from) {
    where.push("created_at >= ?");
    params.push(`${String(query.from)}T00:00:00.000Z`);
  }
  if (query.to) {
    where.push("created_at <= ?");
    params.push(`${String(query.to)}T23:59:59.999Z`);
  }
  return { clause: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

enquiriesRouter.get(
  "/",
  asyncHandler((req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const { clause, params } = buildFilters(req.query);
    const order = SORTS[String(req.query.sort || "newest")] || SORTS.newest;
    const total = sql.get(`SELECT COUNT(*) AS count FROM enquiries ${clause}`, ...params).count;
    const rows = sql.all(
      `SELECT * FROM enquiries ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset
    );
    const counts = {};
    for (const status of STATUSES) counts[status] = 0;
    const countFilters = buildFilters(req.query, { includeStatus: false });
    for (const row of sql.all(
      `SELECT status, COUNT(*) AS count FROM enquiries ${countFilters.clause} GROUP BY status`,
      ...countFilters.params
    )) {
      counts[row.status] = row.count;
    }
    counts.all = Object.values(counts).reduce((sum, value) => sum + value, 0);
    ok(res, rows.map(enquiryRow), { ...paginationMeta(total, page, limit), counts });
  })
);

enquiriesRouter.get(
  "/export.csv",
  asyncHandler((req, res) => {
    const { clause, params } = buildFilters(req.query);
    const rows = sql.all(`SELECT * FROM enquiries ${clause} ORDER BY created_at DESC`, ...params).map(
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
  asyncHandler((req, res) => {
    const row = sql.get("SELECT * FROM enquiries WHERE id = ?", req.params.id);
    if (!row) throw new HttpError(404, "NOT_FOUND", "Enquiry not found.");
    ok(res, enquiryRow(row));
  })
);

enquiriesRouter.patch(
  "/:id",
  asyncHandler((req, res) => {
    const input = parse(enquiryUpdateSchema)(req.body);
    const row = sql.get("SELECT * FROM enquiries WHERE id = ?", req.params.id);
    if (!row) throw new HttpError(404, "NOT_FOUND", "Enquiry not found.");

    const updates = [];
    const params = [];
    const now = nowIso();
    let firstResponseAt = row.first_response_at;

    if (input.status && input.status !== row.status) {
      updates.push("status = ?");
      params.push(input.status);
      if (!firstResponseAt) firstResponseAt = now;
    }
    if (input.priority) {
      updates.push("priority = ?");
      params.push(input.priority);
    }
    if (input.assignee !== undefined) {
      updates.push("assignee = ?");
      params.push(input.assignee);
    }
    if (input.tags) {
      updates.push("tags = ?");
      params.push(JSON.stringify(input.tags));
    }
    if (input.note) {
      const notes = parseJson(row.notes, []);
      notes.unshift({
        id: uid("note_"),
        text: input.note,
        author: actorName(req),
        at: now,
      });
      updates.push("notes = ?");
      params.push(JSON.stringify(notes.slice(0, 200)));
      if (!firstResponseAt) firstResponseAt = now;
    }
    if (firstResponseAt && firstResponseAt !== row.first_response_at) {
      updates.push("first_response_at = ?");
      params.push(firstResponseAt);
    }
    updates.push("updated_at = ?");
    params.push(now);
    params.push(row.id);

    sql.run(`UPDATE enquiries SET ${updates.join(", ")} WHERE id = ?`, ...params);
    const updated = enquiryRow(sql.get("SELECT * FROM enquiries WHERE id = ?", row.id));

    logActivity({
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
  asyncHandler((req, res) => {
    const input = parse(bulkEnquirySchema)(req.body);
    const now = nowIso();
    let changed = 0;

    if (input.action === "delete") {
      const placeholders = input.ids.map(() => "?").join(",");
      const result = sql.run(`DELETE FROM enquiries WHERE id IN (${placeholders})`, ...input.ids);
      changed = result.changes;
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
      for (const id of input.ids) {
        const result = sql.run(
          `UPDATE enquiries SET ${column} = ?, updated_at = ? WHERE id = ?`,
          value,
          now,
          id
        );
        changed += result.changes;
      }
    }

    logActivity({
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
  asyncHandler((req, res) => {
    const row = sql.get("SELECT * FROM enquiries WHERE id = ?", req.params.id);
    if (!row) throw new HttpError(404, "NOT_FOUND", "Enquiry not found.");
    sql.run("DELETE FROM enquiries WHERE id = ?", req.params.id);
    logActivity({
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
