/**
 * Quick scraping feasibility test for each platform.
 * Tests if we can actually load pages and extract data.
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

const TARGETS = [
  {
    name: "Viator",
    url: "https://www.viator.com/Tokyo/d334-ttd",
    selectors: ['[data-testid="product-card"]', ".product-card", "article"],
  },
  {
    name: "GetYourGuide",
    url: "https://www.getyourguide.com/tokyo-l196/",
    selectors: ['[data-activity-card-title]', "article", '[class*="ActivityCard"]'],
  },
  {
    name: "Klook",
    url: "https://www.klook.com/en-JP/search/?query=tokyo+tour",
    selectors: ['[data-testid="activity-card"]', '[class*="ActivityCard"]', "article"],
  },
  {
    name: "KKday",
    url: "https://www.kkday.com/en/product/productlist/A01-001-00001?city=Tokyo",
    selectors: ['[class*="product-card"]', "article", '[class*="ProductCard"]'],
  },
  {
    name: "Activity Japan",
    url: "https://activityjapan.com/search/tokyo/",
    selectors: ['[class*="plan-card"]', ".plan-item", "article", '[class*="PlanCard"]'],
  },
  {
    name: "Asoview",
    url: "https://www.asoview.com/tokyo/",
    selectors: ['[class*="plan"]', "article", '[class*="Card"]'],
  },
  {
    name: "Jalan (じゃらん)",
    url: "https://www.jalan.net/kankou/130000/",
    selectors: ['[class*="cassette"]', ".jlnpc-cassette", "article"],
  },
];

async function testScrape(target: (typeof TARGETS)[number]) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1280, height: 800 });

  const result = {
    name: target.name,
    url: target.url,
    status: "unknown" as string,
    httpStatus: 0,
    blocked: false,
    hasContent: false,
    cardCount: 0,
    sampleTitles: [] as string[],
    hasImages: false,
    hasInstagramLink: false,
    instagramLinks: [] as string[],
    error: null as string | null,
    loadTime: 0,
  };

  const start = Date.now();

  try {
    const response = await page.goto(target.url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    result.loadTime = Date.now() - start;
    result.httpStatus = response?.status() || 0;

    // Check for Cloudflare/CAPTCHA blocks
    const pageContent = await page.content();
    const blockedSignals = [
      "cf-challenge",
      "captcha",
      "challenge-running",
      "Access denied",
      "Just a moment",
      "Checking your browser",
      "ray ID",
    ];
    result.blocked = blockedSignals.some((s) =>
      pageContent.toLowerCase().includes(s.toLowerCase())
    );

    if (result.blocked) {
      result.status = "BLOCKED (Cloudflare/CAPTCHA)";
    } else {
      // Try to find content cards
      for (const selector of target.selectors) {
        try {
          const count = await page.$$eval(selector, (els) => els.length);
          if (count > 0) {
            result.cardCount = count;
            result.hasContent = true;

            // Try to get titles
            const titles = await page.$$eval(selector, (els) =>
              els.slice(0, 3).map((el) => {
                const titleEl = el.querySelector("h2, h3, h4, [class*='title'], a");
                return titleEl?.textContent?.trim()?.slice(0, 80) || "";
              })
            );
            result.sampleTitles = titles.filter((t) => t.length > 0);

            // Check for images
            const imgCount = await page.$$eval(
              selector + " img",
              (imgs) => imgs.filter((img) => img.src && img.src.startsWith("http")).length
            );
            result.hasImages = imgCount > 0;

            break;
          }
        } catch {
          // selector didn't match
        }
      }

      // If no specific selectors matched, try generic
      if (!result.hasContent) {
        const genericCards = await page.$$eval("a[href]", (links) =>
          links
            .filter((l) => {
              const img = l.querySelector("img");
              return img && l.textContent && l.textContent.trim().length > 10;
            })
            .slice(0, 5)
            .map((l) => ({
              text: l.textContent?.trim()?.slice(0, 80) || "",
              hasImg: !!l.querySelector("img"),
            }))
        );
        if (genericCards.length > 0) {
          result.hasContent = true;
          result.cardCount = genericCards.length;
          result.sampleTitles = genericCards.map((c) => c.text);
          result.hasImages = genericCards.some((c) => c.hasImg);
        }
      }

      // Search for Instagram links anywhere on page
      const instaLinks = await page.$$eval('a[href*="instagram.com"]', (links) =>
        links.map((l) => l.getAttribute("href") || "").filter((h) => h.includes("instagram.com"))
      );
      result.instagramLinks = [...new Set(instaLinks)];
      result.hasInstagramLink = instaLinks.length > 0;

      result.status = result.hasContent ? "OK" : "NO_CONTENT";
    }
  } catch (err) {
    result.loadTime = Date.now() - start;
    result.status = "ERROR";
    result.error = (err as Error).message?.slice(0, 100) || "Unknown error";
  } finally {
    await browser.close();
  }

  return result;
}

async function main() {
  console.log("🐻 Scraping feasibility test\n");
  console.log("=".repeat(70));

  for (const target of TARGETS) {
    console.log(`\n📍 Testing: ${target.name}`);
    console.log(`   URL: ${target.url}`);

    const result = await testScrape(target);

    const statusEmoji =
      result.status === "OK"
        ? "✅"
        : result.blocked
          ? "🚫"
          : result.status === "ERROR"
            ? "❌"
            : "⚠️";

    console.log(`   ${statusEmoji} Status: ${result.status}`);
    console.log(`   HTTP: ${result.httpStatus} | Load: ${result.loadTime}ms`);
    console.log(`   Blocked: ${result.blocked}`);
    console.log(`   Content found: ${result.hasContent} (${result.cardCount} cards)`);
    console.log(`   Images found: ${result.hasImages}`);
    console.log(`   Instagram links: ${result.instagramLinks.length > 0 ? result.instagramLinks.join(", ") : "none"}`);

    if (result.sampleTitles.length > 0) {
      console.log(`   Sample titles:`);
      result.sampleTitles.forEach((t) => console.log(`     - ${t}`));
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }

    console.log("-".repeat(70));

    // Be polite between requests
    await new Promise((r) => setTimeout(r, 3000));
  }
}

main().catch(console.error);
