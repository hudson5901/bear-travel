# Bear Tour - Database Design (Supabase/PostgreSQL)

## 概要

複数のツアープラットフォームからデータを集約し、一つの統合DBで管理する。
同じツアーが複数サイトに掲載されている場合は、正規化して1つのexperienceに複数のlistingsを紐づける。

## アーキテクチャ

```
┌─────────────────────────────────────────────────┐
│            Next.js 15 Frontend                   │
│  (App Router + Server Components + AI Chat)      │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│              Supabase                            │
│  ┌─────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │PostgREST│ │ Storage  │ │ Edge Functions   │ │
│  │  (API)  │ │ (Images) │ │ (AI/Scrape/Cron) │ │
│  └────┬────┘ └────┬─────┘ └────────┬─────────┘ │
│       │           │                 │           │
│  ┌────▼───────────▼─────────────────▼─────────┐ │
│  │            PostgreSQL                       │ │
│  │  + pg_trgm (fuzzy matching)                │ │
│  │  + pgvector (AI embedding search)          │ │
│  │  + pg_cron (scheduled scraping)            │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
                     ▲
                     │
┌────────────────────┴────────────────────────────┐
│         Data Import Pipeline                     │
│  ┌─────────┐ ┌─────┐ ┌─────┐ ┌──────────────┐ │
│  │ Viator  │ │Klook│ │KKday│ │Activity Japan│ │
│  │   API   │ │ API │ │ API │ │     API      │ │
│  └─────────┘ └─────┘ └─────┘ └──────────────┘ │
│  ┌────────────┐ ┌────────┐ ┌─────────────────┐ │
│  │GetYourGuide│ │Asoview │ │   Jalan         │ │
│  │ (Awin API) │ │  API   │ │ (ValueCommerce) │ │
│  └────────────┘ └────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────┘
```

## テーブル設計

### 1. platforms (プラットフォーム)

データソースの管理。

```sql
CREATE TABLE platforms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,         -- "Viator"
    slug            TEXT NOT NULL UNIQUE,         -- "viator"
    display_name    TEXT NOT NULL,                -- "Viator (TripAdvisor)"
    base_url        TEXT NOT NULL,                -- "https://www.viator.com"
    logo_url        TEXT,
    api_type        TEXT NOT NULL                 -- "rest_api", "affiliate_network", "scraper"
                    CHECK (api_type IN ('rest_api', 'affiliate_network', 'scraper')),
    affiliate_network TEXT,                       -- "awin", "travelpayouts", "valuecommerce"
    commission_rate DECIMAL(5, 2),                -- 8.00 (%)
    is_active       BOOLEAN DEFAULT true,
    config          JSONB DEFAULT '{}',           -- API keys, endpoints, etc (encrypted at app level)
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. destinations (目的地)

階層構造対応（国 > 地域 > 都市 > エリア）

```sql
CREATE TABLE destinations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,                -- "Tokyo"
    name_ja         TEXT,                         -- "東京"
    name_local      TEXT,                         -- alternate local name
    slug            TEXT NOT NULL UNIQUE,         -- "tokyo"

    -- 階層構造
    parent_id       UUID REFERENCES destinations(id),
    level           TEXT NOT NULL                 -- "country", "region", "city", "area"
                    CHECK (level IN ('country', 'region', 'city', 'area')),

    -- 地理情報
    country         TEXT NOT NULL DEFAULT 'Japan',
    country_code    TEXT NOT NULL DEFAULT 'JP',
    region          TEXT,                         -- "Kanto", "Kansai"
    latitude        DECIMAL(10, 7),
    longitude       DECIMAL(10, 7),
    timezone        TEXT DEFAULT 'Asia/Tokyo',

    -- コンテンツ
    description     TEXT,
    description_ja  TEXT,
    short_description TEXT,

    -- 画像
    hero_image_url  TEXT,                         -- Unsplash等から
    thumbnail_url   TEXT,
    images          JSONB DEFAULT '[]',           -- [{url, alt, source, photographer}]

    -- メタデータ
    population      INTEGER,
    best_season     TEXT[],                       -- {"spring", "autumn"}
    highlights      TEXT[],                       -- {"Senso-ji Temple", "Shibuya Crossing"}

    -- 統計 (denormalized)
    experience_count INTEGER DEFAULT 0,
    avg_rating       DECIMAL(3, 2),

    -- SEO
    meta_title      TEXT,
    meta_description TEXT,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_destinations_slug ON destinations(slug);
