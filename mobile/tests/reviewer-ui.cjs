// Runs the actual built app against a DOM adapter and real authentication handler.
// This verifies application control flow, not Chromium rendering or native APIs.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const {execFileSync}=require('child_process'),{generateKeyPairSync,randomBytes,webcrypto}=require('crypto');
const {Readable}=require('stream');const root=path.resolve(__dirname,'..');
(async()=>{
 const {createReviewService,passwordRecord}=await import('../review-server/service.mjs');
 const {privateKey,publicKey}=generateKeyPairSync('ed25519'),password=randomBytes(24).toString('base64url');
 const account={id:'ui-reviewer',username:'reviewer',password:await passwordRecord(password),enabled:true,role:'play_reviewer',apps:['com.shihoshoshipass.app'],validUntil:new Date(Date.now()+86400000).toISOString()};
 const origin='https://review-ui.test',config={enabled:true,endpoint:origin,issuer:origin,audience:account.apps[0],keyId:'ui-key',publicKey:publicKey.export({format:'jwk'})};
 const handler=await createReviewService({...config,privateKey:privateKey.export({type:'pkcs8',format:'pem'}),loadAccounts:()=>[account]});
 const request=async(url,options)=>{const req=Readable.from([Buffer.from(options.body)]);Object.assign(req,{method:options.method,url:new URL(url).pathname,socket:{remoteAddress:'127.0.0.1'},headers:Object.fromEntries(Object.entries(options.headers).map(([k,v])=>[k.toLowerCase(),v]))});let status=200,result='';const headers={};const res={setHeader(k,v){headers[k]=v},writeHead(s,h){status=s;Object.assign(headers,h);return this},end(body=''){result=body}};await handler(req,res);return new Response(result,{status,headers})};
 const settings=path.join(root,'store-config.local.json'),previous=fs.existsSync(settings)?fs.readFileSync(settings):null;
 try {
  fs.writeFileSync(settings,JSON.stringify({shihoshoshi:{reviewAccess:config}}),{mode:0o600});await import('../scripts/build.mjs?run='+Date.now()+Math.random());
  const fixed=new Set(['appName','homeButton','main','studyArea','studyFrame','closeStudy','toast','backupFile']),ids={},timers=[];
  class El {
   constructor(id){this.id=id;this.hidden=id==='studyArea';this.children=[];this.value='';this.classList={add(){},remove(){}};}
   set innerHTML(value){this.html=value;if(this.id==='main'){for(const id of Object.keys(ids))if(!fixed.has(id))delete ids[id];for(const m of value.matchAll(/\bid="([^"]+)"/g))ids[m[1]]=new El(m[1]);}}
   get innerHTML(){return this.html||''} get firstChild(){return this.children[0]||null} appendChild(el){this.children.push(el)}replaceChildren(){this.children=[]}querySelectorAll(){return []}
  }
  for(const id of fixed)ids[id]=new El(id);
  const learning='{"answers":[],"wrong":[],"preserved":"keep"}',map=new Map([['shihoshoshi-pass-v03',learning],['reviewerActive','true']]);
  const storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),key:i=>[...map.keys()][i],get length(){return map.size}};
  const document={getElementById:id=>ids[id],createElement:tag=>new El(tag),querySelectorAll:()=>[],addEventListener(){},documentElement:{}};
  const sandbox={document,localStorage:storage,crypto:webcrypto,URL,TextEncoder,TextDecoder,atob,btoa,fetch:request,AbortSignal,console,navigator:{userAgent:'Test'},location:{origin:'https://localhost'},setInterval:(fn,ms)=>timers.push({fn,ms}),setTimeout:()=>0,clearTimeout(){},confirm:()=>true,Blob};sandbox.window=sandbox;sandbox.addEventListener=()=>{};sandbox.scrollTo=()=>{};
  vm.runInNewContext(fs.readFileSync(path.join(root,'dist/shihoshoshi/app.js'),'utf8'),sandbox);
  const click=async id=>{assert(ids[id],id+' exists');await ids[id].onclick()};
  await click('full');assert.equal(ids.studyFrame.children.length,0,'local paid flag is ignored');
  await click('homeButton');await click('settings');await click('reviewerAccess');
  ids.reviewUsername.value='reviewer';ids.reviewPassword.value='incorrect';await ids.reviewLogin.onsubmit({preventDefault(){}});assert(ids.reviewError.textContent.includes('確認できません'));assert.equal(ids.reviewPassword.value,'');
  ids.reviewPassword.value=password;await ids.reviewLogin.onsubmit({preventDefault(){}});assert(ids.reviewStudy);
  assert.equal(map.get('shihoshoshi-pass-v03'),learning);await click('reviewStudy');assert.equal(ids.studyArea.hidden,false);assert.equal(ids.studyFrame.firstChild.src,'./study/index.html');
  await click('closeStudy');await click('settings');await click('reviewerAccess');await click('reviewLogout');assert.equal(ids.studyFrame.children.length,0);assert.equal(ids.studyArea.hidden,true);
  ids.reviewUsername.value='reviewer';ids.reviewPassword.value=password;await ids.reviewLogin.onsubmit({preventDefault(){}});await click('reviewStudy');account.enabled=false;
  await timers.find(t=>t.ms===60000).fn();assert.equal(ids.studyArea.hidden,true);assert.equal(ids.studyFrame.children.length,0);
  assert(ids.reviewLogin,'revoked access returns to the sign-in form');assert(!ids.reviewStudy,'revoked access removes the full-study button');assert(!ids.main.innerHTML.includes('Reviewer access verified'),'revoked access removes the verified message');
  assert.equal(map.get('shihoshoshi-pass-v03'),learning);assert(![...map.values()].some(v=>v.includes(password)||v.includes('eyJhbGci')));
  console.log('Built application + real authentication handler: invalid login, login, premium gate, logout, revocation, local tampering and history preservation PASS');
 }finally{if(previous)fs.writeFileSync(settings,previous);else fs.rmSync(settings,{force:true});await import('../scripts/build.mjs?run='+Date.now()+Math.random());}
})().catch(error=>{console.error(error);process.exitCode=1});
