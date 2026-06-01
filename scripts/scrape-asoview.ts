import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

puppeteer.use(StealthPlugin());

interface Experience {
  id: string;
  slug: string;
  title: string;
  description: string;
  shortDescription: string;
  price: { amount: number; currency: string; display: string };
  duration: { hours: number; display: string };
  rating: { score: number; count: number };
  images: string[];
  thumbnail: string;
  location: { city: string; citySlug: string; region: string };
  categories: string[];
  themes: string[];
  highlights: string[];
  source: {
    platform: "asoview";
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
  price: string;
  rating: string;
  reviewCount: string;
  image: string;
  description: string;
  instagram: string;
}

const CITIES = [
  { name: "Tokyo", slug: "tokyo", region: "Kanto", path: "tokyo" },
  { name: "Kyoto", slug: "kyoto", region: "Kansai", path: "kyoto" },
  { name: "Osaka", slug: "osaka", region: "Kansai", path: "osaka" },
  { name: "Hiroshima", slug: "hiroshima", region: "Chugoku", path: "hiroshima" },
  { name: "Nara", slug: "nara", region: "Kansai", path: "nara" },
  { name: "Hakone", slug: "hakone", region: "Kanto", path: "hakone" },
];

const MAX_ITEMS_PER_CITY = 30;
const DELAY_MIN_MS = 3000;
const DELAY_MAX_MS = 5000;

function delay(ms?: number): Promise<void> {
  const wait = ms ?? DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS);
  return new Promise((resolve) => setTimeout(resolve, wait));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parsePrice(priceStr: string): {
  amount: number;
  currency: string;
  display: string;
} {
  if (!priceStr) return { amount: 0, currency: "JPY", display: "Price not available" };

  // Match Japanese yen patterns: ¥1,234 or 1,234円 or ￥1,234
  const match = priceStr.match(/([\d,]+)/);
  if (match) {
    const amount = parseInt(match[1].replace(/,/g, ""), 10);
    if (!isNaN(amount) && amount > 0) {
      return {
        amount,
        currency: "JPY",
        display: `¥${amount.toLocaleString()}`,
      };
    }
  }
  return { amount: 0, currency: "JPY", display: priceStr.trim() };
}

function parseRating(ratingStr: string): number {
  if (!ratingStr) return 0;
  const match = ratingStr.match(/([\d.]+)/);
  if (match) {
    const score = parseFloat(match[1]);
    return Math.min(score, 5);
  }
  return 0;
}

function parseReviewCount(str: string): number {
  if (!str) return 0;
  const match = str.match(/([\d,]+)/);
  return match ? parseInt(match[1].replace(/,/g, ""), 10) : 0;
}

function extractProductId(url: string): string {
  // Asoview URLs look like /plan/12345/ or /activity/12345/
  const match = url.match(/\/(plan|activity)\/([\w-]+)/);
  if (match) return match[2];

  // Fallback: use last path segment
  const segments = url.split("/").filter(Boolean);
  return segments[segments.length - 1] || "";
}

async function autoScroll(page: any, maxScrolls: number = 5): Promise<void> {
  await page.evaluate(async (maxScrolls: number) => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      let scrollCount = 0;
      const distance = 800;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        scrollCount++;

        if (totalHeight >= scrollHeight || scrollCount >= maxScrolls) {
          clearInterval(timer);
          resolve();
        }
      }, 500);
    });
  }, maxScrolls);
}

