import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {generateKeyPairSync,randomBytes,createHash,sign,createPrivateKey,createPublicKey,diffieHellman,hkdfSync,createDecipheriv} from 'node:crypto';
import {validateReviewConfig,ReviewerAccess} from '../src/reviewer-access.mjs';

const sourceRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const issuer='https://xs968799.xsrv.jp/pass-review';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=value=>{
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]+$/.test(value))throw Error('Invalid encrypted setup response');
  const result=Buffer.from(value,'base64url');if(result.toString('base64url')!==value)throw Error('Invalid encrypted setup response');return result;
};

export function buildConnectPackage({outputDirectory,privateDirectory,expiresAt=Math.floor(Date.now()/1000)+7*86400}) {
  const signing=generateKeyPairSync('ed25519'),encryption=generateKeyPairSync('x25519');
  const id=randomBytes(16).toString('hex'),files={};
  for(const [target,source] of [['private/service.php','xserver-php/lib/service.php'],['public/index.php','xserver-php/public/index.php'],['public/.htaccess','xserver-php/public/.htaccess']]) {
    const contents=fs.readFileSync(path.join(sourceRoot,source));files[target]={data:contents.toString('base64'),sha256:hash(contents)};
  }
  const spec={id,issuer,expiresAt,manifestHash:hash(JSON.stringify(files)),files,
    signingPublicKey:Buffer.from(signing.publicKey.export({format:'jwk'}).x,'base64url').toString('hex'),
    encryptionPublicKey:Buffer.from(encryption.publicKey.export({format:'jwk'}).x,'base64url').toString('hex')};
  const filename='pass-review-connect-'+id+'.php';
  const state={spec,endpoint:'https://xs968799.xsrv.jp/'+filename,
    signingPrivateKey:signing.privateKey.export({type:'pkcs8',format:'pem'}),encryptionPrivateKey:encryption.privateKey.export({format:'jwk'})};
  fs.mkdirSync(privateDirectory,{recursive:true,mode:0o700});fs.chmodSync(privateDirectory,0o700);
  fs.mkdirSync(outputDirectory,{recursive:true});
  const privateFile=path.join(privateDirectory,'client-state.json');
  fs.writeFileSync(privateFile,JSON.stringify(state),{mode:0o600,flag:'wx'});
  const core=fs.readFileSync(path.join(sourceRoot,'xserver-php/installer-core.php'),'utf8');
  const entry=`
ini_set('display_errors','0');
header('Content-Type: application/json');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
try {
    $spec=json_decode(base64_decode('${Buffer.from(JSON.stringify(spec)).toString('base64')}'),true,32,JSON_THROW_ON_ERROR);
    $installer=new Installer($spec,__DIR__);
    $result=$installer->handle(['https'=>in_array($_SERVER['HTTPS']??'',['on','1'],true),
        'host'=>$_SERVER['HTTP_HOST']??'', 'path'=>$_SERVER['REQUEST_URI']??'',
        'method'=>$_SERVER['REQUEST_METHOD']??'', 'contentType'=>explode(';',$_SERVER['CONTENT_TYPE']??'')[0],
        'body'=>(string)file_get_contents('php://input',false,null,0,4097)]);
    http_response_code($result['status']);echo json_encode($result['body'],JSON_THROW_ON_ERROR);
}catch(\\Throwable){http_response_code(503);echo '{"error":"Setup unavailable"}';}
`;
  const publicFile=path.join(outputDirectory,filename);
  fs.writeFileSync(publicFile,core+entry,{mode:0o644,flag:'wx'});
  return {state,spec,privateFile,publicFile,sha256:hash(fs.readFileSync(publicFile))};
}

export function setupRequest(state,action,{now=Math.floor(Date.now()/1000),nonce=randomBytes(32).toString('hex')}={}) {
  if(!['install','result','finish'].includes(action))throw Error('Unsupported setup action');
  const claims={id:state.spec.id,action,iat:now,exp:now+120,nonce,manifestHash:state.spec.manifestHash};
  const payload=Buffer.from(JSON.stringify(claims));
  return {payload:payload.toString('base64url'),signature:sign(null,payload,state.signingPrivateKey).toString('base64url')};
}

export function openSetupResult(state,result) {
  if(result.installerId!==state.spec.id||result.manifestHash!==state.spec.manifestHash)throw Error('Unexpected installation receipt');
  const client=result.clientPublic;
  if(!validateReviewConfig(client)||client.endpoint!==issuer||client.issuer!==issuer||bytes(client.publicKey.x).length!==32)throw Error('Unexpected reviewer public configuration');
  const envelope=result.credentials;
  if(envelope?.algorithm!=='X25519-HKDF-SHA256-AES256GCM')throw Error('Unexpected credential encryption');
  const ephemeral=bytes(envelope.publicKey),salt=bytes(envelope.salt),iv=bytes(envelope.iv),tag=bytes(envelope.tag),ciphertext=bytes(envelope.ciphertext);
  if(ephemeral.length!==32||salt.length!==32||iv.length!==12||tag.length!==16||ciphertext.length>8192)throw Error('Invalid encrypted credential lengths');
  const shared=diffieHellman({privateKey:createPrivateKey({key:state.encryptionPrivateKey,format:'jwk'}),
    publicKey:createPublicKey({key:{kty:'OKP',crv:'X25519',x:ephemeral.toString('base64url')},format:'jwk'})});
  const key=Buffer.from(hkdfSync('sha256',shared,salt,'pass-review-credentials:v1:'+state.spec.id,32));
  const decipher=createDecipheriv('aes-256-gcm',key,iv);
  decipher.setAAD(Buffer.from(state.spec.id+':'+state.spec.manifestHash));decipher.setAuthTag(tag);
  let credentials;
  try { credentials=JSON.parse(Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString('utf8')); }
  finally { key.fill(0);shared.fill(0); }
  if(credentials.username!=='play-reviewer'||!/^[A-Za-z0-9_-]{32}$/.test(credentials.password)||
    !/^[a-f0-9]{32}$/.test(credentials.accountId)||!(Date.parse(credentials.validUntil)>Date.now()))throw Error('Unexpected reviewer credential structure');
  return {credentials,clientPublic:client};
}

