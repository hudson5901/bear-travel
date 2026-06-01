/**
 * Klook & KKday scraper via their Japanese sites
 * Both have Japanese-language pages that may be less aggressively protected
 * Also tries their affiliate/widget embed endpoints
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
  rating: string;
  reviewCount: string;
  city: string;
  platform: string;
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// === KLOOK ===
// Try Klook's Japanese pages and their embed/widget endpoints
async function scrapeKlook(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n🔍 Klook - Japanese site approach");
  const page = await browser.newPage();
  const results: ScrapedItem[] = [];

  // Set as Japanese user
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );
  await page.setExtraHTTPHeaders({
    "Accept-Language": "ja,en-US;q=0.9",
  });

  // Klook URLs to try
  const klookUrls = [
    "https://www.klook.com/ja/city/1-tokyo-things-to-do/",
    "https://www.klook.com/ja/experiences/cat/things-to-do-tokyo-1/",
    "https://www.klook.com/ja/search/?query=tokyo%20activity&city_id=1",
    // Try their blog/article pages which often list tours
    "https://www.klook.com/ja/blog/tokyo-activities/",
    "https://www.klook.com/ja/blog/things-to-do-tokyo/",
  ];

  for (const url of klookUrls) {
    try {
      console.log(`  Trying: ${url.slice(0, 70)}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await delay(3000);

      const title = await page.title();
      const content = await page.content();
      const blocked = content.includes("cf-challenge") || content.includes("Just a moment") || content.includes("captcha");

      console.log(`    Title: "${title.slice(0, 50)}" ${blocked ? "❌ BLOCKED" : "✓"}`);

      if (!blocked && !title.includes("moment")) {
        // Try to extract data
        const items = await page.evaluate(() => {
          const found: { title: string; url: string; image: string; price: string }[] = [];
          const cards = document.querySelectorAll('[class*="activity"], [class*="card"], [class*="product"]');
          cards.forEach((card) => {
            const link = card.querySelector("a[href]");
            const img = card.querySelector("img");
            if (!link || !img) return;
            const href = link.getAttribute("href") || "";
            const imgSrc = img.getAttribute("src") || img.getAttribute("data-src") || "";
            const titleText = img.getAttribute("alt") || link.textContent?.trim().split("\n")[0]?.trim() || "";
            if (titleText.length > 3 && imgSrc && href) {
              found.push({ title: titleText, url: href, image: imgSrc, price: "" });
            }
          });
          return found;
        });
        console.log(`    Found ${items.length} items`);
        items.forEach(item => {
          results.push({
            ...item,
            priceNum: 0,
            rating: "",
            reviewCount: "",
            city: "Tokyo",
            platform: "klook",
          });
        });
      }
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 60)}`);
    }
    await delay(2000);
  }

  // Try Klook's search API (what their frontend uses)
  try {
    console.log("  Trying Klook search API...");
    const apiUrl = "https://www.klook.com/v2/usrcsrv/search/country/1/city/1/experiences?query=tokyo&start=0&size=50&frontend_currency=JPY";
    const res = await page.evaluate(async (url: string) => {
      try {
        const r = await fetch(url, {
          headers: { "Accept": "application/json" },
        });
        return { status: r.status, text: (await r.text()).slice(0, 500) };
      } catch (e) {
        return { status: 0, text: String(e) };
      }
    }, apiUrl);
    console.log(`    API: ${res.status} - ${res.text.slice(0, 100)}`);
  } catch (err) {
    console.log(`    API error: ${(err as Error).message?.slice(0, 60)}`);
  }

  await page.close();
  return results;
}

// === KKday ===
async function scrapeKKday(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n🔍 KKday - Japanese site approach");
  const page = await browser.newPage();
  const results: ScrapedItem[] = [];

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );
  await page.setExtraHTTPHeaders({
    "Accept-Language": "ja,en-US;q=0.9",
  });

  const kkdayUrls = [
    "https://www.kkday.com/ja/city/tokyo",
    "https://www.kkday.com/ja/product/productlist/A01-001-00003",
    "https://www.kkday.com/ja/product/productlist/A01-001-00003?cat=TAG_4_4",
    // Blog/curated pages
    "https://www.kkday.com/ja/blog/tokyo",
  ];

  for (const url of kkdayUrls) {
    try {
      console.log(`  Trying: ${url.slice(0, 70)}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await delay(3000);

      const title = await page.title();
      const content = await page.content();
      const blocked = content.includes("cf-challenge") || content.includes("Just a moment") || content.includes("captcha") || content.includes("Checking your browser");

      console.log(`    Title: "${title.slice(0, 50)}" ${blocked ? "❌ BLOCKED" : "✓"}`);

      if (!blocked) {
        const items = await page.evaluate(() => {
          const found: { title: string; url: string; image: string; price: string }[] = [];
          const cards = document.querySelectorAll('[class*="product"], [class*="card"], [class*="activity"], article');
          cards.forEach((card) => {
            const link = card.querySelector("a[href]");
            const img = card.querySelector("img");
            if (!link || !img) return;
            const href = link.getAttribute("href") || "";
            const imgSrc = img.getAttribute("src") || img.getAttribute("data-src") || "";
            const titleText = img.getAttribute("alt") || card.querySelector("h2,h3,h4")?.textContent?.trim() || "";
            if (titleText.length > 3 && imgSrc && href) {
              const allText = card.textContent || "";
              const priceMatch = allText.match(/[¥￥]\s*(\d{1,3}(?:,\d{3})*)/);
              found.push({
                title: titleText,
                url: href.startsWith("http") ? href : `https://www.kkday.com${href}`,
                image: imgSrc,
                price: priceMatch ? priceMatch[0] : "",
              });
            }
          });
          return found;
        });
        console.log(`    Found ${items.length} items`);
        items.forEach(item => {
          results.push({
            ...item,
            priceNum: 0,
            rating: "",
            reviewCount: "",
            city: "Tokyo",
            platform: "kkday",
          });
        });
      }
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 60)}`);
    }
    await delay(2000);
  }

  await page.close();
  return results;
}

// === Try fetching from Google Search cache ===
async function scrapeViaGoogleCache(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n🔍 Google Cache approach - fetching cached tour pages");
  const page = await browser.newPage();
  const results: ScrapedItem[] = [];

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );

  // Search Google for tours and get the structured data
  const searchQueries = [
    "site:viator.com Tokyo tours",
    "site:klook.com Tokyo activities",
    "site:kkday.com Tokyo tour",
    "site:getyourguide.com Tokyo",
  ];

  for (const query of searchQueries) {
    try {
      console.log(`  Searching: "${query}"`);
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20&hl=en`;
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      await delay(2000);

      const searchResults = await page.evaluate(() => {
        const found: { title: string; url: string; snippet: string }[] = [];
        const results = document.querySelectorAll(".g, [data-header-feature]");
        results.forEach((r) => {
          const link = r.querySelector("a[href]");
          const titleEl = r.querySelector("h3");
          const snippetEl = r.querySelector('[data-sncf], .VwiC3b, [class*="snippet"]');
          if (link && titleEl) {
            const href = link.getAttribute("href") || "";
            if (href.startsWith("http")) {
              found.push({
                title: titleEl.textContent?.trim() || "",
                url: href,
                snippet: snippetEl?.textContent?.trim() || "",
              });
            }
          }
        });
        return found;
      });

      console.log(`    Found ${searchResults.length} search results`);

      // Extract platform from URL
      for (const sr of searchResults) {
        let platform = "";
        if (sr.url.includes("viator.com")) platform = "viator";
        else if (sr.url.includes("klook.com")) platform = "klook";
        else if (sr.url.includes("kkday.com")) platform = "kkday";
        else if (sr.url.includes("getyourguide.com")) platform = "getyourguide";
        else continue;

        // Extract price from snippet
        const priceMatch = sr.snippet.match(/\$(\d+)/);
        const price = priceMatch ? priceMatch[0] : "";

        results.push({
          title: sr.title.replace(/ - Viator| - Klook| - KKday| \| GetYourGuide/g, "").trim(),
          url: sr.url,
          image: "", // Can't get from search results
          price,
          priceNum: priceMatch ? parseInt(priceMatch[1]) : 0,
          rating: "",
          reviewCount: "",
          city: "Tokyo",
          platform,
        });
      }
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 60)}`);
    }
    await delay(3000);
  }

  await page.close();
  return results;
}

async function main() {
  console.log("🐻 Klook & KKday scraper\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const klookResults = await scrapeKlook(browser);
  const kkdayResults = await scrapeKKday(browser);
  const googleResults = await scrapeViaGoogleCache(browser);

  await browser.close();

  const allResults = [...klookResults, ...kkdayResults, ...googleResults];

  console.log(`\n\n📊 Final Results:`);
  console.log(`  Klook: ${klookResults.length}`);
  console.log(`  KKday: ${kkdayResults.length}`);
  console.log(`  Google Cache: ${googleResults.length}`);
  console.log(`  Total: ${allResults.length}`);

  if (allResults.length > 0) {
    const outputPath = join(process.cwd(), "data", "klook-kkday-raw.json");
    writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
    console.log(`💾 Saved to ${outputPath}`);
  }
}

main().catch(console.error);
