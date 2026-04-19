import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

const elder = await sql`SELECT id FROM members WHERE role = 'elder' LIMIT 1`;
if (!elder.length) {
  console.error("No elder found");
  process.exit(1);
}

const elderId = elder[0].id;

const [album] = await sql`
  INSERT INTO albums (title, description, created_by)
  VALUES ('Verification Album', 'Photos for the lightbox E2E test', ${elderId})
  RETURNING id
`;

const photos = [
  {
    url: "https://picsum.photos/seed/hoa1/1200/800",
    thumb: "https://picsum.photos/seed/hoa1/400/400",
    caption: "Sunlit courtyard",
  },
  {
    url: "https://picsum.photos/seed/hoa2/1200/800",
    thumb: "https://picsum.photos/seed/hoa2/400/400",
    caption: "Afternoon walk",
  },
  {
    url: "https://picsum.photos/seed/hoa3/1200/800",
    thumb: "https://picsum.photos/seed/hoa3/400/400",
    caption: null,
  },
];

for (const [i, p] of photos.entries()) {
  await sql`
    INSERT INTO photos (album_id, uploaded_by, url, thumbnail_url, caption, sort_order)
    VALUES (${album.id}, ${elderId}, ${p.url}, ${p.thumb}, ${p.caption}, ${i})
  `;
}

console.log(`Album: ${album.id} (${photos.length} photos)`);

await sql.end();
