/**
 * generate-and-post.js
 * メイン処理: Gemini APIによる動的生成 → Facebook / X / はてなブログ / Threads 同時投稿
 *
 * 技術仕様:
 * - ESM (import/export)
 * - twitter-api-v2 ライブラリ使用（既存踏襲）
 * - Gemini: fetch直接呼び出し、v1beta endpoint
 * - モデルフォールバック: gemini-2.5-flash-lite → gemini-1.5-flash → gemini-1.5-flash-8b
 * - articles.json 依存を完全廃止、4テーマ動的生成に移行
 */

import { TwitterApi } from "twitter-api-v2";
import { selectTheme, buildSystemPrompt, buildUserPrompt } from "./prompts.js";
import { postToFacebook } from "./post-facebook.js";
import { postToThreads } from "./post-threads.js";
import { postToHatena } from "./post-hatena.js";

// ── Twitter Client ─────────────────────────────────────────────────────────
const twitterClient = new TwitterApi({
  appKey: process.env.X_APP_KEY,
  appSecret: process.env.X_APP_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});
const rwClient = twitterClient.readWrite;

// ── Gemini API（フォールバック付き）───────────────────────────────────────
const GEMINI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];
const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

async function generatePosts(theme) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が設定されていません");

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(theme);

  const requestBody = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.85,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  };

  for (const model of GEMINI_MODELS) {
    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
    console.log(`🤖 Gemini モデル試行: ${model}`);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`   ⚠️  ${model} 失敗 (${res.status}): ${errText}`);
        continue;
      }

      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!raw) {
        console.warn(`   ⚠️  ${model}: レスポンステキストが空`);
        continue;
      }

      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

      const parsed = JSON.parse(cleaned);
      console.log(`   ✅ ${model}: 生成成功`);
      return parsed;
    } catch (err) {
      console.warn(`   ⚠️  ${model} 例外: ${err.message}`);
    }
  }

  throw new Error("全Geminiモデルでの生成に失敗しました");
}

// ── X 投稿 ────────────────────────────────────────────────────────────────
async function postToX(text) {
  const tweet = await rwClient.v2.tweet(text);
  console.log(`✅ X posted. tweet_id=${tweet.data.id}`);
  return tweet;
}

// ── Main ──────────────────────────────────────────────────────────────────
(async () => {
  try {
    console.log("=== SNS自動投稿パイプライン 開始 ===");
    console.log(`実行時刻: ${new Date().toISOString()}`);

    // 1. テーマ選定
    const theme = selectTheme();
    console.log(`\n📌 選定テーマ: ${theme.name}`);
    console.log(`   URL: ${theme.url}`);

    // 2. Gemini で全媒体分を一括生成
    console.log("\n🤖 コンテンツ生成中...");
    const posts = await generatePosts(theme);
    console.log(`   Facebook  : ${posts.facebook?.slice(0, 40)}...`);
    console.log(`   X         : ${posts.twitter}`);
    console.log(`   はてな    : ${posts.hatena_title}`);
    console.log(`   Threads   : ${posts.threads?.slice(0, 40)}...`);

    // 3. 4媒体へ並列投稿（allSettled で片方失敗でも継続）
    console.log("\n📡 投稿開始...");
    const [xResult, fbResult, hatenaResult, threadsResult] =
      await Promise.allSettled([
        postToX(posts.twitter),
        postToFacebook(posts.facebook, theme.url),
        postToHatena(posts.hatena_title, posts.hatena_body),
        postToThreads(posts.threads),
      ]);

    // 4. 結果サマリ
    console.log("\n=== 投稿結果 ===");
    console.log(`X           : ${xResult.status === "fulfilled" ? "✅ 成功" : `❌ 失敗 - ${xResult.reason?.message}`}`);
    console.log(`Facebook    : ${fbResult.status === "fulfilled" ? "✅ 成功" : `❌ 失敗 - ${fbResult.reason?.message}`}`);
    console.log(`はてなブログ: ${hatenaResult.status === "fulfilled" ? "✅ 成功" : `❌ 失敗 - ${hatenaResult.reason?.message}`}`);
    console.log(`Threads     : ${threadsResult.status === "fulfilled" ? "✅ 成功" : `❌ 失敗 - ${threadsResult.reason?.message}`}`);

    // 5. 全媒体失敗時のみ異常終了
    const allFailed = [xResult, fbResult, hatenaResult, threadsResult].every(
      (r) => r.status === "rejected"
    );
    if (allFailed) throw new Error("全媒体への投稿に失敗しました");

    console.log("\n🎉 パイプライン完了");
  } catch (err) {
    console.error("❌ Fatal error:", err.message);
    process.exit(1);
  }
})();
