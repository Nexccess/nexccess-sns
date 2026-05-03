/**
 * post-x.js
 * X (Twitter) API v2 経由でツイート／スレッドを投稿する
 *
 * 依存: twitter-api-v2
 * 必要な環境変数:
 *   X_APP_KEY       — APIキー (Consumer Key)
 *   X_APP_SECRET    — APIシークレット (Consumer Secret)
 *   X_ACCESS_TOKEN  — アクセストークン
 *   X_ACCESS_SECRET — アクセストークンシークレット
 */

const { TwitterApi } = require('twitter-api-v2');

/** X APIクライアントをシングルトンで初期化 */
function getXClient() {
  const { X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
  if (!X_APP_KEY || !X_APP_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
    throw new Error('X API の認証情報が1つ以上未設定です');
  }
  return new TwitterApi({
    appKey: X_APP_KEY,
    appSecret: X_APP_SECRET,
    accessToken: X_ACCESS_TOKEN,
    accessSecret: X_ACCESS_SECRET,
  });
}

/**
 * 単一ツイートを投稿
 * @param {string} text  ツイート本文（280文字以内）
 * @returns {Promise<{id: string, text: string}>}
 */
async function postTweet(text) {
  const client = getXClient();
  const { data } = await client.v2.tweet(text);
  console.log(`[X] ツイート投稿成功 → id: ${data.id}`);
  return data;
}

/**
 * スレッド（連続ツイート）を投稿
 * 各ツイートを前のツイートへのリプライとして連結する
 *
 * @param {string[]} tweets  ツイート本文の配列（1要素目がフック）
 * @returns {Promise<Array<{id: string, text: string}>>}
 */
async function postThread(tweets) {
  if (!tweets || tweets.length === 0) {
    throw new Error('スレッドのツイートが空です');
  }

  const client = getXClient();
  const results = [];
  let replyToId = null;

  for (const [index, text] of tweets.entries()) {
    // 文字数チェック（280字超はトリム+省略記号）
    const safeText = text.length > 280 ? text.slice(0, 277) + '…' : text;

    const payload = { text: safeText };
    if (replyToId) {
      payload.reply = { in_reply_to_tweet_id: replyToId };
    }

    const { data } = await client.v2.tweet(payload);
    results.push(data);
    replyToId = data.id;

    console.log(`[X] スレッド ${index + 1}/${tweets.length} 投稿 → id: ${data.id}`);

    // ツイート間に2秒のインターバル（レートリミット対策）
    if (index < tweets.length - 1) {
      await sleep(2000);
    }
  }

  return results;
}

/**
 * 生成テキストを「---」区切りでスレッド配列に変換する
 * @param {string} rawText  プロンプトが返したスレッドテキスト
 * @param {string} lineUrl  CTAに埋め込むLINE登録URL
 * @returns {string[]}
 */
function parseThreadText(rawText, lineUrl = process.env.LINE_OFFICIAL_URL || '') {
  return rawText
    .split('---')
    .map((t) => t.trim().replace('{LINE_URL}', lineUrl))
    .filter((t) => t.length > 0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { postTweet, postThread, parseThreadText };
