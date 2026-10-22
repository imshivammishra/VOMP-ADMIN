import "dotenv/config";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB || "vomp");
const body =
  "Venue On My Plate helps you discover venues for weddings, receptions, birthdays, corporate events and private celebrations across India — from heritage palaces in Udaipur and garden resorts in Jaipur to desert forts in Jaisalmer, palace courtyards in Jodhpur and beach venues in Goa.\n\nWe focus only on venues — not decor, catering, or photography. Our team helps you compare venue flow, ceremony zones, guest movement, rooms and private quote options, so haldi mornings, sangeet evenings and the wedding day itself start from the right venue choice.\n\nStart by browsing all venues or pick a destination such as Udaipur, Jaipur, Jodhpur or Goa. Want ideas first? The journal covers costs, seasonality and visit checklists.";
await db.collection("content_blocks").updateOne(
  { section: "seo", block_key: "home-seo" },
  { $set: { body, updated_at: new Date().toISOString() } }
);
console.log("home SEO copy updated");
await client.close();