async function scrapeCity(
  city: (typeof CITIES)[number]
): Promise<RawItem[]> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1440, height: 900 });

  const results: RawItem[] = [];

  try {
    const url = `https://www.asoview.com/${city.path}/`;
    console.log(`  Fetching: ${url}`);

    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

    // Wait for content to load
    await delay(2000);

    // Scroll down multiple times to load lazy content
    console.log(`  Scrolling to load more content...`);
    await autoScroll(page, 8);
    await delay(1500);

    // Extract items from the page using multiple selector strategies
    const items = await page.evaluate(() => {
      const results: RawItem[] = [];

      // Strategy 1: Look for plan links (most common on Asoview)
      const planLinks = document.querySelectorAll(
        'a[href*="/plan/"], a[href*="/activity/"]'
      );

      const seen = new Set<string>();

      planLinks.forEach((link) => {
        const anchor = link as HTMLAnchorElement;
        const href = anchor.href || anchor.getAttribute("href") || "";

        // Skip duplicates
        if (seen.has(href) || !href) return;
        seen.add(href);

        // Find the card container (walk up to find a meaningful parent)
        const card =
          anchor.closest("[class*='card']") ||
          anchor.closest("[class*='Card']") ||
          anchor.closest("[class*='item']") ||
          anchor.closest("[class*='Item']") ||
          anchor.closest("li") ||
          anchor.closest("article") ||
          anchor;

        // Title: look for headings, strong text, or title-like elements
        const titleEl =
          card.querySelector("h2, h3, h4, [class*='title'], [class*='Title'], [class*='name'], [class*='Name']") ||
          card.querySelector("strong, b") ||
          anchor;
        const title = titleEl?.textContent?.trim() || "";

        // Skip if title is too short or looks like navigation
        if (!title || title.length < 3 || title.length > 200) return;

        // Price
        const priceEl = card.querySelector(
          "[class*='price'], [class*='Price'], [class*='cost'], [class*='yen'], [class*='amount']"
        );
        let price = priceEl?.textContent?.trim() || "";
        // Also try to find price pattern in card text
        if (!price) {
          const cardText = card.textContent || "";
          const priceMatch = cardText.match(/[¥￥][\d,]+|[\d,]+円/);
          if (priceMatch) price = priceMatch[0];
        }

        // Rating
        const ratingEl = card.querySelector(
          "[class*='rating'], [class*='Rating'], [class*='score'], [class*='star'], [class*='Star']"
        );
        const rating = ratingEl?.textContent?.trim() || "";

        // Review count
        const reviewEl = card.querySelector(
          "[class*='review'], [class*='Review'], [class*='count'], [class*='Count'], [class*='kuchikomi']"
        );
        const reviewCount = reviewEl?.textContent?.trim() || "";

        // Image - look within the card, or the link itself
        const imgEl =
          card.querySelector("img") || anchor.querySelector("img");
        let image = "";
        if (imgEl) {
          image =
            imgEl.getAttribute("src") ||
            imgEl.getAttribute("data-src") ||
            imgEl.getAttribute("data-original") ||
            imgEl.getAttribute("data-lazy-src") ||
            "";
        }
        // Also check for background image style
        if (!image) {
          const bgEl = card.querySelector("[style*='background-image']");
          if (bgEl) {
            const style = bgEl.getAttribute("style") || "";
            const bgMatch = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
            if (bgMatch) image = bgMatch[1];
          }
        }

        // Description
        const descEl = card.querySelector(
          "p, [class*='desc'], [class*='Desc'], [class*='text'], [class*='comment']"
        );
        const description = descEl?.textContent?.trim() || "";

        results.push({
          title,
          url: href.startsWith("http") ? href : `https://www.asoview.com${href}`,
          price,
          rating,
          reviewCount,
          image,
          description,
          instagram: "",
        });
      });

      // Strategy 2: Look for card-like containers if Strategy 1 found nothing
      if (results.length === 0) {
        const cards = document.querySelectorAll(
          "[class*='card'], [class*='Card'], [class*='planCard'], [class*='activity-item'], [class*='ActivityItem'], [class*='ListItem']"
        );

        cards.forEach((card) => {
          const linkEl = card.querySelector("a[href]");
          const href = linkEl?.getAttribute("href") || "";
          if (!href || seen.has(href)) return;
          seen.add(href);

          const titleEl = card.querySelector(
            "h2, h3, h4, [class*='title'], [class*='Title']"
          );
          const title = titleEl?.textContent?.trim() || "";
          if (!title || title.length < 3) return;

          const priceEl = card.querySelector("[class*='price'], [class*='Price']");
          const price = priceEl?.textContent?.trim() || "";

          const ratingEl = card.querySelector("[class*='rating'], [class*='star']");
          const rating = ratingEl?.textContent?.trim() || "";

          const reviewEl = card.querySelector("[class*='review'], [class*='count']");
          const reviewCount = reviewEl?.textContent?.trim() || "";

          const imgEl = card.querySelector("img");
          const image =
            imgEl?.getAttribute("src") ||
            imgEl?.getAttribute("data-src") ||
            "";

          const descEl = card.querySelector("p, [class*='desc']");
          const description = descEl?.textContent?.trim() || "";

          results.push({
            title,
            url: href.startsWith("http")
              ? href
              : `https://www.asoview.com${href}`,
            price,
            rating,
            reviewCount,
            image,
            description,
            instagram: "",
          });
        });
      }

      return results;
    });

    // Look for Instagram links on the page
    const instagramLinks = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="instagram.com"]');
      return Array.from(links).map((a) => a.getAttribute("href") || "");
    });
    const instagramUrl = instagramLinks.length > 0 ? instagramLinks[0] : "";

    // Attach instagram info to all items from this page
    for (const item of items) {
      item.instagram = instagramUrl;
    }

    results.push(...items);
    console.log(`  Found ${items.length} items for ${city.name}`);
  } catch (error: any) {
    console.error(
      `  Error scraping ${city.name}: ${error?.message || error}`
    );
  } finally {
    await browser.close();
  }

  // Deduplicate by URL and limit
  const uniqueResults = Array.from(
    new Map(results.map((item) => [item.url, item])).values()
  );
  return uniqueResults.slice(0, MAX_ITEMS_PER_CITY);
}

