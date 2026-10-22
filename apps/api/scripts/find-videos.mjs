import "dotenv/config";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB || "vomp");
const urls = new Set();
for (const coll of ["content_blocks", "venues", "destinations"]) {
  const docs = await db.collection(coll).find({}).toArray();
  for (const doc of docs) {
    const text = JSON.stringify(doc);
    for (const match of text.matchAll(/https?:\/\/[^"\\]+\.(?:mp4|webm|mov)(?:\?[^"\\]*)?/gi)) urls.add(match[0]);
  }
}
console.log([...urls]);
await client.close();
