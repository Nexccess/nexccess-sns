/**
 * 年内集中キャンペーン: 不動産担保ローン
 * 本番への反映はPRレビュー後。架空の実績や融資保証の生成は禁止。
 */
const BASE_URL = "https://fudousan-tanpo.tokyo/";
const TOPICS = [
  {id:"corporate-refinance",name:"法人の不動産担保ローン借り換え",painPoint:"既存借入の返済額が重い",angle:"借り換え前後の総支払額・手数料・抵当権費用の比較"},
  {id:"interest-only",name:"借入期間中の利息のみ返済",painPoint:"月々の元金返済負担を抑えたい",angle:"利息のみの期間中は元金が減らない点と満期返済の確認"},
  {id:"five-year",name:"返済期間5年の確認事項",painPoint:"5年後の一括返済に不安がある",angle:"満期時の元金残高と返済資金の準備"},
  {id:"working-capital",name:"法人所有不動産を使った運転資金",painPoint:"事業資金の調達先を比較したい",angle:"資金使途・希望時期・不動産の状況を整理する"},
  {id:"rate-cost",name:"不動産担保ローンの金利と諸費用",painPoint:"表示金利だけで借入先を決めてよいか",angle:"金利と事務手数料などの総コストの確認"},
  {id:"collateral-risk",name:"不動産を担保にする際のリスク",painPoint:"返済が難しくなったときの影響が心配",angle:"担保不動産を失う可能性と返済計画"},
  {id:"first-consultation",name:"借入希望額未定の資金調達相談",painPoint:"希望額が決まらず相談をためらっている",angle:"資金使途・必要時期・物件情報から条件整理"}
];
function campaignUrl(platform,topicId) {
  const u = new URL(BASE_URL);
  u.searchParams.set("utm_source",platform);
  u.searchParams.set("utm_medium","organic_social");
  u.searchParams.set("utm_campaign","tanpo_2026_yearend");
  u.searchParams.set("utm_content",topicId);
  return u.toString();
}
export function selectTheme(now=new Date()) {
  const day = Math.floor(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()) / 86400000);
  const topic = TOPICS[((day % TOPICS.length)+TOPICS.length)%TOPICS.length];
  return {
    ...topic,
    url: BASE_URL,
    coreValue:"不動産担保ローンの借入条件整理と複数の紹介先の検討",
    goUrl:{
      x:campaignUrl("x",topic.id),
      facebook:campaignUrl("facebook",topic.id),
      threads:campaignUrl("threads",topic.id),
      hatena:campaignUrl("hatena",topic.id)
    }
  };
}
export function buildSystemPrompt() {
  return `あなたは不動産担保ローンの情報提供を担当する編集者です。
金融情報の正確性を優先し、読者の意思決定に役立つ具体的な比較項目を示してください。
対象は不動産を所有し、事業資金・借り換え・返済条件を検討する法人経営者・個人事業主等です。
事実として使用できる情報は下記に限ります。
- Nexccessは不動産担保ローンの資金調達条件の相談と紹介先の検討に対応。
- 過去支援実績の金利表示は年2.0%〜10.0%。将来の金利を保証しない。
- 返済方法には利息のみ、元利均等などの支援実績があるが、適用は借入先審査による。
- 利息のみの期間中、元金は減らない。
絶対禁止：融資の承認保証、実行期間の保証、架空の相談事例・実績・金利・金額・人物引用、未確認の法的断定、恐怖を煽る表現。
サービス説明は「融資の直接提供」ではなく「条件整理と借入先の検討」です。
投稿末尾は具体的な比較・準備の観点と穏やかな相談導線にしてください。
出力は次のキーを持つJSONオブジェクトのみ：
{"facebook":"本文","twitter":"本文","threads":"本文","hatena_title":"タイトル","hatena_body":"本文"}`;
}
export function buildUserPrompt(theme) {
  return `投稿テーマ：${theme.name}
読者の状況：${theme.painPoint}
説明する観点：${theme.angle}
共通の誘導先：${theme.url}
同一内容の言い換え量産ではなく、各媒体で自然に読める原稿を作成してください。
facebook: 180〜300文字、箇条書きが適切なら使用。
twitter: 100文字以内で、具体的なチェック項目を1つ提示。
threads: 130〜180文字で、要点と注意点を整理。
hatena_title: 問題を明確にする見出し。
hatena_body: 300〜450文字で比較項目と注意点を記載。
URLやハッシュタグは本文に含めないこと。コードが媒体別URLを付けます。
金融商品に関する具体的な条件は必ず「借入先の審査による」と明記し、実績を創作しないこと。
出力は純粋なJSONのみ。`;
}
