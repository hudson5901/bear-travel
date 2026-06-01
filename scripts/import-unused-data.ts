/**
 * Import all unused scraped JSON files into the database.
 * Normalizes various formats into CleanExperience and merges into bear-tour.db
 */
import Database from "better-sqlite3";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const DB_PATH = join(process.cwd(), "data", "bear-tour.db");
const DATA_DIR = join(process.cwd(), "data");
const JPY_USD_RATE = 150;

interface CleanExperience {
  title: string;
  slug: string;
  description: string;
  priceUSD: number;
  priceDisplay: string;
  rating: number;
  reviewCount: number;
  thumbnail: string;
  city: string;
  citySlug: string;
  region: string;
  platform: string;
  url: string;
  themes: string[];
}

const CITY_MAP: Record<string, { slug: string; region: string }> = {
  Tokyo: { slug: "tokyo", region: "Kanto" },
  Kyoto: { slug: "kyoto", region: "Kansai" },
  Osaka: { slug: "osaka", region: "Kansai" },
  Hiroshima: { slug: "hiroshima", region: "Chugoku" },
  Nara: { slug: "nara", region: "Kansai" },
  Hakone: { slug: "hakone", region: "Kanto" },
  Nagano: { slug: "nagano", region: "Chubu" },
  Hokkaido: { slug: "hokkaido", region: "Hokkaido" },
  Okinawa: { slug: "okinawa", region: "Okinawa" },
  Niigata: { slug: "niigata", region: "Chubu" },
  Sapporo: { slug: "hokkaido", region: "Hokkaido" },
  Fukuoka: { slug: "fukuoka", region: "Kyushu" },
  Kamakura: { slug: "kamakura", region: "Kanto" },
  Nikko: { slug: "nikko", region: "Kanto" },
  Kanazawa: { slug: "kanazawa", region: "Chubu" },
  Yokohama: { slug: "yokohama", region: "Kanto" },
  Kobe: { slug: "kobe", region: "Kansai" },
  Various: { slug: "tokyo", region: "Kanto" },
};

const THEME_KEYWORDS: Record<string, string[]> = {
  "food-drink": ["料理", "食べ", "グルメ", "寿司", "ラーメン", "食", "cooking", "food", "sushi", "ramen", "buffet", "restaurant", "cafe", "sake", "beer", "wine", "tea", "matcha", "wagashi", "bento", "izakaya", "味噌", "発酵", "bakery", "sweets", "味"],
  "culture-history": ["着物", "茶道", "書道", "華道", "伝統", "神社", "寺", "文化", "kimono", "temple", "shrine", "traditional", "culture", "ceremony", "samurai", "geisha", "ninja", "zen", "buddhist", "shinto", "museum", "history", "castle", "歴史", "城", "博物館"],
  "nature-outdoor": ["自然", "庭園", "花", "山", "川", "海", "サイクリング", "nature", "garden", "mountain", "river", "outdoor", "cycling", "hiking", "trekking", "forest", "park", "beach", "island", "sakura", "紅葉", "桜", "富士"],
  "adventure": ["アドベンチャー", "ダイビング", "サーフィン", "カヤック", "ラフティング", "adventure", "diving", "surfing", "kayak", "rafting", "snorkel", "ski", "snowboard", "bungee", "paraglid", "zip", "climbing", "SUP", "scuba", "シュノーケ"],
  "art-entertainment": ["アート", "陶芸", "ガラス", "アクセサリー", "工芸", "キャンドル", "レジン", "pottery", "glass", "craft", "art", "workshop", "handmade", "candle", "silver", "金継ぎ", "kintsugi", "calligraphy", "painting", "photo"],
  "nightlife": ["夜", "ナイト", "バー", "night", "bar", "pub", "club", "evening", "illuminat", "light-up"],
};

function detectThemes(title: string, desc: string = ""): string[] {
  const text = `${title} ${desc}`.toLowerCase();
  const themes: string[] = [];
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      themes.push(theme);
    }
  }
  return themes.length > 0 ? themes : ["culture-history"];
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).slice(0, 6);
}

