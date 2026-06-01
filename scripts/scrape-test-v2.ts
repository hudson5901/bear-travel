/**
 * Test v2 - Try the correct URLs for promising platforms
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync } from "fs";
import { join } from "path";
import type { Page } from "puppeteer";

puppeteer.use(StealthPlugin());

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface TestResult {
  name: string;
  url: string;
  status: string;
  title: string;
  items: number;
  images: number;
  prices: number;
}

async function testUrl(page: Page, name: string, url: string): Promise<TestResult> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await delay(3000);

    const title = await page.title();
    const content = await page.content();

    if (content.includes("cf-challenge") || content.includes("Just a moment") || content.includes("captcha") || content.includes("Human Verification")) {
      return { name, url, status: "BLOCKED", title: title.slice(0, 40), items: 0, images: 0, prices: 0 };
    }

    // Scroll
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await delay(300);
    }

    const stats = await page.evaluate(() => {
      const imgs = document.querySelectorAll("img[src*='http']");
      const goodImgs = Array.from(imgs).filter(i => {
        const src = i.getAttribute("src") || "";
        return !src.includes("logo") && !src.includes("icon") && !src.includes("avatar") && src.length > 30;
      });
      const body = document.body.textContent || "";
      const yenPrices = (body.match(/(\d{1,3}(?:,\d{3})*)\s*円/g) || []).length;
      const usdPrices = (body.match(/\$\d+/g) || []).length;

      // Count activity/tour links
      const links = document.querySelectorAll("a[href]");
      let activityLinks = 0;
      links.forEach(l => {
        const href = l.getAttribute("href") || "";
        if (href.includes("tour") || href.includes("plan") || href.includes("activity") ||
            href.includes("experience") || href.includes("product") || href.includes("class")) {
          activityLinks++;
        }
      });

      return {
        images: goodImgs.length,
        prices: yenPrices + usdPrices,
        activityLinks,
      };
    });

    const status = stats.activityLinks > 5 && stats.images > 3 ? "SUCCESS" : stats.activityLinks > 0 ? "PARTIAL" : "NO_DATA";
    return { name, url, status, title: title.slice(0, 40), items: stats.activityLinks, images: stats.images, prices: stats.prices };
  } catch (err) {
    return { name, url, status: "ERROR", title: (err as Error).message?.slice(0, 40), items: 0, images: 0, prices: 0 };
  }
}

async function main() {
  console.log("🐻 Site feasibility test v2 - correct URLs\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "ja,en-US;q=0.9" });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const sites = [
    // Major Japanese platforms - correct URLs
    { name: "VELTRA Tokyo", url: "https://www.veltra.com/jp/japan/tokyo/ctg/167/" },
    { name: "VELTRA Tokyo EN", url: "https://www.veltra.com/en/asia/japan/tokyo/" },
    { name: "HIS Activity Tokyo", url: "https://activities.his-j.com/jp/city/TYO/" },
    { name: "byFood Tokyo", url: "https://www.byfood.com/food-experiences/japan/tokyo" },
    { name: "airKitchen Tokyo", url: "https://airkitchen.me/list/tokyo.php" },
    { name: "GoWithGuide Tokyo", url: "https://www.gowithguide.com/japan/tokyo" },
    { name: "Otonami Tokyo", url: "https://otonami.jp/experiences/?area=tokyo" },
    { name: "Rakuten Experiences", url: "https://experiences.travel.rakuten.com/tokyo" },
    { name: "Japan Guide Tokyo", url: "https://www.japan-guide.com/e/e2164.html" },
    { name: "LIVE JAPAN Tokyo", url: "https://livejapan.com/ja/in-tokyo/article-a0002395/" },
    { name: "MATCHA Tokyo", url: "https://matcha-jp.com/jp/list?pref=tokyo&categories=experience" },
    { name: "DeepExperience", url: "https://www.deep-exp.com/en/tokyo" },
    { name: "Travelko Activities", url: "https://www.tour.ne.jp/j_optional/list/?area=010100" },
    { name: "Tabirai Activities", url: "https://www.tabirai.net/activity/tokyo/" },
    { name: "JAPANiCAN Experience", url: "https://www.japanican.com/en/tour/list/?typecd=TPA&kession=tokyo" },
    { name: "Japan Wonder Travel", url: "https://japanwondertravel.com/collections/tokyo" },
    { name: "Arigato Travel", url: "https://arigatotravel.com/tokyo/" },
    { name: "MagicalTrip Tokyo", url: "https://www.magical-trip.com/spot/tokyo/tours" },
    { name: "Huber Japan", url: "https://huber-japan.com/" },
    { name: "JNTO Activities", url: "https://www.japan.travel/en/things-to-do/" },
  ];

  const results: TestResult[] = [];

  for (const site of sites) {
    process.stdout.write(`  ${site.name.padEnd(25)} `);
    const result = await testUrl(page, site.name, site.url);
    const emoji = result.status === "SUCCESS" ? "✅" : result.status === "PARTIAL" ? "🟡" : result.status === "BLOCKED" ? "❌" : "💀";
    console.log(`${emoji} ${result.status.padEnd(8)} items:${result.items} imgs:${result.images} prices:${result.prices} | ${result.title}`);
    results.push(result);
    await delay(2000 + Math.random() * 2000);
  }

  await browser.close();

  // Summary
  const accessible = results.filter(r => r.status === "SUCCESS" || r.status === "PARTIAL");
  console.log(`\n\n📊 Accessible sites (${accessible.length}):`);
  accessible.sort((a, b) => b.items - a.items);
  accessible.forEach(r => {
    console.log(`  ${r.name}: ${r.items} links, ${r.images} imgs, ${r.prices} prices`);
  });

  writeFileSync(join(process.cwd(), "data", "site-test-v2.json"), JSON.stringify(results, null, 2));
}

main().catch(console.error);
