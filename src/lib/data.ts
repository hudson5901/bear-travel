import Database from "better-sqlite3";
import { join } from "path";
import { existsSync } from "fs";
import type { Experience, Destination, Theme, SearchFilters } from "./types";

// Lazy singleton DB connection
let _db: Database.Database | null = null;
function getDb(): Database.Database {
  if (!_db) {
    const dbPath = join(process.cwd(), "data", "bear-tour.db");
    if (!existsSync(dbPath)) {
      throw new Error(`Database not found: ${dbPath}. Run 'tsx scripts/build-final-db.ts' first.`);
    }
    _db = new Database(dbPath, { readonly: true });
    _db.pragma("journal_mode = WAL");
  }
  return _db;
}

// Convert DB row to Experience interface (matching existing frontend contract)
function rowToExperience(row: Record<string, unknown>): Experience {
  return {
    id: String(row.id),
    slug: row.slug as string,
    title: row.title as string,
    description: (row.description as string) || "",
    shortDescription: (row.short_description as string) || "",
    price: {
      amount: (row.min_price as number) || 0,
      currency: (row.currency as string) || "USD",
      display: (row.price_display as string) || "$0",
    },
    duration: {
      hours: ((row.duration_minutes as number) || 120) / 60,
      display: (row.duration_text as string) || "2 hours",
    },
    rating: {
      score: (row.avg_rating as number) || 0,
      count: (row.total_review_count as number) || 0,
    },
    images: row.hero_image_url ? [fixImageUrl(row.hero_image_url as string)] : [],
    thumbnail: fixImageUrl(row.hero_image_url as string),
    location: {
      city: (row.dest_name as string) || "",
      citySlug: (row.dest_slug as string) || "",
      region: (row.dest_region as string) || "",
    },
    categories: [],
    themes: row.theme_slugs
      ? (row.theme_slugs as string).split(",").filter(Boolean)
      : [],
    highlights: safeParseJSON(row.highlights as string, []),
    source: {
      platform: (row.platform_slug as string) || "viator",
      url: (row.external_url as string) || "",
      productId: (row.external_id as string) || "",
      lastScraped: (row.last_scraped_at as string) || "",
    },
    bookingUrl: (row.affiliate_url as string) || (row.external_url as string) || "",
    isPopular: Boolean(row.is_popular),
    isFeatured: Boolean(row.is_featured),
  };
}

function fixImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function safeParseJSON<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// Base query for experiences with joins
const EXP_QUERY = `
  SELECT e.*,
         d.name as dest_name, d.slug as dest_slug, d.region as dest_region,
         p.slug as platform_slug,
         l.external_url, l.external_id, l.affiliate_url, l.last_scraped_at,
         GROUP_CONCAT(DISTINCT t.slug) as theme_slugs
  FROM experiences e
  LEFT JOIN destinations d ON d.id = e.destination_id
  LEFT JOIN listings l ON l.experience_id = e.id AND l.is_active = 1
  LEFT JOIN platforms p ON p.id = l.platform_id
  LEFT JOIN experience_themes et ON et.experience_id = e.id
  LEFT JOIN themes t ON t.id = et.theme_id
  WHERE e.status = 'published'
`;

const EXP_GROUP = `GROUP BY e.id`;

export function getSiteStats(): { experienceCount: number; destinationCount: number; avgRating: string; platformCount: number } {
  const db = getDb();
  const exp = db.prepare("SELECT COUNT(*) as cnt FROM experiences WHERE status = 'published'").get() as { cnt: number };
  const dest = db.prepare("SELECT COUNT(*) as cnt FROM destinations").get() as { cnt: number };
  const rating = db.prepare("SELECT ROUND(AVG(avg_rating), 1) as avg FROM experiences WHERE status = 'published' AND avg_rating > 0").get() as { avg: number };
  const plat = db.prepare("SELECT COUNT(*) as cnt FROM platforms WHERE is_active = 1").get() as { cnt: number };
  return {
    experienceCount: exp.cnt,
    destinationCount: dest.cnt,
    avgRating: String(rating.avg || 0),
    platformCount: plat.cnt,
  };
}

