import "dotenv/config";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB || "vomp");

const types = {
  udaipur: ["Lake Palace", "Heritage Haveli", "Garden Resort", "City Hotel"],
  jaipur: ["Fort Venue", "Garden Resort", "City Palace", "Hotel"],
  jodhpur: ["Palace", "Heritage Haveli", "Courtyard Venue", "Resort"],
  jaisalmer: ["Fort Palace", "Desert Resort", "Heritage Haveli", "Luxury Camp"],
  goa: ["Beach Resort", "Private Villa", "Cliff-top Lawn", "Hotel"],
  "sawai-madhopur": ["Jungle Resort", "Heritage Palace", "Nature Lawn", "Luxury Camp"],
};

for (const destination of await db.collection("destinations").find({ status: "published" }).toArray()) {
  const venue = await db.collection("venues").findOne(
    { city_slug: destination.slug, status: "published", image: { $regex: "^https://" } },
    { sort: { featured: -1, sort_order: 1 } }
  );
  const alt = venue?.name
    ? `${venue.name} — wedding venue in ${destination.name}`
    : `${destination.name} wedding venue`;
  const update = {
    $set: {
      image_alt: alt,
      popular_types: types[destination.slug] || destination.popular_types || [],
      venue_count_label: "Curated venue selection",
      updated_at: new Date().toISOString(),
    },
    $unset: { imageAlt: "", popularTypes: "" },
  };
  if (venue?.image && !destination.image?.startsWith("/")) {
    update.$set.image = venue.image;
  }
  await db.collection("destinations").updateOne({ _id: destination._id }, update);
}

const final = await db
  .collection("destinations")
  .find(
    { status: "published" },
    { projection: { _id: 0, slug: 1, name: 1, image: 1, image_alt: 1, popular_types: 1 } }
  )
  .sort({ name: 1 })
  .toArray();
console.log(JSON.stringify(final, null, 2));
await client.close();
