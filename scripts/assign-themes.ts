/**
 * Assign themes to experiences that don't have any theme assigned yet.
 * Uses title + description keyword matching.
 */
import Database from "better-sqlite3";
import { join } from "path";

const DB_PATH = join(process.cwd(), "data", "bear-tour.db");

interface ThemeRow {
  id: number;
  slug: string;
}

interface ExpRow {
  id: number;
  title: string;
  description: string;
}

// Keywords that map to each theme
const THEME_KEYWORDS: Record<string, RegExp[]> = {
  "food-drink": [
    /sushi|寿司/i, /ramen|ラーメン/i, /cook|料理|クッキング/i,
    /food|フード/i, /sake|酒|日本酒/i, /tea\b|茶|抹茶|matcha/i,
    /wagashi|和菓子/i, /bento|弁当/i, /izakaya|居酒屋/i,
    /tempura|天ぷら/i, /udon|うどん/i, /soba|そば/i,
    /yakitori|焼き鳥/i, /okonomiyaki|お好み焼/i, /takoyaki|たこ焼/i,
    /sweets|スイーツ/i, /chocolate|チョコ/i, /beer|ビール/i,
    /wine|ワイン/i, /whisky|ウイスキー/i, /coffee|コーヒー/i,
    /miso|味噌/i, /tofu|豆腐/i, /dango|団子/i, /mochi|餅/i,
    /ferment|醸造|発酵/i, /brewery|ブルワリー/i,
    /tasting|試食|試飲/i, /dining|ダイニング/i,
    /culinary/i, /gastronom/i, /kitchen|キッチン/i,
    /eat|食べ/i, /drink|飲/i, /gourmet|グルメ/i,
    /market.*food|food.*market|食市場/i,
    /fruit.*pick|いちご狩|ぶどう狩|りんご狩/i,
  ],
  "culture-history": [
    /temple|寺|神社|shrine/i, /kimono|着物/i, /geisha|芸者|舞妓/i,
    /samurai|侍|武士/i, /ninja|忍者/i, /castle|城/i,
    /calligraphy|書道/i, /ikebana|華道|生け花/i, /zen|禅/i,
    /meditation|瞑想/i, /sumo|相撲/i, /kabuki|歌舞伎/i,
    /noh|能楽/i, /taiko|太鼓/i, /festival|祭り|まつり/i,
    /tradition|伝統/i, /heritage|遺産/i, /history|歴史/i,
    /culture|文化/i, /ceremony|儀式/i, /ancient|古/i,
    /shinto|神道/i, /buddhis|仏教/i, /monk|僧/i,
    /yukata|浴衣/i, /furoshiki|風呂敷/i, /origami|折り紙/i,
    /kintsugi|金継ぎ/i, /incense|お香|香道/i,
    /museum|博物館|美術館/i, /historic/i, /old town|古い町/i,
    /world heritage|世界遺産/i, /imperial|皇居/i,
    /garden.*japanese|日本庭園|japanese.*garden/i,
    /shojin|精進/i, /zazen|座禅/i,
  ],
  "nature-outdoor": [
    /hiking|ハイキング|登山|trekking/i, /mountain|山/i,
    /forest|森|林/i, /river|川/i, /lake|湖/i,
    /waterfall|滝/i, /beach|ビーチ|海岸/i, /island|島/i,
    /nature|自然/i, /park|公園/i, /garden|庭園/i,
    /flower|花|桜|cherry|sakura/i, /autumn|紅葉|momiji/i,
    /onsen|温泉|hot spring/i, /snow|雪/i, /ski|スキー/i,
    /snowboard|スノーボード/i, /camping|キャンプ/i,
    /wildlife|野生/i, /bird.*watch|バードウォッチ/i,
    /scenic|景色|絶景/i, /sunrise|日の出/i, /sunset|夕日/i,
    /fuji|富士/i, /outdoor|アウトドア/i, /eco/i,
    /bamboo|竹林/i, /gorge|渓谷/i, /cave|洞窟/i,
    /cycling|サイクリング|自転車/i, /walk.*nature|自然.*歩/i,
    /stargazing|星空/i, /firefly|ホタル|蛍/i,
  ],
  "adventure": [
    /diving|ダイビング/i, /snorkel|シュノーケ/i,
    /kayak|カヤック/i, /canoe|カヌー/i, /rafting|ラフティング/i,
    /surfing|サーフィン/i, /paraglid|パラグライ/i,
    /bungee|バンジー/i, /zipline|ジップライン/i,
    /adventure|アドベンチャー/i, /sport|スポーツ/i,
    /climb|クライミング/i, /fishing|釣り/i,
    /sail|セーリング/i, /boat|ボート|船/i,
    /cruise|クルーズ/i, /whale.*watch|ホエールウォッチ/i,
    /dolphin|イルカ/i, /jet.*ski|ジェットスキー/i,
    /sup|サップ|paddleboard/i, /canyoning|キャニオニング/i,
    /go.*kart|ゴーカート|カート/i, /atv|バギー/i,
    /horse.*rid|乗馬/i, /segway|セグウェイ/i,
    /skydiv|スカイダイブ/i, /swim/i,
    /excursion/i, /thrill/i,
  ],
  "art-entertainment": [
    /pottery|陶芸/i, /ceramic|セラミック/i, /glass|ガラス/i,
    /art\b|アート/i, /paint|ペイント|絵画/i, /draw|ドロー/i,
    /craft|クラフト|工芸/i, /workshop|ワークショップ/i,
    /anime|アニメ/i, /manga|漫画|マンガ/i, /cosplay|コスプレ/i,
    /game|ゲーム/i, /arcade|アーケード/i, /karaoke|カラオケ/i,
    /theater|劇場|シアター/i, /show|ショー/i, /performance|パフォーマンス/i,
    /music|音楽|ミュージック/i, /photo|写真|フォト/i,
    /candle|キャンドル/i, /jewelry|ジュエリー|アクセサリー/i,
    /resin|レジン/i, /leather|レザー|革/i,
    /textile|テキスタイル|織/i, /dye|染め|藍染/i,
    /woodwork|木工/i, /paper|紙|和紙/i, /print|版画|プリント/i,
    /VR|virtual reality/i, /robot|ロボット/i,
    /entertainment|エンターテイメント/i,
    /design|デザイン/i, /studio|スタジオ/i,
    /make|making|作り|体験/i,
  ],
  "nightlife": [
    /night|ナイト|夜/i, /bar\b|バー/i, /pub|パブ/i,
    /club|クラブ/i, /lounge|ラウンジ/i, /cocktail|カクテル/i,
    /illuminat|イルミネーション/i, /light.*up|ライトアップ/i,
    /evening|イブニング/i, /after.*dark/i,
    /neon/i, /kabukicho|歌舞伎町/i, /shinjuku.*night/i,
    /golden.*gai|ゴールデン街/i, /yokocho|横丁/i,
  ],
};

