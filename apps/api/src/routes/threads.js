import { Router } from "express";
import { z } from "zod";
import { collections, nowIso, paginationMeta, uid, uniqueReference } from "../db.js";
import { asyncHandler, HttpError, ok, parse, parsePagination } from "../lib/http.js";
import { like, groupedCounts, attachLastMessages } from "../lib/query.js";
import { adminMessageSchema, threadUpdateSchema } from "../lib/schemas.js";
import { messageRow, threadRow } from "../lib/serializers.js";
import { actorName, logActivity } from "../lib/activity.js";
import { appendAdminMessage } from "../services/leads.js";
import { broadcast } from "../lib/realtime.js";

export const threadsRouter = Router();

const STATUSES = ["open", "waiting", "resolved"];

threadsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query, { limit: 30 });
    const filter = {};
    const q = String(req.query.q || "").trim();
    if (q) {
      filter.$or = ["customer_name", "phone", "reference", "city", "email"].map((field) => ({
        [field]: like(q),
      }));
    }
    if (req.query.status && req.query.status !== "all") filter.status = String(req.query.status);
    if (req.query.assignee && req.query.assignee !== "all") filter.assignee = String(req.query.assignee);

    const [total, rows, statusCounts, unreadAgg] = await Promise.all([
      collections.threads.countDocuments(filter),
      collections.threads.find(filter).sort({ last_message_at: -1 }).skip(offset).limit(limit).toArray(),
      groupedCounts("threads", "status"),
      collections.threads
        .aggregate([{ $group: { _id: null, count: { $sum: "$unread_admin" } } }])
        .toArray(),
    ]);
    const counts = { all: 0 };
    for (const status of STATUSES) counts[status] = statusCounts[status] || 0;
    counts.all = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const unread = unreadAgg[0]?.count || 0;
    const withMessages = await attachLastMessages(rows);
    ok(res, withMessages.map(threadRow), { ...paginationMeta(total, page, limit), counts, unread });
  })
);

threadsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const thread = await collections.threads.findOne({ id: req.params.id });
    if (!thread) throw new HttpError(404, "NOT_FOUND", "Conversation not found.");
    const messages = (await collections.messages.find({ thread_id: thread.id }).sort({ created_at: 1 }).toArray()).map(
      messageRow
    );
    const enquiry = await collections.enquiries.findOne(
      { phone: thread.phone },
      { sort: { created_at: -1 }, projection: { id: 1, reference: 1, status: 1 } }
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
  asyncHandler(async (req, res) => {
    const input = parse(threadUpdateSchema)(req.body);
    const thread = await collections.threads.findOne({ id: req.params.id });
    if (!thread) throw new HttpError(404, "NOT_FOUND", "Conversation not found.");
    const now = nowIso();
    const updates = {};
    if (input.status) updates.status = input.status;
    if (input.assignee !== undefined) updates.assignee = input.assignee;
    if (input.unreadAdmin !== undefined) {
      updates.unread_admin = input.unreadAdmin;
      if (input.unreadAdmin === 0) {
        await collections.messages.updateMany(
          { thread_id: thread.id, sender: "customer", read_at: null },
          { $set: { read_at: now } }
        );
      }
    }
    updates.updated_at = now;
    await collections.threads.updateOne({ id: thread.id }, { $set: updates });

    const updated = threadRow(await collections.threads.findOne({ id: thread.id }));
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const thread = await collections.threads.findOne({ id: req.params.id });
    if (!thread) throw new HttpError(404, "NOT_FOUND", "Conversation not found.");
    const now = nowIso();
    await collections.threads.updateOne(
      { id: thread.id },
      { $set: { unread_admin: 0, updated_at: now } }
    );
    await collections.messages.updateMany(
      { thread_id: thread.id, sender: "customer", read_at: null },
      { $set: { read_at: now } }
    );
    broadcast("thread:read", { threadId: thread.id });
    ok(res, { ok: true });
  })
);

threadsRouter.post(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const input = parse(adminMessageSchema)(req.body);
    const thread = await collections.threads.findOne({ id: req.params.id });
    if (!thread) throw new HttpError(404, "NOT_FOUND", "Conversation not found.");
    const message = await appendAdminMessage(thread, input.body, req.user);
    ok(res, message, undefined, 201);
  })
);

threadsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const thread = await collections.threads.findOne({ id: req.params.id });
    if (!thread) throw new HttpError(404, "NOT_FOUND", "Conversation not found.");
    await Promise.all([
      collections.threads.deleteOne({ id: thread.id }),
      collections.messages.deleteMany({ thread_id: thread.id }),
    ]);
    await logActivity({
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
  asyncHandler(async (req, res) => {
    const input = parse(newThreadSchema)(req.body);
    const now = nowIso();
    const id = uid("thr_");
    await collections.threads.insertOne({
      id,
      reference: await uniqueReference("threads", "THR"),
      customer_name: input.customerName,
      phone: input.phone,
      email: input.email || "",
      city: input.city,
      channel: "manual",
      status: "open",
      assignee: req.user.name,
      unread_admin: 0,
      unread_customer: 0,
      last_message_at: now,
      created_at: now,
      updated_at: now,
    });
    const messageId = uid("msg_");
    await collections.messages.insertOne({
      id: messageId,
      thread_id: id,
      sender: "admin",
      body: input.message,
      meta: { author: req.user.name, userId: req.user.id },
      created_at: now,
      read_at: now,
    });
    const lastMessage = await collections.messages.findOne({ id: messageId });
    const thread = threadRow({
      ...(await collections.threads.findOne({ id })),
      last_message: lastMessage?.body || "",
    });
    await logActivity({
      actor: req.user.name,
      action: "thread.created",
      entity: "thread",
      entityId: id,
      detail: `${thread.reference} · ${input.customerName}`,
    });
    broadcast("thread:new", { thread });
    ok(
      res,
      { thread, message: messageRow(lastMessage) },
      undefined,
      201
    );
  })
);
