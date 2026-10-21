import { Router } from "express";
import { sql } from "../db.js";
import { asyncHandler, ok } from "../lib/http.js";

export const searchRouter = Router();

searchRouter.get(
  "/",
  asyncHandler((req, res) => {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return ok(res, { query: q, enquiries: [], threads: [], venues: [], posts: [], partners: [] });
    const term = `%${q}%`;
    ok(res, {
      query: q,
      enquiries: sql
        .all(
          `SELECT id, reference, name, phone, email, city, status, created_at
             FROM enquiries WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? OR reference LIKE ? OR city LIKE ?
             ORDER BY created_at DESC LIMIT 5`,
          term,
          term,
          term,
          term,
          term
        )
        .map((row) => ({ ...row, href: `/enquiries?focus=${row.id}` })),
      threads: sql
        .all(
          `SELECT id, reference, customer_name, phone, city, status, last_message_at
             FROM threads WHERE customer_name LIKE ? OR phone LIKE ? OR reference LIKE ? OR city LIKE ?
             ORDER BY last_message_at DESC LIMIT 5`,
          term,
          term,
          term,
          term
        )
        .map((row) => ({ ...row, href: `/inbox?thread=${row.id}` })),
      venues: sql
        .all(
          `SELECT id, slug, name, city, status FROM venues
            WHERE name LIKE ? OR city LIKE ? OR slug LIKE ? ORDER BY name LIMIT 5`,
          term,
          term,
          term
        )
        .map((row) => ({ ...row, href: `/venues?focus=${row.id}` })),
      posts: sql
        .all(
          `SELECT id, slug, title, category, status FROM posts
            WHERE title LIKE ? OR category LIKE ? OR slug LIKE ? ORDER BY published_on DESC LIMIT 5`,
          term,
          term,
          term
        )
        .map((row) => ({ ...row, href: `/journal?focus=${row.id}` })),
      partners: sql
        .all(
          `SELECT id, reference, venue_name, contact_name, city, status FROM partners
            WHERE venue_name LIKE ? OR contact_name LIKE ? OR reference LIKE ? OR city LIKE ?
            ORDER BY created_at DESC LIMIT 5`,
          term,
          term,
          term,
          term
        )
        .map((row) => ({ ...row, href: `/partners?focus=${row.id}` })),
    });
  })
);
