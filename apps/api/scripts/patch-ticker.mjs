import "dotenv/config";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB || "vomp");
const blocks = await db
  .collection("content_blocks")
  .find({ section: "ticker" })
  .sort({ sort_order: 1, block_key: 1 })
  .toArray();

console.log(
  "before",
  blocks.map((b) => ({ key: b.block_key, title: b.title, order: b.sort_order }))
);

const ribbon = ["Mehendi", "Haldi", "Sangeet", "Saat Pheras", "Reception", "Baraat"];
for (let i = 0; i < Math.min(blocks.length, ribbon.length); i += 1) {
  await db.collection("content_blocks").updateOne(
    { _id: blocks[i]._id },
    { $set: { title: ribbon[i], updated_at: new Date().toISOString() } }
  );
}
console.log("updated", ribbon);
await client.close();
