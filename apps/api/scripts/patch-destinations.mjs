import "dotenv/config";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB || "vomp");

const replacements = {
  "delhi-ncr": {
    slug: "jaisalmer",
    name: "Jaisalmer",
    tagline: "Golden sandstone, desert forts and dune-side evenings.",
    description:
      "Jaisalmer pairs honey-coloured forts with desert resorts and open dune lawns. It suits winter weddings, intimate heritage stays and celebrations that want a dramatic golden-hour backdrop.",
    imageAlt: "Golden sandstone fort and desert venue in Jaisalmer",
    popularTypes: ["Fort Palace", "Desert Resort", "Heritage Haveli", "Luxury Camp"],
  },
  mumbai: {
    slug: "jodhpur",
    name: "Jodhpur",
    tagline: "Blue-city rooftops beneath Mehrangarh.",
    description:
      "Jodhpur brings Mehrangarh views, blue-city rooftops and palace courtyards together. It is a strong choice for royal-themed weddings, mehendi lunches and intimate receptions.",
    imageAlt: "Palace venue beneath Mehrangarh in Jodhpur",
    popularTypes: ["Palace", "Heritage Haveli", "Courtyard Venue", "Resort"],
  },
  bangalore: {
    slug: "sawai-madhopur",
    name: "Sawai Madhopur",
    tagline: "Jungle-edge resorts and royal Ranthambore.",
    description:
      "Sawai Madhopur combines Ranthambore wilderness with palace stays and nature-facing lawns. It works beautifully for multi-day celebrations where guests want a safari and a slower rhythm.",
    imageAlt: "Jungle resort and heritage venue near Ranthambore",
    popularTypes: ["Jungle Resort", "Heritage Palace", "Nature Lawn", "Luxury Camp"],
  },
};

for (const [oldSlug, next] of Object.entries(replacements)) {
  const venue = await db.collection("venues").findOne(
    { city_slug: next.slug, status: "published", image: { $regex: "^https://" } },
    { sort: { featured: -1, sort_order: 1 } }
  );
  await db.collection("destinations").updateOne(
    { slug: oldSlug },
    {
      $set: {
        ...next,
        image: venue?.image || "/images/udaipur-palace2.jpg",
        venue_count_label: "Curated venue selection",
        status: "published",
        updated_at: new Date().toISOString(),
      },
    }
  );
  console.log(`${oldSlug} -> ${next.slug}`, Boolean(venue?.image));
}

for (const destination of await db.collection("destinations").find({ status: "published" }).toArray()) {
  if (destination.image?.startsWith("/")) continue;
  const venue = await db.collection("venues").findOne(
    { city_slug: destination.slug, status: "published", image: { $regex: "^https://" } },
    { sort: { featured: -1, sort_order: 1 } }
  );
  if (!venue?.image) {
    console.log(`${destination.slug}: no venue image, using local fallback`);
    await db.collection("destinations").updateOne(
      { _id: destination._id },
      { $set: { image: "/images/udaipur-palace2.jpg", updated_at: new Date().toISOString() } }
    );
    continue;
  }
  await db.collection("destinations").updateOne(
    { _id: destination._id },
    { $set: { image: venue.image, updated_at: new Date().toISOString() } }
  );
}

const final = await db
  .collection("destinations")
  .find({ status: "published" }, { projection: { _id: 0, slug: 1, name: 1, image: 1 } })
  .sort({ name: 1 })
  .toArray();
console.log(JSON.stringify(final, null, 2));
await client.close();
