/**
 * Combined scraper for 3 platforms:
 * 1. Rakuten Travel Experiences (formerly Voyagin)
 * 2. DeepExperience Japan
 * 3. Travelko (tour.ne.jp) - retry with better selectors
 *
 * Uses puppeteer-extra with StealthPlugin, aggressive scrolling,
 * broad selectors, and per-platform deduplication.
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync, mkdirSync, existsSync } from "fs";
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

/** Aggressive scroll: 15-20 times, waiting for lazy images */
async function aggressiveScroll(page: Page, times: number = 18) {
  for (let i = 0; i < times; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await delay(400 + Math.random() * 300);
    // Trigger lazy-loaded images
    if (i % 4 === 0) {
      await page.evaluate(() => {
        document.querySelectorAll("img[data-src], img[data-lazy], img[loading='lazy']").forEach((img) => {
          const dataSrc = img.getAttribute("data-src") || img.getAttribute("data-lazy");
          if (dataSrc && !img.getAttribute("src")?.startsWith("http")) {
            img.setAttribute("src", dataSrc);
          }
        });
      });
    }
  }
  // Scroll back to top and wait for any final loads
  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(500);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await delay(1000);
}

function isBlocked(content: string, title: string): boolean {
  return (
    content.includes("cf-challenge") ||
    content.includes("Just a moment") ||
    content.includes("captcha") ||
    content.includes("Checking your browser") ||
    title.includes("Just a moment") ||
    title.includes("Attention Required")
  );
}