CREATE INDEX idx_destinations_parent ON destinations(parent_id);
CREATE INDEX idx_destinations_level ON destinations(level);
CREATE INDEX idx_destinations_geo ON destinations USING gist (
    point(longitude, latitude)
);
```

### 3. categories (カテゴリ)

ツアーの大分類。

```sql
CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,                -- "Walking Tours"
    name_ja         TEXT,                         -- "ウォーキングツアー"
    slug            TEXT NOT NULL UNIQUE,
    parent_id       UUID REFERENCES categories(id),
    icon            TEXT,                         -- Lucide icon name
    display_order   INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. themes (テーマ)

ユーザー向けの切り口。

```sql
CREATE TABLE themes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,                -- "Food & Drink"
    name_ja         TEXT,                         -- "グルメ"
    slug            TEXT NOT NULL UNIQUE,
    description     TEXT,
    icon            TEXT,
    color           TEXT,                         -- hex color for UI
    keywords        TEXT[] NOT NULL,              -- theme detection keywords
    display_order   INTEGER DEFAULT 0,
    experience_count INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. experiences (体験 - 正規化されたメインテーブル)

**コア概念**: 1つの「体験」は複数サイトに掲載される可能性がある。
このテーブルは正規化された「真実」を保持する。

```sql
CREATE TABLE experiences (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                TEXT NOT NULL UNIQUE,

    -- 基本情報 (各プラットフォームから最良のものを選択)
    title               TEXT NOT NULL,
    title_ja            TEXT,
    description         TEXT NOT NULL,
    description_ja      TEXT,
    short_description   TEXT,

    -- 目的地
    destination_id      UUID NOT NULL REFERENCES destinations(id),

    -- ツアー詳細
    duration_minutes    INTEGER,
    duration_text       TEXT,                     -- "3-4 hours"
    max_group_size      INTEGER,
    min_age             INTEGER,
    languages           TEXT[] DEFAULT '{"English"}',
    accessibility       TEXT[],
    meeting_point       TEXT,
    meeting_point_geo   JSONB,                   -- {lat, lng, address}

    -- コンテンツ
    highlights          TEXT[],
    includes            TEXT[],
    excludes            TEXT[],
    itinerary           JSONB,                   -- [{time, title, description}]
    faq                 JSONB,                   -- [{question, answer}]

    -- 集約された価格 (listingsから計算)
    min_price           DECIMAL(10, 2),
    max_price           DECIMAL(10, 2),
    currency            TEXT DEFAULT 'USD',
    price_display       TEXT,                    -- "From $45"

    -- 集約されたレビュー (全プラットフォーム統合)
    avg_rating          DECIMAL(3, 2),           -- 加重平均
    total_review_count  INTEGER DEFAULT 0,       -- 全プラットフォーム合計
    rating_breakdown    JSONB,                   -- {5: 120, 4: 80, 3: 20, 2: 5, 1: 2}

    -- 掲載状況 (denormalized for fast access)
    listing_count       INTEGER DEFAULT 0,
    platform_names      TEXT[],                  -- {"Viator", "Klook", "GetYourGuide"}
    platform_slugs      TEXT[],                  -- {"viator", "klook", "getyourguide"}
    best_platform_id    UUID REFERENCES platforms(id), -- 最安or最高評価のプラットフォーム

    -- 画像
    hero_image_url      TEXT,
    hero_image_alt      TEXT,

    -- ステータスとフラグ
    status              TEXT DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published', 'archived', 'flagged')),
    is_popular          BOOLEAN DEFAULT false,
    is_featured         BOOLEAN DEFAULT false,
    is_new              BOOLEAN DEFAULT false,
    popularity_score    INTEGER DEFAULT 0,       -- computed: reviews + bookings + views

    -- 重複排除
    canonical_hash      TEXT,                    -- dedup用ハッシュ
    match_confidence    DECIMAL(3, 2),

    -- AI検索用 embedding
    embedding           vector(1536),            -- OpenAI ada-002 or similar

    -- SEO
    meta_title          TEXT,
    meta_description    TEXT,

    -- タイムスタンプ
    first_seen_at       TIMESTAMPTZ DEFAULT NOW(),
    last_updated_at     TIMESTAMPTZ DEFAULT NOW(),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_experiences_slug ON experiences(slug);
CREATE INDEX idx_experiences_destination ON experiences(destination_id);
CREATE INDEX idx_experiences_status ON experiences(status) WHERE status = 'published';
CREATE INDEX idx_experiences_price ON experiences(min_price);
CREATE INDEX idx_experiences_rating ON experiences(avg_rating DESC NULLS LAST);
CREATE INDEX idx_experiences_popular ON experiences(popularity_score DESC);
CREATE INDEX idx_experiences_hash ON experiences(canonical_hash);
CREATE INDEX idx_experiences_platforms ON experiences USING gin(platform_slugs);

-- AI vector search用
CREATE INDEX idx_experiences_embedding ON experiences
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Full-text search (日本語対応)
CREATE INDEX idx_experiences_fts ON experiences
    USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));
