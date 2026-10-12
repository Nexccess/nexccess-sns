import {test} from "node:test";
import assert from "node:assert/strict";
import {discover, classifyResponse} from "../scripts/discover-instagram.js";
test("normal response",()=>assert.deepEqual(classifyResponse(200,{instagram_business_account:{id:"12345"}}),{status:"IG_ID_FOUND",instagram_user_id:"12345"}));
test("not linked",()=>assert.equal(classifyResponse(200,{}).status,"IG_NOT_LINKED_OR_NOT_VISIBLE"));
test("invalid token",()=>assert.equal(classifyResponse(400,{error:{code:190}}).error_code,190));
test("does not make API call when credentials missing",async()=>{let called=false; const r=await discover({pageId:"",token:"",request:()=>{called=true;}});assert.equal(r.status,"MISSING_FACEBOOK_PAGE_CREDENTIALS");assert.equal(called,false);});
test("GET with authorization header",async()=>{let url;let opts;const r=await discover({pageId:"123",token:"dummy",version:"v24.0",request:async(u,o)=>{url=u;opts=o;return {status:200,json:async()=>({instagram_business_account:{id:"456"}})}}});assert.equal(r.instagram_user_id,"456");assert.equal(opts.method,"GET");assert.equal(opts.headers.Authorization,"Bearer dummy");assert.equal(url.searchParams.get("fields"),"instagram_business_account,connected_instagram_account");});
