import { collections } from "../db.js";

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function like(value) {
  return { $regex: escapeRegex(value), $options: "i" };
}

export async function groupedCounts(collectionName, field, filter = {}) {
  const rows = await collections[collectionName]
    .aggregate([
      { $match: filter },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    ])
    .toArray();
  return rows.reduce((output, row) => {
    output[row._id || ""] = row.count;
    return output;
  }, {});
}

export async function attachLastMessages(threads) {
  if (!threads.length) return threads;
  const ids = threads.map((thread) => thread.id);
  const messages = await collections.messages
    .find(
      { thread_id: { $in: ids } },
      { projection: { _id: 0, thread_id: 1, body: 1, created_at: 1 } }
    )
    .sort({ created_at: -1 })
    .toArray();
  const last = new Map();
  for (const message of messages) {
    if (!last.has(message.thread_id)) last.set(message.thread_id, message.body);
  }
  return threads.map((thread) => ({ ...thread, last_message: last.get(thread.id) || "" }));
}

export function textSort(value) {
  return String(value || "").localeCompare(String(value || ""), "en", { sensitivity: "base" });
}
