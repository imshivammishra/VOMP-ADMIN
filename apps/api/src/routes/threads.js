import { Router } from "express";
import { z } from "zod";
import { nowIso, paginationMeta, sql, uid, uniqueReference } from "../db.js";
import { asyncHandler, HttpError, ok, parse, parsePagination } from "../lib/http.js";
import { adminMessageSchema, threadUpdateSchema } from "../lib/schemas.js";
import { messageRow, threadRow } from "../lib/serializers.js";
import { actorName, logActivity } from "../lib/activity.js";
import { appendAdminMessage } from "../services/leads.js";
import { broadcast } from "../lib/realtime.js";

export const threadsRouter = Router();

const STATUSES = ["open", "waiting", "resolved"];
const threadListSelect = `SELECT t.*,
  (SELECT body FROM messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
  FROM threads t`;

threadsRouter.get(
  "/",
  asyncHandler((req, res) => {
    const { page, limit, offset } = parsePagination(req.query, { limit: 30 });
    const where = [];
    const params = [];
    const q = String(req.query.q || "").trim();
    if (q) {
      where.push("(t.customer_name LIKE ? OR t.phone LIKE ? OR t.reference LIKE ? OR t.city LIKE ? OR t.email LIKE ?)");
      const term = `%${q}%`;
      params.push(term, term, term, term, term);
    }
    if (req.query.status && req.query.status !== "all") {
      where.push("t.status = ?");
      params.push(String(req.query.status));
    }
    if (req.query.assignee && req.query.assignee !== "all") {
      where.push("t.assignee = ?");
      params.push(String(req.query.assignee));
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = sql.get(`SELECT COUNT(*) AS count FROM threads t ${clause}`, ...params).count;
    const rows = sql.all(
      `${threadListSelect} ${clause} ORDER BY t.last_message_at DESC LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset
    );
    const counts = { all: 0 };
    for (const status of STATUSES) counts[status] = 0;
    for (const row of sql.all("SELECT status, COUNT(*) AS count FROM threads GROUP BY status")) {
      counts[row.status] = row.count;
      counts.all += row.count;
    }
    const unread = sql.get("SELECT COALESCE(SUM(unread_admin), 0) AS count FROM threads").count;
    ok(res, rows.map(threadRow), { ...paginationMeta(total, page, limit), counts, unread });
  })
);

threadsRouter.get(
  "/:id",
  asyncHandler((req, res) => {
    const thread = sql.get("SELECT * FROM threads WHERE id = ?", req.params.id);
    if (!thread) throw new HttpError(404, "NOT_FOUND", "Conversation not found.");
    const messages = sql
      .all("SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC", thread.id)
      .map(messageRow);
    const enquiry = sql.get(
      "SELECT id, reference, status FROM enquiries WHERE phone = ? ORDER BY created_at DESC LIMIT 1",
      thread.phone
    );
    ok(res, {
      thread: threadRow({ ...thread, last_message: messages.at(-1)?.body || "" }),
      messages,
      linkedEnquiry: enquiry || null,
    });
  })
);

threadsRouter.patch(
  "/:id",
  asyncHandler((req, res) => {
    const input = parse(threadUpdateSchema)(req.body);
    const thread = sql.get("SELECT * FROM threads WHERE id = ?", req.params.id);
    if (!thread) throw new HttpError(404, "NOT_FOUND", "Conversation not found.");
    const now = nowIso();
    const updates = [];
    const params = [];
    if (input.status) {
      updates.push("status = ?");
      params.push(input.status);
    }
    if (input.assignee !== undefined) {
      updates.push("assignee = ?");
      params.push(input.assignee);
    }
    if (input.unreadAdmin !== undefined) {
      updates.push("unread_admin = ?");
      params.push(input.unreadAdmin);
      if (input.unreadAdmin === 0) {
        sql.run(
          "UPDATE messages SET read_at = ? WHERE thread_id = ? AND sender = 'customer' AND read_at IS NULL",
          now,
          thread.id
        );
      }
    }
    updates.push("updated_at = ?");
    params.push(now);
    params.push(thread.id);
    sql.run(`UPDATE threads SET ${updates.join(", ")} WHERE id = ?`, ...params);

    const updated = threadRow(sql.get("SELECT * FROM threads WHERE id = ?", thread.id));
    logActivity({
      actor: actorName(req),
      action: "thread.updated",
      entity: "thread",
      entityId: thread.id,
      detail: `${thread.reference} · ${Object.keys(input).join(", ")} updated`,
    });
    broadcast("thread:updated", { thread: updated });
    ok(res, updated);
  })
);

threadsRouter.post(
  "/:id/read",
  asyncHandler((req, res) => {
    const thread = sql.get("SELECT * FROM threads WHERE id = ?", req.params.id);
    if (!thread) throw new HttpError(404, "NOT_FOUND", "Conversation not found.");
    const now = nowIso();
    sql.run("UPDATE threads SET unread_admin = 0, updated_at = ? WHERE id = ?", now, thread.id);
    sql.run(
      "UPDATE messages SET read_at = ? WHERE thread_id = ? AND sender = 'customer' AND read_at IS NULL",
      now,
      thread.id
    );
    broadcast("thread:read", { threadId: thread.id });
    ok(res, { ok: true });
  })
);

threadsRouter.post(
  "/:id/messages",
  asyncHandler((req, res) => {
    const input = parse(adminMessageSchema)(req.body);
    const thread = sql.get("SELECT * FROM threads WHERE id = ?", req.params.id);
    if (!thread) throw new HttpError(404, "NOT_FOUND", "Conversation not found.");
    const message = appendAdminMessage(thread, input.body, req.user);
    ok(res, message, undefined, 201);
  })
);

threadsRouter.delete(
  "/:id",
  asyncHandler((req, res) => {
    const thread = sql.get("SELECT * FROM threads WHERE id = ?", req.params.id);
    if (!thread) throw new HttpError(404, "NOT_FOUND", "Conversation not found.");
    sql.run("DELETE FROM threads WHERE id = ?", thread.id);
    logActivity({
      actor: actorName(req),
      action: "thread.deleted",
      entity: "thread",
      entityId: thread.id,
      detail: `${thread.reference} · ${thread.customer_name}`,
    });
    broadcast("thread:deleted", { id: thread.id });
    ok(res, { ok: true });
  })
);

const newThreadSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30),
  email: z.string().trim().email().optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().default(""),
  message: z.string().trim().min(1).max(2000),
});

threadsRouter.post(
  "/",
  asyncHandler((req, res) => {
    const input = parse(newThreadSchema)(req.body);
    const now = nowIso();
    const id = uid("thr_");
    sql.run(
      `INSERT INTO threads
        (id, reference, customer_name, phone, email, city, channel, status, assignee,
         unread_admin, unread_customer, last_message_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'manual', 'open', ?, 0, 0, ?, ?, ?)`,
      id,
      uniqueReference("threads", "THR"),
      input.customerName,
      input.phone,
      input.email || "",
      input.city,
      req.user.name,
      now,
      now,
      now
    );
    const messageId = uid("msg_");
    sql.run(
      `INSERT INTO messages (id, thread_id, sender, body, meta, created_at, read_at)
       VALUES (?, ?, 'admin', ?, ?, ?, ?)`,
      messageId,
      id,
      input.message,
      JSON.stringify({ author: req.user.name, userId: req.user.id }),
      now,
      now
    );
    const thread = threadRow(
      sql.get(`${threadListSelect} WHERE t.id = ?`, id)
    );
    logActivity({
      actor: req.user.name,
      action: "thread.created",
      entity: "thread",
      entityId: id,
      detail: `${thread.reference} · ${input.customerName}`,
    });
    broadcast("thread:new", { thread });
    ok(res, { thread, message: messageRow(sql.get("SELECT * FROM messages WHERE id = ?", messageId)) }, undefined, 201);
  })
);
