/**
 * generate-and-post.js
 * メインオーケストレーター
 * Claude API でコンテンツ生成 → Facebook / X へ同時投稿
 */

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { buildFacebookPrompt, buildXPrompt, buildRandomizerPrompt } = require('./prompts');
const { postToFacebook } = require('./post-facebook');
const { postThread, parseThreadText } = require('./post-x');

const ARTICLES_PATH = path.join(__dirname, '../content/articles.json');
const LOGS_DIR = path.join(__dirname, '../logs');

// ログディレクトリを確認・作成
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** Claude API でテキスト生成（共通関数） */
async function generate(prompt) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content[0].text.trim();
}

/** articles.json から投稿対象記事を1件取得 */
function pickArticle() {
  const articles = JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf-8'));
  const idx = process.env.ARTICLE_INDEX;

  if (idx && idx !== 'latest') {
    return articles[parseInt(idx, 10)] ?? articles[0];
  }
  // pending の中で最も古いものを選ぶ
  const pending = articles.filter((a) => a.status === 'pending');
  if (pending.length === 0) throw new Error('投稿可能な記事がありません（全て posted）');
  return pending.sort((a, b) => new Date(a.published_at) - new Date(b.published_at))[0];
}

/** 記事のステータスを "posted" に更新して保存 */
function markAsPosted(articleId) {
  const articles = JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf-8'));
  const target = articles.find((a) => a.id === articleId);
  if (target) {
    target.status = 'posted';
    target.posted_at = new Date().toISOString();
  }
  fs.writeFileSync(ARTICLES_PATH, JSON.stringify(articles, null, 2), 'utf-8');
}

/** 実行ログをJSONファイルへ保存 */
function saveLog(log) {
  const filename = `${LOGS_DIR}/post-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(log, null, 2), 'utf-8');
  console.log(`[Log] 保存: ${filename}`);
}

/** メイン処理 */
async function main() {
  const log = { startedAt: new Date().toISOString(), results: {} };

  try {
    // 1. 投稿対象記事を取得
    const article = pickArticle();
    log.articleId = article.id;
    log.articleTitle = article.title;
    console.log(`\n📄 対象記事: ${article.title}`);

    // 業種タグから最初の1つを使用（複数ある場合は先頭）
    const industry = article.industry_tags?.[0] ?? 'beauty';

    // ─────────────────────────────────────────
    // 2. Facebook コンテンツ生成
    // ─────────────────────────────────────────
    console.log('\n[1/4] Facebook コンテンツ生成中...');
    const fbPrompt = buildFacebookPrompt(article, industry);
    let fbText = await generate(fbPrompt);

    // 10%揺らぎ適用（スパム判定回避）
    console.log('[2/4] Facebook テキストにランダム変化を適用...');
    fbText = await generate(buildRandomizerPrompt(fbText, 'Facebook'));
    log.results.facebook = { generated: fbText };

    // ─────────────────────────────────────────
    // 3. X (Twitter) スレッド生成
    // ─────────────────────────────────────────
    console.log('[3/4] X スレッド生成中...');
    const xPrompt = buildXPrompt(article, industry);
    let xRaw = await generate(xPrompt);

    // 10%揺らぎ適用
    xRaw = await generate(buildRandomizerPrompt(xRaw, 'X (Twitter)'));
    const xTweets = parseThreadText(xRaw, process.env.LINE_OFFICIAL_URL);
    log.results.x = { generated: xTweets };

    // ─────────────────────────────────────────
    // 4. 同時投稿
    // ─────────────────────────────────────────
    console.log('[4/4] SNS へ投稿中...');

    const [fbResult, xResult] = await Promise.allSettled([
      postToFacebook(fbText, article.source_url),
      postThread(xTweets),
    ]);

    // Facebook 結果
    if (fbResult.status === 'fulfilled') {
      log.results.facebook.postId = fbResult.value.id;
      log.results.facebook.status = 'success';
      console.log('✅ Facebook 投稿完了');
    } else {
      log.results.facebook.status = 'error';
      log.results.facebook.error = fbResult.reason.message;
      console.error('❌ Facebook 投稿失敗:', fbResult.reason.message);
    }

    // X 結果
    if (xResult.status === 'fulfilled') {
      log.results.x.tweetIds = xResult.value.map((t) => t.id);
      log.results.x.status = 'success';
      console.log('✅ X 投稿完了');
    } else {
      log.results.x.status = 'error';
      log.results.x.error = xResult.reason.message;
      console.error('❌ X 投稿失敗:', xResult.reason.message);
    }

    // 両方成功した場合のみ記事を "posted" にマーク
    if (fbResult.status === 'fulfilled' && xResult.status === 'fulfilled') {
      markAsPosted(article.id);
      console.log(`\n✅ 記事 "${article.title}" を posted にマークしました`);
    }

  } catch (err) {
    log.error = err.message;
    console.error('\n💥 致命的エラー:', err.message);
    process.exitCode = 1;
  } finally {
    log.finishedAt = new Date().toISOString();
    saveLog(log);
  }
}

main();
