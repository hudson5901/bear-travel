/**
 * Regenerate descriptions with more varied, specific templates.
 * Force-updates template-generated descriptions to improve quality.
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
  dest_name: string;
  dest_region: string;
  platform_slug: string;
  theme_slugs: string;
}

const PLATFORM_NAMES: Record<string, string> = {
  jalan: "Jalan", asoview: "Asoview", veltra: "Veltra", tabirai: "Tabirai",
  travelko: "Travelko", gowithguide: "GoWithGuide", deepexp: "Deep Experience Japan",
  cookly: "Cookly", airkitchen: "AirKitchen", otonami: "Otonami", byfood: "byFood",
  activityjapan: "Activity Japan", "go-nagano": "Go Nagano", wamazing: "WAmazing",
  his: "H.I.S.", headout: "Headout", japanwondertravel: "Japan Wonder Travel",
  viator: "Viator", getyourguide: "GetYourGuide",
};

const CITY_CONTEXT: Record<string, { desc: string; tips: string[] }> = {
  Tokyo: {
    desc: "Japan's electric capital — a city where ancient temples stand alongside neon-lit towers",
    tips: ["Combine with a stroll through nearby neighborhoods", "Easily accessible by train from major stations", "Consider visiting on weekdays for fewer crowds"],
  },
  Kyoto: {
    desc: "the cultural heart of Japan, where over 2,000 temples and shrines dot the landscape",
    tips: ["Best combined with a walk through the historic Higashiyama district", "Early morning visits avoid the crowds", "Spring (cherry blossoms) and autumn (foliage) are peak seasons"],
  },
  Osaka: {
    desc: "Japan's culinary capital, famous for its street food scene and warm local hospitality",
    tips: ["Don't miss the Dotonbori area nearby", "Osaka is known as 'Japan's Kitchen' for good reason", "The city's casual, fun atmosphere makes every experience memorable"],
  },
  Hiroshima: {
    desc: "a city reborn from history, now a beacon of peace and resilience",
    tips: ["Combine with a day trip to Miyajima Island", "The Peace Memorial Park is a must-visit", "Try Hiroshima-style okonomiyaki while you're here"],
  },
  Nara: {
    desc: "an ancient capital where friendly deer roam freely among 1,300-year-old temples",
    tips: ["Watch out for the playful deer — they may bow for crackers", "The Great Buddha at Todai-ji is a short walk away", "A perfect day trip from Kyoto or Osaka"],
  },
  Hakone: {
    desc: "a scenic mountain retreat just 90 minutes from Tokyo, with hot springs and Mt. Fuji views",
    tips: ["On clear days, you can see Mt. Fuji from many vantage points", "The Hakone Free Pass covers most transportation", "Great as a weekend getaway from Tokyo"],
  },
  Nagano: {
    desc: "a mountain prefecture known for its hot springs, snow monkeys, and centuries-old craft traditions",
    tips: ["Famous for its miso and soba noodles", "The snow monkeys of Jigokudani are a unique attraction", "Zenko-ji Temple is one of Japan's most important pilgrimage sites"],
  },
  Hokkaido: {
    desc: "Japan's wild north — vast landscapes, powder snow, and the freshest seafood in the country",
    tips: ["Winter (Dec–Feb) is best for skiing and snow festivals", "Summer (Jul–Aug) offers pleasant temperatures and lavender fields", "Seafood here is some of the best in all of Japan"],
  },
  Okinawa: {
    desc: "Japan's tropical archipelago with turquoise waters, unique Ryukyu culture, and year-round warmth",
    tips: ["Best for water activities from April to October", "The unique Ryukyu culture is distinct from mainland Japan", "Try Okinawan soba and purple sweet potato tarts"],
  },
  Niigata: {
    desc: "rice country and the sake heartland of Japan, surrounded by mountains and Sea of Japan coastline",
    tips: ["Home to some of Japan's finest sake breweries", "Echigo-Yuzawa is a popular ski destination", "The region's koshihikari rice is considered Japan's best"],
  },
  Fukuoka: {
    desc: "Kyushu's vibrant gateway, famous for its yatai (street food stalls) and Hakata ramen",
    tips: ["Visit the yatai stalls along the Naka River at night", "Hakata ramen here is the original tonkotsu style", "A great base for exploring Kyushu"],
  },
  Kamakura: {
    desc: "a seaside town with the iconic Great Buddha, ancient temples, and relaxed beach vibes just an hour from Tokyo",
    tips: ["The Great Buddha (Daibutsu) is the main landmark", "Hike the trails connecting temples for beautiful views", "Perfect as a day trip from Tokyo"],
  },
  Nikko: {
    desc: "a UNESCO World Heritage mountain town with lavishly decorated shrines surrounded by nature",
    tips: ["Toshogu Shrine is one of Japan's most ornate", "Autumn foliage here is spectacular (October–November)", "The Kegon Falls are worth the detour"],
  },
  Kanazawa: {
    desc: "a city of samurai and geisha districts, home to Kenroku-en — one of Japan's top three gardens",
    tips: ["Kenroku-en Garden is stunning in every season", "The 21st Century Museum of Contemporary Art is free to enter the grounds", "Fresh seafood at Omicho Market rivals Tokyo's"],
  },
  Yokohama: {
    desc: "Japan's second-largest city, a cosmopolitan port with the country's biggest Chinatown and waterfront views",
    tips: ["Minato Mirai's skyline is beautiful at night", "Japan's largest Chinatown has over 600 shops", "The Cup Noodles Museum is a fun, unique attraction"],
  },
  Kobe: {
    desc: "a stylish port city famous worldwide for its marbled Kobe beef and panoramic harbor views",
    tips: ["Kobe beef is best enjoyed at a teppanyaki restaurant", "The night view from Mt. Rokko is called '10 million dollar view'", "Kitano-cho's Western-style houses reflect the city's international heritage"],
  },
};

const ACTIVITY_MAP: [RegExp, string, string][] = [
  [/陶芸|pottery/i, "pottery making", "Shape clay on a traditional wheel and create your own ceramic piece under expert guidance. Each creation is unique — a one-of-a-kind souvenir fired and glazed for you."],
  [/着物|kimono/i, "kimono experience", "Step into Japanese tradition with a full kimono dressing session. Professional stylists help you select from dozens of patterns, tie the obi sash, and coordinate accessories for the perfect look."],
  [/茶道|tea ceremony|抹茶/i, "tea ceremony", "Enter a tranquil tearoom and learn the meditative art of preparing matcha. Every movement — from folding the cloth to whisking the tea — carries centuries of meaning."],
  [/書道|calligraphy/i, "calligraphy", "Grind ink on a traditional stone and practice the flowing strokes of Japanese calligraphy. Write your name in kanji or create a piece of brush art to take home."],
  [/料理|cooking|クッキング/i, "cooking class", "Learn to prepare authentic Japanese dishes step by step. From selecting ingredients at a local market to mastering knife techniques, you'll gain skills to recreate these dishes anywhere."],
  [/寿司|sushi/i, "sushi making", "Master the art of sushi under a trained chef. Learn to prepare vinegared rice to perfection, slice fresh fish, and shape beautiful nigiri and maki rolls."],
  [/ラーメン|ramen/i, "ramen experience", "Dive into Japan's beloved comfort food. Learn the secrets of rich broth, hand-pulled noodles, and perfectly balanced toppings from a ramen master."],
  [/温泉|onsen|hot spring/i, "onsen (hot spring)", "Soak in mineral-rich thermal waters surrounded by natural beauty. Japanese hot springs have been prized for centuries for their healing and relaxing properties."],
  [/サイクリング|cycling|自転車|bike/i, "cycling tour", "Pedal through scenic streets and hidden alleys that buses and cars can't reach. A cycling tour gives you the freedom to stop, explore, and photograph at your own pace."],
  [/ダイビング|diving/i, "scuba diving", "Descend into Japan's underwater world with a certified guide. Encounter colorful coral reefs, tropical fish, and the unique marine life of Japanese waters."],
  [/シュノーケ|snorkel/i, "snorkeling", "Float above vibrant coral gardens and watch tropical fish dart through crystal-clear Japanese waters. All equipment provided — no experience necessary."],
  [/カヤック|kayak/i, "kayaking", "Paddle through calm waters and explore coastlines, mangrove forests, or river gorges from a unique perspective. Suitable for beginners with basic instruction included."],
  [/サーフィン|surfing/i, "surfing", "Catch waves at one of Japan's surf spots with professional instruction. Whether you're a beginner standing up for the first time or looking to improve, local instructors know every break."],
  [/ハイキング|hiking|登山|trekking/i, "hiking", "Trek through forested trails, mountain paths, or coastal routes with stunning views. Japan's well-maintained hiking paths range from easy walks to challenging mountain climbs."],
  [/釣り|fishing/i, "fishing", "Cast a line in Japanese waters — from mountain streams to open ocean. Local guides share techniques passed down through generations and help you catch the day's prize."],
  [/ガラス|glass/i, "glass art", "Create beautiful glass art using traditional techniques. Blow, shape, or fuse colorful glass into jewelry, cups, or decorative pieces in a professional studio."],
  [/アクセサリー|jewelry|silver/i, "jewelry making", "Design and craft your own ring, bracelet, or pendant using precious metals. Professional tools and guidance ensure a polished result worthy of wearing every day."],
  [/キャンドル|candle/i, "candle making", "Pour, layer, and shape custom candles using natural wax and Japanese-inspired fragrances. Choose colors, scents, and molds to create something uniquely yours."],
  [/レジン|resin/i, "resin art", "Encase dried flowers, gold leaf, or tiny charms in crystal-clear resin to create wearable art. This modern Japanese craft trend produces stunning accessories and keychains."],
  [/金継ぎ|kintsugi/i, "kintsugi", "Practice kintsugi — the Japanese philosophy of embracing imperfection by repairing broken pottery with gold. Transform a cracked bowl into a work of art with deeper meaning."],
  [/忍者|ninja/i, "ninja experience", "Train like a ninja with shuriken throwing, stealth movement, and sword techniques. Professional instructors teach authentic ninjutsu in an immersive dojo setting."],
  [/侍|samurai|sword/i, "samurai experience", "Wield a Japanese sword and learn the discipline of the samurai. Trained instructors guide you through kata (forms), proper etiquette, and the warrior's code of bushido."],
  [/味噌|miso/i, "miso making", "Get your hands into centuries-old fermentation culture. Mix soybeans, koji, and salt following traditional methods, then age your own batch of artisanal miso to take home."],
  [/醸造|brewery|sake|酒/i, "sake experience", "Step inside a working brewery and follow sake's journey from polished rice to finished bottle. Taste multiple grades side by side and learn to distinguish ginjo from daiginjo."],
  [/食べ歩き|food.*walk|food.*tour/i, "food tour", "Follow a local guide through bustling market streets and hidden alleyways, sampling regional specialties at each stop. Every bite tells a story about local culture and seasons."],
  [/ナイト|night.*tour/i, "night tour", "See the city transform after dark. From illuminated temples and neon-lit streets to quiet backstreet bars, a night tour reveals a completely different face of Japan."],
  [/クルーズ|cruise|boat|船/i, "boat cruise", "Glide across the water and see the landscape from a completely new angle. Whether it's a river cruise, bay tour, or island-hopping adventure, the views are unforgettable."],
  [/VR|virtual/i, "VR experience", "Step into a virtual world that brings Japanese history, nature, or fantasy to life. Cutting-edge VR technology creates an immersive experience unlike anything else."],
  [/華道|ikebana|flower.*arrang/i, "ikebana", "Arrange flowers the Japanese way — with intention, balance, and seasonal awareness. Ikebana is more than decoration; it's a meditative practice connecting you to nature."],
  [/太鼓|taiko|drum/i, "taiko drumming", "Feel the thunder of massive Japanese drums beneath your hands. Taiko drumming is physical, musical, and deeply energizing — a full-body cultural experience."],
  [/漫画|manga|anime|アニメ/i, "anime/manga experience", "Immerse yourself in the colorful world of Japanese animation and comics. From drawing workshops to themed tours, experience the pop culture that captivates millions worldwide."],
  [/浴衣|yukata/i, "yukata experience", "Slip into a lightweight yukata (summer kimono) and enjoy a casual taste of traditional Japanese dress. Perfect for festivals, hot spring towns, or simply exploring in style."],
  [/藍染|indigo|染め|dye/i, "indigo dyeing", "Dip fabric into deep vats of natural indigo dye and create patterns using traditional shibori folding and tying techniques. Each piece emerges as a unique work of wearable art."],
  [/和紙|washi|paper/i, "washi paper making", "Make traditional Japanese paper (washi) by hand using mulberry fibers and centuries-old techniques. Press, dry, and decorate your own sheet of this UNESCO-recognized craft."],
  [/座禅|zazen|zen.*meditat/i, "zen meditation", "Sit in zazen meditation at a Buddhist temple. A monk guides you through proper posture, breathing, and the practice of clearing your mind in a sacred space."],
  [/写真|photo/i, "photography", "Capture stunning images with expert guidance on composition and lighting. Whether at iconic landmarks or hidden gems, you'll leave with photos that tell a story."],
  [/ヨガ|yoga/i, "yoga session", "Practice yoga in a uniquely Japanese setting — perhaps at a temple, garden, or mountain retreat. Combine physical wellness with the tranquility of Japan's most peaceful spaces."],
];

function detectActivity(title: string): { name: string; detail: string } | null {
  for (const [regex, name, detail] of ACTIVITY_MAP) {
    if (regex.test(title)) return { name, detail };
  }
  return null;
}

function durationText(mins: number): string {
  if (!mins || mins <= 0) return "";
  if (mins < 60) return `${mins} minutes`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return h === 1 ? "1 hour" : `${h} hours`;
  return `${h}h ${m}m`;
}

function priceContext(price: number, currency: string): string {
  if (!price || price <= 0) return "";
  if (currency === "JPY") {
    if (price <= 3000) return "budget-friendly";
    if (price <= 8000) return "moderately priced";
    return "premium";
  }
  if (price <= 30) return "budget-friendly";
  if (price <= 80) return "moderately priced";
  return "premium";
}

// Vary sentence structure based on experience ID (deterministic "randomness")
function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function generateDescription(row: ExpRow): string {
  const city = row.dest_name || "Japan";
  const cityInfo = CITY_CONTEXT[city];
  const cityDesc = cityInfo?.desc || `a beautiful destination in ${row.dest_region || "Japan"}`;
  const platform = PLATFORM_NAMES[row.platform_slug] || row.platform_slug || "our partner";
  const activity = detectActivity(row.title);
  const dur = durationText(row.duration_minutes);
  const pCtx = priceContext(row.min_price, row.currency);
  const seed = row.id;

  const parts: string[] = [];

  // Opening — varied based on seed
  if (activity) {
    const openers = [
      `Immerse yourself in ${activity.name} in ${city} — ${cityDesc}.`,
      `Join a hands-on ${activity.name} session in the heart of ${city}, ${cityDesc}.`,
      `"${row.title}" brings you an unforgettable ${activity.name} experience in ${city}, ${cityDesc}.`,
      `Step into the world of ${activity.name} in ${city}. Located in ${cityDesc}, this experience connects you to a living tradition.`,
    ];
    parts.push(pick(openers, seed));
  } else {
    const openers = [
      `"${row.title}" is a unique experience waiting for you in ${city}, ${cityDesc}.`,
      `Discover something special in ${city} — ${cityDesc}. This experience offers a side of Japan most visitors never see.`,
      `Explore ${city}, ${cityDesc}, through this one-of-a-kind experience that goes beyond the typical tourist trail.`,
      `In ${city}, ${cityDesc}, this experience invites you to see the destination through a local's eyes.`,
    ];
    parts.push(pick(openers, seed));
  }

  // Activity detail
  if (activity) {
    parts.push(activity.detail);
  }

  // Duration & price context
  const contextParts: string[] = [];
  if (dur) contextParts.push(`lasting approximately ${dur}`);
  if (pCtx) contextParts.push(`${pCtx} for the quality offered`);
  if (contextParts.length > 0) {
    parts.push(`This experience is ${contextParts.join(" and ")}.`);
  }

  // Rating
  if (row.avg_rating > 0 && row.total_review_count > 0) {
    const ratingPhrases = [
      `With a ${row.avg_rating.toFixed(1)}/5.0 rating from ${row.total_review_count} travelers, it's clear this is a standout experience.`,
      `Travelers consistently rate this ${row.avg_rating.toFixed(1)} out of 5.0 (${row.total_review_count} reviews) — a testament to its quality.`,
      `Backed by ${row.total_review_count} reviews and a ${row.avg_rating.toFixed(1)}/5.0 score, this ranks among the most popular activities in the area.`,
    ];
    parts.push(pick(ratingPhrases, seed + 3));
  }

  // City tips
  if (cityInfo?.tips) {
    const tip = pick(cityInfo.tips, seed + 7);
    parts.push(`Insider tip: ${tip}.`);
  }

  // Booking
  parts.push(`Book with confidence through ${platform}.`);

  return parts.join("\n\n");
}

function generateHighlights(row: ExpRow): string[] {
  const hl: string[] = [];
  const activity = detectActivity(row.title);
  const city = row.dest_name || "Japan";
  const dur = durationText(row.duration_minutes);

  if (activity) {
    const hlMap: Record<string, string[]> = {
      "pottery making": ["Create your own ceramic piece to take home", "Expert instruction on traditional wheel techniques", "All materials and firing included"],
      "kimono experience": ["Choose from dozens of patterns and colors", "Professional dressing by experienced stylists", "Accessories and hair styling included"],
      "tea ceremony": ["Prepare and drink authentic matcha", "Learn centuries-old ceremonial etiquette", "Traditional Japanese sweets (wagashi) served"],
      "calligraphy": ["Write your name in beautiful kanji characters", "Premium brush and ink provided", "Take home your finished calligraphy"],
      "cooking class": ["Cook 3–5 authentic Japanese dishes", "Fresh, seasonal ingredients included", "Recipes provided to recreate at home"],
      "sushi making": ["Shape nigiri and roll maki like a pro", "Premium-grade fish and ingredients", "Eat your handmade sushi for lunch"],
      "ramen experience": ["Learn the secrets of rich, flavorful broth", "Make noodles from scratch", "Customize your perfect bowl of ramen"],
      "onsen (hot spring)": ["Mineral-rich thermal waters", "Towels and amenities provided", "Scenic natural surroundings"],
      "cycling tour": ["Bicycle, helmet, and map provided", "Visit hidden spots cars can't reach", "Flexible pace with a knowledgeable guide"],
      "scuba diving": ["Full equipment rental included", "Certified instructor accompanies you", "Explore unique Japanese marine ecosystems"],
      "snorkeling": ["All snorkeling gear provided", "No experience needed — beginners welcome", "Crystal-clear waters with abundant marine life"],
      "kayaking": ["Kayak and safety equipment provided", "Suitable for beginners", "Explore coastlines and hidden coves"],
      "hiking": ["Well-maintained trails with scenic views", "Guide shares local history and nature facts", "Suitable for various fitness levels"],
      "glass art": ["Choose from blowing, fusing, or lampwork", "All materials and tools provided", "Take home your finished piece"],
      "jewelry making": ["Design and craft a custom piece", "Professional tools and guidance", "Sterling silver materials included"],
      "kintsugi": ["Learn the Japanese philosophy of imperfection", "All materials including real gold powder provided", "Take home your repaired art piece"],
      "miso making": ["Hands-on at a traditional brewery", "Learn about fermentation science and culture", "Take home your own miso to age"],
      "sake experience": ["Tour a working sake brewery", "Taste premium sake varieties side by side", "Learn to read sake labels like a pro"],
      "food tour": ["Sample 5+ regional specialties", "Visit local markets and hidden restaurants", "Guide shares food culture and history"],
      "night tour": ["See iconic landmarks beautifully illuminated", "Explore vibrant nightlife districts safely", "Discover hidden bars and local favorites"],
      "ninja experience": ["Learn shuriken throwing and stealth techniques", "Authentic dojo setting", "Fun for both adults and children"],
      "samurai experience": ["Handle a real Japanese sword", "Learn kata (forms) from a trained instructor", "Photo opportunities in samurai gear"],
      "anime/manga experience": ["Explore anime-related spots and shops", "Try your hand at manga drawing", "Meet fellow fans from around the world"],
      "indigo dyeing": ["Create unique shibori patterns", "Natural indigo dye from traditional vats", "Take home your hand-dyed textile"],
      "zen meditation": ["Guided zazen session with a monk", "Practice in an authentic temple setting", "Learn breathing and mindfulness techniques"],
      "taiko drumming": ["Feel the power of traditional Japanese drums", "No musical experience required", "Energizing full-body workout"],
      "ikebana": ["Create a seasonal flower arrangement", "Learn principles of Japanese aesthetics", "Fresh flowers and vase included"],
    };
    const key = activity.name;
    if (hlMap[key]) hl.push(...hlMap[key]);
  }

  // Fallback for unmatched activities
  if (hl.length === 0) {
    hl.push(`Authentic local experience in ${city}`);
    hl.push("Guided by knowledgeable locals");
    hl.push("Suitable for travelers of all backgrounds");
  }

  // Conditional highlights
  if (dur) hl.push(`Duration: approximately ${dur}`);
  if (row.avg_rating >= 4.5 && row.total_review_count >= 5) hl.push("Consistently top-rated by visitors");
  if (row.min_price > 0 && row.min_price <= 3000 && row.currency === "JPY") hl.push("Exceptional value for money");
  else if (row.min_price > 0 && row.min_price <= 30 && row.currency !== "JPY") hl.push("Exceptional value for money");

  return hl.slice(0, 5);
}

function generateShortDescription(row: ExpRow): string {
  const city = row.dest_name || "Japan";
  const activity = detectActivity(row.title);
  const seed = row.id;

  if (activity) {
    const templates = [
      `Hands-on ${activity.name} in ${city}. Create lasting memories with this authentic Japanese experience.`,
      `Try ${activity.name} in ${city} — guided by local experts, perfect for first-timers and enthusiasts alike.`,
      `A ${activity.name} experience in ${city} that brings you closer to Japanese culture and craftsmanship.`,
    ];
    return pick(templates, seed);
  }

  const templates = [
    `A unique experience in ${city} that reveals the authentic side of Japan beyond the guidebooks.`,
    `Explore ${city} through a local's eyes with this memorable, one-of-a-kind experience.`,
    `Discover something unexpected in ${city}. This experience is designed for curious travelers.`,
  ];
  return pick(templates, seed);
}

function isTemplateGenerated(desc: string): boolean {
  if (!desc || desc.length < 30) return true;
  return /^(Experience an authentic|Discover this (culinary|cultural|nature|adventure|arts|evening|unique))/.test(desc);
}

function main() {
  console.log("=== Regenerating descriptions with improved templates ===\n");

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");

  const rows = sqlite.prepare(`
    SELECT e.id, e.title, e.description, e.short_description, e.highlights,
           e.avg_rating, e.total_review_count, e.min_price, e.currency,
           e.duration_minutes,
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

  const updateExp = sqlite.prepare(
    "UPDATE experiences SET description = ?, short_description = ?, highlights = ? WHERE id = ?"
  );

  let updated = 0;

  const updateAll = sqlite.transaction(() => {
    for (const row of rows) {
      // Only regenerate template-generated or empty descriptions
      if (!isTemplateGenerated(row.description)) continue;

      const desc = generateDescription(row);
      const shortDesc = generateShortDescription(row);
      const highlights = JSON.stringify(generateHighlights(row));

      updateExp.run(desc, shortDesc, highlights, row.id);
      updated++;
    }
  });

  updateAll();

  console.log(`Regenerated: ${updated} experiences`);
  console.log(`Skipped (has real content): ${rows.length - updated}`);

  sqlite.close();
  console.log("\nDone!");
}

main();
