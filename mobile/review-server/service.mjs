import {createHash,randomBytes,scrypt as scryptCallback,timingSafeEqual,sign,createPrivateKey} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const digest=value=>createHash('sha256').update(value).digest('hex');
export async function passwordRecord(password) {
  const salt=randomBytes(24).toString('hex');
  const hash=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  return {salt,hash:hash.toString('hex')};
}
async function passwordMatches(password,record) {
  if(!record||!/^[a-f0-9]{48}$/.test(record.salt)||!/^[a-f0-9]{128}$/.test(record.hash))return false;
  const actual=await scrypt(password,record.salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  return timingSafeEqual(actual,Buffer.from(record.hash,'hex'));
}
export async function createReviewService({issuer,audience,keyId,privateKey,loadAccounts,origins=['https://localhost'],now=()=>Date.now(),sessionSeconds=28800}) {
  if(new URL(issuer).protocol!=='https:'||audience!=='com.shihoshoshipass.app'||!keyId)throw Error('Invalid service config');
  const key=createPrivateKey(privateKey);if(key.asymmetricKeyType!=='ed25519')throw Error('Ed25519 key required');
  const sessions=new Map(),limits=new Map(),dummy=await passwordRecord(randomBytes(32).toString('hex'));let activeAuth=0;
  const expired=()=>{const t=now();for(const[k,v]of limits)if(v.until<=t)limits.delete(k);for(const[k,v]of sessions)if(v.expires<=t)sessions.delete(k);};
  const limit=key=>{let entry=limits.get(key);if(!entry)limits.set(key,entry={count:0,until:now()+900000});return ++entry.count;};
  const accountAllowed=a=>a&&a.enabled===true&&a.role==='play_reviewer'&&Array.isArray(a.apps)&&a.apps.includes(audience)&&Date.parse(a.validUntil)>now();
  function grant(account,session,nonce) {
    const iat=Math.floor(now()/1000),exp=Math.min(iat+120,Math.floor(Date.parse(account.validUntil)/1000),Math.floor(session.expires/1000));
    const input=b64({alg:'EdDSA',typ:'JWT',kid:keyId})+'.'+b64({iss:issuer,aud:audience,sub:account.id,sid:session.id,role:'play_reviewer',scope:'study:all',nonce,iat,exp});
    return input+'.'+sign(null,Buffer.from(input),key).toString('base64url');
  }
  return async function handler(req,res) {
    const origin=req.headers.origin;
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(origin&&!origins.includes(origin)){res.writeHead(403).end();return;}
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');}
    if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
    const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(body));};
    const unauthorized=()=>reply(401,{error:'Access denied'});
    try {
      expired();const route=new URL(req.url,'https://localhost').pathname;
      if(req.method!=='POST'||!['/login','/grant','/logout'].includes(route)){reply(404,{error:'Not found'});return;}
      if(req.headers['content-type']?.split(';')[0]!=='application/json'){reply(415,{error:'JSON required'});return;}
      let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192){reply(413,{error:'Too large'});return;}}
      const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body)){reply(400,{error:'Invalid request'});return;}
      const accounts=await loadAccounts();if(!Array.isArray(accounts))throw Error('Invalid account store');
      if(route==='/login') {
        const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
        if(!/^[a-z0-9@._+-]{3,100}$/.test(username)||typeof body.password!=='string'||body.password.length>256||!/^[a-f0-9]{64}$/.test(body.nonce)){unauthorized();return;}
        // Use the peer address only. Untrusted Forwarded/X-Forwarded-For is ignored.
        const ip=req.socket.remoteAddress||'unknown';
        if(limits.size>=10000||sessions.size>=1000||activeAuth>=4){reply(503,{error:'Try later'});return;}
        const total=limit('ip:'+digest(ip)),pair=limit('pair:'+digest(ip+'\0'+username));
        if(total>30||pair>5){reply(429,{error:'Try later'});return;}
        const account=accounts.find(a=>a.username===username);let ok;
        activeAuth++;try{ok=await passwordMatches(body.password,account?.password||dummy);}finally{activeAuth--;}
        if(!ok||!accountAllowed(account)){unauthorized();return;}
        const token=randomBytes(32).toString('base64url'),session={id:randomBytes(16).toString('hex'),accountId:account.id,nonce:body.nonce,expires:now()+sessionSeconds*1000,passwordVersion:digest(JSON.stringify(account.password))};
        sessions.set(digest(token),session);reply(200,{session:token,grant:grant(account,session,body.nonce)});return;
      }
      const token=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1],session=token&&sessions.get(digest(token));
      if(!session){unauthorized();return;}
      if(route==='/logout'){sessions.delete(digest(token));reply(200,{ok:true});return;}
      const account=accounts.find(a=>a.id===session.accountId);
      if(!accountAllowed(account)||body.nonce!==session.nonce||session.passwordVersion!==digest(JSON.stringify(account.password))){sessions.delete(digest(token));unauthorized();return;}
      reply(200,{grant:grant(account,session,session.nonce)});
    } catch { if(!res.headersSent)reply(400,{error:'Request could not be processed'});else res.end(); }
  };
}
