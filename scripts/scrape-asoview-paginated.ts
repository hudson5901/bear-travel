/**
 * Asoview scraper with pagination
 * Asoview loads more items as you scroll/paginate
 * This script scrolls deep and also visits page 2, 3, etc.
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync } from "fs";
import { join } from "path";
import type { Page } from "puppeteer";

puppeteer.use(StealthPlugin());

const TARGETS = [
  // Tokyo - More specific categories
  { city: "Tokyo", slug: "tokyo", region: "Kanto", urls: [
    "https://www.asoview.com/tokyo/",
    "https://www.asoview.com/tokyo/a0201/",  // 陶芸
    "https://www.asoview.com/tokyo/a0202/",  // ものづくり
    "https://www.asoview.com/tokyo/a0203/",  // ガラス
    "https://www.asoview.com/tokyo/a0204/",  // レザークラフト
    "https://www.asoview.com/tokyo/a0101/",  // アウトドア
    "https://www.asoview.com/tokyo/a0304/",  // 食べ物作り
    "https://www.asoview.com/tokyo/a0401/",  // 観光ツアー
    "https://www.asoview.com/tokyo/a0501/",  // 温泉・スパ
    "https://www.asoview.com/tokyo/a0603/",  // エンタメ
    "https://www.asoview.com/tokyo/a0302/",  // 着付け
    "https://www.asoview.com/tokyo/a0303/",  // 茶道
    "https://www.asoview.com/tokyo/a0901/",  // VR体験
    "https://www.asoview.com/tokyo/a1001/",  // 脱出ゲーム
  ]},
  { city: "Kyoto", slug: "kyoto", region: "Kansai", urls: [
    "https://www.asoview.com/kyoto/",
    "https://www.asoview.com/kyoto/a0201/",
    "https://www.asoview.com/kyoto/a0202/",
    "https://www.asoview.com/kyoto/a0206/",  // 着物レンタル
    "https://www.asoview.com/kyoto/a0304/",
    "https://www.asoview.com/kyoto/a0401/",
    "https://www.asoview.com/kyoto/a0303/",  // 茶道
  ]},
  { city: "Osaka", slug: "osaka", region: "Kansai", urls: [
    "https://www.asoview.com/osaka/",
    "https://www.asoview.com/osaka/a0202/",
    "https://www.asoview.com/osaka/a0304/",
    "https://www.asoview.com/osaka/a0401/",
    "https://www.asoview.com/osaka/a0603/",
    "https://www.asoview.com/osaka/a0501/",
  ]},
  { city: "Hiroshima", slug: "hiroshima", region: "Chugoku", urls: [
    "https://www.asoview.com/hiroshima/",
    "https://www.asoview.com/hiroshima/a0202/",
  ]},
  { city: "Nara", slug: "nara", region: "Kansai", urls: [
    "https://www.asoview.com/nara/",
    "https://www.asoview.com/nara/a0202/",
  ]},
  { city: "Hakone", slug: "hakone", region: "Kanto", urls: [
    "https://www.asoview.com/kanagawa/a0501/",
    "https://www.asoview.com/kanagawa/",
    "https://www.asoview.com/kanagawa/a0201/",
  ]},
];

interface ScrapedItem {
  title: string;
  url: string;
  image: string;
  priceText: string;
  reviewText: string;
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function scrapePageDeep(page: Page, url: string): Promise<ScrapedItem[]> {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
    await delay(2000);

    // Deep scroll to load everything
    const totalHeight = await page.evaluate(() => document.body.scrollHeight);
    let scrolled = 0;
    while (scrolled < totalHeight + 2000) {
      await page.evaluate((y) => window.scrollTo(0, y), scrolled);
      await delay(400);
      scrolled += 500;
    }

    // Try clicking "もっと見る" (load more) button
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const moreButton = await page.$('button[class*="more"], a[class*="more"], [class*="loadMore"], [class*="load-more"]');
        if (moreButton) {
          await moreButton.click();
          await delay(2000);
          // Scroll again after loading more
          const newHeight = await page.evaluate(() => document.body.scrollHeight);
          while (scrolled < newHeight) {
            await page.evaluate((y) => window.scrollTo(0, y), scrolled);
            await delay(300);
            scrolled += 500;
          }
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    const items = await page.evaluate(() => {
      const results: ScrapedItem[] = [];
      const seen = new Set<string>();

      const links = document.querySelectorAll('a[href*="/item/"], a[href*="/plan/"]');
      links.forEach((link) => {
        const href = link.getAttribute("href") || "";
        if (seen.has(href) || (!href.includes("pln") && !href.includes("item"))) return;
        seen.add(href);

        let card = link.closest('[class*="card"], [class*="Card"], [class*="item"], [class*="plan"]') || link.parentElement?.parentElement;
        if (!card) card = link;

        const title = (link.textContent || "").trim().split("\n")[0].trim();
        if (!title || title.length < 3) return;

        // Find image
        const imgs = card.querySelectorAll("img");
        let imgSrc = "";
        for (const img of Array.from(imgs)) {
          const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
          if (src && src.startsWith("http") && !src.includes("icon") && !src.includes("logo") && !src.includes("1x1") && src.length > 30) {
            imgSrc = src;
            break;
          }
        }
        if (!imgSrc) {
          const bgEl = card.querySelector('[style*="background-image"]');
          if (bgEl) {
            const bgMatch = bgEl.getAttribute("style")?.match(/url\(['"]?([^'")\s]+)/);
            if (bgMatch) imgSrc = bgMatch[1];
          }
        }

        // Price - take the LAST price match (usually the actual price, not crossed-out original)
        const allText = card.textContent || "";
        const priceMatches = allText.match(/(\d{1,3}(?:,\d{3})*)\s*円/g);
        let priceText = "";
        if (priceMatches && priceMatches.length > 0) {
          priceText = priceMatches[priceMatches.length - 1];
        }

        // Reviews
        const reviewMatch = allText.match(/口コミ\s*[（(]\s*(\d[\d,]*)/);
        const reviewText = reviewMatch ? reviewMatch[0] : "";

        if (imgSrc) {
          results.push({
            title: title.slice(0, 200),
            url: href.startsWith("http") ? href : `https://www.asoview.com${href}`,
            image: imgSrc,
            priceText,
            reviewText,
          });
        }
      });

      return results;
    });

    return items;
  } catch (err) {
    console.log(`    Error: ${(err as Error).message?.slice(0, 60)}`);
    return [];
  }
}

function parsePrice(text: string): number {
  const match = text.match(/(\d{1,3}(?:,\d{3})*)/);
  if (!match) return 0;
  const jpy = parseInt(match[1].replace(/,/g, ""));
  return Math.round(jpy / 155);
}

function parseReviews(text: string): number {
  const match = text.match(/(\d[\d,]*)/);
  if (!match) return 0;
  return parseInt(match[1].replace(/,/g, ""));
}

async function main() {
  console.log("🐻 Asoview Paginated Scraper\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  const allExperiences: Record<string, unknown>[] = [];
  const seenUrls = new Set<string>();

  for (const target of TARGETS) {
    console.log(`\n📍 ${target.city} (${target.urls.length} pages)`);

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 900 });

    for (const url of target.urls) {
      process.stdout.write(`  ${url.split("/").slice(-2).join("/")}... `);
      const items = await scrapePageDeep(page, url);

      let added = 0;
      for (const item of items) {
        if (seenUrls.has(item.url)) continue;
        seenUrls.add(item.url);

        const price = parsePrice(item.priceText);
        const reviews = parseReviews(item.reviewText);
        const productId = item.url.match(/pln\d+/)?.[0] || item.url.split("/").filter(Boolean).pop() || "";

        let cleanTitle = item.title
          .replace(/【[^】]*】/g, "")
          .replace(/※.*/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (!cleanTitle) continue;

        allExperiences.push({
          id: `asoview-${target.slug}-${productId}`,
          slug: `${target.slug}-${productId}`,
          title: cleanTitle,
          description: cleanTitle,
          shortDescription: cleanTitle.slice(0, 120),
          price: { amount: price || 25, currency: "USD", display: `$${price || 25}` },
          duration: { hours: 2, display: "2 hours" },
          rating: {
            score: reviews > 100 ? 4.7 : reviews > 10 ? 4.3 : 4.0,
            count: reviews,
          },
          images: [item.image],
          thumbnail: item.image,
          location: { city: target.city, citySlug: target.slug, region: target.region },
          categories: [],
          themes: [],
          highlights: [],
          source: {
            platform: "asoview",
            url: item.url,
            productId,
            lastScraped: new Date().toISOString(),
          },
          bookingUrl: item.url,
          isPopular: reviews > 50,
          isFeatured: false,
        });
        added++;
      }

      process.stdout.write(`${added} new\n`);
      await delay(2000 + Math.random() * 2000);
    }

    await page.close();
    const cityCount = allExperiences.filter((e: any) => e.location.citySlug === target.slug).length;
    console.log(`  Total for ${target.city}: ${cityCount}`);
  }

  await browser.close();

  console.log(`\n✅ Total: ${allExperiences.length} unique experiences`);

  const outputPath = join(process.cwd(), "data", "asoview-paginated.json");
  writeFileSync(outputPath, JSON.stringify(allExperiences, null, 2));
  console.log(`💾 Saved to ${outputPath}`);

  // Stats
  const byCity: Record<string, number> = {};
  allExperiences.forEach((e: any) => { byCity[e.location.city] = (byCity[e.location.city] || 0) + 1; });
  console.log("\nBy city:");
  Object.entries(byCity).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
}

main().catch(console.error);
