import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

interface RawExperience {
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
  source: {
    platform: string;
    url: string;
    productId: string;
    lastScraped: string;
  };
  bookingUrl: string;
  isPopular: boolean;
  isFeatured: boolean;
}

interface ThemeConfig {
  slug: string;
  name: string;
  keywords: string[];
}

function loadJSON<T>(filename: string): T {
  const path = join(process.cwd(), "data", filename);
  if (!existsSync(path)) return [] as unknown as T;
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function detectThemes(
  experience: RawExperience,
  themeConfigs: ThemeConfig[]
): string[] {
  const text =
    `${experience.title} ${experience.description} ${experience.categories.join(" ")}`.toLowerCase();
  return themeConfigs
    .filter((theme) => theme.keywords.some((kw) => text.includes(kw)))
    .map((theme) => theme.slug);
}

function deduplicateByTitle(
  experiences: RawExperience[]
): RawExperience[] {
  const seen = new Map<string, RawExperience>();

  for (const exp of experiences) {
    const normalized = exp.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    const existing = seen.get(normalized);

    if (!existing) {
      seen.set(normalized, exp);
    } else {
      // Keep the one with more data (higher review count or better rating)
      if (
        exp.rating.count > existing.rating.count ||
        (exp.rating.score > existing.rating.score &&
          exp.rating.count >= existing.rating.count)
      ) {
        seen.set(normalized, exp);
      }
    }
  }

  return Array.from(seen.values());
}

function main() {
  console.log("🐻 Merging scraped data...\n");

  const viatorData = loadJSON<RawExperience[]>("viator-raw.json");
  const gygData = loadJSON<RawExperience[]>("getyourguide-raw.json");
  const asoviewData = loadJSON<RawExperience[]>("asoview-raw.json");
  const newBatchData = loadJSON<RawExperience[]>("batch-new-sites.json");
  const themes = loadJSON<ThemeConfig[]>("themes.json");

  console.log(`  Viator: ${viatorData.length} experiences`);
  console.log(`  GetYourGuide: ${gygData.length} experiences`);
  console.log(`  Asoview: ${asoviewData.length} experiences`);
  console.log(`  New batch (veltra, activityjapan, byfood, etc): ${newBatchData.length} experiences`);

  const combined = [...viatorData, ...gygData, ...asoviewData, ...newBatchData];
  const deduped = deduplicateByTitle(combined);
  console.log(`  After dedup: ${deduped.length} experiences`);

  // Assign themes
  const enriched = deduped.map((exp) => ({
    ...exp,
    themes: detectThemes(exp, themes),
  }));

  // Mark featured (top-rated from each city)
  const cities = [...new Set(enriched.map((e) => e.location.citySlug))];
  for (const city of cities) {
    const cityExps = enriched
      .filter((e) => e.location.citySlug === city)
      .sort((a, b) => b.rating.score - a.rating.score || b.rating.count - a.rating.count);

    cityExps.slice(0, 2).forEach((e) => {
      const idx = enriched.findIndex((x) => x.id === e.id);
      if (idx >= 0) enriched[idx].isFeatured = true;
    });
  }

  const outputPath = join(process.cwd(), "data", "experiences.json");
  writeFileSync(outputPath, JSON.stringify(enriched, null, 2));
  console.log(`\n✅ Saved ${enriched.length} experiences to ${outputPath}`);

  // Stats
  const withThemes = enriched.filter((e) => e.themes.length > 0);
  const featured = enriched.filter((e) => e.isFeatured);
  const popular = enriched.filter((e) => e.isPopular);
  console.log(`  With themes: ${withThemes.length}`);
  console.log(`  Featured: ${featured.length}`);
  console.log(`  Popular: ${popular.length}`);
}

main();
