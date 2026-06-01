import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync } from "fs";
import { join } from "path";

puppeteer.use(StealthPlugin());

interface RawExperience {
  title: string;
  url: string;
  price: string;
  rating: string;
  reviewCount: string;
  duration: string;
  image: string;
  description: string;
}

const CITIES = [
  { name: "Tokyo", slug: "tokyo", region: "Kanto", gygId: "l196" },
  { name: "Kyoto", slug: "kyoto", region: "Kansai", gygId: "l395" },
  { name: "Osaka", slug: "osaka", region: "Kansai", gygId: "l397" },
  { name: "Hiroshima", slug: "hiroshima", region: "Chugoku", gygId: "l2369" },
  { name: "Nara", slug: "nara", region: "Kansai", gygId: "l2015" },
  { name: "Hakone", slug: "hakone", region: "Kanto", gygId: "l2513" },
];

async function scrapeCity(
  city: (typeof CITIES)[number],
  maxItems: number = 50
): Promise<RawExperience[]> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  const results: RawExperience[] = [];
  let pageNum = 1;

  try {
    while (results.length < maxItems) {
      const url = `https://www.getyourguide.com/${city.gygId}/?page=${pageNum}`;
      console.log(`  Fetching: ${url}`);

      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await page
        .waitForSelector('[data-activity-card-title], [class*="ActivityCard"]', {
          timeout: 10000,
        })
        .catch(() => null);

      const items = await page.evaluate(() => {
        const cards = document.querySelectorAll(
          '[class*="ActivityCard"], [class*="activity-card"], article'
        );
        return Array.from(cards).map((card) => {
          const titleEl = card.querySelector(
            "[data-activity-card-title], h2, h3, [class*='title']"
          );
          const linkEl = card.querySelector("a[href]");
          const priceEl = card.querySelector(
            "[class*='price'], [class*='Price'], [data-testid*='price']"
          );
          const ratingEl = card.querySelector(
            "[class*='rating'], [class*='Rating'], [class*='stars']"
          );
          const reviewEl = card.querySelector(
            "[class*='review'], [class*='Review']"
          );
          const durationEl = card.querySelector(
            "[class*='duration'], [class*='Duration']"
          );
          const imgEl = card.querySelector("img");
          const descEl = card.querySelector("p, [class*='description']");

          return {
            title: titleEl?.textContent?.trim() || "",
            url: linkEl?.getAttribute("href") || "",
            price: priceEl?.textContent?.trim() || "",
            rating: ratingEl?.textContent?.trim() || "",
            reviewCount: reviewEl?.textContent?.trim() || "",
            duration: durationEl?.textContent?.trim() || "",
            image: imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "",
            description: descEl?.textContent?.trim() || "",
          };
        });
      });

      if (items.length === 0) break;

      results.push(
        ...items.filter((item) => item.title && item.title.length > 0)
      );
      console.log(`  Found ${items.length} items (total: ${results.length})`);

      pageNum++;
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 2000));
    }
  } catch (error) {
    console.error(`  Error scraping ${city.name}:`, error);
  } finally {
    await browser.close();
  }

  return results.slice(0, maxItems);
}

function parsePrice(priceStr: string): {
  amount: number;
  currency: string;
  display: string;
} {
  const match = priceStr.match(/([\$€£¥])?\s*(\d[\d,.]*)/);
  if (match) {
    const amount = parseFloat(match[2].replace(",", ""));
    return {
      amount: isNaN(amount) ? 0 : amount,
      currency: "USD",
      display: `$${amount.toFixed(2)}`,
    };
  }
  return { amount: 0, currency: "USD", display: "$0.00" };
}

function parseRating(ratingStr: string): { score: number; count: number } {
  const scoreMatch = ratingStr.match(/([\d.]+)/);
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
  return { score: Math.min(score, 5), count: 0 };
}

function parseReviewCount(str: string): number {
  const match = str.match(/([\d,]+)/);
  return match ? parseInt(match[1].replace(",", "")) : 0;
}

function parseDuration(str: string): { hours: number; display: string } {
  if (!str) return { hours: 2, display: "2 hours" };
  const hoursMatch = str.match(/(\d+)\s*(?:hour|hr)/i);
  const minsMatch = str.match(/(\d+)\s*(?:min)/i);
  let hours = 0;
  if (hoursMatch) hours += parseInt(hoursMatch[1]);
  if (minsMatch) hours += parseInt(minsMatch[1]) / 60;
  if (hours === 0) hours = 2;
  return { hours, display: str || `${hours} hours` };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function main() {
  console.log("🐻 Starting GetYourGuide scraper...\n");

  const allResults: Record<string, unknown>[] = [];
  const outputPath = join(process.cwd(), "data", "getyourguide-raw.json");

  for (const city of CITIES) {
    console.log(`\n📍 Scraping ${city.name}...`);
    const raw = await scrapeCity(city);

    for (const item of raw) {
      const price = parsePrice(item.price);
      const rating = parseRating(item.rating);
      const reviewCount = parseReviewCount(item.reviewCount);
      const duration = parseDuration(item.duration);
      const slug = slugify(item.title);

      if (!slug) continue;

      allResults.push({
        id: `gyg-${city.slug}-${slug}`,
        slug: `${city.slug}-${slug}`,
        title: item.title,
        description:
          item.description || `Experience ${item.title} in ${city.name}, Japan.`,
        shortDescription:
          item.description?.slice(0, 150) ||
          `Experience ${item.title} in ${city.name}.`,
        price,
        duration,
        rating: { score: rating.score, count: reviewCount || rating.count },
        images: item.image ? [item.image] : [],
        thumbnail: item.image || "",
        location: { city: city.name, citySlug: city.slug, region: city.region },
        categories: [],
        themes: [],
        highlights: [],
        source: {
          platform: "getyourguide",
          url: item.url.startsWith("http")
            ? item.url
            : `https://www.getyourguide.com${item.url}`,
          productId: slug,
          lastScraped: new Date().toISOString(),
        },
        bookingUrl: item.url.startsWith("http")
          ? item.url
          : `https://www.getyourguide.com${item.url}`,
        isPopular: reviewCount > 100 || rating.score >= 4.5,
        isFeatured: false,
      });
    }
  }

  console.log(`\n✅ Total scraped: ${allResults.length} experiences`);
  writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  console.log(`💾 Saved to ${outputPath}`);
}

main().catch(console.error);
