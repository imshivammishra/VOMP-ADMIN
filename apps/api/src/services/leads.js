import { config } from "../config.js";
import { nowIso, sql, uid, uniqueReference } from "../db.js";
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

export function submitEnquiry(raw, req) {
  const input = parse(publicEnquirySchema)(raw);
  const now = nowIso();
  const id = uid("enq_");
  const ref = uniqueReference("enquiries", "ENQ");

  sql.run(
    `INSERT INTO enquiries
      (id, reference, name, phone, email, city, event_type, event_date, guest_count, message, source,
       status, priority, assignee, tags, notes, ip, user_agent, first_response_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, '', '[]', '[]', ?, ?, NULL, ?, ?)`,
    id,
    ref,
    input.name,
    input.phone,
    input.email || "",
    input.city || "",
    input.eventType || "",
    input.eventDate || "",
    input.guestCount || "",
    input.message || "",
    input.source || "website",
    inferPriority(input.guestCount),
    req.ip || "",
    String(req.get("user-agent") || "").slice(0, 300),
    now,
    now
  );

  const enquiry = enquiryRow(sql.get("SELECT * FROM enquiries WHERE id = ?", id));
  logActivity({
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

export function appendCustomerMessage(raw) {
  const input = parse(chatMessageSchema)(raw);
  const now = nowIso();
  let thread = input.threadId
    ? sql.get("SELECT * FROM threads WHERE id = ?", input.threadId)
    : null;

  if (!thread && input.threadId) {
    thread = null;
  }

  if (!thread && input.phone) {
    thread = sql.get(
      "SELECT * FROM threads WHERE phone = ? AND status <> 'resolved' ORDER BY last_message_at DESC LIMIT 1",
      input.phone
    );
  }

  let threadId = thread?.id;
  if (!thread) {
    threadId = uid("thr_");
    sql.run(
      `INSERT INTO threads
        (id, reference, customer_name, phone, email, city, channel, status, assignee,
         unread_admin, unread_customer, last_message_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', '', 0, 0, ?, ?, ?)`,
      threadId,
      uniqueReference("threads", "THR"),
      input.name || input.customer || "Website visitor",
      input.phone || "",
      input.email || "",
      input.city || "",
      input.channel || "website-chat",
      now,
      now,
      now
    );
  }

  const messageId = uid("msg_");
  sql.run(
    `INSERT INTO messages (id, thread_id, sender, body, meta, created_at, read_at)
     VALUES (?, ?, 'customer', ?, '{}', ?, NULL)`,
    messageId,
    threadId,
    input.message,
    now
  );
  sql.run(
    `UPDATE threads
        SET last_message_at = ?, unread_admin = unread_admin + 1, status = 'open', updated_at = ?
      WHERE id = ?`,
    now,
    now,
    threadId
  );
  if (input.city && !thread?.city) {
    sql.run("UPDATE threads SET city = ? WHERE id = ?", input.city, threadId);
  }
  if (input.name && (!thread || thread.customer_name === "Website visitor")) {
    sql.run("UPDATE threads SET customer_name = ? WHERE id = ?", input.name, threadId);
  }

  const savedThread = threadRow(
    sql.get(
      `SELECT t.*, (SELECT body FROM messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
         FROM threads t WHERE t.id = ?`,
      threadId
    )
  );
  const message = messageRow(sql.get("SELECT * FROM messages WHERE id = ?", messageId));
  logActivity({
    actor: input.name || input.customer || "Website visitor",
    action: thread ? "chat.message" : "chat.thread_created",
    entity: "thread",
    entityId: threadId,
    detail: `${savedThread.reference} · ${input.city || "City not shared"}`,
  });
  broadcast(thread ? "message:new" : "thread:new", { thread: savedThread, message });
  return { threadId, thread: savedThread, message };
}

export function appendAdminMessage(thread, body, user) {
  const now = nowIso();
  const id = uid("msg_");
  sql.run(
    `INSERT INTO messages (id, thread_id, sender, body, meta, created_at, read_at)
     VALUES (?, ?, 'admin', ?, ?, ?, ?)`,
    id,
    thread.id,
    body,
    JSON.stringify({ author: user.name, userId: user.id }),
    now,
    now
  );
  sql.run(
    `UPDATE threads
        SET last_message_at = ?, unread_customer = unread_customer + 1, unread_admin = 0,
            status = 'waiting', updated_at = ?
      WHERE id = ?`,
    now,
    now,
    thread.id
  );
  const message = messageRow(sql.get("SELECT * FROM messages WHERE id = ?", id));
  logActivity({
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
