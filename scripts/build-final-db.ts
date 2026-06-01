/**
 * Build final DB from all scraped sources
 * Combines: Asoview Deep (180) + Jalan Deep (535)
 * Cleans data, deduplicates, and imports into SQLite
 */
import Database from "better-sqlite3";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const DB_PATH = join(process.cwd(), "data", "bear-tour.db");
const DATA_DIR = join(process.cwd(), "data");

interface CleanExperience {
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

const CITY_MAP: Record<string, { slug: string; region: string }> = {
  "Tokyo": { slug: "tokyo", region: "Kanto" },
  "Kyoto": { slug: "kyoto", region: "Kansai" },
  "Osaka": { slug: "osaka", region: "Kansai" },
  "Hiroshima": { slug: "hiroshima", region: "Chugoku" },
  "Nara": { slug: "nara", region: "Kansai" },
  "Hakone": { slug: "hakone", region: "Kanto" },
};

// Theme detection keywords
const THEME_KEYWORDS: Record<string, string[]> = {
  "cultural": ["着物", "茶道", "書道", "華道", "伝統", "神社", "寺", "文化", "和", "kimono", "temple", "shrine", "traditional", "culture", "ceremony"],
  "food-drink": ["料理", "食べ", "グルメ", "ランチ", "ディナー", "ビュッフェ", "寿司", "ラーメン", "食", "cooking", "food", "sushi", "ramen", "buffet", "restaurant", "cafe"],
  "crafts": ["陶芸", "ガラス", "アクセサリー", "ものづくり", "手作り", "工芸", "キャンドル", "レジン", "pottery", "glass", "craft", "handmade", "workshop", "candle", "silver"],
  "nature": ["自然", "庭園", "花", "山", "川", "海", "アウトドア", "サイクリング", "nature", "garden", "mountain", "river", "outdoor", "cycling", "hiking"],
  "adventure": ["アドベンチャー", "スポーツ", "ダイビング", "サーフィン", "カヤック", "ラフティング", "adventure", "sport", "diving", "surfing", "kayak"],
  "wellness": ["温泉", "スパ", "リラクゼーション", "ヨガ", "瞑想", "spa", "onsen", "wellness", "yoga", "relaxation", "massage"],
};

function detectThemes(title: string, category: string): string[] {
  const themes: string[] = [];
  const text = `${title} ${category}`.toLowerCase();

  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
      themes.push(theme);
    }
  }

  return themes.length > 0 ? themes : ["cultural"]; // default
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).slice(0, 6);
}