function normalizeToExperience(
  item: RawItem,
  city: (typeof CITIES)[number]
): Experience | null {
  const slug = slugify(item.title);
  if (!slug) return null;

  const productId = extractProductId(item.url);
  const price = parsePrice(item.price);
  const ratingScore = parseRating(item.rating);
  const reviewCount = parseReviewCount(item.reviewCount);

  const description =
    item.description ||
    `Experience ${item.title} in ${city.name}, Japan. Book through Asoview for a unique local activity.`;
  const shortDescription =
    item.description?.slice(0, 150) ||
    `${item.title} in ${city.name}, Japan.`;

  // Infer categories/themes from title and description
  const categories: string[] = [];
  const themes: string[] = [];
  const text = `${item.title} ${item.description}`.toLowerCase();

  if (text.match(/体験|experience|workshop/)) categories.push("experience");
  if (text.match(/ツアー|tour|散策/)) categories.push("tour");
  if (text.match(/アウトドア|outdoor|自然|nature/)) categories.push("outdoor");
  if (text.match(/グルメ|食|food|料理|cooking/)) categories.push("food");
  if (text.match(/温泉|spa|リラク/)) categories.push("wellness");
  if (text.match(/着物|kimono|文化|culture|伝統/)) themes.push("cultural");
  if (text.match(/アート|art|陶芸|pottery/)) themes.push("art");
  if (text.match(/アドベンチャー|adventure|ラフティング/)) themes.push("adventure");
  if (text.match(/家族|family|子供|kids/)) themes.push("family-friendly");
  if (text.match(/季節|seasonal|花見|紅葉/)) themes.push("seasonal");

  return {
    id: `asoview-${city.slug}-${slug}`,
    slug: `${city.slug}-${slug}`,
    title: item.title,
    description,
    shortDescription,
    price,
    duration: { hours: 2, display: "Varies" },
    rating: { score: ratingScore, count: reviewCount },
    images: item.image ? [item.image] : [],
    thumbnail: item.image || "",
    location: {
      city: city.name,
      citySlug: city.slug,
      region: city.region,
    },
    categories,
    themes,
    highlights: [],
    source: {
      platform: "asoview",
      url: item.url,
      productId: productId || slug,
      lastScraped: new Date().toISOString(),
    },
    bookingUrl: item.url,
    isPopular: reviewCount > 50 || ratingScore >= 4.5,
    isFeatured: false,
  };
}

async function main() {
  console.log("Starting Asoview scraper...\n");
  console.log(`Target: ${CITIES.length} cities, max ${MAX_ITEMS_PER_CITY} items per city`);
  console.log(`Delay between cities: ${DELAY_MIN_MS / 1000}-${DELAY_MAX_MS / 1000} seconds\n`);

  const allExperiences: Experience[] = [];
  const outputPath = join(process.cwd(), "data", "asoview-raw.json");

  // Ensure data directory exists
  mkdirSync(join(process.cwd(), "data"), { recursive: true });

  for (let i = 0; i < CITIES.length; i++) {
    const city = CITIES[i];
    console.log(`\n[${i + 1}/${CITIES.length}] Scraping ${city.name}...`);

    try {
      const rawItems = await scrapeCity(city);

      let cityCount = 0;
      for (const item of rawItems) {
        const experience = normalizeToExperience(item, city);
        if (experience) {
          allExperiences.push(experience);
          cityCount++;
        }
      }
      console.log(`  Normalized ${cityCount} experiences for ${city.name}`);
    } catch (error: any) {
      console.error(
        `  Failed to scrape ${city.name}: ${error?.message || error}`
      );
    }

    // Polite delay between cities (skip after last city)
    if (i < CITIES.length - 1) {
      const waitTime = DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS);
      console.log(`  Waiting ${(waitTime / 1000).toFixed(1)}s before next city...`);
      await delay(waitTime);
    }
  }

  // Deduplicate by ID
  const deduped = Array.from(
    new Map(allExperiences.map((exp) => [exp.id, exp])).values()
  );

  console.log(`\nTotal scraped: ${deduped.length} experiences`);
  writeFileSync(outputPath, JSON.stringify(deduped, null, 2));
  console.log(`Saved to ${outputPath}`);

  // Print summary
  console.log("\nSummary by city:");
  for (const city of CITIES) {
    const count = deduped.filter(
      (e) => e.location.citySlug === city.slug
    ).length;
    console.log(`  ${city.name}: ${count} experiences`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
