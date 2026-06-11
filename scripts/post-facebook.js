/**
 * post-facebook.js
 * Meta Graph API 投稿モジュール（ESM）
 *
 * 既存踏襲:
 * - 環境変数: META_PAGE_ID / META_PAGE_ACCESS_TOKEN
 * - Graph API v21.0
 * - リンクはコメント方式（本文埋め込みよりリーチ有利）
 */

// ── Facebook 投稿 ─────────────────────────────────────────────────────────
export async function postToFacebook(message, url) {
  const pageId = process.env.META_PAGE_ID;
  const token = process.env.META_PAGE_ACCESS_TOKEN;

  if (!pageId || !token) {
    throw new Error("META_PAGE_ID または META_PAGE_ACCESS_TOKEN が設定されていません");
  }

  // Step1: 本文投稿
  const postRes = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/feed`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, access_token: token }),
    }
  );

  const postJson = await postRes.json();
  if (!postRes.ok || postJson.error) {
    throw new Error(`Facebook API error: ${JSON.stringify(postJson.error ?? postJson)}`);
  }
  console.log(`✅ Facebook posted. post_id=${postJson.id}`);

  // Step2: コメントでリンク追加（失敗は非致命的）
  if (url) {
    try {
      const commentRes = await fetch(
        `https://graph.facebook.com/v21.0/${postJson.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `詳しくはこちら → ${url}`,
            access_token: token,
          }),
        }
      );
      const commentJson = await commentRes.json();
      if (commentRes.ok && !commentJson.error) {
        console.log(`   コメント投稿完了: ${commentJson.id}`);
      }
    } catch (e) {
      console.warn(`   ⚠️  Facebookコメント投稿失敗 (non-fatal): ${e.message}`);
    }
  }

  return postJson;
}
