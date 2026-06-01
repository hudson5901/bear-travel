/**
 * Import all JSON data into SQLite DB.
 * Reads experiences.json, destinations.json, themes.json
 * and populates all tables with proper relationships.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";
import * as schema from "../src/db/schema";

const DB_PATH = join(process.cwd(), "data", "bear-tour.db");
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

interface JsonExperience {
  id: string;
  slug: string;
  title: string;
  description: string;
  shortDescription: string;
  price: { amount: number; currency: string; display: string };
  duration: { hours: number; display: string };
  rating: { score: number; count: number };
  images: string[];
  thumbnail: string;
  location: { city: string; citySlug: string; region: string };
  categories: string[];
  themes: string[];
  highlights: string[];
  source: { platform: string; url: string; productId: string; lastScraped: string };
  bookingUrl: string;
  isPopular: boolean;
  isFeatured: boolean;
}

interface JsonDestination {
  slug: string;
  name: string;
  nameJa: string;
  region: string;
  description: string;
  image: string;
  experienceCount: number;
  imageCredit?: string;
}

interface JsonTheme {
  slug: string;
  name: string;
  icon: string;
  description: string;
  keywords: string[];
}

function loadJSON<T>(file: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), "data", file), "utf-8"));
}

function main() {
  console.log("🐻 Importing data to SQLite DB...\n");

  // Clear existing data
  sqlite.exec("DELETE FROM experience_themes");
  sqlite.exec("DELETE FROM experience_categories");
  sqlite.exec("DELETE FROM images");
  sqlite.exec("DELETE FROM reviews");
  sqlite.exec("DELETE FROM price_history");
  sqlite.exec("DELETE FROM listings");
  sqlite.exec("DELETE FROM experiences");
  sqlite.exec("DELETE FROM themes");
  sqlite.exec("DELETE FROM destinations");
  sqlite.exec("DELETE FROM platforms");
  console.log("  Cleared existing data");

  // 1. Insert platforms
  const platformData = [
    { name: "Viator", slug: "viator", displayName: "Viator (TripAdvisor)", baseUrl: "https://www.viator.com", apiType: "rest_api", commissionRate: 8.0 },
    { name: "GetYourGuide", slug: "getyourguide", displayName: "GetYourGuide", baseUrl: "https://www.getyourguide.com", apiType: "affiliate", commissionRate: 7.0 },
    { name: "Klook", slug: "klook", displayName: "Klook", baseUrl: "https://www.klook.com", apiType: "rest_api", commissionRate: 6.5 },
    { name: "KKday", slug: "kkday", displayName: "KKday", baseUrl: "https://www.kkday.com", apiType: "affiliate", commissionRate: 5.0 },
    { name: "Asoview", slug: "asoview", displayName: "アソビュー", baseUrl: "https://www.asoview.com", apiType: "scraper", commissionRate: 3.0 },
    { name: "Jalan", slug: "jalan", displayName: "じゃらん", baseUrl: "https://www.jalan.net", apiType: "scraper", commissionRate: 2.0 },
    { name: "Activity Japan", slug: "activityjapan", displayName: "アクティビティジャパン", baseUrl: "https://activityjapan.com", apiType: "rest_api", commissionRate: 5.0 },
  ];

  for (const p of platformData) {
    db.insert(schema.platforms).values({
      name: p.name,
      slug: p.slug,
      displayName: p.displayName,
      baseUrl: p.baseUrl,
      apiType: p.apiType,
      commissionRate: p.commissionRate,
      isActive: true,
    }).run();
  }
  console.log(`  Inserted ${platformData.length} platforms`);

  // Get platform ID map
  const platformRows = db.select().from(schema.platforms).all();
  const platformMap = new Map(platformRows.map((p) => [p.slug, p.id]));

  // 2. Insert destinations
  const destData = loadJSON<JsonDestination[]>("destinations.json");
  for (const d of destData) {
    db.insert(schema.destinations).values({
      name: d.name,
      nameJa: d.nameJa,
      slug: d.slug,
      level: "city",
      country: "Japan",
      region: d.region,
      description: d.description,
      heroImageUrl: d.image,
      imageCredit: d.imageCredit || null,
      experienceCount: 0,
    }).run();
  }
  console.log(`  Inserted ${destData.length} destinations`);

  // Get destination ID map
  const destRows = db.select().from(schema.destinations).all();
  const destMap = new Map(destRows.map((d) => [d.slug, d.id]));

  // 3. Insert themes
  const themeData = loadJSON<JsonTheme[]>("themes.json");
  for (const t of themeData) {
    db.insert(schema.themes).values({
      name: t.name,
      slug: t.slug,
      description: t.description,
      icon: t.icon,
      keywords: JSON.stringify(t.keywords),
      experienceCount: 0,
    }).run();
  }
  console.log(`  Inserted ${themeData.length} themes`);

  // Get theme ID map
  const themeRows = db.select().from(schema.themes).all();
  const themeMap = new Map(themeRows.map((t) => [t.slug, t.id]));

  // 4. Insert experiences + listings + images
  const expData = loadJSON<JsonExperience[]>("experiences.json");
  let expCount = 0;
  let listingCount = 0;
  let imageCount = 0;
  let linkCount = 0;

  for (const exp of expData) {
    const destId = destMap.get(exp.location.citySlug);
    if (!destId) {
      console.warn(`  ⚠️ No destination for ${exp.location.citySlug}, skipping ${exp.title}`);
      continue;
    }

    const platformSlug = exp.source.platform;
    const platformId = platformMap.get(platformSlug);
    if (!platformId) {
      console.warn(`  ⚠️ No platform for ${platformSlug}, skipping`);
      continue;
    }

    // Insert experience
    const result = db.insert(schema.experiences).values({
      slug: exp.slug,
      title: exp.title,
      description: exp.description,
      shortDescription: exp.shortDescription,
      destinationId: destId,
      durationMinutes: Math.round(exp.duration.hours * 60),
      durationText: exp.duration.display,
      highlights: JSON.stringify(exp.highlights),
      minPrice: exp.price.amount,
      maxPrice: exp.price.amount,
      currency: exp.price.currency,
      priceDisplay: exp.price.display,
      avgRating: exp.rating.score,
      totalReviewCount: exp.rating.count,
      listingCount: 1,
      platformNames: JSON.stringify([platformData.find((p) => p.slug === platformSlug)?.name || platformSlug]),
      platformSlugs: JSON.stringify([platformSlug]),
      heroImageUrl: exp.thumbnail || null,
      heroImageAlt: exp.title,
      status: "published",
      isPopular: exp.isPopular,
      isFeatured: exp.isFeatured,
      popularityScore: exp.rating.count,
    }).run();

    const experienceId = Number(result.lastInsertRowid);
    expCount++;

    // Insert listing
    db.insert(schema.listings).values({
      experienceId,
      platformId,
      externalId: exp.source.productId || exp.slug,
      externalUrl: exp.source.url,
      affiliateUrl: exp.bookingUrl,
      title: exp.title,
      description: exp.description,
      price: exp.price.amount,
      currency: exp.price.currency,
      priceType: "per_person",
      rating: exp.rating.score,
      reviewCount: exp.rating.count,
      thumbnailUrl: exp.thumbnail || null,
      images: JSON.stringify(exp.images),
      lastScrapedAt: exp.source.lastScraped,
      scrapeStatus: "success",
      isActive: true,
    }).run();
    listingCount++;

    // Insert images
    for (let i = 0; i < exp.images.length; i++) {
      const imgUrl = exp.images[i];
      if (!imgUrl) continue;
      db.insert(schema.images).values({
        experienceId,
        url: imgUrl,
        altText: exp.title,
        sourcePlatformId: platformId,
        displayOrder: i,
        isHero: i === 0,
        imageType: "tour",
      }).run();
      imageCount++;
    }

    // Insert experience_themes
    for (const themeSlug of exp.themes) {
      const themeId = themeMap.get(themeSlug);
      if (themeId) {
        db.insert(schema.experienceThemes).values({
          experienceId,
          themeId,
        }).run();
        linkCount++;
      }
    }
  }

  // 5. Update destination experience counts
  for (const [slug, destId] of destMap) {
    const count = db
      .select()
      .from(schema.experiences)
      .where((eb) => {
        const { eq } = require("drizzle-orm");
        return eq(schema.experiences.destinationId, destId);
      })
      .all().length;

    sqlite.prepare("UPDATE destinations SET experience_count = ? WHERE id = ?").run(count, destId);
  }

  // 6. Update theme experience counts
  for (const [slug, themeId] of themeMap) {
    const count = sqlite
      .prepare("SELECT COUNT(*) as cnt FROM experience_themes WHERE theme_id = ?")
      .get(themeId) as { cnt: number };
    sqlite.prepare("UPDATE themes SET experience_count = ? WHERE id = ?").run(count.cnt, themeId);
  }

  console.log(`\n✅ Import complete!`);
  console.log(`  Experiences: ${expCount}`);
  console.log(`  Listings: ${listingCount}`);
  console.log(`  Images: ${imageCount}`);
  console.log(`  Theme links: ${linkCount}`);

  // Print stats
  const totalExp = sqlite.prepare("SELECT COUNT(*) as cnt FROM experiences").get() as { cnt: number };
  const totalList = sqlite.prepare("SELECT COUNT(*) as cnt FROM listings").get() as { cnt: number };
  const totalImg = sqlite.prepare("SELECT COUNT(*) as cnt FROM images").get() as { cnt: number };

  console.log(`\n📊 DB Stats:`);
  console.log(`  Total experiences: ${totalExp.cnt}`);
  console.log(`  Total listings: ${totalList.cnt}`);
  console.log(`  Total images: ${totalImg.cnt}`);

  // Experiences per city
  const byCityRows = sqlite
    .prepare(
      "SELECT d.name, COUNT(e.id) as cnt FROM experiences e JOIN destinations d ON d.id = e.destination_id GROUP BY d.name ORDER BY cnt DESC"
    )
    .all() as { name: string; cnt: number }[];
  console.log(`\n  By city:`);
  byCityRows.forEach((r) => console.log(`    ${r.name}: ${r.cnt}`));

  // Experiences per platform
  const byPlatRows = sqlite
    .prepare(
      "SELECT p.name, COUNT(l.id) as cnt FROM listings l JOIN platforms p ON p.id = l.platform_id GROUP BY p.name ORDER BY cnt DESC"
    )
    .all() as { name: string; cnt: number }[];
  console.log(`\n  By platform:`);
  byPlatRows.forEach((r) => console.log(`    ${r.name}: ${r.cnt}`));

  const dbSize = sqlite.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get() as { size: number };
  console.log(`\n  DB file size: ${(dbSize.size / 1024).toFixed(1)} KB`);

  sqlite.close();
}

main();
