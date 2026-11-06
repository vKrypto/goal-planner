import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyData } from '../src/model.ts';
import { canonical, hashData, snapshot, readSnapshot, decideSync, validateConnection, SyncConflict, type Connection } from '../src/sync-core.ts';
import { createAdapter, authenticate } from '../src/cloud.ts';
const c:Connection={provider:'supabase',endpoint:'https://project.supabase.co',dataId:'personal-targets',apiKey:'sb_publishable_example',token:'secret',email:'me@example.com'};
test('canonical hashes ignore object key and item order, but capture edits and deletions',async()=>{
 const data=emptyData();const a={id:'a',type:'target' as const,status:'active' as const,title:'One',targetDate:'2026-12-31',description:'',notes:'',reminder:true,createdAt:'2026-11-06T00:00:00Z',updatedAt:'2026-11-06T00:00:00Z'};
 const b={...a,id:'b',title:'Two'};const left={...data,items:[a,b]},right={items:[b,a],settings:data.settings,schemaVersion:1 as const};
 assert.equal(canonical(left),canonical(right));assert.equal(await hashData(left),await hashData(right));
 assert.notEqual(await hashData(left),await hashData({...data,items:[a]}));
 assert.notEqual(await hashData(left),await hashData({...left,items:[{...a,notes:'Changed'},b]}));
 const doc=await snapshot(left);assert.equal(canonical((await readSnapshot(doc)).data),canonical(left));
 await assert.rejects(()=>readSnapshot({...doc,payload:JSON.stringify(data)}),/hash/);
});
test('three-way sync decisions never overwrite concurrent edits, deletions, or unknown history',()=>{
 assert.equal(decideSync('a','a','old',false),'equal');
 assert.equal(decideSync('local',null,null,false),'push');
 assert.equal(decideSync('empty','remote',null,true),'pull');
 assert.equal(decideSync('local','remote',null,false),'conflict');
 assert.equal(decideSync('base','remote','base',false),'pull');
 assert.equal(decideSync('local','base','base',false),'push');
 assert.equal(decideSync('local','remote','base',false),'conflict');
 assert.equal(decideSync('base',null,'base',false),'conflict');
});
test('connections reject insecure or credential-bearing endpoints and admin keys',()=>{
 assert.throws(()=>validateConnection({...c,endpoint:'http://api.example.com'}),/HTTPS/);
 assert.throws(()=>validateConnection({...c,endpoint:'https://user:pass@api.example.com'}),/credentials/);
 assert.throws(()=>validateConnection({...c,dataId:'../bad'}),/Data ID/);
 assert.throws(()=>validateConnection({...c,provider:'supabase',email:'a@example.com',apiKey:'sb_secret_admin'}),/publishable/);
 assert.equal(validateConnection({...c,endpoint:'http://localhost:8787/'}).endpoint,'http://localhost:8787');
});
test('Firebase adapter checks the expected hash and writes with the returned ETag',async()=>{
 const original=globalThis.fetch;const token=`x.${btoa(JSON.stringify({sub:'user-1'}))}.x`;const calls:RequestInit[]=[];
 const doc=await snapshot(emptyData());
 globalThis.fetch=async(_url,init)=>{calls.push(init!);return new Response(JSON.stringify(init?.method==='PUT'?doc:{hash:'base'}),{status:200,headers:{ETag:'"etag-1"'}});};
 try{const api=createAdapter({...c,provider:'firebase',token});await api.write(doc,'base');assert.equal((calls[1].headers as Record<string,string>)['if-match'],'"etag-1"');assert.equal(calls[1].method,'PUT');await assert.rejects(()=>api.write(doc,'stale'),SyncConflict);}finally{globalThis.fetch=original;}
});
test('Supabase false CAS result becomes a conflict, and sessions refresh before expiry',async()=>{
 const original=globalThis.fetch;let body='';
 globalThis.fetch=async(_url,init)=>{body=String(init?.body);return new Response('false',{status:200});};
 try{const api=createAdapter({...c,provider:'supabase'});await assert.rejects(async()=>api.write(await snapshot(emptyData()),'base'),SyncConflict);assert.equal(JSON.parse(body).p_expected_hash,'base');
 globalThis.fetch=async()=>new Response(JSON.stringify({access_token:'new-token',refresh_token:'new-refresh',expires_in:3600}),{status:200});
 const result=await authenticate({...c,provider:'supabase',apiKey:'sb_publishable_example',email:'me@example.com',refreshToken:'old',expiresAt:0});assert.equal(result.token,'new-token');assert.equal(result.refreshToken,'new-refresh');
 }finally{globalThis.fetch=original;}
});
test('Firebase refresh uses form encoding and retains renewed session credentials',async()=>{
 const original=globalThis.fetch;let request:RequestInit|undefined;
 globalThis.fetch=async(_url,init)=>{request=init;return new Response(JSON.stringify({id_token:'renewed',refresh_token:'next',expires_in:'3600'}),{status:200});};
 try{const result=await authenticate({...c,provider:'firebase',refreshToken:'refresh+token',expiresAt:0});assert.equal((request!.headers as Record<string,string>)['Content-Type'],'application/x-www-form-urlencoded');assert.equal(new URLSearchParams(request!.body as string).get('refresh_token'),'refresh+token');assert.equal(result.token,'renewed');}finally{globalThis.fetch=original;}
});