function slugify(text: string): string {
  const clean = text
    .replace(/【[^】]*】/g, "")
    .replace(/[^\\w\\s\\u3000-\\u9fff-]/g, "")
    .trim()
    .slice(0, 60);
  const ascii = clean
    .replace(/[\\u3000-\\u9fff]+/g, "-")
    .replace(/\\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return ascii || `exp-${simpleHash(text)}`;
}

function fixImageUrl(url: string): string {
  if (!url) return "";
  // Fix: https://www.jalan.net/cdn.jalan.jp/... -> https://cdn.jalan.jp/...
  url = url.replace("https://www.jalan.net/cdn.jalan.jp/", "https://cdn.jalan.jp/");
  url = url.replace("https://www.jalan.net//cdn.jalan.jp/", "https://cdn.jalan.jp/");
  // Fix double-domain activityboard URLs
  url = url.replace("https://www.jalan.net/https://cdn.activityboard.jp/", "https://cdn.activityboard.jp/");
  return url;
}

// JPY/USD rate - update periodically
const JPY_USD_RATE = 150;

function parseJPYtoUSD(priceStr: string): number {
  const match = priceStr.match(/(\d{1,3}(?:,\d{3})*)/);
  if (!match) return 0;
  const jpy = parseInt(match[1].replace(/,/g, ""));
  return Math.round(jpy / JPY_USD_RATE);
}

function processAsoview(): CleanExperience[] {
  const filePath = join(DATA_DIR, "asoview-deep.json");
  if (!existsSync(filePath)) {
    console.log("  ⚠️ asoview-deep.json not found");
    return [];
  }

  const raw = JSON.parse(readFileSync(filePath, "utf-8")) as Array<{
    title: string;
    url: string;
    image: string;
    priceText: string;
    reviewText: string;
    location: { city: string; citySlug: string; region: string };
    id: string;
    slug: string;
    price: { amount: number; currency: string; display: string };
    rating: { score: number; count: number };
    source: { platform: string; url: string; productId: string; lastScraped: string };
    bookingUrl: string;
    isPopular: boolean;
  }>;

  console.log(`  Asoview raw: ${raw.length} items`);

  return raw.map((item) => {
    const city = item.location?.city || "Tokyo";
    const cityInfo = CITY_MAP[city] || CITY_MAP["Tokyo"];

    return {
      id: item.id || `asoview-${cityInfo.slug}-${simpleHash(item.title + item.url)}`,
      slug: item.slug || `${cityInfo.slug}-${slugify(item.title)}`,
      title: item.title,
      description: "",
      shortDescription: "",
      price: item.price || { amount: 25, currency: "USD", display: "$25" },
      duration: { hours: 0, display: "" },
      rating: item.rating || { score: 4.2, count: 0 },
      images: item.image ? [item.image] : (item as any).images || [],
      thumbnail: item.image || (item as any).thumbnail || "",
      location: item.location || { city, citySlug: cityInfo.slug, region: cityInfo.region },
      categories: [],
      themes: detectThemes(item.title, ""),
      highlights: [],
      source: item.source || {
        platform: "asoview",
        url: item.url || item.bookingUrl || "",
        productId: item.id || "",
        lastScraped: new Date().toISOString(),
      },
      bookingUrl: item.bookingUrl || item.url || (item.source?.url) || "",
      isPopular: item.isPopular || false,
      isFeatured: false,
    };
  }).filter(e => e.thumbnail && !e.thumbnail.includes("dummy") && !e.thumbnail.includes("spacer"));
}

function processJalan(): CleanExperience[] {
  // Use jalan-v2 if available (better data), fallback to jalan-deep
  const v2Path = join(DATA_DIR, "jalan-v2.json");
  const deepPath = join(DATA_DIR, "jalan-deep.json");
  const filePath = existsSync(v2Path) ? v2Path : deepPath;
  if (!existsSync(filePath)) {
    console.log("  ⚠️ No jalan data found");
    return [];
  }
  console.log(`  Using: ${filePath.split("/").pop()}`);

  const raw = JSON.parse(readFileSync(filePath, "utf-8")) as Array<{
    title: string;
    url: string;
    image: string;
    price: string;
    priceNum: number;
    rating: string;
    reviewCount: string;
    city: string;
    category: string;
    shopName: string;
  }>;

  console.log(`  Jalan raw: ${raw.length} items`);

  // Filter out items with bad images
  const filtered = raw.filter(item => {
    if (!item.image) return false;
    if (item.image.includes("dummy") || item.image.includes("spacer") || item.image.includes("blank")) return false;
    if (item.image.includes("lazyload")) return false;
    if (!item.title || item.title.length < 5) return false;
    // Filter out generic category-like items
    if (item.title === "バイキング・ビュッフェ・ホテルレストラン") return false;
    return true;
  });

  console.log(`  Jalan after filter: ${filtered.length} items`);

  // Deduplicate - remove very similar items from same shop
  const seenKeys = new Set<string>();
  const deduped = filtered.filter(item => {
    // Create a dedup key from normalized title (first 30 chars, no special chars)
    const normalizedTitle = item.title
      .replace(/【[^】]*】/g, "")
      .replace(/♪|★|☆|◆|■|●|▲|▼|※.*/g, "")
      .replace(/\s+/g, "")
      .slice(0, 30);
    const key = `${item.city}-${normalizedTitle}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  console.log(`  Jalan after dedup: ${deduped.length} items`);

  return deduped.map((item) => {
    const city = item.city || "Tokyo";
    const cityInfo = CITY_MAP[city] || CITY_MAP["Tokyo"];
    const priceUSD = item.priceNum > 0 ? Math.round(item.priceNum / JPY_USD_RATE) : 20;
    const rating = item.rating ? parseFloat(item.rating) : 4.0;
    const reviews = item.reviewCount ? parseInt(item.reviewCount) : 0;

    // Fix double-path URLs
    let fixedUrl = item.url;
    if (fixedUrl.includes("jalan.net//www.jalan.net")) {
      fixedUrl = fixedUrl.replace("https://www.jalan.net//www.jalan.net", "https://www.jalan.net");
    }

    // Clean title
    const cleanTitle = item.title
      .replace(/【[^】]*】/g, "")
      .replace(/♪|★|☆|◆|■|●|▲|▼|※.*/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return {
      id: `jalan-${cityInfo.slug}-${simpleHash(item.title + item.url)}`,
      slug: `${cityInfo.slug}-${slugify(cleanTitle)}`,
      title: cleanTitle,
      description: "",
      shortDescription: "",
      price: {
        amount: priceUSD || 20,
        currency: "USD",
        display: `$${priceUSD || 20}`,
      },
      duration: { hours: 0, display: "" },
      rating: {
        score: rating || 4.0,
        count: reviews,
      },
      images: [fixImageUrl(item.image)],
      thumbnail: fixImageUrl(item.image),
      location: {
        city,
        citySlug: cityInfo.slug,
        region: cityInfo.region,
      },
      categories: [item.category],
      themes: detectThemes(cleanTitle, item.category),
      highlights: [],
      source: {
        platform: "jalan",
        url: fixedUrl,
        productId: fixedUrl.split("/").filter(Boolean).pop() || "",
        lastScraped: new Date().toISOString(),
      },
      bookingUrl: fixedUrl,
      isPopular: reviews > 20,
      isFeatured: false,
    };
  });
}

function main() {
  console.log("🐻 Building final database from all sources\n");

  // Process all sources
  console.log("📥 Processing Asoview...");
  const asoviewExps = processAsoview();
  console.log(`  ✓ ${asoviewExps.length} clean experiences\n`);

  console.log("📥 Processing Jalan...");
  const jalanExps = processJalan();
  console.log(`  ✓ ${jalanExps.length} clean experiences\n`);

  // Combine all
  const allExperiences = [...asoviewExps, ...jalanExps];
  console.log(`📊 Total experiences: ${allExperiences.length}`);

  // Save merged JSON
  const mergedPath = join(DATA_DIR, "experiences.json");
  writeFileSync(mergedPath, JSON.stringify(allExperiences, null, 2));
  console.log(`💾 Saved merged JSON: ${mergedPath}`);

  // Stats
  const byCity: Record<string, number> = {};
  const byPlatform: Record<string, number> = {};
  allExperiences.forEach(e => {
    byCity[e.location.city] = (byCity[e.location.city] || 0) + 1;
    byPlatform[e.source.platform] = (byPlatform[e.source.platform] || 0) + 1;
  });

  console.log("\n  By city:");
  Object.entries(byCity).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`    ${k}: ${v}`));
  console.log("\n  By platform:");
  Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`    ${k}: ${v}`));

  // Mark some as featured (high rating + high reviews)
  const featured = allExperiences
    .filter(e => e.rating.count > 10 && e.rating.score >= 4.0)
    .sort((a, b) => b.rating.count - a.rating.count)
    .slice(0, 12);
  featured.forEach(e => { e.isFeatured = true; });
  console.log(`\n  Featured: ${featured.length} experiences`);

  // Re-save with featured flags
  writeFileSync(mergedPath, JSON.stringify(allExperiences, null, 2));

  // Now import to DB
  console.log("\n\n🗄️  Importing to SQLite...");
  importToDb(allExperiences);
}

function importToDb(experiences: CleanExperience[]) {
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // Clear existing data
  sqlite.exec("DELETE FROM experience_themes");
  sqlite.exec("DELETE FROM experience_categories");
  sqlite.exec("DELETE FROM images");
  sqlite.exec("DELETE FROM reviews");
  sqlite.exec("DELETE FROM price_history");
  sqlite.exec("DELETE FROM listings");
  sqlite.exec("DELETE FROM experiences");
  console.log("  Cleared existing data");

  // Ensure platforms exist
  const existingPlatforms = sqlite.prepare("SELECT slug FROM platforms").all() as { slug: string }[];
  const platformSlugs = new Set(existingPlatforms.map(p => p.slug));

  if (!platformSlugs.has("asoview")) {
    sqlite.prepare("INSERT INTO platforms (name, slug, display_name, base_url, api_type, commission_rate, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)")
      .run("Asoview", "asoview", "アソビュー", "https://www.asoview.com", "scraper", 3.0);
  }
  if (!platformSlugs.has("jalan")) {
    sqlite.prepare("INSERT INTO platforms (name, slug, display_name, base_url, api_type, commission_rate, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)")
      .run("Jalan", "jalan", "じゃらん", "https://www.jalan.net", "scraper", 2.0);
  }

  // Get platform IDs
  const platformRows = sqlite.prepare("SELECT id, slug FROM platforms").all() as { id: number; slug: string }[];
  const platformMap = new Map(platformRows.map(p => [p.slug, p.id]));

  // Get destination IDs
  const destRows = sqlite.prepare("SELECT id, slug FROM destinations").all() as { id: number; slug: string }[];
  const destMap = new Map(destRows.map(d => [d.slug, d.id]));

  // Get theme IDs
  const themeRows = sqlite.prepare("SELECT id, slug FROM themes").all() as { id: number; slug: string }[];
  const themeMap = new Map(themeRows.map(t => [t.slug, t.id]));

  // Insert experiences
  const insertExp = sqlite.prepare(`
    INSERT INTO experiences (slug, title, description, short_description, destination_id,
      duration_minutes, duration_text, highlights, min_price, max_price, currency, price_display,
      avg_rating, total_review_count, listing_count, platform_names, platform_slugs,
      hero_image_url, hero_image_alt, status, is_popular, is_featured, popularity_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)
  `);

  const insertListing = sqlite.prepare(`
    INSERT INTO listings (experience_id, platform_id, external_id, external_url, affiliate_url,
      title, description, price, currency, price_type, rating, review_count,
      thumbnail_url, images, last_scraped_at, scrape_status, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'per_person', ?, ?, ?, ?, ?, 'success', 1)
  `);

  const insertImage = sqlite.prepare(`
    INSERT INTO images (experience_id, url, alt_text, source_platform_id, display_order, is_hero, image_type)
    VALUES (?, ?, ?, ?, 0, 1, 'tour')
  `);

  const insertThemeLink = sqlite.prepare(`
    INSERT OR IGNORE INTO experience_themes (experience_id, theme_id) VALUES (?, ?)
  `);

  let expCount = 0;
  let listingCount = 0;
  let imageCount = 0;
  let themeLinks = 0;

  const insertAll = sqlite.transaction(() => {
    for (const exp of experiences) {
      const destId = destMap.get(exp.location.citySlug);
      if (!destId) continue;

      const platformId = platformMap.get(exp.source.platform);
      if (!platformId) continue;

      // Ensure unique slug using deterministic hash from source URL
      const slug = `${exp.slug}-${simpleHash(exp.source.url + exp.title)}`;

      try {
        const result = insertExp.run(
          slug, exp.title, exp.description, exp.shortDescription, destId,
          Math.round(exp.duration.hours * 60), exp.duration.display,
          JSON.stringify(exp.highlights),
          exp.price.amount, exp.price.amount, exp.price.currency, exp.price.display,
          exp.rating.score, exp.rating.count, 1,
          JSON.stringify([exp.source.platform]),
          JSON.stringify([exp.source.platform]),
          exp.thumbnail, exp.title,
          exp.isPopular ? 1 : 0, exp.isFeatured ? 1 : 0,
          exp.rating.count
        );

        const experienceId = Number(result.lastInsertRowid);
        expCount++;

        // Insert listing
        insertListing.run(
          experienceId, platformId, exp.source.productId,
          exp.source.url, exp.bookingUrl,
          exp.title, exp.description,
          exp.price.amount, exp.price.currency,
          exp.rating.score, exp.rating.count,
          exp.thumbnail, JSON.stringify(exp.images),
          exp.source.lastScraped
        );
        listingCount++;

        // Insert image
        if (exp.thumbnail) {
          insertImage.run(experienceId, exp.thumbnail, exp.title, platformId);
          imageCount++;
        }

        // Insert theme links
        for (const themeSlug of exp.themes) {
          const themeId = themeMap.get(themeSlug);
          if (themeId) {
            insertThemeLink.run(experienceId, themeId);
            themeLinks++;
          }
        }
      } catch (err) {
        // Skip duplicates
      }
    }
  });

  insertAll();

  // Update destination counts
  for (const [slug, destId] of destMap) {
    const count = sqlite.prepare("SELECT COUNT(*) as cnt FROM experiences WHERE destination_id = ? AND status = 'published'")
      .get(destId) as { cnt: number };
    sqlite.prepare("UPDATE destinations SET experience_count = ? WHERE id = ?").run(count.cnt, destId);
  }

  // Update theme counts
  for (const [slug, themeId] of themeMap) {
    const count = sqlite.prepare("SELECT COUNT(*) as cnt FROM experience_themes WHERE theme_id = ?")
      .get(themeId) as { cnt: number };
    sqlite.prepare("UPDATE themes SET experience_count = ? WHERE id = ?").run(count.cnt, themeId);
  }

  console.log(`\n✅ Import complete!`);
  console.log(`  Experiences: ${expCount}`);
  console.log(`  Listings: ${listingCount}`);
  console.log(`  Images: ${imageCount}`);
  console.log(`  Theme links: ${themeLinks}`);

  // Final stats
  const totalExp = sqlite.prepare("SELECT COUNT(*) as cnt FROM experiences").get() as { cnt: number };
  const totalList = sqlite.prepare("SELECT COUNT(*) as cnt FROM listings").get() as { cnt: number };
  const totalImg = sqlite.prepare("SELECT COUNT(*) as cnt FROM images").get() as { cnt: number };

  console.log(`\n📊 DB Stats:`);
  console.log(`  Total experiences: ${totalExp.cnt}`);
  console.log(`  Total listings: ${totalList.cnt}`);
  console.log(`  Total images: ${totalImg.cnt}`);

  const byCityRows = sqlite.prepare(
    "SELECT d.name, COUNT(e.id) as cnt FROM experiences e JOIN destinations d ON d.id = e.destination_id GROUP BY d.name ORDER BY cnt DESC"
  ).all() as { name: string; cnt: number }[];
  console.log(`\n  By city:`);
  byCityRows.forEach(r => console.log(`    ${r.name}: ${r.cnt}`));

  const byPlatRows = sqlite.prepare(
    "SELECT p.name, COUNT(l.id) as cnt FROM listings l JOIN platforms p ON p.id = l.platform_id GROUP BY p.name ORDER BY cnt DESC"
  ).all() as { name: string; cnt: number }[];
  console.log(`\n  By platform:`);
  byPlatRows.forEach(r => console.log(`    ${r.name}: ${r.cnt}`));

  const dbSize = sqlite.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get() as { size: number };
  console.log(`\n  DB file size: ${(dbSize.size / 1024).toFixed(1)} KB`);

  sqlite.close();
}

main();
