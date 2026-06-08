// scripts/post-note.js
// Note自動投稿スクリプト（Node.js / Note API v2）

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 記事選択 ──────────────────────────────────────────────────────────────
function loadArticle() {
  const articlesPath = join(__dirname, '../content/articles.json');
  const articles = JSON.parse(readFileSync(articlesPath, 'utf-8'));
  if (!Array.isArray(articles) || articles.length === 0) {
    throw new Error('articles.json is empty or not an array.');
  }
  const today = new Date();
  const index = (Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000) + 3) % articles.length;
  return articles[index];
}

// ── Gemini（記事生成）──────────────────────────────────────────────────────
async function generateNotePost(article) {
  const apiKey = process.env.GEMINI_API_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

  const prompt = `
以下の情報を元にNote記事を作成してください。

【タイトル】${article.title}
【本文】${article.body}
【URL】${article.url ?? ''}

【出力ルール】
- 文字数：1500〜2500文字
- 見出し（##）を使い読みやすく構成する
- 中小企業経営者・士業・相続検討者に向けた実用的な内容
- 末尾にURLを記載
- 出力は記事本文のみ（説明不要）
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

// ── Note投稿 ──────────────────────────────────────────────────────────────
async function postToNote(title, body) {
  const sessionId = process.env.NOTE_SESSION_ID;
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `_note_session_id=${sessionId}`,
    'User-Agent': 'Mozilla/5.0 (compatible; NexcessBot/1.0)',
    'Referer': 'https://editor.note.com',
    'Origin': 'https://editor.note.com',
  };

  const createRes = await fetch('https://editor.note.com/api/v2/text_notes', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text_note: {
        name: title,
        body: body,
        status: 'published',
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Note投稿失敗 [${createRes.status}]: ${err}`);
  }

  const createData = await createRes.json();
  const noteKey = createData.data?.key;
  if (!noteKey) throw new Error(`note keyが取得できませんでした: ${JSON.stringify(createData)}`);

  return createData.data?.note_url ?? `https://note.com/nex_naka/n/${noteKey}`;
}

// ── Main ──────────────────────────────────────────────────────────────────
(async () => {
  try {
    console.log('📰 Loading article...');
    const article = loadArticle();
    console.log(`   Title: ${article.title}`);

    console.log('🤖 Generating note post with gemini-2.5-flash-lite...');
    const postBody = await generateNotePost(article);
    console.log(`   生成文字数: ${postBody.length}文字`);

    console.log('📝 Posting to Note...');
    const noteUrl = await postToNote(article.title, postBody);
    console.log(`✅ Note投稿成功: ${noteUrl}`);

    console.log('🎉 Completed.');
  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  }
})();
