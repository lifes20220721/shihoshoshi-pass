import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {buildConnectPackage,setupRequest,openSetupResult,completeSetup} from '../scripts/xserver-connect.mjs';
import {ReviewerAccess} from '../src/reviewer-access.mjs';

const php=process.env.PASS_PHP_BIN||'php';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bridge=path.join(root,'tests/fixtures/xserver-installer.php');
const serviceBridge=path.join(root,'tests/fixtures/xserver-request.php');
function run(args,input=''){return new Promise((resolve,reject)=>{
  const child=execFile(php,args,{encoding:'utf8',maxBuffer:2000000},(error,stdout)=>error?reject(error):resolve(stdout));
  child.stdin.on('error',()=>{});child.stdin.end(input);
})}
function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pass-installer-test-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const domain=path.join(dir,'domain'),publicDir=path.join(domain,'public_html'),privateDir=path.join(dir,'operator-private');
  fs.mkdirSync(publicDir,{recursive:true,mode:0o755});
  const originals={'.htaccess':'original root rules','.user.ini':'original PHP configuration','index.html':'original home page'};
  for(const [name,contents]of Object.entries(originals))fs.writeFileSync(path.join(publicDir,name),contents);
  const built=buildConnectPackage({outputDirectory:publicDir,privateDirectory:privateDir});
  const specFile=path.join(privateDir,'spec.json');fs.writeFileSync(specFile,JSON.stringify(built.spec),{mode:0o600});
  const raw=(patch={})=>({https:true,host:'xs366651.xsrv.jp',path:new URL(built.state.endpoint).pathname,method:'POST',contentType:'application/json',...patch});
  const call=async patch=>JSON.parse(await run([bridge,specFile,publicDir],JSON.stringify(raw(patch))));
  const action=(name,options)=>call({body:JSON.stringify(setupRequest(built.state,name,options))});
  const preserved=()=>{for(const [name,contents]of Object.entries(originals))assert.equal(fs.readFileSync(path.join(publicDir,name),'utf8'),contents)};
  return {...built,dir,domain,publicDir,privateDir,specFile,raw,call,action,preserved,
    installedPrivate:path.join(domain,'pass-review-private'),installedPublic:path.join(publicDir,'pass-review')};
}

test('single upload file is valid PHP, contains only public connection keys, and GET writes nothing',async t=>{
  const f=fixture(t),source=fs.readFileSync(f.publicFile,'utf8');
  assert(!source.includes(f.state.signingPrivateKey));
  assert(!source.includes(f.state.encryptionPrivateKey.d));
  assert.equal(fs.statSync(path.dirname(f.privateFile)).mode&0o777,0o700);
  assert.equal(fs.statSync(f.privateFile).mode&0o777,0o600);
  assert((await run(['-l',f.publicFile])).includes('No syntax errors'));
  const response=await f.call({method:'GET'});assert.equal(response.status,200);assert.equal(response.body.ready,true);
  assert(!fs.existsSync(path.join(f.domain,'pass-review-setup-'+f.spec.id)));f.preserved();
});

test('unsigned, tampered, expired, replayed or incorrectly addressed requests cannot start installation',async t=>{
  const f=fixture(t),body=setupRequest(f.state,'install');
  const tampered={...body,payload:Buffer.from(JSON.stringify({id:f.spec.id,action:'finish'})).toString('base64url')};
  for(const [patch,status]of [
    [{body:'{}'},401],[{body:JSON.stringify(tampered)},401],
    [{body:JSON.stringify(setupRequest(f.state,'install',{now:Math.floor(Date.now()/1000)-300}))},401],
    [{https:false,body:JSON.stringify(body)},426],[{host:'evil.example',body:JSON.stringify(body)},400],
    [{path:'/other.php',body:JSON.stringify(body)},404],[{contentType:'text/plain',body:JSON.stringify(body)},415],
    [{body:'x'.repeat(4097)},413]
  ])assert.equal((await f.call(patch)).status,status);
  assert(!fs.existsSync(f.installedPrivate));assert(!fs.existsSync(f.installedPublic));
  assert(!fs.existsSync(path.join(f.domain,'pass-review-setup-'+f.spec.id)));f.preserved();
});

test('installer expires and refuses an altered bundled source before creating service files',async t=>{
  const f=fixture(t);
  const expired={...f.spec,expiresAt:Math.floor(Date.now()/1000)-1};fs.writeFileSync(f.specFile,JSON.stringify(expired));
  assert.equal((await f.action('install')).status,410);
  f.spec.files['private/service.php'].data=Buffer.from('altered source').toString('base64');
  fs.writeFileSync(f.specFile,JSON.stringify(f.spec));
  assert.equal((await f.action('install')).status,503);
  assert(!fs.existsSync(f.installedPrivate));assert(!fs.existsSync(f.installedPublic));f.preserved();
});

test('existing target directories are preserved without overwrite',async t=>{
  const f=fixture(t);fs.mkdirSync(f.installedPublic);fs.writeFileSync(path.join(f.installedPublic,'keep.txt'),'existing data');
  assert.equal((await f.action('install')).status,409);
  assert.equal(fs.readFileSync(path.join(f.installedPublic,'keep.txt'),'utf8'),'existing data');
  assert(!fs.existsSync(f.installedPrivate));f.preserved();
});

