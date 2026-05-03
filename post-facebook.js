/**
 * post-facebook.js
 * Meta Graph API 経由で Facebook ページへ投稿する
 *
 * 必要な環境変数:
 *   META_PAGE_ID           — FacebookページのID
 *   META_PAGE_ACCESS_TOKEN — ページアクセストークン（長期トークン推奨）
 */

const GRAPH_API_VERSION = 'v19.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Facebookページへテキスト投稿
 * @param {string} message    投稿本文
 * @param {string} [link]     添付リンク（省略可）
 * @returns {Promise<{id: string}>}
 */
async function postToFacebook(message, link = null) {
  const pageId = process.env.META_PAGE_ID;
  const token = process.env.META_PAGE_ACCESS_TOKEN;

  if (!pageId || !token) {
    throw new Error('META_PAGE_ID または META_PAGE_ACCESS_TOKEN が未設定です');
  }

  const body = {
    message,
    access_token: token,
  };

  // リンクがあれば添付（OGPが展開されクリック率UP）
  if (link) {
    body.link = link;
  }

  const res = await fetch(`${GRAPH_BASE}/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    const errMsg = data.error?.message || `HTTP ${res.status}`;
    throw new Error(`Facebook投稿エラー: ${errMsg}`);
  }

  console.log(`[Facebook] 投稿成功 → post_id: ${data.id}`);
  return data; // { id: "page_id_post_id" }
}

/**
 * 投稿が成功しているか事後確認（任意）
 * @param {string} postId  postToFacebook() が返した id
 */
async function verifyFacebookPost(postId) {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const res = await fetch(
    `${GRAPH_BASE}/${postId}?fields=message,created_time&access_token=${token}`
  );
  return res.json();
}

module.exports = { postToFacebook, verifyFacebookPost };