export function getExperiences(): Experience[] {
  const rows = getDb()
    .prepare(`${EXP_QUERY} ${EXP_GROUP} ORDER BY e.popularity_score DESC`)
    .all() as Record<string, unknown>[];
  return rows.map(rowToExperience);
}

/** Slim version for list pages — strips description/highlights to reduce payload */
export function getExperiencesSlim(): Experience[] {
  return getExperiences().map((e) => ({
    ...e,
    description: "",
    highlights: [],
  }));
}

export function getDestinations(): Destination[] {
  const rows = getDb()
    .prepare(
      `SELECT d.*,
              (SELECT COUNT(*) FROM experiences e WHERE e.destination_id = d.id AND e.status = 'published') as exp_count
       FROM destinations d
       ORDER BY exp_count DESC`
    )
    .all() as Record<string, unknown>[];

  return rows.map((row) => ({
    slug: row.slug as string,
    name: row.name as string,
    nameJa: (row.name_ja as string) || "",
    region: (row.region as string) || "",
    description: (row.description as string) || "",
    image: (row.hero_image_url as string) || "",
    experienceCount: (row.exp_count as number) || 0,
  }));
}

export function getThemes(): Theme[] {
  const rows = getDb()
    .prepare(
      `SELECT t.*,
              (SELECT COUNT(*) FROM experience_themes et WHERE et.theme_id = t.id) as exp_count
       FROM themes t
       ORDER BY t.display_order, exp_count DESC`
    )
    .all() as Record<string, unknown>[];

  return rows.map((row) => ({
    slug: row.slug as string,
    name: row.name as string,
    icon: (row.icon as string) || "Compass",
    description: (row.description as string) || "",
    keywords: safeParseJSON(row.keywords as string, []),
  }));
}

export function getExperienceBySlug(slug: string): Experience | undefined {
  const row = getDb()
    .prepare(`${EXP_QUERY} AND e.slug = ? ${EXP_GROUP}`)
    .get(slug) as Record<string, unknown> | undefined;
  return row ? rowToExperience(row) : undefined;
}

export function getDestinationBySlug(slug: string): Destination | undefined {
  const row = getDb()
    .prepare(
      `SELECT d.*,
              (SELECT COUNT(*) FROM experiences e WHERE e.destination_id = d.id AND e.status = 'published') as exp_count
       FROM destinations d WHERE d.slug = ?`
    )
    .get(slug) as Record<string, unknown> | undefined;

  if (!row) return undefined;
  return {
    slug: row.slug as string,
    name: row.name as string,
    nameJa: (row.name_ja as string) || "",
    region: (row.region as string) || "",
    description: (row.description as string) || "",
    image: (row.hero_image_url as string) || "",
    experienceCount: (row.exp_count as number) || 0,
  };
}

export function getThemeBySlug(slug: string): Theme | undefined {
  const row = getDb()
    .prepare(
      `SELECT t.*,
              (SELECT COUNT(*) FROM experience_themes et WHERE et.theme_id = t.id) as exp_count
       FROM themes t WHERE t.slug = ?`
    )
    .get(slug) as Record<string, unknown> | undefined;

  if (!row) return undefined;
  return {
    slug: row.slug as string,
    name: row.name as string,
    icon: (row.icon as string) || "Compass",
    description: (row.description as string) || "",
    keywords: safeParseJSON(row.keywords as string, []),
  };
}

export function getExperiencesByCity(citySlug: string): Experience[] {
  const rows = getDb()
    .prepare(
      `${EXP_QUERY} AND d.slug = ? ${EXP_GROUP} ORDER BY e.avg_rating DESC`
    )
    .all(citySlug) as Record<string, unknown>[];
  return rows.map(rowToExperience);
}

