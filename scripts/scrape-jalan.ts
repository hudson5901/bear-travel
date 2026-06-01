import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

puppeteer.use(StealthPlugin());

// --- Interfaces ---

interface Experience {
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
  source: {
    platform: "jalan";
    url: string;
    productId: string;
    lastScraped: string;
  };
  bookingUrl: string;
  isPopular: boolean;
  isFeatured: boolean;
}

interface RawItem {
  title: string;
  url: string;
  price: string;
  rating: string;
  reviewCount: string;
  image: string;
  description: string;
  category: string;
}

// --- Configuration ---

const JPY_TO_USD_RATE = 1 / 155;

const CITIES = [
  {
    name: "Tokyo",
    slug: "tokyo",
    region: "Kanto",
    kankouCode: "130000",
    activityCode: "130000",
  },
  {
    name: "Kyoto",
    slug: "kyoto",
    region: "Kansai",
    kankouCode: "260000",
    activityCode: "260000",
  },
  {
    name: "Osaka",
    slug: "osaka",
    region: "Kansai",
    kankouCode: "270000",
    activityCode: "270000",
  },
  {
    name: "Hiroshima",
    slug: "hiroshima",
    region: "Chugoku",
    kankouCode: "340000",
    activityCode: "340000",
  },
  {
    name: "Nara",
    slug: "nara",
    region: "Kansai",
    kankouCode: "290000",
    activityCode: "290000",
  },
  {
    name: "Hakone",
    slug: "hakone",
    region: "Kanto",
    kankouCode: "140000",
    activityCode: "140000",
  },
];

const MAX_ITEMS_PER_CITY = 30;
const DELAY_MIN_MS = 3000;
const DELAY_MAX_MS = 5000;

// --- Utility Functions ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(): Promise<void> {
  const delay = DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS);
  return sleep(delay);
}

function slugify(text: string): string {
  // Handle Japanese characters by transliterating common ones or just using a hash
  const ascii = text
    .replace(/[^\w\s\u3000-\u9FFF-]/g, "")
    .replace(/[\s\u3000]+/g, "-")
    .toLowerCase();

  // If we have mostly Japanese, create a slug from the first few chars + hash
  if (/[\u3000-\u9FFF]/.test(ascii)) {
    const hash = simpleHash(text);
    const cleaned = text
      .replace(/[^\w\u3040-\u9FFF]/g, "")
      .slice(0, 20);
    return `${cleaned}-${hash}`.slice(0, 80);
  }

  return ascii
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36).slice(0, 6);
}

function parseJPYPrice(priceStr: string): {
  amount: number;
  currency: string;
  display: string;
} {
  // Extract numbers from Japanese price format like "1,000円" or "¥3,500" or "大人 3,500円"
  const match = priceStr.replace(/\s/g, "").match(/([\d,]+)\s*円/);
  if (match) {
    const jpyAmount = parseInt(match[1].replace(/,/g, ""), 10);
    const usdAmount = Math.round(jpyAmount * JPY_TO_USD_RATE * 100) / 100;
    return {
      amount: usdAmount,
      currency: "USD",
      display: `$${usdAmount.toFixed(2)} (~¥${jpyAmount.toLocaleString()})`,
    };
  }

  // Try yen symbol format
  const yenMatch = priceStr.replace(/\s/g, "").match(/[¥￥]([\d,]+)/);
  if (yenMatch) {
    const jpyAmount = parseInt(yenMatch[1].replace(/,/g, ""), 10);
    const usdAmount = Math.round(jpyAmount * JPY_TO_USD_RATE * 100) / 100;
    return {
      amount: usdAmount,
      currency: "USD",
      display: `$${usdAmount.toFixed(2)} (~¥${jpyAmount.toLocaleString()})`,
    };
  }

  return { amount: 0, currency: "USD", display: "$0.00" };
}

