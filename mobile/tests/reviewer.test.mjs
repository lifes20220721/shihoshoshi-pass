import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {createReviewService,passwordRecord} from '../review-server/service.mjs';
import {ReviewerAccess,verifyReviewGrant,canStudy,validateReviewConfig} from '../src/reviewer-access.mjs';
const audience='com.shihoshoshipass.app',issuer='https://review.example.test',keyId='test-key';
async function fixture(t) {
  const {privateKey,publicKey}=generateKeyPairSync('ed25519'),password=randomBytes(24).toString('base64url');
  let accounts=[{id:'reviewer-1',username:'reviewer',password:await passwordRecord(password),enabled:true,role:'play_reviewer',apps:[audience],validUntil:new Date(Date.now()+86400000).toISOString()}];
  const handler=await createReviewService({issuer,audience,keyId,privateKey:privateKey.export({type:'pkcs8',format:'pem'}),loadAccounts:()=>accounts});
  const config={enabled:true,endpoint:issuer,issuer,audience,keyId,publicKey:publicKey.export({format:'jwk'})};
  // Exercise the real HTTP handler in process. No TCP or TLS transport is mocked as verified.
  const request=async(url,options)=>{
    const req=Readable.from([Buffer.from(options.body||'')]);
    req.method=options.method;req.url=new URL(url).pathname;req.socket={remoteAddress:'127.0.0.1'};
    req.headers=Object.fromEntries(Object.entries(options.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
    const headers={};let status=200,result='';
    const res={headersSent:false,setHeader(k,v){headers[k]=v},writeHead(s,h={}){status=s;Object.assign(headers,h);this.headersSent=true;return this},end(s=''){result=s;return this}};
    await handler(req,res);return new Response(status===204?null:result,{status,headers});
  };
  return {config,password,request,privateKey,accounts,setAccounts:a=>{accounts=a},reviewer:new ReviewerAccess({config,request})};
}
test('default disabled; invalid endpoint/key/audience rejected',()=>{
  assert(!new ReviewerAccess({config:undefined}).active);
  for(const config of [{enabled:true,endpoint:'http://example.com'},{enabled:true,endpoint:'https://example.com',audience:'other'}])assert.throws(()=>validateReviewConfig(config));
});
test('real server authentication, grant verification, refresh and logout',async t=>{
  const f=await fixture(t);await f.reviewer.login('reviewer',f.password);assert(f.reviewer.active);
  assert(canStudy({active:false},f.reviewer));assert(!canStudy({active:false},{active:false}));assert(canStudy({active:true},{active:false}));
  await f.reviewer.refresh();assert(f.reviewer.active);const session=f.reviewer.session;
  await f.reviewer.logout();assert(!f.reviewer.active);
  const response=await f.request(f.config.endpoint+'/grant',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session},body:JSON.stringify({nonce:'a'.repeat(64)})});assert.equal(response.status,401);
});
test('default transport preserves the browser fetch receiver through login, refresh and logout',async t=>{
  const f=await fixture(t);let requests=0;
  t.mock.method(globalThis,'fetch',function(url,options){
    assert.equal(this,globalThis,'browser fetch must be invoked on its Window/global receiver');
    requests++;return f.request(url,options);
  });
  const reviewer=new ReviewerAccess({config:f.config});
  await reviewer.login('reviewer',f.password);assert(reviewer.active);
  await reviewer.refresh();assert(reviewer.active);
  await reviewer.logout();assert(!reviewer.active);assert.equal(requests,3);
});
test('wrong credentials, absent role, disabled account, wrong app and expired account denied',async t=>{
  const f=await fixture(t);await assert.rejects(()=>f.reviewer.login('reviewer','incorrect'));assert(!f.reviewer.active);
  for(const change of [{role:'user'},{enabled:false},{apps:['other']},{validUntil:'2000-01-01'}]){
    f.setAccounts([{...f.accounts[0],...change}]);await assert.rejects(()=>f.reviewer.login('reviewer',f.password));assert(!f.reviewer.active);
  }
});
test('revocation/password rotation/network failure revoke reviewer access without altering paid access',async t=>{
  const f=await fixture(t);await f.reviewer.login('reviewer',f.password);
  f.accounts[0].enabled=false;await f.reviewer.refresh();assert(!f.reviewer.active);assert(canStudy({active:true},f.reviewer));
  f.accounts[0].enabled=true;await f.reviewer.login('reviewer',f.password);f.accounts[0].password=await passwordRecord('changed-password');await f.reviewer.refresh();assert(!f.reviewer.active);
  await f.reviewer.login('reviewer','changed-password');f.reviewer.request=async()=>{throw Error('offline')};await f.reviewer.refresh();assert(!f.reviewer.active);
});
test('tampered signature, untrusted key, nonce, issuer, audience, algorithm and expiry rejected',async t=>{
  const f=await fixture(t);await f.reviewer.login('reviewer',f.password);const token=f.reviewer.token,nonce=f.reviewer.nonce;
  const [h,p,s]=token.split('.'),claims=JSON.parse(Buffer.from(p,'base64url'));
  await assert.rejects(()=>verifyReviewGrant(h+'.'+Buffer.from(JSON.stringify({...claims,scope:'admin'})).toString('base64url')+'.'+s,f.config,nonce));
  for(const patch of [{exp:0},{iat:claims.iat+1000},{aud:'other'},{iss:'https://other.test'},{role:'user'},{scope:'admin'},{nonce:'other'},{exp:claims.iat+3600}]){
    const data=h+'.'+Buffer.from(JSON.stringify({...claims,...patch})).toString('base64url');const signed=data+'.'+sign(null,Buffer.from(data),f.privateKey).toString('base64url');await assert.rejects(()=>verifyReviewGrant(signed,f.config,nonce));
  }
  const data=Buffer.from(JSON.stringify({alg:'none',typ:'JWT',kid:keyId})).toString('base64url')+'.'+p;await assert.rejects(()=>verifyReviewGrant(data+'.'+s,f.config,nonce));
  await assert.rejects(()=>verifyReviewGrant(token,f.config,'wrong'));
  const other=generateKeyPairSync('ed25519');await assert.rejects(()=>verifyReviewGrant(token,{...f.config,publicKey:other.publicKey.export({format:'jwk'})},nonce));
  const real=Date.now;try{Date.now=()=>real()+180000;assert(!f.reviewer.active)}finally{Date.now=real}
});
test('login throttling and CORS enforce boundaries',async t=>{
  const f=await fixture(t);for(let i=0;i<5;i++)await assert.rejects(()=>f.reviewer.login('reviewer','wrong'));
  await assert.rejects(()=>f.reviewer.login('reviewer',f.password),/上限/);
  const response=await f.request(issuer+'/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},body:'{}'});assert.equal(response.status,403);
});
test('logout during pending login cannot restore access',async t=>{
  const f=await fixture(t);let resolve;const base=f.reviewer.request;
  f.reviewer.request=async(url,options)=>{const result=await base(url,options);await new Promise(r=>{resolve=r});return result};
  const pending=f.reviewer.login('reviewer',f.password);while(!resolve)await new Promise(r=>setTimeout(r,5));await f.reviewer.logout();resolve();await pending;assert(!f.reviewer.active);
});
