// scripts/post-github-pages.js
// GitHub Pages 自動記事公開スクリプト（Node.js / GitHub Contents API）

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
  // 他媒体と重複しないよう2日ずらす
  const index = (Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000) + 2) % articles.length;
  return articles[index];
}

// ── Gemini（fetch直接呼び出し）──────────────────────────────────────────
async function generateArticle(article) {
  const apiKey = process.env.GEMINI_API_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

  const prompt = `
あなたはビジネス系メディアの編集者です。以下の情報を元にWeb記事を作成してください。

【タイトル】${article.title}
【本文】${article.body}
【URL】${article.url ?? ''}

【出力ルール】
- 文字数：1500〜2000文字
- 見出し4つ
- です/ます調
- 具体的な数字・事例を含める
- 末尾にCTA（「詳しくはこちら」＋URL）を自然に挿入
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

// ── HTML生成 ─────────────────────────────────────────────────────────────
function buildHtml(title, body, date) {
  const bodyHtml = body
    .split('\n')
    .map(line => {
      if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith('# '))  return `<h1>${line.slice(2)}</h1>`;
      if (line.trim() === '')     return '';
      return `<p>${line}</p>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Nexcess</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #333; line-height: 1.8; }
    h1 { font-size: 1.8rem; color: #0B1220; border-bottom: 2px solid #C8A45A; padding-bottom: 12px; }
    h2 { font-size: 1.3rem; color: #0B1220; margin-top: 40px; }
    p  { margin: 16px 0; }
    .meta { color: #888; font-size: 0.9rem; margin-bottom: 32px; }
    .back { margin-top: 60px; }
    .back a { color: #C8A45A; text-decoration: none; }
  </style>
</head>
<body>
  <p class="meta">${date} | Nexcess</p>
  <h1>${title}</h1>
  ${bodyHtml}
  <div class="back"><a href="/nexccess-sns/">← 記事一覧へ</a></div>
</body>
</html>`;
}

// ── GitHub Contents API でファイルをpush ────────────────────────────────
async function pushToGitHub(filename, content) {
  const token = process.env.GH_PAT;
  const repo  = process.env.GH_REPO; // 例: Nexccess/nexccess-sns
  const path  = `blog/${filename}`;
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;

  // 既存ファイルのSHAを取得（更新時に必要）
  let sha;
  const getRes = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
    },
  });
  if (getRes.ok) {
    const existing = await getRes.json();
    sha = existing.sha;
  }

  const body = {
    message: `post: add blog article ${filename}`,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch: 'main',
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`GitHub push失敗 [${putRes.status}]: ${err}`);
  }

  return `https://nexccess.github.io/nexccess-sns/${path}`;
}

// ── Main ──────────────────────────────────────────────────────────────────
(async () => {
  try {
    console.log('📰 Loading article...');
    const article = loadArticle();
    console.log(`   Title: ${article.title}`);

    console.log('🤖 Generating article with gemini-2.5-flash-lite...');
    const body = await generateArticle(article);
    console.log(`   生成文字数: ${body.length}文字`);

    const today = new Date().toISOString().slice(0, 10);
    const slug  = today;
    const filename = `${slug}.html`;
    const html = buildHtml(article.title, body, today);

    console.log('🚀 Pushing to GitHub Pages...');
    const url = await pushToGitHub(filename, html);
    console.log(`✅ GitHub Pages公開成功: ${url}`);

    console.log('🎉 Completed.');
  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  }
})();