function parseRating(ratingStr: string): { score: number; count: number } {
  // Jalan uses formats like "4.5" or "4.5 (123件)"
  const scoreMatch = ratingStr.match(/([\d.]+)/);
  const countMatch = ratingStr.match(/[\(（]([\d,]+)/);

  const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
  const count = countMatch ? parseInt(countMatch[1].replace(/,/g, ""), 10) : 0;

  return { score: Math.min(score, 5), count };
}

function parseReviewCount(str: string): number {
  const match = str.match(/([\d,]+)/);
  return match ? parseInt(match[1].replace(/,/g, ""), 10) : 0;
}

function extractProductId(url: string): string {
  // Extract ID from URLs like /kankou/spt_13101ag2130013293/ or /activity/plan_xxxxx/
  const sptMatch = url.match(/spt_(\w+)/);
  if (sptMatch) return sptMatch[1];

  const planMatch = url.match(/plan_(\w+)/);
  if (planMatch) return planMatch[1];

  const idMatch = url.match(/\/(\d+)\/?$/);
  if (idMatch) return idMatch[1];

  return simpleHash(url);
}

function inferCategories(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const categories: string[] = [];

  const categoryMap: Record<string, string[]> = {
    "temple": ["寺", "temple", "神社", "shrine"],
    "garden": ["庭園", "garden", "公園", "park"],
    "museum": ["博物館", "美術館", "museum", "記念館"],
    "food": ["食", "料理", "グルメ", "food", "cooking", "味"],
    "nature": ["自然", "山", "川", "海", "nature", "hiking"],
    "culture": ["文化", "伝統", "体験", "culture", "traditional"],
    "craft": ["工芸", "陶芸", "craft", "pottery", "染め"],
    "tour": ["ツアー", "tour", "巡り", "散策"],
    "onsen": ["温泉", "onsen", "spa", "風呂"],
    "adventure": ["アドベンチャー", "adventure", "アクティビティ"],
  };

  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (keywords.some((kw) => text.includes(kw))) {
      categories.push(category);
    }
  }

  return categories.length > 0 ? categories : ["sightseeing"];
}

function inferThemes(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const themes: string[] = [];

  if (/family|子供|ファミリー|kids/.test(text)) themes.push("family-friendly");
  if (/couple|カップル|romantic|ロマンチック/.test(text)) themes.push("romantic");
  if (/history|歴史|historical/.test(text)) themes.push("historical");
  if (/photo|写真|instagrammable|フォトジェニック/.test(text)) themes.push("photogenic");
  if (/adventure|冒険|アドベンチャー|outdoor/.test(text)) themes.push("adventure");
  if (/relax|リラックス|癒し|healing/.test(text)) themes.push("relaxation");
  if (/food|グルメ|食|culinary/.test(text)) themes.push("culinary");
  if (/art|アート|芸術|artistic/.test(text)) themes.push("artistic");

  return themes.length > 0 ? themes : ["cultural"];
}

// --- Scraping Functions ---

async function scrapeKankouPage(
  page: any,
  city: (typeof CITIES)[number]
): Promise<RawItem[]> {
  const url = `https://www.jalan.net/kankou/${city.kankouCode}/`;
  console.log(`    Fetching kankou page: ${url}`);

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2000);

    const items: RawItem[] = await page.evaluate(() => {
      const results: RawItem[] = [];

      // Try multiple selector patterns for Jalan's kankou listing pages
      const selectors = [
        ".cassette_wrap",        // Standard spot listing
        ".item_wrap",            // Alternative listing
        ".spotList_item",        // Spot list items
        ".cassette",             // Cassette-style cards
        '[class*="CassetteList"]', // React-style class
        ".p-spotCard",           // Newer card style
        "article",              // Generic article elements
        ".searchList_item",     // Search result items
      ];

      let cards: Element[] = [];
      for (const sel of selectors) {
        const found = document.querySelectorAll(sel);
        if (found.length > 0) {
          cards = Array.from(found);
          break;
        }
      }

      // If no cards found with specific selectors, try looking for links with spot info
      if (cards.length === 0) {
        const spotLinks = document.querySelectorAll(
          'a[href*="/kankou/spt_"], a[href*="/spot/"], .item a'
        );
        cards = Array.from(spotLinks).map((link) => link.closest("li, div, article") || link);
      }

      for (const card of cards) {
        const titleEl =
          card.querySelector("h2, h3, .cassette_ttl, .item_name, .spotName, .title, [class*='title'], [class*='name']") ||
          card.querySelector("a");
        const linkEl = card.querySelector('a[href*="kankou"], a[href*="spot"], a[href]');
        const priceEl = card.querySelector(
          '.price, [class*="price"], [class*="fee"], .yen'
        );
        const ratingEl = card.querySelector(
          '.rating, [class*="rating"], [class*="score"], .review_score'
        );
        const reviewEl = card.querySelector(
          '.review, [class*="review"], [class*="count"], .kuchikomi'
        );
        const imgEl = card.querySelector("img");
        const descEl = card.querySelector(
          "p, .description, .text, .cassette_txt, [class*='desc']"
        );
        const catEl = card.querySelector(
          ".category, .genre, .tag, [class*='category'], [class*='genre']"
        );

        const title = titleEl?.textContent?.trim() || "";
        if (!title || title.length < 2) continue;

        results.push({
          title,
          url: linkEl?.getAttribute("href") || "",
          price: priceEl?.textContent?.trim() || "",
          rating: ratingEl?.textContent?.trim() || "",
          reviewCount: reviewEl?.textContent?.trim() || "",
          image:
            imgEl?.getAttribute("src") ||
            imgEl?.getAttribute("data-src") ||
            imgEl?.getAttribute("data-original") ||
            "",
          description: descEl?.textContent?.trim().slice(0, 300) || "",
          category: catEl?.textContent?.trim() || "",
        });
      }

      return results;
    });

    return items;
  } catch (error: any) {
    console.error(`    Error on kankou page: ${error.message}`);
    return [];
  }
}

