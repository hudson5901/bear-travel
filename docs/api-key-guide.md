# APIキー取得ガイド - ブロックされたプラットフォーム

CloudflareでスクレイピングがブロックされたプラットフォームのAPI/アフィリエイトアクセス取得方法まとめ。

---

## 1. Viator (TripAdvisor) - 無料パートナーAPI

**優先度: ★★★★★（最重要）**
- 世界最大級のツアー予約プラットフォーム
- 日本だけで数千件のツアーデータ

### 登録手順
1. https://partnerapi.viator.com/ にアクセス
2. 「Sign Up」をクリック
3. サイト情報を入力（bear-tour.comなど）
4. 承認後、APIキーがメールで届く（通常1-3営業日）

### API仕様
- **エンドポイント**: `https://api.viator.com/partner/`
- **認証**: ヘッダーに `exp-api-key: YOUR_KEY`
- **主要API**:
  - `POST /search/products` - 商品検索（destId=334 でTokyo）
  - `GET /product/{productCode}` - 商品詳細
  - `GET /taxonomy/destinations` - 地域一覧
- **レート制限**: 1秒あたり10リクエスト
- **料金**: 無料（アフィリエイト報酬8%）

### 実装例
```typescript
const res = await fetch("https://api.viator.com/partner/search/products", {
  method: "POST",
  headers: {
    "exp-api-key": process.env.VIATOR_API_KEY,
    "Accept": "application/json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    destId: 334, // Tokyo
    topX: "1-50",
    sortOrder: "TOP_SELLERS",
    currencyCode: "USD",
  }),
});
```

### Tokyo の destId 一覧
| 都市 | destId |
|------|--------|
| Tokyo | 334 |
| Kyoto | 332 |
| Osaka | 333 |
| Hiroshima | 909 |
| Nara | 5190 |
| Hakone | 5573 |

---

## 2. GetYourGuide - Awinアフィリエイト経由

**優先度: ★★★★☆**
- 欧米ユーザーに人気のプラットフォーム
- 高品質な英語コンテンツ

### 登録手順
1. https://www.awin.com/ でアフィリエイトアカウント作成
2. サイト情報・カテゴリ（Travel & Tourism）を登録
3. GetYourGuideのプログラムを検索して参加申請
4. 承認後、商品データフィードにアクセス可能

### データフィード
- Awinダッシュボード → Programs → GetYourGuide → Product Feed
- CSV/XMLでツアーデータ一括ダウンロード可能
- フィールド: title, description, price, image_url, deep_link, category

### 代替: GYGパートナープログラム
1. https://partner.getyourguide.com/ にアクセス
2. 「Partner with us」から申請
3. Widget / API / Affiliate リンク利用可能

### 報酬
- コミッション: 8%（Awin経由）
- Cookie期間: 90日

---

## 3. Klook - パートナーアフィリエイト

**優先度: ★★★★☆**
- アジア最大級のアクティビティプラットフォーム
- 日本コンテンツが非常に豊富

### 登録手順
1. https://affiliate.klook.com/ にアクセス
2. 「Join Now」をクリック
3. サイトURL、トラフィック情報を入力
4. 承認後、アフィリエイトダッシュボードにアクセス

### APIアクセス
- パートナーダッシュボード → Product Feed
- JSON/CSV形式でデータ取得可能
- Deep link生成ツール付き

### 報酬
- コミッション: 3-5%（カテゴリによる）
- Cookie期間: 30日

---

## 4. KKday - KKpartnersプログラム

**優先度: ★★★☆☆**
- 台湾発、アジアに強い
- 日本の体験ツアーが豊富

### 登録手順
1. https://www.kkday.com/ja/partners にアクセス
2. アフィリエイト申請フォームを入力
3. サイトURL、月間PV、プロモーション方法を記載
4. 承認後、アフィリエイトリンク生成ツール利用可能

### データフィード
- パートナーダッシュボードからCSV/APIアクセス
- 商品検索API（承認後に提供）

### 報酬
- コミッション: 2-5%
- Cookie期間: 30日

---

## 5. Activity Japan - API提携

**優先度: ★★★☆☆**
- HISグループの体験予約プラットフォーム
- 日本国内に特化した豊富なデータ

### 登録手順
1. https://activityjapan.com/ のフッターから「提携・協業」リンク
2. お問い合わせフォームからAPI提携を申請
3. NDA（秘密保持契約）締結後、API仕様書が提供される
4. 直接担当者とやりとり

### 注意
- APIは公開されておらず、個別交渉が必要
- 法人格があるとスムーズ
- レスポンスまで1-2週間

---

## 6. TripAdvisor - Content API

**優先度: ★★☆☆☆**
- Viator APIで代替可能（同グループ）
- レビューデータは別途Content APIが必要

### 登録手順
1. https://www.tripadvisor.com/developers にアクセス
2. API利用申請
3. 審査通過後、APIキー発行

---

## 推奨する取得順序

1. **Viator** (無料、即座に大量データ取得可能)
2. **Klook** (アジアのデータが豊富)
3. **GetYourGuide** (Awin経由で比較的簡単)
4. **KKday** (追加データソースとして)
5. **Activity Japan** (NDA要、時間がかかる)

## 現在スクレイピングで取得済みのプラットフォーム

| Platform | 件数 | 方式 |
|----------|------|------|
| Asoview | 180 | スクレイピング |
| Jalan | 989 | スクレイピング |
| VELTRA | 71 | スクレイピング (EN版) |
| **合計** | **1,240** | |

## 新たにスクレイピング可能なプラットフォーム

テスト済みで追加スクレイピング可能:
- **GoWithGuide** - プライベートガイドツアー
- **Otonami** - プレミアム文化体験
- **DeepExperience** - 文化ツアー
- **Travelko** - アクティビティ集約サイト
- **Arigato Travel** - フードツアー
- **JNTO** - 公式観光情報
