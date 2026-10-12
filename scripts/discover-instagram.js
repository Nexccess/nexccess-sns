/**
 * STEP 12-IG-02 - READ ONLY Instagram account discovery.
 * Uses the existing Facebook Page credentials from GitHub Actions secrets.
 * Never publishes media, never logs bearer tokens, never modifies remote data.
 */
import fs from "node:fs/promises";
import path from "node:path";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v24.0";
const PAGE_ID = process.env.META_PAGE_ID || "";
const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN || "";

export function classifyResponse(status, body) {
  if (status !== 200 || body?.error) {
    return { status: "API_ERROR", http_status: status, error_code: body?.error?.code ?? "UNKNOWN", error_subcode: body?.error?.error_subcode ?? null };
  }
  const id = body?.instagram_business_account?.id || body?.connected_instagram_account?.id || null;
  if (!id) return { status: "IG_NOT_LINKED_OR_NOT_VISIBLE", instagram_user_id: null };
  return { status: "IG_ID_FOUND", instagram_user_id: String(id) };
}

export async function discover({ pageId=PAGE_ID, token=PAGE_TOKEN, version=GRAPH_VERSION, request=fetch }={}) {
  if (!/^\d+$/.test(pageId) || !token) return {status:"MISSING_FACEBOOK_PAGE_CREDENTIALS",instagram_user_id:null};
  if (!/^v\d+\.\d+$/.test(version)) return {status:"INVALID_GRAPH_VERSION",instagram_user_id:null};
  const url = new URL(`https://graph.facebook.com/${version}/${pageId}`);
  url.searchParams.set("fields", "instagram_business_account,connected_instagram_account");
  let response;
  try {
    response = await request(url,{method:"GET",headers:{Authorization:`Bearer ${token}`,Accept:"application/json"}});
    const body = await response.json();
    return classifyResponse(response.status,body);
  } catch {
    return {status:"API_NETWORK_OR_RESPONSE_ERROR",instagram_user_id:null};
  }
}
if (process.argv[1] && import.meta.url === new URL("file://" + path.resolve(process.argv[1])).href) {
  const result=await discover();
  const out={...result, checked_at_utc:new Date().toISOString(), mode:"READ_ONLY"};
  const folder=path.join(process.cwd(),"artifacts","12-ig");
  await fs.mkdir(folder,{recursive:true});
  await fs.writeFile(path.join(folder,"account-discovery.json"),JSON.stringify(out,null,2)+"\n","utf8");
  console.log(JSON.stringify({status:out.status,mode:out.mode,ig_id_present:!!out.instagram_user_id,error_code:out.error_code??null}));
  if (out.status!=="IG_ID_FOUND") process.exitCode=1;
}
