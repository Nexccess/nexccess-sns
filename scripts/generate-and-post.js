import { GoogleGenerativeAI } from "@google/generative-ai";
import { TwitterApi } from "twitter-api-v2";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Clients ──────────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const twitterClient = new TwitterApi({
  appKey: process.env.X_APP_KEY,
  appSecret: process.env.X_APP_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});
const rwClient = twitterClient.readWrite;

// ── Article loader ────────────────────────────────────────────────────────────
function loadArticle() {
  const articlesPath = join(__dirname, "../content/articles.json");
  const articles = JSON.parse(readFileSync(articlesPath, "utf-8"));
  if (!Array.isArray(articles) || articles.length === 0) {
    throw new Error("articles.json is empty or not an array.");
  }
  // 最新記事（先頭）を使用
  return articles[0];
}

// ── Gemini post generation ────────────────────────────────────────────────────
async function generatePosts(article) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  const prompt = `
以下の記事情報をもとに、SNS投稿文を日本語で2種類生成してください。

【記事タイトル】${article.title}
【記事本文】${article.body}
【URL】${article.url ?? ""}

出力形式（JSON のみ、余計なテキスト・コードブロック記号は不要）:
{
  "facebook": "Facebookに投稿する文章（300文字以内、ハッシュタグ含む）",
  "twitter": "Xに投稿する文章（140文字以内、ハッシュタグ含む）"
}
`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();

  // JSONブロック記号が混入した場合も除去
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

// ── Facebook post ─────────────────────────────────────────────────────────────
async function postToFacebook(message, article) {
  const pageId = process.env.META_PAGE_ID;
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const url = new URL(`https://graph.facebook.com/v19.0/${pageId}/feed`);

  const body = {
    message,
    access_token: token,
  };
  if (article.url) body.link = article.url;

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(
      `Facebook API error: ${JSON.stringify(json.error ?? json)}`
    );
  }
  console.log(`✅ Facebook posted. post_id=${json.id}`);
  return json;
}

// ── X (Twitter) post ──────────────────────────────────────────────────────────
async function postToX(text) {
  const tweet = await rwClient.v2.tweet(text);
  console.log(`✅ X posted. tweet_id=${tweet.data.id}`);
  return tweet;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    console.log("📰 Loading article...");
    const article = loadArticle();
    console.log(`   Title: ${article.title}`);

    console.log("🤖 Generating posts with Gemini 1.5 Flash...");
    const posts = await generatePosts(article);
    console.log(`   Facebook: ${posts.facebook}`);
    console.log(`   X:        ${posts.twitter}`);

    const results = await Promise.allSettled([
      postToFacebook(posts.facebook, article),
      postToX(posts.twitter),
    ]);

    let hasError = false;
    results.forEach((r, i) => {
      const platform = i === 0 ? "Facebook" : "X";
      if (r.status === "rejected") {
        console.error(`❌ ${platform} failed: ${r.reason}`);
        hasError = true;
      }
    });

    if (hasError) process.exit(1);
    console.log("🎉 All posts completed.");
  } catch (err) {
    console.error("❌ Fatal error:", err);
    process.exit(1);
  }
})();