test('signed installation creates real reviewer service, encrypts credentials, and preserves root files',async t=>{
  const f=fixture(t),response=await f.action('install');assert.equal(response.status,200);
  const opened=openSetupResult(f.state,response.body);
  const account=JSON.parse(fs.readFileSync(path.join(f.installedPrivate,'accounts.json'),'utf8'))[0];
  assert.equal(account.role,'play_reviewer');assert(account.passwordHash.startsWith('$argon2id$'));
  assert(!JSON.stringify(response).includes(opened.credentials.password));
  for(const file of fs.readdirSync(f.installedPrivate))if(fs.statSync(path.join(f.installedPrivate,file)).isFile()){
    assert(!fs.readFileSync(path.join(f.installedPrivate,file)).includes(Buffer.from(opened.credentials.password)));
    assert.equal(fs.statSync(path.join(f.installedPrivate,file)).mode&0o777,0o600);
  }
  assert.equal(fs.statSync(f.installedPrivate).mode&0o777,0o700);
  assert.equal(fs.statSync(f.installedPublic).mode&0o777,0o755);f.preserved();
  const request=async(url,options)=>{
    const result=JSON.parse(await run([serviceBridge,f.installedPrivate],JSON.stringify({https:true,host:'xs366651.xsrv.jp',
      ip:'192.0.2.1',path:new URL(url).pathname,method:options.method,
      headers:Object.fromEntries(Object.entries(options.headers).map(([k,v])=>[k.toLowerCase(),v])),body:options.body})));
    return new Response(JSON.stringify(result.body),{status:result.status,headers:result.headers});
  };
  const reviewer=new ReviewerAccess({config:opened.clientPublic,request});
  await reviewer.login(opened.credentials.username,opened.credentials.password);assert(reviewer.active);
  await reviewer.refresh();assert(reviewer.active);await reviewer.logout();assert(!reviewer.active);
});

test('installation is idempotent, reply can be recovered, and nonce replay is denied',async t=>{
  const f=fixture(t),envelope=setupRequest(f.state,'install');
  const first=await f.call({body:JSON.stringify(envelope)});assert.equal(first.status,200);
  assert.equal((await f.call({body:JSON.stringify(envelope)})).status,409);
  const second=await f.action('install'),recovered=await f.action('result');
  assert.deepEqual(second.body,first.body);assert.deepEqual(recovered.body,first.body);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.installedPrivate,'accounts.json'),'utf8')).length,1);f.preserved();
});

test('concurrent signed installations create exactly one account and the same receipt',async t=>{
  const f=fixture(t),responses=await Promise.all([f.action('install'),f.action('install')]);
  assert(responses.every(r=>r.status===200));assert.deepEqual(responses[0].body,responses[1].body);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.installedPrivate,'accounts.json'),'utf8')).length,1);f.preserved();
});

test('encrypted credentials reject tampering and a different operator key',async t=>{
  const f=fixture(t),response=await f.action('install');assert.equal(response.status,200);
  const altered=structuredClone(response.body);altered.credentials.tag=randomBytes(16).toString('base64url');
  assert.throws(()=>openSetupResult(f.state,altered));
  const other=generateKeyPairSync('x25519');assert.throws(()=>openSetupResult({...f.state,encryptionPrivateKey:other.privateKey.export({format:'jwk'})},response.body));
});

test('finish requires completed installation, deletes the upload file, and permanently closes setup',async t=>{
  const f=fixture(t);assert.equal((await f.action('finish')).status,409);assert(fs.existsSync(f.publicFile));
  assert.equal((await f.action('install')).status,200);
  const finished=await f.action('finish');assert.equal(finished.status,200);assert.equal(finished.body.removed,true);
  assert(!fs.existsSync(f.publicFile));assert.equal((await f.action('result')).status,410);
  assert.equal((await f.call({method:'GET'})).status,410);f.preserved();
});

test('complete client workflow persists secrets privately, verifies real PHP login, then removes setup',async t=>{
  const f=fixture(t),calls=[];
  const transport=async(url,body,headers={})=>{
    const pathname=new URL(url).pathname;calls.push(pathname);
    let response;
    if(url===f.state.endpoint){response=await f.call({body:JSON.stringify(body)});}
    else{response=JSON.parse(await run([serviceBridge,f.installedPrivate],JSON.stringify({https:true,host:'xs366651.xsrv.jp',
      path:pathname,method:body?'POST':'GET',ip:'192.0.2.1',headers:Object.fromEntries(Object.entries({'Content-Type':'application/json',...headers}).map(([k,v])=>[k.toLowerCase(),v])),
      body:body?JSON.stringify(body):''})));}
    if(response.status!==200)throw Error('HTTP '+response.status);
    return response.body;
  };
  const result=await completeSetup({state:f.state,privateDirectory:f.privateDir,transport});
  assert.equal(result.reviewerLoginVerified,true);assert.equal(result.setupFileRemoved,true);
  assert.equal(fs.statSync(result.credentialFile).mode&0o777,0o600);
  const credentials=JSON.parse(fs.readFileSync(result.credentialFile,'utf8'));
  assert(!JSON.stringify(result).includes(credentials.password));
  assert.deepEqual(calls.slice(1,-1),['/pass-review/healthz','/pass-review/login','/pass-review/grant','/pass-review/logout']);
  assert(!fs.existsSync(f.publicFile));f.preserved();
});

test('failed live verification leaves authenticated setup available for recovery',async t=>{
  const f=fixture(t);
  await assert.rejects(()=>completeSetup({state:f.state,privateDirectory:f.privateDir,transport:async(url,body)=>{
    if(url===f.state.endpoint){const result=await f.call({body:JSON.stringify(body)});return result.body;}
    throw Error('network unavailable');
  }}));
  assert(fs.existsSync(f.publicFile));assert(fs.existsSync(path.join(f.privateDir,'reviewer-credentials.json')));
  assert.equal((await f.action('result')).status,200);f.preserved();
});
