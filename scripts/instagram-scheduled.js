/** Instagram scheduled publisher; independent of the existing SNS main pipeline.
 * A scheduled job will only run when explicitly enabled in Actions variable
 * IG_AUTOMATION_ENABLED=true and a separate user token is configured.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const IG='17841438348506154', USERNAME='nexccess.llc';
const BASE='https://graph.facebook.com/v25.0';
const artifact=path.join(process.cwd(),'artifacts','12-ig','result.json');
function fail(reason){throw new Error(reason);}
async function request(method,endpoint,token,values={}){
  const url=new URL(BASE+'/'+endpoint);
  const options={method,headers:{Authorization:'Bearer '+token}};
  if(method==='GET') for(const [k,v] of Object.entries(values))url.searchParams.set(k,String(v));
  else {options.headers['Content-Type']='application/x-www-form-urlencoded';options.body=new URLSearchParams(values);}
  const response=await fetch(url,options);
  const data=await response.json().catch(()=>({}));
  if(!response.ok || data.error) fail('META_API_ERROR_HTTP_'+response.status+'_CODE_'+(data.error?.code??'UNKNOWN'));
  return data;
}
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
// Persist posted status in the GitHub queue so scheduled runs never republish it.
// The Actions token is restricted to this repository. This never touches SNS main.
async function markPublished(queue,post,report){
  const token=process.env.GITHUB_TOKEN;
  const repo=process.env.GITHUB_REPOSITORY;
  const ref=process.env.GITHUB_REF_NAME;
  if(!token||!repo||!ref)fail('PUBLISHED_BUT_QUEUE_PERSISTENCE_UNAVAILABLE');
  const api='https://api.github.com/repos/'+repo+'/contents/data/instagram-post-queue.json';
  const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  const current=await fetch(api+'?ref='+encodeURIComponent(ref),{headers});
  if(!current.ok)fail('PUBLISHED_BUT_QUEUE_READ_FAILED_'+current.status);
  const metadata=await current.json();
  if(!metadata.sha)fail('PUBLISHED_BUT_QUEUE_SHA_MISSING');
  // Detect edits since the job checked out its source.
  const serverQueue=JSON.parse(Buffer.from(metadata.content.replace(/\s/g,''),'base64').toString('utf8'));
  const item=serverQueue.posts.find(x=>x.id===post.id);
  if(!item||item.caption!==post.caption||item.image_url!==post.image_url)fail('PUBLISHED_BUT_QUEUE_CHANGED');
  item.status='PUBLISHED';
  item.published_post_id=report.post_id;
  item.published_permalink=report.permalink;
  item.published_at_utc=new Date().toISOString();
  const content=Buffer.from(JSON.stringify(serverQueue,null,2)+'\n').toString('base64');
  const updated=await fetch(api,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({message:'chore(12-ig): record published queue item '+post.id,content,sha:metadata.sha,branch:ref})});
  if(!updated.ok)fail('PUBLISHED_BUT_QUEUE_WRITE_FAILED_'+updated.status);
}
async function main(){
  let report={status:'NOT_RUN',timestamp:new Date().toISOString(),post_id:null,permalink:null};
  try{
    const queue=JSON.parse(await readFile('data/instagram-post-queue.json','utf8'));
    if(!Array.isArray(queue.posts)) fail('INVALID_QUEUE');
    const now=Date.now();
    const eligible=queue.posts.filter(p=>p.status!=='PUBLISHED' && p.approved===true && typeof p.scheduled_at_utc==='string' && Date.parse(p.scheduled_at_utc)<=now && !Number.isNaN(Date.parse(p.scheduled_at_utc)));
    eligible.sort((a,b)=>a.scheduled_at_utc.localeCompare(b.scheduled_at_utc));
    report.pending=eligible.length;
    if(!eligible.length){report.status='NO_APPROVED_DUE_POST';return;}
    const p=eligible[0]; // only one per execution
    if(!/^[a-zA-Z0-9_-]{1,64}$/.test(p.id??'')) fail('INVALID_POST_ID');
    if(typeof p.caption!=='string'||!p.caption.trim())fail('EMPTY_CAPTION');
    if(typeof p.image_url!=='string'||!p.image_url.startsWith('https://'))fail('INVALID_IMAGE_URL');
    report.queue_id=p.id;
    report.content_sha256=createHash('sha256').update(p.caption+'\n'+p.image_url).digest('hex');
    if(process.env.IG_AUTOMATION_ENABLED!=='true'){report.status='DISABLED';return;}
    const token=process.env.IG_USER_ACCESS_TOKEN;
    if(!token)fail('IG_USER_ACCESS_TOKEN_NOT_CONFIGURED');
    const account=await request('GET',IG,token,{fields:'id,username'});
    if(String(account.id)!==IG||account.username!==USERNAME)fail('INSTAGRAM_ACCOUNT_MISMATCH');
    const recent=await request('GET',IG+'/media',token,{fields:'id,caption,permalink',limit:50});
    if(!Array.isArray(recent.data))fail('RECENT_MEDIA_UNAVAILABLE');
    const duplicate=recent.data.find(x=>x.caption===p.caption);
    if(duplicate){report.status='ALREADY_PUBLISHED';report.post_id=duplicate.id;report.permalink=duplicate.permalink??null;await markPublished(queue,p,report);return;}
    // Ensure image can be fetched by Meta.
    const imageResponse=await fetch(p.image_url,{method:'GET',signal:AbortSignal.timeout(20000)});
    if(!imageResponse.ok||!imageResponse.headers.get('content-type')?.includes('image/jpeg'))fail('PUBLIC_JPEG_UNAVAILABLE');
    // Prevent automatic retry on ambiguous publish errors: one media_publish per run.
    const container=await request('POST',IG+'/media',token,{image_url:p.image_url,caption:p.caption});
    if(!container.id)fail('MEDIA_CONTAINER_MISSING');
    report.container_id=container.id;
    let ready=false;
    for(let i=0;i<12;i++){
      await sleep(5000);
      const c=await request('GET',container.id,token,{fields:'status_code'});
      if(c.status_code==='FINISHED'){ready=true;break;}
      if(['ERROR','EXPIRED'].includes(c.status_code))fail('MEDIA_PROCESSING_'+c.status_code);
    }
    if(!ready)fail('MEDIA_NOT_READY');
    report.status='PUBLISH_RESULT_UNKNOWN';
    const published=await request('POST',IG+'/media_publish',token,{creation_id:container.id});
    if(!published.id)fail('PUBLISH_RESPONSE_UNCERTAIN');
    report.post_id=published.id;
    report.status='PUBLISHED_URL_UNVERIFIED';
    const media=await request('GET',published.id,token,{fields:'id,permalink,caption'});
    report.permalink=media.permalink??null;
    report.status=media.caption===p.caption && media.permalink?'PUBLISHED_VERIFIED':'PUBLISHED_NEEDS_REVIEW';
    if(report.status==='PUBLISHED_VERIFIED')await markPublished(queue,p,report);
  }catch(e){
    report.error=String(e.message).slice(0,120);
    if(report.status==='PUBLISHED_VERIFIED'||report.status==='ALREADY_PUBLISHED')report.status='PUBLISHED_QUEUE_UPDATE_FAILED';
    else if(report.status!=='PUBLISH_RESULT_UNKNOWN'&&report.status!=='PUBLISHED_URL_UNVERIFIED')report.status='FAILED';
  }finally{
    await mkdir(path.dirname(artifact),{recursive:true});
    await writeFile(artifact,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report));
    if(['FAILED','PUBLISH_RESULT_UNKNOWN','PUBLISHED_NEEDS_REVIEW','PUBLISHED_URL_UNVERIFIED','PUBLISHED_QUEUE_UPDATE_FAILED'].includes(report.status))process.exitCode=1;
  }
}
await main();
