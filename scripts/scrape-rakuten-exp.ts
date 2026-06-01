/**
 * Rakuten Travel Experience Scraper
 * Rakuten is a major Japanese platform - their experience/activity section
 * may be accessible since they're not using Cloudflare as aggressively
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync } from "fs";
import { join } from "path";
import type { Page } from "puppeteer";

puppeteer.use(StealthPlugin());

// Rakuten Travel experience URLs
const URLS = [
  // 楽天トラベル 観光体験
  { url: "https://experience.travel.rakuten.co.jp/experiences?area=tokyo", city: "Tokyo" },
  { url: "https://experience.travel.rakuten.co.jp/experiences?area=kyoto", city: "Kyoto" },
  { url: "https://experience.travel.rakuten.co.jp/experiences?area=osaka", city: "Osaka" },
  // Alternative URLs
  { url: "https://experience.travel.rakuten.co.jp/search?keyword=東京+体験", city: "Tokyo" },
  { url: "https://experience.travel.rakuten.co.jp/search?keyword=京都+体験", city: "Kyoto" },
  // Rakuten travel activity
  { url: "https://travel.rakuten.co.jp/leisure/tokyo/", city: "Tokyo" },
  { url: "https://travel.rakuten.co.jp/leisure/kyoto/", city: "Kyoto" },
];

interface ScrapedItem {
  title: string;
  url: string;
  image: string;
  price: string;
  city: string;
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("🐻 Rakuten Travel Experience Scraper\n");

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

  for (const { url, city } of URLS) {
    try {
      console.log(`  ${city}: ${url.slice(0, 70)}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await delay(3000);

      const title = await page.title();
      const content = await page.content();
      const blocked = content.includes("cf-challenge") || content.includes("Just a moment") || content.includes("captcha");
      console.log(`    Title: "${title.slice(0, 50)}" ${blocked ? "❌" : "✓"}`);

      if (!blocked) {
        // Scroll
        for (let i = 0; i < 8; i++) {
          await page.evaluate(() => window.scrollBy(0, 600));
          await delay(300);
        }

        const items = await page.evaluate((c: string) => {
          const results: ScrapedItem[] = [];
          const cards = document.querySelectorAll('a[href*="experience"], [class*="card"], [class*="item"], article');
          cards.forEach((card) => {
            const link = card.closest("a") || card.querySelector("a[href]");
            const img = card.querySelector("img");
            if (!link || !img) return;

            const href = link.getAttribute("href") || "";
            const imgSrc = img.getAttribute("src") || img.getAttribute("data-src") || "";
            const titleText = img.getAttribute("alt") || card.querySelector("h2,h3,h4,[class*='title']")?.textContent?.trim() || "";

            if (titleText.length > 3 && imgSrc && href) {
              const allText = card.textContent || "";
              const priceMatch = allText.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
              results.push({
                title: titleText,
                url: href.startsWith("http") ? href : `https://experience.travel.rakuten.co.jp${href}`,
                image: imgSrc.startsWith("http") ? imgSrc : "",
                price: priceMatch ? priceMatch[0] : "",
                city: c,
              });
            }
          });
          return results;
        }, city);

        console.log(`    Found ${items.length} items`);
        for (const item of items) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            allItems.push(item);
          }
        }
      }
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 60)}`);
    }
    await delay(2000);
  }

  await browser.close();

  console.log(`\n✅ Total: ${allItems.length} unique items`);
  if (allItems.length > 0) {
    const outputPath = join(process.cwd(), "data", "rakuten-raw.json");
    writeFileSync(outputPath, JSON.stringify(allItems, null, 2));
    console.log(`💾 Saved to ${outputPath}`);
  }
}

main().catch(console.error);
