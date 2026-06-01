/**
 * GoWithGuide scraper - Private tour guides in Japan
 * Site uses client-side rendering, need to wait for JS to load
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync } from "fs";
import { join } from "path";
import type { Page } from "puppeteer";

puppeteer.use(StealthPlugin());

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function scrapePage(page: Page, url: string, city: string): Promise<any[]> {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await delay(5000); // Wait for CSR

    for (let i = 0; i < 15; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await delay(500);
    }
    await delay(2000);

    return await page.evaluate((c: string) => {
      const results: any[] = [];
      const seen = new Set<string>();

      // Try all possible card selectors
      const allElements = document.querySelectorAll("a[href]");
      allElements.forEach(link => {
        const href = link.getAttribute("href") || "";
        if (!href.includes("tour") && !href.includes("guide")) return;
        if (seen.has(href)) return;

        const card = link.closest("div, li, article") || link;
        const img = card.querySelector("img");
        if (!img) return;

        const imgSrc = img.getAttribute("src") || img.getAttribute("data-src") || "";
        if (!imgSrc || imgSrc.includes("avatar") || imgSrc.includes("logo") || imgSrc.includes("flag") || imgSrc.length < 30) return;

        let title = card.querySelector("h2, h3, h4, [class*='title'], [class*='name']")?.textContent?.trim() || "";
        if (!title) title = img.getAttribute("alt") || "";
        if (!title || title.length < 5 || title.length > 200) return;

        const allText = card.textContent || "";
        const priceMatch = allText.match(/\$\s*(\d+)/);
        const ratingMatch = allText.match(/(\d\.\d)/);
        const reviewMatch = allText.match(/(\d+)\s*review/i);

        seen.add(href);
        results.push({
          title, city: c, platform: "gowithguide",
          url: href.startsWith("http") ? href : `https://www.gowithguide.com${href}`,
          image: imgSrc.startsWith("http") ? imgSrc : `https://www.gowithguide.com${imgSrc}`,
          priceNum: priceMatch ? parseInt(priceMatch[1]) : 0,
          price: priceMatch ? `$${priceMatch[1]}` : "",
          rating: ratingMatch ? ratingMatch[1] : "",
          reviewCount: reviewMatch ? reviewMatch[1] : "",
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
  console.log("🐻 GoWithGuide Scraper\n");
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 900 });

  const all: any[] = [];
  const urls = [
    { url: "https://www.gowithguide.com/japan/tokyo", city: "Tokyo" },
    { url: "https://www.gowithguide.com/japan/tokyo-tours", city: "Tokyo" },
    { url: "https://www.gowithguide.com/japan/kyoto", city: "Kyoto" },
    { url: "https://www.gowithguide.com/japan/kyoto-tours", city: "Kyoto" },
    { url: "https://www.gowithguide.com/japan/osaka", city: "Osaka" },
    { url: "https://www.gowithguide.com/japan/osaka-tours", city: "Osaka" },
    { url: "https://www.gowithguide.com/japan/hiroshima", city: "Hiroshima" },
    { url: "https://www.gowithguide.com/japan/nara", city: "Nara" },
  ];

  const seen = new Set<string>();
  for (const { url, city } of urls) {
    console.log(`  ${city}: ${url}`);
    const items = await scrapePage(page, url, city);
    const newItems = items.filter(i => !seen.has(i.url));
    newItems.forEach(i => seen.add(i.url));
    all.push(...newItems);
    console.log(`    Found: ${newItems.length} new`);
    await delay(3000);
  }

  await browser.close();
  console.log(`\n✅ Total: ${all.length}`);
  if (all.length > 0) {
    writeFileSync(join(process.cwd(), "data", "gowithguide-raw.json"), JSON.stringify(all, null, 2));
    console.log("💾 Saved");
  }
}
main().catch(console.error);
