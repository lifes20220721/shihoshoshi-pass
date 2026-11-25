const decode = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
const text = value => new TextDecoder().decode(decode(value));
export function validateReviewConfig(config) {
  if (!config?.enabled) return false;
  const url = new URL(config.endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw Error('Review endpoint must use HTTPS');
  const jwk = config.publicKey;
  if (config.audience !== 'com.shihoshoshipass.app' || !config.issuer?.startsWith('https://') || jwk?.kty !== 'OKP' || jwk.crv !== 'Ed25519' || !jwk.x || jwk.d || !config.keyId) throw Error('Invalid reviewer public configuration');
  return true;
}
export async function verifyReviewGrant(token, config, nonce, now = Date.now()) {
  if (!validateReviewConfig(config) || typeof token !== 'string' || token.length>8192 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw Error('Invalid access grant');
  const [header,payload,signature] = token.split('.');
  const h=JSON.parse(text(header)), p=JSON.parse(text(payload)), seconds=Math.floor(now/1000);
  if(h.alg!=='EdDSA'||h.typ!=='JWT'||h.kid!==config.keyId)throw Error('Invalid signing key');
  const key=await crypto.subtle.importKey('jwk',config.publicKey,{name:'Ed25519'},false,['verify']);
  if(!await crypto.subtle.verify('Ed25519',key,decode(signature),new TextEncoder().encode(header+'.'+payload)))throw Error('Invalid signature');
  if(p.iss!==config.issuer||p.aud!==config.audience||p.role!=='play_reviewer'||p.scope!=='study:all'||p.nonce!==nonce||typeof p.sub!=='string'||!p.sub||typeof p.sid!=='string'||!p.sid||!Number.isInteger(p.exp)||!Number.isInteger(p.iat)||p.exp<=seconds||p.iat>seconds+10||p.exp-p.iat>120||p.exp<=p.iat)throw Error('Invalid grant claims');
  return p;
}
export function canStudy(billing, reviewer) { return Boolean(billing.active || reviewer.active); }
export class ReviewerAccess {
  constructor({config,request=(...args)=>globalThis.fetch(...args),onChange=()=>{}}) {
    this.config=config;this.request=request;this.onChange=onChange;
    this.enabled=validateReviewConfig(config);this.epoch=0;this.clear();
  }
  clear() { this.token=null;this.claims=null;this.session=null;this.nonce=null; }
  get active() { return Boolean(this.session&&this.claims&&this.claims.exp*1000>Date.now()); }
  async call(route,body,session) {
    const response=await this.request(this.config.endpoint.replace(/\/$/,'')+route,{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session}:{})},body:JSON.stringify(body),credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error(response.status===429?'試行回数が上限に達しました。しばらくしてからお試しください。':'審査用アクセスを確認できませんでした。認証情報と通信状況をご確認ください。');
    return response.json();
  }
  async login(username,password) {
    if(!this.enabled)throw Error('審査用アクセスは未設定です。');
    this.clear();const epoch=++this.epoch;this.onChange();
    const nonce=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
    const result=await this.call('/login',{username,password,nonce});
    const claims=await verifyReviewGrant(result.grant,this.config,nonce);
    if(epoch!==this.epoch)return;
    if(typeof result.session!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(result.session))throw Error('Invalid session');
    this.nonce=nonce;this.session=result.session;this.token=result.grant;this.claims=claims;this.onChange();
  }
  async refresh() {
    if(!this.session)return;
    const epoch=this.epoch,session=this.session,nonce=this.nonce;
    try {
      const result=await this.call('/grant',{nonce},session), claims=await verifyReviewGrant(result.grant,this.config,nonce);
      if(epoch===this.epoch){this.token=result.grant;this.claims=claims;this.onChange();}
    } catch {
      if(epoch===this.epoch){this.clear();this.onChange();}
    }
  }
  async logout() {
    const session=this.session;this.epoch++;this.clear();this.onChange();
    if(session)try{await this.call('/logout',{},session);}catch{}
  }
}
