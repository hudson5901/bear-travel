/**
 * Scrape Test v3 - Test 15 new platforms + retry 3 poor-result platforms (18 total)
 * Tests accessibility, tour link counts, image counts, price indicators, and blocking
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { Page } from "puppeteer";

puppeteer.use(StealthPlugin());

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface TestResult {
  name: string;
  url: string;
  status: "SUCCESS" | "PARTIAL" | "BLOCKED" | "NO_DATA" | "ERROR";
  title: string;
  tourLinks: number;
  tourLinkSamples: string[];
  images: number;
  prices: number;
  priceSamples: string[];
  totalLinks: number;
  loadTime: number;
  notes: string;
}

async function testPlatform(
  page: Page,
  name: string,
  url: string
): Promise<TestResult> {
  const startTime = Date.now();
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const httpStatus = response?.status() || 0;
    if (httpStatus === 403 || httpStatus === 503) {
      return {
        name,
        url,
        status: "BLOCKED",
        title: `HTTP ${httpStatus}`,
        tourLinks: 0,
        tourLinkSamples: [],
        images: 0,
        prices: 0,
        priceSamples: [],
        totalLinks: 0,
        loadTime: Date.now() - startTime,
        notes: `HTTP status ${httpStatus}`,
      };
    }

    // Wait for dynamic content
    await delay(4000);

    const title = await page.title();
    const content = await page.content();

    // Check for blocking patterns
    const blockPatterns = [
      "cf-challenge",
      "Just a moment",
      "Checking your browser",
      "captcha",
      "Human Verification",
      "Access Denied",
      "Please verify you are a human",
      "Enable JavaScript and cookies",
      "Attention Required",
      "cf-browser-verification",
    ];

    const isBlocked = blockPatterns.some((p) =>
      content.toLowerCase().includes(p.toLowerCase())
    );
    if (isBlocked) {
      return {
        name,
        url,
        status: "BLOCKED",
        title: title.slice(0, 50),
        tourLinks: 0,
        tourLinkSamples: [],
        images: 0,
        prices: 0,
        priceSamples: [],
        totalLinks: 0,
        loadTime: Date.now() - startTime,
        notes: "Cloudflare/bot protection detected",
      };
    }

    // Scroll to trigger lazy loading
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await delay(400);
    }

    // Wait a bit more for lazy-loaded content
    await delay(2000);

    // Collect stats
    const stats = await page.evaluate(() => {
      // Count all links
      const allLinks = document.querySelectorAll("a[href]");
      const totalLinks = allLinks.length;

      // Tour/activity link keywords
      const tourKeywords = [
        "tour",
        "activity",
        "experience",
        "detail",
        "product",
        "course",
        "plan",
        "ticket",
        "booking",
        "excursion",
        "attraction",
        "things-to-do",
        "taiken",
        "spot",
        "event",
      ];

      const tourLinks: string[] = [];
      allLinks.forEach((link) => {
        const href = (link.getAttribute("href") || "").toLowerCase();
        const text = (link.textContent || "").trim().slice(0, 80);
        if (
          tourKeywords.some((kw) => href.includes(kw)) &&
          href.length > 10 &&
          !href.includes("login") &&
          !href.includes("signup") &&
          !href.includes("privacy") &&
          !href.includes("terms")
        ) {
          const fullHref = link.getAttribute("href") || "";
          if (!tourLinks.includes(fullHref)) {
            tourLinks.push(fullHref);
          }
        }
      });

      // Count meaningful images (not logos/icons)
      const allImages = document.querySelectorAll(
        "img[src], img[data-src], img[data-lazy-src], [style*='background-image']"
      );
      let goodImages = 0;
      Array.from(allImages).forEach((el) => {
        const src =
          el.getAttribute("src") ||
          el.getAttribute("data-src") ||
          el.getAttribute("data-lazy-src") ||
          "";
        const style = el.getAttribute("style") || "";
        const imgUrl = src || style;

        // Filter out logos, icons, tracking pixels
        if (
          imgUrl.length > 20 &&
          !imgUrl.includes("logo") &&
          !imgUrl.includes("icon") &&
          !imgUrl.includes("avatar") &&
          !imgUrl.includes("pixel") &&
          !imgUrl.includes("tracking") &&
          !imgUrl.includes("1x1") &&
          !imgUrl.includes("badge") &&
          !imgUrl.includes("flag")
        ) {
          const width = (el as HTMLImageElement).naturalWidth || parseInt(el.getAttribute("width") || "0");
          const height = (el as HTMLImageElement).naturalHeight || parseInt(el.getAttribute("height") || "0");
          // Skip tiny images (likely icons)
          if ((width === 0 && height === 0) || width > 50 || height > 50) {
            goodImages++;
          }
        }
      });

      // Price detection
      const bodyText = document.body.textContent || "";
      const yenMatches = bodyText.match(
        /(\d{1,3}(?:,\d{3})*)\s*円/g
      ) || [];
      const dollarMatches = bodyText.match(
        /(?:USD\s*)?\$\s*\d+(?:\.\d{2})?/g
      ) || [];
      const euroMatches = bodyText.match(
        /€\s*\d+(?:\.\d{2})?/g
      ) || [];
      const yenSymbolMatches = bodyText.match(
        /¥\s*\d{1,3}(?:,\d{3})*/g
      ) || [];
      const fromPriceMatches = bodyText.match(
        /(?:from|From|FROM)\s*(?:\$|€|¥)\s*\d+/g
      ) || [];

      const allPrices = [
        ...yenMatches,
        ...dollarMatches,
        ...euroMatches,
        ...yenSymbolMatches,
        ...fromPriceMatches,
      ];

      // Deduplicate and get samples
      const uniquePrices = [...new Set(allPrices)].slice(0, 5);

      return {
        totalLinks,
        tourLinks: tourLinks.slice(0, 200),
        tourLinkSamples: tourLinks.slice(0, 5),
        goodImages,
        priceCount: allPrices.length,
        priceSamples: uniquePrices,
      };
    });

    const tourLinkCount = stats.tourLinks.length;
    let status: TestResult["status"];
    if (tourLinkCount >= 10 && stats.goodImages >= 5 && stats.priceCount >= 3) {
      status = "SUCCESS";
    } else if (tourLinkCount >= 3 || (stats.goodImages >= 3 && stats.priceCount >= 1)) {
      status = "PARTIAL";
    } else if (tourLinkCount === 0 && stats.goodImages <= 2 && stats.priceCount === 0) {
      status = "NO_DATA";
    } else {
      status = "PARTIAL";
    }

    return {
      name,
      url,
      status,
      title: title.slice(0, 50),
      tourLinks: tourLinkCount,
      tourLinkSamples: stats.tourLinkSamples,
      images: stats.goodImages,
      prices: stats.priceCount,
      priceSamples: stats.priceSamples,
      totalLinks: stats.totalLinks,
      loadTime: Date.now() - startTime,
      notes: "",
    };
  } catch (err) {
    return {
      name,
      url,
      status: "ERROR",
      title: (err as Error).message?.slice(0, 60) || "Unknown error",
      tourLinks: 0,
      tourLinkSamples: [],
      images: 0,
      prices: 0,
      priceSamples: [],
      totalLinks: 0,
      loadTime: Date.now() - startTime,
      notes: (err as Error).message || "",
    };
  }
}

