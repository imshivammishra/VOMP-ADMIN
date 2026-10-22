import { Router } from "express";
import { collections } from "../db.js";
import { asyncHandler, ok } from "../lib/http.js";
import { like } from "../lib/query.js";

export const searchRouter = Router();

searchRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) {
      return ok(res, { query: q, enquiries: [], threads: [], venues: [], posts: [], partners: [] });
    }
    const [enquiries, threads, venues, posts, partners] = await Promise.all([
      collections.enquiries
        .find(
          {
            $or: ["name", "phone", "email", "reference", "city"].map((field) => ({
              [field]: like(q),
            })),
          },
          {
            projection: {
              _id: 0,
              id: 1,
              reference: 1,
              name: 1,
              phone: 1,
              email: 1,
              city: 1,
              status: 1,
              created_at: 1,
            },
          }
        )
        .sort({ created_at: -1 })
        .limit(5)
        .toArray(),
      collections.threads
        .find(
          {
            $or: ["customer_name", "phone", "reference", "city"].map((field) => ({
              [field]: like(q),
            })),
          },
          {
            projection: {
              _id: 0,
              id: 1,
              reference: 1,
              customer_name: 1,
              phone: 1,
              city: 1,
              status: 1,
              last_message_at: 1,
            },
          }
        )
        .sort({ last_message_at: -1 })
        .limit(5)
        .toArray(),
      collections.venues
        .find(
          { $or: ["name", "city", "slug"].map((field) => ({ [field]: like(q) })) },
          { projection: { _id: 0, id: 1, slug: 1, name: 1, city: 1, status: 1 } }
        )
        .sort({ name: 1 })
        .limit(5)
        .toArray(),
      collections.posts
        .find(
          { $or: ["title", "category", "slug"].map((field) => ({ [field]: like(q) })) },
          { projection: { _id: 0, id: 1, slug: 1, title: 1, category: 1, status: 1 } }
        )
        .sort({ published_on: -1 })
        .limit(5)
        .toArray(),
      collections.partners
        .find(
          {
            $or: ["venue_name", "contact_name", "reference", "city"].map((field) => ({
              [field]: like(q),
            })),
          },
          {
            projection: {
              _id: 0,
              id: 1,
              reference: 1,
              venue_name: 1,
              contact_name: 1,
              city: 1,
              status: 1,
            },
          }
        )
        .sort({ created_at: -1 })
        .limit(5)
        .toArray(),
    ]);
    ok(res, {
      query: q,
      enquiries: enquiries.map((row) => ({ ...row, href: `/enquiries?focus=${row.id}` })),
      threads: threads.map((row) => ({ ...row, href: `/inbox?thread=${row.id}` })),
      venues: venues.map((row) => ({ ...row, href: `/venues?focus=${row.id}` })),
      posts: posts.map((row) => ({ ...row, href: `/journal?focus=${row.id}` })),
      partners: partners.map((row) => ({ ...row, href: `/partners?focus=${row.id}` })),
    });
  })
);
