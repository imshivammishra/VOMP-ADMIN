import crypto from "node:crypto";
import fs from "node:fs";
import { MongoClient } from "mongodb";
import { config } from "./config.js";

fs.mkdirSync(config.uploadsDir, { recursive: true });

// One long-lived Atlas connection. The API listens only on a single VPS today;
// keep the pool modest and leave server selection time for a cold Atlas wake-up.
export const client = new MongoClient(config.mongoUri, {
  maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 20),
  minPoolSize: 0,
  retryWrites: true,
  serverSelectionTimeoutMS: 15_000,
  connectTimeoutMS: 15_000,
});

await client.connect();

export const mongo = client.db(config.mongoDb);

export const collections = {
  users: mongo.collection("users"),
  sessions: mongo.collection("sessions"),
  venues: mongo.collection("venues"),
  destinations: mongo.collection("destinations"),
  posts: mongo.collection("posts"),
  enquiries: mongo.collection("enquiries"),
  threads: mongo.collection("threads"),
  messages: mongo.collection("messages"),
  partners: mongo.collection("partners"),
  media: mongo.collection("media"),
  activity: mongo.collection("activity"),
  content_blocks: mongo.collection("content_blocks"),
  reviews: mongo.collection("reviews"),
  settings: mongo.collection("settings"),
};

let indexesReady = null;

export function ensureIndexes() {
  if (indexesReady) return indexesReady;
  indexesReady = Promise.all([
    collections.users.createIndex({ id: 1 }, { unique: true, name: "uniq_user_id" }),
    collections.users.createIndex({ email: 1 }, { unique: true, name: "uniq_user_email" }),

    collections.sessions.createIndex({ id: 1 }, { unique: true, name: "uniq_session_id" }),
    collections.sessions.createIndex({ token_hash: 1 }, { unique: true, name: "uniq_session_token" }),
    collections.sessions.createIndex({ user_id: 1 }, { name: "sessions_by_user" }),
    collections.sessions.createIndex({ expires_at: 1 }, { name: "sessions_by_expiry" }),

    collections.venues.createIndex({ id: 1 }, { unique: true, name: "uniq_venue_id" }),
    collections.venues.createIndex({ slug: 1 }, { unique: true, name: "uniq_venue_slug" }),
    collections.venues.createIndex({ status: 1 }, { name: "venues_by_status" }),
    collections.venues.createIndex({ city_slug: 1 }, { name: "venues_by_city" }),
    collections.venues.createIndex({ featured: 1 }, { name: "venues_by_featured" }),
    collections.venues.createIndex({ sort_order: 1, name: 1 }, { name: "venues_catalogue_order" }),

    collections.destinations.createIndex({ id: 1 }, { unique: true, name: "uniq_destination_id" }),
    collections.destinations.createIndex({ slug: 1 }, { unique: true, name: "uniq_destination_slug" }),
    collections.destinations.createIndex({ status: 1 }, { name: "destinations_by_status" }),

    collections.posts.createIndex({ id: 1 }, { unique: true, name: "uniq_post_id" }),
    collections.posts.createIndex({ slug: 1 }, { unique: true, name: "uniq_post_slug" }),
    collections.posts.createIndex({ status: 1 }, { name: "posts_by_status" }),
    collections.posts.createIndex({ published_on: -1 }, { name: "posts_by_date" }),

    collections.enquiries.createIndex({ id: 1 }, { unique: true, name: "uniq_enquiry_id" }),
    collections.enquiries.createIndex({ reference: 1 }, { unique: true, name: "uniq_enquiry_ref" }),
    collections.enquiries.createIndex({ created_at: -1 }, { name: "enquiries_by_created" }),
    collections.enquiries.createIndex({ status: 1 }, { name: "enquiries_by_status" }),
    collections.enquiries.createIndex({ source: 1 }, { name: "enquiries_by_source" }),
    collections.enquiries.createIndex({ assignee: 1 }, { name: "enquiries_by_assignee" }),

    collections.threads.createIndex({ id: 1 }, { unique: true, name: "uniq_thread_id" }),
    collections.threads.createIndex({ reference: 1 }, { unique: true, name: "uniq_thread_ref" }),
    collections.threads.createIndex({ last_message_at: -1 }, { name: "threads_by_last_message" }),
    collections.threads.createIndex({ status: 1 }, { name: "threads_by_status" }),
    collections.threads.createIndex({ phone: 1 }, { name: "threads_by_phone" }),

    collections.messages.createIndex({ id: 1 }, { unique: true, name: "uniq_message_id" }),
    collections.messages.createIndex({ thread_id: 1, created_at: 1 }, { name: "messages_by_thread" }),

    collections.partners.createIndex({ id: 1 }, { unique: true, name: "uniq_partner_id" }),
    collections.partners.createIndex({ reference: 1 }, { unique: true, name: "uniq_partner_ref" }),
    collections.partners.createIndex({ status: 1 }, { name: "partners_by_status" }),
    collections.partners.createIndex({ created_at: -1 }, { name: "partners_by_created" }),

    collections.media.createIndex({ id: 1 }, { unique: true, name: "uniq_media_id" }),
    collections.media.createIndex({ created_at: -1 }, { name: "media_by_created" }),

    collections.activity.createIndex({ id: 1 }, { unique: true, name: "uniq_activity_id" }),
    collections.activity.createIndex({ created_at: -1 }, { name: "activity_by_created" }),

    collections.content_blocks.createIndex({ id: 1 }, { unique: true, name: "uniq_block_id" }),
    collections.content_blocks.createIndex(
      { section: 1, sort_order: 1 },
      { name: "content_by_section" }
    ),

    collections.reviews.createIndex({ id: 1 }, { unique: true, name: "uniq_review_id" }),
    collections.reviews.createIndex(
      { status: 1, sort_order: 1 },
      { name: "reviews_by_status" }
    ),
  ]).then(() => undefined);
  return indexesReady;
}

export function nowIso() {
  return new Date().toISOString();
}

export function uid(prefix = "") {
  return `${prefix}${crypto.randomUUID().replaceAll("-", "")}`;
}

export function reference(prefix) {
  return `${prefix}-${Date.now().toString(36).slice(-5).toUpperCase()}${crypto
    .randomBytes(2)
    .toString("hex")
    .toUpperCase()}`;
}

export async function uniqueReference(collectionName, prefix) {
  const collection = collections[collectionName];
  if (!collection) throw new Error(`Unknown collection for reference: ${collectionName}`);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = reference(prefix);
    const exists = await collection.findOne({ reference: candidate }, { projection: { _id: 1 } });
    if (!exists) return candidate;
  }
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export function parseJson(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function toJson(value, fallback = []) {
  return JSON.stringify(value ?? fallback);
}

export function paginationMeta(total, page, limit) {
  return {
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    hasMore: page * limit < total,
  };
}

export async function pingDatabase() {
  const started = performance.now();
  await mongo.command({ ping: 1 });
  return Math.max(1, Math.round(performance.now() - started));
}

export async function closeDb() {
  try {
    await client.close();
  } catch {
    /* already closed */
  }
}
