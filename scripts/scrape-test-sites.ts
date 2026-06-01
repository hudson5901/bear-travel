/**
 * Test scraping feasibility of multiple Japanese activity/tourism sites
 * Tests each site to see if we can access it without getting blocked
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync } from "fs";
import { join } from "path";
import type { Page } from "puppeteer";

puppeteer.use(StealthPlugin());

interface SiteTest {
  name: string;
  url: string;
  status: "success" | "blocked" | "error" | "no_data";
  itemCount: number;
  hasImages: boolean;
  hasPrices: boolean;
  notes: string;
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function testSite(page: Page, name: string, url: string): Promise<SiteTest> {
  const result: SiteTest = {
    name, url,
    status: "error",
    itemCount: 0,
    hasImages: false,
    hasPrices: false,
    notes: "",
  };

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await delay(3000);

    const title = await page.title();
    const content = await page.content();

    // Check for blocks
    if (content.includes("cf-challenge") || content.includes("Just a moment") || content.includes("captcha") || content.includes("Human Verification")) {
      result.status = "blocked";
      result.notes = `Blocked (title: "${title.slice(0, 30)}")`;
      return result;
    }

    if (content.includes("404") || content.includes("Not Found") || title.includes("エラー") || title.includes("見つかりません")) {
      result.status = "error";
      result.notes = `404/Error (title: "${title.slice(0, 30)}")`;
      return result;
    }

    // Scroll to load content
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await delay(300);
    }

    // Count images and links
    const stats = await page.evaluate(() => {
      const imgs = document.querySelectorAll("img[src*='http']");
      const links = document.querySelectorAll("a[href]");
      const priceTexts = document.body.textContent?.match(/(\d{1,3}(?:,\d{3})*)\s*円/g) || [];
      const dollarPrices = document.body.textContent?.match(/\$\d+/g) || [];

      // Count "activity-like" cards
      const cards = document.querySelectorAll(
        'article, [class*="card"], [class*="item"], [class*="product"], [class*="plan"], [class*="tour"]'
      );

      // Find links that look like activity/tour pages
      const activityLinks = Array.from(links).filter(l => {
        const href = l.getAttribute("href") || "";
        return href.includes("plan") || href.includes("tour") || href.includes("activity") ||
               href.includes("experience") || href.includes("product") || href.includes("item");
      });

      return {
        totalImages: imgs.length,
        totalLinks: links.length,
        priceCount: priceTexts.length + dollarPrices.length,
        cardCount: cards.length,
        activityLinks: activityLinks.length,
        bodyLength: document.body.textContent?.length || 0,
      };
    });

    result.itemCount = Math.max(stats.cardCount, stats.activityLinks);
    result.hasImages = stats.totalImages > 5;
    result.hasPrices = stats.priceCount > 0;
    result.status = result.itemCount > 0 ? "success" : "no_data";
    result.notes = `title:"${title.slice(0, 40)}" imgs:${stats.totalImages} cards:${stats.cardCount} links:${stats.activityLinks} prices:${stats.priceCount}`;

  } catch (err) {
    result.status = "error";
    result.notes = (err as Error).message?.slice(0, 80) || "Unknown error";
  }

  return result;
}

async function main() {
  console.log("🐻 Multi-site feasibility test\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "ja,en-US;q=0.9" });

  // Override webdriver
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const sites = [
    // 体験予約系
    { name: "TABICA (旅カ)", url: "https://tabica.jp/travels?area=tokyo" },
    { name: "Voyagin (楽天)", url: "https://www.govoyagin.com/ja/activities/japan-tokyo" },
    { name: "Airbnb Experiences", url: "https://www.airbnb.com/s/Tokyo/experiences" },
    { name: "Nutmeg", url: "https://nutmegg.jp/tokyo" },
    { name: "VELTRA", url: "https://www.veltra.com/jp/japan/tokyo/" },
    { name: "HIS Activity", url: "https://activities.his-j.com/TourList/TourList.aspx?area=tokyo" },
    { name: "JTB Experience", url: "https://www.jtb.co.jp/kokunai-kankou/tokyo/" },

    // 観光情報サイト
    { name: "Japan Travel (JNTO)", url: "https://www.japan.travel/en/things-to-do/tokyo/" },
    { name: "Time Out Tokyo", url: "https://www.timeout.jp/tokyo/ja/things-to-do" },
    { name: "Tokyo Cheapo", url: "https://tokyocheapo.com/entertainment/things-to-do/" },
    { name: "Japan Guide", url: "https://www.japan-guide.com/e/e2164.html" },
    { name: "LIVE JAPAN", url: "https://livejapan.com/ja/in-tokyo/article-a0001165/" },
    { name: "MATCHA", url: "https://matcha-jp.com/jp/area/tokyo" },
    { name: "DiGJAPAN!", url: "https://digjapan.travel/en/spot/id=12288" },

    // ニッチ体験
    { name: "Cookly (cooking)", url: "https://www.cookly.me/cooking-class/tokyo/" },
    { name: "Wabunka (culture)", url: "https://wabunka.com/experiences/" },
    { name: "Magical Trip", url: "https://www.magical-trip.com/spot/tokyo" },
    { name: "Tokyo Localized", url: "https://tokyolocalized.com/" },
    { name: "Ninja Food Tours", url: "https://ninjafoodtours.com/tokyo-tours/" },

    // 地域観光
    { name: "GO TOKYO", url: "https://www.gotokyo.org/jp/things-to-do/index.html" },
    { name: "Osaka Info", url: "https://osaka-info.jp/spot/" },
    { name: "Kyoto Travel", url: "https://kyoto.travel/en/experience" },

    // レジャー予約
    { name: "Leisure Guide", url: "https://www.leisure-guide.jp/tokyo/" },
    { name: "SOTOASOBI", url: "https://sotoasobi.net/activity/tokyo" },
    { name: "AssoBit", url: "https://www.assobit.com/tokyo/" },
  ];

  const results: SiteTest[] = [];

  for (const site of sites) {
    process.stdout.write(`  ${site.name.padEnd(25)}... `);
    const result = await testSite(page, site.name, site.url);
    const emoji = result.status === "success" ? "✅" : result.status === "blocked" ? "❌" : result.status === "no_data" ? "⚠️" : "💀";
    console.log(`${emoji} ${result.status} | ${result.notes.slice(0, 60)}`);
    results.push(result);
    await delay(2000 + Math.random() * 2000);
  }

  await browser.close();

  // Summary
  console.log("\n\n📊 Summary:");
  console.log("═══════════════════════════════════════════════════");

  const successful = results.filter(r => r.status === "success");
  const blocked = results.filter(r => r.status === "blocked");
  const noData = results.filter(r => r.status === "no_data");
  const errors = results.filter(r => r.status === "error");

  console.log(`\n✅ ACCESSIBLE (${successful.length}):`);
  successful.forEach(r => console.log(`  ${r.name}: ${r.itemCount} items, images:${r.hasImages}, prices:${r.hasPrices}`));

  console.log(`\n❌ BLOCKED (${blocked.length}):`);
  blocked.forEach(r => console.log(`  ${r.name}`));

  console.log(`\n⚠️ NO DATA (${noData.length}):`);
  noData.forEach(r => console.log(`  ${r.name}: ${r.notes.slice(0, 50)}`));

  console.log(`\n💀 ERROR (${errors.length}):`);
  errors.forEach(r => console.log(`  ${r.name}: ${r.notes.slice(0, 50)}`));

  // Save results
  writeFileSync(join(process.cwd(), "data", "site-test-results.json"), JSON.stringify(results, null, 2));
}

main().catch(console.error);
