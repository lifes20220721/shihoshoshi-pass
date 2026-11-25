import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';

for (const enabled of [false,true]) test(`connection diagnostics enabled=${enabled}: no referral entitlement`,async()=>{
  const config={id:'shihoshoshi',name:'司法書士PASS',website:'https://shihoshoshipass.com/',
    entitlement:'shihoshoshi_premium',offering:'shihoshoshi_subscription',samplePerSubject:10,
    revenueCat:{android:''},referralTrialEnabled:false,connectionTestEnabled:enabled};
  const result=await build({entryPoints:['src/main.mjs'],bundle:true,write:false,format:'iife',plugins:[{name:'native-clock-test',setup(b){
    b.onResolve({filter:/^(?:@capacitor\/|@revenuecat\/|app-config$|sample-data$)/},a=>({path:a.path,namespace:'test'}));
    b.onLoad({filter:/.*/,namespace:'test'},a=>{
      if(a.path==='app-config')return {contents:JSON.stringify(config),loader:'json'};
      if(a.path==='sample-data')return {contents:'{"subjects":[]}',loader:'json'};
      return {contents:`export const Capacitor={isNativePlatform:()=>true,getPlatform:()=>"android"};export const registerPlugin=()=>({read:async()=>{throw Error("Attribution must not be called")},trustedTime:async()=>globalThis.clockRequest()});export const App={addListener:()=>{}};export const Browser={open:async o=>globalThis.opened.push(o.url)};export const Filesystem={};export const Directory={};export const Encoding={};export const Share={};export const LocalNotifications={};export const Purchases={};`};
    });
  }}]});
  const ids={},fixed=new Set(['main','appName','homeButton','studyArea','studyFrame','closeStudy','toast','backupFile']);
  class Element {
    constructor(id){this.id=id;this.hidden=id==='studyArea';this.children=[];this.classList={add(){},remove(){}};}
    index(html){for(const m of html.matchAll(/\bid="([^"]+)"/g))ids[m[1]]=new Element(m[1]);}
    set innerHTML(html){this.html=html;if(this.id==='main'){for(const id of Object.keys(ids))if(!fixed.has(id))delete ids[id];this.index(html)}}
    get innerHTML(){return this.html||''}
    querySelector(){return {insertAdjacentHTML:(_,html)=>{this.html+=html;this.index(html)}}}
    querySelectorAll(){return []}get firstChild(){return this.children[0]||null}
    appendChild(el){this.children.push(el)}replaceChildren(){this.children=[]}
  }
  for(const id of fixed)ids[id]=new Element(id);
  const storage=new Map([['learning','keep']]);let calls=0,offline=false;
  const sandbox={URL,URLSearchParams,console,opened:[],clockRequest:async()=>{calls++;if(offline)throw Error('offline');return {trustedNow:1795564800000,endpoint:'https://xs968799.xsrv.jp/pass-review/healthz'}},
    document:{getElementById:id=>ids[id],createElement:()=>new Element('iframe'),querySelectorAll:()=>[]},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    setInterval:()=>0,setTimeout:()=>0,clearTimeout(){},location:{origin:'https://localhost'}};
  sandbox.window=sandbox;sandbox.addEventListener=()=>{};sandbox.scrollTo=()=>{};
  vm.runInNewContext(result.outputFiles[0].text,sandbox);
  assert.equal(calls,0,'no automatic diagnostic or attribution request');
  await ids.relatedApp.onclick();assert.equal(new URL(sandbox.opened[0]).searchParams.get('id'),'com.gyoseishoshipass.app');
  await ids.settings.onclick();
  assert.equal(Boolean(ids.clockCheck),enabled);
  if(enabled){
    await ids.clockCheck.onclick();assert(ids.clockResult.textContent.startsWith('取得成功：'));assert.equal(calls,1);
    offline=true;await ids.clockCheck.onclick();assert(ids.clockResult.textContent.startsWith('取得失敗：'));
  }
  await ids.homeButton.onclick();await ids.full.onclick();
  assert.equal(ids.studyArea.hidden,true,'clock result cannot unlock paid study');
  assert.equal(ids.studyFrame.children.length,0);assert.equal(storage.get('learning'),'keep');
});
