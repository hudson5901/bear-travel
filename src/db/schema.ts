import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ==============================
// platforms (データソース)
// ==============================
export const platforms = sqliteTable("platforms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),        // "Viator"
  slug: text("slug").notNull().unique(),         // "viator"
  displayName: text("display_name").notNull(),   // "Viator (TripAdvisor)"
  baseUrl: text("base_url").notNull(),
  logoUrl: text("logo_url"),
  apiType: text("api_type").notNull(),           // "rest_api" | "affiliate" | "scraper"
  commissionRate: real("commission_rate"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

// ==============================
// destinations (目的地 - 階層構造)
// ==============================
export const destinations = sqliteTable("destinations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),                  // "Tokyo"
  nameJa: text("name_ja"),                       // "東京"
  slug: text("slug").notNull().unique(),
  parentId: integer("parent_id"),                // 階層構造 (自己参照)
  level: text("level").notNull(),                // "country" | "region" | "city" | "area"
  country: text("country").default("Japan"),
  region: text("region"),                        // "Kanto"
  latitude: real("latitude"),
  longitude: real("longitude"),
  description: text("description"),
  descriptionJa: text("description_ja"),
  heroImageUrl: text("hero_image_url"),
  thumbnailUrl: text("thumbnail_url"),
  imageCredit: text("image_credit"),
  experienceCount: integer("experience_count").default(0),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

// ==============================
// themes (テーマ)
// ==============================
export const themes = sqliteTable("themes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nameJa: text("name_ja"),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  icon: text("icon"),
  color: text("color"),
  keywords: text("keywords"),                    // JSON array string
  displayOrder: integer("display_order").default(0),
  experienceCount: integer("experience_count").default(0),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

// ==============================
// categories (カテゴリ)
// ==============================
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nameJa: text("name_ja"),
  slug: text("slug").notNull().unique(),
  parentId: integer("parent_id"),
  icon: text("icon"),
  displayOrder: integer("display_order").default(0),
});

// ==============================
// experiences (体験 - メインテーブル)
// ==============================
export const experiences = sqliteTable("experiences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  titleJa: text("title_ja"),
  description: text("description"),
  descriptionJa: text("description_ja"),
  shortDescription: text("short_description"),

  destinationId: integer("destination_id").references(() => destinations.id),

  // ツアー詳細
  durationMinutes: integer("duration_minutes"),
  durationText: text("duration_text"),
  maxGroupSize: integer("max_group_size"),
  minAge: integer("min_age"),
  languages: text("languages"),                  // JSON array
  meetingPoint: text("meeting_point"),

  // コンテンツ
  highlights: text("highlights"),                // JSON array
  includes: text("includes"),                    // JSON array
  excludes: text("excludes"),                    // JSON array

  // 集約価格 (listingsから自動計算)
  minPrice: real("min_price"),
  maxPrice: real("max_price"),
  currency: text("currency").default("USD"),
  priceDisplay: text("price_display"),

  // 集約レビュー (全プラットフォーム統合)
  avgRating: real("avg_rating"),
  totalReviewCount: integer("total_review_count").default(0),

  // 掲載状況
  listingCount: integer("listing_count").default(0),
  platformNames: text("platform_names"),         // JSON array ["Viator", "Asoview"]
  platformSlugs: text("platform_slugs"),         // JSON array

  // 画像
  heroImageUrl: text("hero_image_url"),
  heroImageAlt: text("hero_image_alt"),

  // ステータス
  status: text("status").default("published"),
  isPopular: integer("is_popular", { mode: "boolean" }).default(false),
  isFeatured: integer("is_featured", { mode: "boolean" }).default(false),
  popularityScore: integer("popularity_score").default(0),

  // 詳細フィルター属性
  isPrivateTour: integer("is_private_tour", { mode: "boolean" }),
  isGroupTour: integer("is_group_tour", { mode: "boolean" }),
  hasFoodIncluded: integer("has_food_included", { mode: "boolean" }),
  hasTransport: integer("has_transport", { mode: "boolean" }),
  isWheelchairAccessible: integer("is_wheelchair_accessible", { mode: "boolean" }),
  timeOfDay: text("time_of_day"),                // JSON array
  bestFor: text("best_for"),                     // JSON array
  difficultyLevel: text("difficulty_level"),
  indoorOutdoor: text("indoor_outdoor"),

  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

// ==============================
// listings (掲載情報 - プラットフォームごと)
// ==============================
export const listings = sqliteTable("listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  experienceId: integer("experience_id").references(() => experiences.id).notNull(),
  platformId: integer("platform_id").references(() => platforms.id).notNull(),

  externalId: text("external_id").notNull(),
  externalUrl: text("external_url").notNull(),
  affiliateUrl: text("affiliate_url"),

  title: text("title"),
  description: text("description"),

  // 価格
  price: real("price"),
  originalPrice: real("original_price"),
  currency: text("currency").default("USD"),
  priceType: text("price_type").default("per_person"),
  hasDiscount: integer("has_discount", { mode: "boolean" }).default(false),
  discountPercent: integer("discount_percent"),

  // レビュー
  rating: real("rating"),
  reviewCount: integer("review_count").default(0),

  // 追加情報
  cancellationPolicy: text("cancellation_policy"),
  instantConfirmation: integer("instant_confirmation", { mode: "boolean" }),
  skipTheLine: integer("skip_the_line", { mode: "boolean" }),

  // 画像
  thumbnailUrl: text("thumbnail_url"),
  images: text("images"),                        // JSON array

  // データ鮮度
  lastScrapedAt: text("last_scraped_at"),
  scrapeStatus: text("scrape_status").default("success"),

  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

// ==============================
// reviews (レビュー統合)
// ==============================
export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  experienceId: integer("experience_id").references(() => experiences.id).notNull(),
  listingId: integer("listing_id").references(() => listings.id),
  platformId: integer("platform_id").references(() => platforms.id).notNull(),

  externalReviewId: text("external_review_id"),
  authorName: text("author_name"),
  authorCountry: text("author_country"),
  rating: real("rating").notNull(),
  title: text("title"),
  content: text("content"),

  reviewDate: text("review_date"),
  travelerType: text("traveler_type"),
  verifiedBooking: integer("verified_booking", { mode: "boolean" }).default(false),

  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

// ==============================
// images (画像)
// ==============================
export const images = sqliteTable("images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  experienceId: integer("experience_id").references(() => experiences.id),
  destinationId: integer("destination_id").references(() => destinations.id),
  listingId: integer("listing_id").references(() => listings.id),

  url: text("url").notNull(),
  altText: text("alt_text"),
  width: integer("width"),
  height: integer("height"),

  sourcePlatformId: integer("source_platform_id").references(() => platforms.id),
  photographer: text("photographer"),
  license: text("license"),

  displayOrder: integer("display_order").default(0),
  isHero: integer("is_hero", { mode: "boolean" }).default(false),
  imageType: text("image_type").default("tour"),

  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

// ==============================
// experience_themes (中間テーブル)
// ==============================
export const experienceThemes = sqliteTable("experience_themes", {
  experienceId: integer("experience_id").references(() => experiences.id).notNull(),
  themeId: integer("theme_id").references(() => themes.id).notNull(),
});

// ==============================
// experience_categories (中間テーブル)
// ==============================
export const experienceCategories = sqliteTable("experience_categories", {
  experienceId: integer("experience_id").references(() => experiences.id).notNull(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
});

// ==============================
// price_history (価格履歴)
// ==============================
export const priceHistory = sqliteTable("price_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listingId: integer("listing_id").references(() => listings.id).notNull(),
  price: real("price").notNull(),
  currency: text("currency").default("USD"),
  recordedAt: text("recorded_at").default("CURRENT_TIMESTAMP"),
});

// ==============================
// scrape_logs (スクレイピングログ)
// ==============================
export const scrapeLogs = sqliteTable("scrape_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  platformId: integer("platform_id").references(() => platforms.id).notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  status: text("status").default("running"),
  itemsFound: integer("items_found").default(0),
  itemsNew: integer("items_new").default(0),
  itemsUpdated: integer("items_updated").default(0),
  itemsFailed: integer("items_failed").default(0),
  errorMessage: text("error_message"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});