async function scrapeActivityPage(
  page: any,
  city: (typeof CITIES)[number]
): Promise<RawItem[]> {
  const url = `https://www.jalan.net/activity/${city.activityCode}/`;
  console.log(`    Fetching activity page: ${url}`);

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2000);

    const items: RawItem[] = await page.evaluate(() => {
      const results: RawItem[] = [];

      // Activity pages have different structures
      const selectors = [
        ".planCassette",          // Plan listing cards
        ".cassette_wrap",         // Standard cassette
        ".activityCard",          // Activity cards
        ".plan_item",             // Plan items
        '[class*="PlanCard"]',    // React-style
        ".searchResultItem",     // Search results
        ".p-planCard",           // Newer plan cards
        ".item",                 // Generic items
        "article",              // Article elements
      ];

      let cards: Element[] = [];
      for (const sel of selectors) {
        const found = document.querySelectorAll(sel);
        if (found.length > 0) {
          cards = Array.from(found);
          break;
        }
      }

      // Fallback: look for plan/activity links
      if (cards.length === 0) {
        const actLinks = document.querySelectorAll(
          'a[href*="/activity/plan"], a[href*="play"], a[href*="leisure"]'
        );
        cards = Array.from(actLinks).map(
          (link) => link.closest("li, div, article, section") || link
        );
      }

      for (const card of cards) {
        const titleEl =
          card.querySelector(
            "h2, h3, h4, .plan_name, .planName, .title, [class*='title'], [class*='name'], [class*='Name']"
          ) || card.querySelector("a");
        const linkEl = card.querySelector(
          'a[href*="activity"], a[href*="plan"], a[href]'
        );
        const priceEl = card.querySelector(
          '.price, .plan_price, [class*="price"], [class*="Price"], .yen, [class*="fee"]'
        );
        const ratingEl = card.querySelector(
          '.rating, [class*="rating"], [class*="score"], [class*="Rating"]'
        );
        const reviewEl = card.querySelector(
          '.review, [class*="review"], [class*="count"], [class*="Review"]'
        );
        const imgEl = card.querySelector("img");
        const descEl = card.querySelector(
          "p, .description, .plan_text, [class*='desc'], [class*='Desc']"
        );
        const catEl = card.querySelector(
          ".category, .genre, .tag, [class*='category'], [class*='genre'], [class*='Category']"
        );

        const title = titleEl?.textContent?.trim() || "";
        if (!title || title.length < 2) continue;

        results.push({
          title,
          url: linkEl?.getAttribute("href") || "",
          price: priceEl?.textContent?.trim() || "",
          rating: ratingEl?.textContent?.trim() || "",
          reviewCount: reviewEl?.textContent?.trim() || "",
          image:
            imgEl?.getAttribute("src") ||
            imgEl?.getAttribute("data-src") ||
            imgEl?.getAttribute("data-original") ||
            "",
          description: descEl?.textContent?.trim().slice(0, 300) || "",
          category: catEl?.textContent?.trim() || "",
        });
      }

      return results;
    });

    return items;
  } catch (error: any) {
    console.error(`    Error on activity page: ${error.message}`);
    return [];
  }
}

