import { TwitterApi } from "twitter-api-v2";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Twitter Client ────────────────────────────────────────────────────────────
const twitterClient = new TwitterApi({
  appKey: process.env.X_APP_KEY,
  appSecret: process.env.X_APP_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});
const rwClient = twitterClient.readWrite;

// ── Article Loader ────────────────────────────────────────────────────────────
function loadArticle() {
  const articlesPath = join(__dirname, "../content/articles.json");
  const articles = JSON.parse(readFileSync(articlesPath, "utf-8"));
  if (!Array.isArray(articles) || articles.length === 0) {
    throw new Error("articles.json is empty or not an array.");
  }
  const today = new Date();
  const index = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000) % articles.length;
  return articles[index];
}

// ── Gemini 2.5 Flash Lite (fetch直接呼び出し) ─────────────────────────────────
async function generatePosts(article) {
  const apiKey = process.env.GEMINI_API_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

  const prompt = `
以下の記事情報をもとに、SNS投稿文を日本語で2種類生成してください。

【記事タイトル】${article.title}
【記事本文】${article.body}
【URL】${article.url ?? ""}

出力形式（JSONのみ。コードブロック記号・余計なテキスト一切不要）:
{
  "facebook": "Facebookに投稿する文章（300文字以内、ハッシュタグ含む）",
  "twitter": "Xに投稿する文章（140文字以内、ハッシュタグ含む）"
}
`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!raw) throw new Error("Gemini returned empty content.");

  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  return JSON.parse(cleaned);
}

// ── Facebook Post ─────────────────────────────────────────────────────────────
async function postToFacebook(message, article) {
  const pageId = process.env.META_PAGE_ID;
  const token = process.env.META_PAGE_ACCESS_TOKEN;

  const body = { message, access_token: token };
  if (article.url) body.link = article.url;

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/feed`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`Facebook API error: ${JSON.stringify(json.error ?? json)}`);
  }
  console.log(`✅ Facebook posted. post_id=${json.id}`);
  return json;
}

// ── X (Twitter) Post ──────────────────────────────────────────────────────────
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

    console.log("🤖 Generating posts with gemini-2.5-flash-lite...");
    const posts = await generatePosts(article);
    console.log(`   Facebook : ${posts.facebook}`);
    console.log(`   X        : ${posts.twitter}`);

    await postToX(posts.twitter);

    try {
      await postToFacebook(posts.facebook, article);
    } catch (fbErr) {
      console.error("⚠️ Facebook post failed (non-fatal):", fbErr.message);
    }

    console.log("🎉 All posts completed.");
  } catch (err) {
    console.error("❌ Fatal error:", err);
    process.exit(1);
  }
})();
