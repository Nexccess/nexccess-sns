/**
 * api/index.js
 * Vercel Serverless Functions — SNSパイプライン制御エンドポイント
 *
 * エンドポイント一覧:
 *   POST /api/trigger   旧SNS配信の停止を通知
 *   POST /api/articles  新しい記事を articles.json に追加
 *   GET  /api/status    直近の投稿ログを返す
 *
 * デプロイ: vercel.json の rewrites で /api/* → この関数にルーティング
 */

// ─────────────────────────────────────────────────
// 簡易ルーター（Vercel は1ファイル1関数なので自前で振り分け）
// ─────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS ヘッダー（Make / 外部Webhookから叩く場合に必要）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url.split('?')[0];
  if (req.method === 'POST' && url === '/api/trigger') {
    return res.status(410).json({ error: 'Legacy SNS publishing is disabled' });
  }

  // Bearer トークン認証（GitHub Secrets と同じ値を使用）
  const authHeader = req.headers.authorization ?? '';
  if (authHeader !== `Bearer ${process.env.API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (req.method === 'POST' && url === '/api/articles') {
      return await handleAddArticle(req, res);
    }
    if (req.method === 'GET' && url === '/api/status') {
      return await handleStatus(req, res);
    }
    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────
// POST /api/articles
// Note の新記事を受け取り、GitHub 上の articles.json を更新
// Body: { title, body, source_url, industry_tags }
// ─────────────────────────────────────────────────
async function handleAddArticle(req, res) {
  const { title, body, source_url, industry_tags = ['beauty'] } = req.body ?? {};
  if (!title || !body) {
    return res.status(400).json({ error: 'title と body は必須です' });
  }

  // GitHub Contents API 経由でファイルを取得→更新
  const fileUrl = `https://api.github.com/repos/${process.env.GH_REPO}/contents/content/articles.json`;
  const ghHeaders = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${process.env.GH_PAT}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  const getRes = await fetch(fileUrl, { headers: ghHeaders });
  const fileData = await getRes.json();
  const articles = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));

  const newArticle = {
    id: `article-${Date.now()}`,
    status: 'pending',
    source: 'note',
    title,
    body,
    source_url: source_url ?? '',
    industry_tags,
    published_at: new Date().toISOString(),
  };
  articles.push(newArticle);

  const updated = Buffer.from(JSON.stringify(articles, null, 2), 'utf-8').toString('base64');

  const putRes = await fetch(fileUrl, {
    method: 'PUT',
    headers: ghHeaders,
    body: JSON.stringify({
      message: `feat: add article "${title}"`,
      content: updated,
      sha: fileData.sha,
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    return res.status(500).json({ error: `GitHub 更新失敗: ${err}` });
  }

  return res.status(201).json({ ok: true, article: newArticle });
}

// ─────────────────────────────────────────────────
// GET /api/status
// GitHub Actions の直近ワークフロー実行結果を返す
// ─────────────────────────────────────────────────
async function handleStatus(req, res) {
  const runsRes = await fetch(
    `https://api.github.com/repos/${process.env.GH_REPO}/actions/workflows/sns-pipeline.yml/runs?per_page=5`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${process.env.GH_PAT}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );
  const runsData = await runsRes.json();

  const runs = (runsData.workflow_runs ?? []).map((r) => ({
    id: r.id,
    status: r.status,       // queued / in_progress / completed
    conclusion: r.conclusion, // success / failure / null
    created_at: r.created_at,
    html_url: r.html_url,
  }));

  return res.status(200).json({ ok: true, runs });
}
