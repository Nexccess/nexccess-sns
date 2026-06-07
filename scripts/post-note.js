// scripts/post-note.js
// Note自動投稿スクリプト（Node.js / fetch + Cookie認証）

import { readFileSync, writeFileSync } from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

const NOTE_SESSION_ID = process.env.NOTE_SESSION_ID;
const GEMINI_API_KEY  = process.env.GEMINI_API_KEY;

// ── 記事選択 ─────────────────────────────────────────────
function selectArticle() {
  const articles = JSON.parse(readFileSync('content/articles.json', 'utf8'));

  // 日付ベースのインデックス選択（既存generate-and-post.jsと同方式）
  const dayIndex = Math.floor(Date.now() / 86400000) % articles.length;
  return articles[dayIndex];
}

// ── Geminiでnote用記事生成 ────────────────────────────────
async function generateNoteArticle(article) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite-preview-06-17' });

  const prompt = `
あなたはビジネス系メディアの編集者です。以下の情報を元にnote記事を作成してください。

【タイトル】${article.title}
【本文】${article.body}
【URL】${article.url}

【出力形式】
- 文字数：1200〜1500文字
- 構成：見出し3つ（## 見出し）
- 語調：です/ます調
- 末尾にCTA（「詳しくはこちら」＋URL）を自然に挿入
- ハッシュタグ3個を末尾に追加（例：#資金調達 #中小企業 #融資）

【制約】
- 宣伝色を出さず、読者の課題解決に寄り添う文体
- 具体的な数字・事例を含める
- 出力は記事本文のみ（説明不要）
`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// ── Note投稿 ──────────────────────────────────────────────
async function postToNote(title, body) {
  // Step1: 下書き作成
  const createRes = await fetch('https://note.com/api/v2/text_notes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `_note_session_id=${NOTE_SESSION_ID}`,
      'User-Agent': 'Mozilla/5.0 (compatible; NexcessBot/1.0)',
      'Referer': 'https://note.com',
    },
    body: JSON.stringify({
      text_note: {
        name: title,
        body: body,
        status: 'draft',
      }
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Note下書き作成失敗 [${createRes.status}]: ${err}`);
  }

  const createData = await createRes.json();
  const noteKey = createData.data?.key;
  if (!noteKey) throw new Error('note keyが取得できませんでした');

  // Step2: 公開
  const publishRes = await fetch(`https://note.com/api/v2/text_notes/${noteKey}/publish`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `_note_session_id=${NOTE_SESSION_ID}`,
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

// ── メイン ────────────────────────────────────────────────
async function main() {
  if (!NOTE_SESSION_ID) throw new Error('NOTE_SESSION_ID が未設定です');
  if (!GEMINI_API_KEY)  throw new Error('GEMINI_API_KEY が未設定です');

  const article = selectArticle();
  console.log(`📝 選択記事: ${article.title}`);

  const noteBody = await generateNoteArticle(article);
  console.log(`✍️  生成完了: ${noteBody.length}文字`);

  const url = await postToNote(article.title, noteBody);
  console.log(`✅ Note投稿成功: ${url}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
