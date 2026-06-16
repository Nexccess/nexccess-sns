/**
 * prompts.js
 * 各SNS向けのプロンプト構築、テーマ定義、および遷移先（短縮URLベース）の統合管理
 *
 * 修正内容:
 * - ドメインをすべて「go.pathflow.org」に統一（404エラー対策）
 * - buildUserPrompt 内の Twitter（X）プロンプトからURL出力を完全削除（URL二重付与バグ対策）
 */

// ── テーマ・配信URL定義（go.pathflow.org 統一版） ─────────────────────────
const THEMES = [
  {
    id: "pathflow_main",
    name: "Path-Flow（経営可視化・AIナビゲーション）",
    url: "https://main.pathflow.org/",
    coreValue: "経営データの集約、AIによる次の一手の可視化、社長の現場依存からの脱却",
    painPoint: "社長が現場を離れると売上が落ちる、社員に任せたいのに任せられない",
    goUrl: {
      facebook: "https://go.pathflow.org/go/fb-main",
      x:        "https://go.pathflow.org/go/x-main",
      threads:  "https://go.pathflow.org/go/th-main",
      hatena:   "https://go.pathflow.org/go/ht-main"
    }
  },
  {
    id: "pathflow_shigyo",
    name: "士業向けPath-Flow",
    url: "https://shigyo.pathflow.org/",
    coreValue: "士業事務所の顧問先開拓・紹介信用のAI自動化、提案精度の向上",
    painPoint: "紹介頼みの限界、新規開拓に費やす時間と労力のロス",
    goUrl: {
      facebook: "https://go.pathflow.org/go/fb-shigyo",
      x:        "https://go.pathflow.org/go/x-shigyo",
      threads:  "https://go.pathflow.org/go/th-shigyo",
      hatena:   "https://go.pathflow.org/go/ht-shigyo"
    }
  },
  {
    id: "seisakukinyukouko",
    name: "政策金融公庫（融資審査・無料診断）",
    url: "https://www.seisakukinyukouko.site/index.html",
    coreValue: "AIシミュレーションによる融資通過率の可視化、事業計画のブラッシュアップ",
    painPoint: "融資を受けたいが準備が分からない、事業計画書の書き方が分からない、審査が不安",
    goUrl: {
      facebook: "https://go.pathflow.org/go/fb-koukou",
      x:        "https://go.pathflow.org/go/x-koukou",
      threads:  "https://go.pathflow.org/go/th-koukou",
      hatena:   "https://go.pathflow.org/go/ht-koukou"
    }
  },
  {
    id: "pathflow_souzoku",
    name: "相続（事業承継・資産防衛）",
    url: "https://souzoku.pathflow.org/",
    coreValue: "親族間トラブルの防止、最適な税制スキームの選択、円滑な株式・資産移転",
    painPoint: "将来の相続税が不安、何から手をつければ良いか分からない、後継者への引き継ぎに懸念",
    goUrl: {
      facebook: "https://go.pathflow.org/go/fb-souzoku",
      x:        "https://go.pathflow.org/go/x-souzoku",
      threads:  "https://go.pathflow.org/go/th-souzoku",
      hatena:   "https://go.pathflow.org/go/ht-souzoku"
    }
  }
];

export function selectTheme() {
  const idx = Math.floor(Math.random() * THEMES.length);
  return THEMES[idx];
}

// ── AIシステムプロンプト ──────────────────────────────────────────────────
export function buildSystemPrompt() {
  return `あなたは企業の経営参謀、およびプロのWEBマーケターです。
ターゲット層（中小企業経営者、個人事業主、創業検討者）の心理を深く洞察し、彼らの痛みに寄り添いつつ、解決策（提供サービス）へと自然に誘導する、極めて説得力の高いSNS投稿テキストを作成してください。

【出力形式】
必ず以下のキーを持つ純粋なJSONオブジェクトのみを出力してください。マークダウン（\`\`\`json 等）の装飾は一切不要です。
{
  "facebook": "Facebook用の長文コンテンツ（改行を含める）",
  "twitter": "X用の140文字以内のコンテンツ",
  "threads": "Threads用の短めかつストーリー性のあるコンテンツ",
  "hatena_title": "はてなブログ用の惹きつけるタイトル",
  "hatena_body": "はてなブログ用のリード文・解説（改行を含める）"
}`;
}

// ── AIユーザープロンプト（URL生成禁止版） ──────────────────────────────────
export function buildUserPrompt(theme) {
  return `以下の【配信テーマ】を元に、指定された各SNS向けの投稿文（JSON形式）を生成してください。

【重要制約・出力ルール】
1. すべての媒体（facebook, twitter, threads, hatena_body）において、テキスト本文内にURL（http... や pathflow.org... 等）は絶対に含めないでください。
   システム側が後から自動付与するため、AI側でURLを出力すると重複バグになります。URLの記述やプレースホルダーは一切禁止します。
2. 煽り表現や誇大広告、安っぽいキャッチコピーは禁止。専門家としての信頼性と、経営者がハッとするようなリアルな現場の課題感から文章を始めてください。

【配信テーマ情報】
- サービス名: ${theme.name}
- サービスの核心価値: ${theme.coreValue}
- ターゲットの悩み・痛み: ${theme.painPoint}

【各媒体の執筆指示】
- facebook: 
    ターゲットがスクロールを止めるような、相談現場でよくある経営者の一言から開始。
    課題の指摘だけでなく、なぜそれが起こるのかの構造的な原因を解説し、気づきを与える。
    文字数は300〜600文字程度。改行を適切に挟むこと。末尾は「詳細はこちら」などの自然な結びの1行で終わらせる（URLは書かない）。

- twitter: 
    【X用】140文字以内。本文のみを生成してください。URLは含めないでください。システム側で自動的に付与されます。
    煽り表現は禁止。相談現場でよくある一言から始める。ハッシュタグも不要。

- threads: 
    150〜200文字程度。Xよりも少しエッセイ風、あるいはストーリーテリングを意識したトーン。
    URLは含めない。

- hatena_title: 
    はてなブログのタイトル。クリックしたくなるが釣りではない、本質的な経営課題を突く言葉。
- hatena_body: 
    ブログの導入・リード文となる解説記事（200〜400文字）。
    詳細を詳しく知りたくなるような問題提起を行い、末尾は自然に誘導する文章で締める（URLは書かない）。`;
}
