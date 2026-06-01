/**
 * Generate descriptions and highlights for experiences that lack them.
 * Uses title, city, theme, platform info to create natural descriptions.
 */
import Database from "better-sqlite3";
import { join } from "path";

const DB_PATH = join(process.cwd(), "data", "bear-tour.db");

interface ExpRow {
  id: number;
  title: string;
  description: string;
  short_description: string;
  highlights: string;
  avg_rating: number;
  total_review_count: number;
  min_price: number;
  currency: string;
  duration_minutes: number;
  hero_image_url: string;
  dest_name: string;
  dest_region: string;
  platform_slug: string;
  theme_slugs: string;
}

// Theme descriptions for context
const THEME_DESC: Record<string, string> = {
  "food-drink": "culinary and dining",
  "culture-history": "cultural and historical",
  "nature-outdoor": "nature and outdoor",
  "adventure": "adventure and sports",
  "art-entertainment": "arts and creative",
  "nightlife": "evening and nightlife",
};

// Platform display names
const PLATFORM_NAMES: Record<string, string> = {
  jalan: "Jalan",
  asoview: "Asoview",
  veltra: "Veltra",
  tabirai: "Tabirai",
  travelko: "Travelko",
  gowithguide: "GoWithGuide",
  deepexp: "Deep Experience Japan",
  cookly: "Cookly",
  airkitchen: "AirKitchen",
  otonami: "Otonami",
  byfood: "byFood",
  activityjapan: "Activity Japan",
  "go-nagano": "Go Nagano",
  wamazing: "WAmazing",
  his: "H.I.S.",
  headout: "Headout",
  japanwondertravel: "Japan Wonder Travel",
  misokengaku: "Marukome Hakko Park",
  ishiimiso: "Ishii Miso",
  minemurashouten: "Minemura Shouten",
  misogura: "Misogura",
};

// City descriptions
const CITY_CONTEXT: Record<string, string> = {
  Tokyo: "Japan's vibrant capital city",
  Kyoto: "the ancient capital of Japan, known for temples and traditional culture",
  Osaka: "Japan's kitchen and entertainment hub",
  Hiroshima: "a city of peace and history",
  Nara: "home to friendly deer and ancient temples",
  Hakone: "a mountain resort town near Mt. Fuji",
  Nagano: "a mountain prefecture famous for hot springs and traditional crafts",
  Hokkaido: "Japan's northern frontier with stunning nature",
  Okinawa: "Japan's tropical paradise",
  Niigata: "rice country famous for sake and fermentation culture",
  Fukuoka: "Kyushu's gateway city known for ramen and yatai stalls",
  Kamakura: "a coastal city with the Great Buddha and ancient temples",
  Nikko: "a mountain town with ornate shrines and natural beauty",
  Kanazawa: "a historic city with one of Japan's finest gardens",
  Yokohama: "a cosmopolitan port city with Chinatown",
  Kobe: "a port city famous for Kobe beef and harbor views",
};

// Japanese keyword -> English activity type mapping
const ACTIVITY_MAP: [RegExp, string][] = [
  [/陶芸|pottery/i, "pottery making"],
  [/着物|kimono/i, "kimono wearing"],
  [/茶道|tea ceremony|抹茶/i, "tea ceremony"],
  [/書道|calligraphy/i, "calligraphy"],
  [/料理|cooking|クッキング/i, "cooking class"],
  [/寿司|sushi/i, "sushi making"],
  [/ラーメン|ramen/i, "ramen experience"],
  [/温泉|onsen|spa/i, "hot spring (onsen) bathing"],
  [/サイクリング|cycling|自転車/i, "cycling tour"],
  [/ダイビング|diving/i, "scuba diving"],
  [/シュノーケ|snorkel/i, "snorkeling"],
  [/カヤック|kayak/i, "kayaking"],
  [/サーフィン|surfing/i, "surfing"],
  [/ハイキング|hiking|登山/i, "hiking"],
  [/釣り|fishing/i, "fishing"],
  [/ガラス|glass/i, "glasswork"],
  [/アクセサリー|jewelry|silver/i, "jewelry making"],
  [/キャンドル|candle/i, "candle making"],
  [/レジン|resin/i, "resin craft"],
  [/金継ぎ|kintsugi/i, "kintsugi (gold repair)"],
  [/忍者|ninja/i, "ninja experience"],
  [/侍|samurai|sword/i, "samurai experience"],
  [/花見|cherry|sakura|桜/i, "cherry blossom viewing"],
  [/紅葉|autumn|momiji/i, "autumn leaf viewing"],
  [/写真|photo/i, "photography"],
  [/ヨガ|yoga/i, "yoga"],
  [/瞑想|meditation/i, "meditation"],
  [/味噌|miso/i, "miso making"],
  [/醸造|brewery|sake|酒/i, "sake brewery tour"],
  [/食べ歩き|food.*walk|food.*tour/i, "food walking tour"],
  [/ナイト|night.*tour/i, "night tour"],
  [/クルーズ|cruise|boat/i, "boat cruise"],
  [/バス.*ツアー|bus.*tour/i, "bus tour"],
  [/ガイド.*ツアー|guided.*tour/i, "guided tour"],
  [/VR|virtual/i, "VR experience"],
  [/フラワー|flower|華道|ikebana/i, "flower arrangement (ikebana)"],
  [/太鼓|taiko|drum/i, "taiko drumming"],
  [/漫画|manga|anime/i, "manga/anime experience"],
  [/浴衣|yukata/i, "yukata wearing"],
];

