/**
 * Fetch high-quality city images from Unsplash for destination hero images.
 * Uses the Unsplash API (free: 50 requests/hour).
 *
 * Setup: Set UNSPLASH_ACCESS_KEY env variable.
 * Run: UNSPLASH_ACCESS_KEY=xxx npx tsx scripts/fetch-unsplash-images.ts
 */

import { writeFileSync, readFileSync } from "fs";
import { join } from "path";

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string; // 1080px wide
    small: string;
    thumb: string;
  };
  alt_description: string | null;
  description: string | null;
  user: {
    name: string;
    username: string;
    links: { html: string };
  };
  links: {
    html: string; // required for attribution
  };
  likes: number;
}

const CITY_QUERIES = [
  { slug: "tokyo", query: "Tokyo Japan cityscape" },
  { slug: "kyoto", query: "Kyoto temple Japan" },
  { slug: "osaka", query: "Osaka castle Japan" },
  { slug: "hiroshima", query: "Hiroshima Japan peace" },
  { slug: "nara", query: "Nara deer Japan" },
  { slug: "hakone", query: "Hakone Mount Fuji Japan" },
];

async function searchUnsplash(query: string): Promise<UnsplashPhoto | null> {
  if (!UNSPLASH_ACCESS_KEY) {
    console.error("❌ UNSPLASH_ACCESS_KEY not set");
    return null;
  }

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("order_by", "relevant");
  url.searchParams.set("orientation", "landscape");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
  });

  if (!res.ok) {
    console.error(`  API error: ${res.status} ${res.statusText}`);
    return null;
  }

  const data = await res.json();
  return data.results?.[0] || null;
}

async function main() {
  console.log("🐻 Fetching city images from Unsplash...\n");

  if (!UNSPLASH_ACCESS_KEY) {
    console.log("⚠️  No UNSPLASH_ACCESS_KEY set. Using placeholder image URLs.\n");
    console.log("To get real images:");
    console.log("1. Sign up at https://unsplash.com/developers");
    console.log("2. Create an app to get an access key");
    console.log("3. Run: UNSPLASH_ACCESS_KEY=your_key npx tsx scripts/fetch-unsplash-images.ts\n");

    // Use reliable Unsplash source URLs (no API key needed for these)
    const fallbackImages = [
      { slug: "tokyo", url: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&q=80", photographer: "Jezael Melgoza" },
      { slug: "kyoto", url: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&q=80", photographer: "Su San Lee" },
      { slug: "osaka", url: "https://images.unsplash.com/photo-1590559899731-a382839e5549?w=1200&q=80", photographer: "Atul Vinayak" },
      { slug: "hiroshima", url: "https://images.unsplash.com/photo-1576675784201-0e142b423952?w=1200&q=80", photographer: "Unsplash" },
      { slug: "nara", url: "https://images.unsplash.com/photo-1624601573012-efb68931cc8f?w=1200&q=80", photographer: "Unsplash" },
      { slug: "hakone", url: "https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?w=1200&q=80", photographer: "David Edelstein" },
    ];

    // Update destinations.json
    const destPath = join(process.cwd(), "data", "destinations.json");
    const destinations = JSON.parse(readFileSync(destPath, "utf-8"));

    for (const img of fallbackImages) {
      const dest = destinations.find((d: { slug: string }) => d.slug === img.slug);
      if (dest) {
        dest.image = img.url;
        dest.imageCredit = img.photographer;
        console.log(`  ✅ ${img.slug}: ${img.url.slice(0, 60)}...`);
      }
    }

    writeFileSync(destPath, JSON.stringify(destinations, null, 2));
    console.log("\n💾 Updated data/destinations.json with Unsplash image URLs");
    return;
  }

  const destPath = join(process.cwd(), "data", "destinations.json");
  const destinations = JSON.parse(readFileSync(destPath, "utf-8"));

  for (const city of CITY_QUERIES) {
    console.log(`📍 Searching: "${city.query}"`);
    const photo = await searchUnsplash(city.query);

    if (photo) {
      const dest = destinations.find((d: { slug: string }) => d.slug === city.slug);
      if (dest) {
        dest.image = photo.urls.regular;
        dest.imageCredit = photo.user.name;
        dest.imageUrl = photo.links.html;
        console.log(`  ✅ Found: ${photo.alt_description || "photo"} by ${photo.user.name}`);
      }
    } else {
      console.log(`  ❌ No results`);
    }

    // Rate limit: wait between requests
    await new Promise((r) => setTimeout(r, 1000));
  }

  writeFileSync(destPath, JSON.stringify(destinations, null, 2));
  console.log("\n💾 Updated data/destinations.json with Unsplash image URLs");
}

main().catch(console.error);
