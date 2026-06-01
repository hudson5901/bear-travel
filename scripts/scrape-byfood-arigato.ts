/**
 * byFood + Arigato Travel + Japan Wonder Travel scraper
 * Food/cultural tour specialized platforms
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync } from "fs";
import { join } from "path";
import type { Page, Browser } from "puppeteer";

puppeteer.use(StealthPlugin());

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function scrapeGenericTourPage(page: Page, url: string, city: string, platform: string): Promise<any[]> {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
    await delay(3000);

    const content = await page.content();
    if (content.includes("cf-challenge") || content.includes("Just a moment")) {
      console.log("    ❌ Blocked");
      return [];
    }

    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await delay(400);
    }

    return await page.evaluate((c: string, p: string) => {
      const results: any[] = [];
      const seen = new Set<string>();

      const links = document.querySelectorAll("a[href]");
      links.forEach(link => {
        const href = link.getAttribute("href") || "";
        if (seen.has(href)) return;

        const card = link.closest("article, [class*='card'], [class*='item'], [class*='product'], li, div") || link;
        const img = card.querySelector("img");
        if (!img) return;

        const imgSrc = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || "";
        if (!imgSrc || imgSrc.includes("logo") || imgSrc.includes("icon") || imgSrc.includes("avatar") || imgSrc.length < 30) return;

        let title = card.querySelector("h2, h3, h4, [class*='title'], [class*='name']")?.textContent?.trim() || "";
        if (!title) title = img.getAttribute("alt") || "";
        if (!title || title.length < 5 || title.length > 200) return;

        // Skip navigation/footer links
        if (title.includes("Home") || title.includes("About") || title.includes("Contact") || title.includes("Blog")) return;

        const allText = card.textContent || "";
        const priceMatch = allText.match(/\$\s*(\d+)/) || allText.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
        let priceNum = 0;
        if (priceMatch) {
          priceNum = parseInt(priceMatch[1].replace(/,/g, ""));
          if (allText.includes("円")) priceNum = Math.round(priceNum / 155);
        }

        const ratingMatch = allText.match(/(\d\.\d)/);
        const reviewMatch = allText.match(/(\d+)\s*review/i);

        seen.add(href);
        results.push({
          title: title.slice(0, 200),
          url: href.startsWith("http") ? href : "",
          image: imgSrc.startsWith("http") ? imgSrc : "",
          priceNum, price: priceNum > 0 ? `$${priceNum}` : "",
          city: c, platform: p,
          rating: ratingMatch ? ratingMatch[1] : "",
          reviewCount: reviewMatch ? reviewMatch[1] : "",
        });
      });
      return results.filter(r => r.url && r.image);
    }, city, platform);
  } catch (err) {
    console.log(`    Error: ${(err as Error).message?.slice(0, 60)}`);
    return [];
  }
}

async function main() {
  console.log("🐻 Food & Culture Tour Scrapers\n");
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 900 });

  const all: any[] = [];
  const seen = new Set<string>();

  const sites = [
    // byFood
    { url: "https://www.byfood.com/food-experiences/japan/tokyo", city: "Tokyo", platform: "byfood" },
    { url: "https://www.byfood.com/food-experiences/japan/kyoto", city: "Kyoto", platform: "byfood" },
    { url: "https://www.byfood.com/food-experiences/japan/osaka", city: "Osaka", platform: "byfood" },
    // Arigato Travel
    { url: "https://arigatotravel.com/tokyo/", city: "Tokyo", platform: "arigato" },
    { url: "https://arigatotravel.com/kyoto/", city: "Kyoto", platform: "arigato" },
    { url: "https://arigatotravel.com/osaka/", city: "Osaka", platform: "arigato" },
    // Japan Wonder Travel
    { url: "https://japanwondertravel.com/collections/tokyo", city: "Tokyo", platform: "japanwondertravel" },
    { url: "https://japanwondertravel.com/collections/kyoto", city: "Kyoto", platform: "japanwondertravel" },
    // MagicalTrip
    { url: "https://www.magical-trip.com/spot/tokyo/tours", city: "Tokyo", platform: "magicaltrip" },
    { url: "https://www.magical-trip.com/spot/kyoto/tours", city: "Kyoto", platform: "magicaltrip" },
    { url: "https://www.magical-trip.com/spot/osaka/tours", city: "Osaka", platform: "magicaltrip" },
    // airKitchen
    { url: "https://airkitchen.me/list/tokyo.php", city: "Tokyo", platform: "airkitchen" },
    { url: "https://airkitchen.me/list/kyoto.php", city: "Kyoto", platform: "airkitchen" },
    { url: "https://airkitchen.me/list/osaka.php", city: "Osaka", platform: "airkitchen" },
  ];

  for (const { url, city, platform } of sites) {
    console.log(`  [${platform}] ${city}: ${url.slice(0, 60)}`);
    const items = await scrapeGenericTourPage(page, url, city, platform);
    const newItems = items.filter(i => !seen.has(i.url));
    newItems.forEach(i => seen.add(i.url));
    all.push(...newItems);
    console.log(`    Found: ${newItems.length} new`);
    await delay(2500 + Math.random() * 2000);
  }

  await browser.close();

  // Stats
  const byPlatform: Record<string, number> = {};
  all.forEach(i => { byPlatform[i.platform] = (byPlatform[i.platform] || 0) + 1; });
  console.log(`\n✅ Total: ${all.length}`);
  console.log("By platform:");
  Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  if (all.length > 0) {
    writeFileSync(join(process.cwd(), "data", "food-culture-raw.json"), JSON.stringify(all, null, 2));
    console.log("💾 Saved");
  }
}
main().catch(console.error);