function detectActivity(title: string): string | null {
  for (const [regex, activity] of ACTIVITY_MAP) {
    if (regex.test(title)) return activity;
  }
  return null;
}

function generateDescription(row: ExpRow): string {
  const city = row.dest_name || "Japan";
  const cityContext = CITY_CONTEXT[city] || `a beautiful city in ${row.dest_region || "Japan"}`;
  const themes = (row.theme_slugs || "").split(",").filter(Boolean);
  const themeDesc = themes.map((t) => THEME_DESC[t]).filter(Boolean).join(" and ") || "unique";
  const platform = PLATFORM_NAMES[row.platform_slug] || row.platform_slug;
  const activity = detectActivity(row.title);
  const rating = row.avg_rating > 0 ? row.avg_rating.toFixed(1) : null;
  const reviews = row.total_review_count > 0 ? row.total_review_count : null;

  const parts: string[] = [];

  // Opening line
  if (activity) {
    parts.push(`Experience an authentic ${activity} activity in ${city}, ${cityContext}.`);
  } else {
    parts.push(`Discover this ${themeDesc} experience in ${city}, ${cityContext}.`);
  }

  // Rating/review line
  if (rating && reviews) {
    parts.push(`Rated ${rating}/5.0 by ${reviews} travelers, this is one of the top-rated experiences in the area.`);
  } else if (rating) {
    parts.push(`This experience has earned a ${rating}/5.0 rating from visitors.`);
  }

  // Activity-specific detail
  if (activity) {
    const detailMap: Record<string, string> = {
      "pottery making": "Learn traditional Japanese pottery techniques from skilled artisans. Create your own unique piece to take home as a memorable souvenir of your trip.",
      "kimono wearing": "Dress up in a beautiful traditional kimono and stroll through historic streets. Professional staff will help you choose and put on the perfect outfit.",
      "tea ceremony": "Participate in a traditional Japanese tea ceremony (sado). Learn the graceful art of preparing and serving matcha in a serene setting.",
      "cooking class": "Learn to prepare authentic Japanese dishes from a local chef. Using fresh, seasonal ingredients, you'll master techniques to recreate these flavors at home.",
      "sushi making": "Learn the art of sushi making from an expert chef. Roll, press, and plate your own nigiri and maki using the freshest fish and rice.",
      "hot spring (onsen) bathing": "Relax in natural hot spring waters and rejuvenate your body and mind. Enjoy the therapeutic benefits of mineral-rich onsen water.",
      "food walking tour": "Explore the local food scene on foot, sampling delicious street food and hidden gems that only locals know about.",
      "sake brewery tour": "Visit a traditional sake brewery and learn about the centuries-old brewing process. Sample a variety of premium sakes and discover your favorite.",
      "cycling tour": "Explore the scenic streets and hidden corners of the city by bicycle. This eco-friendly tour covers more ground than walking while keeping you close to the action.",
      "snorkeling": "Dive into crystal-clear waters and discover the vibrant underwater world. Suitable for beginners and experienced swimmers alike.",
      "kintsugi (gold repair)": "Learn the ancient Japanese art of repairing broken pottery with gold. This philosophical craft celebrates imperfection and the beauty of repair.",
      "miso making": "Discover the traditional art of miso making at a historic brewery. Learn about fermentation culture and create your own batch to take home.",
      "night tour": "Experience the city after dark with a knowledgeable guide. Discover illuminated landmarks, lively entertainment districts, and local nightlife spots.",
    };
    if (detailMap[activity]) {
      parts.push(detailMap[activity]);
    }
  }

  // Closing
  parts.push(`Available to book through ${platform}. Perfect for travelers looking for authentic Japanese experiences.`);

  return parts.join("\n\n");
}