async function main() {
  console.log("=".repeat(80));
  console.log("  SCRAPE TEST v3 - Platform Accessibility & Data Quality Test");
  console.log("  Testing 15 new platforms + 3 retries = 18 total");
  console.log("=".repeat(80));
  console.log("");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1440, height: 900 });
  await page.setExtraHTTPHeaders({
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, "languages", {
      get: () => ["ja", "en-US", "en"],
    });
  });

  // --- Define all 18 test sites ---
  const sites = [
    // === NEW PLATFORMS (15) ===
    {
      name: "Rakuten Travel Experiences",
      url: "https://experiences.travel.rakuten.co.jp/",
    },
    {
      name: "Helloactivity",
      url: "https://www.helloactivity.com/",
    },
    {
      name: "Civitatis Japan",
      url: "https://www.civitatis.com/en/japan/",
    },
    {
      name: "Headout Japan",
      url: "https://www.headout.com/japan/",
    },
    {
      name: "Musement Japan",
      url: "https://www.musement.com/jp/",
    },
    {
      name: "Tiqets Japan",
      url: "https://www.tiqets.com/en/japan/",
    },
    {
      name: "Peek.com Japan",
      url: "https://www.peek.com/japan",
    },
    {
      name: "Japan Experience",
      url: "https://www.japan-experience.com/",
    },
    {
      name: "Inside Japan Tours",
      url: "https://www.insidejapantours.com/",
    },
    {
      name: "Tabirai Activities",
      url: "https://www.tabirai.net/activity/",
    },
    {
      name: "NAVITIME Travel",
      url: "https://travel.navitime.com/",
    },
    {
      name: "Japan Highlight Travel",
      url: "https://japanhighlighttravel.com/",
    },
    {
      name: "Tokyo Cheapo",
      url: "https://tokyocheapo.com/",
    },
    {
      name: "Tripster Japan",
      url: "https://www.tripster.com/japan/",
    },
    {
      name: "HIS Activities",
      url: "https://activities.his-j.com/",
    },
    // === RETRIES (3) - platforms with poor results previously ===
    {
      name: "Travelko (retry)",
      url: "https://www.tour.ne.jp/j_optional/list/?area=010100",
    },
    {
      name: "MagicalTrip (retry)",
      url: "https://www.magical-trip.com/spot/tokyo/tours",
    },
    {
      name: "DeepExperience (retry)",
      url: "https://www.deep-exp.com/en/tokyo",
    },
  ];

  const results: TestResult[] = [];
  let index = 0;

  for (const site of sites) {
    index++;
    const progress = `[${index}/${sites.length}]`;
    process.stdout.write(
      `\n${progress} Testing: ${site.name.padEnd(28)} (${site.url})\n`
    );
    process.stdout.write(`${"".padEnd(progress.length)} Waiting... `);

    const result = await testPlatform(page, site.name, site.url);

    const statusIcon =
      result.status === "SUCCESS"
        ? "[OK]"
        : result.status === "PARTIAL"
        ? "[PARTIAL]"
        : result.status === "BLOCKED"
        ? "[BLOCKED]"
        : result.status === "NO_DATA"
        ? "[NO DATA]"
        : "[ERROR]";

    console.log(
      `${statusIcon} | Links: ${result.tourLinks} | Imgs: ${result.images} | Prices: ${result.prices} | Total links: ${result.totalLinks} | ${(result.loadTime / 1000).toFixed(1)}s`
    );
    if (result.tourLinkSamples.length > 0) {
      console.log(
        `${"".padEnd(progress.length)} Sample links: ${result.tourLinkSamples.slice(0, 2).join(", ").slice(0, 120)}`
      );
    }
    if (result.priceSamples.length > 0) {
      console.log(
        `${"".padEnd(progress.length)} Price samples: ${result.priceSamples.join(", ")}`
      );
    }

    results.push(result);

    // Random delay between requests (3-6 seconds)
    await delay(3000 + Math.random() * 3000);
  }

  await browser.close();

  // === SUMMARY REPORT ===
  console.log("\n\n" + "=".repeat(80));
  console.log("  RESULTS SUMMARY");
  console.log("=".repeat(80));

  const successful = results.filter((r) => r.status === "SUCCESS");
  const partial = results.filter((r) => r.status === "PARTIAL");
  const blocked = results.filter((r) => r.status === "BLOCKED");
  const noData = results.filter((r) => r.status === "NO_DATA");
  const errors = results.filter((r) => r.status === "ERROR");

  console.log(`\n  SUCCESS (${successful.length}):`);
  successful
    .sort((a, b) => b.tourLinks - a.tourLinks)
    .forEach((r) => {
      console.log(
        `    ${r.name.padEnd(30)} | ${r.tourLinks} tour links | ${r.images} images | ${r.prices} prices`
      );
    });

  console.log(`\n  PARTIAL (${partial.length}):`);
  partial
    .sort((a, b) => b.tourLinks - a.tourLinks)
    .forEach((r) => {
      console.log(
        `    ${r.name.padEnd(30)} | ${r.tourLinks} tour links | ${r.images} images | ${r.prices} prices`
      );
    });

  console.log(`\n  BLOCKED (${blocked.length}):`);
  blocked.forEach((r) => {
    console.log(`    ${r.name.padEnd(30)} | ${r.notes}`);
  });

  console.log(`\n  NO DATA (${noData.length}):`);
  noData.forEach((r) => {
    console.log(`    ${r.name.padEnd(30)} | title: ${r.title}`);
  });

  console.log(`\n  ERROR (${errors.length}):`);
  errors.forEach((r) => {
    console.log(`    ${r.name.padEnd(30)} | ${r.title}`);
  });

  // Scrapeability ranking
  console.log("\n\n" + "-".repeat(80));
  console.log("  SCRAPEABILITY RANKING (best to worst):");
  console.log("-".repeat(80));
  const scrapeable = [...successful, ...partial].sort((a, b) => {
    const scoreA = a.tourLinks * 3 + a.images * 2 + a.prices;
    const scoreB = b.tourLinks * 3 + b.images * 2 + b.prices;
    return scoreB - scoreA;
  });
  scrapeable.forEach((r, i) => {
    const score = r.tourLinks * 3 + r.images * 2 + r.prices;
    console.log(
      `  ${(i + 1).toString().padStart(2)}. ${r.name.padEnd(30)} score:${score.toString().padStart(4)} (links:${r.tourLinks} imgs:${r.images} prices:${r.prices})`
    );
  });

  // Save results
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  const outputPath = join(process.cwd(), "data", "site-test-v3.json");
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n  Results saved to: ${outputPath}`);
  console.log("=".repeat(80));
}

main().catch(console.error);
