/**
 * Clean scraped data and merge all sources into experiences.json
 * Fixes: price parsing, description cleanup, theme tagging, dedup
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

interface RawExp {
  id: string;
  slug: string;
  title: string;
  description: string;
  shortDescription: string;
  price: { amount: number; currency: string; display: string };
  duration: { hours: number; display: string };
  rating: { score: number; count: number };
  images: string[];
  thumbnail: string;
  location: { city: string; citySlug: string; region: string };
  categories: string[];
  themes: string[];
  highlights: string[];
  source: { platform: string; url: string; productId: string; lastScraped: string };
  bookingUrl: string;
  isPopular: boolean;
  isFeatured: boolean;
}

interface ThemeDef {
  slug: string;
  keywords: string[];
}

function loadJSON<T>(file: string): T {
  const p = join(process.cwd(), "data", file);
  if (!existsSync(p)) return [] as unknown as T;
  return JSON.parse(readFileSync(p, "utf-8"));
}

// Fix Asoview price: "4,4003,980円〜" → extract first price (¥3,980)
function fixAsoviewPrice(raw: RawExp): { amount: number; currency: string; display: string } {
  const text = raw.description + " " + raw.shortDescription;

  // Look for prices like "3,980円" or "4,400" - get the last reasonable JPY price
  const matches = text.match(/(\d{1,3}(?:,\d{3})*)\s*円/g);
  if (matches && matches.length > 0) {
    // Take the last match (usually the discounted/current price)
    const lastMatch = matches[matches.length - 1];
    const numStr = lastMatch.replace(/[^\d,]/g, "").replace(/,/g, "");
    const amount = parseInt(numStr);
    if (amount > 0 && amount < 500000) {
      const usd = Math.round(amount / 155);
      return { amount: usd, currency: "USD", display: `$${usd}` };
    }
  }

  // Fallback: try to find any number that looks like a price
  const priceMatch = text.match(/(\d{1,3}(?:,\d{3})+)/g);
  if (priceMatch) {
    for (const m of priceMatch) {
      const num = parseInt(m.replace(/,/g, ""));
      if (num >= 500 && num < 100000) {
        const usd = Math.round(num / 155);
        return { amount: usd, currency: "USD", display: `$${usd}` };
      }
    }
  }

  return { amount: 25, currency: "USD", display: "$25" };
}

// Clean Asoview description (remove price/review noise)
function cleanAsoviewDesc(raw: RawExp): { desc: string; short: string } {
  let title = raw.title
    .replace(/【[^】]*】/g, "") // Remove 【東京・巣鴨・手作りキャンドル】
    .replace(/※.*/g, "")      // Remove ※ notes
    .trim();

  // Extract location from 【】 brackets
  const bracketMatch = raw.title.match(/【([^】]*)】/);
  const location = bracketMatch ? bracketMatch[1] : "";

  const desc = `${title}${location ? `\n\n場所: ${location}` : ""}`;
  const short = title.slice(0, 120);

  return { desc, short };
}

// Clean Jalan data
function cleanJalanData(raw: RawExp): RawExp {
  // Clean title: remove leading numbers and tabs
  let title = raw.title.replace(/^\d+\s*\n?\t*/g, "").trim();

  return {
    ...raw,
    title,
    slug: slugify(`${raw.location.citySlug}-${title}`),
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `item-${Math.random().toString(36).slice(2, 8)}`;
}

function detectThemes(exp: RawExp, themes: ThemeDef[]): string[] {
  const text = `${exp.title} ${exp.description} ${exp.categories.join(" ")}`.toLowerCase();
  return themes
    .filter((t) => t.keywords.some((kw) => text.includes(kw)))
    .map((t) => t.slug);
}

function main() {
  console.log("🐻 Cleaning and merging all data sources...\n");

  const themes = loadJSON<ThemeDef[]>("themes.json");
  const sampleData = loadJSON<RawExp[]>("experiences.json");
  const asoviewRaw = loadJSON<RawExp[]>("asoview-raw.json");
  const jalanRaw = loadJSON<RawExp[]>("jalan-raw.json");

  console.log(`  Sample data: ${sampleData.length}`);
  console.log(`  Asoview raw: ${asoviewRaw.length}`);
  console.log(`  Jalan raw: ${jalanRaw.length}`);

  // Clean Asoview data
  const asoviewCleaned = asoviewRaw.map((raw) => {
    const price = fixAsoviewPrice(raw);
    const { desc, short } = cleanAsoviewDesc(raw);
    const cleaned: RawExp = {
      ...raw,
      description: desc,
      shortDescription: short,
      price,
      rating: {
        score: Math.min(raw.rating.score, 5),
        count: raw.rating.count,
      },
      slug: slugify(`${raw.location.citySlug}-${raw.title.replace(/【[^】]*】/g, "").trim().slice(0, 50)}`),
    };
    cleaned.themes = detectThemes(cleaned, themes);
    return cleaned;
  }).filter((e) => e.title.length > 5 && e.slug.length > 3);

  console.log(`  Asoview cleaned: ${asoviewCleaned.length}`);

  // Clean Jalan data
  const jalanCleaned = jalanRaw
    .map(cleanJalanData)
    .filter((e) => e.title.length > 3 && e.slug.length > 3)
    .map((e) => {
      e.themes = detectThemes(e, themes);
      return e;
    });

  console.log(`  Jalan cleaned: ${jalanCleaned.length}`);

  // Merge all sources
  const all = [...sampleData, ...asoviewCleaned, ...jalanCleaned];

  // Deduplicate by slug
  const seen = new Map<string, RawExp>();
  for (const exp of all) {
    if (!seen.has(exp.slug)) {
      seen.set(exp.slug, exp);
    }
  }
  const deduped = Array.from(seen.values());

  // Mark featured: top 2 per city by review count
  const cities = [...new Set(deduped.map((e) => e.location.citySlug))];
  for (const city of cities) {
    const cityExps = deduped
      .filter((e) => e.location.citySlug === city)
      .sort((a, b) => b.rating.count - a.rating.count);
    cityExps.slice(0, 2).forEach((e) => {
      const idx = deduped.findIndex((x) => x.id === e.id);
      if (idx >= 0) deduped[idx].isFeatured = true;
    });
  }

  // Stats
  const withImages = deduped.filter((e) => e.thumbnail);
  const withPrice = deduped.filter((e) => e.price.amount > 0);
  const featured = deduped.filter((e) => e.isFeatured);
  const byPlatform = new Map<string, number>();
  deduped.forEach((e) => {
    const p = e.source.platform;
    byPlatform.set(p, (byPlatform.get(p) || 0) + 1);
  });
  const byCity = new Map<string, number>();
  deduped.forEach((e) => {
    const c = e.location.city;
    byCity.set(c, (byCity.get(c) || 0) + 1);
  });

  console.log(`\n✅ Final merged: ${deduped.length} experiences`);
  console.log(`  With images: ${withImages.length}`);
  console.log(`  With price: ${withPrice.length}`);
  console.log(`  Featured: ${featured.length}`);
  console.log(`\n  By platform:`);
  byPlatform.forEach((v, k) => console.log(`    ${k}: ${v}`));
  console.log(`\n  By city:`);
  byCity.forEach((v, k) => console.log(`    ${k}: ${v}`));

  const outputPath = join(process.cwd(), "data", "experiences.json");
  writeFileSync(outputPath, JSON.stringify(deduped, null, 2));
  console.log(`\n💾 Saved to ${outputPath}`);
}

main();
