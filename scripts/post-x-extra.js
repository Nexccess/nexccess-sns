/**
 * 2026年末 不動産担保ローン X追加投稿：7日間・日2回の試行版
 * main側の既存朝投稿とは別系統。期間外は何も投稿しない。
 * 投稿原稿は固定で、同一/類似の自動連投を避けるため14本を個別に準備。
 */
import { TwitterApi } from "twitter-api-v2";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
const POSTS=[["住宅ローンの返済が進み、残債が減っていませんか。物件の評価も変わっていれば、追加の資金調達や借り換えを検討できる可能性があります。融資枠は個別審査です。","個人所有"],["住宅ローン以外にカード・教育・マイカーローンがある方へ。不動産担保ローンへの借り換え等で一本化できる場合があります。月額だけでなく総返済額も比較を。","会社への資金移動"],["住宅ローン残債が減ったからといって、その差額を全額借りられるわけではありません。現在の物件評価・担保権・返済能力が重要です。","運転資金"],["借入を一本化して毎月の支払いが減っても、返済期間が長くなると総返済額が増える場合があります。金利・諸費用・期間をセットで確認しましょう。","開発資金"],["ブリッジ資金は「いつ入金される予定か」が核心です。つなぎ期間・返済原資・予定が遅れた場合の対応を事前に整理しましょう。","ブリッジ"],["急ぎの資金需要でも、融資の可否・実行日は審査次第です。物件情報、既存抵当権、必要金額と期日を早めに整理しておくことが重要です。","緊急資金"],["学費など個人のまとまった資金需要でも、不動産担保による借入を検討する場合があります。個人利用の可否や返済負担は商品ごとに確認が必要です。","学費など"],["不動産を担保にする場合、金利だけでなく、事務手数料・登記費用・返済総額を含めて比較することが重要です。","諸費用"],["借り換えの検討では、毎月の返済額が下がるだけでは十分ではありません。総支払額、繰上返済手数料、抵当権の抹消・設定費用を確認します。","借り換え"],["借入期間中に利息のみを支払う方式は、その間の元金が減りません。満期時の返済方法まで含めて比較することが必要です。","利息のみ"],["5年後に元金を一括返済する条件なら、5年後の残高と返済原資を最初に確認しましょう。延長や借り換えを前提にしすぎない計画が重要です。","5年返済"],["物件の名義が個人か法人かによって、借入主体や担保設定の条件が変わり得ます。まず登記情報と現在の借入状況を整理します。","物件名義"],["不動産を担保にすると、返済が滞った場合に担保物件を失う可能性があります。借入額だけでなく返済計画とリスクも確認してください。","担保リスク"],["借入希望額が未確定でも、資金使途・必要時期・物件の状況が分かれば相談の整理を進められます。条件は借入先によって異なります。","初回相談"]];
const START="2026-11-17", END="2026-11-23";
const IMAGES = {
  0: {path:"assets/tanpo-equity-diagram.png", alt:"住宅ローンの残債・現在の不動産評価・追加融資や借り換えの検討という3つの確認項目を示す図解。差額がそのまま借入可能額ではありません。"},
  1: {path:"assets/tanpo-consolidation-diagram.png", alt:"住宅ローン・カードローン・教育ローン・マイカーローンを、不動産担保ローン等へ借り換えて一本化できるか検討し、月額と総返済額を比較する図解。"},
  2: {path:"assets/tanpo-equity-diagram.png", alt:"住宅ローン残債が減っても、現在の担保評価・抵当権・返済能力で融資条件が変わることを示す図解。"},
  3: {path:"assets/tanpo-consolidation-diagram.png", alt:"借入を一本化して毎月の返済が減る場合でも、総返済額と担保リスクに注意が必要と示す図解。"}
};
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
 return {message:message+"\n\n"+u.toString(),topic,date,slot,image:IMAGES[index] ?? null};
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
  let media;
  if(post.image){
   const filename=resolve(process.cwd(),post.image.path);
   if(!filename.startsWith(resolve(process.cwd(),"assets")+"/")) throw new Error("不正な画像パス");
   const image=readFileSync(filename);
   if(statSync(filename).size > 5*1024*1024) throw new Error("画像が5MBを超えています");
   if(image.subarray(0,8).toString("hex")!=="89504e470d0a1a0a") throw new Error("PNGではありません");
   const mediaId=await x.v1.uploadMedia(image,{mimeType:"image/png"});
   await x.v1.createMediaMetadata(mediaId,{alt_text:{text:post.image.alt}});
   media={media_ids:[mediaId]};
  }
  const result=await x.readWrite.v2.tweet({text:post.message,...(media?{media}:{})});
  console.log(JSON.stringify({status:"posted",id:result.data.id,date:post.date,slot:post.slot,topic:post.topic,image:post.image?.path??null}));
 }catch(err){console.error(err.message);process.exit(1);}
}
