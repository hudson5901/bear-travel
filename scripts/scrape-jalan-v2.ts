/**
 * Jalan Scraper V2 - properly handles lazy loading images
 * Scrolls fully to trigger IntersectionObserver loading
 * Also extracts more category pages
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync } from "fs";
import { join } from "path";
import type { Page } from "puppeteer";

puppeteer.use(StealthPlugin());

// All genre codes for Tokyo (130000), Kyoto (260000), Osaka (270000)
const GENRES = [
  // ものづくり系
  { code: "g2_14", name: "陶芸" },
  { code: "g2_45", name: "ガラス工芸" },
  { code: "g2_901", name: "アクセサリー" },
  { code: "g2_3g112", name: "シルバーアクセ" },
  { code: "g2_S0", name: "そば打ち" },
  { code: "g2_e9", name: "料理体験" },
  // レジャー系
  { code: "g2_77", name: "ビュッフェ" },
  { code: "g2_85", name: "スイーツ" },
  // 文化体験
  { code: "g2_11", name: "着物レンタル" },
  { code: "g2_6M", name: "人力車" },
  { code: "g2_6f", name: "茶道" },
  // アウトドア
  { code: "g2_3c", name: "SUP" },
  { code: "g2_37", name: "カヌー" },
];

const AREAS = [
  { code: "130000", city: "Tokyo" },
  { code: "260000", city: "Kyoto" },
  { code: "270000", city: "Osaka" },
  { code: "340000", city: "Hiroshima" },
  { code: "290000", city: "Nara" },
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

async function scrapeJalanPage(page: Page, url: string, city: string, category: string): Promise<ScrapedItem[]> {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await delay(1500);

    const title = await page.title();
    if (title.includes("エラー") || title.includes("存在しません")) {
      return [];
    }

    // Aggressive scrolling to trigger lazy loading
    const totalHeight = await page.evaluate(() => document.body.scrollHeight);
    let scrolled = 0;
    while (scrolled < totalHeight) {
      await page.evaluate((y) => window.scrollTo(0, y), scrolled);
      await delay(300);
      scrolled += 400;
    }
    // Scroll back up and down again
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(500);
    scrolled = 0;
    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    while (scrolled < newHeight) {
      await page.evaluate((y) => window.scrollTo(0, y), scrolled);
      await delay(200);
      scrolled += 600;
    }
    await delay(1000);

    // Force load all lazy images
    await page.evaluate(() => {
      const imgs = document.querySelectorAll("img[data-src], img[data-original], img[data-lazy-src]");
      imgs.forEach((img) => {
        const dataSrc = img.getAttribute("data-src") || img.getAttribute("data-original") || img.getAttribute("data-lazy-src");
        if (dataSrc) {
          (img as HTMLImageElement).src = dataSrc;
        }
      });
    });
    await delay(500);

    const items = await page.evaluate((c: string, cat: string) => {
      const results: ScrapedItem[] = [];
      const seen = new Set<string>();

      // Find all activity listing items
      const allLinks = document.querySelectorAll('a[href*="kankou/spt_"], a[href*="activity/l"], a[href*="activity_plan"]');

      allLinks.forEach((link) => {
        const href = link.getAttribute("href") || "";
        if (seen.has(href) || !href) return;

        // Walk up to card container
        let container = link.closest("li, article, .cassette, [class*='item'], [class*='card']");
        if (!container) container = link.parentElement?.parentElement || link.parentElement;
        if (!container) return;

        // Find image - check multiple sources
        const imgs = container.querySelectorAll("img");
        let imgSrc = "";
        for (const img of Array.from(imgs)) {
          const src = img.getAttribute("src") || "";
          const dataSrc = img.getAttribute("data-src") || img.getAttribute("data-original") || "";
          const candidate = dataSrc || src;
          if (candidate && !candidate.includes("spacer") && !candidate.includes("blank") && !candidate.includes("dummy") && !candidate.includes("lazyload") && !candidate.includes("icon") && !candidate.includes("logo") && candidate.length > 20) {
            imgSrc = candidate;
            break;
          }
        }

        if (!imgSrc) return;

        // Get title
        let titleText = "";
        const h = container.querySelector("h2, h3, h4, [class*='title'], [class*='name'] a, strong");
        if (h) titleText = h.textContent?.trim() || "";
        if (!titleText) {
          // Try alt text from image
          const img = container.querySelector("img[alt]");
          if (img) titleText = img.getAttribute("alt") || "";
        }
        if (!titleText) titleText = link.textContent?.trim().split("\n")[0]?.trim() || "";
        if (!titleText || titleText.length < 5 || titleText.length > 200) return;

        // Shop name
        let shopName = "";
        const shopEl = container.querySelector("[class*='shop'], [class*='provider'], [class*='store']");
        if (shopEl) shopName = shopEl.textContent?.trim() || "";

        // Price
        const allText = container.textContent || "";
        const priceMatches = allText.match(/(\d{1,3}(?:,\d{3})*)\s*円/g);
        let priceNum = 0;
        let price = "";
        if (priceMatches) {
          const prices = priceMatches.map(p => {
            const m = p.match(/(\d{1,3}(?:,\d{3})*)/);
            return m ? parseInt(m[1].replace(/,/g, "")) : 0;
          }).filter(p => p > 100 && p < 500000);
          if (prices.length > 0) {
            priceNum = Math.min(...prices);
            price = `${priceNum.toLocaleString()}円`;
          }
        }

        // Rating & reviews
        const ratingMatch = allText.match(/(\d\.\d)/);
        const rating = ratingMatch ? ratingMatch[1] : "";
        const reviewMatch = allText.match(/(\d+)\s*件/);
        const reviewCount = reviewMatch ? reviewMatch[1] : "";

        seen.add(href);
        results.push({
          title: titleText.replace(/\s+/g, " ").trim(),
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

      return results;
    }, city, category);

    return items;
  } catch (err) {
    return [];
  }
}

async function main() {
  console.log("🐻 Jalan Scraper V2 - with lazy image loading\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "ja,en-US;q=0.9" });

  const allItems: ScrapedItem[] = [];
  const seenUrls = new Set<string>();

  for (const area of AREAS) {
    console.log(`\n📍 ${area.city}`);
    for (const genre of GENRES) {
      const url = `https://www.jalan.net/activity/${area.code}/${genre.code}/?screenId=OUW1601&dateUndecided=1&asobiKbn=1`;
      process.stdout.write(`  ${genre.name}... `);

      const items = await scrapeJalanPage(page, url, area.city, genre.name);
      const newItems = items.filter(i => !seenUrls.has(i.url));
      newItems.forEach(i => seenUrls.add(i.url));
      allItems.push(...newItems);

      process.stdout.write(`${newItems.length} new\n`);
      await delay(1500 + Math.random() * 1500);
    }
  }

  await browser.close();

  console.log(`\n\n✅ Total unique: ${allItems.length}`);
  const withGoodImages = allItems.filter(i => i.image && !i.image.includes("dummy") && !i.image.includes("lazyload"));
  console.log(`  With real images: ${withGoodImages.length}`);
  const withPrices = allItems.filter(i => i.priceNum > 0);
  console.log(`  With prices: ${withPrices.length}`);

  const byCities: Record<string, number> = {};
  allItems.forEach(i => { byCities[i.city] = (byCities[i.city] || 0) + 1; });
  console.log("\n  By city:");
  Object.entries(byCities).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`    ${k}: ${v}`));

  if (allItems.length > 0) {
    const outputPath = join(process.cwd(), "data", "jalan-v2.json");
    writeFileSync(outputPath, JSON.stringify(allItems, null, 2));
    console.log(`\n💾 Saved to ${outputPath}`);
  }
}

main().catch(console.error);
