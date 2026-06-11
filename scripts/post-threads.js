/**
 * post-threads.js
 * Threads投稿モジュール（ESM / Threads Graph API v1.0）
 *
 * 既存踏襲:
 * - 環境変数: THREADS_USER_ID / THREADS_ACCESS_TOKEN
 * - 2ステップ方式（コンテナ作成 → 公開）
 * - 500文字上限トリミング
 */

export async function postToThreads(text) {
  const userId      = process.env.THREADS_USER_ID;
  const accessToken = process.env.THREADS_ACCESS_TOKEN;

  if (!userId || !accessToken) {
    throw new Error("THREADS_USER_ID または THREADS_ACCESS_TOKEN が設定されていません");
  }

  // 500文字上限トリミング（既存ロジック踏襲）
  const trimmedText = text.length > 490
    ? text.slice(0, 487) + "..."
    : text;
  if (text.length > 490) {
    console.warn(`⚠️  Threads文字数超過のためトリミング: ${trimmedText.length}文字`);
  }

  // Step1: コンテナ作成
  const createRes = await fetch(
    `https://graph.threads.net/v1.0/${userId}/threads`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "TEXT",
        text: trimmedText,
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
  if (!containerId) {
    throw new Error(`container_idが取得できませんでした: ${JSON.stringify(createData)}`);
  }

  // Step2: 公開
  const publishRes = await fetch(
    `https://graph.threads.net/v1.0/${userId}/threads_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  console.log(`✅ Threads投稿成功: post_id=${publishData.id}`);
  return publishData.id;
}
