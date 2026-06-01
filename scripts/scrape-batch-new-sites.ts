/**
 * Batch scraper for additional platforms:
 * - byfood.com
 * - airkitchen.me
 * - go-nagano.net
 * - misokengaku.com (hakko-park)
 * - ishiimiso.com
 * - minemurashouten.com
 * - misogura.co.jp
 * - magical-trip.com
 * - veltra.com
 * - activityjapan.com
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync, mkdirSync } from "fs";
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
  region: string;
  platform: string;
  description: string;
  categories: string[];
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function scrollPage(page: Page, times = 10, dist = 600, wait = 400) {
  for (let i = 0; i < times; i++) {
    await page.evaluate((d) => window.scrollBy(0, d), dist);
    await delay(wait);
  }
}

function parseJPY(text: string): number {
  const m =
    text.match(/(\d{1,3}(?:,\d{3})*)\s*円/) ||
    text.match(/[¥￥]\s*(\d{1,3}(?:,\d{3})*)/) ||
    text.match(/(\d{1,3}(?:,\d{3})*)/);
  if (m) return parseInt(m[1].replace(/,/g, ""), 10);
  return 0;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ============ byFood ============
async function scrapeByfood(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n[byFood] Scraping byfood.com/experiences...");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1440, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    "https://www.byfood.com/experiences?location=tokyo",
    "https://www.byfood.com/experiences?location=kyoto",
    "https://www.byfood.com/experiences?location=osaka",
    "https://www.byfood.com/experiences",
  ];

  for (const url of urls) {
    try {
      console.log(`  Fetching: ${url}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
      await delay(2000);
      await scrollPage(page, 12);

      const items = await page.evaluate(() => {
        const found: any[] = [];
        const seen = new Set<string>();
        document
          .querySelectorAll(
            'a[href*="/experiences/"], a[href*="/food-experiences/"], article, [class*="card"], [class*="Card"]'
          )
          .forEach((el) => {
            const link =
              (el as HTMLAnchorElement).href ||
              el.querySelector("a")?.href ||
              "";
            if (!link || seen.has(link) || !link.includes("experience"))
              return;
            seen.add(link);

            const card =
              el.closest("article") ||
              el.closest("[class*='card']") ||
              el.closest("[class*='Card']") ||
              el;
            const title =
              card.querySelector("h2, h3, h4, [class*='title'], [class*='name']")
                ?.textContent?.trim() || "";
            if (!title || title.length < 3) return;

            const priceEl = card.querySelector(
              "[class*='price'], [class*='Price']"
            );
            const price = priceEl?.textContent?.trim() || "";
            const ratingEl = card.querySelector(
              "[class*='rating'], [class*='star']"
            );
            const rating = ratingEl?.textContent?.trim() || "";
            const reviewEl = card.querySelector("[class*='review']");
            const reviewCount = reviewEl?.textContent?.trim() || "";
            const imgEl = card.querySelector("img");
            const image =
              imgEl?.getAttribute("src") ||
              imgEl?.getAttribute("data-src") ||
              "";
            const descEl = card.querySelector("p, [class*='desc']");
            const description = descEl?.textContent?.trim() || "";

            found.push({ title, url: link, price, rating, reviewCount, image, description });
          });
        return found;
      });

      for (const item of items) {
        results.push({
          ...item,
          priceNum: parseJPY(item.price) || 0,
          currency: item.price.includes("$") ? "USD" : "JPY",
          city: url.includes("tokyo")
            ? "Tokyo"
            : url.includes("kyoto")
              ? "Kyoto"
              : url.includes("osaka")
                ? "Osaka"
                : "Various",
          region: "",
          platform: "byfood",
          categories: ["food", "cultural"],
        });
      }
      console.log(`  Found ${items.length} items`);
    } catch (e: any) {
      console.error(`  Error: ${e.message}`);
    }
    await delay(3000 + Math.random() * 2000);
  }

  await page.close();
  return results;
}

// ============ AirKitchen ============
async function scrapeAirKitchen(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n[AirKitchen] Scraping airkitchen.me...");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1440, height: 900 });

  const results: ScrapedItem[] = [];
  const kitchenIds = ["3907", "95", "4320"];
  const searchUrls = [
    "https://airkitchen.me/list/tokyo/",
    "https://airkitchen.me/list/kyoto/",
    "https://airkitchen.me/list/osaka/",
  ];

  // Scrape specific kitchens
  for (const id of kitchenIds) {
    try {
      const url = `https://airkitchen.me/kitchen/${id}`;
      console.log(`  Fetching kitchen: ${url}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2000);

      const item = await page.evaluate((pageUrl: string) => {
        const title =
          document.querySelector("h1, [class*='title']")?.textContent?.trim() ||
          "";
        const priceEl = document.querySelector(
          "[class*='price'], [class*='Price']"
        );
        const price = priceEl?.textContent?.trim() || "";
        const ratingEl = document.querySelector(
          "[class*='rating'], [class*='star'], [class*='score']"
        );
        const rating = ratingEl?.textContent?.trim() || "";
        const reviewEl = document.querySelector("[class*='review']");
        const reviewCount = reviewEl?.textContent?.trim() || "";
        const imgEl = document.querySelector(
          "img[class*='main'], img[class*='hero'], .gallery img, img[class*='photo']"
        );
        const image =
          imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";
        const descEl = document.querySelector(
          "[class*='description'], [class*='about'], .intro, p"
        );
        const description = descEl?.textContent?.trim().slice(0, 300) || "";
        const locationEl = document.querySelector(
          "[class*='location'], [class*='area'], [class*='address']"
        );
        const location = locationEl?.textContent?.trim() || "";

        return { title, url: pageUrl, price, rating, reviewCount, image, description, location };
      }, url);

      if (item.title) {
        const city = item.location.includes("Tokyo")
          ? "Tokyo"
          : item.location.includes("Kyoto")
            ? "Kyoto"
            : item.location.includes("Osaka")
              ? "Osaka"
              : "Various";
        results.push({
          title: item.title,
          url: item.url,
          image: item.image,
          price: item.price,
          priceNum: parseJPY(item.price),
          currency: "JPY",
          rating: item.rating,
          reviewCount: item.reviewCount,
          city,
          region: "",
          platform: "airkitchen",
          description: item.description,
          categories: ["food", "cooking"],
        });
      }
    } catch (e: any) {
      console.error(`  Error kitchen ${id}: ${e.message}`);
    }
    await delay(2000);
  }

  // Scrape listing pages
  for (const url of searchUrls) {
    try {
      console.log(`  Fetching list: ${url}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2000);
      await scrollPage(page, 8);

      const items = await page.evaluate(() => {
        const found: any[] = [];
        const seen = new Set<string>();
        document
          .querySelectorAll('a[href*="/kitchen/"], [class*="card"], [class*="item"]')
          .forEach((el) => {
            const link =
              (el as HTMLAnchorElement).href ||
              el.querySelector("a")?.href ||
              "";
            if (!link || seen.has(link) || !link.includes("kitchen")) return;
            seen.add(link);

            const card = el.closest("[class*='card']") || el.closest("li") || el;
            const title =
              card.querySelector("h2, h3, h4, [class*='title'], [class*='name']")
                ?.textContent?.trim() || "";
            if (!title || title.length < 3) return;

            const priceEl = card.querySelector("[class*='price']");
            const price = priceEl?.textContent?.trim() || "";
            const ratingEl = card.querySelector("[class*='rating'], [class*='star']");
            const rating = ratingEl?.textContent?.trim() || "";
            const imgEl = card.querySelector("img");
            const image = imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";
            const descEl = card.querySelector("p, [class*='desc']");
            const description = descEl?.textContent?.trim() || "";

            found.push({ title, url: link, price, rating, reviewCount: "", image, description });
          });
        return found;
      });

      const city = url.includes("tokyo")
        ? "Tokyo"
        : url.includes("kyoto")
          ? "Kyoto"
          : "Osaka";
      for (const item of items) {
        results.push({
          ...item,
          priceNum: parseJPY(item.price),
          currency: "JPY",
          city,
          region: "",
          platform: "airkitchen",
          categories: ["food", "cooking"],
        });
      }
      console.log(`  Found ${items.length} items`);
    } catch (e: any) {
      console.error(`  Error: ${e.message}`);
    }
    await delay(3000 + Math.random() * 2000);
  }

  await page.close();
  return results;
}

// ============ Miso/Fermentation Sites ============
async function scrapeMisoSites(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n[Miso/Fermentation] Scraping miso-related sites...");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1440, height: 900 });

  const results: ScrapedItem[] = [];
  const sites = [
    {
      url: "https://misokengaku.com/hakko-park",
      platform: "misokengaku",
      title: "Hakko Park - 味噌発酵パーク見学",
      city: "Nagano",
      region: "Chubu",
    },
    {
      url: "https://ishiimiso.com/kengaku",
      platform: "ishiimiso",
      title: "石井味噌 蔵見学体験",
      city: "Nagano",
      region: "Chubu",
    },
    {
      url: "https://minemurashouten.com",
      platform: "minemurashouten",
      title: "峰村商店 味噌蔵見学・味噌作り体験",
      city: "Niigata",
      region: "Chubu",
    },
    {
      url: "https://misogura.co.jp",
      platform: "misogura",
      title: "味噌蔵 見学・味噌作り体験",
      city: "Various",
      region: "Chubu",
    },
  ];

  for (const site of sites) {
    try {
      console.log(`  Fetching: ${site.url}`);
      await page.goto(site.url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2000);
      await scrollPage(page, 5);

      const pageData = await page.evaluate(() => {
        const title =
          document.querySelector("h1, [class*='title'], title")?.textContent?.trim() || "";
        const descEl =
          document.querySelector(
            "meta[name='description']"
          ) as HTMLMetaElement | null;
        const description =
          descEl?.content ||
          document.querySelector("p, [class*='description'], [class*='intro']")
            ?.textContent?.trim().slice(0, 500) ||
          "";
        const imgEl = document.querySelector(
          "img[class*='main'], img[class*='hero'], .visual img, .mv img, header img, img"
        );
        const image =
          imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";
        const priceEl = document.querySelector(
          "[class*='price'], [class*='fee'], [class*='cost']"
        );
        const price = priceEl?.textContent?.trim() || "";

        // Look for sub-pages/experiences
        const subItems: any[] = [];
        document
          .querySelectorAll(
            '[class*="plan"], [class*="course"], [class*="menu"], [class*="experience"], article, section h2, section h3'
          )
          .forEach((el) => {
            const t = el.textContent?.trim() || "";
            if (t.length > 5 && t.length < 200) {
              subItems.push({ title: t });
            }
          });

        return { title, description, image, price, subItems };
      });

      const finalTitle = pageData.title || site.title;
      results.push({
        title: finalTitle,
        url: site.url,
        image: pageData.image.startsWith("http")
          ? pageData.image
          : pageData.image
            ? `${site.url}${pageData.image}`
            : "",
        price: pageData.price || "要問合せ",
        priceNum: parseJPY(pageData.price || ""),
        currency: "JPY",
        rating: "",
        reviewCount: "",
        city: site.city,
        region: site.region,
        platform: site.platform,
        description:
          pageData.description || `${finalTitle} - 味噌・発酵文化体験`,
        categories: ["food", "cultural", "workshop"],
      });

      // Add sub-experiences if found
      for (const sub of pageData.subItems.slice(0, 5)) {
        if (sub.title && sub.title !== finalTitle) {
          results.push({
            title: sub.title,
            url: site.url,
            image: "",
            price: "",
            priceNum: 0,
            currency: "JPY",
            rating: "",
            reviewCount: "",
            city: site.city,
            region: site.region,
            platform: site.platform,
            description: `${sub.title} - ${site.platform}`,
            categories: ["food", "cultural", "workshop"],
          });
        }
      }
      console.log(`  Found data for ${site.platform}`);
    } catch (e: any) {
      console.error(`  Error ${site.platform}: ${e.message}`);
      // Still add manual entry
      results.push({
        title: site.title,
        url: site.url,
        image: "",
        price: "要問合せ",
        priceNum: 0,
        currency: "JPY",
        rating: "",
        reviewCount: "",
        city: site.city,
        region: site.region,
        platform: site.platform,
        description: `${site.title} - 味噌・発酵文化体験`,
        categories: ["food", "cultural", "workshop"],
      });
    }
    await delay(3000 + Math.random() * 2000);
  }

  await page.close();
  return results;
}

// ============ Go-Nagano ============
async function scrapeGoNagano(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n[Go-Nagano] Scraping go-nagano.net...");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1440, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    "https://www.go-nagano.net/theme/experience/",
    "https://www.go-nagano.net/theme/food/",
    "https://www.go-nagano.net/theme/nature/",
    "https://www.go-nagano.net/theme/craft/",
  ];

  for (const url of urls) {
    try {
      console.log(`  Fetching: ${url}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2000);
      await scrollPage(page, 10);

      const items = await page.evaluate(() => {
        const found: any[] = [];
        const seen = new Set<string>();
        document
          .querySelectorAll("a[href], article, [class*='card'], [class*='item'], li")
          .forEach((el) => {
            const link =
              (el as HTMLAnchorElement).href ||
              el.querySelector("a")?.href ||
              "";
            if (!link || seen.has(link) || link === window.location.href) return;
            if (!link.includes("go-nagano.net")) return;
            seen.add(link);

            const card = el.closest("article") || el.closest("[class*='card']") || el.closest("li") || el;
            const title =
              card.querySelector("h2, h3, h4, [class*='title'], [class*='name']")
                ?.textContent?.trim() || "";
            if (!title || title.length < 3 || title.length > 200) return;

            const imgEl = card.querySelector("img");
            const image = imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";
            const descEl = card.querySelector("p, [class*='desc'], [class*='text']");
            const description = descEl?.textContent?.trim() || "";

            found.push({ title, url: link, image, description });
          });
        return found;
      });

      const category = url.includes("food")
        ? "food"
        : url.includes("nature")
          ? "nature"
          : url.includes("craft")
            ? "craft"
            : "experience";

      for (const item of items) {
        results.push({
          title: item.title,
          url: item.url,
          image: item.image,
          price: "",
          priceNum: 0,
          currency: "JPY",
          rating: "",
          reviewCount: "",
          city: "Nagano",
          region: "Chubu",
          platform: "go-nagano",
          description: item.description || `${item.title} - 長野県の体験`,
          categories: [category, "regional"],
        });
      }
      console.log(`  Found ${items.length} items`);
    } catch (e: any) {
      console.error(`  Error: ${e.message}`);
    }
    await delay(3000 + Math.random() * 2000);
  }

  await page.close();
  return results;
}

// ============ Magical Trip ============
async function scrapeMagicalTrip(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n[Magical Trip] Scraping magical-trip.com...");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1440, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://magicaltripjapan.com/tours?city=tokyo", city: "Tokyo" },
    { url: "https://magicaltripjapan.com/tours?city=kyoto", city: "Kyoto" },
    { url: "https://magicaltripjapan.com/tours?city=osaka", city: "Osaka" },
    { url: "https://magicaltripjapan.com/tours", city: "Various" },
  ];

  for (const { url, city } of urls) {
    try {
      console.log(`  Fetching: ${url}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2000);
      await scrollPage(page, 10);

      const items = await page.evaluate(() => {
        const found: any[] = [];
        const seen = new Set<string>();
        document
          .querySelectorAll(
            'a[href*="/tour"], a[href*="/tours/"], article, [class*="card"], [class*="Card"], [class*="tour"]'
          )
          .forEach((el) => {
            const link =
              (el as HTMLAnchorElement).href ||
              el.querySelector("a")?.href ||
              "";
            if (!link || seen.has(link)) return;
            seen.add(link);

            const card =
              el.closest("article") ||
              el.closest("[class*='card']") ||
              el.closest("[class*='Card']") ||
              el;
            const title =
              card.querySelector("h2, h3, h4, [class*='title'], [class*='name']")
                ?.textContent?.trim() || "";
            if (!title || title.length < 3) return;

            const priceEl = card.querySelector("[class*='price'], [class*='Price']");
            const price = priceEl?.textContent?.trim() || "";
            const ratingEl = card.querySelector("[class*='rating'], [class*='star']");
            const rating = ratingEl?.textContent?.trim() || "";
            const reviewEl = card.querySelector("[class*='review']");
            const reviewCount = reviewEl?.textContent?.trim() || "";
            const imgEl = card.querySelector("img");
            const image = imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";
            const descEl = card.querySelector("p, [class*='desc']");
            const description = descEl?.textContent?.trim() || "";

            found.push({ title, url: link, price, rating, reviewCount, image, description });
          });
        return found;
      });

      for (const item of items) {
        results.push({
          ...item,
          priceNum: parseJPY(item.price),
          currency: item.price.includes("$") ? "USD" : "JPY",
          city,
          region: "",
          platform: "magical-trip",
          categories: ["tour", "cultural"],
        });
      }
      console.log(`  Found ${items.length} items`);
    } catch (e: any) {
      console.error(`  Error: ${e.message}`);
    }
    await delay(3000 + Math.random() * 2000);
  }

  await page.close();
  return results;
}

// ============ Veltra ============
async function scrapeVeltra(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n[Veltra] Scraping veltra.com...");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1440, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://www.veltra.com/en/asia/japan/tokyo/", city: "Tokyo", region: "Kanto" },
    { url: "https://www.veltra.com/en/asia/japan/kyoto/", city: "Kyoto", region: "Kansai" },
    { url: "https://www.veltra.com/en/asia/japan/osaka/", city: "Osaka", region: "Kansai" },
    { url: "https://www.veltra.com/en/asia/japan/hiroshima/", city: "Hiroshima", region: "Chugoku" },
    { url: "https://www.veltra.com/en/asia/japan/hokkaido/", city: "Hokkaido", region: "Hokkaido" },
    { url: "https://www.veltra.com/en/asia/japan/okinawa/", city: "Okinawa", region: "Okinawa" },
  ];

  for (const { url, city, region } of urls) {
    try {
      console.log(`  Fetching: ${city}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2000);
      await scrollPage(page, 12);

      const items = await page.evaluate(() => {
        const found: any[] = [];
        const seen = new Set<string>();
        document
          .querySelectorAll(
            'a[href*="/a/"], a[href*="/activity/"], article, [class*="card"], [class*="productCard"], [class*="activityCard"]'
          )
          .forEach((el) => {
            const link =
              (el as HTMLAnchorElement).href ||
              el.querySelector("a")?.href ||
              "";
            if (!link || seen.has(link)) return;
            seen.add(link);

            const card =
              el.closest("article") ||
              el.closest("[class*='card']") ||
              el.closest("[class*='Card']") ||
              el.closest("li") ||
              el;
            const title =
              card.querySelector("h2, h3, h4, [class*='title'], [class*='name'], [class*='productName']")
                ?.textContent?.trim() || "";
            if (!title || title.length < 5) return;

            const priceEl = card.querySelector(
              "[class*='price'], [class*='Price'], [class*='cost']"
            );
            const price = priceEl?.textContent?.trim() || "";
            const ratingEl = card.querySelector(
              "[class*='rating'], [class*='star'], [class*='score']"
            );
            const rating = ratingEl?.textContent?.trim() || "";
            const reviewEl = card.querySelector(
              "[class*='review'], [class*='count']"
            );
            const reviewCount = reviewEl?.textContent?.trim() || "";
            const imgEl = card.querySelector("img");
            const image =
              imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";
            const descEl = card.querySelector("p, [class*='desc'], [class*='text']");
            const description = descEl?.textContent?.trim() || "";

            found.push({ title, url: link, price, rating, reviewCount, image, description });
          });
        return found;
      });

      for (const item of items) {
        results.push({
          ...item,
          priceNum: parseJPY(item.price),
          currency: item.price.includes("$") ? "USD" : "JPY",
          city,
          region,
          platform: "veltra",
          categories: ["tour", "experience"],
        });
      }
      console.log(`  Found ${items.length} items`);
    } catch (e: any) {
      console.error(`  Error ${city}: ${e.message}`);
    }
    await delay(3000 + Math.random() * 2000);
  }

  await page.close();
  return results;
}

// ============ Activity Japan ============
async function scrapeActivityJapan(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n[Activity Japan] Scraping activityjapan.com...");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1440, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://activityjapan.com/search/tokyo/", city: "Tokyo", region: "Kanto" },
    { url: "https://activityjapan.com/search/kyoto/", city: "Kyoto", region: "Kansai" },
    { url: "https://activityjapan.com/search/osaka/", city: "Osaka", region: "Kansai" },
    { url: "https://activityjapan.com/search/okinawa/", city: "Okinawa", region: "Okinawa" },
    { url: "https://activityjapan.com/search/hokkaido/", city: "Hokkaido", region: "Hokkaido" },
    { url: "https://activityjapan.com/search/nagano/", city: "Nagano", region: "Chubu" },
  ];

  for (const { url, city, region } of urls) {
    try {
      console.log(`  Fetching: ${city}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2000);
      await scrollPage(page, 12);

      const items = await page.evaluate(() => {
        const found: any[] = [];
        const seen = new Set<string>();
        document
          .querySelectorAll(
            'a[href*="/publish/plan/"], a[href*="/plan/"], article, [class*="card"], [class*="planCard"], [class*="PlanCard"]'
          )
          .forEach((el) => {
            const link =
              (el as HTMLAnchorElement).href ||
              el.querySelector("a")?.href ||
              "";
            if (!link || seen.has(link)) return;
            seen.add(link);

            const card =
              el.closest("article") ||
              el.closest("[class*='card']") ||
              el.closest("[class*='Card']") ||
              el.closest("li") ||
              el;
            const title =
              card.querySelector("h2, h3, h4, [class*='title'], [class*='name'], [class*='planName']")
                ?.textContent?.trim() || "";
            if (!title || title.length < 5) return;

            const priceEl = card.querySelector(
              "[class*='price'], [class*='Price'], [class*='yen']"
            );
            const price = priceEl?.textContent?.trim() || "";
            const ratingEl = card.querySelector(
              "[class*='rating'], [class*='star'], [class*='score']"
            );
            const rating = ratingEl?.textContent?.trim() || "";
            const reviewEl = card.querySelector(
              "[class*='review'], [class*='count'], [class*='kuchikomi']"
            );
            const reviewCount = reviewEl?.textContent?.trim() || "";
            const imgEl = card.querySelector("img");
            const image =
              imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";
            const descEl = card.querySelector("p, [class*='desc'], [class*='text']");
            const description = descEl?.textContent?.trim() || "";

            found.push({ title, url: link, price, rating, reviewCount, image, description });
          });
        return found;
      });

      for (const item of items) {
        results.push({
          ...item,
          priceNum: parseJPY(item.price),
          currency: "JPY",
          city,
          region,
          platform: "activityjapan",
          categories: ["experience"],
        });
      }
      console.log(`  Found ${items.length} items`);
    } catch (e: any) {
      console.error(`  Error ${city}: ${e.message}`);
    }
    await delay(3000 + Math.random() * 2000);
  }

  await page.close();
  return results;
}

// ============ Jalan Experiences ============
async function scrapeJalanExperiences(browser: Browser): Promise<ScrapedItem[]> {
  console.log("\n[Jalan] Scraping jalan.net experiences...");
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1440, height: 900 });

  const results: ScrapedItem[] = [];
  const urls = [
    { url: "https://www.jalan.net/kankou/spt_guide000000210858/activity/", city: "Tokyo", region: "Kanto" },
    { url: "https://www.jalan.net/activity/japan/tokyo/", city: "Tokyo", region: "Kanto" },
    { url: "https://www.jalan.net/activity/japan/kyoto/", city: "Kyoto", region: "Kansai" },
    { url: "https://www.jalan.net/activity/japan/osaka/", city: "Osaka", region: "Kansai" },
    { url: "https://www.jalan.net/activity/japan/nagano/", city: "Nagano", region: "Chubu" },
    { url: "https://www.jalan.net/activity/japan/hokkaido/", city: "Hokkaido", region: "Hokkaido" },
  ];

  for (const { url, city, region } of urls) {
    try {
      console.log(`  Fetching: ${city} - ${url.split("jalan.net")[1]}`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(2000);
      await scrollPage(page, 10);

      const items = await page.evaluate(() => {
        const found: any[] = [];
        const seen = new Set<string>();
        document
          .querySelectorAll(
            'a[href*="/activity/"], a[href*="/plan/"], [class*="card"], [class*="item"], [class*="plan"], article'
          )
          .forEach((el) => {
            const link =
              (el as HTMLAnchorElement).href ||
              el.querySelector("a")?.href ||
              "";
            if (!link || seen.has(link)) return;
            if (!link.includes("jalan.net")) return;
            seen.add(link);

            const card =
              el.closest("article") ||
              el.closest("[class*='card']") ||
              el.closest("[class*='item']") ||
              el.closest("li") ||
              el;
            const title =
              card.querySelector("h2, h3, h4, [class*='title'], [class*='name'], [class*='planName']")
                ?.textContent?.trim() || "";
            if (!title || title.length < 5 || title.length > 200) return;

            const priceEl = card.querySelector("[class*='price'], [class*='yen']");
            const price = priceEl?.textContent?.trim() || "";
            const ratingEl = card.querySelector("[class*='rating'], [class*='star'], [class*='score']");
            const rating = ratingEl?.textContent?.trim() || "";
            const reviewEl = card.querySelector("[class*='review'], [class*='count']");
            const reviewCount = reviewEl?.textContent?.trim() || "";
            const imgEl = card.querySelector("img");
            const image = imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";
            const descEl = card.querySelector("p, [class*='desc'], [class*='text']");
            const description = descEl?.textContent?.trim() || "";

            found.push({ title, url: link, price, rating, reviewCount, image, description });
          });
        return found;
      });

      for (const item of items) {
        results.push({
          ...item,
          priceNum: parseJPY(item.price),
          currency: "JPY",
          city,
          region,
          platform: "jalan",
          categories: ["experience"],
        });
      }
      console.log(`  Found ${items.length} items`);
    } catch (e: any) {
      console.error(`  Error ${city}: ${e.message}`);
    }
    await delay(3000 + Math.random() * 2000);
  }

  await page.close();
  return results;
}

// ============ Main ============
async function main() {
  console.log("=== Bear Travel - New Sites Batch Scraper ===\n");
  console.log("Target platforms: byfood, airkitchen, go-nagano, miso sites,");
  console.log("  magical-trip, veltra, activityjapan, jalan\n");

  mkdirSync(join(process.cwd(), "data"), { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  let allResults: ScrapedItem[] = [];

  try {
    const byfood = await scrapeByfood(browser);
    allResults.push(...byfood);

    const airkitchen = await scrapeAirKitchen(browser);
    allResults.push(...airkitchen);

    const miso = await scrapeMisoSites(browser);
    allResults.push(...miso);

    const goNagano = await scrapeGoNagano(browser);
    allResults.push(...goNagano);

    const magicalTrip = await scrapeMagicalTrip(browser);
    allResults.push(...magicalTrip);

    const veltra = await scrapeVeltra(browser);
    allResults.push(...veltra);

    const activityJapan = await scrapeActivityJapan(browser);
    allResults.push(...activityJapan);

    const jalan = await scrapeJalanExperiences(browser);
    allResults.push(...jalan);
  } finally {
    await browser.close();
  }

  // Deduplicate by URL
  const deduped = Array.from(
    new Map(allResults.map((item) => [item.url, item])).values()
  );

  // Normalize to standard Experience format
  const experiences = deduped
    .filter((item) => item.title && item.title.length >= 3)
    .map((item) => {
      const slug = slugify(item.title);
      if (!slug) return null;

      return {
        id: `${item.platform}-${item.city.toLowerCase()}-${slug}`,
        slug: `${item.city.toLowerCase()}-${slug}`,
        title: item.title,
        description:
          item.description || `${item.title} in ${item.city}, Japan.`,
        shortDescription:
          (item.description || `${item.title} in ${item.city}`).slice(0, 150),
        price: {
          amount: item.priceNum,
          currency: item.currency,
          display: item.priceNum
            ? item.currency === "JPY"
              ? `¥${item.priceNum.toLocaleString()}`
              : `$${item.priceNum}`
            : "Price varies",
        },
        duration: { hours: 2, display: "Varies" },
        rating: {
          score: item.rating ? parseFloat(item.rating.match(/[\d.]+/)?.[0] || "0") : 0,
          count: item.reviewCount
            ? parseInt(item.reviewCount.replace(/[^\d]/g, "") || "0", 10)
            : 0,
        },
        images: item.image ? [item.image] : [],
        thumbnail: item.image || "",
        location: {
          city: item.city,
          citySlug: item.city.toLowerCase(),
          region: item.region || "",
        },
        categories: item.categories,
        themes: [],
        highlights: [],
        source: {
          platform: item.platform,
          url: item.url,
          productId: slug,
          lastScraped: new Date().toISOString(),
        },
        bookingUrl: item.url,
        isPopular: false,
        isFeatured: false,
      };
    })
    .filter(Boolean);

  const outputPath = join(process.cwd(), "data", "batch-new-sites.json");
  writeFileSync(outputPath, JSON.stringify(experiences, null, 2));

  console.log(`\n=== Summary ===`);
  console.log(`Total scraped: ${experiences.length} experiences`);
  console.log(`\nBy platform:`);
  const platforms = new Map<string, number>();
  for (const item of deduped) {
    platforms.set(item.platform, (platforms.get(item.platform) || 0) + 1);
  }
  for (const [platform, count] of platforms) {
    console.log(`  ${platform}: ${count}`);
  }
  console.log(`\nSaved to ${outputPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
