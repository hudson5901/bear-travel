import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

puppeteer.use(StealthPlugin());

interface RawActivity {
  title: string;
  url: string;
  image: string;
  priceJPY: number;
  priceUSD: number;
  priceDisplay: string;
  city: string;
  source: string;
}

const JPY_TO_USD = 155;

// Tabirai focuses on Okinawa and Hokkaido. The /cate/ pages have the real plan listings.
// The regional top pages (/okinawa/, /hokkaido/) have top-ranked items too.
// Sub-area pages like /okinawa/area_ishigaki/ also have listings.
const LISTING_URLS: { url: string; city: string }[] = [
  // Main category listing pages (richest source of plans)
  { url: "https://www.tabirai.net/activity/okinawa/cate/", city: "Okinawa" },
  { url: "https://www.tabirai.net/activity/hokkaido/cate/", city: "Hokkaido" },
  // Regional top pages (have top-rank sections)
  { url: "https://www.tabirai.net/activity/okinawa/", city: "Okinawa" },
  { url: "https://www.tabirai.net/activity/hokkaido/", city: "Hokkaido" },
  // Okinawa sub-area pages
  { url: "https://www.tabirai.net/activity/okinawa/area_ishigaki/", city: "Okinawa (Ishigaki)" },
  { url: "https://www.tabirai.net/activity/okinawa/area_miyako/", city: "Okinawa (Miyako)" },
  { url: "https://www.tabirai.net/activity/okinawa/area_kerama/", city: "Okinawa (Kerama)" },
  { url: "https://www.tabirai.net/activity/okinawa/area_onna/", city: "Okinawa (Onna)" },
  { url: "https://www.tabirai.net/activity/okinawa/area_iriomote/", city: "Okinawa (Iriomote)" },
  { url: "https://www.tabirai.net/activity/okinawa/area_nago/", city: "Okinawa (Nago)" },
  // Main landing page
  { url: "https://www.tabirai.net/activity/", city: "" },
  // Try city URLs (likely 403 but attempt anyway)
  { url: "https://www.tabirai.net/activity/tokyo/", city: "Tokyo" },
  { url: "https://www.tabirai.net/activity/kyoto/", city: "Kyoto" },
  { url: "https://www.tabirai.net/activity/osaka/", city: "Osaka" },
  { url: "https://www.tabirai.net/activity/hiroshima/", city: "Hiroshima" },
  { url: "https://www.tabirai.net/activity/nara/", city: "Nara" },
  // Query-based listing attempts
  { url: "https://www.tabirai.net/activity/list/?area=tokyo", city: "Tokyo" },
  { url: "https://www.tabirai.net/activity/list/?area=kyoto", city: "Kyoto" },
  { url: "https://www.tabirai.net/activity/list/?area=osaka", city: "Osaka" },
  // Ranking page attempt
  { url: "https://www.tabirai.net/activity/ranking/", city: "" },
];

const DELAY_MIN_MS = 2000;
const DELAY_MAX_MS = 4000;

function delay(ms?: number): Promise<void> {
  const wait = ms ?? DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS);
  return new Promise((resolve) => setTimeout(resolve, wait));
}

function parseJPYPrice(text: string): number {
  if (!text) return 0;
  const cleaned = text.replace(/\s/g, "").replace(/~/g, "").replace(/～/g, "");
  const match = cleaned.match(/([\d,]+)/);
  if (match) {
    const val = parseInt(match[1].replace(/,/g, ""), 10);
    if (!isNaN(val) && val > 0) return val;
  }
  return 0;
}

function inferCity(url: string, pageText: string, fallbackCity: string): string {
  if (fallbackCity) return fallbackCity;
  const text = (url + " " + pageText).toLowerCase();
  if (text.includes("okinawa") || text.includes("沖縄")) return "Okinawa";
  if (text.includes("hokkaido") || text.includes("北海道")) return "Hokkaido";
  if (text.includes("tokyo") || text.includes("東京")) return "Tokyo";
  if (text.includes("kyoto") || text.includes("京都")) return "Kyoto";
  if (text.includes("osaka") || text.includes("大阪")) return "Osaka";
  if (text.includes("hiroshima") || text.includes("広島")) return "Hiroshima";
  if (text.includes("nara") || text.includes("奈良")) return "Nara";
  if (text.includes("ishigaki") || text.includes("石垣")) return "Okinawa (Ishigaki)";
  if (text.includes("miyako") || text.includes("宮古")) return "Okinawa (Miyako)";
  return "Japan";
}