// ============================================================
// PLATFORM 1: Rakuten Travel Experiences
// ============================================================
async function scrapeRakuten(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n=== PLATFORM 1: Rakuten Travel Experiences ===\n");
  const page = await browser.newPage();
  const results: ScrapedItem[] = [];
  const seenUrls = new Set<string>();

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1440, height: 900 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "ja,en-US;q=0.9" });

  const rakutenUrls = [
    { url: "https://experiences.travel.rakuten.co.jp/", city: "Japan" },
    { url: "https://experiences.travel.rakuten.co.jp/search?location=tokyo", city: "Tokyo" },
    { url: "https://experiences.travel.rakuten.co.jp/search?location=kyoto", city: "Kyoto" },
    { url: "https://experiences.travel.rakuten.co.jp/search?location=osaka", city: "Osaka" },
    { url: "https://experiences.travel.rakuten.co.jp/destinations/japan/tokyo", city: "Tokyo" },
    { url: "https://experiences.travel.rakuten.co.jp/destinations/japan/kyoto", city: "Kyoto" },
    { url: "https://experiences.travel.rakuten.co.jp/destinations/japan/osaka", city: "Osaka" },
  ];

  for (const { url, city } of rakutenUrls) {
    try {
      console.log(`  [Rakuten] ${city}: ${url.slice(0, 80)}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await delay(3000);

      const title = await page.title();
      const content = await page.content();
      const blocked = isBlocked(content, title);
      const status = blocked ? "BLOCKED" : "OK";
      console.log(`    Title: "${title.slice(0, 60)}" [${status}]`);

      // Log redirect / final URL
      const finalUrl = page.url();
      if (finalUrl !== url) {
        console.log(`    Redirected to: ${finalUrl.slice(0, 80)}`);
      }

      if (!blocked) {
        await aggressiveScroll(page, 18);

        const items = await page.evaluate((c: string) => {
          const found: any[] = [];
          const seenLocal = new Set<string>();

          // Broad approach: find all <a> with nearby <img>
          const allLinks = document.querySelectorAll("a[href]");
          allLinks.forEach((link) => {
            const href = link.getAttribute("href") || "";
            // Skip nav/footer/social links
            if (!href || href === "#" || href === "/" || href.length < 10) return;
            if (href.includes("login") || href.includes("signup") || href.includes("help") || href.includes("about")) return;
            if (href.includes("facebook") || href.includes("twitter") || href.includes("instagram")) return;

            // Look for img inside or very near the link
            const img = link.querySelector("img") || link.parentElement?.querySelector("img");
            if (!img) return;

            const imgSrc = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy") || "";
            if (!imgSrc || imgSrc.includes("logo") || imgSrc.includes("icon") || imgSrc.includes("avatar")) return;
            if (imgSrc.length < 20) return;

            // Get title from various sources
            let titleText = "";
            const container = link.closest('[class*="card"], [class*="item"], [class*="product"], [class*="experience"], article, li, [class*="tile"]') || link.parentElement;
            if (container) {
              titleText = container.querySelector("h1,h2,h3,h4,h5,[class*='title'],[class*='name']")?.textContent?.trim() || "";
            }
            if (!titleText) titleText = img.getAttribute("alt") || "";
            if (!titleText) titleText = link.textContent?.trim().split("\n")[0]?.trim() || "";
            if (!titleText || titleText.length < 4) return;

            const fullUrl = href.startsWith("http") ? href : `https://experiences.travel.rakuten.co.jp${href}`;
            if (seenLocal.has(fullUrl)) return;
            seenLocal.add(fullUrl);

            // Extract price
            const allText = (container || link).textContent || "";
            let price = "";
            let priceNum = 0;
            // Check for JPY prices
            const jpyMatch = allText.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
            if (jpyMatch) {
              priceNum = Math.round(parseInt(jpyMatch[1].replace(/,/g, "")) / 155);
              price = `$${priceNum}`;
            }
            // Check for USD prices
            const usdMatch = allText.match(/\$\s*(\d+(?:\.\d{2})?)/);
            if (usdMatch && !price) {
              priceNum = Math.round(parseFloat(usdMatch[1]));
              price = `$${priceNum}`;
            }
            // Check for "From" prices
            const fromMatch = allText.match(/(?:from|From)\s*[¥$]\s*(\d+(?:,\d{3})*)/);
            if (fromMatch && !price) {
              const val = parseInt(fromMatch[1].replace(/,/g, ""));
              if (val > 500) {
                priceNum = Math.round(val / 155);
              } else {
                priceNum = val;
              }
              price = `$${priceNum}`;
            }

            found.push({
              title: titleText.replace(/\s+/g, " ").trim().slice(0, 200),
              url: fullUrl,
              image: imgSrc.startsWith("http") ? imgSrc : "",
              price,
              priceNum,
              city: c,
            });
          });
          return found;
        }, city);

        // Filter to only actual experience/product pages
        const filtered = items.filter((item) => {
          // Must be a Rakuten experience URL or travel product
          if (item.url.includes("/experiences/") || item.url.includes("/experience/")) return true;
          if (item.url.includes("experiences.travel.rakuten")) return true;
          // Exclude banners, mobile ads, login, generic pages
          if (item.url.includes("redirect") || item.url.includes("mobile.rakuten")) return false;
          if (item.url.includes("coupon-week") || item.url.includes("campaign")) return false;
          if (item.title === "banner" || item.title.length < 5) return false;
          // Must have a real image (not tracking pixel)
          if (!item.image || item.image.includes("1x1") || item.image.includes("pixel")) return false;
          return true;
        });

        let newCount = 0;
        for (const item of filtered) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            results.push({
              ...item,
              rating: "",
              reviewCount: "",
              platform: "rakuten",
            });
            newCount++;
          }
        }
        console.log(`    Found: ${items.length} raw, ${filtered.length} filtered, ${newCount} new unique`);
      }
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 80)}`);
    }
    await delay(2000 + Math.random() * 2000);
  }

  await page.close();
  return results;
}

// ============================================================
// PLATFORM 2: DeepExperience Japan
// ============================================================
async function scrapeDeepExperience(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n=== PLATFORM 2: DeepExperience Japan ===\n");
  const page = await browser.newPage();
  const results: ScrapedItem[] = [];
  const seenUrls = new Set<string>();

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1440, height: 900 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "ja,en-US;q=0.9" });

  const deepExpUrls = [
    { url: "https://deep-exp.com/en/products", city: "Japan" },
    { url: "https://deep-exp.com/en/tokyo", city: "Tokyo" },
    { url: "https://deep-exp.com/en/kyoto", city: "Kyoto" },
    { url: "https://deep-exp.com/en/osaka", city: "Osaka" },
    { url: "https://deep-exp.com/products", city: "Japan" },
    { url: "https://deep-exp.com/en", city: "Japan" },
  ];

  for (const { url, city } of deepExpUrls) {
    try {
      console.log(`  [DeepExp] ${city}: ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await delay(3000);

      const title = await page.title();
      const content = await page.content();
      const blocked = isBlocked(content, title);
      const status = blocked ? "BLOCKED" : "OK";
      console.log(`    Title: "${title.slice(0, 60)}" [${status}]`);

      const finalUrl = page.url();
      if (finalUrl !== url) {
        console.log(`    Redirected to: ${finalUrl.slice(0, 80)}`);
      }

      if (!blocked) {
        await aggressiveScroll(page, 20);

        const items = await page.evaluate((c: string) => {
          const found: any[] = [];
          const seenLocal = new Set<string>();

          // Broad approach for DeepExperience
          const allLinks = document.querySelectorAll("a[href]");
          allLinks.forEach((link) => {
            const href = link.getAttribute("href") || "";
            if (!href || href === "#" || href === "/" || href.length < 5) return;
            if (href.includes("login") || href.includes("signup") || href.includes("cart") || href.includes("account")) return;
            if (href.includes("facebook") || href.includes("twitter") || href.includes("instagram") || href.includes("youtube")) return;
            if (href.includes("privacy") || href.includes("terms") || href.includes("contact") || href.includes("about")) return;

            const img = link.querySelector("img") || link.parentElement?.querySelector("img");
            if (!img) return;

            const imgSrc = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy") || img.getAttribute("srcset")?.split(" ")[0] || "";
            if (!imgSrc || imgSrc.includes("logo") || imgSrc.includes("icon") || imgSrc.includes("avatar") || imgSrc.includes("flag")) return;
            if (imgSrc.length < 15) return;

            let titleText = "";
            const container = link.closest('[class*="card"], [class*="product"], [class*="item"], [class*="experience"], article, li, [class*="grid"], section') || link.parentElement;
            if (container) {
              titleText = container.querySelector("h1,h2,h3,h4,h5,[class*='title'],[class*='name'],[class*='heading']")?.textContent?.trim() || "";
            }
            if (!titleText) titleText = img.getAttribute("alt") || "";
            if (!titleText) titleText = link.getAttribute("title") || link.getAttribute("aria-label") || "";
            if (!titleText) titleText = link.textContent?.trim().split("\n")[0]?.trim() || "";
            if (!titleText || titleText.length < 4) return;

            const fullUrl = href.startsWith("http") ? href : `https://deep-exp.com${href}`;
            if (seenLocal.has(fullUrl)) return;
            seenLocal.add(fullUrl);

            // Extract price (DeepExperience uses USD)
            const allText = (container || link).textContent || "";
            let price = "";
            let priceNum = 0;

            // USD price
            const usdMatch = allText.match(/(?:USD|\$)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
            if (usdMatch) {
              priceNum = Math.round(parseFloat(usdMatch[1].replace(/,/g, "")));
              price = `$${priceNum}`;
            }
            // JPY fallback
            if (!price) {
              const jpyMatch = allText.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
              if (jpyMatch) {
                priceNum = Math.round(parseInt(jpyMatch[1].replace(/,/g, "")) / 155);
                price = `$${priceNum}`;
              }
            }
            // Generic number near "per person"
            if (!price) {
              const ppMatch = allText.match(/(\d+(?:,\d{3})*)\s*(?:per person|\/person|pp)/i);
              if (ppMatch) {
                priceNum = parseInt(ppMatch[1].replace(/,/g, ""));
                price = `$${priceNum}`;
              }
            }

            found.push({
              title: titleText.replace(/\s+/g, " ").trim().slice(0, 200),
              url: fullUrl,
              image: imgSrc.startsWith("http") ? imgSrc : `https://deep-exp.com${imgSrc}`,
              price,
              priceNum,
              city: c,
            });
          });
          return found;
        }, city);

        let newCount = 0;
        for (const item of items) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            results.push({
              ...item,
              rating: "",
              reviewCount: "",
              platform: "deepexperience",
            });
            newCount++;
          }
        }
        console.log(`    Found: ${items.length} items, ${newCount} new unique`);
      }
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 80)}`);
    }
    await delay(2000 + Math.random() * 2000);
  }

  await page.close();
  return results;
}

// ============================================================
// PLATFORM 3: Travelko (tour.ne.jp) - V2 via internal API
// Travelko loads plans via AJAX API. Area codes return 0 results,
// but keyword search works. We use the internal API endpoint directly.
// ============================================================
async function scrapeTravelko(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n=== PLATFORM 3: Travelko (tour.ne.jp) - V2 via API ===\n");
  const page = await browser.newPage();
  const results: ScrapedItem[] = [];
  const seenUrls = new Set<string>();

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1440, height: 900 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "ja,en-US;q=0.9" });

  // First navigate to the main page to establish session
  console.log("  [Travelko] Establishing session...");
  await page.goto("https://www.tour.ne.jp/j_optional/", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(3000);

  // Travelko's internal API: keyword-based search returns plan HTML
  // Area-based search returns 0 results, so we use keyword search
  const searches = [
    { keyword: "東京", city: "Tokyo", pages: [1, 2, 3] },
    { keyword: "京都", city: "Kyoto", pages: [1, 2] },
    { keyword: "大阪", city: "Osaka", pages: [1, 2] },
    { keyword: "広島", city: "Hiroshima", pages: [1] },
  ];

  for (const { keyword, city, pages } of searches) {
    for (const pageNum of pages) {
      try {
        const encodedKeyword = encodeURIComponent(keyword);
        const apiUrl = `/api/html/j_optional/parts_plan_list/?sort=15&view_mode=pc&keyword=${encodedKeyword}&page=${pageNum}`;
        console.log(`  [Travelko] ${city} (page ${pageNum}): keyword=${keyword}`);

        const items = await page.evaluate(async (url: string, c: string) => {
          const found: any[] = [];
          try {
            const res = await fetch(url);
            const html = await res.text();

            // Parse using DOMParser
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            // Find all plan items
            const planItems = doc.querySelectorAll(".item-box.Area_search_item, [data-plan_id]");

            planItems.forEach((item) => {
              const planId = item.getAttribute("data-plan_id") || "";
              if (!planId) return;

              // Title
              const titleEl = item.querySelector("h3.item-hdg a, .item-hdg a, .ActPlanTitle");
              const title = titleEl?.textContent?.trim() || "";
              if (!title || title.length < 3) return;

              // URL
              const href = titleEl?.getAttribute("href") || "";
              const fullUrl = href ? `https://www.tour.ne.jp${href.split("#")[0]}` : `https://www.tour.ne.jp/j_optional/${planId}/`;

              // Image (from background-image style)
              let image = "";
              const picSpan = item.querySelector(".item-pic-img, [style*='background-image']");
              if (picSpan) {
                const style = picSpan.getAttribute("style") || "";
                const bgMatch = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
                if (bgMatch) image = bgMatch[1];
              }
              // Fallback to img tag
              if (!image) {
                const img = item.querySelector("img[src*='cloudfront'], img[src*='image']");
                if (img) image = img.getAttribute("src") || "";
              }

              // Price (from data-total_price or text)
              let priceJpy = 0;
              const totalPriceAttr = item.querySelector("[data-total_price]");
              if (totalPriceAttr) {
                priceJpy = parseInt(totalPriceAttr.getAttribute("data-total_price") || "0");
              }
              if (!priceJpy) {
                const priceEl = item.querySelector(".dtl-plan-item-price .mod-num, [class*='price'] .mod-num");
                if (priceEl) {
                  priceJpy = parseInt((priceEl.textContent || "0").replace(/,/g, ""));
                }
              }

              // Rating
              let rating = "";
              const ratingEl = item.querySelector(".item-review-point-rank-label");
              if (ratingEl) rating = ratingEl.textContent?.trim() || "";

              // Review count
              let reviewCount = "";
              const reviewEl = item.querySelector(".item-review-point-label .mod-num");
              if (reviewEl) reviewCount = reviewEl.textContent?.trim() || "";

              found.push({
                title: title.replace(/\s+/g, " ").trim().slice(0, 200),
                url: fullUrl,
                image,
                priceJpy,
                priceNum: priceJpy > 0 ? Math.round(priceJpy / 155) : 0,
                price: priceJpy > 0 ? `$${Math.round(priceJpy / 155)} (${priceJpy.toLocaleString()}円)` : "",
                rating,
                reviewCount,
                city: c,
              });
            });
          } catch (e) {
            // Return empty on error
          }
          return found;
        }, apiUrl, city);

        let newCount = 0;
        for (const item of items) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            results.push({
              ...item,
              platform: "travelko",
            });
            newCount++;
          }
        }
        console.log(`    Found: ${items.length} items, ${newCount} new unique`);

        if (items.length === 0) {
          console.log(`    (No more results for ${city}, skipping remaining pages)`);
          break;
        }
      } catch (err) {
        console.log(`    Error: ${(err as Error).message?.slice(0, 80)}`);
      }
      await delay(1500 + Math.random() * 1500);
    }
  }

  await page.close();
  return results;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("=".repeat(60));
  console.log("  Combined Scraper: Rakuten + DeepExperience + Travelko");
  console.log("=".repeat(60));

  // Ensure data directory exists
  const dataDir = join(process.cwd(), "data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
    ],
  });

  // Run all 3 platforms sequentially
  const rakutenResults = await scrapeRakuten(browser);
  const deepExpResults = await scrapeDeepExperience(browser);
  const travelkoResults = await scrapeTravelko(browser);

  await browser.close();

  // ---- Save results ----
  console.log("\n" + "=".repeat(60));
  console.log("  RESULTS SUMMARY");
  console.log("=".repeat(60));

  // Rakuten
  console.log(`\n  Rakuten Travel Experiences: ${rakutenResults.length} items`);
  const rakutenWithImages = rakutenResults.filter((i) => i.image);
  const rakutenWithPrices = rakutenResults.filter((i) => i.priceNum > 0);
  console.log(`    With images: ${rakutenWithImages.length}, With prices: ${rakutenWithPrices.length}`);
  if (rakutenResults.length > 0) {
    console.log("    Sample titles:");
    rakutenResults.slice(0, 5).forEach((i) => console.log(`      - ${i.title.slice(0, 70)}`));
  }
  const rakutenPath = join(dataDir, "rakuten-raw.json");
  writeFileSync(rakutenPath, JSON.stringify(rakutenResults, null, 2));
  console.log(`    Saved to: data/rakuten-raw.json`);

  // DeepExperience
  console.log(`\n  DeepExperience Japan: ${deepExpResults.length} items`);
  const deepWithImages = deepExpResults.filter((i) => i.image);
  const deepWithPrices = deepExpResults.filter((i) => i.priceNum > 0);
  console.log(`    With images: ${deepWithImages.length}, With prices: ${deepWithPrices.length}`);
  if (deepExpResults.length > 0) {
    console.log("    Sample titles:");
    deepExpResults.slice(0, 5).forEach((i) => console.log(`      - ${i.title.slice(0, 70)}`));
  }
  const deepExpPath = join(dataDir, "deepexp-raw.json");
  writeFileSync(deepExpPath, JSON.stringify(deepExpResults, null, 2));
  console.log(`    Saved to: data/deepexp-raw.json`);

  // Travelko
  console.log(`\n  Travelko (v2): ${travelkoResults.length} items`);
  const travelkoWithImages = travelkoResults.filter((i) => i.image);
  const travelkoWithPrices = travelkoResults.filter((i) => i.priceNum > 0);
  console.log(`    With images: ${travelkoWithImages.length}, With prices: ${travelkoWithPrices.length}`);
  if (travelkoResults.length > 0) {
    console.log("    Sample titles:");
    travelkoResults.slice(0, 5).forEach((i) => console.log(`      - ${i.title.slice(0, 70)}`));
  }
  const travelkoPath = join(dataDir, "travelko-v2-raw.json");
  writeFileSync(travelkoPath, JSON.stringify(travelkoResults, null, 2));
  console.log(`    Saved to: data/travelko-v2-raw.json`);

  // Grand total
  const total = rakutenResults.length + deepExpResults.length + travelkoResults.length;
  console.log(`\n  GRAND TOTAL: ${total} items across 3 platforms`);
  console.log("=".repeat(60));
}

main().catch(console.error);
