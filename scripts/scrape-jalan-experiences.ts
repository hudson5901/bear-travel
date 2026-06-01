/**
 * Jalan Experience/Activity Scraper
 * Jalan's activity section (jalan.net/activity) is different from their hotel section
 * and may be less protected. Try their "遊び・体験" (play/experience) section.
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync } from "fs";
import { join } from "path";
import type { Page } from "puppeteer";

puppeteer.use(StealthPlugin());

// Jalan activity/experience URLs for Tokyo area
const JALAN_ACTIVITY_URLS = [
  // 東京 遊び・体験
  { url: "https://www.jalan.net/kankou/spt_guide000000209953/activity/", city: "Tokyo", category: "general" },
  // Area-based activity listings
  { url: "https://www.jalan.net/activity/japan/tokyo/", city: "Tokyo", category: "general" },
  { url: "https://www.jalan.net/activity/130000/", city: "Tokyo", category: "general" },
  // Category specific (Tokyo)
  { url: "https://www.jalan.net/activity/130000/010/", city: "Tokyo", category: "crafts" },
  { url: "https://www.jalan.net/activity/130000/011/", city: "Tokyo", category: "food" },
  { url: "https://www.jalan.net/activity/130000/012/", city: "Tokyo", category: "culture" },
  // Kyoto
  { url: "https://www.jalan.net/activity/260000/", city: "Kyoto", category: "general" },
  // Osaka
  { url: "https://www.jalan.net/activity/270000/", city: "Osaka", category: "general" },
];

// Also try their "net遊び" section
const JALAN_PLAY_URLS = [
  { url: "https://www.jalan.net/play/", city: "Tokyo", category: "play" },
  { url: "https://www.jalan.net/play/spt_area130000/", city: "Tokyo", category: "play" },
];

interface ScrapedItem {
  title: string;
  url: string;
  image: string;
  price: string;
  rating: string;
  reviewCount: string;
  city: string;
  category: string;
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function scrapePage(page: Page, url: string, city: string, category: string): Promise<ScrapedItem[]> {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
    await delay(2000);

    // Check if we got a real page
    const title = await page.title();
    console.log(`    Title: "${title.slice(0, 50)}"`);

    const content = await page.content();
    if (content.includes("cf-challenge") || content.includes("captcha")) {
      console.log("    ❌ Blocked");
      return [];
    }

    // Scroll down
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await delay(400);
    }

    const items = await page.evaluate((c: string, cat: string) => {
      const results: ScrapedItem[] = [];
      const seen = new Set<string>();

      // Strategy 1: Find activity cards/links
      const allLinks = document.querySelectorAll('a[href*="/activity/"], a[href*="/kankou/"], a[href*="/play/"]');

      allLinks.forEach((link) => {
        const href = link.getAttribute("href") || "";
        if (seen.has(href)) return;

        // Look for image near this link
        const container = link.closest("li, article, div[class*='card'], div[class*='item'], div[class*='list']") || link.parentElement;
        if (!container) return;

        const img = container.querySelector("img");
        if (!img) return;

        const imgSrc = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-original") || "";
        if (!imgSrc || imgSrc.includes("icon") || imgSrc.includes("logo") || imgSrc.includes("blank") || imgSrc.includes("spacer")) return;

        // Get title
        let titleText = "";
        const titleEl = container.querySelector("h2, h3, h4, [class*='title'], [class*='name'], strong");
        if (titleEl) {
          titleText = titleEl.textContent?.trim() || "";
        }
        if (!titleText) {
          titleText = link.textContent?.trim().split("\n")[0]?.trim() || "";
        }
        if (!titleText || titleText.length < 3 || titleText.length > 200) return;

        // Get price
        const allText = container.textContent || "";
        const priceMatch = allText.match(/(\d{1,3}(?:,\d{3})*)\s*円/g);
        const price = priceMatch ? priceMatch[0] : "";

        // Get rating/reviews
        const ratingMatch = allText.match(/(\d\.\d)/);
        const rating = ratingMatch ? ratingMatch[1] : "";
        const reviewMatch = allText.match(/(\d+)\s*件/);
        const reviewCount = reviewMatch ? reviewMatch[1] : "";

        seen.add(href);
        results.push({
          title: titleText.slice(0, 200),
          url: href.startsWith("http") ? href : `https://www.jalan.net${href}`,
          image: imgSrc.startsWith("http") ? imgSrc : `https://www.jalan.net${imgSrc}`,
          price,
          rating,
          reviewCount,
          city: c,
          category: cat,
        });
      });

      // Strategy 2: Find any image cards on the page
      if (results.length === 0) {
        const imgs = document.querySelectorAll("img[src*='jalan'], img[data-src*='jalan'], img[src*='photo']");
        imgs.forEach((img) => {
          const imgSrc = img.getAttribute("src") || img.getAttribute("data-src") || "";
          if (!imgSrc || imgSrc.includes("icon") || imgSrc.includes("logo")) return;

          const parent = img.closest("a") || img.parentElement?.closest("a");
          if (!parent) return;

          const href = parent.getAttribute("href") || "";
          if (!href || seen.has(href)) return;

          const titleText = img.getAttribute("alt") || parent.textContent?.trim().split("\n")[0]?.trim() || "";
          if (!titleText || titleText.length < 3) return;

          seen.add(href);
          results.push({
            title: titleText.slice(0, 200),
            url: href.startsWith("http") ? href : `https://www.jalan.net${href}`,
            image: imgSrc.startsWith("http") ? imgSrc : `https://www.jalan.net${imgSrc}`,
            price: "",
            rating: "",
            reviewCount: "",
            city: c,
            category: cat,
          });
        });
      }

      return results;
    }, city, category);

    return items;
  } catch (err) {
    console.log(`    Error: ${(err as Error).message?.slice(0, 80)}`);
    return [];
  }
}

async function main() {
  console.log("🐻 Jalan Activity/Experience Scraper\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({
    "Accept-Language": "ja,en-US;q=0.9",
  });

  const allItems: ScrapedItem[] = [];
  const seenUrls = new Set<string>();

  console.log("=== Jalan Activity Pages ===");
  for (const { url, city, category } of JALAN_ACTIVITY_URLS) {
    console.log(`  ${url}`);
    const items = await scrapePage(page, url, city, category);
    console.log(`    Found: ${items.length} items`);
    for (const item of items) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        allItems.push(item);
      }
    }
    await delay(2000 + Math.random() * 2000);
  }

  console.log("\n=== Jalan Play/遊び Pages ===");
  for (const { url, city, category } of JALAN_PLAY_URLS) {
    console.log(`  ${url}`);
    const items = await scrapePage(page, url, city, category);
    console.log(`    Found: ${items.length} items`);
    for (const item of items) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        allItems.push(item);
      }
    }
    await delay(2000 + Math.random() * 2000);
  }

  await browser.close();

  console.log(`\n✅ Total unique items: ${allItems.length}`);
  const withImages = allItems.filter(i => i.image && !i.image.includes("spacer"));
  console.log(`  With images: ${withImages.length}`);
  const withPrices = allItems.filter(i => i.price);
  console.log(`  With prices: ${withPrices.length}`);

  if (allItems.length > 0) {
    const outputPath = join(process.cwd(), "data", "jalan-activities.json");
    writeFileSync(outputPath, JSON.stringify(allItems, null, 2));
    console.log(`💾 Saved to ${outputPath}`);
  }
}

main().catch(console.error);