function makeAbsoluteUrl(href: string): string {
  if (!href) return "";
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `https://www.tabirai.net${href}`;
  return `https://www.tabirai.net/${href}`;
}

async function aggressiveScroll(page: any, iterations: number = 20): Promise<void> {
  await page.evaluate(async (maxScrolls: number) => {
    await new Promise<void>((resolve) => {
      let scrollCount = 0;
      const distance = 600;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        scrollCount++;
        if (scrollCount >= maxScrolls) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          setTimeout(() => {
            window.scrollTo(0, document.body.scrollHeight);
            setTimeout(resolve, 1000);
          }, 500);
        }
      }, 300);
    });
  }, iterations);
}

async function scrapePage(
  browser: any,
  listingUrl: string,
  cityHint: string
): Promise<RawActivity[]> {
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );
  await page.setExtraHTTPHeaders({
    "Accept-Language": "ja,en-US;q=0.9",
  });
  await page.setViewport({ width: 1440, height: 900 });

  const results: RawActivity[] = [];

  try {
    console.log(`    Navigating to: ${listingUrl}`);
    const response = await page.goto(listingUrl, {
      waitUntil: "networkidle2",
      timeout: 45000,
    });

    const status = response?.status() ?? 0;
    const finalUrl = page.url();
    console.log(`    Status: ${status} | Final URL: ${finalUrl}`);

    if (status >= 400) {
      console.log(`    Skipping (HTTP ${status})`);
      await page.close();
      return [];
    }

    await delay(2000);

    // Aggressive scroll to load lazy content (20 iterations)
    console.log(`    Scrolling aggressively (20 iterations)...`);
    await aggressiveScroll(page, 20);
    await delay(1500);

    const pageTitle = await page.title();
    console.log(`    Page title: ${pageTitle}`);

    // Extract activities using multiple strategies
    const items = await page.evaluate(() => {
      const results: {
        title: string;
        url: string;
        image: string;
        priceText: string;
        areaText: string;
      }[] = [];
      const seen = new Set<string>();

      // ===== Strategy 1: Plan cards on /cate/ pages (ac-plan class) =====
      const planCards = document.querySelectorAll(".ac-plan");
      planCards.forEach((card) => {
        const headlineLink = card.querySelector(".ac-plan__headline a[href]");
        const href = headlineLink?.getAttribute("href") || "";
        if (!href || seen.has(href)) return;
        seen.add(href);

        const title = headlineLink?.textContent?.trim() || "";
        if (!title || title.length < 5) return;

        // Price
        const priceEl = card.querySelector(".ac-plan__detail__price__number");
        const priceText = priceEl?.textContent?.trim() || "";

        // Image
        const imgEl = card.querySelector("img");
        let image = imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";

        // Area info
        const areaEl = card.querySelector(
          "[class*='area'], [class*='cate'], .ac-plan__note__area"
        );
        const areaText = areaEl?.textContent?.trim() || "";

        results.push({ title, url: href, image, priceText, areaText });
      });

      // ===== Strategy 2: Top-rank items on regional pages =====
      const topRankContainers = document.querySelectorAll(
        ".ac-content__toprank__upper, .ac-content__toprank__lower"
      );
      topRankContainers.forEach((container) => {
        // These items use <a> wrappers - find links
        const links = container.querySelectorAll("a[href*='detail'], a[href*='plan']");
        links.forEach((linkEl) => {
          const href = linkEl.getAttribute("href") || "";
          if (!href || seen.has(href)) return;
          // Skip BBS (review) links and javascript links
          if (href.includes("/bbs/") || href.startsWith("javascript:")) return;
          seen.add(href);

          // Title from the container
          const titleEl = container.querySelector(
            "[class*='title'], [class*='Title'], h2, h3, h4"
          );
          let title = titleEl?.textContent?.trim() || "";
          if (!title) title = linkEl.textContent?.trim() || "";
          if (!title || title.length < 3) {
            const imgInLink = linkEl.querySelector("img");
            title = imgInLink?.getAttribute("alt")?.trim() || "";
          }
          if (!title || title.length < 3) return;

          const priceEl = container.querySelector("[class*='price']");
          const priceText = priceEl?.textContent?.trim() || "";

          const imgEl = container.querySelector("img") || linkEl.querySelector("img");
          const image = imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";

          const areaEl = container.querySelector("[class*='area']");
          const areaText = areaEl?.textContent?.trim() || "";

          results.push({ title, url: href, image, priceText, areaText });
        });
      });

      // ===== Strategy 3: Generic links with detail/?plan_id pattern =====
      const detailLinks = document.querySelectorAll(
        'a[href*="detail/?plan_id"], a[href*="detail?plan_id"]'
      );
      detailLinks.forEach((anchor) => {
        const href = anchor.getAttribute("href") || "";
        const normalizedHref = href.split("#")[0];
        if (!normalizedHref || seen.has(normalizedHref)) return;
        // Skip BBS (review) links and javascript links
        if (href.includes("/bbs/") || href.startsWith("javascript:")) return;
        seen.add(normalizedHref);

        const card =
          anchor.closest(".ac-plan") ||
          anchor.closest("[class*='rank']") ||
          anchor.closest("[class*='card']") ||
          anchor.closest("[class*='item']") ||
          anchor.closest("li") ||
          anchor.closest("article") ||
          anchor;

        let title = "";
        const titleEl = card.querySelector(
          "h2, h3, h4, [class*='title'], [class*='headline']"
        );
        if (titleEl) title = titleEl.textContent?.trim() || "";
        if (!title) title = anchor.textContent?.trim() || "";
        if (!title) {
          const img = card.querySelector("img");
          title = img?.getAttribute("alt")?.trim() || "";
        }
        if (!title || title.length < 3) return;

        const priceEl = card.querySelector("[class*='price']");
        const priceText = priceEl?.textContent?.trim() || "";

        const imgEl = card.querySelector("img") || anchor.querySelector("img");
        const image = imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";

        const areaEl = card.querySelector("[class*='area']");
        const areaText = areaEl?.textContent?.trim() || "";

        results.push({ title, url: href, image, priceText, areaText });
      });

      // ===== Strategy 4: Links with /activity/ and /plan/ or activity-like patterns =====
      const activityLinks = document.querySelectorAll(
        'a[href*="/activity/"][href*="/plan"], a[href*="/activity/"][href*="plan_id"]'
      );
      activityLinks.forEach((anchor) => {
        const href = anchor.getAttribute("href") || "";
        if (!href || seen.has(href)) return;
        // Skip BBS (review) links and javascript links
        if (href.includes("/bbs/") || href.startsWith("javascript:")) return;
        seen.add(href);

        const card =
          anchor.closest("[class*='plan']") ||
          anchor.closest("[class*='card']") ||
          anchor.closest("li") ||
          anchor;

        let title = "";
        const titleEl = card.querySelector("h2, h3, h4, [class*='title']");
        if (titleEl) title = titleEl.textContent?.trim() || "";
        if (!title) title = anchor.textContent?.trim() || "";
        if (!title) {
          const img = card.querySelector("img");
          title = img?.getAttribute("alt")?.trim() || "";
        }
        if (!title || title.length < 3) return;

        const priceEl = card.querySelector("[class*='price']");
        const priceText = priceEl?.textContent?.trim() || "";

        const imgEl = card.querySelector("img");
        const image = imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";

        results.push({ title, url: href, image, priceText, areaText: "" });
      });

      return results;
    });

    console.log(`    Found ${items.length} raw activity items`);

    for (const item of items) {
      // Filter out BBS/review links that slipped through
      if (item.url.includes("/bbs/")) continue;
      // Filter out titles that are just review counts
      if (/^口コミ\s*[:：]\s*\d+件?$/.test(item.title)) continue;
      // Filter out very short or obviously non-activity titles
      if (item.title.length < 5) continue;
      if (/^(\.+\s*>?|>+)$/.test(item.title)) continue;

      const priceJPY = parseJPYPrice(item.priceText);
      const priceUSD = priceJPY > 0 ? Math.round((priceJPY / JPY_TO_USD) * 100) / 100 : 0;
      const city = inferCity(item.url, item.areaText, cityHint);
      const absoluteUrl = makeAbsoluteUrl(item.url);
      const absoluteImage = item.image ? makeAbsoluteUrl(item.image) : "";

      results.push({
        title: item.title,
        url: absoluteUrl,
        image: absoluteImage,
        priceJPY,
        priceUSD,
        priceDisplay:
          priceJPY > 0
            ? `$${priceUSD.toFixed(2)} (¥${priceJPY.toLocaleString()})`
            : "Price not listed",
        city,
        source: "tabirai",
      });
    }
  } catch (error: any) {
    console.error(`    Error on ${listingUrl}: ${error?.message || error}`);
  } finally {
    await page.close();
  }

  return results;
}

