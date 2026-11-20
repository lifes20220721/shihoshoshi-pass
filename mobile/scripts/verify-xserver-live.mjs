import {execFile} from 'node:child_process';

const base='https://xs366651.xsrv.jp';
const probes=[
  {name:'service health',path:'/pass-review/healthz',status:[200],check:body=>JSON.parse(body).ok===true},
  {name:'unauthenticated grant denied',path:'/pass-review/grant',status:[401],body:{nonce:'a'.repeat(64)}},
  {name:'incorrect reviewer password denied',path:'/pass-review/login',status:[401],body:{username:'play-reviewer',password:'invalid-authentication-probe',nonce:'b'.repeat(64)}},
  {name:'untrusted web origin denied',path:'/pass-review/login',status:[403],method:'OPTIONS',headers:['Origin: https://untrusted.example','Access-Control-Request-Method: POST']},
  {name:'private account store not public',path:'/pass-review-private/accounts.json',status:[403,404]},
  {name:'private signing key not public',path:'/pass-review/signing.key',status:[403,404]},
  {name:'temporary setup file removed',path:'/pass-review-connect-691c7c997350fa56fbd4e8839c0c20e5.php',status:[404,410]}
];

function probe(item){return new Promise((resolve,reject)=>{
  const args=['--disable','--silent','--show-error','--proto','=https','--max-time','20','--max-filesize','1048576',
    '--header','Cache-Control: no-cache'];
  if(item.method)args.push('--request',item.method);
  for(const header of item.headers||[])args.push('--header',header);
  if(item.body)args.push('--request','POST','--header','Content-Type: application/json','--data-binary','@-');
  args.push('--write-out','\n%{http_code}',base+item.path);
  const child=execFile('curl',args,{encoding:'utf8',maxBuffer:1100000},(error,stdout)=>{
    if(error){reject(Error('HTTPS probe transport failed'));return;}
    const split=stdout.lastIndexOf('\n'),status=Number(stdout.slice(split+1));
    let passed=item.status.includes(status);
    if(passed&&item.check)try{passed=item.check(stdout.slice(0,split))}catch{passed=false}
    resolve({probe:item.name,status,passed});
  });
  child.on('error',()=>reject(Error('HTTPS probe unavailable')));child.stdin.on('error',()=>{});
  child.stdin.end(item.body?JSON.stringify(item.body):'');
})}

let passed=true;
for(const item of probes){
  try{const result=await probe(item);console.log(JSON.stringify(result));passed&&=result.passed;}
  catch{passed=false;console.log(JSON.stringify({probe:item.name,passed:false,error:'HTTPS transport failed'}));}
}
if(!passed)process.exitCode=1;
