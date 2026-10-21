import { z } from "zod";

const trimmed = (max) => z.string().trim().max(max);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z.string().min(10, "Use at least 10 characters.").max(200),
});

export const publicEnquirySchema = z.object({
  name: z.string().trim().min(2, "Please share your name.").max(120),
  phone: z
    .string()
    .trim()
    .min(8, "Please share a valid phone number.")
    .max(24)
    .regex(/^[+\d][\d\s()-]{6,}$/, "Please share a valid phone number."),
  email: z.string().trim().email("Please share a valid email.").max(160).optional().or(z.literal("")),
  city: trimmed(120).optional().default(""),
  eventType: trimmed(120).optional().default(""),
  eventDate: trimmed(80).optional().default(""),
  guestCount: trimmed(80).optional().default(""),
  message: trimmed(2000).optional().default(""),
  source: trimmed(40).optional().default("website"),
  venueSlug: trimmed(120).optional(),
});

export const partnerApplicationSchema = z.object({
  venueName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(8).max(24),
  city: trimmed(120).optional().default(""),
  venueType: trimmed(120).optional().default(""),
  rooms: z.coerce.number().int().min(0).max(10000).optional().default(0),
  website: trimmed(240).optional().default(""),
  message: trimmed(2000).optional().default(""),
});

export const chatMessageSchema = z.object({
  threadId: trimmed(120).optional(),
  name: trimmed(120).optional(),
  customer: trimmed(120).optional(),
  phone: trimmed(30).optional(),
  email: trimmed(160).optional(),
  city: trimmed(120).optional(),
  message: z.string().trim().min(1, "Message is required.").max(2000),
  channel: trimmed(40).optional().default("website-chat"),
});

export const venueSchema = z.object({
  slug: z.string().trim().max(90).optional(),
  name: z.string().trim().min(2).max(160),
  city: z.string().trim().min(1).max(120),
  citySlug: z.string().trim().max(90).optional(),
  area: trimmed(160).optional().default(""),
  type: trimmed(120).optional().default(""),
  setting: z.enum(["Indoor", "Outdoor", "Indoor + Outdoor"]).optional().default("Indoor"),
  capacityMin: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
  capacityMax: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
  priceHint: trimmed(80).optional().default(""),
  image: trimmed(800).optional().default(""),
  imageAlt: trimmed(300).optional().default(""),
  shortDescription: trimmed(500).optional().default(""),
  description: trimmed(8000).optional().default(""),
  amenities: z.union([z.array(z.string()), z.string()]).optional().default([]),
  eventTypes: z.union([z.array(z.string()), z.string()]).optional().default([]),
  featured: z.union([z.boolean(), z.number(), z.string()]).optional().default(false),
  status: z.enum(["published", "draft", "archived"]).optional().default("published"),
});

export const destinationSchema = z.object({
  slug: z.string().trim().max(90).optional(),
  name: z.string().trim().min(2).max(120),
  tagline: trimmed(300).optional().default(""),
  description: trimmed(4000).optional().default(""),
  image: trimmed(800).optional().default(""),
  imageAlt: trimmed(300).optional().default(""),
  venueCountLabel: trimmed(80).optional().default(""),
  popularTypes: z.union([z.array(z.string()), z.string()]).optional().default([]),
  status: z.enum(["published", "draft"]).optional().default("published"),
});

export const postSchema = z.object({
  slug: z.string().trim().max(90).optional(),
  title: z.string().trim().min(2).max(240),
  excerpt: trimmed(600).optional().default(""),
  category: trimmed(80).optional().default("Journal"),
  author: trimmed(120).optional().default("Venue On My Plate Studio"),
  publishedOn: trimmed(40).optional(),
  readingMinutes: z.coerce.number().int().min(1).max(120).optional().default(5),
  image: trimmed(800).optional().default(""),
  imageAlt: trimmed(300).optional().default(""),
  body: z.union([z.array(z.string()), z.string()]).optional().default([]),
  status: z.enum(["published", "draft"]).optional().default("published"),
});

export const enquiryUpdateSchema = z.object({
  status: z.enum(["new", "contacted", "qualified", "won", "lost", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignee: trimmed(120).optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  note: z.string().trim().min(1).max(2000).optional(),
});

export const threadUpdateSchema = z.object({
  status: z.enum(["open", "waiting", "resolved"]).optional(),
  assignee: trimmed(120).optional(),
  unreadAdmin: z.coerce.number().int().min(0).optional(),
});

export const adminMessageSchema = z.object({
  body: z.string().trim().min(1, "Write a reply first.").max(4000),
});

export const partnerUpdateSchema = z.object({
  status: z.enum(["new", "reviewing", "verified", "active", "declined"]).optional(),
  message: trimmed(2000).optional(),
});

export const bulkEnquirySchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(500),
  action: z.enum(["status", "priority", "assignee", "delete"]),
  value: z.string().trim().max(120).optional(),
});

export const teamCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  role: z.enum(["admin", "editor", "viewer"]).default("editor"),
  password: z.string().min(10, "Use at least 10 characters.").max(200),
});

export const teamUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(["admin", "editor", "viewer"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  password: z.string().min(10).max(200).optional(),
});

export const settingsSchema = z.record(z.string(), z.record(z.string(), z.unknown()));

export const mediaUpdateSchema = z.object({
  alt: z.string().trim().max(300).optional().default(""),
});

export const CONTENT_SECTIONS = [
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
  "cta",
  "seo",
];

export const contentBlockSchema = z.object({
  section: z.enum(CONTENT_SECTIONS),
  blockKey: trimmed(80).optional().default(""),
  title: trimmed(400).optional().default(""),
  subtitle: trimmed(400).optional().default(""),
  body: trimmed(12000).optional().default(""),
  image: trimmed(1200).optional().default(""),
  imageAlt: trimmed(400).optional().default(""),
  linkLabel: trimmed(160).optional().default(""),
  linkHref: trimmed(500).optional().default(""),
  icon: trimmed(60).optional().default(""),
  meta: z.record(z.string(), z.unknown()).optional().default({}),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional().default(0),
  status: z.enum(["published", "draft"]).optional().default("published"),
});

export const contentBlockUpdateSchema = contentBlockSchema.partial();

export const contentReorderSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(500),
});

export const reviewSchema = z.object({
  name: z.string().trim().min(2).max(160),
  context: trimmed(200).optional().default(""),
  quote: z.string().trim().min(5).max(4000),
  rating: z.coerce.number().int().min(1).max(5).optional().default(5),
  image: trimmed(1200).optional().default(""),
  venueSlug: trimmed(160).optional().default(""),
  featured: z.union([z.boolean(), z.number(), z.string()]).optional().default(true),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional().default(0),
  status: z.enum(["published", "draft"]).optional().default("published"),
});

export const reviewUpdateSchema = reviewSchema.partial();