async function main() {
  console.log("=== Tabirai Activity Scraper ===\n");
  console.log(`Target: ${LISTING_URLS.length} listing pages`);
  console.log(`JPY to USD rate: 1 USD = ¥${JPY_TO_USD}\n`);

  const outputPath = join(process.cwd(), "data", "tabirai-raw.json");
  mkdirSync(join(process.cwd(), "data"), { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const allActivities: RawActivity[] = [];

  for (let i = 0; i < LISTING_URLS.length; i++) {
    const { url, city } = LISTING_URLS[i];
    console.log(
      `\n[${i + 1}/${LISTING_URLS.length}] ${url} (hint: ${city || "auto-detect"})`
    );

    try {
      const activities = await scrapePage(browser, url, city);
      allActivities.push(...activities);
      console.log(`    Collected ${activities.length} activities from this page`);
    } catch (error: any) {
      console.error(`    Fatal error on page: ${error?.message || error}`);
    }

    // Polite delay between pages
    if (i < LISTING_URLS.length - 1) {
      const waitTime = DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS);
      console.log(`    Waiting ${(waitTime / 1000).toFixed(1)}s...`);
      await delay(waitTime);
    }
  }

  await browser.close();

  // Deduplicate by URL (normalize by stripping query params after plan_id)
  const urlMap = new Map<string, RawActivity>();
  for (const activity of allActivities) {
    // Normalize URL: keep plan_id but strip tracking params
    let key = activity.url;
    const planIdMatch = key.match(/plan_id=(\d+)/);
    if (planIdMatch) {
      // Reconstruct a canonical URL
      const basePath = key.split("?")[0].split("detail")[0];
      key = `${basePath}detail/?plan_id=${planIdMatch[1]}`;
    } else {
      key = key.split("#")[0];
    }
    if (!urlMap.has(key)) {
      urlMap.set(key, activity);
    }
  }
  const deduped = Array.from(urlMap.values());

  console.log(`\n=== Results ===`);
  console.log(`Total raw: ${allActivities.length}`);
  console.log(`After dedup: ${deduped.length}`);

  // Summary by city
  const byCityMap = new Map<string, number>();
  for (const act of deduped) {
    byCityMap.set(act.city, (byCityMap.get(act.city) || 0) + 1);
  }
  console.log("\nBy city:");
  for (const [city, count] of Array.from(byCityMap.entries()).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${city}: ${count}`);
  }

  // Count with prices
  const withPrice = deduped.filter((a) => a.priceJPY > 0);
  console.log(`\nWith price: ${withPrice.length} / ${deduped.length}`);

  if (withPrice.length > 0) {
    const prices = withPrice.map((a) => a.priceUSD);
    console.log(
      `Price range: $${Math.min(...prices).toFixed(2)} - $${Math.max(...prices).toFixed(2)} USD`
    );
    const avg =
      prices.reduce((sum, p) => sum + p, 0) / prices.length;
    console.log(`Average price: $${avg.toFixed(2)} USD`);
  }

  // Show samples
  console.log("\nSample activities:");
  for (const act of deduped.filter((a) => a.priceJPY > 0).slice(0, 8)) {
    console.log(`  - ${act.title.substring(0, 100)}`);
    console.log(`    URL: ${act.url}`);
    console.log(`    Price: ${act.priceDisplay}`);
    console.log(`    City: ${act.city}`);
    console.log(`    Image: ${act.image ? "Yes" : "No"}`);
    console.log();
  }

  // Save
  writeFileSync(outputPath, JSON.stringify(deduped, null, 2));
  console.log(`\nSaved ${deduped.length} activities to ${outputPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
