/**
 * Travelko (トラベルコ) activity scraper
 * Japanese activity comparison/aggregator site
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync } from "fs";
import { join } from "path";
import type { Page } from "puppeteer";

puppeteer.use(StealthPlugin());

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

const URLS = [
  { url: "https://www.tour.ne.jp/j_optional/list/?area=010100", city: "Tokyo" },       // 東京
  { url: "https://www.tour.ne.jp/j_optional/list/?area=010100&page=2", city: "Tokyo" },
  { url: "https://www.tour.ne.jp/j_optional/list/?area=010100&page=3", city: "Tokyo" },
  { url: "https://www.tour.ne.jp/j_optional/list/?area=010600", city: "Kyoto" },       // 京都
  { url: "https://www.tour.ne.jp/j_optional/list/?area=010600&page=2", city: "Kyoto" },
  { url: "https://www.tour.ne.jp/j_optional/list/?area=010500", city: "Osaka" },       // 大阪
  { url: "https://www.tour.ne.jp/j_optional/list/?area=010500&page=2", city: "Osaka" },
  { url: "https://www.tour.ne.jp/j_optional/list/?area=010800", city: "Hiroshima" },   // 広島
  { url: "https://www.tour.ne.jp/j_optional/list/?area=010600&sub=050300", city: "Nara" }, // 奈良
];

async function scrapePage(page: Page, url: string, city: string): Promise<any[]> {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
    await delay(2000);

    const title = await page.title();
    if (title.includes("エラー") || title.includes("見つかりません")) return [];

    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await delay(300);
    }

    return await page.evaluate((c: string) => {
      const results: any[] = [];
      const seen = new Set<string>();

      // Travelko uses list items with images
      const cards = document.querySelectorAll('[class*="item"], [class*="card"], [class*="list"] li, article, [class*="result"]');
      cards.forEach(card => {
        const link = card.querySelector('a[href*="optional"], a[href*="tour"], a[href*="detail"]');
        if (!link) return;
        const href = link.getAttribute("href") || "";
        if (seen.has(href) || !href) return;

        const img = card.querySelector("img");
        const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
        if (!imgSrc || imgSrc.includes("logo") || imgSrc.includes("icon") || imgSrc.length < 20) return;

        let title = card.querySelector("h2, h3, h4, [class*='title'], [class*='name'], strong")?.textContent?.trim() || "";
        if (!title) title = img?.getAttribute("alt") || link.textContent?.trim().split("\n")[0]?.trim() || "";
        if (!title || title.length < 5) return;

        const allText = card.textContent || "";
        const priceMatch = allText.match(/(\d{1,3}(?:,\d{3})*)\s*円/g);
        let priceNum = 0;
        if (priceMatch) {
          const prices = priceMatch.map(p => parseInt((p.match(/(\d{1,3}(?:,\d{3})*)/) || ["0"])[0].replace(/,/g, ""))).filter(p => p > 0);
          if (prices.length > 0) priceNum = Math.min(...prices);
        }

        seen.add(href);
        results.push({
          title: title.replace(/\s+/g, " ").trim().slice(0, 200),
          url: href.startsWith("http") ? href : `https://www.tour.ne.jp${href}`,
          image: imgSrc.startsWith("http") ? imgSrc : `https://www.tour.ne.jp${imgSrc}`,
          priceNum: priceNum > 0 ? Math.round(priceNum / 155) : 0,
          price: priceNum > 0 ? `$${Math.round(priceNum / 155)}` : "",
          city: c,
          platform: "travelko",
          rating: "",
          reviewCount: "",
        });
      });
      return results;
    }, city);
  } catch (err) {
    console.log(`    Error: ${(err as Error).message?.slice(0, 60)}`);
    return [];
  }
}

async function main() {
  console.log("🐻 Travelko Activity Scraper\n");
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "ja,en-US;q=0.9" });

  const all: any[] = [];
  const seen = new Set<string>();

  for (const { url, city } of URLS) {
    console.log(`  ${city}: ${url.split("?")[1] || url}`);
    const items = await scrapePage(page, url, city);
    const newItems = items.filter(i => !seen.has(i.url));
    newItems.forEach(i => seen.add(i.url));
    all.push(...newItems);
    console.log(`    Found: ${newItems.length} new`);
    await delay(2000 + Math.random() * 2000);
  }

  await browser.close();
  console.log(`\n✅ Total: ${all.length}`);
  const withImages = all.filter(i => i.image);
  const withPrices = all.filter(i => i.priceNum > 0);
  console.log(`  With images: ${withImages.length}, With prices: ${withPrices.length}`);

  if (all.length > 0) {
    writeFileSync(join(process.cwd(), "data", "travelko-raw.json"), JSON.stringify(all, null, 2));
    console.log("💾 Saved to data/travelko-raw.json");
  }
}
main().catch(console.error);