export function getExperiencesByTheme(themeSlug: string): Experience[] {
  const rows = getDb()
    .prepare(
      `${EXP_QUERY} AND e.id IN (
        SELECT et2.experience_id FROM experience_themes et2
        JOIN themes t2 ON t2.id = et2.theme_id WHERE t2.slug = ?
      ) ${EXP_GROUP} ORDER BY e.avg_rating DESC`
    )
    .all(themeSlug) as Record<string, unknown>[];
  return rows.map(rowToExperience);
}

export function getFeaturedExperiences(): Experience[] {
  const rows = getDb()
    .prepare(
      `${EXP_QUERY} AND e.is_featured = 1 ${EXP_GROUP} ORDER BY e.popularity_score DESC LIMIT 8`
    )
    .all() as Record<string, unknown>[];

  if (rows.length >= 6) return rows.map(rowToExperience);

  // Fallback: top rated
  const fallback = getDb()
    .prepare(
      `${EXP_QUERY} ${EXP_GROUP} ORDER BY e.avg_rating DESC, e.total_review_count DESC LIMIT 8`
    )
    .all() as Record<string, unknown>[];
  return fallback.map(rowToExperience);
}

export function filterExperiences(filters: SearchFilters): Experience[] {
  let where = "AND 1=1";
  const params: unknown[] = [];

  if (filters.query) {
    where += " AND (e.title LIKE ? OR e.description LIKE ? OR d.name LIKE ?)";
    const q = `%${filters.query}%`;
    params.push(q, q, q);
  }

  if (filters.city) {
    where += " AND d.slug = ?";
    params.push(filters.city);
  }

  if (filters.theme) {
    where += ` AND e.id IN (
      SELECT et2.experience_id FROM experience_themes et2
      JOIN themes t2 ON t2.id = et2.theme_id WHERE t2.slug = ?
    )`;
    params.push(filters.theme);
  }

  if (filters.minPrice !== undefined) {
    where += " AND e.min_price >= ?";
    params.push(filters.minPrice);
  }

  if (filters.maxPrice !== undefined) {
    where += " AND e.min_price <= ?";
    params.push(filters.maxPrice);
  }

  if (filters.minRating !== undefined) {
    where += " AND e.avg_rating >= ?";
    params.push(filters.minRating);
  }

  let orderBy = "ORDER BY e.avg_rating DESC";
  switch (filters.sortBy) {
    case "price-asc":
      orderBy = "ORDER BY e.min_price ASC";
      break;
    case "price-desc":
      orderBy = "ORDER BY e.min_price DESC";
      break;
    case "rating":
      orderBy = "ORDER BY e.avg_rating DESC";
      break;
    case "popular":
      orderBy = "ORDER BY e.total_review_count DESC";
      break;
  }

  const rows = getDb()
    .prepare(`${EXP_QUERY} ${where} ${EXP_GROUP} ${orderBy}`)
    .all(...params) as Record<string, unknown>[];

  return rows.map(rowToExperience);
}

// Get all listings for an experience (for price comparison view)
export function getListingsForExperience(
  experienceId: string
): Array<{
  platform: string;
  platformName: string;
  price: number;
  priceDisplay: string;
  rating: number;
  reviewCount: number;
  url: string;
  thumbnailUrl: string;
}> {
  const rows = getDb()
    .prepare(
      `SELECT l.*, p.name as platform_name, p.slug as platform_slug
       FROM listings l
       JOIN platforms p ON p.id = l.platform_id
       WHERE l.experience_id = ? AND l.is_active = 1
       ORDER BY l.price ASC`
    )
    .all(parseInt(experienceId)) as Record<string, unknown>[];

  return rows.map((r) => ({
    platform: r.platform_slug as string,
    platformName: r.platform_name as string,
    price: (r.price as number) || 0,
    priceDisplay: `$${(r.price as number) || 0}`,
    rating: (r.rating as number) || 0,
    reviewCount: (r.review_count as number) || 0,
    url: (r.affiliate_url as string) || (r.external_url as string) || "",
    thumbnailUrl: (r.thumbnail_url as string) || "",
  }));
}
