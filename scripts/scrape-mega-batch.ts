/**
 * 🐻 MEGA BATCH SCRAPER - とにかく数を取る！
 * WAmazing, Japanican, Cookly, Japan Wonder Travel, Magical Trip,
 * Fun! JAPAN, Attractive JAPAN, Headout, Regional tourism, etc.
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync } from "fs";
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

async function scrollPage(page: Page, times = 12, dist = 600, wait = 400) {
  for (let i = 0; i < times; i++) {
    await page.evaluate((d) => window.scrollBy(0, d), dist);
    await delay(wait);
  }
}

function parseJPY(text: string): number {
  const m = text.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
  if (m) return Math.round(parseInt(m[1].replace(/,/g, "")) / 155);
  return 0;
}

function parseUSD(text: string): number {
  const m = text.match(/(?:USD|US\$|\$)\s*(\d+(?:\.\d{2})?)/i) || text.match(/(\d+(?:\.\d{2})?)\s*USD/i);
  if (m) return parseFloat(m[1]);
  return 0;
}

// ============ WAmazing ============
async function scrapeWAmazing(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n🌸 WAmazing - 訪日外国人向け");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://www.wamazing.com/snow/", city: "Various" },
    { url: "https://www.wamazing.com/activities/", city: "Various" },
    { url: "https://www.wamazing.com/activities/search?area=tokyo", city: "Tokyo" },
    { url: "https://www.wamazing.com/activities/search?area=kyoto", city: "Kyoto" },
    { url: "https://www.wamazing.com/activities/search?area=osaka", city: "Osaka" },
    { url: "https://www.wamazing.com/activities/search?area=hokkaido", city: "Hokkaido" },
    { url: "https://www.wamazing.com/activities/search?area=okinawa", city: "Okinawa" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  ${city}: ${url.split("wamazing.com")[1]}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2000);
      await scrollPage(page, 15);

      const items = await page.evaluate((c: string) => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll('a[href*="/activities/"], a[href*="/snow/"], article, [class*="card"], [class*="item"], [class*="product"]').forEach((el) => {
          const link = el.closest("a") || el.querySelector("a");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href || href === "/activities/") return;
          const img = el.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
          if (!imgSrc || imgSrc.includes("logo")) return;
          let title = el.querySelector("h2, h3, h4, [class*='title'], [class*='name']")?.textContent?.trim() || img?.getAttribute("alt") || "";
          if (!title || title.length < 3) return;
          const text = el.textContent || "";
          const priceM = text.match(/(\d{1,3}(?:,\d{3})*)\s*円/) || text.match(/¥\s*(\d{1,3}(?:,\d{3})*)/);
          const priceNum = priceM ? Math.round(parseInt(priceM[1].replace(/,/g, "")) / 155) : 0;
          seen.add(href);
          found.push({ title: title.slice(0, 200), url: href.startsWith("http") ? href : `https://www.wamazing.com${href}`, image: imgSrc.startsWith("http") ? imgSrc : `https://www.wamazing.com${imgSrc}`, price: priceNum > 0 ? `$${priceNum}` : "", priceNum, currency: "USD", rating: "", reviewCount: "", city: c, platform: "wamazing", description: "" });
        });
        return found;
      }, city);
      console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 80)}`);
    }
    await delay(2000 + Math.random() * 1500);
  }
  await page.close();
  return results;
}

// ============ Japanican (JTB) ============
async function scrapeJapanican(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n🏯 Japanican (JTB) - 海外向け予約");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://www.japanican.com/en/tour/?area=13", city: "Tokyo" },
    { url: "https://www.japanican.com/en/tour/?area=26", city: "Kyoto" },
    { url: "https://www.japanican.com/en/tour/?area=27", city: "Osaka" },
    { url: "https://www.japanican.com/en/tour/", city: "Various" },
    { url: "https://www.japanican.com/en/tour/?area=01", city: "Hokkaido" },
    { url: "https://www.japanican.com/en/tour/?area=47", city: "Okinawa" },
    { url: "https://www.japanican.com/en/tour/?area=34", city: "Hiroshima" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  ${city}: ${url.split("japanican.com")[1]}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(3000);
      await scrollPage(page, 12);

      const items = await page.evaluate((c: string) => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll('a[href*="/tour/"], a[href*="/activity/"], [class*="tour"], [class*="product"], article, [class*="card"]').forEach((el) => {
          const link = el.closest("a") || el.querySelector("a");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href || href === "/en/tour/") return;
          const img = el.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || img?.getAttribute("data-lazy") || "";
          if (!imgSrc || imgSrc.includes("logo") || imgSrc.includes("icon")) return;
          let title = el.querySelector("h2, h3, h4, [class*='title'], [class*='name'], .tour-name")?.textContent?.trim() || img?.getAttribute("alt") || "";
          if (!title || title.length < 5) return;
          const text = el.textContent || "";
          let priceNum = 0;
          const usdM = text.match(/(?:USD|US\$|\$)\s*(\d+(?:\.\d{2})?)/i);
          const jpyM = text.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
          if (usdM) priceNum = parseFloat(usdM[1]);
          else if (jpyM) priceNum = Math.round(parseInt(jpyM[1].replace(/,/g, "")) / 155);
          seen.add(href);
          found.push({ title: title.slice(0, 200), url: href.startsWith("http") ? href : `https://www.japanican.com${href}`, image: imgSrc.startsWith("http") ? imgSrc : `https://www.japanican.com${imgSrc}`, price: priceNum > 0 ? `$${priceNum}` : "", priceNum, currency: "USD", rating: "", reviewCount: "", city: c, platform: "japanican", description: "" });
        });
        return found;
      }, city);
      console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 80)}`);
    }
    await delay(2500 + Math.random() * 2000);
  }
  await page.close();
  return results;
}

// ============ Cookly ============
async function scrapeCookly(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n🍳 Cookly - 料理教室特化");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://www.cookly.me/cooking-class/japan/", city: "Various" },
    { url: "https://www.cookly.me/cooking-class/japan/tokyo/", city: "Tokyo" },
    { url: "https://www.cookly.me/cooking-class/japan/kyoto/", city: "Kyoto" },
    { url: "https://www.cookly.me/cooking-class/japan/osaka/", city: "Osaka" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  ${city}: ${url.split("cookly.me")[1]}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2000);
      await scrollPage(page, 15);

      const items = await page.evaluate((c: string) => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll('a[href*="/cooking-class/"], a[href*="/market-tour/"], [class*="card"], [class*="class"], article').forEach((el) => {
          const link = el.closest("a") || el.querySelector("a");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href || href.endsWith("/japan/") || href.endsWith("/tokyo/") || href.endsWith("/kyoto/") || href.endsWith("/osaka/")) return;
          const img = el.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
          if (!imgSrc || imgSrc.includes("logo")) return;
          let title = el.querySelector("h2, h3, h4, [class*='title'], [class*='name']")?.textContent?.trim() || img?.getAttribute("alt") || "";
          if (!title || title.length < 5) return;
          const text = el.textContent || "";
          const priceM = text.match(/(?:\$|USD)\s*(\d+)/i);
          const priceNum = priceM ? parseInt(priceM[1]) : 0;
          const ratingM = text.match(/(\d\.\d)\s/);
          const reviewM = text.match(/\((\d+)\s*review/i);
          seen.add(href);
          found.push({ title: title.slice(0, 200), url: href.startsWith("http") ? href : `https://www.cookly.me${href}`, image: imgSrc.startsWith("http") ? imgSrc : `https://www.cookly.me${imgSrc}`, price: priceNum > 0 ? `$${priceNum}` : "", priceNum, currency: "USD", rating: ratingM ? ratingM[1] : "", reviewCount: reviewM ? reviewM[1] : "", city: c, platform: "cookly", description: "" });
        });
        return found;
      }, city);
      console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 80)}`);
    }
    await delay(2000 + Math.random() * 1500);
  }
  await page.close();
  return results;
}

// ============ Japan Wonder Travel ============
async function scrapeJapanWonderTravel(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n🗾 Japan Wonder Travel - ツアー・文化体験");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://www.japanwondertravel.com/collections/tokyo-tours", city: "Tokyo" },
    { url: "https://www.japanwondertravel.com/collections/kyoto-tours", city: "Kyoto" },
    { url: "https://www.japanwondertravel.com/collections/osaka-tours", city: "Osaka" },
    { url: "https://www.japanwondertravel.com/collections/all", city: "Various" },
    { url: "https://www.japanwondertravel.com/products", city: "Various" },
    { url: "https://www.japanwondertravel.com/", city: "Various" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  ${city}: ${url.split(".com")[1]}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2000);
      await scrollPage(page, 15);

      const items = await page.evaluate((c: string) => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll('a[href*="/products/"], a[href*="/collections/"], [class*="product"], [class*="card"], [class*="tour"], article').forEach((el) => {
          const link = el.closest("a") || el.querySelector("a");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href || href.endsWith("/all") || href.endsWith("/products")) return;
          if (!href.includes("/products/") && !href.includes("tour")) return;
          const img = el.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || img?.getAttribute("data-srcset")?.split(" ")[0] || "";
          if (!imgSrc || imgSrc.includes("logo")) return;
          let title = el.querySelector("h2, h3, h4, [class*='title'], [class*='name']")?.textContent?.trim() || img?.getAttribute("alt") || "";
          if (!title || title.length < 5) return;
          const text = el.textContent || "";
          const priceM = text.match(/(?:\$|USD)\s*(\d+(?:\.\d{2})?)/i);
          const priceNum = priceM ? parseFloat(priceM[1]) : 0;
          const ratingM = text.match(/(\d\.\d)/);
          seen.add(href);
          found.push({ title: title.slice(0, 200), url: href.startsWith("http") ? href : `https://www.japanwondertravel.com${href}`, image: imgSrc.startsWith("http") ? imgSrc : `https://www.japanwondertravel.com${imgSrc}`, price: priceNum > 0 ? `$${priceNum}` : "", priceNum, currency: "USD", rating: ratingM ? ratingM[1] : "", reviewCount: "", city: c, platform: "japanwondertravel", description: "" });
        });
        return found;
      }, city);
      console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 80)}`);
    }
    await delay(2000 + Math.random() * 1500);
  }
  await page.close();
  return results;
}

// ============ Magical Trip ============
async function scrapeMagicalTrip(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n✨ Magical Trip - フード/ドリンクツアー");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://www.magicaltrip.com/tours", city: "Various" },
    { url: "https://www.magicaltrip.com/spot/tokyo", city: "Tokyo" },
    { url: "https://www.magicaltrip.com/spot/kyoto", city: "Kyoto" },
    { url: "https://www.magicaltrip.com/spot/osaka", city: "Osaka" },
    { url: "https://www.magicaltrip.com/", city: "Various" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  ${city}: ${url.split(".com")[1]}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2000);
      await scrollPage(page, 12);

      const items = await page.evaluate((c: string) => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll('a[href*="/tour"], a[href*="/spot/"], [class*="tour"], [class*="card"], article').forEach((el) => {
          const link = el.closest("a") || el.querySelector("a");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href || href === "/tours") return;
          const img = el.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
          if (!imgSrc || imgSrc.includes("logo")) return;
          let title = el.querySelector("h2, h3, h4, [class*='title'], [class*='name']")?.textContent?.trim() || img?.getAttribute("alt") || "";
          if (!title || title.length < 5) return;
          const text = el.textContent || "";
          const priceM = text.match(/(?:\$|USD)\s*(\d+)/i);
          const priceNum = priceM ? parseInt(priceM[1]) : 0;
          const ratingM = text.match(/(\d\.\d)/);
          const reviewM = text.match(/\((\d+)\)/);
          seen.add(href);
          found.push({ title: title.slice(0, 200), url: href.startsWith("http") ? href : `https://www.magicaltrip.com${href}`, image: imgSrc.startsWith("http") ? imgSrc : `https://www.magicaltrip.com${imgSrc}`, price: priceNum > 0 ? `$${priceNum}` : "", priceNum, currency: "USD", rating: ratingM ? ratingM[1] : "", reviewCount: reviewM ? reviewM[1] : "", city: c, platform: "magicaltrip", description: "" });
        });
        return found;
      }, city);
      console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 80)}`);
    }
    await delay(2000 + Math.random() * 1500);
  }
  await page.close();
  return results;
}

// ============ Attractive JAPAN ============
async function scrapeAttractiveJapan(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n🎌 Attractive JAPAN - 体験プラン予約");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "ja,en-US;q=0.9" });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://attractive-j.com/plans/", city: "Various" },
    { url: "https://attractive-j.com/plans/?pref=tokyo", city: "Tokyo" },
    { url: "https://attractive-j.com/plans/?pref=kyoto", city: "Kyoto" },
    { url: "https://attractive-j.com/plans/?pref=osaka", city: "Osaka" },
    { url: "https://attractive-j.com/areas/hokkaido/", city: "Hokkaido" },
    { url: "https://attractive-j.com/areas/okinawa/", city: "Okinawa" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  ${city}: ${url.split("attractive-j.com")[1]}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2000);
      await scrollPage(page, 15);

      const items = await page.evaluate((c: string) => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll('a[href*="/plans/"], a[href*="/plan/"], [class*="card"], [class*="plan"], article').forEach((el) => {
          const link = el.closest("a") || el.querySelector("a");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href || href === "/plans/") return;
          const img = el.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
          if (!imgSrc || imgSrc.includes("logo")) return;
          let title = el.querySelector("h2, h3, h4, [class*='title'], [class*='name']")?.textContent?.trim() || img?.getAttribute("alt") || "";
          if (!title || title.length < 3) return;
          const text = el.textContent || "";
          const priceM = text.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
          const priceNum = priceM ? Math.round(parseInt(priceM[1].replace(/,/g, "")) / 155) : 0;
          seen.add(href);
          found.push({ title: title.slice(0, 200), url: href.startsWith("http") ? href : `https://attractive-j.com${href}`, image: imgSrc.startsWith("http") ? imgSrc : `https://attractive-j.com${imgSrc}`, price: priceNum > 0 ? `$${priceNum}` : "", priceNum, currency: "USD", rating: "", reviewCount: "", city: c, platform: "attractivejapan", description: "" });
        });
        return found;
      }, city);
      console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 80)}`);
    }
    await delay(2000 + Math.random() * 1500);
  }
  await page.close();
  return results;
}

// ============ Headout Japan (改良版) ============
async function scrapeHeadout(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n🎫 Headout Japan - チケット&体験（改良版）");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://www.headout.com/tokyo/", city: "Tokyo" },
    { url: "https://www.headout.com/tokyo/things-to-do/", city: "Tokyo" },
    { url: "https://www.headout.com/kyoto/", city: "Kyoto" },
    { url: "https://www.headout.com/osaka/", city: "Osaka" },
    { url: "https://www.headout.com/tokyo/food-tours/", city: "Tokyo" },
    { url: "https://www.headout.com/tokyo/cultural-experiences/", city: "Tokyo" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  ${city}: ${url.split("headout.com")[1]}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(3000);
      await scrollPage(page, 20, 500, 500);

      const items = await page.evaluate((c: string) => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll('a, [class*="card"], [class*="product"], [class*="experience"], article').forEach((el) => {
          const link = el.closest("a") || el.querySelector("a");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href) return;
          if (!href.includes("tokyo") && !href.includes("kyoto") && !href.includes("osaka") && !href.includes("japan")) return;
          const img = el.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
          if (!imgSrc || imgSrc.includes("logo") || imgSrc.includes("icon") || imgSrc.includes("svg")) return;
          let title = el.querySelector("h2, h3, h4, [class*='title'], [class*='name']")?.textContent?.trim() || img?.getAttribute("alt") || "";
          if (!title || title.length < 5) return;
          const text = el.textContent || "";
          const priceM = text.match(/(?:\$|USD|US\$|¥)\s*(\d+(?:\.\d{2})?)/i);
          let priceNum = priceM ? parseFloat(priceM[1]) : 0;
          if (text.includes("¥") && priceNum > 500) priceNum = Math.round(priceNum / 155);
          const ratingM = text.match(/(\d\.\d)/);
          const reviewM = text.match(/\((\d+(?:,\d+)?)\s*(?:review|rating)/i);
          seen.add(href);
          found.push({ title: title.slice(0, 200), url: href.startsWith("http") ? href : `https://www.headout.com${href}`, image: imgSrc.startsWith("http") ? imgSrc : `https://www.headout.com${imgSrc}`, price: priceNum > 0 ? `$${priceNum}` : "", priceNum, currency: "USD", rating: ratingM ? ratingM[1] : "", reviewCount: reviewM ? reviewM[1] : "", city: c, platform: "headout", description: "" });
        });
        return found;
      }, city);
      console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 80)}`);
    }
    await delay(2500 + Math.random() * 2000);
  }
  await page.close();
  return results;
}

// ============ Fun! JAPAN ============
async function scrapeFunJapan(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n🎉 Fun! JAPAN - 訪日観光情報");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://www.fun-japan.jp/en/articles/group/things-to-do", city: "Various" },
    { url: "https://www.fun-japan.jp/en/articles/group/tokyo", city: "Tokyo" },
    { url: "https://www.fun-japan.jp/en/articles/group/kyoto", city: "Kyoto" },
    { url: "https://www.fun-japan.jp/en/articles/group/osaka", city: "Osaka" },
    { url: "https://www.fun-japan.jp/en/articles/group/hokkaido", city: "Hokkaido" },
    { url: "https://www.fun-japan.jp/en/articles/group/okinawa", city: "Okinawa" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  ${city}: ${url.split("fun-japan.jp")[1]}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2000);
      await scrollPage(page, 15);

      const items = await page.evaluate((c: string) => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll('a[href*="/articles/"], a[href*="/things-to-do/"], [class*="card"], [class*="article"], article').forEach((el) => {
          const link = el.closest("a") || el.querySelector("a");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href || href.endsWith("/group/")) return;
          const img = el.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
          if (!imgSrc || imgSrc.includes("logo")) return;
          let title = el.querySelector("h2, h3, h4, [class*='title'], [class*='name']")?.textContent?.trim() || img?.getAttribute("alt") || "";
          if (!title || title.length < 5) return;
          seen.add(href);
          found.push({ title: title.slice(0, 200), url: href.startsWith("http") ? href : `https://www.fun-japan.jp${href}`, image: imgSrc.startsWith("http") ? imgSrc : `https://www.fun-japan.jp${imgSrc}`, price: "", priceNum: 0, currency: "USD", rating: "", reviewCount: "", city: c, platform: "funjapan", description: "" });
        });
        return found;
      }, city);
      console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 80)}`);
    }
    await delay(2000 + Math.random() * 1500);
  }
  await page.close();
  return results;
}

// ============ 観光協会・地域サイト ============
async function scrapeRegionalTourism(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n🗺️ 地域観光協会サイト");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "en,ja;q=0.9" });

  const results: ScrapedItem[] = [];
  const urls = [
    // Visit Japan / JNTO
    { url: "https://www.japan.travel/en/things-to-do/", city: "Various", platform: "jnto" },
    { url: "https://www.japan.travel/en/destinations/kanto/tokyo/", city: "Tokyo", platform: "jnto" },
    { url: "https://www.japan.travel/en/destinations/kansai/kyoto/", city: "Kyoto", platform: "jnto" },
    { url: "https://www.japan.travel/en/destinations/kansai/osaka/", city: "Osaka", platform: "jnto" },
    { url: "https://www.japan.travel/en/destinations/hokkaido/", city: "Hokkaido", platform: "jnto" },
    // Tokyo official
    { url: "https://www.gotokyo.org/en/things-to-do/index.html", city: "Tokyo", platform: "gotokyo" },
    { url: "https://www.gotokyo.org/en/things-to-do/unique-experiences/index.html", city: "Tokyo", platform: "gotokyo" },
    // Kyoto official
    { url: "https://kyoto.travel/en/thingstodo.html", city: "Kyoto", platform: "kyototravel" },
    // Osaka official
    { url: "https://osaka-info.jp/en/activities/", city: "Osaka", platform: "osakainfo" },
    { url: "https://osaka-info.jp/en/page/experience", city: "Osaka", platform: "osakainfo" },
    // Hokkaido
    { url: "https://en.visit-hokkaido.jp/things-to-do/", city: "Hokkaido", platform: "visithokkaido" },
    { url: "https://en.visit-hokkaido.jp/activities/", city: "Hokkaido", platform: "visithokkaido" },
    // Okinawa
    { url: "https://www.visitokinawa.jp/experiences", city: "Okinawa", platform: "visitokinawa" },
    // Hiroshima
    { url: "https://visithiroshima.net/things_to_do/", city: "Hiroshima", platform: "visithiroshima" },
    // Nara
    { url: "https://www.visitnara.jp/things-to-do/", city: "Nara", platform: "visitnara" },
  ];

  for (const { url, city, platform } of urls) {
    try {
      console.log(`  ${platform}/${city}: ${url.split("//")[1]?.split("/").slice(1).join("/")}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 }).catch(() =>
        page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
      );
      await delay(3000);
      await scrollPage(page, 12);

      const items = await page.evaluate((c: string, p: string) => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll('a, [class*="card"], [class*="item"], [class*="spot"], article').forEach((el) => {
          const link = el.closest("a") || el.querySelector("a");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href || href === "#") return;
          const img = el.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || img?.getAttribute("data-lazy-src") || "";
          if (!imgSrc || imgSrc.includes("logo") || imgSrc.includes("icon") || imgSrc.includes("svg") || imgSrc.length < 10) return;
          let title = el.querySelector("h2, h3, h4, [class*='title'], [class*='name'], .ttl")?.textContent?.trim() || img?.getAttribute("alt") || "";
          if (!title || title.length < 5) return;
          // Skip nav/footer links
          if (title.toLowerCase().includes("menu") || title.toLowerCase().includes("privacy") || title.toLowerCase().includes("cookie")) return;
          seen.add(href);
          const base = window.location.origin;
          found.push({ title: title.slice(0, 200), url: href.startsWith("http") ? href : `${base}${href.startsWith("/") ? "" : "/"}${href}`, image: imgSrc.startsWith("http") ? imgSrc : `${base}${imgSrc.startsWith("/") ? "" : "/"}${imgSrc}`, price: "", priceNum: 0, currency: "USD", rating: "", reviewCount: "", city: c, platform: p, description: "" });
        });
        return found;
      }, city, platform);
      console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 80)}`);
    }
    await delay(2000 + Math.random() * 2000);
  }
  await page.close();
  return results;
}

// ============ Experiences Japan / Japan-Experience / Voyagin alternatives ============
async function scrapeExtraJapanSites(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n🔮 Extra Japan travel sites");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    // Japan Experience (tour operator)
    { url: "https://www.japan-experience.com/tours-activities", city: "Various", platform: "japanexperience" },
    { url: "https://www.japan-experience.com/tours-activities/tokyo", city: "Tokyo", platform: "japanexperience" },
    { url: "https://www.japan-experience.com/tours-activities/kyoto", city: "Kyoto", platform: "japanexperience" },
    // Tokyo Localized
    { url: "https://www.tokyolocalized.com/tours", city: "Tokyo", platform: "tokyolocalized" },
    { url: "https://www.tokyolocalized.com/", city: "Tokyo", platform: "tokyolocalized" },
    // Inside Japan Tours
    { url: "https://www.insidejapantours.com/japan-experiences/", city: "Various", platform: "insidejapan" },
    // Arigato Japan
    { url: "https://arigatojapan.co.jp/", city: "Various", platform: "arigatojapan" },
    { url: "https://arigatojapan.co.jp/tokyo-food-tours/", city: "Tokyo", platform: "arigatojapan" },
    { url: "https://arigatojapan.co.jp/kyoto-food-tours/", city: "Kyoto", platform: "arigatojapan" },
    // Ninja Food Tours
    { url: "https://ninjafoodtours.com/", city: "Various", platform: "ninjafoodtours" },
    { url: "https://ninjafoodtours.com/tokyo/", city: "Tokyo", platform: "ninjafoodtours" },
    { url: "https://ninjafoodtours.com/kyoto/", city: "Kyoto", platform: "ninjafoodtours" },
    { url: "https://ninjafoodtours.com/osaka/", city: "Osaka", platform: "ninjafoodtours" },
    // Tokyo FooDrink Tour
    { url: "https://tokyofoodtour.com/", city: "Tokyo", platform: "tokyofoodtour" },
    // Backstreet Guides
    { url: "https://www.backstreetguides.com/", city: "Various", platform: "backstreetguides" },
    // Walk Japan
    { url: "https://www.walkjapan.com/tours", city: "Various", platform: "walkjapan" },
  ];

  for (const { url, city, platform } of urls) {
    try {
      console.log(`  ${platform}/${city}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 }).catch(() =>
        page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 })
      );
      await delay(2500);
      await scrollPage(page, 10);

      const items = await page.evaluate((c: string, p: string) => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll('a, [class*="card"], [class*="tour"], [class*="product"], article').forEach((el) => {
          const link = el.closest("a") || el.querySelector("a");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href || href === "/" || href === "#") return;
          const img = el.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
          if (!imgSrc || imgSrc.includes("logo") || imgSrc.includes("icon") || imgSrc.includes("svg") || imgSrc.length < 10) return;
          let title = el.querySelector("h2, h3, h4, [class*='title'], [class*='name']")?.textContent?.trim() || img?.getAttribute("alt") || "";
          if (!title || title.length < 5) return;
          if (title.toLowerCase().includes("menu") || title.toLowerCase().includes("cookie") || title.toLowerCase().includes("privacy") || title.toLowerCase().includes("about us")) return;
          const text = el.textContent || "";
          let priceNum = 0;
          const usdM = text.match(/(?:\$|USD|US\$)\s*(\d+(?:\.\d{2})?)/i);
          const jpyM = text.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
          const eurM = text.match(/€\s*(\d+)/);
          const gbpM = text.match(/£\s*(\d+)/);
          if (usdM) priceNum = parseFloat(usdM[1]);
          else if (jpyM) priceNum = Math.round(parseInt(jpyM[1].replace(/,/g, "")) / 155);
          else if (eurM) priceNum = Math.round(parseInt(eurM[1]) * 1.08);
          else if (gbpM) priceNum = Math.round(parseInt(gbpM[1]) * 1.27);
          const ratingM = text.match(/(\d\.\d)\s*(?:\/|star|★)/i);
          seen.add(href);
          const base = window.location.origin;
          found.push({ title: title.slice(0, 200), url: href.startsWith("http") ? href : `${base}${href.startsWith("/") ? "" : "/"}${href}`, image: imgSrc.startsWith("http") ? imgSrc : `${base}${imgSrc.startsWith("/") ? "" : "/"}${imgSrc}`, price: priceNum > 0 ? `$${priceNum}` : "", priceNum, currency: "USD", rating: ratingM ? ratingM[1] : "", reviewCount: "", city: c, platform: p, description: "" });
        });
        return found;
      }, city, platform);
      console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 80)}`);
    }
    await delay(2000 + Math.random() * 2000);
  }
  await page.close();
  return results;
}

// ============ Activity Japan (リトライ - モバイル版) ============
async function scrapeActivityJapanMobile(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n📱 Activity Japan (モバイル版リトライ)");
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1");
  await page.setViewport({ width: 390, height: 844, isMobile: true });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://activityjapan.com/search/?area_id=1", city: "Tokyo" },
    { url: "https://activityjapan.com/search/?area_id=7", city: "Kyoto" },
    { url: "https://activityjapan.com/search/?area_id=8", city: "Osaka" },
    { url: "https://activityjapan.com/feature/hokkaido/", city: "Hokkaido" },
    { url: "https://activityjapan.com/feature/okinawa/", city: "Okinawa" },
    { url: "https://en.activityjapan.com/", city: "Various" },
    { url: "https://en.activityjapan.com/search/?area_id=1", city: "Tokyo" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  ${city}: ${url.split("activityjapan.com")[1]}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 }).catch(() =>
        page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
      );
      await delay(3000);
      await scrollPage(page, 15, 400);

      const items = await page.evaluate((c: string) => {
        const found: any[] = [];
        const seen = new Set<string>();
        document.querySelectorAll('a, [class*="plan"], [class*="card"], [class*="item"], article').forEach((el) => {
          const link = el.closest("a") || el.querySelector("a");
          if (!link) return;
          const href = link.getAttribute("href") || "";
          if (seen.has(href) || !href || href === "/") return;
          const img = el.querySelector("img");
          const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
          if (!imgSrc || imgSrc.includes("logo") || imgSrc.includes("icon")) return;
          let title = el.querySelector("h2, h3, h4, [class*='title'], [class*='name']")?.textContent?.trim() || img?.getAttribute("alt") || "";
          if (!title || title.length < 5) return;
          const text = el.textContent || "";
          const priceM = text.match(/(\d{1,3}(?:,\d{3})*)\s*円/) || text.match(/¥\s*(\d{1,3}(?:,\d{3})*)/);
          const priceNum = priceM ? Math.round(parseInt(priceM[1].replace(/,/g, "")) / 155) : 0;
          const ratingM = text.match(/(\d\.\d)/);
          const reviewM = text.match(/(\d+)\s*(?:件|reviews?)/i);
          seen.add(href);
          const base = window.location.origin;
          found.push({ title: title.slice(0, 200), url: href.startsWith("http") ? href : `${base}${href}`, image: imgSrc.startsWith("http") ? imgSrc : `${base}${imgSrc}`, price: priceNum > 0 ? `$${priceNum}` : "", priceNum, currency: "USD", rating: ratingM ? ratingM[1] : "", reviewCount: reviewM ? reviewM[1] : "", city: c, platform: "activityjapan", description: "" });
        });
        return found;
      }, city);
      console.log(`    Found: ${items.length}`);
      results.push(...items);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message?.slice(0, 80)}`);
    }
    await delay(2500 + Math.random() * 2000);
  }
  await page.close();
  return results;
}

// ============ MAIN ============
async function main() {
  console.log("🐻💪 MEGA BATCH SCRAPER - 気合いで全部取る！\n");
  console.log("=".repeat(60));

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });

  const allResults: Record<string, ScrapedItem[]> = {};

  // Run scrapers sequentially to avoid overwhelming
  const scrapers = [
    { name: "WAmazing", fn: scrapeWAmazing },
    { name: "Japanican", fn: scrapeJapanican },
    { name: "Cookly", fn: scrapeCookly },
    { name: "JapanWonderTravel", fn: scrapeJapanWonderTravel },
    { name: "MagicalTrip", fn: scrapeMagicalTrip },
    { name: "AttractiveJapan", fn: scrapeAttractiveJapan },
    { name: "Headout", fn: scrapeHeadout },
    { name: "FunJapan", fn: scrapeFunJapan },
    { name: "RegionalTourism", fn: scrapeRegionalTourism },
    { name: "ExtraJapanSites", fn: scrapeExtraJapanSites },
    { name: "ActivityJapanMobile", fn: scrapeActivityJapanMobile },
  ];

  for (const { name, fn } of scrapers) {
    try {
      console.log(`\n${"=".repeat(60)}`);
      const items = await fn(browser);
      allResults[name] = items;
    } catch (err) {
      console.log(`❌ ${name} completely failed: ${(err as Error).message?.slice(0, 100)}`);
      allResults[name] = [];
    }
  }

  await browser.close();

  // Combine and deduplicate
  const all: ScrapedItem[] = [];
  for (const [name, items] of Object.entries(allResults)) {
    all.push(...items);
  }

  const seenUrls = new Set<string>();
  const unique = all.filter((item) => {
    const key = item.url.replace(/\/$/, "").replace(/^https?:\/\//, "");
    if (seenUrls.has(key)) return false;
    seenUrls.add(key);
    return true;
  });

  // Print summary
  console.log("\n\n" + "=".repeat(60));
  console.log("📊 MEGA BATCH RESULTS:");
  console.log("=".repeat(60));
  for (const [name, items] of Object.entries(allResults)) {
    const icon = items.length > 0 ? "✅" : "❌";
    console.log(`  ${icon} ${name}: ${items.length}`);
  }
  console.log(`\n  📦 Total raw: ${all.length}`);
  console.log(`  🔄 Total unique: ${unique.length}`);
  console.log(`  🖼️  With images: ${unique.filter((i) => i.image).length}`);
  console.log(`  💰 With prices: ${unique.filter((i) => i.priceNum > 0).length}`);

  // By platform breakdown
  const byPlatform: Record<string, number> = {};
  unique.forEach((i) => {
    byPlatform[i.platform] = (byPlatform[i.platform] || 0) + 1;
  });
  console.log("\n  📋 By platform:");
  Object.entries(byPlatform)
    .sort((a, b) => b[1] - a[1])
    .forEach(([p, c]) => console.log(`    ${p}: ${c}`));

  // By city breakdown
  const byCity: Record<string, number> = {};
  unique.forEach((i) => {
    byCity[i.city] = (byCity[i.city] || 0) + 1;
  });
  console.log("\n  🏙️  By city:");
  Object.entries(byCity)
    .sort((a, b) => b[1] - a[1])
    .forEach(([c, n]) => console.log(`    ${c}: ${n}`));

  if (unique.length > 0) {
    const outputPath = join(process.cwd(), "data", "mega-batch-raw.json");
    writeFileSync(outputPath, JSON.stringify(unique, null, 2));
    console.log(`\n💾 Saved ${unique.length} items to ${outputPath}`);
  }
}

main().catch(console.error);
