import "dotenv/config";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB || "vomp");

const films = [
  { title: "Haldi mornings", image: "/videos/film-haldi.mp4", startAt: "0", poster: "/images/indian-ceremony.jpg" },
  { title: "Floral details", image: "/videos/film-floral.mp4", startAt: "0", poster: "/images/wedding-decor.jpg" },
  { title: "First looks", image: "/videos/film-first-look.mp4", startAt: "0", poster: "/images/wedding-dance.jpg" },
  { title: "Aisle walks", image: "/videos/hero-bg.mp4", startAt: "21", poster: "/images/wedding-dance.jpg" },
];

for (const film of films) {
  const result = await db.collection("content_blocks").updateOne(
    { section: "film", title: film.title },
    {
      $set: {
        image: film.image,
        meta: { startAt: film.startAt, poster: film.poster },
        updated_at: new Date().toISOString(),
      },
    }
  );
  console.log(film.title, result.matchedCount, result.modifiedCount);
}

await client.close();