function main() {
  console.log("=== Assigning themes to unassigned experiences ===\n");

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");

  // Get theme IDs
  const themeRows = sqlite.prepare("SELECT id, slug FROM themes").all() as ThemeRow[];
  const themeIdMap = new Map(themeRows.map((t) => [t.slug, t.id]));
  console.log("Themes:", [...themeIdMap.keys()].join(", "));

  // Get unassigned experiences
  const unassigned = sqlite.prepare(`
    SELECT e.id, e.title, e.description
    FROM experiences e
    WHERE e.status = 'published'
      AND e.id NOT IN (SELECT experience_id FROM experience_themes)
  `).all() as ExpRow[];

  console.log(`Unassigned experiences: ${unassigned.length}`);

  const insertTheme = sqlite.prepare(
    "INSERT OR IGNORE INTO experience_themes (experience_id, theme_id) VALUES (?, ?)"
  );

  let assigned = 0;
  const themeCounts: Record<string, number> = {};

  const assignAll = sqlite.transaction(() => {
    for (const exp of unassigned) {
      const text = `${exp.title} ${exp.description}`;
      const matched = new Set<string>();

      for (const [themeSlug, patterns] of Object.entries(THEME_KEYWORDS)) {
        for (const re of patterns) {
          if (re.test(text)) {
            matched.add(themeSlug);
            break;
          }
        }
      }

      // If nothing matched, assign "culture-history" as default (most generic for Japan experiences)
      if (matched.size === 0) {
        matched.add("culture-history");
      }

      for (const slug of matched) {
        const themeId = themeIdMap.get(slug);
        if (themeId) {
          insertTheme.run(exp.id, themeId);
          themeCounts[slug] = (themeCounts[slug] || 0) + 1;
        }
      }
      assigned++;
    }
  });

  assignAll();

  console.log(`\nAssigned themes to ${assigned} experiences:`);
  for (const [slug, count] of Object.entries(themeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${slug}: +${count}`);
  }

  // Show final distribution
  const final = sqlite.prepare(`
    SELECT t.slug, COUNT(et.experience_id) as cnt
    FROM themes t
    LEFT JOIN experience_themes et ON et.theme_id = t.id
    GROUP BY t.id
    ORDER BY cnt DESC
  `).all() as { slug: string; cnt: number }[];

  console.log("\nFinal theme distribution:");
  for (const row of final) {
    console.log(`  ${row.slug}: ${row.cnt}`);
  }

  sqlite.close();
  console.log("\nDone!");
}

main();
