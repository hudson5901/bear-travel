/**
 * TripAdvisor Tokyo Activities Scraper
 * TripAdvisor's pages may be accessible as they serve content to search engines
 * This gets us Viator-quality data since Viator IS TripAdvisor's tours platform
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync } from "fs";
import { join } from "path";
import type { Page } from "puppeteer";

puppeteer.use(StealthPlugin());

const TRIPADVISOR_URLS = [
  // TripAdvisor Tokyo attractions/activities
  "https://www.tripadvisor.com/Attractions-g298184-Activities-Tokyo_Tokyo_Prefecture_Kanto.html",
  // Things to do with categories
  "https://www.tripadvisor.com/Attractions-g298184-Activities-c42-Tokyo_Tokyo_Prefecture_Kanto.html", // Tours
  "https://www.tripadvisor.com/Attractions-g298184-Activities-c61-Tokyo_Tokyo_Prefecture_Kanto.html", // Classes
  "https://www.tripadvisor.com/Attractions-g298184-Activities-c40-Tokyo_Tokyo_Prefecture_Kanto.html", // Food & Drink
  // Kyoto
  "https://www.tripadvisor.com/Attractions-g298564-Activities-c42-Kyoto_Kyoto_Prefecture_Kinki.html",
  "https://www.tripadvisor.com/Attractions-g298564-Activities-c61-Kyoto_Kyoto_Prefecture_Kinki.html",
  // Osaka
  "https://www.tripadvisor.com/Attractions-g298566-Activities-c42-Osaka_Osaka_Prefecture_Kinki.html",
];

interface ScrapedItem {
  title: string;
  url: string;
  image: string;
  price: string;
  priceNum: number;
  rating: string;
  reviewCount: string;
  city: string;
  category: string;
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function scrapeTAPage(page: Page, url: string, city: string): Promise<ScrapedItem[]> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await delay(3000);

    const title = await page.title();
    const content = await page.content();
    console.log(`    Title: "${title.slice(0, 60)}"`);

    // Check if blocked
    if (content.includes("cf-challenge") || content.includes("captcha") || content.includes("Access Denied")) {
      console.log("    ❌ Blocked");
      return [];
    }

    // Scroll
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await delay(400);
    }

    const items = await page.evaluate((c: string) => {
      const results: ScrapedItem[] = [];
      const seen = new Set<string>();

      // TripAdvisor card patterns
      const cards = document.querySelectorAll(
        '[data-automation="cardWrapper"], [class*="listing_card"], ' +
        '[class*="attraction_element"], [class*="result-card"], ' +
        'section[data-automation], article'
      );

      cards.forEach((card) => {
        const link = card.querySelector('a[href*="/Attraction_Review"], a[href*="/AttractionProductReview"]');
        if (!link) return;

        const href = link.getAttribute("href") || "";
        if (seen.has(href) || !href) return;

        // Image
        const img = card.querySelector("img");
        let imgSrc = "";
        if (img) {
          imgSrc = img.getAttribute("src") || img.getAttribute("data-src") || "";
          if (imgSrc.includes("photo-s") || imgSrc.includes("photo-l") || imgSrc.includes("media-cdn")) {
            // Good TA image
          } else if (imgSrc.includes("default") || imgSrc.includes("logo")) {
            imgSrc = "";
          }
        }

        // Title
        let titleText = card.querySelector("h2, h3, [class*='title']")?.textContent?.trim() || "";
        if (!titleText) titleText = link.textContent?.trim().split("\n")[0]?.trim() || "";
        if (!titleText || titleText.length < 3) return;

        // Price
        const allText = card.textContent || "";
        const priceMatch = allText.match(/from\s*\$(\d+)/i) || allText.match(/\$(\d+)/);
        const priceNum = priceMatch ? parseInt(priceMatch[1]) : 0;
        const price = priceMatch ? `$${priceMatch[1]}` : "";

        // Rating
        const ratingEl = card.querySelector('[class*="bubble_"], [class*="rating"], svg[aria-label]');
        let rating = "";
        if (ratingEl) {
          const ariaLabel = ratingEl.getAttribute("aria-label") || "";
          const rMatch = ariaLabel.match(/(\d\.\d)/);
          if (rMatch) rating = rMatch[1];
        }

        // Review count
        const reviewMatch = allText.match(/(\d{1,3}(?:,\d{3})*)\s*(?:reviews|件)/i);
        const reviewCount = reviewMatch ? reviewMatch[1] : "";

        seen.add(href);
        results.push({
          title: titleText.slice(0, 200),
          url: href.startsWith("http") ? href : `https://www.tripadvisor.com${href}`,
          image: imgSrc,
          price,
          priceNum,
          rating,
          reviewCount,
          city: c,
          category: "tours",
        });
      });

      // Fallback - broader search
      if (results.length === 0) {
        const allLinks = document.querySelectorAll('a[href*="Attraction"]');
        allLinks.forEach((link) => {
          const href = link.getAttribute("href") || "";
          if (!href.includes("Review") || seen.has(href)) return;

          const parent = link.closest("div, li, article");
          if (!parent) return;

          const img = parent.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";

          const titleText = link.textContent?.trim().split("\n")[0]?.trim() || "";
          if (titleText.length < 3 || titleText.length > 200) return;

          seen.add(href);
          results.push({
            title: titleText,
            url: href.startsWith("http") ? href : `https://www.tripadvisor.com${href}`,
            image: imgSrc || "",
            price: "",
            priceNum: 0,
            rating: "",
            reviewCount: "",
            city: c,
            category: "attractions",
          });
        });
      }

      return results;
    }, city);

    return items;
  } catch (err) {
    console.log(`    Error: ${(err as Error).message?.slice(0, 80)}`);
    return [];
  }
}

async function main() {
  console.log("🐻 TripAdvisor Tokyo Activities Scraper\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1280, height: 900 });

  // Override webdriver
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const allItems: ScrapedItem[] = [];
  const seenUrls = new Set<string>();

  const cityFromUrl = (url: string): string => {
    if (url.includes("g298184")) return "Tokyo";
    if (url.includes("g298564")) return "Kyoto";
    if (url.includes("g298566")) return "Osaka";
    return "Tokyo";
  };

  for (const url of TRIPADVISOR_URLS) {
    const city = cityFromUrl(url);
    console.log(`  ${city}: ${url.slice(0, 80)}...`);
    const items = await scrapeTAPage(page, url, city);
    console.log(`    Got ${items.length} items`);

    for (const item of items) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        allItems.push(item);
      }
    }
    await delay(3000 + Math.random() * 3000);
  }

  await browser.close();

  console.log(`\n✅ Total: ${allItems.length} unique items`);
  const withImages = allItems.filter(i => i.image);
  console.log(`  With images: ${withImages.length}`);

  if (allItems.length > 0) {
    const outputPath = join(process.cwd(), "data", "tripadvisor-raw.json");
    writeFileSync(outputPath, JSON.stringify(allItems, null, 2));
    console.log(`💾 Saved to ${outputPath}`);
  }
}

main().catch(console.error);
