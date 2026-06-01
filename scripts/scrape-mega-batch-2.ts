/**
 * 🐻💪 MEGA BATCH SCRAPER 第2弾 - もっと深掘り！
 * - Cookly ページネーション
 * - Activity Japan 英語版深掘り
 * - Japan Wonder Travel 修正URL
 * - WAmazing activities深掘り
 * - Attractive Japan 修正
 * - 新規サイト追加: Klook API, Voyagin/Rakuten, NAVITIME, etc.
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import type { Page, Browser } from "puppeteer";

puppeteer.use(StealthPlugin());

interface ScrapedItem {
  title: string;
  url: string;
  image: string;
  price: string;
  priceNum: number;
  currency: string;
  rating: string;
  reviewCount: string;
  city: string;
  platform: string;
  description: string;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

async function scrollPage(page: Page, times = 12, dist = 600, wait = 400) {
  for (let i = 0; i < times; i++) {
    await page.evaluate((d) => window.scrollBy(0, d), dist);
    await delay(wait);
  }
}

// ============ Cookly DEEP - ページネーション＆都市別 ============
async function scrapeCooklyDeep(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n🍳 Cookly DEEP - 全ページ取得");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });

  const results: ScrapedItem[] = [];
  const baseUrls = [
    { base: "https://www.cookly.me/cooking-class/japan/", city: "Various" },
    { base: "https://www.cookly.me/cooking-class/japan/tokyo/", city: "Tokyo" },
    { base: "https://www.cookly.me/cooking-class/japan/kyoto/", city: "Kyoto" },
    { base: "https://www.cookly.me/cooking-class/japan/osaka/", city: "Osaka" },
    { base: "https://www.cookly.me/cooking-class/japan/sapporo/", city: "Hokkaido" },
    { base: "https://www.cookly.me/cooking-class/japan/nara/", city: "Nara" },
    { base: "https://www.cookly.me/cooking-class/japan/hiroshima/", city: "Hiroshima" },
    { base: "https://www.cookly.me/cooking-class/japan/fukuoka/", city: "Fukuoka" },
    { base: "https://www.cookly.me/cooking-class/japan/yokohama/", city: "Yokohama" },
    { base: "https://www.cookly.me/cooking-class/japan/nagoya/", city: "Nagoya" },
    { base: "https://www.cookly.me/cooking-class/japan/kobe/", city: "Kobe" },
    { base: "https://www.cookly.me/market-tour/japan/", city: "Various" },
    { base: "https://www.cookly.me/market-tour/japan/tokyo/", city: "Tokyo" },
    { base: "https://www.cookly.me/market-tour/japan/osaka/", city: "Osaka" },
    { base: "https://www.cookly.me/market-tour/japan/kyoto/", city: "Kyoto" },
  ];

  // Add pagination for main pages
  const urls: { url: string; city: string }[] = [];
  for (const { base, city } of baseUrls) {
    urls.push({ url: base, city });
    // Add pages 2-5
    for (let p = 2; p <= 5; p++) {
      urls.push({ url: `${base}?page=${p}`, city });
    }
  }

  for (const { url, city } of urls) {
    try {
      console.log(`  ${city}: ${url.split("cookly.me")[1]?.slice(0, 60)}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 }).catch(() =>
        page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 })
      );
      await delay(1500);
      await scrollPage(page, 10);

      const items = await page.evaluate((c: string) => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll('a[href*="/cooking-class/"], a[href*="/market-tour/"], [class*="card"], [class*="class"]').forEach((el) => {
          const link = el.closest("a") || el.querySelector("a");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href) return;
          // Skip category pages
          if (href.endsWith("/japan/") || href.match(/\/japan\/[a-z]+\/$/)) return;
          // Must be a specific class page
          if (!href.match(/\/\d+/) && !href.match(/[a-z]+-[a-z]+-\d/)) return;
          const img = el.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
          if (!imgSrc || imgSrc.includes("logo")) return;
          let title = el.querySelector("h2, h3, h4, [class*='title'], [class*='name']")?.textContent?.trim() || img?.getAttribute("alt") || "";
          if (!title || title.length < 5) return;
          const text = el.textContent || "";
          const priceM = text.match(/(?:\$|USD)\s*(\d+)/i);
          const priceNum = priceM ? parseInt(priceM[1]) : 0;
          const ratingM = text.match(/(\d\.\d)/);
          const reviewM = text.match(/\((\d+)/);
          seen.add(href);
          found.push({ title: title.slice(0, 200), url: href.startsWith("http") ? href : `https://www.cookly.me${href}`, image: imgSrc.startsWith("http") ? imgSrc : `https://www.cookly.me${imgSrc}`, price: priceNum > 0 ? `$${priceNum}` : "", priceNum, currency: "USD", rating: ratingM ? ratingM[1] : "", reviewCount: reviewM ? reviewM[1] : "", city: c, platform: "cookly", description: "" });
        });
        return found;
      }, city);
      if (items.length > 0) console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch {
      // silently skip
    }
    await delay(1500 + Math.random() * 1000);
  }
  await page.close();
  return results;
}

// ============ Activity Japan English DEEP ============
async function scrapeActivityJapanDeep(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n📱 Activity Japan English - 深掘り");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://en.activityjapan.com/", city: "Various" },
    { url: "https://en.activityjapan.com/publish/plan_list/1/", city: "Tokyo" },
    { url: "https://en.activityjapan.com/publish/plan_list/7/", city: "Kyoto" },
    { url: "https://en.activityjapan.com/publish/plan_list/8/", city: "Osaka" },
    { url: "https://en.activityjapan.com/publish/plan_list/2/", city: "Hokkaido" },
    { url: "https://en.activityjapan.com/publish/plan_list/47/", city: "Okinawa" },
    { url: "https://en.activityjapan.com/publish/plan_list/34/", city: "Hiroshima" },
    { url: "https://en.activityjapan.com/publish/plan_list/29/", city: "Nara" },
    { url: "https://en.activityjapan.com/publish/plan_list/14/", city: "Kanagawa" },
    { url: "https://en.activityjapan.com/search/tokyo/", city: "Tokyo" },
    { url: "https://en.activityjapan.com/search/kyoto/", city: "Kyoto" },
    { url: "https://en.activityjapan.com/search/osaka/", city: "Osaka" },
    // Category pages
    { url: "https://en.activityjapan.com/category/1/", city: "Various" }, // Culture
    { url: "https://en.activityjapan.com/category/2/", city: "Various" }, // Outdoor
    { url: "https://en.activityjapan.com/category/3/", city: "Various" }, // Food
    { url: "https://en.activityjapan.com/category/4/", city: "Various" }, // Making
    // Japanese site (broader selection)
    { url: "https://activityjapan.com/", city: "Various" },
    { url: "https://activityjapan.com/publish/plan_list/1/", city: "Tokyo" },
    { url: "https://activityjapan.com/publish/plan_list/7/", city: "Kyoto" },
    { url: "https://activityjapan.com/publish/plan_list/8/", city: "Osaka" },
    { url: "https://activityjapan.com/publish/plan_list/2/", city: "Hokkaido" },
    { url: "https://activityjapan.com/publish/plan_list/47/", city: "Okinawa" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  ${city}: ${url.split("activityjapan.com")[1]}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 }).catch(() =>
        page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 })
      );
      await delay(2500);
      await scrollPage(page, 15, 500);

      const items = await page.evaluate((c: string) => {
        const found: any[] = [];
        const seen = new Set<string>();
        // Activity Japan uses specific plan cards
        document.querySelectorAll('a, [class*="plan"], [class*="card"], [class*="item"], [class*="product"], article, li').forEach((el) => {
          const link = el.closest("a") || el.querySelector("a");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href || href === "/" || href === "#") return;
          // Filter for plan/activity pages
          if (!href.includes("plan") && !href.includes("activity") && !href.includes("publish") && !href.includes("detail")) {
            // Also accept category items
            if (!href.match(/\/\d+\/?$/) && !href.includes("feature")) return;
          }
          const img = el.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || img?.getAttribute("data-lazy") || "";
          if (!imgSrc || imgSrc.includes("logo") || imgSrc.includes("icon") || imgSrc.length < 10) return;
          let title = el.querySelector("h2, h3, h4, [class*='title'], [class*='name'], .planName, [class*='plan']")?.textContent?.trim() || img?.getAttribute("alt") || "";
          if (!title || title.length < 5) return;
          if (title.includes("menu") || title.includes("ログイン") || title.includes("Copyright")) return;
          const text = el.textContent || "";
          let priceNum = 0;
          const jpyM = text.match(/(\d{1,3}(?:,\d{3})*)\s*円/) || text.match(/¥\s*(\d{1,3}(?:,\d{3})*)/);
          const usdM = text.match(/\$\s*(\d+)/);
          if (usdM) priceNum = parseInt(usdM[1]);
          else if (jpyM) priceNum = Math.round(parseInt(jpyM[1].replace(/,/g, "")) / 155);
          const ratingM = text.match(/(\d\.\d)/);
          const reviewM = text.match(/(\d+)\s*(?:件|review|口コミ)/i);
          seen.add(href);
          const base = window.location.origin;
          found.push({ title: title.slice(0, 200), url: href.startsWith("http") ? href : `${base}${href}`, image: imgSrc.startsWith("http") ? imgSrc : `${base}${imgSrc}`, price: priceNum > 0 ? `$${priceNum}` : "", priceNum, currency: "USD", rating: ratingM ? ratingM[1] : "", reviewCount: reviewM ? reviewM[1] : "", city: c, platform: "activityjapan", description: "" });
        });
        return found;
      }, city);
      if (items.length > 0) console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 60)}`);
    }
    await delay(2000 + Math.random() * 1500);
  }
  await page.close();
  return results;
}

// ============ JNTO Deep - japan.travel深掘り ============
async function scrapeJNTODeep(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n🗾 JNTO Deep - japan.travel全カテゴリ");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://www.japan.travel/en/things-to-do/", city: "Various" },
    { url: "https://www.japan.travel/en/things-to-do/?page=2", city: "Various" },
    { url: "https://www.japan.travel/en/things-to-do/?page=3", city: "Various" },
    { url: "https://www.japan.travel/en/things-to-do/?category=food-drink", city: "Various" },
    { url: "https://www.japan.travel/en/things-to-do/?category=culture", city: "Various" },
    { url: "https://www.japan.travel/en/things-to-do/?category=nature", city: "Various" },
    { url: "https://www.japan.travel/en/things-to-do/?category=relaxation", city: "Various" },
    { url: "https://www.japan.travel/en/things-to-do/?category=shopping", city: "Various" },
    { url: "https://www.japan.travel/en/spot/", city: "Various" },
    { url: "https://www.japan.travel/en/spot/?page=2", city: "Various" },
    { url: "https://www.japan.travel/en/spot/?page=3", city: "Various" },
    { url: "https://www.japan.travel/en/destinations/kanto/tokyo/", city: "Tokyo" },
    { url: "https://www.japan.travel/en/destinations/kanto/tokyo/?page=2", city: "Tokyo" },
    { url: "https://www.japan.travel/en/destinations/kansai/kyoto/", city: "Kyoto" },
    { url: "https://www.japan.travel/en/destinations/kansai/osaka/", city: "Osaka" },
    { url: "https://www.japan.travel/en/destinations/hokkaido/hokkaido/", city: "Hokkaido" },
    { url: "https://www.japan.travel/en/destinations/okinawa/okinawa/", city: "Okinawa" },
    { url: "https://www.japan.travel/en/destinations/chugoku/hiroshima/", city: "Hiroshima" },
    { url: "https://www.japan.travel/en/destinations/kansai/nara/", city: "Nara" },
    { url: "https://www.japan.travel/en/destinations/chubu/nagano/", city: "Nagano" },
    { url: "https://www.japan.travel/en/destinations/kyushu/fukuoka/", city: "Fukuoka" },
    { url: "https://www.japan.travel/en/destinations/tohoku/miyagi/", city: "Miyagi" },
    { url: "https://www.japan.travel/en/destinations/shikoku/kagawa/", city: "Kagawa" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  ${city}: ${url.split("japan.travel")[1]?.slice(0, 60)}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 }).catch(() =>
        page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 })
      );
      await delay(2000);
      await scrollPage(page, 12);

      const items = await page.evaluate((c: string) => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll('a, [class*="card"], [class*="spot"], [class*="item"], article').forEach((el) => {
          const link = el.closest("a") || el.querySelector("a");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href || href === "#") return;
          if (!href.includes("/en/") && !href.startsWith("/")) return;
          const img = el.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || img?.getAttribute("data-lazy-src") || "";
          if (!imgSrc || imgSrc.includes("logo") || imgSrc.includes("icon") || imgSrc.includes("svg") || imgSrc.length < 15) return;
          let title = el.querySelector("h2, h3, h4, [class*='title'], [class*='name']")?.textContent?.trim() || img?.getAttribute("alt") || "";
          if (!title || title.length < 5) return;
          if (title.toLowerCase().includes("menu") || title.toLowerCase().includes("cookie") || title.toLowerCase().includes("navigation")) return;
          seen.add(href);
          found.push({ title: title.slice(0, 200), url: href.startsWith("http") ? href : `https://www.japan.travel${href}`, image: imgSrc.startsWith("http") ? imgSrc : `https://www.japan.travel${imgSrc}`, price: "", priceNum: 0, currency: "USD", rating: "", reviewCount: "", city: c, platform: "jnto", description: "" });
        });
        return found;
      }, city);
      if (items.length > 0) console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch {
      // silently skip
    }
    await delay(1500 + Math.random() * 1000);
  }
  await page.close();
  return results;
}

// ============ Trip Advisor Experiences (API approach) ============
async function scrapeTripAdvisorExperiences(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n🦉 TripAdvisor Experiences - API approach");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://www.tripadvisor.com/Attractions-g298184-Activities-c42-Tokyo_Tokyo_Prefecture_Kanto.html", city: "Tokyo" },
    { url: "https://www.tripadvisor.com/Attractions-g298564-Activities-c42-Kyoto_Kyoto_Prefecture_Kinki.html", city: "Kyoto" },
    { url: "https://www.tripadvisor.com/Attractions-g298566-Activities-c42-Osaka_Osaka_Prefecture_Kinki.html", city: "Osaka" },
    { url: "https://www.tripadvisor.com/Attractions-g298143-Activities-c42-Hiroshima_Hiroshima_Prefecture_Chugoku.html", city: "Hiroshima" },
    { url: "https://www.tripadvisor.com/Attractions-g298148-Activities-c42-Sapporo_Hokkaido.html", city: "Hokkaido" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  ${city}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 }).catch(() =>
        page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
      );
      await delay(3000);
      await scrollPage(page, 20, 500, 500);

      const items = await page.evaluate((c: string) => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll('a, [class*="card"], [data-test-target], article, [class*="listing"]').forEach((el) => {
          const link = el.closest("a") || el.querySelector("a");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href) return;
          if (!href.includes("Attraction_Review") && !href.includes("AttractionProductReview")) return;
          const img = el.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
          if (!imgSrc || imgSrc.includes("logo") || imgSrc.includes("icon")) return;
          let title = el.querySelector("h2, h3, [class*='title'], [class*='name']")?.textContent?.trim() || img?.getAttribute("alt") || "";
          if (!title || title.length < 5) return;
          const text = el.textContent || "";
          const priceM = text.match(/(?:\$|USD)\s*(\d+)/i) || text.match(/from\s*(\d+)/i);
          const priceNum = priceM ? parseInt(priceM[1]) : 0;
          const ratingM = text.match(/(\d\.\d)\s*of\s*5/);
          const reviewM = text.match(/([\d,]+)\s*review/i);
          seen.add(href);
          found.push({ title: title.slice(0, 200), url: href.startsWith("http") ? href : `https://www.tripadvisor.com${href}`, image: imgSrc, price: priceNum > 0 ? `$${priceNum}` : "", priceNum, currency: "USD", rating: ratingM ? ratingM[1] : "", reviewCount: reviewM ? reviewM[1] : "", city: c, platform: "tripadvisor", description: "" });
        });
        return found;
      }, city);
      console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 80)}`);
    }
    await delay(3000 + Math.random() * 3000);
  }
  await page.close();
  return results;
}

// ============ Govoyagin / Rakuten Experiences (リダイレクト先確認) ============
async function scrapeRakutenExperiences(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n🏪 Rakuten Experiences / Govoyagin alternatives");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://experiences.travel.rakuten.co.jp/", city: "Various" },
    { url: "https://experiences.travel.rakuten.co.jp/search?area=tokyo", city: "Tokyo" },
    { url: "https://experiences.travel.rakuten.co.jp/search?area=kyoto", city: "Kyoto" },
    { url: "https://experiences.travel.rakuten.co.jp/search?area=osaka", city: "Osaka" },
    { url: "https://travel.rakuten.co.jp/experiences/", city: "Various" },
    { url: "https://travel.rakuten.co.jp/mytrip/activities/", city: "Various" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  ${city}: ${url.split("rakuten")[1]?.slice(0, 60)}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 }).catch(() =>
        page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 })
      );
      await delay(2500);
      await scrollPage(page, 15);

      const items = await page.evaluate((c: string) => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll('a, [class*="card"], [class*="product"], [class*="plan"], [class*="experience"], article').forEach((el) => {
          const link = el.closest("a") || el.querySelector("a");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href || href === "/" || href === "#") return;
          const img = el.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
          if (!imgSrc || imgSrc.includes("logo") || imgSrc.includes("icon") || imgSrc.length < 15) return;
          let title = el.querySelector("h2, h3, h4, [class*='title'], [class*='name']")?.textContent?.trim() || img?.getAttribute("alt") || "";
          if (!title || title.length < 5) return;
          if (title.includes("ログイン") || title.includes("会員登録") || title.includes("ヘルプ")) return;
          const text = el.textContent || "";
          const jpyM = text.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
          const priceNum = jpyM ? Math.round(parseInt(jpyM[1].replace(/,/g, "")) / 155) : 0;
          const ratingM = text.match(/(\d\.\d)/);
          seen.add(href);
          const base = window.location.origin;
          found.push({ title: title.slice(0, 200), url: href.startsWith("http") ? href : `${base}${href}`, image: imgSrc.startsWith("http") ? imgSrc : `${base}${imgSrc}`, price: priceNum > 0 ? `$${priceNum}` : "", priceNum, currency: "USD", rating: ratingM ? ratingM[1] : "", reviewCount: "", city: c, platform: "rakuten-exp", description: "" });
        });
        return found;
      }, city);
      if (items.length > 0) console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 60)}`);
    }
    await delay(2000 + Math.random() * 1500);
  }
  await page.close();
  return results;
}

// ============ Japan Highlight Travel ============
async function scrapeJapanHighlight(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n🌅 Japan Highlight Travel");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://www.japanhighlightstravel.com/", city: "Various" },
    { url: "https://www.japanhighlightstravel.com/tours", city: "Various" },
    { url: "https://www.japanhighlightstravel.com/tokyo-tours", city: "Tokyo" },
    { url: "https://www.japanhighlightstravel.com/kyoto-tours", city: "Kyoto" },
    { url: "https://www.japanhighlightstravel.com/osaka-tours", city: "Osaka" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  ${city}: ${url.split(".com")[1] || "/"}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 }).catch(() =>
        page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 })
      );
      await delay(2000);
      await scrollPage(page, 12);

      const items = await page.evaluate((c: string) => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll('a, [class*="tour"], [class*="card"], [class*="product"], article').forEach((el) => {
          const link = el.closest("a") || el.querySelector("a");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href || href === "/" || href === "#") return;
          const img = el.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
          if (!imgSrc || imgSrc.includes("logo") || imgSrc.includes("icon") || imgSrc.length < 15) return;
          let title = el.querySelector("h2, h3, h4, [class*='title'], [class*='name']")?.textContent?.trim() || img?.getAttribute("alt") || "";
          if (!title || title.length < 5) return;
          const text = el.textContent || "";
          const priceM = text.match(/\$\s*(\d+)/);
          const priceNum = priceM ? parseInt(priceM[1]) : 0;
          seen.add(href);
          const base = window.location.origin;
          found.push({ title: title.slice(0, 200), url: href.startsWith("http") ? href : `${base}${href}`, image: imgSrc.startsWith("http") ? imgSrc : `${base}${imgSrc}`, price: priceNum > 0 ? `$${priceNum}` : "", priceNum, currency: "USD", rating: "", reviewCount: "", city: c, platform: "japanhighlights", description: "" });
        });
        return found;
      }, city);
      if (items.length > 0) console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 60)}`);
    }
    await delay(2000 + Math.random() * 1500);
  }
  await page.close();
  return results;
}

// ============ VISIT regional tourism sites deep ============
async function scrapeRegionalDeep(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n🗺️ Regional Tourism DEEP");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    // GO TOKYO deep
    { url: "https://www.gotokyo.org/en/things-to-do/index.html", city: "Tokyo", platform: "gotokyo" },
    { url: "https://www.gotokyo.org/en/things-to-do/unique-experiences/index.html", city: "Tokyo", platform: "gotokyo" },
    { url: "https://www.gotokyo.org/en/things-to-do/festivals-events/index.html", city: "Tokyo", platform: "gotokyo" },
    { url: "https://www.gotokyo.org/en/things-to-do/art-culture/index.html", city: "Tokyo", platform: "gotokyo" },
    { url: "https://www.gotokyo.org/en/things-to-do/shopping/index.html", city: "Tokyo", platform: "gotokyo" },
    { url: "https://www.gotokyo.org/en/things-to-do/eating-drinking/index.html", city: "Tokyo", platform: "gotokyo" },
    { url: "https://www.gotokyo.org/en/things-to-do/nightlife/index.html", city: "Tokyo", platform: "gotokyo" },
    { url: "https://www.gotokyo.org/en/spot/index.html", city: "Tokyo", platform: "gotokyo" },
    // Kyoto Tourism
    { url: "https://kyoto.travel/en/thingstodo.html", city: "Kyoto", platform: "kyototravel" },
    { url: "https://kyoto.travel/en/see-and-do.html", city: "Kyoto", platform: "kyototravel" },
    { url: "https://kyoto.travel/en/thingstodo/entertainment.html", city: "Kyoto", platform: "kyototravel" },
    // Osaka deep
    { url: "https://osaka-info.jp/en/activities/", city: "Osaka", platform: "osakainfo" },
    { url: "https://osaka-info.jp/en/spot/", city: "Osaka", platform: "osakainfo" },
    { url: "https://osaka-info.jp/en/page/food", city: "Osaka", platform: "osakainfo" },
    // Hokkaido deep
    { url: "https://en.visit-hokkaido.jp/things-to-do/", city: "Hokkaido", platform: "visithokkaido" },
    { url: "https://en.visit-hokkaido.jp/what-to-eat/", city: "Hokkaido", platform: "visithokkaido" },
    { url: "https://en.visit-hokkaido.jp/destinations/", city: "Hokkaido", platform: "visithokkaido" },
    // Okinawa
    { url: "https://visitokinawajapan.com/things-to-do/", city: "Okinawa", platform: "visitokinawa" },
    { url: "https://visitokinawajapan.com/travel-essentials/", city: "Okinawa", platform: "visitokinawa" },
    // Kanazawa
    { url: "https://visitkanazawa.jp/en/activities", city: "Kanazawa", platform: "visitkanazawa" },
    // Nagano
    { url: "https://www.go-nagano.net/en/things-to-do/", city: "Nagano", platform: "gonagano" },
    // Fukuoka
    { url: "https://yokanavi.com/en/things-to-do/", city: "Fukuoka", platform: "yokanavi" },
    // Nikko
    { url: "https://www.visitnikko.jp/en/things-to-do/", city: "Nikko", platform: "visitnikko" },
    // Kamakura
    { url: "https://www.trip-kamakura.com/en/", city: "Kamakura", platform: "tripkamakura" },
  ];

  for (const { url, city, platform } of urls) {
    try {
      console.log(`  ${platform}/${city}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 }).catch(() =>
        page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 })
      );
      await delay(2000);
      await scrollPage(page, 12);

      const items = await page.evaluate((c: string, p: string) => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll('a, [class*="card"], [class*="spot"], [class*="item"], article, li').forEach((el) => {
          const link = el.closest("a") || el.querySelector("a");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href || href === "#" || href === "/") return;
          const img = el.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || img?.getAttribute("data-lazy-src") || "";
          if (!imgSrc || imgSrc.includes("logo") || imgSrc.includes("icon") || imgSrc.includes("svg") || imgSrc.length < 15) return;
          let title = el.querySelector("h2, h3, h4, [class*='title'], [class*='name'], .ttl, .spot-name")?.textContent?.trim() || img?.getAttribute("alt") || "";
          if (!title || title.length < 5) return;
          if (title.toLowerCase().includes("menu") || title.toLowerCase().includes("privacy") || title.toLowerCase().includes("cookie") || title.toLowerCase().includes("search") || title.toLowerCase().includes("home")) return;
          seen.add(href);
          const base = window.location.origin;
          found.push({ title: title.slice(0, 200), url: href.startsWith("http") ? href : `${base}${href.startsWith("/") ? "" : "/"}${href}`, image: imgSrc.startsWith("http") ? imgSrc : `${base}${imgSrc.startsWith("/") ? "" : "/"}${imgSrc}`, price: "", priceNum: 0, currency: "USD", rating: "", reviewCount: "", city: c, platform: p, description: "" });
        });
        return found;
      }, city, platform);
      if (items.length > 0) console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 60)}`);
    }
    await delay(1500 + Math.random() * 1500);
  }
  await page.close();
  return results;
}

// ============ MAIN ============
async function main() {
  console.log("🐻💪 MEGA BATCH SCRAPER 第2弾 - 深掘り！\n");
  console.log("=".repeat(60));

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });

  const allResults: Record<string, ScrapedItem[]> = {};

  const scrapers = [
    { name: "CooklyDeep", fn: scrapeCooklyDeep },
    { name: "ActivityJapanDeep", fn: scrapeActivityJapanDeep },
    { name: "JNTODeep", fn: scrapeJNTODeep },
    { name: "TripAdvisor", fn: scrapeTripAdvisorExperiences },
    { name: "RakutenExp", fn: scrapeRakutenExperiences },
    { name: "JapanHighlights", fn: scrapeJapanHighlight },
    { name: "RegionalDeep", fn: scrapeRegionalDeep },
  ];

  for (const { name, fn } of scrapers) {
    try {
      console.log(`\n${"=".repeat(60)}`);
      const items = await fn(browser);
      allResults[name] = items;
    } catch (err) {
      console.log(`❌ ${name} failed: ${(err as Error).message?.slice(0, 100)}`);
      allResults[name] = [];
    }
  }

  await browser.close();

  // Load batch 1 results
  const batch1Path = join(process.cwd(), "data", "mega-batch-raw.json");
  let batch1: ScrapedItem[] = [];
  if (existsSync(batch1Path)) {
    batch1 = JSON.parse(readFileSync(batch1Path, "utf-8"));
    console.log(`\n📂 Loaded ${batch1.length} items from batch 1`);
  }

  // Combine all
  const all: ScrapedItem[] = [...batch1];
  for (const items of Object.values(allResults)) {
    all.push(...items);
  }

  // Deduplicate
  const seenUrls = new Set<string>();
  const unique = all.filter((item) => {
    const key = item.url.replace(/\/$/, "").replace(/^https?:\/\//, "").replace(/\?.*$/, "");
    if (seenUrls.has(key)) return false;
    seenUrls.add(key);
    return true;
  });

  // Print summary
  console.log("\n\n" + "=".repeat(60));
  console.log("📊 BATCH 2 RESULTS:");
  console.log("=".repeat(60));
  for (const [name, items] of Object.entries(allResults)) {
    const icon = items.length > 0 ? "✅" : "❌";
    console.log(`  ${icon} ${name}: ${items.length}`);
  }
  console.log(`\n  📂 Batch 1: ${batch1.length}`);
  console.log(`  📦 Batch 2 new: ${all.length - batch1.length}`);
  console.log(`  🔄 Total unique: ${unique.length}`);
  console.log(`  🖼️  With images: ${unique.filter((i) => i.image).length}`);
  console.log(`  💰 With prices: ${unique.filter((i) => i.priceNum > 0).length}`);

  // By platform
  const byPlatform: Record<string, number> = {};
  unique.forEach((i) => { byPlatform[i.platform] = (byPlatform[i.platform] || 0) + 1; });
  console.log("\n  📋 By platform:");
  Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).forEach(([p, c]) => console.log(`    ${p}: ${c}`));

  // By city
  const byCity: Record<string, number> = {};
  unique.forEach((i) => { byCity[i.city] = (byCity[i.city] || 0) + 1; });
  console.log("\n  🏙️  By city:");
  Object.entries(byCity).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`    ${c}: ${n}`));

  // Save combined
  const outputPath = join(process.cwd(), "data", "mega-batch-combined.json");
  writeFileSync(outputPath, JSON.stringify(unique, null, 2));
  console.log(`\n💾 Saved ${unique.length} items to ${outputPath}`);
}

main().catch(console.error);
