import { config } from "../src/config.js";
import { collections, nowIso, uid } from "../src/db.js";
import { hashPassword } from "../src/lib/auth.js";
import { saveSettings, SETTINGS_DEFAULTS } from "../src/lib/settings.js";
import { venues as catalogueVenues, cities as catalogueCities, blogPosts as cataloguePosts } from "./catalogue.mjs";
import { contentBlocks } from "./content.mjs";

function isoDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

async function seedCatalogue() {
  if ((await collections.venues.countDocuments({})) === 0 && catalogueVenues.length > 0) {
    const now = nowIso();
    await collections.venues.insertMany(
      catalogueVenues.map((venue, index) => ({
        id: uid("ven_"),
        slug: venue.slug,
        name: venue.name,
        city: venue.city,
        city_slug: venue.citySlug,
        area: venue.area || "",
        type: venue.type || "",
        setting: venue.setting || "Indoor",
        capacity_min: venue.capacityMin || 0,
        capacity_max: venue.capacityMax || 0,
        price_hint: venue.priceHint || "",
        image: venue.image || "",
        image_alt: venue.imageAlt || "",
        short_description: venue.shortDescription || "",
        description: `${venue.shortDescription || ""}\n\n${venue.name} sits in ${venue.area || venue.city}, ${venue.city} and works for ${(venue.eventTypes || []).join(", ") || "celebrations"}.\n\nAsk our team for current availability, a site visit, and commercial terms for your date and guest count.`,
        amenities: venue.amenities || [],
        event_types: venue.eventTypes || [],
        featured: Boolean(venue.featured),
        status: "published",
        sort_order: index,
        created_at: now,
        updated_at: now,
      }))
    );
    console.log(`[seed] ${catalogueVenues.length} venues`);
  }

  if ((await collections.destinations.countDocuments({})) === 0) {
    const now = nowIso();
    await collections.destinations.insertMany(
      catalogueCities.map((city) => ({
        id: uid("dst_"),
        slug: city.slug,
        name: city.name,
        tagline: city.tagline || "",
        description: city.description || "",
        image: city.image || "",
        image_alt: city.imageAlt || "",
        venue_count_label: city.venueCountLabel || "",
        popular_types: city.popularTypes || [],
        status: "published",
        created_at: now,
        updated_at: now,
      }))
    );
    console.log(`[seed] ${catalogueCities.length} destinations`);
  }

  if ((await collections.posts.countDocuments({})) === 0) {
    const now = nowIso();
    await collections.posts.insertMany(
      cataloguePosts.map((post) => ({
        id: uid("pst_"),
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt || "",
        category: post.category || "Journal",
        author: post.author || "Venue On My Plate",
        published_on: isoDate(post.publishedOn),
        reading_minutes: post.readingMinutes || 5,
        image: post.image || "",
        image_alt: post.imageAlt || "",
        body: post.body || [],
        status: "published",
        created_at: now,
        updated_at: now,
      }))
    );
    console.log(`[seed] ${cataloguePosts.length} journal posts`);
  }
}

async function seedSiteContent() {
  if ((await collections.content_blocks.countDocuments({})) === 0) {
    const counters = new Map();
    const now = nowIso();
    await collections.content_blocks.insertMany(
      contentBlocks.map((block) => {
        const order = counters.get(block.section) || 0;
        counters.set(block.section, order + 10);
        return {
          id: uid("blk_"),
          section: block.section,
          block_key: block.blockKey || "",
          title: block.title || "",
          subtitle: block.subtitle || "",
          body: block.body || "",
          image: block.image || "",
          image_alt: block.imageAlt || "",
          link_label: block.linkLabel || "",
          link_href: block.linkHref || "",
          icon: block.icon || "",
          meta: block.meta || {},
          sort_order: order,
          status: "published",
          created_at: now,
          updated_at: now,
        };
      })
    );
    console.log("[seed] website content");
  }
}

export async function ensureSeed() {
  let created = false;

  if ((await collections.users.countDocuments({})) === 0) {
    const now = nowIso();
    await collections.users.insertOne({
      id: uid("usr_"),
      email: config.seedAdmin.email,
      name: config.seedAdmin.name,
      role: "admin",
      password_hash: hashPassword(config.seedAdmin.password),
      status: "active",
      created_at: now,
      last_login_at: null,
    });
    created = true;
    console.log(`[seed] admin ${config.seedAdmin.email}`);
  }

  await seedCatalogue();
  await seedSiteContent();

  if ((await collections.settings.countDocuments({})) === 0) {
    await saveSettings(SETTINGS_DEFAULTS);
  }

  return { created, email: config.seedAdmin.email };
}
