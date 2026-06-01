/**
 * Otonami scraper - Premium Japanese cultural experiences
 * Need to get actual experience titles from detail page links
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync } from "fs";
import { join } from "path";
import type { Page } from "puppeteer";

puppeteer.use(StealthPlugin());

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function scrapeListPage(page: Page): Promise<any[]> {
  const results: any[] = [];
  const seen = new Set<string>();

  // Keep scrolling and clicking "load more" to get all items
  for (let round = 0; round < 5; round++) {
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await delay(300);
    }
    // Try to click load more
    try {
      const btn = await page.$('button[class*="more"], [class*="loadMore"], [class*="load-more"]');
      if (btn) { await btn.click(); await delay(2000); }
    } catch {}
  }

  const items = await page.evaluate(() => {
    const found: any[] = [];
    const seen = new Set<string>();

    // Get all experience links
    const links = document.querySelectorAll('a[href*="/experiences/"]');
    links.forEach(link => {
      const href = link.getAttribute("href") || "";
      if (href === "/experiences/" || href === "/experiences" || seen.has(href)) return;
      if (!href.includes("/experiences/")) return;
      seen.add(href);

      // Walk up to find the card
      let card = link.closest("article, [class*='card'], [class*='item'], li") || link;

      const img = card.querySelector("img");
      const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
      if (!imgSrc) return;

      // Get title from heading or image alt
      let title = "";
      const h = card.querySelector("h2, h3, h4, [class*='title']");
      if (h) title = h.textContent?.trim() || "";
      if (!title || title.length < 3) title = img?.getAttribute("alt") || "";

      // Get area info
      const areaEl = card.querySelector("[class*='area'], [class*='location'], small, span");
      const area = areaEl?.textContent?.trim() || "";

      // Price
      const allText = card.textContent || "";
      const priceMatch = allText.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
      const priceNum = priceMatch ? parseInt(priceMatch[1].replace(/,/g, "")) : 0;

      found.push({
        title: title.slice(0, 200),
        url: href.startsWith("http") ? href : `https://otonami.jp${href}`,
        image: imgSrc.startsWith("http") ? imgSrc : `https://otonami.jp${imgSrc}`,
        area,
        priceNum,
        price: priceNum > 0 ? `${priceNum.toLocaleString()}円` : "",
      });
    });

    return found;
  });

  return items;
}

async function scrapeDetailPage(page: Page, url: string): Promise<{ title: string; description: string; price: number; city: string }> {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
    await delay(2000);

    return await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      const title = h1?.textContent?.trim() || "";

      const desc = document.querySelector("meta[name='description']")?.getAttribute("content") || "";

      const allText = document.body.textContent || "";
      const priceMatch = allText.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
      const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, "")) : 0;

      // Detect city from breadcrumbs or content
      let city = "Tokyo";
      if (allText.includes("京都")) city = "Kyoto";
      else if (allText.includes("大阪")) city = "Osaka";
      else if (allText.includes("奈良")) city = "Nara";
      else if (allText.includes("広島")) city = "Hiroshima";

      return { title, description: desc.slice(0, 200), price, city };
    });
  } catch {
    return { title: "", description: "", price: 0, city: "Tokyo" };
  }
}

async function main() {
  console.log("🐻 Otonami Scraper - Premium experiences\n");
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "ja,en-US;q=0.9" });

  // Get listing
  console.log("  Loading experience list...");
  await page.goto("https://otonami.jp/experiences/", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(3000);

  const listItems = await scrapeListPage(page);
  console.log(`  Found ${listItems.length} experience links`);

  // Visit each detail page to get proper title
  const allItems: any[] = [];
  let count = 0;
  for (const item of listItems.slice(0, 80)) { // Limit to 80 to be polite
    count++;
    process.stdout.write(`  [${count}/${Math.min(listItems.length, 80)}] ${item.url.split("/").slice(-2)[0]}... `);

    const detail = await scrapeDetailPage(page, item.url);
    if (detail.title && detail.title.length > 3) {
      allItems.push({
        title: detail.title,
        description: detail.description,
        url: item.url,
        image: item.image,
        priceNum: detail.price > 0 ? Math.round(detail.price / 155) : (item.priceNum > 0 ? Math.round(item.priceNum / 155) : 30),
        price: detail.price > 0 ? `$${Math.round(detail.price / 155)}` : "",
        city: detail.city,
        platform: "otonami",
        rating: "",
        reviewCount: "",
      });
      console.log(`✓ ${detail.title.slice(0, 30)}`);
    } else {
      console.log(`✗ no title`);
    }
    await delay(1500 + Math.random() * 1000);
  }

  await browser.close();
  console.log(`\n✅ Total: ${allItems.length} with titles`);

  if (allItems.length > 0) {
    writeFileSync(join(process.cwd(), "data", "otonami-raw.json"), JSON.stringify(allItems, null, 2));
    console.log("💾 Saved to data/otonami-raw.json");
  }
}
main().catch(console.error);