function generateHighlights(row: ExpRow): string[] {
  const highlights: string[] = [];
  const activity = detectActivity(row.title);
  const city = row.dest_name || "Japan";

  // Activity-specific highlights
  if (activity) {
    const hlMap: Record<string, string[]> = {
      "pottery making": ["Hands-on pottery creation with expert guidance", "Take home your finished piece", "Learn traditional Japanese techniques"],
      "kimono wearing": ["Professional kimono dressing assistance", "Photo opportunities at scenic spots", "Choice of colorful patterns and styles"],
      "tea ceremony": ["Authentic matcha preparation experience", "Learn proper tea ceremony etiquette", "Enjoy traditional Japanese sweets"],
      "cooking class": ["Cook multiple authentic dishes", "Fresh, local ingredients provided", "Take home recipes to recreate at home"],
      "sushi making": ["Learn from a professional sushi chef", "Use the freshest fish and ingredients", "Enjoy your handmade sushi for lunch"],
      "hot spring (onsen) bathing": ["Natural mineral-rich hot spring water", "Towels and amenities provided", "Relaxing and therapeutic experience"],
      "food walking tour": ["Sample 5+ local specialties", "Visit hidden local favorites", "Learn about Japanese food culture"],
      "sake brewery tour": ["Tour a traditional brewery", "Sample premium sake varieties", "Learn about the brewing process"],
      "cycling tour": ["Bicycle and helmet provided", "Scenic route through the city", "Local guide with insider knowledge"],
      "snorkeling": ["Equipment provided", "Suitable for beginners", "Explore vibrant marine life"],
      "kintsugi (gold repair)": ["Create your own kintsugi art piece", "All materials provided", "Learn the philosophy behind the art"],
      "miso making": ["Visit a historic miso brewery", "Hands-on miso making experience", "Learn about fermentation culture"],
      "night tour": ["See the city beautifully illuminated", "Visit popular nightlife areas", "Local guide shares hidden gems"],
    };
    if (hlMap[activity]) {
      highlights.push(...hlMap[activity]);
    }
  }

  // Generic highlights based on available data
  if (highlights.length === 0) {
    highlights.push(`Authentic experience in ${city}`);
    highlights.push("Suitable for all ages and skill levels");
    highlights.push("English-friendly (depending on provider)");
  }

  // Add conditional ones
  if (row.avg_rating >= 4.5) highlights.push("Highly rated by previous visitors");
  if (row.min_price > 0 && row.min_price <= 30) highlights.push("Great value for money");

  return highlights.slice(0, 5);
}

function generateShortDescription(row: ExpRow): string {
  const city = row.dest_name || "Japan";
  const activity = detectActivity(row.title);
  if (activity) {
    return `Enjoy ${activity} in ${city}. A unique hands-on experience for travelers seeking authentic Japanese culture.`;
  }
  const themes = (row.theme_slugs || "").split(",").filter(Boolean);
  const themeDesc = themes.map((t) => THEME_DESC[t]).filter(Boolean)[0] || "unique";
  return `A ${themeDesc} experience in ${city}. Discover the authentic side of Japan.`;
}

function main() {
  console.log("=== Generating descriptions for experiences ===\n");

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");

  // Get experiences needing descriptions
  const rows = sqlite.prepare(`
    SELECT e.id, e.title, e.description, e.short_description, e.highlights,
           e.avg_rating, e.total_review_count, e.min_price, e.currency,
           e.duration_minutes, e.hero_image_url,
           d.name as dest_name, d.region as dest_region,
           p.slug as platform_slug,
           GROUP_CONCAT(DISTINCT t.slug) as theme_slugs
    FROM experiences e
    LEFT JOIN destinations d ON d.id = e.destination_id
    LEFT JOIN listings l ON l.experience_id = e.id AND l.is_active = 1
    LEFT JOIN platforms p ON p.id = l.platform_id
    LEFT JOIN experience_themes et ON et.experience_id = e.id
    LEFT JOIN themes t ON t.id = et.theme_id
    WHERE e.status = 'published'
    GROUP BY e.id
  `).all() as ExpRow[];

  console.log(`Total experiences: ${rows.length}`);

  const updateExp = sqlite.prepare(`
    UPDATE experiences SET description = ?, short_description = ?, highlights = ?
    WHERE id = ?
  `);

  let updatedDesc = 0;
  let updatedHighlights = 0;

  const updateAll = sqlite.transaction(() => {
    for (const row of rows) {
      let desc = row.description;
      let shortDesc = row.short_description;
      let highlights = row.highlights;
      let changed = false;

      // Generate description if empty or very short
      if (!desc || desc.length < 30) {
        desc = generateDescription(row);
        changed = true;
        updatedDesc++;
      }

      // Generate short description if empty
      if (!shortDesc || shortDesc.length < 20) {
        shortDesc = generateShortDescription(row);
        changed = true;
      }

      // Generate highlights if empty
      if (!highlights || highlights === "[]") {
        const hl = generateHighlights(row);
        highlights = JSON.stringify(hl);
        changed = true;
        updatedHighlights++;
      }

      if (changed) {
        updateExp.run(desc, shortDesc, highlights, row.id);
      }
    }
  });

  updateAll();

  console.log(`\nUpdated descriptions: ${updatedDesc}`);
  console.log(`Updated highlights: ${updatedHighlights}`);

  // Verify
  const empty = sqlite.prepare("SELECT COUNT(*) as cnt FROM experiences WHERE description = '' OR description IS NULL").get() as { cnt: number };
  const noHl = sqlite.prepare("SELECT COUNT(*) as cnt FROM experiences WHERE highlights = '[]' OR highlights IS NULL").get() as { cnt: number };
  console.log(`\nRemaining empty descriptions: ${empty.cnt}`);
  console.log(`Remaining empty highlights: ${noHl.cnt}`);

  sqlite.close();
  console.log("\nDone!");
}

main();