async function scrapeActivitySearchPage(
  page: any,
  city: (typeof CITIES)[number],
  pageNum: number = 1
): Promise<RawItem[]> {
  // Try the play/experience search page
  const url = `https://www.jalan.net/activity/${city.activityCode}/page${pageNum}/`;
  console.log(`    Fetching activity search page ${pageNum}: ${url}`);

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2000);

    const items: RawItem[] = await page.evaluate(() => {
      const results: RawItem[] = [];

      // Broad selector approach for search results
      const cardSelectors = [
        ".cassette_wrap",
        ".planCassette",
        ".searchResultItem",
        ".item_wrap",
        ".p-planCard",
        '[class*="planCard"]',
        '[class*="PlanCard"]',
        "article",
        ".resultList li",
        ".list_item",
      ];

      let cards: Element[] = [];
      for (const sel of cardSelectors) {
        const found = document.querySelectorAll(sel);
        if (found.length > 2) {
          cards = Array.from(found);
          break;
        }
      }

      // Broader fallback
      if (cards.length === 0) {
        const allLinks = document.querySelectorAll('a[href*="plan"], a[href*="activity/"]');
        const uniqueParents = new Set<Element>();
        allLinks.forEach((link) => {
          const parent = link.closest("li, article, div[class], section");
          if (parent) uniqueParents.add(parent);
        });
        cards = Array.from(uniqueParents);
      }

      for (const card of cards) {
        const titleEl =
          card.querySelector(
            "h2, h3, h4, [class*='title'], [class*='name'], [class*='Title'], [class*='Name']"
          ) || card.querySelector("a");
        const linkEl = card.querySelector('a[href*="plan"], a[href*="activity"], a[href]');
        const priceEl = card.querySelector(
          '[class*="price"], [class*="Price"], [class*="fee"], .yen'
        );
        const ratingEl = card.querySelector(
          '[class*="rating"], [class*="score"], [class*="Rating"]'
        );
        const reviewEl = card.querySelector(
          '[class*="review"], [class*="count"], [class*="Review"]'
        );
        const imgEl = card.querySelector("img");
        const descEl = card.querySelector(
          "p, [class*='desc'], [class*='text'], [class*='Desc']"
        );
        const catEl = card.querySelector(
          "[class*='category'], [class*='genre'], [class*='tag'], [class*='Category']"
        );

        const title = titleEl?.textContent?.trim() || "";
        if (!title || title.length < 2) continue;

        results.push({
          title,
          url: linkEl?.getAttribute("href") || "",
          price: priceEl?.textContent?.trim() || "",
          rating: ratingEl?.textContent?.trim() || "",
          reviewCount: reviewEl?.textContent?.trim() || "",
          image:
            imgEl?.getAttribute("src") ||
            imgEl?.getAttribute("data-src") ||
            imgEl?.getAttribute("data-original") ||
            "",
          description: descEl?.textContent?.trim().slice(0, 300) || "",
          category: catEl?.textContent?.trim() || "",
        });
      }

      return results;
    });

    return items;
  } catch (error: any) {
    console.error(`    Error on activity search page: ${error.message}`);
    return [];
  }
}

async function scrapeCity(
  city: (typeof CITIES)[number]
): Promise<RawItem[]> {
  console.log(`\n  Launching browser for ${city.name}...`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  );

  // Set Japanese locale preferences
  await page.setExtraHTTPHeaders({
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
  });

  await page.setViewport({ width: 1366, height: 768 });

  const allItems: RawItem[] = [];

  try {
    // 1. Try the kankou (sightseeing) page
    const kankouItems = await scrapeKankouPage(page, city);
    console.log(`    Kankou page: found ${kankouItems.length} items`);
    allItems.push(...kankouItems);
    await randomDelay();

    // 2. Try the activity page
    const activityItems = await scrapeActivityPage(page, city);
    console.log(`    Activity page: found ${activityItems.length} items`);
    allItems.push(...activityItems);
    await randomDelay();

    // 3. Try paginated activity search if we need more items
    if (allItems.length < MAX_ITEMS_PER_CITY) {
      for (let pageNum = 1; pageNum <= 3; pageNum++) {
        if (allItems.length >= MAX_ITEMS_PER_CITY) break;

        const searchItems = await scrapeActivitySearchPage(page, city, pageNum);
        console.log(
          `    Activity search page ${pageNum}: found ${searchItems.length} items`
        );

        if (searchItems.length === 0) break;
        allItems.push(...searchItems);
        await randomDelay();
      }
    }
  } catch (error: any) {
    console.error(`  Error scraping ${city.name}: ${error.message}`);
  } finally {
    await browser.close();
  }

  // Deduplicate by title
  const seen = new Set<string>();
  const uniqueItems = allItems.filter((item) => {
    const key = item.title.trim().toLowerCase();
    if (seen.has(key) || !key) return false;
    seen.add(key);
    return true;
  });

  console.log(
    `  ${city.name} total: ${uniqueItems.length} unique items (from ${allItems.length} raw)`
  );

  return uniqueItems.slice(0, MAX_ITEMS_PER_CITY);
}

