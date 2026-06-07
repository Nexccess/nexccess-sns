// scripts/post-note.js
// Note自動投稿スクリプト（Node.js / fetch直接呼び出し）

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 記事選択（generate-and-post.jsと同方式）────────────────────────────────
function loadArticle() {
  const articlesPath = join(__dirname, '../content/articles.json');
  const articles = JSON.parse(readFileSync(articlesPath, 'utf-8'));
  if (!Array.isArray(articles) || articles.length === 0) {
    throw new Error('articles.json is empty or not an array.');
  }
  const today = new Date();
  const index = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000) % articles.length;
  return articles[index];
}

// ── Gemini（fetch直接呼び出し）────────────────────────────────────────────
async function generateNoteArticle(article) {
  const apiKey = process.env.GEMINI_API_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

  const prompt = `
あなたはビジネス系メディアの編集者です。以下の情報を元にnote記事を作成してください。

【タイトル】${article.title}
【本文】${article.body}
【URL】${article.url ?? ''}

【出力ルール】
- 文字数：1200〜1500文字
- 見出し3つ（## 見出し）
- です/ます調
- 末尾にCTA（「詳しくはこちら」＋URL）を自然に挿入
- 末尾にハッシュタグ3個（例：#資金調達 #中小企業 #融資）
- 宣伝色を出さず読者の課題解決に寄り添う文体
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

// ── Note投稿 ──────────────────────────────────────────────────────────────
async function postToNote(title, body) {
  const sessionId = process.env.NOTE_SESSION_ID;

  // Step1: 下書き作成
  const createRes = await fetch('https://note.com/api/v2/text_notes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `_note_session_id=${sessionId}`,
      'User-Agent': 'Mozilla/5.0 (compatible; NexcessBot/1.0)',
      'Referer': 'https://note.com',
    },
    body: JSON.stringify({
      text_note: {
        name: title,
        body: body,
        status: 'draft',
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Note下書き作成失敗 [${createRes.status}]: ${err}`);
  }

  const createData = await createRes.json();
  const noteKey = createData.data?.key;
  if (!noteKey) throw new Error(`note keyが取得できませんでした: ${JSON.stringify(createData)}`);

  // Step2: 公開
  const publishRes = await fetch(`https://note.com/api/v2/text_notes/${noteKey}/publish`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `_note_session_id=${sessionId}`,
      'User-Agent': 'Mozilla/5.0 (compatible; NexcessBot/1.0)',
      'Referer': 'https://note.com',
    },
    body: JSON.stringify({ status: 'published' }),
  });

  if (!publishRes.ok) {
    const err = await publishRes.text();
    throw new Error(`Note公開失敗 [${publishRes.status}]: ${err}`);
  }

  const publishData = await publishRes.json();
  return publishData.data?.note_url ?? `https://note.com/nexccess/n/${noteKey}`;
}

// ── Main ──────────────────────────────────────────────────────────────────
(async () => {
  try {
    console.log('📰 Loading article...');
    const article = loadArticle();
    console.log(`   Title: ${article.title}`);

    console.log('🤖 Generating note article with gemini-2.5-flash-lite...');
    const noteBody = await generateNoteArticle(article);
    console.log(`   生成文字数: ${noteBody.length}文字`);

    console.log('📝 Posting to Note...');
    const url = await postToNote(article.title, noteBody);
    console.log(`✅ Note投稿成功: ${url}`);

    console.log('🎉 Completed.');
  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  }
})();
