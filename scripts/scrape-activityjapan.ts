/**
 * Activity Japan scraper - their JP pages seem less protected
 * Try fetching activity listing pages directly with curl-like approach
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync } from "fs";
import { join } from "path";
import type { Page } from "puppeteer";

puppeteer.use(StealthPlugin());

const TOKYO_URLS = [
  "https://activityjapan.com/publish/plan_list/13/0/0/0/0",
  "https://activityjapan.com/publish/feature/54",
  "https://activityjapan.com/search/130000/",
];

const CATEGORY_URLS = [
  { url: "https://activityjapan.com/search/?area_id=13&category_id=2", category: "crafts" },
  { url: "https://activityjapan.com/search/?area_id=13&category_id=1", category: "outdoor" },
  { url: "https://activityjapan.com/search/?area_id=13&category_id=3", category: "water_sports" },
  { url: "https://activityjapan.com/search/?area_id=13&category_id=5", category: "culture" },
  { url: "https://activityjapan.com/search/?area_id=13&category_id=7", category: "entertainment" },
];

interface ScrapedItem {
  title: string;
  url: string;
  image: string;
  price: string;
  rating: string;
  reviewCount: string;
  area: string;
  category: string;
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function scrapeListPage(page: Page, url: string, category: string): Promise<ScrapedItem[]> {
  try {
    // Set a very realistic browser profile
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1440, height: 900 });

    // Set extra headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(3000);

    // Check if blocked
    const content = await page.content();
    if (content.includes("cf-challenge") || content.includes("Just a moment")) {
      console.log(`    ❌ Cloudflare blocked`);
      return [];
    }

    // Print page title for debug
    const title = await page.title();
    console.log(`    Page title: "${title.slice(0, 60)}"`);

    // Scroll to load lazy content
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await delay(500);
    }

    const items = await page.evaluate((cat: string) => {
      const results: ScrapedItem[] = [];

      // Try various selectors that Activity Japan might use
      const cards = document.querySelectorAll(
        '[class*="planCard"], [class*="plan-card"], [class*="PlanCard"], ' +
        '[class*="activity-card"], [class*="ActivityCard"], ' +
        'article, [class*="searchResult"], [class*="search-result"]'
      );

      console.log(`Found ${cards.length} potential cards`);

      cards.forEach((card) => {
        const link = card.querySelector("a[href]");
        const img = card.querySelector("img");
        const titleEl = card.querySelector("h2, h3, h4, [class*='title'], [class*='name']");

        if (!link || !img) return;

        const href = link.getAttribute("href") || "";
        const imgSrc = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || "";
        let itemTitle = titleEl?.textContent?.trim() || link.textContent?.trim().split("\n")[0]?.trim() || "";

        if (!itemTitle || itemTitle.length < 3 || !imgSrc) return;
        if (imgSrc.includes("icon") || imgSrc.includes("logo") || imgSrc.includes("1x1")) return;

        // Get price
        const allText = card.textContent || "";
        const priceMatch = allText.match(/(\d{1,3}(?:,\d{3})*)\s*円/g);
        const price = priceMatch ? priceMatch[0] : "";

        // Get rating
        const ratingMatch = allText.match(/(\d\.\d+)/);
        const rating = ratingMatch ? ratingMatch[1] : "";

        // Get review count
        const reviewMatch = allText.match(/(\d+)\s*件/);
        const reviewCount = reviewMatch ? reviewMatch[1] : "";

        results.push({
          title: itemTitle.slice(0, 200),
          url: href.startsWith("http") ? href : `https://activityjapan.com${href}`,
          image: imgSrc.startsWith("http") ? imgSrc : `https://activityjapan.com${imgSrc}`,
          price,
          rating,
          reviewCount,
          area: "Tokyo",
          category: cat,
        });
      });

      // Fallback: try to find any links with images
      if (results.length === 0) {
        const allLinks = document.querySelectorAll('a[href*="/plan/"], a[href*="/publish/plan/"]');
        allLinks.forEach((link) => {
          const img = link.querySelector("img") || link.parentElement?.querySelector("img");
          if (!img) return;

          const href = link.getAttribute("href") || "";
          const imgSrc = img.getAttribute("src") || img.getAttribute("data-src") || "";
          const title = link.textContent?.trim().split("\n")[0]?.trim() || "";

          if (title.length > 3 && imgSrc && imgSrc.startsWith("http")) {
            results.push({
              title: title.slice(0, 200),
              url: href.startsWith("http") ? href : `https://activityjapan.com${href}`,
              image: imgSrc,
              price: "",
              rating: "",
              reviewCount: "",
              area: "Tokyo",
              category: cat,
            });
          }
        });
      }

      return results;
    }, category);

    return items;
  } catch (err) {
    console.log(`    Error: ${(err as Error).message?.slice(0, 80)}`);
    return [];
  }
}

async function main() {
  console.log("🐻 Activity Japan scraper\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });

  const page = await browser.newPage();

  // Override webdriver detection
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    // @ts-ignore
    window.chrome = { runtime: {} };
  });

  const allItems: ScrapedItem[] = [];
  const seenUrls = new Set<string>();

  // Try category URLs
  for (const { url, category } of CATEGORY_URLS) {
    console.log(`  Trying: ${url}`);
    const items = await scrapeListPage(page, url, category);
    console.log(`    Got ${items.length} items`);

    for (const item of items) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        allItems.push(item);
      }
    }

    await delay(3000 + Math.random() * 2000);
  }

  // Try direct URLs
  for (const url of TOKYO_URLS) {
    console.log(`  Trying: ${url}`);
    const items = await scrapeListPage(page, url, "general");
    console.log(`    Got ${items.length} items`);

    for (const item of items) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        allItems.push(item);
      }
    }

    await delay(3000 + Math.random() * 2000);
  }

  await browser.close();

  console.log(`\n✅ Total: ${allItems.length} unique items`);

  if (allItems.length > 0) {
    const outputPath = join(process.cwd(), "data", "activityjapan-raw.json");
    writeFileSync(outputPath, JSON.stringify(allItems, null, 2));
    console.log(`💾 Saved to ${outputPath}`);
  }
}

main().catch(console.error);
