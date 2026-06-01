/**
 * Fix scraper for sites that failed in the first batch:
 * - byfood.com (correct selectors)
 * - magical-trip.com (correct domain)
 * - activityjapan.com (correct URL pattern)
 * - jalan.net (correct URL pattern)
 * - go-nagano.net (correct URL pattern)
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { Page, Browser } from "puppeteer";

puppeteer.use(StealthPlugin());

interface ScrapedItem {
  title: string;
  url: string;
  image: string;
  price: string;
  priceNum: number;
  currency: string;
  rating: string;
  reviewCount: string;
  city: string;
  region: string;
  platform: string;
  description: string;
  categories: string[];
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function scrollPage(page: Page, times = 10, dist = 600, wait = 400) {
  for (let i = 0; i < times; i++) {
    await page.evaluate((d) => window.scrollBy(0, d), dist);
    await delay(wait);
  }
}

function parseJPY(text: string): number {
  const m =
    text.match(/(\d{1,3}(?:,\d{3})*)\s*円/) ||
    text.match(/[¥￥]\s*(\d{1,3}(?:,\d{3})*)/) ||
    text.match(/(\d{1,3}(?:,\d{3})*)/);
  if (m) return parseInt(m[1].replace(/,/g, ""), 10);
  return 0;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ============ byFood (fixed: use full page scrape approach) ============
async function scrapeByfood(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n[byFood] Scraping byfood.com...");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1440, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    "https://www.byfood.com/food-experiences/japan",
    "https://www.byfood.com/food-experiences/japan/tokyo",
    "https://www.byfood.com/food-experiences/japan/kyoto",
    "https://www.byfood.com/food-experiences/japan/osaka",
    "https://www.byfood.com/experiences",
  ];

  for (const url of urls) {
    try {
      console.log(`  Fetching: ${url}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
      await delay(3000);
      await scrollPage(page, 15);

      const items = await page.evaluate(() => {
        const found: any[] = [];
        const seen = new Set<string>();

        // Broader selector strategy for byfood
        document.querySelectorAll("a[href]").forEach((el) => {
          const link = (el as HTMLAnchorElement).href;
          if (!link || seen.has(link)) return;
          if (
            !link.includes("/food-experiences/") &&
            !link.includes("/experiences/") &&
            !link.includes("/tour/")
          )
            return;
          if (link === window.location.href) return;
          seen.add(link);

          // Walk up to find card container
          const card =
            el.closest("[class*='card']") ||
            el.closest("[class*='Card']") ||
            el.closest("article") ||
            el.closest("li") ||
            el.closest("div[class]") ||
            el;

          const title =
            card.querySelector("h1, h2, h3, h4, [class*='title'], [class*='name']")
              ?.textContent?.trim() ||
            el.textContent?.trim() ||
            "";
          if (!title || title.length < 5 || title.length > 200) return;

          const priceEl = card.querySelector("[class*='price'], [class*='Price'], [class*='cost']");
          const price = priceEl?.textContent?.trim() || "";
          const ratingEl = card.querySelector("[class*='rating'], [class*='star']");
          const rating = ratingEl?.textContent?.trim() || "";
          const imgEl = card.querySelector("img");
          const image = imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";
          const descEl = card.querySelector("p, [class*='desc'], [class*='summary']");
          const description = descEl?.textContent?.trim() || "";

          found.push({ title, url: link, price, rating, reviewCount: "", image, description });
        });
        return found;
      });

      const city = url.includes("tokyo")
        ? "Tokyo"
        : url.includes("kyoto")
          ? "Kyoto"
          : url.includes("osaka")
            ? "Osaka"
            : "Various";

      for (const item of items) {
        results.push({
          ...item,
          priceNum: parseJPY(item.price),
          currency: item.price.includes("$") ? "USD" : "JPY",
          city,
          region: "",
          platform: "byfood",
          categories: ["food", "cultural"],
        });
      }
      console.log(`  Found ${items.length} items`);
    } catch (e: any) {
      console.error(`  Error: ${e.message}`);
    }
    await delay(3000 + Math.random() * 2000);
  }

  await page.close();
  return results;
}

// ============ Magical Trip (fixed domain) ============
async function scrapeMagicalTrip(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n[Magical Trip] Scraping magical-trip.com...");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1440, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://www.magical-trip.com/spot/tokyo", city: "Tokyo" },
    { url: "https://www.magical-trip.com/spot/kyoto", city: "Kyoto" },
    { url: "https://www.magical-trip.com/spot/osaka", city: "Osaka" },
    { url: "https://www.magical-trip.com/tour", city: "Various" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  Fetching: ${url}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2000);
      await scrollPage(page, 10);

      const items = await page.evaluate(() => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll("a[href]").forEach((el) => {
          const link = (el as HTMLAnchorElement).href;
          if (!link || seen.has(link)) return;
          if (!link.includes("/tour/") && !link.includes("/spot/")) return;
          if (link === window.location.href) return;
          seen.add(link);

          const card =
            el.closest("[class*='card']") ||
            el.closest("[class*='Card']") ||
            el.closest("article") ||
            el.closest("li") ||
            el;

          const title =
            card.querySelector("h2, h3, h4, [class*='title'], [class*='name']")
              ?.textContent?.trim() || "";
          if (!title || title.length < 5) return;

          const priceEl = card.querySelector("[class*='price'], [class*='Price']");
          const price = priceEl?.textContent?.trim() || "";
          const ratingEl = card.querySelector("[class*='rating'], [class*='star']");
          const rating = ratingEl?.textContent?.trim() || "";
          const reviewEl = card.querySelector("[class*='review']");
          const reviewCount = reviewEl?.textContent?.trim() || "";
          const imgEl = card.querySelector("img");
          const image = imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";
          const descEl = card.querySelector("p, [class*='desc']");
          const description = descEl?.textContent?.trim() || "";

          found.push({ title, url: link, price, rating, reviewCount, image, description });
        });
        return found;
      });

      for (const item of items) {
        results.push({
          ...item,
          priceNum: parseJPY(item.price),
          currency: item.price.includes("$") ? "USD" : "JPY",
          city,
          region: "",
          platform: "magical-trip",
          categories: ["tour", "cultural", "food"],
        });
      }
      console.log(`  Found ${items.length} items`);
    } catch (e: any) {
      console.error(`  Error: ${e.message}`);
    }
    await delay(3000 + Math.random() * 2000);
  }

  await page.close();
  return results;
}

// ============ Activity Japan (fixed URL paths) ============
async function scrapeActivityJapan(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n[Activity Japan] Scraping activityjapan.com...");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1440, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://activityjapan.com/feature/tokyo/", city: "Tokyo", region: "Kanto" },
    { url: "https://activityjapan.com/feature/kyoto/", city: "Kyoto", region: "Kansai" },
    { url: "https://activityjapan.com/feature/osaka/", city: "Osaka", region: "Kansai" },
    { url: "https://activityjapan.com/feature/okinawa/", city: "Okinawa", region: "Okinawa" },
    { url: "https://activityjapan.com/feature/hokkaido/", city: "Hokkaido", region: "Hokkaido" },
    { url: "https://activityjapan.com/area/nagano/", city: "Nagano", region: "Chubu" },
    { url: "https://activityjapan.com/area/tokyo/", city: "Tokyo", region: "Kanto" },
    { url: "https://activityjapan.com/area/kyoto/", city: "Kyoto", region: "Kansai" },
  ];

  for (const { url, city, region } of urls) {
    try {
      console.log(`  Fetching: ${url}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2000);
      await scrollPage(page, 12);

      const items = await page.evaluate(() => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll("a[href]").forEach((el) => {
          const link = (el as HTMLAnchorElement).href;
          if (!link || seen.has(link)) return;
          if (
            !link.includes("/publish/plan/") &&
            !link.includes("/plan/") &&
            !link.includes("/feature/")
          )
            return;
          if (link === window.location.href) return;
          seen.add(link);

          const card =
            el.closest("[class*='card']") ||
            el.closest("[class*='Card']") ||
            el.closest("[class*='plan']") ||
            el.closest("article") ||
            el.closest("li") ||
            el;

          const title =
            card.querySelector("h2, h3, h4, [class*='title'], [class*='name'], [class*='planTitle']")
              ?.textContent?.trim() || "";
          if (!title || title.length < 5 || title.length > 200) return;

          const priceEl = card.querySelector("[class*='price'], [class*='Price'], [class*='yen']");
          const price = priceEl?.textContent?.trim() || "";
          const ratingEl = card.querySelector("[class*='rating'], [class*='star'], [class*='score']");
          const rating = ratingEl?.textContent?.trim() || "";
          const reviewEl = card.querySelector("[class*='review'], [class*='count']");
          const reviewCount = reviewEl?.textContent?.trim() || "";
          const imgEl = card.querySelector("img");
          const image = imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";
          const descEl = card.querySelector("p, [class*='desc'], [class*='text']");
          const description = descEl?.textContent?.trim() || "";

          found.push({ title, url: link, price, rating, reviewCount, image, description });
        });
        return found;
      });

      for (const item of items) {
        results.push({
          ...item,
          priceNum: parseJPY(item.price),
          currency: "JPY",
          city,
          region,
          platform: "activityjapan",
          categories: ["experience"],
        });
      }
      console.log(`  Found ${items.length} items`);
    } catch (e: any) {
      console.error(`  Error ${city}: ${e.message}`);
    }
    await delay(3000 + Math.random() * 2000);
  }

  await page.close();
  return results;
}

// ============ Jalan (fixed URL to use asobi/activity) ============
async function scrapeJalan(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n[Jalan] Scraping jalan.net...");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1440, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://www.jalan.net/kankou/130000/g2/", city: "Tokyo", region: "Kanto" },
    { url: "https://www.jalan.net/kankou/260000/g2/", city: "Kyoto", region: "Kansai" },
    { url: "https://www.jalan.net/kankou/270000/g2/", city: "Osaka", region: "Kansai" },
    { url: "https://www.jalan.net/kankou/200000/g2/", city: "Nagano", region: "Chubu" },
    { url: "https://www.jalan.net/kankou/010000/g2/", city: "Hokkaido", region: "Hokkaido" },
    { url: "https://www.jalan.net/kankou/470000/g2/", city: "Okinawa", region: "Okinawa" },
  ];

  for (const { url, city, region } of urls) {
    try {
      console.log(`  Fetching: ${city}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2000);
      await scrollPage(page, 8);

      const items = await page.evaluate(() => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll("a[href]").forEach((el) => {
          const link = (el as HTMLAnchorElement).href;
          if (!link || seen.has(link)) return;
          if (!link.includes("jalan.net/kankou/") && !link.includes("jalan.net/activity")) return;
          if (link === window.location.href) return;
          seen.add(link);

          const card =
            el.closest("[class*='card']") ||
            el.closest("[class*='cassette']") ||
            el.closest("[class*='item']") ||
            el.closest("article") ||
            el.closest("li") ||
            el;

          const title =
            card.querySelector("h2, h3, h4, [class*='title'], [class*='name'], [class*='heading']")
              ?.textContent?.trim() || "";
          if (!title || title.length < 3 || title.length > 200) return;

          const priceEl = card.querySelector("[class*='price'], [class*='yen']");
          const price = priceEl?.textContent?.trim() || "";
          const ratingEl = card.querySelector("[class*='rating'], [class*='star'], [class*='score']");
          const rating = ratingEl?.textContent?.trim() || "";
          const reviewEl = card.querySelector("[class*='review'], [class*='count'], [class*='kuchikomi']");
          const reviewCount = reviewEl?.textContent?.trim() || "";
          const imgEl = card.querySelector("img");
          const image = imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";
          const descEl = card.querySelector("p, [class*='desc'], [class*='text'], [class*='comment']");
          const description = descEl?.textContent?.trim() || "";

          found.push({ title, url: link, price, rating, reviewCount, image, description });
        });
        return found;
      });

      for (const item of items) {
        results.push({
          ...item,
          priceNum: parseJPY(item.price),
          currency: "JPY",
          city,
          region,
          platform: "jalan",
          categories: ["experience", "sightseeing"],
        });
      }
      console.log(`  Found ${items.length} items`);
    } catch (e: any) {
      console.error(`  Error ${city}: ${e.message}`);
    }
    await delay(3000 + Math.random() * 2000);
  }

  await page.close();
  return results;
}

// ============ Go-Nagano (fixed URL) ============
async function scrapeGoNagano(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n[Go-Nagano] Scraping go-nagano.net...");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1440, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    "https://www.go-nagano.net/topics/experience",
    "https://www.go-nagano.net/search?category=experience",
    "https://www.go-nagano.net/search?category=food",
    "https://www.go-nagano.net/",
  ];

  for (const url of urls) {
    try {
      console.log(`  Fetching: ${url}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2000);
      await scrollPage(page, 10);

      const items = await page.evaluate(() => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll("a[href]").forEach((el) => {
          const link = (el as HTMLAnchorElement).href;
          if (!link || seen.has(link)) return;
          if (!link.includes("go-nagano.net")) return;
          if (link === window.location.href) return;
          // Skip navigation/footer links
          if (link.includes("/privacy") || link.includes("/about") || link.includes("/contact")) return;
          seen.add(link);

          const card =
            el.closest("[class*='card']") ||
            el.closest("[class*='Card']") ||
            el.closest("article") ||
            el.closest("li") ||
            el;

          const title =
            card.querySelector("h2, h3, h4, [class*='title'], [class*='name'], [class*='heading'], span, p")
              ?.textContent?.trim() || "";
          if (!title || title.length < 3 || title.length > 150) return;
          // Skip if title is just a category/button
          if (title.match(/^(home|menu|top|en|jp|search|more)$/i)) return;

          const imgEl = card.querySelector("img");
          const image = imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";
          const descEl = card.querySelector("p, [class*='desc'], [class*='text']");
          const description = descEl?.textContent?.trim() || "";

          found.push({ title, url: link, image, description });
        });
        return found;
      });

      for (const item of items) {
        if (item.title.length < 5) continue;
        results.push({
          title: item.title,
          url: item.url,
          image: item.image,
          price: "",
          priceNum: 0,
          currency: "JPY",
          rating: "",
          reviewCount: "",
          city: "Nagano",
          region: "Chubu",
          platform: "go-nagano",
          description: item.description || `${item.title} - 長野県`,
          categories: ["experience", "regional"],
        });
      }
      console.log(`  Found ${items.length} items (kept ${results.length} total)`);
    } catch (e: any) {
      console.error(`  Error: ${e.message}`);
    }
    await delay(3000 + Math.random() * 2000);
  }

  await page.close();
  return results;
}

// ============ Main ============
async function main() {
  console.log("=== Bear Travel - Fix Scraper (sites that failed) ===\n");

  mkdirSync(join(process.cwd(), "data"), { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  let allResults: ScrapedItem[] = [];

  try {
    const byfood = await scrapeByfood(browser);
    allResults.push(...byfood);

    const magicalTrip = await scrapeMagicalTrip(browser);
    allResults.push(...magicalTrip);

    const activityJapan = await scrapeActivityJapan(browser);
    allResults.push(...activityJapan);

    const jalan = await scrapeJalan(browser);
    allResults.push(...jalan);

    const goNagano = await scrapeGoNagano(browser);
    allResults.push(...goNagano);
  } finally {
    await browser.close();
  }

  // Deduplicate
  const deduped = Array.from(
    new Map(allResults.map((item) => [item.url, item])).values()
  );

  // Normalize
  const experiences = deduped
    .filter((item) => item.title && item.title.length >= 5)
    .map((item) => {
      const slug = slugify(item.title);
      if (!slug) return null;

      return {
        id: `${item.platform}-${item.city.toLowerCase()}-${slug}`,
        slug: `${item.city.toLowerCase()}-${slug}`,
        title: item.title,
        description: item.description || `${item.title} in ${item.city}, Japan.`,
        shortDescription: (item.description || `${item.title} in ${item.city}`).slice(0, 150),
        price: {
          amount: item.priceNum,
          currency: item.currency,
          display: item.priceNum
            ? item.currency === "JPY"
              ? `¥${item.priceNum.toLocaleString()}`
              : `$${item.priceNum}`
            : "Price varies",
        },
        duration: { hours: 2, display: "Varies" },
        rating: {
          score: item.rating ? parseFloat(item.rating.match(/[\d.]+/)?.[0] || "0") : 0,
          count: item.reviewCount
            ? parseInt(item.reviewCount.replace(/[^\d]/g, "") || "0", 10)
            : 0,
        },
        images: item.image ? [item.image] : [],
        thumbnail: item.image || "",
        location: {
          city: item.city,
          citySlug: item.city.toLowerCase(),
          region: item.region || "",
        },
        categories: item.categories,
        themes: [],
        highlights: [],
        source: {
          platform: item.platform,
          url: item.url,
          productId: slug,
          lastScraped: new Date().toISOString(),
        },
        bookingUrl: item.url,
        isPopular: false,
        isFeatured: false,
      };
    })
    .filter(Boolean);

  // Merge with existing batch-new-sites.json
  const existingPath = join(process.cwd(), "data", "batch-new-sites.json");
  let existing: any[] = [];
  try {
    existing = JSON.parse(readFileSync(existingPath, "utf-8"));
  } catch {}

  const merged = [...existing, ...experiences];
  const finalDeduped = Array.from(
    new Map(merged.map((item: any) => [item.id, item])).values()
  );

  writeFileSync(existingPath, JSON.stringify(finalDeduped, null, 2));

  console.log(`\n=== Summary ===`);
  console.log(`New items scraped: ${experiences.length}`);
  console.log(`Previous items: ${existing.length}`);
  console.log(`Final total (deduped): ${finalDeduped.length}`);
  console.log(`\nBy platform (new):`);
  const platforms = new Map<string, number>();
  for (const item of deduped) {
    platforms.set(item.platform, (platforms.get(item.platform) || 0) + 1);
  }
  for (const [platform, count] of platforms) {
    console.log(`  ${platform}: ${count}`);
  }
  console.log(`\nSaved to ${existingPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