function slugify(text: string): string {
  const clean = text
    .replace(/【[^】]*】/g, "")
    .replace(/[^\w\s\u3000-\u9fff-]/g, "")
    .trim()
    .slice(0, 60);
  const ascii = clean
    .replace(/[\u3000-\u9fff]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return ascii || `exp-${simpleHash(text)}`;
}

function guessCity(item: any): string {
  const text = `${item.city || ""} ${item.url || ""} ${item.title || ""}`.toLowerCase();
  if (text.includes("tokyo") || text.includes("東京")) return "Tokyo";
  if (text.includes("kyoto") || text.includes("京都")) return "Kyoto";
  if (text.includes("osaka") || text.includes("大阪")) return "Osaka";
  if (text.includes("okinawa") || text.includes("沖縄")) return "Okinawa";
  if (text.includes("hiroshima") || text.includes("広島")) return "Hiroshima";
  if (text.includes("nara") || text.includes("奈良")) return "Nara";
  if (text.includes("hakone") || text.includes("箱根")) return "Hakone";
  if (text.includes("hokkaido") || text.includes("北海道") || text.includes("sapporo") || text.includes("札幌")) return "Hokkaido";
  if (text.includes("nagano") || text.includes("長野")) return "Nagano";
  if (text.includes("fukuoka") || text.includes("福岡")) return "Fukuoka";
  if (text.includes("kamakura") || text.includes("鎌倉")) return "Kamakura";
  if (text.includes("nikko") || text.includes("日光")) return "Nikko";
  if (text.includes("kanazawa") || text.includes("金沢")) return "Kanazawa";
  if (text.includes("yokohama") || text.includes("横浜")) return "Yokohama";
  if (text.includes("kobe") || text.includes("神戸")) return "Kobe";
  if (text.includes("niigata") || text.includes("新潟")) return "Niigata";
  return item.city || "Tokyo";
}

function isJapanRelated(item: any): boolean {
  const text = `${item.title || ""} ${item.url || ""} ${item.city || ""} ${item.description || ""}`.toLowerCase();
  // Exclude non-Japan content (HIS has Paris, Hawaii etc)
  const nonJapan = ["paris", "hawaii", "bali", "london", "new york", "bangkok", "seoul", "guam", "saipan", "cebu"];
  if (nonJapan.some((loc) => text.includes(loc))) return false;
  // Must have some Japan indicator
  const japanIndicators = ["japan", ".jp", "tokyo", "kyoto", "osaka", "jalan", "asoview", "東京", "京都", "大阪", "円", "沖縄", "北海道", "広島", "奈良", "箱根", "長野", "福岡", "鎌倉", "日光", "金沢", "横浜", "神戸", "新潟", "tabirai", "otonami", "veltra"];
  return japanIndicators.some((ind) => text.includes(ind));
}

function loadJSON(filename: string): any[] {
  const path = join(DATA_DIR, filename);
  if (!existsSync(path)) return [];
  const data = JSON.parse(readFileSync(path, "utf-8"));
  return Array.isArray(data) ? data : [];
}

// ============ Process each file ============

function processMegaBatch(): CleanExperience[] {
  const raw = loadJSON("mega-batch-raw.json");
  return raw
    .filter((item) => item.title && item.title.length >= 5 && isJapanRelated(item))
    .map((item) => {
      const city = guessCity(item);
      const cityInfo = CITY_MAP[city] || CITY_MAP["Tokyo"];
      const priceUSD = item.priceNum || 0;
      return {
        title: item.title,
        slug: slugify(item.title),
        description: item.description || "",
        priceUSD: priceUSD || 20,
        priceDisplay: priceUSD ? `$${priceUSD}` : "$20",
        rating: parseFloat(item.rating) || 0,
        reviewCount: parseInt(item.reviewCount) || 0,
        thumbnail: item.image || "",
        city,
        citySlug: cityInfo.slug,
        region: cityInfo.region,
        platform: item.platform || "wamazing",
        url: item.url || "",
        themes: detectThemes(item.title, item.description),
      };
    });
}

function processJalanActivities(): CleanExperience[] {
  const raw = loadJSON("jalan-activities.json");
  return raw
    .filter((item) => {
      if (!item.title || item.title.length < 5) return false;
      if (item.title === "バイキング・ビュッフェ・ホテルレストラン") return false;
      if (!item.image || item.image.includes("dummy") || item.image.includes("spacer")) return false;
      return true;
    })
    .map((item) => {
      const city = guessCity(item);
      const cityInfo = CITY_MAP[city] || CITY_MAP["Tokyo"];
      const priceJPY = parseInt((item.price || "").replace(/[^\d]/g, "")) || 0;
      const priceUSD = priceJPY > 0 ? Math.round(priceJPY / JPY_USD_RATE) : 20;
      return {
        title: item.title.replace(/【[^】]*】/g, "").replace(/♪|★|☆|◆|■/g, "").trim(),
        slug: slugify(item.title),
        description: "",
        priceUSD,
        priceDisplay: `$${priceUSD}`,
        rating: parseFloat(item.rating) || 0,
        reviewCount: parseInt(item.reviewCount) || 0,
        thumbnail: item.image?.replace("https://www.jalan.net/cdn.jalan.jp/", "https://cdn.jalan.jp/") || "",
        city,
        citySlug: cityInfo.slug,
        region: cityInfo.region,
        platform: "jalan",
        url: item.url || "",
        themes: detectThemes(item.title, item.category || ""),
      };
    });
}

function processTabirai(): CleanExperience[] {
  const raw = loadJSON("tabirai-raw.json");
  return raw
    .filter((item) => item.title && item.title.length >= 5)
    .map((item) => {
      const city = guessCity(item);
      const cityInfo = CITY_MAP[city] || CITY_MAP["Tokyo"];
      const priceUSD = parseFloat(item.priceUSD) || Math.round((parseInt(item.priceJPY) || 0) / JPY_USD_RATE) || 20;
      return {
        title: item.title.slice(0, 100),
        slug: slugify(item.title),
        description: item.description || "",
        priceUSD,
        priceDisplay: item.priceDisplay || `$${priceUSD}`,
        rating: parseFloat(item.rating) || 0,
        reviewCount: parseInt(item.reviewCount) || 0,
        thumbnail: item.image || "",
        city,
        citySlug: cityInfo.slug,
        region: cityInfo.region,
        platform: "tabirai",
        url: item.url || "",
        themes: detectThemes(item.title, item.description),
      };
    });
}

function processTravelko(): CleanExperience[] {
  const raw = loadJSON("travelko-v2-raw.json");
  return raw
    .filter((item) => item.title && item.title.length >= 5)
    .map((item) => {
      const city = guessCity(item);
      const cityInfo = CITY_MAP[city] || CITY_MAP["Tokyo"];
      const priceUSD = item.priceNum || Math.round((parseInt(item.priceJpy) || 0) / JPY_USD_RATE) || 20;
      return {
        title: item.title,
        slug: slugify(item.title),
        description: "",
        priceUSD,
        priceDisplay: item.price || `$${priceUSD}`,
        rating: parseFloat(item.rating) || 0,
        reviewCount: parseInt(item.reviewCount) || 0,
        thumbnail: item.image || "",
        city,
        citySlug: cityInfo.slug,
        region: cityInfo.region,
        platform: "travelko",
        url: item.url || "",
        themes: detectThemes(item.title),
      };
    });
}

function processGoWithGuide(): CleanExperience[] {
  const raw = loadJSON("gowithguide-raw.json");
  return raw
    .filter((item) => item.title && item.title.length >= 5 && !item.title.match(/^[A-Z][a-z]+ [A-Z]\.$/))
    .map((item) => {
      const city = guessCity(item);
      const cityInfo = CITY_MAP[city] || CITY_MAP["Tokyo"];
      const priceUSD = item.priceNum || 0;
      return {
        title: item.title,
        slug: slugify(item.title),
        description: item.description || "",
        priceUSD: priceUSD || 50,
        priceDisplay: priceUSD ? `$${priceUSD}` : "$50",
        rating: parseFloat(item.rating) || 0,
        reviewCount: parseInt(item.reviewCount) || 0,
        thumbnail: item.image || "",
        city,
        citySlug: cityInfo.slug,
        region: cityInfo.region,
        platform: "gowithguide",
        url: item.url || "",
        themes: detectThemes(item.title, item.description),
      };
    });
}

function processDeepExp(): CleanExperience[] {
  const raw = loadJSON("deepexp-raw.json");
  return raw
    .filter((item) => item.title && item.title.length >= 5 && isJapanRelated(item))
    .map((item) => {
      const city = guessCity(item);
      const cityInfo = CITY_MAP[city] || CITY_MAP["Tokyo"];
      const priceUSD = item.priceNum || 0;
      return {
        title: item.title,
        slug: slugify(item.title),
        description: item.description || "",
        priceUSD: priceUSD || 30,
        priceDisplay: priceUSD ? `$${priceUSD}` : "$30",
        rating: parseFloat(item.rating) || 0,
        reviewCount: parseInt(item.reviewCount) || 0,
        thumbnail: item.image || "",
        city,
        citySlug: cityInfo.slug,
        region: cityInfo.region,
        platform: "deepexp",
        url: item.url || "",
        themes: detectThemes(item.title, item.description),
      };
    });
}

function processFoodCulture(): CleanExperience[] {
  const raw = loadJSON("food-culture-raw.json");
  return raw
    .filter((item) => {
      if (!item.title || item.title.length < 5) return false;
      if (item.title.startsWith("Photo of")) return false;
      if (item.url?.includes("youtube.com")) return false;
      return isJapanRelated(item);
    })
    .map((item) => {
      const city = guessCity(item);
      const cityInfo = CITY_MAP[city] || CITY_MAP["Tokyo"];
      const priceUSD = item.priceNum || 0;
      return {
        title: item.title,
        slug: slugify(item.title),
        description: item.description || "",
        priceUSD: priceUSD || 30,
        priceDisplay: priceUSD ? `$${priceUSD}` : "$30",
        rating: parseFloat(item.rating) || 0,
        reviewCount: parseInt(item.reviewCount) || 0,
        thumbnail: item.image || "",
        city,
        citySlug: cityInfo.slug,
        region: cityInfo.region,
        platform: item.platform || "byfood",
        url: item.url || "",
        themes: detectThemes(item.title, item.description),
      };
    });
}

function processNewPlatforms(): CleanExperience[] {
  const raw = loadJSON("new-platforms.json");
  return raw
    .filter((item) => item.title && item.title.length >= 5 && isJapanRelated(item))
    .map((item) => {
      const city = guessCity(item);
      const cityInfo = CITY_MAP[city] || CITY_MAP["Tokyo"];
      const priceUSD = item.priceNum || 0;
      return {
        title: item.title,
        slug: slugify(item.title),
        description: item.description || "",
        priceUSD: priceUSD || 30,
        priceDisplay: priceUSD ? `$${priceUSD}` : "$30",
        rating: parseFloat(item.rating) || 0,
        reviewCount: parseInt(item.reviewCount) || 0,
        thumbnail: item.image || "",
        city,
        citySlug: cityInfo.slug,
        region: cityInfo.region,
        platform: item.platform || "veltra",
        url: item.url || "",
        themes: detectThemes(item.title, item.description),
      };
    });
}

function processHIS(): CleanExperience[] {
  const raw = loadJSON("his-raw.json");
  return raw
    .filter((item) => item.title && item.title.length >= 5 && isJapanRelated(item))
    .map((item) => {
      const city = guessCity(item);
      const cityInfo = CITY_MAP[city] || CITY_MAP["Tokyo"];
      const price = typeof item.price === "object" ? item.price : {};
      const priceJPY = price.amount || 0;
      const priceUSD = priceJPY > 100 ? Math.round(priceJPY / JPY_USD_RATE) : priceJPY || 30;
      return {
        title: item.title.replace(/…$/, ""),
        slug: slugify(item.title),
        description: (item.description || "").slice(0, 200),
        priceUSD,
        priceDisplay: `$${priceUSD}`,
        rating: item.rating?.score || parseFloat(item.rating) || 0,
        reviewCount: item.rating?.count || 0,
        thumbnail: item.thumbnail || (item.images?.[0]) || "",
        city,
        citySlug: cityInfo.slug,
        region: cityInfo.region,
        platform: "his",
        url: item.source?.url || item.bookingUrl || "",
        themes: detectThemes(item.title, item.description),
      };
    });
}

function processOtonami(): CleanExperience[] {
  const raw = loadJSON("otonami-raw.json");
  return raw
    .filter((item) => item.title && item.title.length >= 5)
    .map((item) => {
      const city = guessCity(item);
      const cityInfo = CITY_MAP[city] || CITY_MAP["Tokyo"];
      const priceUSD = item.priceNum || 0;
      return {
        title: item.title,
        slug: slugify(item.title),
        description: (item.description || "").slice(0, 200),
        priceUSD: priceUSD || 40,
        priceDisplay: priceUSD ? `$${priceUSD}` : "$40",
        rating: parseFloat(item.rating) || 0,
        reviewCount: parseInt(item.reviewCount) || 0,
        thumbnail: item.image || "",
        city,
        citySlug: cityInfo.slug,
        region: cityInfo.region,
        platform: "otonami",
        url: item.url || "",
        themes: detectThemes(item.title, item.description),
      };
    });
}

// ============ Main ============

function main() {
  console.log("=== Importing unused data into DB ===\n");

  const sources = [
    { name: "mega-batch", fn: processMegaBatch },
    { name: "jalan-activities", fn: processJalanActivities },
    { name: "tabirai", fn: processTabirai },
    { name: "travelko", fn: processTravelko },
    { name: "gowithguide", fn: processGoWithGuide },
    { name: "deepexp", fn: processDeepExp },
    { name: "food-culture", fn: processFoodCulture },
    { name: "new-platforms", fn: processNewPlatforms },
    { name: "his", fn: processHIS },
    { name: "otonami", fn: processOtonami },
  ];

  let allNew: CleanExperience[] = [];
  for (const { name, fn } of sources) {
    const items = fn();
    console.log(`  ${name}: ${items.length} items`);
    allNew.push(...items);
  }

  // Deduplicate by normalized title
  const seen = new Set<string>();
  const deduped = allNew.filter((item) => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9\u3000-\u9fff]/g, "").slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`\nTotal after dedup: ${deduped.length}\n`);

  // Open DB
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // Ensure new destinations exist
  const existingDests = sqlite.prepare("SELECT slug FROM destinations").all() as { slug: string }[];
  const destSlugs = new Set(existingDests.map((d) => d.slug));
  const newDests = [
    { name: "Fukuoka", slug: "fukuoka", region: "Kyushu", desc: "Gateway to Kyushu with famous food culture", lat: 33.5904, lng: 130.4017 },
    { name: "Kamakura", slug: "kamakura", region: "Kanto", desc: "Coastal city with the Great Buddha and ancient temples", lat: 35.3192, lng: 139.5467 },
    { name: "Nikko", slug: "nikko", region: "Kanto", desc: "Mountain town with ornate shrines and natural beauty", lat: 36.7199, lng: 139.6982 },
    { name: "Kanazawa", slug: "kanazawa", region: "Chubu", desc: "Historic city with one of Japan's finest gardens", lat: 36.5613, lng: 136.6562 },
    { name: "Yokohama", slug: "yokohama", region: "Kanto", desc: "Port city with Chinatown and modern waterfront", lat: 35.4437, lng: 139.6380 },
    { name: "Kobe", slug: "kobe", region: "Kansai", desc: "Cosmopolitan port city famous for beef and harbor views", lat: 34.6901, lng: 135.1956 },
  ];
  for (const d of newDests) {
    if (!destSlugs.has(d.slug)) {
      sqlite.prepare("INSERT INTO destinations (name, slug, level, region, country, description, latitude, longitude, experience_count) VALUES (?, ?, 'city', ?, 'Japan', ?, ?, ?, 0)")
        .run(d.name, d.slug, d.region, d.desc, d.lat, d.lng);
      destSlugs.add(d.slug);
      console.log(`  Added destination: ${d.name}`);
    }
  }

  // Ensure new platforms exist
  const newPlatforms = [
    { name: "Tabirai", slug: "tabirai", display: "たびらい", url: "https://www.tabirai.net" },
    { name: "Travelko", slug: "travelko", display: "トラベルコ", url: "https://www.tour.ne.jp" },
    { name: "GoWithGuide", slug: "gowithguide", display: "GoWithGuide", url: "https://gowithguide.com" },
    { name: "DeepExperience", slug: "deepexp", display: "Deep Experience", url: "https://www.deep-exp.com" },
    { name: "WAmazing", slug: "wamazing", display: "WAmazing", url: "https://www.wamazing.com" },
    { name: "HIS", slug: "his", display: "H.I.S.", url: "https://activities.his-j.com" },
    { name: "Otonami", slug: "otonami", display: "Otonami", url: "https://otonami.jp" },
    { name: "Cookly", slug: "cookly", display: "Cookly", url: "https://www.cookly.me" },
    { name: "Headout", slug: "headout", display: "Headout", url: "https://www.headout.com" },
    { name: "JapanWonderTravel", slug: "japanwondertravel", display: "Japan Wonder Travel", url: "https://www.japanwondertravel.com" },
  ];
  const existingPlatforms = sqlite.prepare("SELECT slug FROM platforms").all() as { slug: string }[];
  const platSlugs = new Set(existingPlatforms.map((p) => p.slug));
  for (const p of newPlatforms) {
    if (!platSlugs.has(p.slug)) {
      sqlite.prepare("INSERT OR IGNORE INTO platforms (name, slug, display_name, base_url, api_type, commission_rate, is_active) VALUES (?, ?, ?, ?, 'scraper', 3.0, 1)")
        .run(p.name, p.slug, p.display, p.url);
      platSlugs.add(p.slug);
    }
  }

  // Get maps
  const destRows = sqlite.prepare("SELECT id, slug FROM destinations").all() as { id: number; slug: string }[];
  const destMap = new Map(destRows.map((d) => [d.slug, d.id]));
  const platformRows = sqlite.prepare("SELECT id, slug FROM platforms").all() as { id: number; slug: string }[];
  const platformMap = new Map(platformRows.map((p) => [p.slug, p.id]));
  const themeRows = sqlite.prepare("SELECT id, slug FROM themes").all() as { id: number; slug: string }[];
  const themeMap = new Map(themeRows.map((t) => [t.slug, t.id]));

  // Check existing experience titles to avoid dupes
  const existingTitles = new Set(
    (sqlite.prepare("SELECT title FROM experiences").all() as { title: string }[])
      .map((r) => r.title.toLowerCase().replace(/[^a-z0-9\u3000-\u9fff]/g, "").slice(0, 40))
  );

  const insertExp = sqlite.prepare(`
    INSERT INTO experiences (slug, title, description, short_description, destination_id,
      duration_minutes, duration_text, highlights, min_price, max_price, currency, price_display,
      avg_rating, total_review_count, listing_count, platform_names, platform_slugs,
      hero_image_url, hero_image_alt, status, is_popular, is_featured, popularity_score)
    VALUES (?, ?, ?, ?, ?, 120, 'Varies', '[]', ?, ?, 'USD', ?, ?, ?, 1, ?, ?, ?, ?, 'published', ?, 0, ?)
  `);

  const insertListing = sqlite.prepare(`
    INSERT INTO listings (experience_id, platform_id, external_id, external_url, affiliate_url,
      title, description, price, currency, price_type, rating, review_count,
      thumbnail_url, images, last_scraped_at, scrape_status, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USD', 'per_person', ?, ?, ?, '[]', datetime('now'), 'success', 1)
  `);

  const insertImage = sqlite.prepare(`
    INSERT INTO images (experience_id, url, alt_text, source_platform_id, display_order, is_hero, image_type)
    VALUES (?, ?, ?, ?, 0, 1, 'tour')
  `);

  const insertThemeLink = sqlite.prepare(`
    INSERT OR IGNORE INTO experience_themes (experience_id, theme_id) VALUES (?, ?)
  `);

  let added = 0;
  let skipped = 0;

  const insertAll = sqlite.transaction(() => {
    for (const exp of deduped) {
      const titleKey = exp.title.toLowerCase().replace(/[^a-z0-9\u3000-\u9fff]/g, "").slice(0, 40);
      if (existingTitles.has(titleKey)) {
        skipped++;
        continue;
      }
      existingTitles.add(titleKey);

      const destId = destMap.get(exp.citySlug);
      if (!destId) {
        skipped++;
        continue;
      }

      const platformId = platformMap.get(exp.platform);
      if (!platformId) {
        skipped++;
        continue;
      }

      const slug = `${exp.citySlug}-${exp.slug}-${simpleHash(exp.url + exp.title)}`;

      try {
        const result = insertExp.run(
          slug, exp.title, exp.description, exp.description.slice(0, 150),
          destId, exp.priceUSD, exp.priceUSD, exp.priceDisplay,
          exp.rating, exp.reviewCount,
          JSON.stringify([exp.platform]), JSON.stringify([exp.platform]),
          exp.thumbnail, exp.title,
          exp.reviewCount > 20 ? 1 : 0, exp.reviewCount
        );

        const experienceId = Number(result.lastInsertRowid);
        added++;

        insertListing.run(
          experienceId, platformId, simpleHash(exp.url),
          exp.url, exp.url, exp.title, exp.description,
          exp.priceUSD, exp.rating, exp.reviewCount,
          exp.thumbnail
        );

        if (exp.thumbnail) {
          insertImage.run(experienceId, exp.thumbnail, exp.title, platformId);
        }

        for (const themeSlug of exp.themes) {
          const themeId = themeMap.get(themeSlug);
          if (themeId) insertThemeLink.run(experienceId, themeId);
        }
      } catch {
        skipped++;
      }
    }
  });

  insertAll();

  // Update destination counts
  for (const [, destId] of destMap) {
    const count = sqlite.prepare("SELECT COUNT(*) as cnt FROM experiences WHERE destination_id = ? AND status = 'published'").get(destId) as { cnt: number };
    sqlite.prepare("UPDATE destinations SET experience_count = ? WHERE id = ?").run(count.cnt, destId);
  }

  // Update theme counts
  for (const [, themeId] of themeMap) {
    const count = sqlite.prepare("SELECT COUNT(*) as cnt FROM experience_themes WHERE theme_id = ?").get(themeId) as { cnt: number };
    sqlite.prepare("UPDATE themes SET experience_count = ? WHERE id = ?").run(count.cnt, themeId);
  }

  // Final stats
  const totalExp = sqlite.prepare("SELECT COUNT(*) as cnt FROM experiences").get() as { cnt: number };
  const totalList = sqlite.prepare("SELECT COUNT(*) as cnt FROM listings").get() as { cnt: number };

  console.log(`\n=== Results ===`);
  console.log(`  Added: ${added}`);
  console.log(`  Skipped (dupes/no dest): ${skipped}`);
  console.log(`  Total experiences in DB: ${totalExp.cnt}`);
  console.log(`  Total listings in DB: ${totalList.cnt}`);

  console.log(`\n  By city:`);
  sqlite.prepare("SELECT d.name, COUNT(e.id) as cnt FROM experiences e JOIN destinations d ON d.id=e.destination_id GROUP BY d.name ORDER BY cnt DESC")
    .all().forEach((r: any) => console.log(`    ${r.name}: ${r.cnt}`));

  console.log(`\n  By platform:`);
  sqlite.prepare("SELECT p.name, COUNT(l.id) as cnt FROM listings l JOIN platforms p ON p.id=l.platform_id GROUP BY p.name ORDER BY cnt DESC")
    .all().forEach((r: any) => console.log(`    ${r.name}: ${r.cnt}`));

  console.log(`\n  By theme:`);
  sqlite.prepare("SELECT t.name, COUNT(et.experience_id) as cnt FROM themes t LEFT JOIN experience_themes et ON et.theme_id=t.id GROUP BY t.id ORDER BY cnt DESC")
    .all().forEach((r: any) => console.log(`    ${r.name}: ${r.cnt}`));

  sqlite.close();
}

main();
