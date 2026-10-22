import "dotenv/config";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB || "vomp");
for (const destination of await db.collection("destinations").find({}).toArray()) {
  const total = await db.collection("venues").countDocuments({ city_slug: destination.slug, status: "published" });
  const venue = await db.collection("venues").findOne(
    { city_slug: destination.slug, status: "published", image: { $regex: "^https://" } },
    { sort: { featured: -1, sort_order: 1 } }
  );
  console.log(destination.slug, "venues", total, "image", destination.image?.slice(0, 48), "venueImage", venue?.image?.slice(0, 48));
}
await client.close();
