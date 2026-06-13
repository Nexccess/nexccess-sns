/**
 * post-facebook.js
 * Meta Graph API 投稿モジュール（URL強制結合版）
 *
 * 環境変数: META_PAGE_ID / META_PAGE_ACCESS_TOKEN
 * Graph API v21.0
 */

export async function postToFacebook(message, url) {
  const pageId = process.env.META_PAGE_ID;
  const token  = process.env.META_PAGE_ACCESS_TOKEN;

  if (!pageId || !token) {
    throw new Error("META_PAGE_ID または META_PAGE_ACCESS_TOKEN が設定されていません");
  }

  // 本文末尾にURL強制結合（リーチ維持のためリンクは本文へ）
  const finalMessage = `${message}\n\n▼ 詳細はこちら\n${url}`;

  // Step1: 本文投稿
  const postRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: finalMessage, access_token: token }),
  });

  const postJson = await postRes.json();
  if (!postRes.ok || postJson.error) {
    throw new Error(`Facebook API error: ${JSON.stringify(postJson.error ?? postJson)}`);
  }
  console.log(`✅ Facebook posted. post_id=${postJson.id}`);

  // Step2: コメントにも導線を追加（非致命的）
  try {
    await fetch(`https://graph.facebook.com/v21.0/${postJson.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `経営の一次整理・診断はこちらから ➔ ${url}`,
        access_token: token,
      }),
    });
  } catch (e) {
    console.warn(`⚠️ Facebookコメント投稿失敗 (non-fatal): ${e.message}`);
  }

  return postJson;
}
