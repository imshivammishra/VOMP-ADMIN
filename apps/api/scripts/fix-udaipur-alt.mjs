import "dotenv/config";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
await client
  .db(process.env.MONGODB_DB || "vomp")
  .collection("destinations")
  .updateOne(
    { slug: "udaipur" },
    {
      $set: {
        image_alt: "Lake Palace reflecting on Lake Pichola, Udaipur",
        updated_at: new Date().toISOString(),
      },
    }
  );
console.log("udaipur alt fixed");
await client.close();
