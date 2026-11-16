/**
 * 2026年末キャンペーン：不動産担保ローン
 * 担保不動産の所有者（個人・法人）と資金使途を分離して扱う。
 * 本番への反映はレビュー・審査後。借入可否や使途制限の緩さは保証しない。
 */
const BASE_URL = "https://fudousan-tanpo.tokyo/";
const TOPICS = [
 {id:"equity-release",name:"住宅ローンの返済進行と不動産評価から担保余力を検討",painPoint:"住宅ローンを返済してきたが資金調達の選択肢を把握していない",angle:"返済残高の減少と不動産評価の変化を比較し、借り換え・追加融資の可能性を個別確認する"},
 {id:"debt-consolidation",name:"住宅・カード・教育・マイカーローンの一本化による返済額の見直し",painPoint:"住宅ローン以外にも複数の借入返済がある",angle:"不動産担保ローンへの借り換えや複数借入の一本化を検討し、月額・総返済額・担保リスクを比較する"},
 {id:"owner-individual",name:"個人所有の不動産を活用した資金調達",painPoint:"不動産は代表者個人が保有している",angle:"個人と法人の借入主体・担保提供者・資金移動を切り分けて整理"},
 {id:"owner-corporate",name:"法人所有の不動産を活用した資金調達",painPoint:"会社保有の不動産を資金調達に活かしたい",angle:"保有物件の担保状況・希望金額・返済計画を確認"},
 {id:"working-capital",name:"会社の運転資金・開発資金",painPoint:"会社に運転資金や開発資金が必要",angle:"代表者個人が借り入れた資金を会社に充当する場合の資金移動と会計・税務確認"},
 {id:"bridge",name:"短期つなぎ資金・ブリッジ資金",painPoint:"入金までの時間差を埋める資金が必要",angle:"必要時期・必要期間・返済原資と期限を整理"},
 {id:"urgent",name:"緊急的な資金需要",painPoint:"資金の必要時期が迫っている",angle:"必要額・必要時期・資料と借入先の審査所要期間を確認し、迅速な実行を保証しない"},
 {id:"education",name:"学費など個人の資金需要",painPoint:"学費などまとまった支払いを検討している",angle:"個人利用の可否は借入先・契約条件で異なることを前提に返済負担と諸費用を比較"},
 {id:"repayment",name:"借り換え・利息のみ・返済期間の比較",painPoint:"月々の返済額を見直したい",angle:"総支払額・元金残高・満期一括返済の有無・担保リスクを確認"}
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
 const day=Math.floor(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())/86400000);
 const topic=TOPICS[((day%TOPICS.length)+TOPICS.length)%TOPICS.length];
 return {...topic,url:BASE_URL,coreValue:"個人・法人所有の不動産を活用した幅広い資金調達条件の整理と紹介先の検討",goUrl:{
  x:campaignUrl("x",topic.id),facebook:campaignUrl("facebook",topic.id),
  threads:campaignUrl("threads",topic.id),hatena:campaignUrl("hatena",topic.id)
 }};
}
export function buildSystemPrompt(){
 return `あなたは不動産担保ローンの情報提供担当の編集者です。金融情報の正確性を最優先し、担保提供者と借入主体と資金使途を区別して説明してください。
重点訴求は①住宅ローン返済による残債減少や物件評価の変化から担保余力を検討すること、②住宅ローン・カードローン・教育ローン・マイカーローン等の複数借入を、対応商品がある場合に不動産担保ローンへの借り換え等で一本化して返済条件を見直すことです。\n対象は不動産を所有する個人・法人。個人所有不動産を背景に個人で調達し、会社資金に充当する相談も含みますが、融資契約上の使途可否、資金の法人への移転方法、会計・税務の取扱いは個別確認事項です。
資金使途の例：運転資金、開発資金、ブリッジ資金、緊急需要、学費等。いずれもすべての商品で認められるとは言わず、貸付先ごとの条件を確認する必要があります。
確認できるサービス情報：
- Nexccessは不動産担保ローンの条件整理と紹介先の検討を行う。
- 過去支援実績の表示金利は年2.0%〜10.0%。今後の適用金利ではない。
- 利息のみ・元利均等等の返済実績がある。適用は借入先の審査・条件による。
- 利息のみの返済期間は元金が減らない。
住宅ローンの担保設定額と現在の不動産評価額は別の概念です。価格上昇分をそのまま融資枠とは説明しない。通常の住宅ローンへ他の債務をそのまま取り込めると断定せず、必要に応じて不動産担保ローンへの借り換え等の方法を説明する。月額返済が下がっても、期間延長により総返済額が増える可能性、住宅を失うリスクを併記する。\n絶対禁止：金利や実行日数・審査通過の保証、あらゆる資金使途が自由であるとの断言、架空の人物・案件・実績・金額、未確認の法令・税務断定、誇大な緊急性演出。
「事業資金のみ」を強調しない。個人・法人の双方を対象にし、読者が自分に関係する条件か判断できる具体例を出す。
専門家の相談先を含め、借入条件と返済リスクを中立的に示す。
出力は純粋なJSON：{"facebook":"本文","twitter":"本文","threads":"本文","hatena_title":"タイトル","hatena_body":"本文"}`;
}
export function buildUserPrompt(theme){
 return `投稿テーマ：${theme.name}
読者の課題：${theme.painPoint}
今回説明する観点：${theme.angle}
誘導先：${theme.url}
各媒体で同一の物語調を繰り返さず、具体例・比較項目・注意点を短く伝える。
facebook：180〜300字。具体例と確認事項。
twitter：100字以内。問題提起＋確認ポイント。
threads：130〜180字。短い説明と留意点。
hatena_title：検索される具体的な質問型タイトル。
hatena_body：300〜450字。具体例・比較観点・注意点。
URL・ハッシュタグは本文に含めない。コードが媒体別URLを追加する。
融資条件・資金使途の可否は商品や審査により異なると明記。JSONのみ出力。`;
}
