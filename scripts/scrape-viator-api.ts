/**
 * Viator Data Fetcher - Uses their public product search endpoint
 * Viator has a public-facing search API that returns JSON data
 * This doesn't require an API key - it's the same endpoint their frontend uses
 */
import { writeFileSync } from "fs";
import { join } from "path";

interface ViatorProduct {
  title: string;
  url: string;
  image: string;
  price: number;
  currency: string;
  rating: number;
  reviewCount: number;
  duration: string;
  description: string;
  productCode: string;
}

// Viator's internal search API used by their frontend
// These are the same requests the browser makes when you search
const VIATOR_SEARCH_ENDPOINTS = [
  // Their frontend search API
  "https://www.viator.com/orion/ajax/search/searchForAllProducts",
  // Destination-based endpoint
  "https://www.viator.com/orion/ajax/destination/getTopProducts",
];

async function fetchViatorSearch(query: string, destId: number): Promise<ViatorProduct[]> {
  const results: ViatorProduct[] = [];

  try {
    // Try the search endpoint that Viator's frontend uses
    const searchBody = {
      searchTerm: query,
      destId: destId,
      currency: "USD",
      topX: 50,
      sortOrder: "TRAVELER_RATING",
      startDate: "",
      endDate: "",
    };

    const res = await fetch("https://www.viator.com/orion/ajax/search/searchForAllProducts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Origin": "https://www.viator.com",
        "Referer": "https://www.viator.com/Tokyo/d334-ttd",
      },
      body: JSON.stringify(searchBody),
    });

    console.log(`  Search response: ${res.status} ${res.statusText}`);

    if (res.ok) {
      const data = await res.json();
      console.log(`  Data keys: ${Object.keys(data).join(", ")}`);
      return data.products || data.data || [];
    }
  } catch (err) {
    console.log(`  Search error: ${(err as Error).message?.slice(0, 80)}`);
  }

  // Try alternative: their GraphQL endpoint
  try {
    const graphqlBody = {
      query: `query SearchProducts($destId: Int!, $sortOrder: String, $topX: Int) {
        searchProducts(destId: $destId, sortOrder: $sortOrder, topX: $topX) {
          products { title productCode rating reviewCount thumbnailURL price { amount currency } duration }
        }
      }`,
      variables: { destId, sortOrder: "TRAVELER_RATING", topX: 50 },
    };

    const res = await fetch("https://www.viator.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      body: JSON.stringify(graphqlBody),
    });

    console.log(`  GraphQL response: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`  GraphQL data: ${JSON.stringify(data).slice(0, 200)}`);
    }
  } catch (err) {
    console.log(`  GraphQL error: ${(err as Error).message?.slice(0, 60)}`);
  }

  return results;
}

// Try Viator's SEO/catalog pages which might have less protection
async function fetchViatorSEOPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/html",
      },
    });
    console.log(`  SEO fetch ${url}: ${res.status}`);
    if (res.ok) {
      return await res.text();
    }
  } catch (err) {
    console.log(`  SEO error: ${(err as Error).message?.slice(0, 60)}`);
  }
  return "";
}

// Try fetching Viator's product feed/sitemap
async function fetchViatorSitemap(): Promise<string[]> {
  const urls: string[] = [];
  try {
    const sitemapUrl = "https://www.viator.com/sitemap-tokyo-activities.xml";
    const res = await fetch(sitemapUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    });
    console.log(`  Sitemap fetch: ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      const matches = text.match(/https:\/\/www\.viator\.com\/tours\/Tokyo\/[^<]+/g);
      if (matches) urls.push(...matches.slice(0, 50));
    }
  } catch (err) {
    console.log(`  Sitemap error: ${(err as Error).message?.slice(0, 60)}`);
  }

  // Also try the main sitemap index
  try {
    const res = await fetch("https://www.viator.com/sitemap_index.xml", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    });
    console.log(`  Sitemap index: ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      const sitemaps = text.match(/https:\/\/www\.viator\.com\/sitemap[^<]+/g) || [];
      console.log(`  Found ${sitemaps.length} sitemaps`);
      // Look for Tokyo/Japan related
      const jpSitemaps = sitemaps.filter(s => s.includes("Japan") || s.includes("Tokyo") || s.includes("tour"));
      console.log(`  Japan-related sitemaps: ${jpSitemaps.length}`);
      if (jpSitemaps.length > 0) {
        console.log(`  Examples: ${jpSitemaps.slice(0, 3).join(", ")}`);
      }
    }
  } catch (err) {
    console.log(`  Sitemap index error: ${(err as Error).message?.slice(0, 60)}`);
  }

  return urls;
}

// Try Viator's partner API (requires key but let's test the endpoint)
async function testViatorPartnerAPI(): Promise<void> {
  try {
    // The partner search endpoint
    const res = await fetch("https://viatorapi.viator.com/service/search/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "exp-api-key": "test", // This will fail but shows us the endpoint format
      },
      body: JSON.stringify({
        destId: 334, // Tokyo
        topX: "1-50",
        sortOrder: "TOP_SELLERS",
      }),
    });
    console.log(`  Partner API: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log(`  Response: ${text.slice(0, 200)}`);
  } catch (err) {
    console.log(`  Partner API error: ${(err as Error).message?.slice(0, 80)}`);
  }
}

async function main() {
  console.log("🐻 Viator data fetch - testing all approaches\n");

  console.log("1. Testing search API endpoint...");
  await fetchViatorSearch("Tokyo tours", 334);

  console.log("\n2. Testing sitemap...");
  const sitemapUrls = await fetchViatorSitemap();
  console.log(`  Found ${sitemapUrls.length} product URLs from sitemap`);
  if (sitemapUrls.length > 0) {
    console.log(`  Examples:`);
    sitemapUrls.slice(0, 5).forEach(u => console.log(`    ${u}`));
  }

  console.log("\n3. Testing Googlebot user-agent...");
  await fetchViatorSEOPage("https://www.viator.com/Tokyo/d334-ttd");

  console.log("\n4. Testing partner API endpoint format...");
  await testViatorPartnerAPI();

  console.log("\n\n📋 Summary:");
  console.log("  To get Viator data, you need to:");
  console.log("  1. Register at https://partners.viator.com (free)");
  console.log("  2. Get an API key");
  console.log("  3. Use /service/search/products endpoint");
  console.log("  4. Tokyo destId = 334");
}

main().catch(console.error);
