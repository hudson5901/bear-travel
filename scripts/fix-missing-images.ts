/**
 * Set default Unsplash images for experiences that have no hero_image_url.
 * Uses city-specific Japan travel photos from Unsplash.
 */
import Database from "better-sqlite3";
import { join } from "path";

const DB_PATH = join(process.cwd(), "data", "bear-tour.db");

// Curated Unsplash photo IDs for each city
const CITY_IMAGES: Record<string, string[]> = {
  tokyo: [
    "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80",
    "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&q=80",
    "https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=800&q=80",
    "https://images.unsplash.com/photo-1549693578-d683be217e58?w=800&q=80",
  ],
  kyoto: [
    "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80",
    "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800&q=80",
    "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80",
    "https://images.unsplash.com/photo-1558862107-d49ef2a04d72?w=800&q=80",
  ],
  osaka: [
    "https://images.unsplash.com/photo-1590559899731-a382839e5549?w=800&q=80",
    "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&q=80",
    "https://images.unsplash.com/photo-1623341214825-9f4f963727da?w=800&q=80",
  ],
  hiroshima: [
    "https://images.unsplash.com/photo-1576675466969-38eeae4b41f6?w=800&q=80",
    "https://images.unsplash.com/photo-1526481280693-3bfa7568e0f3?w=800&q=80",
  ],
  nara: [
    "https://images.unsplash.com/photo-1624601573012-1f796e69e5e0?w=800&q=80",
    "https://images.unsplash.com/photo-1590559899731-a382839e5549?w=800&q=80",
  ],
  hakone: [
    "https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?w=800&q=80",
    "https://images.unsplash.com/photo-1578271887552-5ac3a72752bc?w=800&q=80",
  ],
  nagano: [
    "https://images.unsplash.com/photo-1542640244-7e672d6cef4e?w=800&q=80",
    "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=800&q=80",
  ],
  hokkaido: [
    "https://images.unsplash.com/photo-1578271887552-5ac3a72752bc?w=800&q=80",
    "https://images.unsplash.com/photo-1542640244-7e672d6cef4e?w=800&q=80",
  ],
  okinawa: [
    "https://images.unsplash.com/photo-1590077428593-a55bb07c4665?w=800&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
  ],
  fukuoka: [
    "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80",
  ],
  kamakura: [
    "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80",
  ],
  nikko: [
    "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80",
  ],
  kanazawa: [
    "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800&q=80",
  ],
  yokohama: [
    "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&q=80",
  ],
  kobe: [
    "https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=800&q=80",
  ],
  niigata: [
    "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=800&q=80",
  ],
};

// Default Japan images for cities not in the list
const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1480796927426-f609979314bd?w=800&q=80",
  "https://images.unsplash.com/photo-1492571350019-22de08371fd3?w=800&q=80",
  "https://images.unsplash.com/photo-1528164344705-47542687000d?w=800&q=80",
  "https://images.unsplash.com/photo-1524413840807-0c3cb6fa808d?w=800&q=80",
];

function main() {
  console.log("=== Fixing missing experience images ===\n");

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");

  const rows = sqlite.prepare(`
    SELECT e.id, d.slug as dest_slug
    FROM experiences e
    LEFT JOIN destinations d ON d.id = e.destination_id
    WHERE e.status = 'published'
      AND (e.hero_image_url IS NULL OR e.hero_image_url = '')
  `).all() as { id: number; dest_slug: string | null }[];

  console.log(`Experiences missing images: ${rows.length}`);

  const update = sqlite.prepare("UPDATE experiences SET hero_image_url = ? WHERE id = ?");

  const updateAll = sqlite.transaction(() => {
    for (const row of rows) {
      const citySlug = row.dest_slug || "";
      const images = CITY_IMAGES[citySlug] || DEFAULT_IMAGES;
      const img = images[row.id % images.length];
      update.run(img, row.id);
    }
  });

  updateAll();

  // Verify
  const remaining = sqlite.prepare(
    "SELECT COUNT(*) as cnt FROM experiences WHERE status='published' AND (hero_image_url IS NULL OR hero_image_url = '')"
  ).get() as { cnt: number };

  console.log(`Fixed: ${rows.length}`);
  console.log(`Remaining without images: ${remaining.cnt}`);

  sqlite.close();
  console.log("\nDone!");
}

main();
