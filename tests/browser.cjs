'use strict';
// Requires Playwright and Chromium. BASELINE_ROOT optionally tests a real v1.9.2 upgrade.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const root = path.resolve(__dirname,'..');
const baseline = process.env.BASELINE_ROOT;
let oldVersion = Boolean(baseline);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server = http.createServer((req,res) => {
  const name = decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
  if(name.split('/').includes('..')){res.writeHead(403).end();return;}
  let file = path.join(oldVersion ? baseline : root,name);
  if(oldVersion && !fs.existsSync(file))file=path.join(root,name);
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end(name);return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(res);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const page=await context.newPage();page.setDefaultTimeout(12000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
    const url=`http://127.0.0.1:${server.address().port}/`;
    const snapshot=()=>page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
    const home=()=>page.evaluate(()=>show('home'));
    async function subject(id){await home();await page.getByRole('button',{name:/科目・分野別に学ぶ/}).click();await page.locator(`button[onclick="v11PickSubject('${id}')"]`).click();}
    async function resume(mode){await page.locator('.v192-scoped-resume .v192-resume-row').nth(mode==='ox'?0:1).locator('button.primary').click();}
    async function answerOx(){const choice=await page.evaluate(()=>queue[pos].a);await page.locator('#options button').nth(choice).click();await page.locator('#next').click();}
    async function answerFive(){const choice=await page.evaluate(()=>fiveQuestions[v11FiveQueue[v11FiveIndex]].a);await page.locator('#fiveOptions button').nth(choice).click();await page.locator('#fiveNext').click();}
    await page.goto(url);await page.waitForFunction(()=>typeof window.v181ResumeProgress==='function');
    if(baseline){
      assert((await page.title()).includes('v1.9.2'));
      await subject('civil');await resume('ox');await answerOx();
      await subject('realestate');await resume('ox');await answerOx();
      await subject('civil');await resume('five');await answerFive();
      await page.evaluate(()=>navigator.serviceWorker.ready);await home();
      const saved=await snapshot();
      oldVersion=false;
      await page.reload();await page.waitForFunction(()=>document.title.includes('v2.0.0')&&typeof window.v181ResumeProgress==='function');
      assert.deepEqual(await snapshot(),saved,'existing history, preferences and every resume slot survive the upgrade');
    }
    assert((await page.title()).includes('v2.0.0'));
    assert.equal(await page.locator('meta[name="google-adsense-account"]').getAttribute('content'),'ca-pub-8976067134459371');
    assert.equal(await page.locator('a[href="https://gyoseishoshipass.com/"]').count(),2);
    await subject('civil');await resume('ox');await answerOx();
    const civil=await page.evaluate(()=>queue[pos].id);
    // Citations are still decorated by the real DOM MutationObserver.
    await page.locator('#options button').first().click();
    await page.waitForFunction(()=>document.querySelector('#feedback a[href^="https://laws.e-gov.go.jp/law/"]'));
    await page.locator('#next').click();
    const civilNext=await page.evaluate(()=>queue[pos].id);assert.notEqual(civil,civilNext);
    await subject('realestate');await resume('ox');await answerOx();
    const estate=await page.evaluate(()=>queue[pos].id);
    await subject('civil');await resume('five');await answerFive();
    const five=await page.evaluate(()=>v11FiveQueue[v11FiveIndex]);
    await page.reload();await subject('civil');await resume('ox');
    assert.equal(await page.evaluate(()=>queue[pos].id),civilNext);
    await subject('realestate');await resume('ox');assert.equal(await page.evaluate(()=>queue[pos].id),estate);
    await subject('civil');await resume('five');assert.equal(await page.evaluate(()=>v11FiveQueue[v11FiveIndex]),five);
    await page.evaluate(()=>v16StartUnit('capacity','basic'));await answerOx();
    const topic=await page.evaluate(()=>queue[pos].id);
    await page.locator('#v183TextBack').click();assert(await page.locator('#v14library').isVisible());
    await page.evaluate(()=>v16StartUnit('capacity','basic'));assert.equal(await page.evaluate(()=>queue[pos].id),topic);
    await home();await page.getByRole('button',{name:/過去５年の過去問/}).click();await page.locator('#v15Reveal').click();
    assert((await page.locator('#v15PastAnswer').textContent()).length>50);
    await home();await page.getByRole('button',{name:/頻出論点・判例ノート/}).click();assert(await page.locator('.v17-case-card').count()>0);
    await home();await page.getByRole('button',{name:/バックアップ/}).click();assert((await page.locator('#v13content').textContent()).includes('JSON'));
    await home();
    await page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;await r.update()});
    await page.waitForFunction(async()=>{const names=await caches.keys();return names.length===1&&names[0].startsWith('shihoshoshi-pass-v2-')});
    await context.setOffline(true);await page.reload();await subject('realestate');await resume('ox');
    assert.equal(await page.evaluate(()=>queue[pos].id),estate,'subject resume works after offline reload');
    await subject('civil');
    fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
    await page.screenshot({path:path.join(root,'test-results/mobile-subject.png'),fullPage:true});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no mobile horizontal overflow');
    await page.setViewportSize({width:1280,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no desktop horizontal overflow');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,realBrowser:'Chromium',upgradeFromV192:Boolean(baseline),checks:['subject and format resume','topic and text return','article links','past exam','casebook','backup screen','reload','offline cache and resume','mobile and desktop layout','no page or asset errors']},null,2));
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