```

### 6. listings (掲載情報 - プラットフォームごと)

**コア概念**: 1つのexperienceに対して複数のlistingが存在する。
「Viatorでは$45、Klookでは$42、GetYourGuideでは$48」のように比較表示。

```sql
CREATE TABLE listings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experience_id       UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
    platform_id         UUID NOT NULL REFERENCES platforms(id),

    -- プラットフォーム固有ID
    external_id         TEXT NOT NULL,           -- プラットフォーム側の商品ID
    external_url        TEXT NOT NULL,           -- 元URL
    affiliate_url       TEXT,                    -- アフィリエイトリンク

    -- プラットフォーム側のコンテンツ
    title               TEXT,                    -- プラットフォーム上のタイトル
    description         TEXT,

    -- 価格
    price               DECIMAL(10, 2),
    original_price      DECIMAL(10, 2),          -- 割引前価格
    currency            TEXT DEFAULT 'USD',
    price_type          TEXT DEFAULT 'per_person'
                        CHECK (price_type IN ('per_person', 'per_group', 'varies')),
    price_note          TEXT,                    -- "From", "Starting at"
    has_discount        BOOLEAN DEFAULT false,
    discount_percent    INTEGER,

    -- レビュー (プラットフォームごと)
    rating              DECIMAL(3, 2),
    review_count        INTEGER DEFAULT 0,

    -- 可用性
    is_available        BOOLEAN DEFAULT true,
    next_available_date DATE,
    available_days      TEXT[],                  -- {"Mon", "Wed", "Fri"}

    -- 追加情報
    cancellation_policy TEXT,                    -- "Free cancellation up to 24h"
    instant_confirmation BOOLEAN DEFAULT false,
    skip_the_line       BOOLEAN DEFAULT false,
    mobile_ticket       BOOLEAN DEFAULT false,
    languages_offered   TEXT[],

    -- 画像 (このプラットフォームの)
    images              JSONB DEFAULT '[]',      -- [{url, alt, width, height}]
    thumbnail_url       TEXT,

    -- データ鮮度
    last_scraped_at     TIMESTAMPTZ,
    last_price_change   TIMESTAMPTZ,
    price_history       JSONB DEFAULT '[]',      -- [{price, date}] 直近30日
    scrape_status       TEXT DEFAULT 'pending'
                        CHECK (scrape_status IN ('pending', 'success', 'error', 'stale')),
    scrape_error        TEXT,

    -- ステータス
    is_active           BOOLEAN DEFAULT true,

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (platform_id, external_id)
);

