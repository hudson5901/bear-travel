/**
 * Multi-site scraper - tries different anti-bot bypass strategies
 * Tests: curl-based, different user agents, mobile versions, API endpoints,
 * Google cache, and sitemap/RSS approaches
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync } from "fs";
import { join } from "path";
import type { Page } from "puppeteer";

puppeteer.use(StealthPlugin());

interface Result {
  title: string;
  url: string;
  image: string;
  price: string;
  rating: string;
  city: string;
  platform: string;
}

// ====== Strategy: Try mobile site versions (often less protected) ======
async function tryMobileSite(page: Page, url: string, platform: string): Promise<Result[]> {
  await page.setUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  );
  await page.setViewport({ width: 390, height: 844 });

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
    const content = await page.content();
    const blocked = ["cf-challenge", "captcha", "Just a moment", "Access denied"]
      .some(s => content.toLowerCase().includes(s.toLowerCase()));
    if (blocked) return [];

    return await page.evaluate((plat: string) => {
      const results: Result[] = [];
      const links = document.querySelectorAll("a[href]");
      links.forEach(link => {
        const img = link.querySelector("img");
        const title = link.textContent?.trim().split("\n")[0]?.trim() || "";
        const href = link.getAttribute("href") || "";
        if (img && title.length > 5 && title.length < 200) {
          const imgSrc = img.src || img.getAttribute("data-src") || "";
          if (imgSrc && imgSrc.startsWith("http")) {
            results.push({
              title,
              url: href.startsWith("http") ? href : "",
              image: imgSrc,
              price: "",
              rating: "",
              city: "Tokyo",
              platform: plat,
            });
          }
        }
      });
      return results.slice(0, 50);
    }, platform);
  } catch {
    return [];
  }
}

// ====== Strategy: Try API/JSON endpoints directly ======
async function tryAPIEndpoint(url: string): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    if (res.ok) {
      const text = await res.text();
      try { return JSON.parse(text); } catch { return null; }
    }
  } catch { }
  return null;
}

// ====== Strategy: Try sitemap.xml ======
async function trySitemap(baseUrl: string): Promise<string[]> {
  const urls = [`${baseUrl}/sitemap.xml`, `${baseUrl}/sitemap-index.xml`, `${baseUrl}/robots.txt`];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      });
      if (res.ok) {
        const text = await res.text();
        // Extract URLs from sitemap
        const matches = text.match(/https?:\/\/[^\s<>"]+/g) || [];
        return matches.filter(u => u.includes("tour") || u.includes("activity") || u.includes("plan"));
      }
    } catch { }
  }
  return [];
}

// ====== Viator: Try partner API-like approach ======
async function scrapeViatorAlternative(page: Page): Promise<Result[]> {
  console.log("\n🔍 Viator - trying alternative approaches...");

  // Try 1: Direct search API
  const apiData = await tryAPIEndpoint(
    "https://www.viator.com/orion/ajax/search?text=tokyo+tours&currency=USD&count=50"
  );
  if (apiData?.data?.length) {
    console.log("  ✅ API endpoint worked!");
    return [];  // Would parse API response
  }
  console.log("  ❌ API endpoint blocked");

  // Try 2: Mobile site
  console.log("  Trying mobile site...");
  const mobileResults = await tryMobileSite(
    page,
    "https://www.viator.com/Tokyo/d334-ttd",
    "viator"
  );
  if (mobileResults.length > 0) {
    console.log(`  ✅ Mobile site: ${mobileResults.length} items`);
    return mobileResults;
  }
  console.log("  ❌ Mobile site also blocked");

  // Try 3: Sitemap
  console.log("  Trying sitemap...");
  const sitemapUrls = await trySitemap("https://www.viator.com");
  console.log(`  Sitemap URLs found: ${sitemapUrls.length}`);

  return [];
}

// ====== Klook: Try different approaches ======
async function scrapeKlookAlternative(page: Page): Promise<Result[]> {
  console.log("\n🔍 Klook - trying alternative approaches...");

  // Try 1: Klook API (they have a semi-public search endpoint)
  const searchUrl = "https://www.klook.com/v2/usrcsrch/search?query=tokyo&size=50&start=0";
  const apiData = await tryAPIEndpoint(searchUrl);
  if (apiData?.result?.length) {
    console.log("  ✅ Search API worked!");
    return [];
  }
  console.log("  ❌ Search API blocked");

  // Try 2: Mobile
  const mobileResults = await tryMobileSite(
    page,
    "https://www.klook.com/en-JP/search/?query=tokyo+tours",
    "klook"
  );
  if (mobileResults.length > 0) {
    console.log(`  ✅ Mobile: ${mobileResults.length} items`);
    return mobileResults;
  }
  console.log("  ❌ Mobile blocked");

  return [];
}

// ====== Activity Japan: Alternative ======
async function scrapeActivityJapanAlternative(page: Page): Promise<Result[]> {
  console.log("\n🔍 Activity Japan - trying alternative approaches...");

  // Try mobile version
  const mobileResults = await tryMobileSite(
    page,
    "https://activityjapan.com/search/tokyo/?page=1",
    "activityjapan"
  );
  if (mobileResults.length > 0) {
    console.log(`  ✅ Mobile: ${mobileResults.length} items`);
    return mobileResults;
  }

  // Try specific category pages
  const categoryUrls = [
    "https://activityjapan.com/feature/tokyo-activity/",
    "https://activityjapan.com/search/?keyword=tokyo",
  ];

  for (const url of categoryUrls) {
    console.log(`  Trying: ${url}`);
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    );
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
      const content = await page.content();
      const blocked = ["cf-challenge", "captcha", "Just a moment"].some(s =>
        content.toLowerCase().includes(s.toLowerCase())
      );
      if (!blocked) {
        const items = await page.evaluate(() => {
          const results: any[] = [];
          document.querySelectorAll("a[href]").forEach(link => {
            const img = link.querySelector("img");
            const text = link.textContent?.trim().split("\n")[0]?.trim() || "";
            if (img && text.length > 5) {
              const src = img.src || img.getAttribute("data-src") || "";
              if (src.startsWith("http")) {
                results.push({ title: text.slice(0, 150), url: link.getAttribute("href"), image: src });
              }
            }
          });
          return results.slice(0, 30);
        });
        if (items.length > 0) {
          console.log(`  ✅ Category page: ${items.length} items`);
          return items.map(i => ({ ...i, price: "", rating: "", city: "Tokyo", platform: "activityjapan" }));
        }
      }
    } catch { }
  }
  console.log("  ❌ All approaches blocked");
  return [];
}

// ====== GetYourGuide alternative ======
async function scrapeGYGAlternative(page: Page): Promise<Result[]> {
  console.log("\n🔍 GetYourGuide - trying alternative approaches...");

  // Try mobile
  const mobileResults = await tryMobileSite(
    page,
    "https://www.getyourguide.com/tokyo-l196/",
    "getyourguide"
  );
  if (mobileResults.length > 0) {
    console.log(`  ✅ Mobile: ${mobileResults.length} items`);
    return mobileResults;
  }
  console.log("  ❌ Mobile blocked");

  // Try direct API
  const apiUrls = [
    "https://www.getyourguide.com/api/v1/activities?location_id=196&limit=50",
    "https://travelers-api.getyourguide.com/activities?location_id=196",
  ];
  for (const url of apiUrls) {
    const data = await tryAPIEndpoint(url);
    if (data) {
      console.log(`  ✅ API: found data`);
      return [];
    }
  }
  console.log("  ❌ APIs blocked");

  return [];
}

// ====== KKday alternative ======
async function scrapeKKdayAlternative(page: Page): Promise<Result[]> {
  console.log("\n🔍 KKday - trying alternative approaches...");

  const mobileResults = await tryMobileSite(
    page,
    "https://www.kkday.com/en/product/productlist/?keyword=tokyo",
    "kkday"
  );
  if (mobileResults.length > 0) {
    console.log(`  ✅ Mobile: ${mobileResults.length} items`);
    return mobileResults;
  }
  console.log("  ❌ Mobile blocked");
  return [];
}

// ====== Jalan: Fixed scraper with proper image extraction ======
async function scrapeJalanFixed(page: Page): Promise<Result[]> {
  console.log("\n🔍 Jalan - trying activity pages with image extraction...");

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "ja" });

  const urls = [
    "https://www.jalan.net/activity/130000/page1/",
    "https://www.jalan.net/activity/130000/page2/",
    "https://www.jalan.net/activity/130000/page3/",
  ];

  const results: Result[] = [];

  for (const url of urls) {
    console.log(`  Fetching: ${url}`);
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
      await new Promise(r => setTimeout(r, 2000));

      const items = await page.evaluate(() => {
        const data: { title: string; url: string; image: string; price: string }[] = [];

        // Try multiple selector strategies
        const cards = document.querySelectorAll(
          '.jlnpc-cassette__content, .item-cassette, [class*="cassette"], .searchResultItem, article'
        );

        cards.forEach(card => {
          const link = card.querySelector("a[href]");
          const img = card.querySelector("img");
          const title = card.querySelector("h2, h3, .title, [class*='title'], [class*='name']");

          if (!link || !title) return;

          const titleText = title.textContent?.trim() || "";
          if (titleText.length < 3) return;

          let imgSrc = "";
          if (img) {
            imgSrc = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-original") || "";
          }
          // Check for lazy-loaded images
          if (!imgSrc || imgSrc.includes("spacer") || imgSrc.includes("blank")) {
            const lazyImg = card.querySelector("[data-src], [data-original], [data-lazy]");
            if (lazyImg) {
              imgSrc = lazyImg.getAttribute("data-src") || lazyImg.getAttribute("data-original") || lazyImg.getAttribute("data-lazy") || "";
            }
          }

          const priceEl = card.querySelector('[class*="price"], [class*="Price"]');
          const priceText = priceEl?.textContent?.trim() || "";

          data.push({
            title: titleText.slice(0, 150),
            url: link.getAttribute("href") || "",
            image: imgSrc,
            price: priceText,
          });
        });

        // Fallback: if no cards found, try generic approach
        if (data.length === 0) {
          document.querySelectorAll("a[href*='/activity/']").forEach(link => {
            const parent = link.parentElement?.parentElement || link.parentElement;
            const img = parent?.querySelector("img");
            const text = link.textContent?.trim().split("\n")[0]?.trim() || "";
            if (img && text.length > 5) {
              const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
              if (src) {
                data.push({
                  title: text.slice(0, 150),
                  url: link.getAttribute("href") || "",
                  image: src,
                  price: "",
                });
              }
            }
          });
        }

        return data;
      });

      console.log(`    Found ${items.length} items`);
      items.forEach(item => {
        if (item.image && item.image.startsWith("http")) {
          results.push({
            ...item,
            url: item.url.startsWith("http") ? item.url : `https://www.jalan.net${item.url}`,
            image: item.image.startsWith("http") ? item.image : `https://www.jalan.net${item.image}`,
            rating: "",
            city: "Tokyo",
            platform: "jalan",
          });
        }
      });

      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 60)}`);
    }
  }

  return results;
}

async function main() {
  console.log("🐻 Multi-site scraper - Finding what works\n");
  console.log("=".repeat(60));

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const allResults: Result[] = [];
  const page = await browser.newPage();

  // Try each platform
  const viatorResults = await scrapeViatorAlternative(page);
  allResults.push(...viatorResults);

  const gygResults = await scrapeGYGAlternative(page);
  allResults.push(...gygResults);

  const klookResults = await scrapeKlookAlternative(page);
  allResults.push(...klookResults);

  const kkdayResults = await scrapeKKdayAlternative(page);
  allResults.push(...kkdayResults);

  const ajResults = await scrapeActivityJapanAlternative(page);
  allResults.push(...ajResults);

  const jalanResults = await scrapeJalanFixed(page);
  allResults.push(...jalanResults);

  await page.close();
  await browser.close();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Results Summary:\n");

  const byPlatform = new Map<string, number>();
  allResults.forEach(r => byPlatform.set(r.platform, (byPlatform.get(r.platform) || 0) + 1));
  byPlatform.forEach((count, platform) => console.log(`  ${platform}: ${count} items`));

  if (allResults.length === 0) {
    console.log("  No items scraped from alternative approaches.");
    console.log("\n  Cloudflare blocks remain. Use API/affiliate approach for:");
    console.log("    - Viator (free API: https://partners.viator.com)");
    console.log("    - GetYourGuide (Awin affiliate)");
    console.log("    - Klook (Partner API: https://affiliate.klook.com)");
    console.log("    - KKday (KKpartners: https://kkpartners.kkday.com)");
    console.log("    - Activity Japan (API with NDA)");
  } else {
    // Save results
    const normalized = allResults.map((r, i) => ({
      id: `${r.platform}-tokyo-${i}`,
      slug: `tokyo-${r.platform}-${r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}`,
      title: r.title,
      description: r.title,
      shortDescription: r.title.slice(0, 120),
      price: { amount: 0, currency: "USD", display: "Check site" },
      duration: { hours: 2, display: "Varies" },
      rating: { score: 4.0, count: 0 },
      images: [r.image],
      thumbnail: r.image,
      location: { city: r.city, citySlug: "tokyo", region: "Kanto" },
      categories: [],
      themes: [],
      highlights: [],
      source: { platform: r.platform, url: r.url, productId: "", lastScraped: new Date().toISOString() },
      bookingUrl: r.url,
      isPopular: false,
      isFeatured: false,
    }));

    const outPath = join(process.cwd(), "data", "other-sites-raw.json");
    writeFileSync(outPath, JSON.stringify(normalized, null, 2));
    console.log(`\n💾 Saved ${normalized.length} items to ${outPath}`);
  }
}

main().catch(console.error);
