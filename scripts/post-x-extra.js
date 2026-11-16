/**
 * 2026年末 不動産担保ローン X追加投稿：7日間・日2回の試行版
 * main側の既存朝投稿とは別系統。期間外は何も投稿しない。
 * 投稿原稿は固定で、同一/類似の自動連投を避けるため14本を個別に準備。
 */
import { TwitterApi } from "twitter-api-v2";
const POSTS=[["代表者の個人名義で不動産を保有している場合も、資金調達の相談対象になり得ます。借入主体・担保提供者・資金の行き先を整理することが第一歩です。","個人所有"],["会社の資金需要に、代表者個人の不動産を活用する場合。会社への資金移動は貸付・出資などの形態と会計・税務の確認が必要です。","会社への資金移動"],["不動産担保ローンで運転資金を検討するときは、必要額だけでなく「いつ必要か」「いつ返せるか」を具体的にすることが大切です。","運転資金"],["開発資金として調達する場合、開発期間と資金回収時期を照らし合わせて返済方法を検討します。資金使途の可否は借入先の条件によります。","開発資金"],["ブリッジ資金は「いつ入金される予定か」が核心です。つなぎ期間・返済原資・予定が遅れた場合の対応を事前に整理しましょう。","ブリッジ"],["急ぎの資金需要でも、融資の可否・実行日は審査次第です。物件情報、既存抵当権、必要金額と期日を早めに整理しておくことが重要です。","緊急資金"],["学費など個人のまとまった資金需要でも、不動産担保による借入を検討する場合があります。個人利用の可否や返済負担は商品ごとに確認が必要です。","学費など"],["不動産を担保にする場合、金利だけでなく、事務手数料・登記費用・返済総額を含めて比較することが重要です。","諸費用"],["借り換えの検討では、毎月の返済額が下がるだけでは十分ではありません。総支払額、繰上返済手数料、抵当権の抹消・設定費用を確認します。","借り換え"],["借入期間中に利息のみを支払う方式は、その間の元金が減りません。満期時の返済方法まで含めて比較することが必要です。","利息のみ"],["5年後に元金を一括返済する条件なら、5年後の残高と返済原資を最初に確認しましょう。延長や借り換えを前提にしすぎない計画が重要です。","5年返済"],["物件の名義が個人か法人かによって、借入主体や担保設定の条件が変わり得ます。まず登記情報と現在の借入状況を整理します。","物件名義"],["不動産を担保にすると、返済が滞った場合に担保物件を失う可能性があります。借入額だけでなく返済計画とリスクも確認してください。","担保リスク"],["借入希望額が未確定でも、資金使途・必要時期・物件の状況が分かれば相談の整理を進められます。条件は借入先によって異なります。","初回相談"]];
const START="2026-11-17", END="2026-11-23";
export function selectPost(now=new Date(), slot=Number(process.env.X_SLOT)){
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now).map(x=>[x.type,x.value]));
 const date=`${parts.year}-${parts.month}-${parts.day}`;
 if(date<START || date>END) return null;
 if(![1,2].includes(slot)) throw new Error("X_SLOT は 1 または 2 が必要です");
 const index=(Math.floor((Date.parse(date+"T00:00:00Z")-Date.parse(START+"T00:00:00Z"))/86400000))*2+(slot-1);
 const [message,topic]=POSTS[index] || [];
 if(!message) throw new Error("投稿原稿がありません: "+date+"/"+slot);
 const u=new URL("https://fudousan-tanpo.tokyo/");
 u.searchParams.set("utm_source","x");
 u.searchParams.set("utm_medium","organic_social");
 u.searchParams.set("utm_campaign","tanpo_2026_yearend");
 u.searchParams.set("utm_content","trial_"+date.replaceAll("-","")+"_"+slot);
 return {message:message+"\n\n"+u.toString(),topic,date,slot};
}
if(process.argv[1]?.endsWith("post-x-extra.js")){
 try{
  const post=selectPost();
  if(!post){console.log("対象期間外: 投稿なし");process.exit(0);}
  if(process.env.DRY_RUN==="1"){console.log(JSON.stringify(post,null,2));process.exit(0);}
  for(const key of ["X_APP_KEY","X_APP_SECRET","X_ACCESS_TOKEN","X_ACCESS_SECRET"]){
   if(!process.env[key])throw new Error("Missing "+key);
  }
  const x=new TwitterApi({
   appKey:process.env.X_APP_KEY,appSecret:process.env.X_APP_SECRET,
   accessToken:process.env.X_ACCESS_TOKEN,accessSecret:process.env.X_ACCESS_SECRET
  });
  const result=await x.readWrite.v2.tweet(post.message);
  console.log(JSON.stringify({status:"posted",id:result.data.id,date:post.date,slot:post.slot,topic:post.topic}));
 }catch(err){console.error(err.message);process.exit(1);}
}
