import { config } from "../config.js";
import { collections, nowIso, uid, uniqueReference } from "../db.js";
import { logActivity } from "../lib/activity.js";
import { broadcast } from "../lib/realtime.js";
import { publicEnquirySchema, chatMessageSchema } from "../lib/schemas.js";
import { parse } from "../lib/http.js";
import { enquiryRow, messageRow, threadRow } from "../lib/serializers.js";

function inferPriority(guestCount = "") {
  const value = String(guestCount).toLowerCase();
  if (value.includes("1000+")) return "urgent";
  if (value.includes("600")) return "high";
  if (value.includes("300")) return "normal";
  return "normal";
}

export async function submitEnquiry(raw, req) {
  const input = parse(publicEnquirySchema)(raw);
  const now = nowIso();
  const id = uid("enq_");
  const ref = await uniqueReference("enquiries", "ENQ");

  await collections.enquiries.insertOne({
    id,
    reference: ref,
    name: input.name,
    phone: input.phone,
    email: input.email || "",
    city: input.city || "",
    event_type: input.eventType || "",
    event_date: input.eventDate || "",
    guest_count: input.guestCount || "",
    message: input.message || "",
    source: input.source || "website",
    status: "new",
    priority: inferPriority(input.guestCount),
    assignee: "",
    tags: [],
    notes: [],
    ip: req.ip || "",
    user_agent: String(req.get("user-agent") || "").slice(0, 300),
    first_response_at: null,
    created_at: now,
    updated_at: now,
  });

  const enquiry = enquiryRow(await collections.enquiries.findOne({ id }));
  await logActivity({
    actor: input.name,
    action: "enquiry.created",
    entity: "enquiry",
    entityId: id,
    detail: `${ref} · ${input.city || "City not shared"} · ${input.eventType || "Event"} · ${input.source}`,
  });
  broadcast("enquiry:new", { enquiry });
  if (input.venueSlug) {
    broadcast("venue:interest", { venueSlug: input.venueSlug, reference: ref });
  }
  return { id, reference: ref, enquiry };
}

export async function appendCustomerMessage(raw) {
  const input = parse(chatMessageSchema)(raw);
  const now = nowIso();
  let thread = input.threadId ? await collections.threads.findOne({ id: input.threadId }) : null;

  if (!thread && input.threadId) {
    thread = null;
  }

  if (!thread && input.phone) {
    thread = await collections.threads.findOne(
      { phone: input.phone, status: { $ne: "resolved" } },
      { sort: { last_message_at: -1 } }
    );
  }

  let threadId = thread?.id;
  if (!thread) {
    threadId = uid("thr_");
    await collections.threads.insertOne({
      id: threadId,
      reference: await uniqueReference("threads", "THR"),
      customer_name: input.name || input.customer || "Website visitor",
      phone: input.phone || "",
      email: input.email || "",
      city: input.city || "",
      channel: input.channel || "website-chat",
      status: "open",
      assignee: "",
      unread_admin: 0,
      unread_customer: 0,
      last_message_at: now,
      created_at: now,
      updated_at: now,
    });
  }

  const messageId = uid("msg_");
  await collections.messages.insertOne({
    id: messageId,
    thread_id: threadId,
    sender: "customer",
    body: input.message,
    meta: {},
    created_at: now,
    read_at: null,
  });
  await collections.threads.updateOne(
    { id: threadId },
    {
      $set: { last_message_at: now, status: "open", updated_at: now },
      $inc: { unread_admin: 1 },
    }
  );
  if (input.city && !thread?.city) {
    await collections.threads.updateOne({ id: threadId }, { $set: { city: input.city } });
  }
  if (input.name && (!thread || thread.customer_name === "Website visitor")) {
    await collections.threads.updateOne({ id: threadId }, { $set: { customer_name: input.name } });
  }

  const savedThreadDoc = await collections.threads.findOne({ id: threadId });
  const lastMessage = await collections.messages.findOne(
    { thread_id: threadId },
    { sort: { created_at: -1 } }
  );
  const savedThread = threadRow({ ...savedThreadDoc, last_message: lastMessage?.body || "" });
  const message = messageRow(await collections.messages.findOne({ id: messageId }));
  await logActivity({
    actor: input.name || input.customer || "Website visitor",
    action: thread ? "chat.message" : "chat.thread_created",
    entity: "thread",
    entityId: threadId,
    detail: `${savedThread.reference} · ${input.city || "City not shared"}`,
  });
  broadcast(thread ? "message:new" : "thread:new", { thread: savedThread, message });
  return { threadId, thread: savedThread, message };
}

export async function appendAdminMessage(thread, body, user) {
  const now = nowIso();
  const id = uid("msg_");
  await collections.messages.insertOne({
    id,
    thread_id: thread.id,
    sender: "admin",
    body,
    meta: { author: user.name, userId: user.id },
    created_at: now,
    read_at: now,
  });
  await collections.threads.updateOne(
    { id: thread.id },
    {
      $set: { last_message_at: now, unread_admin: 0, status: "waiting", updated_at: now },
      $inc: { unread_customer: 1 },
    }
  );
  const message = messageRow(await collections.messages.findOne({ id }));
  await logActivity({
    actor: user.name,
    action: "chat.replied",
    entity: "thread",
    entityId: thread.id,
    detail: `${thread.reference} · reply sent`,
  });
  broadcast("message:new", { threadId: thread.id, message, direction: "admin" });
  return message;
}

export function publicContact() {
  return {
    email: "contact@venueonmyplate.in",
    phone: "+91 94624 60555",
    phoneHref: "tel:+919462460555",
    hours: "Mon–Sat, 9:30am – 7:00pm IST",
    responseNote: "Replies within one business day",
    api: config.apiPublicUrl,
  };
}
