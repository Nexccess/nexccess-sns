// scripts/post-threads.js
// Threads自動投稿スクリプト（Node.js / Threads Graph API v1.0）

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 記事選択（既存と同方式）──────────────────────────────────────────────
function loadArticle() {
  const articlesPath = join(__dirname, '../content/articles.json');
  const articles = JSON.parse(readFileSync(articlesPath, 'utf-8'));
  if (!Array.isArray(articles) || articles.length === 0) {
    throw new Error('articles.json is empty or not an array.');
  }
  const today = new Date();
  const index = (Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000) + 2) % articles.length;
  return articles[index];
}

// ── Gemini（fetch直接呼び出し）──────────────────────────────────────────
async function generateThreadsPost(article) {
  const apiKey = process.env.GEMINI_API_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

  const prompt = `
以下の情報を元にThreads投稿文を作成してください。

【タイトル】${article.title}
【本文】${article.body}
【URL】${article.url ?? ''}

【出力ルール】
- 文字数：350〜450文字（厳守。500文字を超えると投稿が失敗します）
- 改行を適切に使い読みやすくする
- ハッシュタグ3個を末尾に追加
- 末尾にURLを記載
- 出力は投稿文のみ（説明不要）
`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new Error('Gemini returned empty content.');
  return text.trim();
}

// ── Threads投稿 ──────────────────────────────────────────────────────────
async function postToThreads(text) {
  const userId      = process.env.THREADS_USER_ID;
  const accessToken = process.env.THREADS_ACCESS_TOKEN;

  // Step1: コンテナ作成
  const createRes = await fetch(
    `https://graph.threads.net/v1.0/${userId}/threads`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'TEXT',
        text: text,
        access_token: accessToken,
      }),
    }
  );

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Threadsコンテナ作成失敗 [${createRes.status}]: ${err}`);
  }

  const createData = await createRes.json();
  const containerId = createData.id;
  if (!containerId) throw new Error(`container_idが取得できませんでした: ${JSON.stringify(createData)}`);

  // Step2: 公開
  const publishRes = await fetch(
    `https://graph.threads.net/v1.0/${userId}/threads_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    }
  );

  if (!publishRes.ok) {
    const err = await publishRes.text();
    throw new Error(`Threads公開失敗 [${publishRes.status}]: ${err}`);
  }

  const publishData = await publishRes.json();
  return publishData.id;
}

// ── Main ──────────────────────────────────────────────────────────────────
(async () => {
  try {
    console.log('📰 Loading article...');
    const article = loadArticle();
    console.log(`   Title: ${article.title}`);

    console.log('🤖 Generating threads post with gemini-2.5-flash-lite...');
    const postText = await generateThreadsPost(article);
    console.log(`   生成文字数: ${postText.length}文字`);

    // Threads API上限（500文字）超過時の強制トリミング
    const trimmedText = postText.length > 490
      ? postText.slice(0, 487) + '...'
      : postText;
    if (postText.length > 490) {
      console.log(`⚠️  文字数超過のためトリミング: ${trimmedText.length}文字`);
    }

    console.log('📝 Posting to Threads...');
    const postId = await postToThreads(trimmedText);
    console.log(`✅ Threads投稿成功: post_id=${postId}`);

    console.log('🎉 Completed.');
  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  }
})();
