/**
 * post-threads.js
 * Threads投稿モジュール（URL強制結合・500文字制限対応版）
 *
 * 環境変数: THREADS_USER_ID / THREADS_ACCESS_TOKEN
 * 2ステップ方式（コンテナ作成 → 公開）
 */

export async function postToThreads(text, url) {
  const userId      = process.env.THREADS_USER_ID;
  const accessToken = process.env.THREADS_ACCESS_TOKEN;

  if (!userId || !accessToken) {
    throw new Error("THREADS_USER_ID または THREADS_ACCESS_TOKEN が設定されていません");
  }

  // URL強制結合（URLが削られないよう本文側を安全にトリミング）
  const suffix = `\n\n▼ 詳細はこちら\n${url}`;
  const maxBodyLength = 490 - suffix.length;
  const trimmedText = text.length > maxBodyLength
    ? text.slice(0, maxBodyLength - 3) + "..."
    : text;
  const finalText = `${trimmedText}${suffix}`;

  // Step1: コンテナ作成
  const createRes = await fetch(
    `https://graph.threads.net/v1.0/${userId}/threads`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "TEXT",
        text: finalText,
        access_token: accessToken,
      }),
    }
  );

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Threadsコンテナ作成失敗 [${createRes.status}]: ${err}`);
  }

  const { id: containerId } = await createRes.json();
  if (!containerId) throw new Error("container_idが取得できませんでした");

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
