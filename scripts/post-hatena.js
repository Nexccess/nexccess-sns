/**
 * post-hatena.js
 * はてなブログ投稿モジュール（Markdown対応・URL強制結合版）
 *
 * 環境変数: HATENA_ID / HATENA_BLOG / HATENA_API_KEY
 * content-type: text/x-markdown（改行・段落を正しく反映）
 */

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function postToHatena(title, body, url) {
  const hatenaId   = process.env.HATENA_ID;
  const hatenaBlog = process.env.HATENA_BLOG;
  const apiKey     = process.env.HATENA_API_KEY;

  if (!hatenaId || !hatenaBlog || !apiKey) {
    throw new Error("HATENA_ID / HATENA_BLOG / HATENA_API_KEY のいずれかが未設定です");
  }

  const endpoint = `https://blog.hatena.ne.jp/${hatenaId}/${hatenaBlog}/atom/entry`;

  // 選定テーマのURLを動的に結合（固定ドメイン廃止）
  const finalBody = `${body}\n\n---\n\n【今回のテーマに関する詳細・AI診断はこちら】\n-> [公式ページへ直結](${url})`;

  // text/x-markdown 指定で改行・段落・リンク記法をブログ上に正しく反映
  const entry = `<?xml version="1.0" encoding="utf-8"?>
<entry xmlns="http://www.w3.org/2005/Atom"
       xmlns:app="http://www.w3.org/2007/app">
  <title>${escapeXml(title)}</title>
  <content type="text/x-markdown">${escapeXml(finalBody)}</content>
  <app:control>
    <app:draft>no</app:draft>
  </app:control>
</entry>`;

  const credentials = Buffer.from(`${hatenaId}:${apiKey}`).toString("base64");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      Authorization: `Basic ${credentials}`,
    },
    body: entry,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`はてなブログ投稿失敗 [${res.status}]: ${err}`);
  }

  const xml = await res.text();
  const match = xml.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/);
  const url = match?.[1] ?? `https://${hatenaBlog}/`;
  console.log(`✅ はてなブログ投稿成功 (Markdown): ${url}`);
  return url;
}
