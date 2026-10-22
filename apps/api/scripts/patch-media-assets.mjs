import "dotenv/config";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB || "vomp");

const contentUpdates = [
  {
    section: "hero",
    block_key: "video",
    set: {
      title: "/videos/hero-bg.mp4",
      image: "/images/hero-poster.jpg",
      image_alt: "Celebration venue in India",
    },
  },
  {
    section: "hero",
    block_key: "slide-1",
    set: { image: "/images/indian-ceremony.jpg" },
  },
  {
    section: "hero",
    block_key: "slide-3",
    set: { image: "/images/wedding-decor.jpg" },
  },
  {
    section: "about",
    block_key: "about-main",
    set: {
      image: "/images/wedding-decor.jpg",
      image_alt: "Wedding reception decor with florals and warm lighting",
    },
  },
  {
    section: "film",
    block_key: "signature-band",
    set: {
      image: "/videos/hero-bg.mp4",
      meta: { placement: "band", poster: "/images/hero-poster.jpg" },
    },
  },
  {
    section: "gallery",
    title: "Grand celebrations",
    set: { image: "/images/indian-ceremony.jpg" },
  },
  {
    section: "gallery",
    title: "Palace weddings",
    set: { image: "/images/udaipur-palace2.jpg" },
  },
  {
    section: "gallery",
    title: "Floral tablescapes",
    set: { image: "/images/wedding-decor.jpg" },
  },
  {
    section: "gallery",
    title: "Open-air mandaps",
    set: { image: "/images/wedding-dance.jpg" },
  },
  {
    section: "film",
    title: "Haldi mornings",
    set: { image: "/videos/hero-bg.mp4" },
  },
  {
    section: "film",
    title: "Floral details",
    set: { image: "/images/indian-ceremony.jpg" },
  },
  {
    section: "film",
    title: "First looks",
    set: { image: "/images/wedding-decor.jpg" },
  },
  {
    section: "film",
    title: "Aisle walks",
    set: { image: "/images/wedding-dance.jpg" },
  },
];

let contentChanged = 0;
for (const update of contentUpdates) {
  const filter = { section: update.section };
  if (update.block_key) filter.block_key = update.block_key;
  if (update.title) filter.title = update.title;
  const result = await db.collection("content_blocks").updateMany(filter, {
    $set: { ...update.set, updated_at: new Date().toISOString() },
  });
  contentChanged += result.modifiedCount;
}

const destinations = await db.collection("destinations").find({}).toArray();
let destinationsChanged = 0;
for (const destination of destinations) {
  if (destination.image?.startsWith("/")) continue;
  const venue = await db.collection("venues").findOne(
    { city_slug: destination.slug, status: "published", image: { $regex: "^https://" } },
    { sort: { featured: -1, sort_order: 1 } }
  );
  if (!venue?.image) continue;
  await db.collection("destinations").updateOne(
    { _id: destination._id },
    { $set: { image: venue.image, updated_at: new Date().toISOString() } }
  );
  destinationsChanged += 1;
}

console.log({ contentChanged, destinationsChanged });
await client.close();
