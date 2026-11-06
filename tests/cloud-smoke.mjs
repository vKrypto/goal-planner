import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?undefined:'chrome',executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
const contexts=[];const errors=[];
const token=`x.${btoa(JSON.stringify({sub:'test-user'}))}.x`;
async function add(page,title){await page.getByRole('button',{name:'New target',exact:true}).click();await page.getByLabel('Target title').fill(title);await page.getByLabel('Target date',{exact:true}).fill('2027-01-01');await page.getByRole('button',{name:'Create target',exact:true}).click();await page.getByRole('heading',{name:title,exact:true}).waitFor();}
async function settings(page){await page.getByRole('button',{name:'Open settings',exact:true}).first().click();}
async function synced(page){await settings(page);await page.getByRole('button',{name:'Sync now',exact:true}).click();await page.locator('.cloud-status>span').filter({hasText:/Synced/}).waitFor();await page.getByRole('button',{name:'Close dialog',exact:true}).click();}
async function run(provider){
 let remote=null;let revision=0;
 const endpoint=provider==='supabase'?'https://planner-test.supabase.co':'https://planner-test-default-rtdb.firebaseio.com';
 async function device(){
  const context=await browser.newContext({serviceWorkers:'block'});contexts.push(context);
  await context.route('https://**/*',async route=>{
   const req=route.request();const url=new URL(req.url());
   const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Content-Type,apikey,X-Firebase-ETag,if-match','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Expose-Headers':'ETag',ETag:`"v${revision}"`};let status=200;let body=null;
   if(req.method()==='OPTIONS')body={};
   else if(url.hostname==='identitytoolkit.googleapis.com')body={idToken:token,refreshToken:'local-only-refresh',expiresIn:'3600'};
   else if(url.pathname==='/auth/v1/token')body={access_token:token,refresh_token:'local-only-refresh',expires_in:3600};
   else if(provider==='supabase'){
    const input=req.postDataJSON();
    if(url.pathname.endsWith('/planner_head'))body=remote?.hash??null;
    else if(url.pathname.endsWith('/planner_read'))body=remote;
    else if(url.pathname.endsWith('/planner_write')){body=(remote?.hash??null)===input.p_expected_hash;if(body){remote=input.p_snapshot;revision++;}}
    else status=404;
   }else if(req.method()==='PUT'){
    if(req.headers()['if-match']!==`"v${revision}"`)status=412;
    else{remote=req.postDataJSON();revision++;body=remote;}
   }else if(url.pathname.endsWith('/hash.json'))body=remote?.hash??null;
   else body=remote;
   await route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.TARGET_PLANNER_URL || 'http://localhost:4173/');return {page,context};
 }
 async function connect(page){
  await settings(page);
  await page.getByLabel('Storage provider',{exact:true}).waitFor();
  assert.deepEqual(await page.getByLabel('Storage provider',{exact:true}).locator('option').evaluateAll(options=>options.map(o=>o.value)),['firebase','supabase']);
  await page.getByLabel('Storage provider',{exact:true}).selectOption(provider);
  await page.getByLabel(provider==='supabase'?'Project URL':'Database URL',{exact:true}).fill(endpoint);
  await page.getByLabel('Data ID',{exact:true}).fill('cloud-smoke-workspace');
  await page.getByLabel(provider==='supabase'?'Publishable / anon key':'Firebase Web API key',{exact:true}).fill('public-project-key');
  await page.getByLabel('Account email',{exact:true}).fill('test@example.com');
  await page.getByLabel('Account password',{exact:true}).fill('password-is-not-retained');
  await page.getByRole('button',{name:'Connect & check versions'}).click();
  await page.locator('.cloud-status>span').filter({hasText:/Synced/}).waitFor();
  const saved=await page.evaluate(()=>localStorage.getItem('target-planner.connection.v1'));assert.ok(!saved.includes('password-is-not-retained'));
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 }
 const a=await device();await add(a.page,'Shared target');await connect(a.page);assert.equal(JSON.parse(remote.payload).items.length,1);
 const b=await device();await connect(b.page);await b.page.getByRole('heading',{name:'Shared target',exact:true}).waitFor();
 await a.context.setOffline(true);await add(a.page,'Offline device A');
 await add(b.page,'Online device B');await synced(b.page);assert.equal(JSON.parse(remote.payload).items.length,2);
 await a.context.setOffline(false);await settings(a.page);await a.page.getByRole('button',{name:'Sync now',exact:true}).click();await a.page.getByText('Both versions have changed',{exact:true}).waitFor();
 assert.equal(await a.page.evaluate(()=>JSON.parse(localStorage.getItem('target-planner.v1')).items.length),2);
 assert.ok(JSON.parse(remote.payload).items.some(x=>x.title==='Online device B'));
 await a.page.getByRole('button',{name:'Use cloud version',exact:true}).click();await a.page.getByRole('button',{name:'Confirm replacement',exact:true}).click();await a.page.locator('.cloud-status>span').filter({hasText:/Synced/}).waitFor();await a.page.getByRole('button',{name:'Close dialog',exact:true}).click();await a.page.getByRole('heading',{name:'Online device B',exact:true}).waitFor();
 const [backup]=await Promise.all([a.page.waitForEvent('download'),a.page.getByRole('button',{name:'Back up your plans'}).click()]);const backupText=await readFile(await backup.path(),'utf8');assert.ok(!backupText.includes('local-only-refresh'));assert.ok(!backupText.includes('password-is-not-retained'));
 await a.page.getByRole('button',{name:'View details for Shared target'}).click();await a.page.getByRole('button',{name:'Delete',exact:true}).click();await a.page.getByRole('button',{name:'Delete plan',exact:true}).click();await synced(a.page);await synced(b.page);assert.equal(await b.page.getByRole('heading',{name:'Shared target',exact:true}).count(),0);
 await a.page.reload();await a.page.getByRole('heading',{name:'Online device B',exact:true}).waitFor();await synced(a.page);
 await a.page.setViewportSize({width:390,height:844});await settings(a.page);await a.page.screenshot({path:`/tmp/target-planner-${provider}-settings.png`,fullPage:true});assert.ok(await a.page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),'Cloud settings fit mobile');
 await a.page.getByRole('button',{name:'Disconnect',exact:true}).click();assert.equal(await a.page.evaluate(()=>localStorage.getItem('target-planner.connection.v1')),null);assert.equal(await a.page.evaluate(()=>JSON.parse(localStorage.getItem('target-planner.v1')).items.length),1);
 console.log(`PASS ${provider}: direct auth, two devices, initial pull, offline conflicts, explicit resolution, deletion sync, reopening, local-only credentials, disconnect, mobile settings.`);
}
try{await run('supabase');await run('firebase');assert.deepEqual(errors,[]);}catch(error){for(let i=0;i<contexts.length;i++)await contexts[i].pages()[0]?.screenshot({path:`/tmp/cloud-failure-${i}.png`,fullPage:true});throw error;}finally{await browser.close();}
