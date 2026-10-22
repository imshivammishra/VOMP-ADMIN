import "dotenv/config";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB || "vomp");
const rows = await db
  .collection("venues")
  .aggregate([
    { $match: { status: "published" } },
    { $group: { _id: "$city_slug", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ])
  .toArray();
console.log(JSON.stringify(rows));
await client.close();
