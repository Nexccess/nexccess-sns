// scripts/post-hatena.js
// はてなブログ自動投稿スクリプト（Node.js / AtomPub API）

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
  // Noteと重複しないよう1日ずらす
  const index = (Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000) + 1) % articles.length;
  return articles[index];
}

// ── Gemini（fetch直接呼び出し）──────────────────────────────────────────
async function generateHatenaArticle(article) {
  const apiKey = process.env.GEMINI_API_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

  const prompt = `
あなたはビジネス系メディアの編集者です。以下の情報を元にはてなブログ記事を作成してください。

【タイトル】${article.title}
【本文】${article.body}
【URL】${article.url ?? ''}

【出力ルール】
- 文字数：1500〜2000文字
- 見出し4つ（** 見出し **）
- である調・やや専門的
- 具体的な数字・事例を含める
- 末尾にCTA（「詳しくはこちら」＋URL）を自然に挿入
- 末尾にカテゴリタグを1個（例：資金調達）
- 出力は記事本文のみ（説明・コードブロック不要）
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

// ── はてなブログ投稿（AtomPub）──────────────────────────────────────────
async function postToHatena(title, body) {
  const hatenaId  = process.env.HATENA_ID;
  const hatenaBlog = process.env.HATENA_BLOG;
  const apiKey    = process.env.HATENA_API_KEY;

  const endpoint = `https://blog.hatena.ne.jp/${hatenaId}/${hatenaBlog}/atom/entry`;

  const entry = `<?xml version="1.0" encoding="utf-8"?>
<entry xmlns="http://www.w3.org/2005/Atom"
       xmlns:app="http://www.w3.org/2007/app">
  <title>${escapeXml(title)}</title>
  <content type="text/plain">${escapeXml(body)}</content>
  <app:control>
    <app:draft>no</app:draft>
  </app:control>
</entry>`;

  const credentials = Buffer.from(`${hatenaId}:${apiKey}`).toString('base64');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Authorization': `Basic ${credentials}`,
    },
    body: entry,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`はてなブログ投稿失敗 [${res.status}]: ${err}`);
  }

  const xml = await res.text();
  const match = xml.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/);
  return match?.[1] ?? `https://${hatenaBlog}/`;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── Main ──────────────────────────────────────────────────────────────
(async () => {
  try {
    console.log('📰 Loading article...');
    const article = loadArticle();
    console.log(`   Title: ${article.title}`);

    console.log('🤖 Generating hatena article with gemini-2.5-flash-lite...');
    const hatenaBody = await generateHatenaArticle(article);
    console.log(`   生成文字数: ${hatenaBody.length}文字`);

    console.log('📝 Posting to Hatena Blog...');
    const url = await postToHatena(article.title, hatenaBody);
    console.log(`✅ はてなブログ投稿成功: ${url}`);

    console.log('🎉 Completed.');
  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  }
})();
