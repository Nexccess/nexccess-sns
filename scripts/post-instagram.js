/**
 * 12営業 Instagram publication worker.
 * Independent from the existing multi-channel posting pipeline.
 * Requires explicit --publish and APPROVED_POST=true to make a public post.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const API_VERSION = process.env.META_GRAPH_VERSION;
const GRAPH_BASE = "https://graph.facebook.com";
const now = () => new Date().toISOString();
function result(status, extra={}) { return {platform:"instagram",execution_status:status,recorded_at_utc:now(),...extra}; }
function assertHttps(value, field) { const u = new URL(value); if(u.protocol!=="https:") throw new Error(field+"_NOT_HTTPS"); return value; }
async function graphRequest(endpoint, params, token, method="GET") {
  const url = new URL(`/${API_VERSION}/${endpoint}`, GRAPH_BASE);
  const options={method,headers:{}};
  if(method==="GET"){ for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v)); }
  else {options.headers["Content-Type"]="application/x-www-form-urlencoded";options.body=new URLSearchParams(params);}
  options.headers.Authorization=`Bearer ${token}`;
  const response=await fetch(url,options);
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.error) throw new Error(`GRAPH_API_ERROR_${response.status}_${data.error?.code??"UNKNOWN"}`);
  return data;
}
async function main() {
  const publish=process.argv.includes("--publish");
  const caption=process.env.IG_CAPTION??"";
  const imageUrl=process.env.IG_IMAGE_URL??"";
  const accountId=process.env.IG_USER_ID??"";
  const token=process.env.META_PAGE_ACCESS_TOKEN??"";
  let output=result("UNKNOWN",{account_id:accountId||null,content_hash:createHash("sha256").update(caption+"\n"+imageUrl).digest("hex"),requested_at_utc:now(),post_id:null,permalink:null,published_at_utc:null});
  try{
    if(!caption.trim())throw new Error("MISSING_CAPTION");
    assertHttps(imageUrl,"IMAGE_URL");
    if(!publish){output.execution_status="DRY_RUN_PASS";return;}
    if(process.env.APPROVED_POST!=="true")throw new Error("POST_NOT_APPROVED");
    if(!accountId||!token||!API_VERSION)throw new Error("MISSING_API_CONFIGURATION");
    // Fail closed if previously published media cannot be read.
    const recent=await graphRequest(`${accountId}/media`,{fields:"id,caption,permalink",limit:"50"},token);
    if(!Array.isArray(recent.data))throw new Error("DUPLICATE_CHECK_UNAVAILABLE");
    if(recent.data.some(item=>item.caption===caption))throw new Error("DUPLICATE_CAPTION_DETECTED");
    output.duplicate_check="RECENT_50_CAPTIONS_CLEAR";
    const container=await graphRequest(`${accountId}/media`,{image_url:imageUrl,caption},token,"POST");
    if(!container.id)throw new Error("MEDIA_CONTAINER_ID_MISSING");
    // After a publish request, never issue an automatic second publish request.
    output.execution_status="PUBLISH_RESULT_UNKNOWN";
    output.container_id=container.id;
    const published=await graphRequest(`${accountId}/media_publish`,{creation_id:container.id},token,"POST");
    if(!published.id)throw new Error("MEDIA_ID_MISSING");
    output.post_id=published.id;
    // Publication is established by returned media id; permalink fetch may independently fail.
    output.execution_status="PUBLISHED_UNVERIFIED_URL";
    const media=await graphRequest(published.id,{fields:"id,permalink,timestamp,caption"},token);
    output.permalink=media.permalink??null;
    output.published_at_utc=media.timestamp??now();
    output.execution_status=media.permalink&&media.caption===caption?"PUBLISHED_VERIFIED":"PUBLISHED_NEEDS_REVIEW";
  }catch(err){output.error_code=String(err.message).slice(0,180);if(output.execution_status==="UNKNOWN")output.execution_status="FAILED";}
  finally {
    const folder=path.join(process.cwd(),"artifacts","12-ig");
    await mkdir(folder,{recursive:true});
    await writeFile(path.join(folder,"result.json"),JSON.stringify(output,null,2)+"\n",{encoding:"utf8"});
    console.log(JSON.stringify(output));
    if(!["DRY_RUN_PASS","PUBLISHED_VERIFIED"].includes(output.execution_status))process.exitCode=1;
  }
}
await main();
