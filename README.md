# Nexccess SNS 自動投稿パイプライン

Facebook / X へ、Note記事をAIで業種特化コンテンツに変換して自動投稿するシステムです。

---

## ディレクトリ構成

```
nexccess-sns/
├── .github/
│   └── workflows/
│       └── sns-pipeline.yml   # GitHub Actions（Cron + 手動トリガー）
├── api/
│   └── index.js               # Vercel APIエンドポイント（3本）
├── scripts/
│   ├── generate-and-post.js   # メイン処理（生成→投稿）
│   ├── post-facebook.js       # Meta Graph API 投稿モジュール
│   ├── post-x.js              # X API v2 スレッド投稿モジュール
│   └── prompts.js             # コンテンツ変換プロンプト定義
├── content/
│   └── articles.json          # 投稿キュー（pending/posted管理）
├── logs/                      # 実行ログ（自動生成）
├── vercel.json
└── package.json
```

---

## セットアップ手順

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. GitHub Secrets の登録

リポジトリの `Settings → Secrets → Actions` で以下を登録します。

| Secret名 | 内容 |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic コンソールで発行 |
| `META_PAGE_ID` | FacebookページID（数字） |
| `META_PAGE_ACCESS_TOKEN` | Meta Business Suite → アクセストークン（長期トークン） |
| `X_APP_KEY` | X Developer Portal → Consumer Key |
| `X_APP_SECRET` | X Developer Portal → Consumer Secret |
| `X_ACCESS_TOKEN` | X Developer Portal → Access Token |
| `X_ACCESS_SECRET` | X Developer Portal → Access Token Secret |
| `GH_PAT` | GitHub → Settings → PAT（`repo` + `workflow` スコープ） |
| `GH_REPO` | `your-org/nexccess-sns` 形式 |
| `SUPABASE_URL` | Supabaseプロジェクト設定より |
| `SUPABASE_SERVICE_KEY` | Supabase → Service Role Key |

### 3. Vercel 環境変数の登録

Vercel ダッシュボード → Project → Settings → Environment Variables:

```
ANTHROPIC_API_KEY=...
META_PAGE_ID=...
META_PAGE_ACCESS_TOKEN=...
X_APP_KEY=...
X_APP_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_SECRET=...
GH_PAT=...
GH_REPO=your-org/nexccess-sns
API_SECRET=<任意の強固なランダム文字列>
LINE_OFFICIAL_URL=https://lin.ee/xxxxxxx
```

### 4. Vercel へデプロイ

```bash
npx vercel --prod
```

---

## 使い方

### 記事を追加して即時投稿（Vercel API 経由）

```bash
# 新記事を追加
curl -X POST https://your-app.vercel.app/api/articles \
  -H "Authorization: Bearer <API_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "エステサロンが資金繰りに詰まる前にやるべきこと",
    "body": "記事本文...",
    "source_url": "https://note.com/nexccess/n/xxx",
    "industry_tags": ["beauty"]
  }'

# パイプラインを手動発火
curl -X POST https://your-app.vercel.app/api/trigger \
  -H "Authorization: Bearer <API_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"article_index": "latest"}'

# 直近5件の実行ステータスを確認
curl https://your-app.vercel.app/api/status \
  -H "Authorization: Bearer <API_SECRET>"
```

### articles.json を直接編集して投稿

`content/articles.json` に記事を追記してmainブランチにpushすると、
GitHub Actionsが自動検知して投稿パイプラインが走ります。

---

## スケジュール

| トリガー | 内容 |
|---|---|
| 毎日 06:00 JST | `pending` の最古記事を自動投稿 |
| `articles.json` push | 新記事を検知して即時投稿 |
| `/api/trigger` POST | Make / n8n などから手動発火 |

---

## 拡張ポイント

- **Instagram対応**: `scripts/post-instagram.js` を追加し、Canva APIでテンプレ画像を生成してからIG Graph APIへ投稿
- **LINE連携**: 投稿後に `LINE Messaging API` でフォロワーへ通知を自動送信
- **Supabase分析**: 投稿IDを保存し、翌日のエンゲージメント数をAPIで取得してClaude APIでA/B改善ループを構築