export function setupCurlConfig(body,headers={}) {
  const quote=value=>'"'+value.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r')+'"';
  let config='';
  if(body)config+='request = "POST"\nheader = "Content-Type: application/json"\ndata-binary = '+quote(JSON.stringify(body))+'\n';
  for(const [name,value]of Object.entries(headers)) {
    if(!/^[a-zA-Z0-9-]+$/.test(name)||typeof value!=='string'||/[\r\n]/.test(value))throw Error('Invalid request header');
    if(body&&name.toLowerCase()==='content-type'){
      if(value.split(';')[0]!=='application/json')throw Error('JSON requests required');
      continue;
    }
    config+='header = '+quote(name+': '+value)+'\n';
  }
  return config;
}

function request(url,body,headers={}) {
  if(!/^https:\/\/xs968799\.xsrv\.jp\/(?:pass-review-connect-[a-f0-9]{32}\.php|pass-review\/(?:healthz|login|grant|logout))$/.test(url))throw Error('Unexpected installation destination');
  const config=setupCurlConfig(body,headers);
  return new Promise((resolve,reject)=>{
    const args=['--disable','--silent','--show-error','--proto','=https','--max-time','25','--max-filesize','1048576'];
    args.push('--config','-');
    args.push('--write-out','\n%{http_code}',url);
    const child=execFile('curl',args,{encoding:'utf8',maxBuffer:1100000},(error,stdout)=>{
      if(error){reject(Error('Setup HTTPS connection failed'));return;}
      const split=stdout.lastIndexOf('\n'),status=Number(stdout.slice(split+1));
      if(status!==200){reject(Error('Setup request failed (HTTP '+status+')'));return;}
      try{resolve(JSON.parse(stdout.slice(0,split)))}catch{reject(Error('Setup returned an invalid response'))}
    });
    child.on('error',()=>reject(Error('Setup HTTP client unavailable')));child.stdin.on('error',()=>{});
    child.stdin.end(config);
  });
}

function saveOnce(file,data) {
  const contents=JSON.stringify(data,null,2)+'\n';
  if(fs.existsSync(file)){if(fs.readFileSync(file,'utf8')!==contents)throw Error('Existing local setup result differs; stopping.');return;}
  fs.writeFileSync(file,contents,{mode:0o600,flag:'wx'});
}

export async function completeSetup({state,privateDirectory,transport=request}) {
  const response=await transport(state.endpoint,setupRequest(state,'install'));
  const result=openSetupResult(state,response);
  const credentialFile=path.join(privateDirectory,'reviewer-credentials.json'),clientPublicFile=path.join(privateDirectory,'client-public.json');
  saveOnce(credentialFile,result.credentials);saveOnce(clientPublicFile,result.clientPublic);
  const health=await transport(issuer+'/healthz');
  if(health.ok!==true)throw Error('Installed service health check failed; setup remains open for recovery.');
  const reviewer=new ReviewerAccess({config:result.clientPublic,request:async(url,options)=>{
    const body=await transport(url,JSON.parse(options.body),options.headers);
    return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
  }});
  try {
    await reviewer.login(result.credentials.username,result.credentials.password);
    if(!reviewer.active)throw Error('Installed reviewer login was not verified.');
    await reviewer.refresh();
    if(!reviewer.active)throw Error('Installed reviewer refresh was not verified.');
  }finally{await reviewer.logout();}
  const closed=await transport(state.endpoint,setupRequest(state,'finish'));
  return {installed:true,reviewerLoginVerified:true,setupClosed:closed.closed,setupFileRemoved:closed.removed,credentialFile,clientPublicFile};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const [action,stateFile]=process.argv.slice(2);
    if(!['check','install'].includes(action)||!stateFile)throw Error('Usage: xserver-connect.mjs check|install PRIVATE-STATE-FILE');
    const state=JSON.parse(fs.readFileSync(stateFile,'utf8'));
    if(state.endpoint!=='https://xs968799.xsrv.jp/pass-review-connect-'+state.spec.id+'.php')throw Error('Unexpected setup endpoint');
    if(action==='check'){
      const result=await request(state.endpoint);
      if(result.installerId!==state.spec.id||result.manifestHash!==state.spec.manifestHash)throw Error('Unexpected setup file');
      console.log(JSON.stringify({ready:result.ready,requirements:result.requirements}));
    }else{
      console.log(JSON.stringify(await completeSetup({state,privateDirectory:path.dirname(stateFile)})));
    }
  }catch(error){console.error(error.message);process.exitCode=1;}
}