CREATE INDEX idx_listings_experience ON listings(experience_id);
CREATE INDEX idx_listings_platform ON listings(platform_id);
CREATE INDEX idx_listings_external ON listings(platform_id, external_id);
CREATE INDEX idx_listings_price ON listings(price) WHERE is_active = true;
CREATE INDEX idx_listings_active ON listings(experience_id) WHERE is_active = true;
CREATE INDEX idx_listings_scrape ON listings(scrape_status, last_scraped_at);
```

### 7. reviews (レビュー統合)

各プラットフォームのレビューを集約して保存。

```sql
CREATE TABLE reviews (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experience_id       UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
    listing_id          UUID REFERENCES listings(id) ON DELETE SET NULL,
    platform_id         UUID NOT NULL REFERENCES platforms(id),

    -- レビュー内容
    external_review_id  TEXT,                    -- プラットフォーム上のレビューID
    author_name         TEXT,
    author_country      TEXT,
    rating              DECIMAL(3, 2) NOT NULL,
    title               TEXT,
    content             TEXT,
    content_ja          TEXT,                    -- 翻訳版

    -- メタデータ
    travel_date         DATE,
    review_date         DATE,
    traveler_type       TEXT,                    -- "solo", "couple", "family", "friends"
    verified_booking    BOOLEAN DEFAULT false,

    -- 感情分析 (AI)
    sentiment_score     DECIMAL(3, 2),           -- -1.0 to 1.0
    key_topics          TEXT[],                  -- {"food quality", "guide knowledge"}

    -- AI embedding for semantic search
    embedding           vector(1536),

    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_experience ON reviews(experience_id);
CREATE INDEX idx_reviews_platform ON reviews(platform_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_date ON reviews(review_date DESC);
CREATE INDEX idx_reviews_embedding ON reviews
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
```

### 8. images (画像管理)

```sql
CREATE TABLE images (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 紐付け (experience or destination)
    experience_id   UUID REFERENCES experiences(id) ON DELETE CASCADE,
    destination_id  UUID REFERENCES destinations(id) ON DELETE CASCADE,
    listing_id      UUID REFERENCES listings(id) ON DELETE SET NULL,

    -- 画像データ
    url             TEXT NOT NULL,               -- CDN URL (元サイト or Supabase Storage)
    storage_path    TEXT,                        -- Supabase Storage path (if cached)
    alt_text        TEXT,
    caption         TEXT,
    width           INTEGER,
    height          INTEGER,

    -- ソース情報
    source_platform_id UUID REFERENCES platforms(id),
    source_url      TEXT,                        -- 元のURL
    photographer    TEXT,                        -- Unsplash等の場合
    license         TEXT,                        -- "unsplash", "platform_cdn", "user_upload"

    -- 表示
    display_order   INTEGER DEFAULT 0,
    is_hero         BOOLEAN DEFAULT false,
    image_type      TEXT DEFAULT 'tour'          -- "tour", "destination", "review", "hero"
                    CHECK (image_type IN ('tour', 'destination', 'review', 'hero', 'gallery')),

    created_at      TIMESTAMPTZ DEFAULT NOW(),

    CHECK (experience_id IS NOT NULL OR destination_id IS NOT NULL)
);

CREATE INDEX idx_images_experience ON images(experience_id) WHERE experience_id IS NOT NULL;
CREATE INDEX idx_images_destination ON images(destination_id) WHERE destination_id IS NOT NULL;
```

### 9. experience_categories / experience_themes (中間テーブル)

```sql
CREATE TABLE experience_categories (
    experience_id   UUID REFERENCES experiences(id) ON DELETE CASCADE,
    category_id     UUID REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (experience_id, category_id)
);

CREATE TABLE experience_themes (
    experience_id   UUID REFERENCES experiences(id) ON DELETE CASCADE,
    theme_id        UUID REFERENCES themes(id) ON DELETE CASCADE,
    relevance_score DECIMAL(3, 2) DEFAULT 1.0,  -- AI判定の確信度
    PRIMARY KEY (experience_id, theme_id)
);

CREATE INDEX idx_exp_themes_theme ON experience_themes(theme_id);
CREATE INDEX idx_exp_cats_category ON experience_categories(category_id);
```

### 10. search_filters (詳細フィルター設定)

ユーザーが細かく検索できるようにするための属性テーブル。

```sql
CREATE TABLE experience_attributes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experience_id   UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,

    -- 詳細フィルター用属性
    is_private_tour     BOOLEAN,
    is_group_tour       BOOLEAN,
    is_self_guided      BOOLEAN,
    has_hotel_pickup    BOOLEAN,
    has_food_included   BOOLEAN,
    has_transport       BOOLEAN,
    is_wheelchair_accessible BOOLEAN,
    is_stroller_friendly BOOLEAN,
    is_pet_friendly     BOOLEAN,

    -- 時間帯
    time_of_day         TEXT[]                   -- {"morning", "afternoon", "evening", "night"}
                        ,
    best_for            TEXT[],                  -- {"couples", "families", "solo", "seniors", "kids"}
    difficulty_level    TEXT                     -- "easy", "moderate", "challenging"
                        CHECK (difficulty_level IN ('easy', 'moderate', 'challenging')),

    -- 予約条件
    min_participants    INTEGER,
    max_participants    INTEGER,
    advance_booking_days INTEGER,               -- 何日前までに予約必要

    -- 季節性
    available_months    INTEGER[],              -- {1,2,3,4,5,6,7,8,9,10,11,12}
    weather_dependent   BOOLEAN DEFAULT false,
    indoor_outdoor      TEXT                    -- "indoor", "outdoor", "both"
                        CHECK (indoor_outdoor IN ('indoor', 'outdoor', 'both')),

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exp_attrs_experience ON experience_attributes(experience_id);
```

### 11. ai_conversations (AIチャット検索ログ)

```sql
CREATE TABLE ai_conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      TEXT NOT NULL,              -- anonymous session
    user_id         UUID,                       -- if logged in

    messages        JSONB NOT NULL DEFAULT '[]', -- [{role, content, timestamp}]

    -- 検索コンテキスト
    filters_applied JSONB,                      -- AIが解釈したフィルター
    results_shown   UUID[],                     -- 表示したexperience IDs

    -- メタデータ
    message_count   INTEGER DEFAULT 0,
    destination_context TEXT,                   -- 会話中のdestination

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_session ON ai_conversations(session_id);
```

### 12. price_history (価格履歴)

```sql
CREATE TABLE price_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id      UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    price           DECIMAL(10, 2) NOT NULL,
    original_price  DECIMAL(10, 2),
    currency        TEXT DEFAULT 'USD',
    recorded_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_history_listing ON price_history(listing_id, recorded_at DESC);

-- パーティショニング (大規模データ対応)
-- 月ごとにパーティション可能
```

### 13. scrape_logs (スクレイピング実行ログ)

```sql
CREATE TABLE scrape_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id     UUID NOT NULL REFERENCES platforms(id),

    -- 実行情報
    started_at      TIMESTAMPTZ NOT NULL,
    completed_at    TIMESTAMPTZ,
    status          TEXT DEFAULT 'running'
                    CHECK (status IN ('running', 'completed', 'failed', 'partial')),

    -- 結果
    items_found     INTEGER DEFAULT 0,
    items_new       INTEGER DEFAULT 0,
    items_updated   INTEGER DEFAULT 0,
    items_matched   INTEGER DEFAULT 0,          -- 既存experienceにマッチ
    items_failed    INTEGER DEFAULT 0,

    -- エラー
    error_message   TEXT,
    error_details   JSONB,

    -- 設定
    config          JSONB,                      -- 実行パラメータ

    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 重複排除 (Deduplication) パイプライン

同じツアーが複数プラットフォームに掲載されている場合のマッチングロジック。

```sql
-- pg_trgm拡張 (ファジーマッチング)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- マッチング用関数
CREATE OR REPLACE FUNCTION find_matching_experience(
    p_title TEXT,
    p_destination_id UUID,
    p_duration_minutes INTEGER
) RETURNS TABLE(experience_id UUID, confidence DECIMAL) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        (
            similarity(lower(e.title), lower(p_title)) * 0.6 +
            CASE WHEN e.destination_id = p_destination_id THEN 0.2 ELSE 0 END +
            CASE WHEN ABS(COALESCE(e.duration_minutes, 0) - COALESCE(p_duration_minutes, 0)) < 30
                 THEN 0.2 ELSE 0 END
        )::DECIMAL AS confidence
    FROM experiences e
    WHERE e.destination_id = p_destination_id
      AND similarity(lower(e.title), lower(p_title)) > 0.3
    ORDER BY confidence DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql;
```

## 集約トリガー

listingsが変更されたらexperiencesの集約フィールドを自動更新。

```sql
CREATE OR REPLACE FUNCTION update_experience_aggregates()
RETURNS TRIGGER AS $$
DECLARE
    target_id UUID;
BEGIN
    target_id := COALESCE(NEW.experience_id, OLD.experience_id);

    UPDATE experiences SET
        min_price = (
            SELECT MIN(price) FROM listings
            WHERE experience_id = target_id AND is_active = true
        ),
        max_price = (
            SELECT MAX(price) FROM listings
            WHERE experience_id = target_id AND is_active = true
        ),
        avg_rating = (
            SELECT ROUND(
                SUM(rating * review_count)::NUMERIC / NULLIF(SUM(review_count), 0), 2
            )
            FROM listings
            WHERE experience_id = target_id AND is_active = true AND rating IS NOT NULL
        ),
        total_review_count = (
            SELECT COALESCE(SUM(review_count), 0) FROM listings
            WHERE experience_id = target_id AND is_active = true
        ),
        listing_count = (
            SELECT COUNT(*) FROM listings
            WHERE experience_id = target_id AND is_active = true
        ),
        platform_names = (
            SELECT ARRAY_AGG(DISTINCT p.name ORDER BY p.name)
            FROM listings l JOIN platforms p ON p.id = l.platform_id
            WHERE l.experience_id = target_id AND l.is_active = true
        ),
        platform_slugs = (
            SELECT ARRAY_AGG(DISTINCT p.slug ORDER BY p.slug)
            FROM listings l JOIN platforms p ON p.id = l.platform_id
            WHERE l.experience_id = target_id AND l.is_active = true
        ),
        price_display = (
            SELECT 'From $' || MIN(price)::TEXT
            FROM listings WHERE experience_id = target_id AND is_active = true
        ),
        updated_at = NOW()
    WHERE id = target_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_listing_change
    AFTER INSERT OR UPDATE OR DELETE ON listings
    FOR EACH ROW
    EXECUTE FUNCTION update_experience_aggregates();
```

## AI チャット検索 (競合優位性)

### コンセプト
- ユーザーが自然言語で質問: 「京都で子連れでも楽しめる半日の食べ歩きツアー、予算5000円以内」
- AIがフィルターを解釈し、pgvector + 従来フィルターのハイブリッド検索
- 会話形式で絞り込み可能

### 検索フロー
```
ユーザー入力 → AI (Claude/GPT) → フィルター抽出 + embedding生成
                                        ↓
                              Supabase検索 (hybrid)
                              ├── pgvector類似度検索
                              ├── 従来フィルター (価格, 時間, etc)
                              └── Full-text search
                                        ↓
                              結果をAIが自然言語で説明
```

### 実装例 (RPC関数)
```sql
CREATE OR REPLACE FUNCTION search_experiences_hybrid(
    query_embedding vector(1536),
    filter_destination TEXT DEFAULT NULL,
    filter_min_price DECIMAL DEFAULT NULL,
    filter_max_price DECIMAL DEFAULT NULL,
    filter_min_rating DECIMAL DEFAULT NULL,
    filter_themes TEXT[] DEFAULT NULL,
    filter_duration_max INTEGER DEFAULT NULL,
    filter_best_for TEXT[] DEFAULT NULL,
    filter_time_of_day TEXT[] DEFAULT NULL,
    match_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    slug TEXT,
    description TEXT,
    min_price DECIMAL,
    avg_rating DECIMAL,
    platform_names TEXT[],
    destination_name TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id, e.title, e.slug, e.short_description,
        e.min_price, e.avg_rating, e.platform_names,
        d.name AS destination_name,
        1 - (e.embedding <=> query_embedding) AS similarity
    FROM experiences e
    JOIN destinations d ON d.id = e.destination_id
    LEFT JOIN experience_attributes ea ON ea.experience_id = e.id
    WHERE e.status = 'published'
      AND (filter_destination IS NULL OR d.slug = filter_destination)
      AND (filter_min_price IS NULL OR e.min_price >= filter_min_price)
      AND (filter_max_price IS NULL OR e.min_price <= filter_max_price)
      AND (filter_min_rating IS NULL OR e.avg_rating >= filter_min_rating)
      AND (filter_duration_max IS NULL OR e.duration_minutes <= filter_duration_max)
      AND (filter_themes IS NULL OR EXISTS (
          SELECT 1 FROM experience_themes et
          JOIN themes t ON t.id = et.theme_id
          WHERE et.experience_id = e.id AND t.slug = ANY(filter_themes)
      ))
      AND (filter_best_for IS NULL OR ea.best_for && filter_best_for)
      AND (filter_time_of_day IS NULL OR ea.time_of_day && filter_time_of_day)
    ORDER BY similarity DESC
    LIMIT match_limit;
END;
$$ LANGUAGE plpgsql;
```

## データ規模見積もり

| テーブル | 想定レコード数 | サイズ見積もり |
|---|---|---|
| platforms | ~10 | < 1KB |
| destinations | ~100 (都市+エリア) | < 100KB |
| experiences | ~10,000-50,000 | 50-200MB |
| listings | ~30,000-150,000 (3x experiences) | 100-500MB |
| reviews | ~500,000-2,000,000 | 500MB-2GB |
| images | ~100,000-500,000 | 50-200MB (メタデータのみ) |
| price_history | ~1,000,000+/年 | 200MB+/年 |
| embeddings | ~10,000-50,000 vectors | 100-400MB |

**合計見積もり**: 1-4GB (Pro plan $25/moで8GBまで対応可能)

## マイグレーション戦略

1. Supabase Free tier で開発開始
2. MVP完成後 Pro plan ($25/mo) にアップグレード
3. データ量が8GBを超えたら Team plan ($599/mo) を検討
4. price_historyは古いデータをアーカイブ (Supabase Storage にCSV保存)
