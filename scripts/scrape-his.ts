import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

puppeteer.use(StealthPlugin());

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HISActivity {
  id: string;
  slug: string;
  title: string;
  description: string;
  shortDescription: string;
  price: { amount: number; currency: string; display: string; usd: number };
  duration: { hours: number; display: string };
  rating: { score: number; count: number };
  images: string[];
  thumbnail: string;
  location: { city: string; citySlug: string; region: string };
  categories: string[];
  themes: string[];
  highlights: string[];
  source: {
    platform: "his";
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
  image: string;
  price: string;
  rating: string;
  reviewCount: string;
  description: string;
  city: string;
}

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const JPY_TO_USD = 155;
const DELAY_MIN = 2000;
const DELAY_MAX = 4000;

function delay(ms?: number): Promise<void> {
  const wait = ms ?? DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN);
  return new Promise((r) => setTimeout(r, wait));
}

function slugify(text: string): string {
  // Support Japanese characters (hiragana, katakana, kanji) in slugs
  return text
    .toLowerCase()
    .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/*
 * HIS Activities URL patterns:
 *   TourLeaf/XXXNNNN/     - Individual activity/tour detail pages (the actual products)
 *   TourList/...          - Category listing pages
 *   CityTop/XXX/          - City landing pages
 *   NationTop/XXX/        - Nation landing pages
 *   SightSeeing/...       - Sightseeing spot pages
 *
 * Strategy:
 *   1. Load city/nation pages to find TourLeaf links
 *   2. Load TourList pages found to get more TourLeaf links
 *   3. Scrape each TourLeaf detail page for rich data
 */

const LISTING_PAGES: { url: string; city: string; region: string }[] = [
  { url: "https://activities.his-j.com/Top/", city: "", region: "" },
  { url: "https://activities.his-j.com/NationTop/JPN/", city: "Japan", region: "Japan" },
  { url: "https://activities.his-j.com/CityTop/OSA/", city: "Osaka", region: "Kansai" },
  { url: "https://activities.his-j.com/CityTop/HNL/", city: "Honolulu", region: "Hawaii" },
  { url: "https://activities.his-j.com/CityTop/GUM/", city: "Guam", region: "Pacific" },
  { url: "https://activities.his-j.com/CityTop/SEL/", city: "Seoul", region: "Korea" },
  { url: "https://activities.his-j.com/CityTop/TPE/", city: "Taipei", region: "Taiwan" },
  { url: "https://activities.his-j.com/CityTop/BKK/", city: "Bangkok", region: "Thailand" },
  { url: "https://activities.his-j.com/CityTop/DPS/", city: "Bali", region: "Indonesia" },
  { url: "https://activities.his-j.com/CityTop/CNS/", city: "Cairns", region: "Australia" },
  { url: "https://activities.his-j.com/CityTop/PAR/", city: "Paris", region: "France" },
  { url: "https://activities.his-j.com/CityTop/LAX/", city: "Los Angeles", region: "USA" },
  { url: "https://activities.his-j.com/CityTop/SGN/", city: "Ho Chi Minh", region: "Vietnam" },
  { url: "https://activities.his-j.com/CityTop/DAD/", city: "Da Nang", region: "Vietnam" },
  // Japan-specific tour lists
  { url: "https://activities.his-j.com/TourList/O9/JPN/OSA/", city: "Osaka", region: "Kansai" },
  { url: "https://activities.his-j.com/TourList/O9/JPN/", city: "Japan", region: "Japan" },
];

/* ------------------------------------------------------------------ */
/*  Browser scripts (plain ES5 strings to avoid tsx __name bug)        */
/* ------------------------------------------------------------------ */

const SCROLL_SCRIPT = `
(async function() {
  for (var i = 0; i < 20; i++) {
    window.scrollBy(0, 600);
    window.dispatchEvent(new Event("scroll"));
    await new Promise(function(r) { setTimeout(r, 300); });
  }
  window.scrollTo(0, 0);
  await new Promise(function(r) { setTimeout(r, 300); });
  for (var i = 0; i < 15; i++) {
    window.scrollBy(0, 800);
    window.dispatchEvent(new Event("scroll"));
    await new Promise(function(r) { setTimeout(r, 250); });
  }
})()
`;

// Extract all TourLeaf and TourList links from a page
const EXTRACT_LINKS_SCRIPT = `
(function() {
  var tourLeafLinks = [];
  var tourListLinks = [];
  var allAnchors = document.querySelectorAll("a[href]");
  var seenLeaf = {};
  var seenList = {};
  for (var i = 0; i < allAnchors.length; i++) {
    var href = allAnchors[i].href || allAnchors[i].getAttribute("href") || "";
    if (href.indexOf("activities.his-j.com") === -1) continue;
    // Clean query params from the link
    var cleanUrl = href.split("?")[0];
    if (cleanUrl.indexOf("TourLeaf/") !== -1 && !seenLeaf[cleanUrl]) {
      // Remove /Reviews/ suffix to get base tour page
      cleanUrl = cleanUrl.replace(/\\/Reviews\\/?$/, "/");
      if (!seenLeaf[cleanUrl]) {
        seenLeaf[cleanUrl] = true;
        tourLeafLinks.push(cleanUrl);
      }
    }
    if (cleanUrl.indexOf("TourList/") !== -1 && !seenList[cleanUrl]) {
      seenList[cleanUrl] = true;
      tourListLinks.push(cleanUrl);
    }
  }
  return { tourLeafLinks: tourLeafLinks, tourListLinks: tourListLinks };
})()
`;

// Extract details from a TourLeaf detail page
const EXTRACT_DETAIL_SCRIPT = `
(function() {
  function absUrl(href) {
    if (!href) return "";
    if (href.indexOf("http") === 0) return href;
    if (href.indexOf("//") === 0) return "https:" + href;
    return "https://activities.his-j.com" + (href.charAt(0) === "/" ? "" : "/") + href;
  }

  // Title - extract from document.title (format: 【H.I.S.】TITLE CITY のオプショナルツアー｜...)
  var title = "";
  var docTitle = document.title || "";
  // Remove 【H.I.S.】 prefix and ｜海外現地ツアー... suffix
  var titleMatch = docTitle.match(/(?:【H\\.I\\.S\\.】)?(.+?)(?:のオプショナルツアー|$)/);
  if (titleMatch) {
    title = titleMatch[1].trim();
    // Remove city suffix like "ソウル(韓国) " at end
    title = title.replace(/[^）)]+\\([^）)]+\\)\\s*$/, "").trim();
  }
  if (!title || title.length < 5) {
    // Fallback: try body text for the tour name (appears after breadcrumb)
    var bodyText = document.body.innerText || "";
    var lines = bodyText.split("\\n").map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 5 && l.length < 200; });
    // The activity name typically appears within the first 20 meaningful lines
    for (var li = 0; li < Math.min(lines.length, 30); li++) {
      var line = lines[li];
      // Skip navigation/breadcrumb lines
      if (line.indexOf("ホーム") !== -1 || line.indexOf("メニュー") !== -1) continue;
      if (line.indexOf("店舗") !== -1 || line.indexOf("会員") !== -1) continue;
      if (line.indexOf("海外旅行") !== -1 || line.indexOf("オプショナル") !== -1) continue;
      if (line.length > 10 && line.length < 150) {
        title = line;
        break;
      }
    }
  }
  if (!title) title = docTitle.replace(/【H\\.I\\.S\\.】/, "").substring(0, 100);
  title = title.replace(/\\s+/g, " ").trim();

  // Image - look for main/hero image, skip header/logo images
  var image = "";
  var imgCandidates = [
    "[class*='slide'] img", "[class*='slider'] img", "[class*='swiper'] img",
    "[class*='gallery'] img", "[class*='photo'] img", "[class*='visual'] img",
    "[class*='hero'] img", "[class*='main-image'] img", "[class*='thumb'] img",
    "main img", ".main img"
  ];
  for (var ci = 0; ci < imgCandidates.length; ci++) {
    var img = document.querySelector(imgCandidates[ci]);
    if (img) {
      var src = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || img.getAttribute("data-original") || "";
      if (src && src.indexOf("logo") === -1 && src.indexOf("icon") === -1 && src.indexOf("svg") === -1 && src.length > 20) {
        image = absUrl(src);
        break;
      }
    }
  }
  if (!image) {
    // Look for any img with a reasonable src in the main content area
    var mainArea = document.querySelector("main") || document.querySelector("[class*='content']") || document.body;
    var imgs = mainArea.querySelectorAll("img");
    for (var ii = 0; ii < imgs.length && ii < 20; ii++) {
      var s = imgs[ii].getAttribute("src") || imgs[ii].getAttribute("data-src") || "";
      if (s && s.indexOf("logo") === -1 && s.indexOf("icon") === -1 && s.indexOf("banner") === -1 && s.indexOf("svg") === -1 && s.length > 30) {
        image = absUrl(s);
        break;
      }
    }
  }

  // Price - look for price-selling class first (discovered from page structure)
  var price = "";
  var priceSelling = document.querySelector(".price-selling");
  if (priceSelling) {
    price = (priceSelling.textContent || "").trim();
  }
  if (!price) {
    // Try other price selectors
    var priceSelectors = [
      ".price-selling", "[class*='price-selling']",
      "[class*='priceAmount']", "[class*='price_amount']",
      "[class*='tourPrice']", "[class*='price']"
    ];
    for (var pi = 0; pi < priceSelectors.length; pi++) {
      var pel = document.querySelector(priceSelectors[pi]);
      if (pel) {
        var pt = (pel.textContent || "").trim();
        var pm = pt.match(/([\\d,]+)\\s*円/);
        if (pm) {
          var num = parseInt(pm[1].replace(/,/g, ""), 10);
          if (num >= 500) {
            price = pm[0];
            break;
          }
        }
      }
    }
  }
  // Broader search in body text for the first reasonable price
  if (!price) {
    var bt = (document.body.innerText || "").substring(0, 3000);
    var allPrices = bt.match(/([\\d,]+)円/g) || [];
    for (var api = 0; api < allPrices.length; api++) {
      var pmatch = allPrices[api].match(/([\\d,]+)/);
      if (pmatch) {
        var val = parseInt(pmatch[1].replace(/,/g, ""), 10);
        if (val >= 500 && val < 1000000) {
          price = allPrices[api];
          break;
        }
      }
    }
  }

  // Rating - look for star rating pattern (e.g. "4.4 52" seen in body text)
  var rating = "";
  var ratingEl = document.querySelector("[class*='rating'], [class*='review-score'], [class*='star']");
  if (ratingEl) {
    rating = (ratingEl.textContent || "").trim();
  }
  if (!rating) {
    // Search body text for a rating pattern like "4.4" followed by review count
    var rbt = (document.body.innerText || "").substring(0, 2000);
    var ratingMatch = rbt.match(/(\\d\\.\\d)\\s+(\\d+)/);
    if (ratingMatch) {
      rating = ratingMatch[1] + " (" + ratingMatch[2] + ")";
    }
  }

  // Description - look for substantial paragraph text
  var description = "";
  var descSelectors = [
    "[class*='description']", "[class*='outline']", "[class*='tourDetail']",
    "[class*='detail-body']", "[class*='tour-desc']", "[class*='intro']",
    "[class*='summary']"
  ];
  for (var di = 0; di < descSelectors.length; di++) {
    var del2 = document.querySelector(descSelectors[di]);
    if (del2) {
      var dt = (del2.textContent || "").replace(/\\s+/g, " ").trim();
      if (dt.length > 30 && dt.length < 2000) { description = dt.substring(0, 400); break; }
    }
  }
  if (!description) {
    var paras = document.querySelectorAll("p");
    for (var ppi = 0; ppi < paras.length; ppi++) {
      var ptext = (paras[ppi].textContent || "").replace(/\\s+/g, " ").trim();
      if (ptext.length > 50 && ptext.length < 1000) {
        description = ptext.substring(0, 400);
        break;
      }
    }
  }

  return {
    title: title,
    url: window.location.href,
    image: image,
    price: price,
    rating: rating,
    description: description
  };
})()
`;

/* ------------------------------------------------------------------ */
/*  Normalise helpers                                                  */
/* ------------------------------------------------------------------ */

function parseJPYPrice(str: string): { amount: number; usd: number; display: string } {
  if (!str) return { amount: 0, usd: 0, display: "Price not available" };
  // Match the largest number in the string that looks like a price
  const matches = str.match(/[\d,]+/g);
  if (matches) {
    for (const m of matches) {
      const amount = parseInt(m.replace(/,/g, ""), 10);
      if (!isNaN(amount) && amount >= 500 && amount < 1000000) {
        const usd = Math.round((amount / JPY_TO_USD) * 100) / 100;
        return { amount, usd, display: `¥${amount.toLocaleString()} (~$${usd.toFixed(0)})` };
      }
    }
  }
  return { amount: 0, usd: 0, display: str.trim() || "Price not available" };
}

function parseRating(str: string): { score: number; count: number } {
  if (!str) return { score: 0, count: 0 };
  const scoreMatch = str.match(/(\d+\.?\d*)/);
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
  const countMatch = str.match(/\((\d[\d,]*)\)|（(\d[\d,]*)）|(\d[\d,]*)\s*件/);
  let count = 0;
  if (countMatch) {
    const raw = (countMatch[1] || countMatch[2] || countMatch[3] || "").replace(/,/g, "");
    count = parseInt(raw, 10) || 0;
  }
  return { score: Math.min(score, 5), count };
}

function extractProductId(url: string): string {
  const m = url.match(/TourLeaf\/([A-Za-z0-9]+)/);
  if (m) return m[1];
  const segments = url.split("/").filter(Boolean);
  return segments[segments.length - 1] || "";
}

function inferCity(raw: RawItem): { city: string; slug: string; region: string } {
  const text = `${raw.title} ${raw.description} ${raw.url} ${raw.city}`.toLowerCase();

  // Infer from URL city code (TourLeaf/XXXnnnn pattern)
  const codeMatch = raw.url.match(/TourLeaf\/([A-Z]{3})/);
  const cityCode = codeMatch ? codeMatch[1] : "";

  // Map common HIS city codes
  const codeMap: Record<string, { city: string; slug: string; region: string }> = {
    TYO: { city: "Tokyo", slug: "tokyo", region: "Kanto" },
    OSA: { city: "Osaka", slug: "osaka", region: "Kansai" },
    KYT: { city: "Kyoto", slug: "kyoto", region: "Kansai" },
    SPK: { city: "Sapporo", slug: "sapporo", region: "Hokkaido" },
    OKA: { city: "Okinawa", slug: "okinawa", region: "Okinawa" },
    FKO: { city: "Fukuoka", slug: "fukuoka", region: "Kyushu" },
    NGO: { city: "Nagoya", slug: "nagoya", region: "Chubu" },
    HIJ: { city: "Hiroshima", slug: "hiroshima", region: "Chugoku" },
    HNL: { city: "Honolulu", slug: "honolulu", region: "Hawaii" },
    GUM: { city: "Guam", slug: "guam", region: "Pacific" },
    SEL: { city: "Seoul", slug: "seoul", region: "Korea" },
    TPE: { city: "Taipei", slug: "taipei", region: "Taiwan" },
    BKK: { city: "Bangkok", slug: "bangkok", region: "Thailand" },
    DPS: { city: "Bali", slug: "bali", region: "Indonesia" },
    CNS: { city: "Cairns", slug: "cairns", region: "Australia" },
    PAR: { city: "Paris", slug: "paris", region: "France" },
    LAX: { city: "Los Angeles", slug: "los-angeles", region: "USA" },
    SGN: { city: "Ho Chi Minh", slug: "ho-chi-minh", region: "Vietnam" },
    DAD: { city: "Da Nang", slug: "da-nang", region: "Vietnam" },
    ROM: { city: "Rome", slug: "rome", region: "Italy" },
    BCN: { city: "Barcelona", slug: "barcelona", region: "Spain" },
    LON: { city: "London", slug: "london", region: "UK" },
    SIN: { city: "Singapore", slug: "singapore", region: "Singapore" },
    KUL: { city: "Kuala Lumpur", slug: "kuala-lumpur", region: "Malaysia" },
    SYD: { city: "Sydney", slug: "sydney", region: "Australia" },
    NYC: { city: "New York", slug: "new-york", region: "USA" },
    LAS: { city: "Las Vegas", slug: "las-vegas", region: "USA" },
    SFO: { city: "San Francisco", slug: "san-francisco", region: "USA" },
  };

  if (cityCode && codeMap[cityCode]) return codeMap[cityCode];

  // Text-based inference
  if (text.includes("tokyo") || text.includes("東京")) return { city: "Tokyo", slug: "tokyo", region: "Kanto" };
  if (text.includes("kyoto") || text.includes("京都")) return { city: "Kyoto", slug: "kyoto", region: "Kansai" };
  if (text.includes("osaka") || text.includes("大阪")) return { city: "Osaka", slug: "osaka", region: "Kansai" };
  if (text.includes("okinawa") || text.includes("沖縄")) return { city: "Okinawa", slug: "okinawa", region: "Okinawa" };
  if (text.includes("hokkaido") || text.includes("北海道") || text.includes("sapporo") || text.includes("札幌"))
    return { city: "Hokkaido", slug: "hokkaido", region: "Hokkaido" };
  if (text.includes("honolulu") || text.includes("ホノルル") || text.includes("hawaii") || text.includes("ハワイ"))
    return { city: "Honolulu", slug: "honolulu", region: "Hawaii" };
  if (text.includes("guam") || text.includes("グアム")) return { city: "Guam", slug: "guam", region: "Pacific" };
  if (text.includes("seoul") || text.includes("ソウル") || text.includes("韓国"))
    return { city: "Seoul", slug: "seoul", region: "Korea" };
  if (text.includes("taipei") || text.includes("台北") || text.includes("台湾"))
    return { city: "Taipei", slug: "taipei", region: "Taiwan" };
  if (text.includes("bangkok") || text.includes("バンコク"))
    return { city: "Bangkok", slug: "bangkok", region: "Thailand" };
  if (text.includes("bali") || text.includes("バリ")) return { city: "Bali", slug: "bali", region: "Indonesia" };
  if (text.includes("paris") || text.includes("パリ")) return { city: "Paris", slug: "paris", region: "France" };
  if (text.includes("los angeles") || text.includes("ロサンゼルス"))
    return { city: "Los Angeles", slug: "los-angeles", region: "USA" };

  if (raw.city && raw.city !== "Various" && raw.city !== "Japan" && raw.city !== "")
    return { city: raw.city, slug: slugify(raw.city), region: raw.city };
  return { city: "Various", slug: "various", region: "" };
}

function normalise(raw: RawItem): HISActivity | null {
  const slug = slugify(raw.title);
  if (!slug || slug.length < 3) return null;

  const loc = inferCity(raw);
  const { amount, usd, display } = parseJPYPrice(raw.price);
  const { score, count } = parseRating(raw.rating);
  const productId = extractProductId(raw.url);

  const categories: string[] = [];
  const themes: string[] = [];
  const text = `${raw.title} ${raw.description}`.toLowerCase();
  if (text.match(/体験|experience|workshop/)) categories.push("experience");
  if (text.match(/ツアー|tour|散策|観光/)) categories.push("tour");
  if (text.match(/アウトドア|outdoor|自然|nature|シュノーケル|ダイビング|snorkel|diving|カヤック|kayak/)) categories.push("outdoor");
  if (text.match(/グルメ|食|food|料理|cooking|寿司|sushi|ramen|ディナー|dinner|lunch|レストラン/)) categories.push("food");
  if (text.match(/温泉|spa|リラク|onsen|マッサージ|massage/)) categories.push("wellness");
  if (text.match(/着物|kimono|文化|culture|伝統|tea ceremony|寺|temple|shrine/)) themes.push("cultural");
  if (text.match(/アート|art|陶芸|pottery|美術/)) themes.push("art");
  if (text.match(/アドベンチャー|adventure|ラフティング|zipline|パラセール|parasail/)) themes.push("adventure");
  if (text.match(/家族|family|子供|kids/)) themes.push("family-friendly");
  if (text.match(/night|夜|illumination|イルミ|ナイト|サンセット|sunset/)) themes.push("nightlife");
  if (text.match(/クルーズ|cruise|船|boat/)) themes.push("cruise");
  if (text.match(/ショー|show|エンタメ|entertainment|ルアウ|luau/)) themes.push("entertainment");
  if (text.match(/送迎|transfer|シャトル|shuttle|空港|airport/)) categories.push("transfer");
  if (categories.length === 0) categories.push("tour"); // Default

  return {
    id: `his-${productId}`,
    slug: `${loc.slug}-${slug}`,
    title: raw.title,
    description: raw.description || `${raw.title} – Book through HIS Activities.`,
    shortDescription: (raw.description || raw.title).slice(0, 150),
    price: { amount, currency: "JPY", display, usd },
    duration: { hours: 0, display: "Varies" },
    rating: { score, count },
    images: raw.image ? [raw.image] : [],
    thumbnail: raw.image || "",
    location: { city: loc.city, citySlug: loc.slug, region: loc.region },
    categories,
    themes,
    highlights: [],
    source: {
      platform: "his",
      url: raw.url,
      productId,
      lastScraped: new Date().toISOString(),
    },
    bookingUrl: raw.url,
    isPopular: count > 30 || score >= 4.5,
    isFeatured: false,
  };
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  console.log("=== HIS Activities Scraper ===\n");
  console.log(`Listing pages: ${LISTING_PAGES.length}`);
  console.log(`JPY/USD rate: ${JPY_TO_USD}\n`);

  const outputPath = join(process.cwd(), "data", "his-raw.json");
  mkdirSync(join(process.cwd(), "data"), { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--window-size=1440,900",
    ],
  });

  const tourLeafUrls = new Set<string>();
  const tourListUrls = new Set<string>();

  // Phase 1: Collect TourLeaf links from listing pages
  console.log("--- Phase 1: Collecting activity links from listing pages ---\n");

  for (let i = 0; i < LISTING_PAGES.length; i++) {
    const entry = LISTING_PAGES[i];
    console.log(`[${i + 1}/${LISTING_PAGES.length}] ${entry.url}`);

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1440, height: 900 });
    await page.setExtraHTTPHeaders({ "Accept-Language": "ja,en;q=0.9" });

    try {
      const resp = await page.goto(entry.url, { waitUntil: "networkidle2", timeout: 40000 }).catch(() => null);
      if (!resp || resp.status() >= 400) {
        console.log(`  [SKIP] ${resp?.status() || "no response"}`);
        await page.close();
        continue;
      }

      await delay(1500);
      await page.evaluate(SCROLL_SCRIPT);
      await delay(1000);

      const links: any = await page.evaluate(EXTRACT_LINKS_SCRIPT);
      const leafCount = (links.tourLeafLinks || []).length;
      const listCount = (links.tourListLinks || []).length;
      console.log(`  Found ${leafCount} TourLeaf + ${listCount} TourList links`);

      for (const l of links.tourLeafLinks || []) tourLeafUrls.add(l);
      for (const l of links.tourListLinks || []) tourListUrls.add(l);
    } catch (err: any) {
      console.log(`  [ERROR] ${(err?.message || "").slice(0, 100)}`);
    }

    await page.close();
    if (i < LISTING_PAGES.length - 1) await delay(1500);
  }

  console.log(`\nTotal unique TourLeaf URLs: ${tourLeafUrls.size}`);
  console.log(`Total unique TourList URLs: ${tourListUrls.size}`);

  // Phase 1b: Scrape some TourList pages to find more TourLeaf links
  const tourListsToScrape = [...tourListUrls].slice(0, 20);
  if (tourListsToScrape.length > 0) {
    console.log(`\n--- Phase 1b: Scraping ${tourListsToScrape.length} TourList pages for more activities ---\n`);

    for (let i = 0; i < tourListsToScrape.length; i++) {
      const url = tourListsToScrape[i];
      console.log(`[${i + 1}/${tourListsToScrape.length}] ${url}`);

      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      );
      await page.setViewport({ width: 1440, height: 900 });
      await page.setExtraHTTPHeaders({ "Accept-Language": "ja,en;q=0.9" });

      try {
        const resp = await page.goto(url, { waitUntil: "networkidle2", timeout: 35000 }).catch(() => null);
        if (!resp || resp.status() >= 400) {
          await page.close();
          continue;
        }

        await delay(1000);
        await page.evaluate(SCROLL_SCRIPT);
        await delay(800);

        const links: any = await page.evaluate(EXTRACT_LINKS_SCRIPT);
        const newLeafs = (links.tourLeafLinks || []).filter((l: string) => !tourLeafUrls.has(l));
        for (const l of links.tourLeafLinks || []) tourLeafUrls.add(l);
        console.log(`  +${newLeafs.length} new TourLeaf links (total: ${tourLeafUrls.size})`);
      } catch { /* ignore */ }

      await page.close();
      if (i < tourListsToScrape.length - 1) await delay(1500);
    }
  }

  console.log(`\n--- Total TourLeaf URLs to scrape: ${tourLeafUrls.size} ---\n`);

  // Phase 2: Scrape individual TourLeaf detail pages
  const leafList = [...tourLeafUrls].slice(0, 100); // Limit to avoid excessive scraping
  console.log(`--- Phase 2: Scraping ${leafList.length} TourLeaf detail pages ---\n`);

  const allRaw: RawItem[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < leafList.length; i++) {
    const url = leafList[i];
    if ((i + 1) % 10 === 0 || i === 0) {
      console.log(`  Progress: ${i + 1}/${leafList.length} (${successCount} extracted, ${failCount} failed)`);
    }

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1440, height: 900 });
    await page.setExtraHTTPHeaders({ "Accept-Language": "ja,en;q=0.9" });

    try {
      const resp = await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 }).catch(() => null);
      if (!resp || resp.status() >= 400) {
        failCount++;
        await page.close();
        continue;
      }

      await delay(800);
      // Quick scroll to load images
      await page.evaluate(`
        (async function() {
          window.scrollBy(0, 500);
          await new Promise(function(r) { setTimeout(r, 200); });
          window.scrollBy(0, 500);
          await new Promise(function(r) { setTimeout(r, 200); });
          window.scrollBy(0, 500);
        })()
      `);
      await delay(500);

      const detail: any = await page.evaluate(EXTRACT_DETAIL_SCRIPT);

      if (detail && detail.title && detail.title.length > 3) {
        allRaw.push({
          title: detail.title,
          url: detail.url || url,
          image: detail.image || "",
          price: detail.price || "",
          rating: detail.rating || "",
          reviewCount: "",
          description: detail.description || "",
          city: "",
        });
        successCount++;
      } else {
        failCount++;
      }
    } catch {
      failCount++;
    }

    await page.close();
    // Small delay between pages
    if (i < leafList.length - 1) await delay(1200);
  }

  console.log(`\n  Phase 2 complete: ${successCount} extracted, ${failCount} failed`);

  await browser.close();

  // Deduplicate by URL
  const deduped = Array.from(new Map(allRaw.map((item) => [item.url, item])).values());
  console.log(`\n--- Raw items: ${allRaw.length}, after dedup: ${deduped.length} ---\n`);

  // Normalise
  const activities: HISActivity[] = [];
  for (const raw of deduped) {
    const act = normalise(raw);
    if (act) activities.push(act);
  }

  // Deduplicate normalised by id
  const final = Array.from(new Map(activities.map((a) => [a.id, a])).values());

  console.log(`Normalised: ${final.length} activities\n`);

  // Save
  writeFileSync(outputPath, JSON.stringify(final, null, 2));
  console.log(`Saved to ${outputPath}`);

  // Summary
  const byCityMap = new Map<string, number>();
  for (const a of final) {
    byCityMap.set(a.location.city, (byCityMap.get(a.location.city) || 0) + 1);
  }
  console.log("\nBy city:");
  for (const [city, count] of [...byCityMap.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${city}: ${count}`);
  }

  const withPrice = final.filter((a) => a.price.amount > 0).length;
  const withImage = final.filter((a) => a.thumbnail).length;
  const withRating = final.filter((a) => a.rating.score > 0).length;
  console.log(`\nWith price: ${withPrice}/${final.length}`);
  console.log(`With image: ${withImage}/${final.length}`);
  console.log(`With rating: ${withRating}/${final.length}`);

  if (final.length > 0) {
    console.log("\nSample entries:");
    for (const a of final.slice(0, 8)) {
      console.log(`  - "${a.title.slice(0, 70)}" | ${a.price.display} | ${a.location.city}`);
      console.log(`    ${a.source.url}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
