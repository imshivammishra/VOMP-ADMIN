import { config } from "../src/config.js";
import { nowIso, sql, toJson, transaction, uid } from "../src/db.js";
import { hashPassword } from "../src/lib/auth.js";
import { saveSettings, SETTINGS_DEFAULTS } from "../src/lib/settings.js";
import { venues as catalogueVenues, cities as catalogueCities, blogPosts as cataloguePosts } from "./catalogue.mjs";
import { contentBlocks } from "./content.mjs";

function isoDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

function seedCatalogue() {
  if (sql.get("SELECT COUNT(*) AS count FROM venues").count === 0) {
    catalogueVenues.forEach((venue, index) => {
      const id = uid("ven_");
      const now = nowIso();
      sql.run(
        `INSERT INTO venues
          (id, slug, name, city, city_slug, area, type, setting, capacity_min, capacity_max, price_hint,
           image, image_alt, short_description, description, amenities, event_types, featured, status,
           sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)`,
        id,
        venue.slug,
        venue.name,
        venue.city,
        venue.citySlug,
        venue.area || "",
        venue.type || "",
        venue.setting || "Indoor",
        venue.capacityMin || 0,
        venue.capacityMax || 0,
        venue.priceHint || "",
        venue.image || "",
        venue.imageAlt || "",
        venue.shortDescription || "",
        `${venue.shortDescription || ""}\n\n${venue.name} sits in ${venue.area || venue.city}, ${venue.city} and works for ${(venue.eventTypes || []).join(", ") || "celebrations"}.\n\nAsk our team for current availability, a site visit, and commercial terms for your date and guest count.`,
        toJson(venue.amenities || []),
        toJson(venue.eventTypes || []),
        venue.featured ? 1 : 0,
        index,
        now,
        now
      );
    });
    console.log(`[seed] ${catalogueVenues.length} venues`);
  }

  if (sql.get("SELECT COUNT(*) AS count FROM destinations").count === 0) {
    catalogueCities.forEach((city) => {
      const now = nowIso();
      sql.run(
        `INSERT INTO destinations
          (id, slug, name, tagline, description, image, image_alt, venue_count_label, popular_types, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)`,
        uid("dst_"),
        city.slug,
        city.name,
        city.tagline || "",
        city.description || "",
        city.image || "",
        city.imageAlt || "",
        city.venueCountLabel || "",
        toJson(city.popularTypes || []),
        now,
        now
      );
    });
    console.log(`[seed] ${catalogueCities.length} destinations`);
  }

  if (sql.get("SELECT COUNT(*) AS count FROM posts").count === 0) {
    cataloguePosts.forEach((post) => {
      const now = nowIso();
      sql.run(
        `INSERT INTO posts
          (id, slug, title, excerpt, category, author, published_on, reading_minutes, image, image_alt, body, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)`,
        uid("pst_"),
        post.slug,
        post.title,
        post.excerpt || "",
        post.category || "Journal",
        post.author || "Venue On My Plate",
        isoDate(post.publishedOn),
        post.readingMinutes || 5,
        post.image || "",
        post.imageAlt || "",
        toJson(post.body || []),
        now,
        now
      );
    });
    console.log(`[seed] ${cataloguePosts.length} journal posts`);
  }
}

function seedSiteContent() {
  if (sql.get("SELECT COUNT(*) AS count FROM content_blocks").count === 0) {
    const counters = new Map();
    contentBlocks.forEach((block) => {
      const order = counters.get(block.section) || 0;
      counters.set(block.section, order + 10);
      const now = nowIso();
      sql.run(
        `INSERT INTO content_blocks
          (id, section, block_key, title, subtitle, body, image, image_alt, link_label,
           link_href, icon, meta, sort_order, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)`,
        uid("blk_"),
        block.section,
        block.blockKey || "",
        block.title || "",
        block.subtitle || "",
        block.body || "",
        block.image || "",
        block.imageAlt || "",
        block.linkLabel || "",
        block.linkHref || "",
        block.icon || "",
        toJson(block.meta || {}),
        order,
        now,
        now
      );
    });
    console.log("[seed] website content");
  }
}

export function ensureSeed() {
  return transaction(() => {
    let created = false;

    if (sql.get("SELECT COUNT(*) AS count FROM users").count === 0) {
      const now = nowIso();
      sql.run(
        `INSERT INTO users (id, email, name, role, password_hash, status, created_at, last_login_at)
         VALUES (?, ?, ?, 'admin', ?, 'active', ?, NULL)`,
        uid("usr_"),
        config.seedAdmin.email,
        config.seedAdmin.name,
        hashPassword(config.seedAdmin.password),
        now
      );
      created = true;
      console.log(`[seed] admin ${config.seedAdmin.email}`);
    }

    seedCatalogue();
    seedSiteContent();

    if (sql.get("SELECT COUNT(*) AS count FROM settings").count === 0) {
      saveSettings(SETTINGS_DEFAULTS);
    }

    return { created, email: config.seedAdmin.email };
  });
}
