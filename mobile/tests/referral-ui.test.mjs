import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';

for (const app of ['shihoshoshi','gyoseishoshi']) test(app+': referral access opens study and expiry closes it', async () => {
  const source=app==='shihoshoshi'?'gyoseishoshi_pass':'shihoshoshi_pass';
  const installedAt=Date.parse('2026-11-16T00:00:00Z');
  const config={id:app,name:app,website:'https://'+app+'pass.com/',entitlement:app+'_premium',offering:app+'_subscription',samplePerSubject:10,revenueCat:{android:''},referralTrialEnabled:true};
  const result=await build({entryPoints:['src/main.mjs'],bundle:true,write:false,format:'iife',plugins:[{name:'native-test',setup(b){
    b.onResolve({filter:/^(?:@capacitor\/|@revenuecat\/|app-config$|sample-data$)/},a=>({path:a.path,namespace:'test'}));
    b.onLoad({filter:/.*/,namespace:'test'},a=>{
      if(a.path==='app-config')return {contents:JSON.stringify(config),loader:'json'};
      if(a.path==='sample-data')return {contents:'{"subjects":[]}',loader:'json'};
      return {contents:`export const Capacitor={isNativePlatform:()=>true,getPlatform:()=>"android"};export const registerPlugin=()=>({read:async()=>globalThis.playResult});export const App={addListener:()=>{}};export const Browser={open:async o=>globalThis.opened.push(o.url)};export const Filesystem={};export const Directory={};export const Encoding={};export const Share={};export const LocalNotifications={};export const Purchases={};`};
    });
  }}]});
  const ids={},timers=[],fixed=new Set(['main','appName','homeButton','studyArea','studyFrame','closeStudy','toast','backupFile']);
  class Element {
    constructor(id){this.id=id;this.hidden=id==='studyArea';this.children=[];this.classList={add(){},remove(){}};}
    set innerHTML(html){this.html=html;if(this.id==='main'){for(const id of Object.keys(ids))if(!fixed.has(id))delete ids[id];this.index(html)}}
    get innerHTML(){return this.html||''}
    index(html){for(const m of html.matchAll(/\bid="([^"]+)"/g))ids[m[1]]=new Element(m[1]);}
    querySelector(){return {insertAdjacentHTML:(_,html)=>{this.html+=html;this.index(html)}}}
    querySelectorAll(){return []}
    appendChild(el){this.children.push(el)}
    get firstChild(){return this.children[0]||null}
    replaceChildren(){this.children=[]}
  }
  for(const id of fixed)ids[id]=new Element(id);
  let now=installedAt;
  class Clock extends Date {static now(){return now}}
  const storage=new Map([['learning','keep']]);
  const sandbox={Date:Clock,performance:{now:()=>now},URL,URLSearchParams,console,opened:[],playResult:{referrer:`utm_source=${source}&utm_medium=app`,installedAt,trustedNow:installedAt},document:{getElementById:id=>ids[id],createElement:()=>new Element('iframe'),querySelectorAll:()=>[]},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setInterval:(fn,ms)=>timers.push({fn,ms}),setTimeout:()=>0,clearTimeout(){},location:{origin:'https://localhost'}};
  sandbox.window=sandbox;sandbox.addEventListener=()=>{};sandbox.scrollTo=()=>{};
  vm.runInNewContext(result.outputFiles[0].text,sandbox);
  await new Promise(resolve=>setImmediate(resolve));
  assert(ids.main.innerHTML.includes('支払い登録は不要'));
  await ids.relatedApp.onclick();
  const store=new URL(sandbox.opened[0]);
  assert.equal(store.searchParams.get('id'),app==='shihoshoshi'?'com.gyoseishoshipass.app':'com.shihoshoshipass.app');
  await ids.full.onclick();
  assert.equal(ids.studyArea.hidden,false);
  assert.equal(ids.studyFrame.firstChild.src,'./study/index.html');
  now=Date.parse('2026-12-16T00:00:00Z');
  timers.find(t=>t.ms===1000).fn();
  assert.equal(ids.studyArea.hidden,true);
  assert.equal(ids.studyFrame.children.length,0);
  assert.equal(storage.get('learning'),'keep');
  assert(!ids.main.innerHTML.includes('支払い登録は不要'));
  await ids.full.onclick();
  assert.equal(ids.studyArea.hidden,true);
});
