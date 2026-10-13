// Isolated Instagram test adapter. No writes to existing SNS routes.
import sharp from 'sharp';

const SOURCE = 'https://raw.githubusercontent.com/Nexccess/pathflow-master-lp/main/p/0833/assets/hero.png';
const API_VERSION = 'v24.0';
const EXPECTED_PAGE_ID = '1144107962110268';
const EXPECTED_USERNAME = 'nexccess.llc';
const caption = '【投稿テスト】PathFlowの美容室LP制作デモ「Nexc.」のイメージ画像です。架空店舗のサンプルであり、実在する美容室の施術実績ではありません。テスト後に削除します。';
function reply(res, status, data) { res.setHeader('Cache-Control','no-store');return res.status(status).json(data); }
async function graph(endpoint, { method='GET', params={}, token }={}) {
  const url = new URL('https://graph.facebook.com/'+API_VERSION+'/'+endpoint);
  const headers={Authorization:'Bearer '+token,Accept:'application/json'};
  let body;
  if(method==='GET') for(const [k,v] of Object.entries(params)) url.searchParams.set(k,v);
  else { headers['Content-Type']='application/x-www-form-urlencoded';body=new URLSearchParams(params); }
  const r=await fetch(url,{method,headers,body,signal:AbortSignal.timeout(16000)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok || data.error) {
    const e=new Error('GRAPH_API_ERROR');e.http=r.status;e.code=data.error?.code??null;e.subcode=data.error?.error_subcode??null;throw e;
  }
  return data;
}
async function discover(token) {
  const pageId=process.env.META_PAGE_ID || '';
  if(pageId!==EXPECTED_PAGE_ID) return {status:'PAGE_ID_MISMATCH'};
  if(!token) return {status:'TOKEN_MISSING'};
  const page=await graph(pageId,{token,params:{fields:'instagram_business_account,connected_instagram_account'}});
  const id=page.instagram_business_account?.id || page.connected_instagram_account?.id;
  if(!id) return {status:'IG_NOT_LINKED_OR_NOT_VISIBLE'};
  const account=await graph(id,{token,params:{fields:'id,username'}});
  if(account.username!==EXPECTED_USERNAME) return {status:'USERNAME_MISMATCH',username:account.username??null};
  return {status:'IG_ID_FOUND',id:String(id),username:account.username};
}
async function image(req,res){
  try{
    const r=await fetch(SOURCE,{signal:AbortSignal.timeout(12000)});
    if(!r.ok) return res.status(502).end('IMAGE_SOURCE_ERROR');
    const bytes=Buffer.from(await r.arrayBuffer());
    if(bytes.length>6000000) return res.status(413).end('IMAGE_TOO_LARGE');
    const jpeg=await sharp(bytes).rotate().resize({width:1080,withoutEnlargement:true}).jpeg({quality:85}).toBuffer();
    res.setHeader('Content-Type','image/jpeg');
    res.setHeader('Cache-Control','public, max-age=300');
    return res.status(200).send(jpeg);
  }catch {return res.status(502).end('IMAGE_UNAVAILABLE');}
}
export async function instagramTest(req,res){
  if(req.method==='GET' && req.url.split('?')[0]==='/api/instagram/test-image') return image(req,res);
  const apiSecret=process.env.API_SECRET;
  if(!apiSecret || req.headers.authorization !== 'Bearer '+apiSecret) return reply(res,401,{status:'UNAUTHORIZED'});
  const token=process.env.META_PAGE_ACCESS_TOKEN || '';
  try{
    const account=await discover(token);
    if(account.status!=='IG_ID_FOUND') return reply(res,200,{status:account.status,username:account.username??null});
    if(req.method==='GET') return reply(res,200,{status:'IG_ID_FOUND',username:account.username,instagram_user_id:account.id});
    if(req.method!=='POST') return reply(res,405,{status:'METHOD_NOT_ALLOWED'});
    const action=req.body?.action;
    if(action!=='PUBLISH_ONE_TEST_POST') return reply(res,200,{status:'DRY_RUN_PASS',username:account.username,image_source:SOURCE,caption});
    // Before publishing: check the exact caption has not been posted recently.
    const recent=await graph(account.id+'/media',{token,params:{fields:'id,caption',limit:'50'}});
    if(!Array.isArray(recent.data)) return reply(res,409,{status:'DUPLICATE_CHECK_UNAVAILABLE'});
    if(recent.data.some(x=>x.caption===caption)) return reply(res,409,{status:'DUPLICATE_CAPTION_DETECTED'});
    const imageUrl='https://'+req.headers.host+'/api/instagram/test-image';
    // Fail before publication when JPEG serving does not work externally.
    const probe=await fetch(imageUrl,{signal:AbortSignal.timeout(14000)});
    if(!probe.ok || !String(probe.headers.get('content-type')).includes('image/jpeg')) return reply(res,502,{status:'JPEG_IMAGE_UNAVAILABLE'});
    const container=await graph(account.id+'/media',{method:'POST',token,params:{image_url:imageUrl,caption}});
    if(!container.id) return reply(res,502,{status:'CONTAINER_CREATION_UNCONFIRMED'});
    const published=await graph(account.id+'/media_publish',{method:'POST',token,params:{creation_id:container.id}});
    if(!published.id) return reply(res,502,{status:'PUBLICATION_UNCONFIRMED',container_id:container.id});
    let permalink=null;
    try{const m=await graph(published.id,{token,params:{fields:'permalink,id'}});permalink=m.permalink??null;}catch{}
    return reply(res,200,{status:'PUBLISHED',post_id:published.id,permalink,username:account.username,delete_instruction:'Delete manually in Instagram after viewing post.'});
  }catch(e){
    return reply(res,502,{status:e.message==='GRAPH_API_ERROR'?'META_API_ERROR':'EXECUTION_ERROR',http_status:e.http??null,error_code:e.code??null,error_subcode:e.subcode??null});
  }
}
