/**
 * Jalan Deep Activity Scraper
 * Goes into category pages to find actual individual activity listings
 * Uses the activity_plan pages which have the real bookable activities
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync } from "fs";
import { join } from "path";
import type { Page } from "puppeteer";

puppeteer.use(StealthPlugin());

// Genre-specific category pages that list individual activities
const JALAN_GENRE_URLS = [
  // Tokyo categories
  { url: "https://www.jalan.net/activity/130000/g2_77/?screenId=OUW1601&dateUndecided=1&asobiKbn=1", city: "Tokyo", category: "buffet" },
  { url: "https://www.jalan.net/activity/130000/g2_14/?screenId=OUW1601&dateUndecided=1&asobiKbn=1", city: "Tokyo", category: "pottery" },
  { url: "https://www.jalan.net/activity/130000/g2_45/?screenId=OUW1601&dateUndecided=1&asobiKbn=1", city: "Tokyo", category: "glass" },
  { url: "https://www.jalan.net/activity/130000/g2_e9/?screenId=OUW1601&dateUndecided=1&asobiKbn=1", city: "Tokyo", category: "cooking" },
  { url: "https://www.jalan.net/activity/130000/g2_85/?screenId=OUW1601&dateUndecided=1&asobiKbn=1", city: "Tokyo", category: "sweets" },
  { url: "https://www.jalan.net/activity/130000/g2_901/?screenId=OUW1601&dateUndecided=1&asobiKbn=1", city: "Tokyo", category: "candle" },
  { url: "https://www.jalan.net/activity/130000/g2_S0/?screenId=OUW1601&dateUndecided=1&asobiKbn=1", city: "Tokyo", category: "soba" },
  { url: "https://www.jalan.net/activity/130000/g2_3g112/?screenId=OUW1601&dateUndecided=1&asobiKbn=1", city: "Tokyo", category: "accessory" },
  // Kyoto
  { url: "https://www.jalan.net/activity/260000/g2_14/?screenId=OUW1601&dateUndecided=1&asobiKbn=1", city: "Kyoto", category: "pottery" },
  { url: "https://www.jalan.net/activity/260000/g2_e9/?screenId=OUW1601&dateUndecided=1&asobiKbn=1", city: "Kyoto", category: "cooking" },
  { url: "https://www.jalan.net/activity/260000/g2_77/?screenId=OUW1601&dateUndecided=1&asobiKbn=1", city: "Kyoto", category: "buffet" },
  // Osaka
  { url: "https://www.jalan.net/activity/270000/g2_77/?screenId=OUW1601&dateUndecided=1&asobiKbn=1", city: "Osaka", category: "buffet" },
  { url: "https://www.jalan.net/activity/270000/g2_14/?screenId=OUW1601&dateUndecided=1&asobiKbn=1", city: "Osaka", category: "pottery" },
  { url: "https://www.jalan.net/activity/270000/g2_e9/?screenId=OUW1601&dateUndecided=1&asobiKbn=1", city: "Osaka", category: "cooking" },
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
  shopName: string;
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function scrapeActivityList(page: Page, url: string, city: string, category: string): Promise<ScrapedItem[]> {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await delay(2000);

    const title = await page.title();
    console.log(`    Title: "${title.slice(0, 60)}"`);

    if (title.includes("エラー") || title.includes("存在しません")) {
      return [];
    }

    // Scroll to load content
    for (let i = 0; i < 12; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await delay(300);
    }

    const items = await page.evaluate((c: string, cat: string) => {
      const results: ScrapedItem[] = [];
      const seen = new Set<string>();

      // Jalan activity listings have specific patterns
      // Look for activity plan cards
      const cards = document.querySelectorAll(
        '[class*="cassette"], [class*="list-item"], [class*="plan-card"], ' +
        '[class*="activity-card"], [class*="search-result"], ' +
        'li[class*="item"], div[class*="spot"]'
      );

      cards.forEach((card) => {
        // Find the main link
        const links = card.querySelectorAll('a[href*="kankou/spt_"], a[href*="activity_plan"], a[href*="activity/l"]');
        if (links.length === 0) return;

        const mainLink = links[0];
        const href = mainLink.getAttribute("href") || "";
        if (seen.has(href) || !href) return;

        // Find image
        const img = card.querySelector("img");
        if (!img) return;

        let imgSrc = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-original") || "";
        if (!imgSrc || imgSrc.includes("spacer") || imgSrc.includes("blank") || imgSrc.includes("logo") || imgSrc.length < 10) return;

        // Get title
        let titleText = "";
        const titleEl = card.querySelector("h2, h3, h4, [class*='title'], [class*='name'], [class*='spot']>a, strong");
        if (titleEl) {
          titleText = titleEl.textContent?.trim() || "";
        }
        if (!titleText || titleText.length < 3) {
          titleText = mainLink.textContent?.trim().split("\n")[0]?.trim() || "";
        }
        if (!titleText || titleText.length < 3) {
          titleText = img.getAttribute("alt") || "";
        }
        if (!titleText || titleText.length < 3 || titleText.length > 200) return;

        // Get shop name
        let shopName = "";
        const shopEl = card.querySelector('[class*="shop"], [class*="provider"]');
        if (shopEl) shopName = shopEl.textContent?.trim() || "";

        // Get price
        const allText = card.textContent || "";
        const priceMatches = allText.match(/(\d{1,3}(?:,\d{3})*)\s*円/g);
        let price = "";
        let priceNum = 0;
        if (priceMatches) {
          // Take the smallest price (likely per person)
          const prices = priceMatches.map(p => {
            const m = p.match(/(\d{1,3}(?:,\d{3})*)/);
            return m ? parseInt(m[1].replace(/,/g, "")) : 0;
          }).filter(p => p > 0);
          if (prices.length > 0) {
            priceNum = Math.min(...prices);
            price = `${priceNum.toLocaleString()}円`;
          }
        }

        // Rating
        const ratingMatch = allText.match(/(\d\.\d)/);
        const rating = ratingMatch ? ratingMatch[1] : "";

        // Review count
        const reviewMatch = allText.match(/(\d+)\s*件/);
        const reviewCount = reviewMatch ? reviewMatch[1] : "";

        seen.add(href);
        results.push({
          title: titleText.replace(/\s+/g, " ").trim().slice(0, 200),
          url: href.startsWith("http") ? href : `https://www.jalan.net${href}`,
          image: imgSrc.startsWith("http") ? imgSrc : `https://www.jalan.net${imgSrc}`,
          price,
          priceNum,
          rating,
          reviewCount,
          city: c,
          category: cat,
          shopName,
        });
      });

      // Also scan for activity links with images using broader search
      if (results.length === 0) {
        const allImgs = document.querySelectorAll("img");
        allImgs.forEach((img) => {
          const imgSrc = img.getAttribute("src") || img.getAttribute("data-src") || "";
          if (!imgSrc || imgSrc.includes("icon") || imgSrc.includes("logo") || imgSrc.includes("blank") || imgSrc.includes("spacer")) return;
          if (!imgSrc.includes("jalan") && !imgSrc.includes("activityboard")) return;

          // Walk up to find a link
          let el: Element | null = img;
          let link: HTMLAnchorElement | null = null;
          for (let i = 0; i < 5; i++) {
            el = el?.parentElement || null;
            if (!el) break;
            if (el.tagName === "A") {
              link = el as HTMLAnchorElement;
              break;
            }
            const a = el.querySelector("a");
            if (a) {
              link = a;
              break;
            }
          }
          if (!link) return;

          const href = link.getAttribute("href") || "";
          if (!href || seen.has(href)) return;

          const title = img.getAttribute("alt") || link.textContent?.trim().split("\n")[0]?.trim() || "";
          if (!title || title.length < 3) return;

          seen.add(href);
          results.push({
            title: title.slice(0, 200),
            url: href.startsWith("http") ? href : `https://www.jalan.net${href}`,
            image: imgSrc.startsWith("http") ? imgSrc : `https://www.jalan.net${imgSrc}`,
            price: "",
            priceNum: 0,
            rating: "",
            reviewCount: "",
            city: c,
            category: cat,
            shopName: "",
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
  console.log("🐻 Jalan Deep Activity Scraper\n");

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

  for (const { url, city, category } of JALAN_GENRE_URLS) {
    console.log(`  ${city} [${category}]: ${url.slice(0, 70)}...`);
    const items = await scrapeActivityList(page, url, city, category);
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

  console.log(`\n✅ Total unique: ${allItems.length}`);
  const withImages = allItems.filter(i => i.image);
  console.log(`  With images: ${withImages.length}`);
  const withPrices = allItems.filter(i => i.priceNum > 0);
  console.log(`  With prices: ${withPrices.length}`);

  // Print by city
  const byCities: Record<string, number> = {};
  allItems.forEach(i => { byCities[i.city] = (byCities[i.city] || 0) + 1; });
  console.log("\n  By city:");
  Object.entries(byCities).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`    ${k}: ${v}`));

  if (allItems.length > 0) {
    const outputPath = join(process.cwd(), "data", "jalan-deep.json");
    writeFileSync(outputPath, JSON.stringify(allItems, null, 2));
    console.log(`\n💾 Saved to ${outputPath}`);
  }
}

main().catch(console.error);