// --- Normalization ---

function normalizeToExperience(
  item: RawItem,
  city: (typeof CITIES)[number]
): Experience | null {
  if (!item.title || item.title.length < 2) return null;

  const slug = slugify(item.title);
  if (!slug) return null;

  const price = parseJPYPrice(item.price);
  const ratingData = parseRating(item.rating);
  const reviewCount =
    ratingData.count || parseReviewCount(item.reviewCount);
  const categories = inferCategories(item.title, item.description);
  const themes = inferThemes(item.title, item.description);

  // Build full URL
  let fullUrl = item.url;
  if (fullUrl && !fullUrl.startsWith("http")) {
    fullUrl = `https://www.jalan.net${fullUrl}`;
  }
  if (!fullUrl) {
    fullUrl = `https://www.jalan.net/kankou/${city.kankouCode}/`;
  }

  // Clean image URL
  let imageUrl = item.image;
  if (imageUrl && !imageUrl.startsWith("http")) {
    if (imageUrl.startsWith("//")) {
      imageUrl = `https:${imageUrl}`;
    } else {
      imageUrl = `https://www.jalan.net${imageUrl}`;
    }
  }

  const productId = extractProductId(item.url || item.title);

  return {
    id: `jalan-${city.slug}-${productId}`,
    slug: `${city.slug}-${slug}`,
    title: item.title,
    description:
      item.description ||
      `Experience ${item.title} in ${city.name}, Japan. A unique activity available through Jalan.`,
    shortDescription:
      (item.description || `${item.title} in ${city.name}, Japan.`).slice(
        0,
        150
      ),
    price,
    duration: { hours: 2, display: "2 hours (approx)" },
    rating: {
      score: ratingData.score,
      count: reviewCount,
    },
    images: imageUrl ? [imageUrl] : [],
    thumbnail: imageUrl || "",
    location: {
      city: city.name,
      citySlug: city.slug,
      region: city.region,
    },
    categories,
    themes,
    highlights: [],
    source: {
      platform: "jalan",
      url: fullUrl,
      productId,
      lastScraped: new Date().toISOString(),
    },
    bookingUrl: fullUrl,
    isPopular: reviewCount > 50 || ratingData.score >= 4.0,
    isFeatured: false,
  };
}

// --- Main ---

async function main() {
  console.log("=== Jalan (じゃらん) Scraper ===");
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Target: ${CITIES.length} cities, max ${MAX_ITEMS_PER_CITY} items each`);
  console.log(`Delay between pages: ${DELAY_MIN_MS / 1000}-${DELAY_MAX_MS / 1000} seconds\n`);

  const allExperiences: Experience[] = [];

  for (const city of CITIES) {
    console.log(`\n--- Scraping ${city.name} (${city.region}) ---`);

    const rawItems = await scrapeCity(city);

    let normalized = 0;
    for (const item of rawItems) {
      const experience = normalizeToExperience(item, city);
      if (experience) {
        allExperiences.push(experience);
        normalized++;
      }
    }

    console.log(`  Normalized: ${normalized} experiences for ${city.name}`);

    // Polite delay between cities
    if (city !== CITIES[CITIES.length - 1]) {
      console.log("  Waiting before next city...");
      await randomDelay();
    }
  }

  // Deduplicate across cities by ID
  const deduped = new Map<string, Experience>();
  for (const exp of allExperiences) {
    if (!deduped.has(exp.id)) {
      deduped.set(exp.id, exp);
    }
  }

  const finalResults = Array.from(deduped.values());

  // Ensure output directory exists
  const outputDir = join(process.cwd(), "data");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = join(outputDir, "jalan-raw.json");
  writeFileSync(outputPath, JSON.stringify(finalResults, null, 2), "utf-8");

  console.log(`\n=== Scraping Complete ===`);
  console.log(`Total experiences: ${finalResults.length}`);
  console.log(`Saved to: ${outputPath}`);
  console.log(`Finished at: ${new Date().toISOString()}`);

  // Print summary by city
  console.log("\nSummary by city:");
  for (const city of CITIES) {
    const count = finalResults.filter(
      (e) => e.location.citySlug === city.slug
    ).length;
    console.log(`  ${city.name}: ${count} experiences`);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
