/**
 * Scrape newly discovered accessible platforms:
 * - VELTRA (English) - major tour platform
 * - GoWithGuide - private tours with pricing
 * - Otonami - premium Japanese experiences
 * - DeepExperience - cultural tours
 * - Travelko - activity aggregator
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync } from "fs";
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
  platform: string;
  description: string;
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============ VELTRA (English) ============
async function scrapeVeltra(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n📍 VELTRA (English) - Major tour platform");
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://www.veltra.com/en/asia/japan/tokyo/", city: "Tokyo" },
    { url: "https://www.veltra.com/en/asia/japan/tokyo/ctg/5890/", city: "Tokyo" }, // Culture
    { url: "https://www.veltra.com/en/asia/japan/tokyo/ctg/167/", city: "Tokyo" }, // Food
    { url: "https://www.veltra.com/en/asia/japan/kyoto/", city: "Kyoto" },
    { url: "https://www.veltra.com/en/asia/japan/osaka/", city: "Osaka" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  ${city}: ${url.split("/").slice(-3).join("/")}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
      await delay(2000);

      // Scroll
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.scrollBy(0, 600));
        await delay(400);
      }

      const items = await page.evaluate((c: string) => {
        const found: ScrapedItem[] = [];
        const seen = new Set<string>();

        // VELTRA uses product cards
        const cards = document.querySelectorAll('[class*="product"], [class*="activity"], [class*="tour"], article, [class*="card"]');
        cards.forEach((card) => {
          const link = card.querySelector("a[href*='/en/asia/japan/']");
          if (!link) return;

          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href) return;

          const img = card.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
          if (!imgSrc || imgSrc.includes("logo") || imgSrc.includes("icon")) return;

          // Title
          const titleEl = card.querySelector("h2, h3, h4, [class*='title'], [class*='name']");
          let title = titleEl?.textContent?.trim() || "";
          if (!title) title = img?.getAttribute("alt") || "";
          if (!title || title.length < 5) return;

          // Price
          const allText = card.textContent || "";
          const priceMatch = allText.match(/(?:USD|US\$|\$)\s*(\d+(?:\.\d{2})?)/i) || allText.match(/(\d+(?:\.\d{2})?)\s*(?:USD)/i);
          const priceNum = priceMatch ? parseFloat(priceMatch[1]) : 0;

          // Rating
          const ratingMatch = allText.match(/(\d\.\d+)\s*(?:\/\s*5|stars?)/i);
          const rating = ratingMatch ? ratingMatch[1] : "";

          // Reviews
          const reviewMatch = allText.match(/(\d+)\s*(?:reviews?|ratings?)/i);
          const reviewCount = reviewMatch ? reviewMatch[1] : "";

          seen.add(href);
          found.push({
            title: title.slice(0, 200),
            url: href.startsWith("http") ? href : `https://www.veltra.com${href}`,
            image: imgSrc.startsWith("http") ? imgSrc : `https://www.veltra.com${imgSrc}`,
            price: priceNum > 0 ? `$${priceNum}` : "",
            priceNum,
            currency: "USD",
            rating,
            reviewCount,
            city: c,
            platform: "veltra",
            description: "",
          });
        });

        return found;
      }, city);

      console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 60)}`);
    }
    await delay(2000 + Math.random() * 2000);
  }

  await page.close();
  return results;
}

// ============ GoWithGuide ============
async function scrapeGoWithGuide(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n📍 GoWithGuide - Private tour guides");
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://www.gowithguide.com/japan/tokyo", city: "Tokyo" },
    { url: "https://www.gowithguide.com/japan/kyoto", city: "Kyoto" },
    { url: "https://www.gowithguide.com/japan/osaka", city: "Osaka" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  ${city}: ${url}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
      await delay(2000);

      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.scrollBy(0, 600));
        await delay(400);
      }

      const items = await page.evaluate((c: string) => {
        const found: ScrapedItem[] = [];
        const seen = new Set<string>();

        const cards = document.querySelectorAll('[class*="tour"], [class*="card"], [class*="item"], article');
        cards.forEach((card) => {
          const link = card.querySelector("a[href*='tour'], a[href*='guide']");
          if (!link) return;

          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href) return;

          const img = card.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
          if (!imgSrc || imgSrc.includes("logo") || imgSrc.includes("icon") || imgSrc.includes("avatar")) return;

          const titleEl = card.querySelector("h2, h3, h4, [class*='title'], [class*='name']");
          let title = titleEl?.textContent?.trim() || img?.getAttribute("alt") || "";
          if (!title || title.length < 5) return;

          const allText = card.textContent || "";
          const priceMatch = allText.match(/\$\s*(\d+)/);
          const priceNum = priceMatch ? parseInt(priceMatch[1]) : 0;

          const ratingMatch = allText.match(/(\d\.\d)/);
          const rating = ratingMatch ? ratingMatch[1] : "";

          const reviewMatch = allText.match(/(\d+)\s*review/i);
          const reviewCount = reviewMatch ? reviewMatch[1] : "";

          seen.add(href);
          found.push({
            title: title.slice(0, 200),
            url: href.startsWith("http") ? href : `https://www.gowithguide.com${href}`,
            image: imgSrc.startsWith("http") ? imgSrc : `https://www.gowithguide.com${imgSrc}`,
            price: priceNum > 0 ? `$${priceNum}` : "",
            priceNum,
            currency: "USD",
            rating,
            reviewCount,
            city: c,
            platform: "gowithguide",
            description: "",
          });
        });

        return found;
      }, city);

      console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 60)}`);
    }
    await delay(3000);
  }

  await page.close();
  return results;
}

// ============ Otonami ============
async function scrapeOtonami(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n📍 Otonami - Premium Japanese experiences");
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "ja,en-US;q=0.9" });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://otonami.jp/experiences/", city: "Tokyo" },
    { url: "https://otonami.jp/experiences/?area=tokyo", city: "Tokyo" },
    { url: "https://otonami.jp/experiences/?area=kyoto", city: "Kyoto" },
    { url: "https://otonami.jp/experiences/?area=osaka", city: "Osaka" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  ${city}: ${url.split("?")[1] || "all"}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
      await delay(2000);

      for (let i = 0; i < 15; i++) {
        await page.evaluate(() => window.scrollBy(0, 500));
        await delay(300);
      }

      const items = await page.evaluate((c: string) => {
        const found: ScrapedItem[] = [];
        const seen = new Set<string>();

        const cards = document.querySelectorAll('a[href*="/experiences/"], article, [class*="card"], [class*="item"]');
        cards.forEach((card) => {
          const link = card.closest("a") || card.querySelector("a[href*='experience']");
          if (!link) return;

          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href || href === "/experiences/") return;

          const img = card.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
          if (!imgSrc || imgSrc.includes("logo")) return;

          let title = "";
          const titleEl = card.querySelector("h2, h3, h4, [class*='title'], [class*='name'], p");
          if (titleEl) title = titleEl.textContent?.trim() || "";
          if (!title) title = img?.getAttribute("alt") || "";
          if (!title || title.length < 3) return;

          const allText = card.textContent || "";
          const priceMatch = allText.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
          const priceNum = priceMatch ? parseInt(priceMatch[1].replace(/,/g, "")) : 0;

          seen.add(href);
          found.push({
            title: title.slice(0, 200),
            url: href.startsWith("http") ? href : `https://otonami.jp${href}`,
            image: imgSrc.startsWith("http") ? imgSrc : `https://otonami.jp${imgSrc}`,
            price: priceNum > 0 ? `${priceNum.toLocaleString()}円` : "",
            priceNum: priceNum > 0 ? Math.round(priceNum / 155) : 0,
            currency: "USD",
            rating: "",
            reviewCount: "",
            city: c,
            platform: "otonami",
            description: "",
          });
        });

        return found;
      }, city);

      console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 60)}`);
    }
    await delay(2000);
  }

  await page.close();
  return results;
}

// ============ DeepExperience ============
async function scrapeDeepExperience(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n📍 DeepExperience - Cultural tours");
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://www.deep-exp.com/en/tokyo", city: "Tokyo" },
    { url: "https://www.deep-exp.com/en/kyoto", city: "Kyoto" },
    { url: "https://www.deep-exp.com/en/osaka", city: "Osaka" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  ${city}: ${url}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
      await delay(2000);

      for (let i = 0; i < 8; i++) {
        await page.evaluate(() => window.scrollBy(0, 600));
        await delay(300);
      }

      const items = await page.evaluate((c: string) => {
        const found: ScrapedItem[] = [];
        const seen = new Set<string>();

        const links = document.querySelectorAll('a[href*="experience"], a[href*="tour"], a[href*="activity"]');
        links.forEach((link) => {
          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href) return;

          const card = link.closest("article, [class*='card'], [class*='item'], div") || link;
          const img = card.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
          if (!imgSrc || imgSrc.includes("logo") || imgSrc.includes("icon")) return;

          let title = card.querySelector("h2, h3, h4, [class*='title']")?.textContent?.trim() || "";
          if (!title) title = img?.getAttribute("alt") || link.textContent?.trim().split("\n")[0]?.trim() || "";
          if (!title || title.length < 5) return;

          const allText = card.textContent || "";
          const priceMatch = allText.match(/(?:\$|¥|USD)\s*(\d+(?:,\d+)*)/);
          let priceNum = 0;
          if (priceMatch) {
            priceNum = parseInt(priceMatch[1].replace(/,/g, ""));
            if (allText.includes("¥")) priceNum = Math.round(priceNum / 155);
          }

          seen.add(href);
          found.push({
            title: title.slice(0, 200),
            url: href.startsWith("http") ? href : `https://www.deep-exp.com${href}`,
            image: imgSrc.startsWith("http") ? imgSrc : `https://www.deep-exp.com${imgSrc}`,
            price: priceNum > 0 ? `$${priceNum}` : "",
            priceNum,
            currency: "USD",
            rating: "",
            reviewCount: "",
            city: c,
            platform: "deepexperience",
            description: "",
          });
        });

        return found;
      }, city);

      console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 60)}`);
    }
    await delay(3000);
  }

  await page.close();
  return results;
}

async function main() {
  console.log("🐻 Scraping new accessible platforms\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });

  const veltra = await scrapeVeltra(browser);
  const goWithGuide = await scrapeGoWithGuide(browser);
  const otonami = await scrapeOtonami(browser);
  const deepExp = await scrapeDeepExperience(browser);

  await browser.close();

  const all = [...veltra, ...goWithGuide, ...otonami, ...deepExp];

  // Deduplicate
  const seenUrls = new Set<string>();
  const unique = all.filter(item => {
    if (seenUrls.has(item.url)) return false;
    seenUrls.add(item.url);
    return true;
  });

  console.log("\n\n📊 Final Results:");
  console.log(`  VELTRA: ${veltra.length}`);
  console.log(`  GoWithGuide: ${goWithGuide.length}`);
  console.log(`  Otonami: ${otonami.length}`);
  console.log(`  DeepExperience: ${deepExp.length}`);
  console.log(`  Total unique: ${unique.length}`);

  const withImages = unique.filter(i => i.image);
  const withPrices = unique.filter(i => i.priceNum > 0);
  console.log(`  With images: ${withImages.length}`);
  console.log(`  With prices: ${withPrices.length}`);

  if (unique.length > 0) {
    const outputPath = join(process.cwd(), "data", "new-platforms.json");
    writeFileSync(outputPath, JSON.stringify(unique, null, 2));
    console.log(`\n💾 Saved to ${outputPath}`);
  }
}

main().catch(console.error);
