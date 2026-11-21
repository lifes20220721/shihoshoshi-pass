import {execFile} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const origin='https://api.xserver.ne.jp';
const server='xs968799';

// The credential travels through curl's stdin, never argv, URLs, source or logs.
// No redirects: an API key must never follow an unexpected cross-host response.
function curlRequest(url,key) {
  return new Promise((resolve,reject)=>{
    const child=execFile('curl',['--disable','--request','GET','--silent','--show-error','--proto','=https',
      '--max-time','20','--max-filesize','1048576','--config','-',
      '--write-out','\n%{http_code}',url],{encoding:'utf8',maxBuffer:1100000},(error,stdout)=>{
      if(error){reject(Error('XServer API transport failed'));return;}
      const split=stdout.lastIndexOf('\n');
      const status=Number(stdout.slice(split+1));
      let body;
      try { body=JSON.parse(stdout.slice(0,split)); }
      catch { reject(Error('XServer API returned an invalid response'));return; }
      resolve({status,body});
    });
    child.on('error',()=>reject(Error('XServer API client unavailable')));
    child.stdin.on('error',()=>{});
    child.stdin.end('header = "Authorization: Bearer '+key+'"\n');
  });
}

export async function checkXServerApi({key=process.env.XSERVER_API_KEY,request=curlRequest}={}) {
  if(typeof key!=='string'||!/^xs_[A-Za-z0-9_-]{20,512}$/.test(key)) {
    throw Error('Set XSERVER_API_KEY in the environment secret settings; do not paste it into chat.');
  }
  async function get(path) {
    let result;
    try { result=await request(origin+path,key); }
    catch { throw Error('XServer API connection failed; no server settings were changed.'); }
    if(!result||result.status!==200) {
      const status=Number.isInteger(result?.status)?result.status:0;
      throw Error('XServer API check failed (HTTP '+status+'); no server settings were changed.');
    }
    if(!result.body||typeof result.body!=='object'||Array.isArray(result.body))throw Error('Unexpected XServer API response.');
    return result.body;
  }
  await get('/v1/me');
  const info=await get('/v1/server/'+server+'/server-info');
  if(info.server_id!==server)throw Error('Unexpected server identity; stopping.');
  const jobs=await get('/v1/server/'+server+'/cron');
  if(!Array.isArray(jobs.crons))throw Error('Unexpected Cron list; stopping.');
  // Server-info and API-key metadata may contain tokens: return only this allowlist.
  return {authenticated:true,serverId:server,readOnlyCheck:true,existingCronJobs:jobs.crons.length};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await checkXServerApi())); }
  catch(error) { console.error(error.message);process.exitCode=1; }
}
