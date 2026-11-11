import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
const apps=JSON.parse(fs.readFileSync(path.join(root,'apps.json')));
const localFile=path.join(root,'store-config.local.json');
const local=fs.existsSync(localFile)?JSON.parse(fs.readFileSync(localFile)):{};
function samples(id,app,source) {
  if(id==='shihoshoshi') {
    const {ctx}=require(path.join(source,'tests/support.cjs')).boot(path.join(source,'index.html'));
    return JSON.parse(vm.runInContext(`JSON.stringify({subjects:v11Subjects.map(s=>({id:s.id,name:s.name,questions:questions.filter(q=>s.topics.includes(q.t)).slice(0,${app.samplePerSubject}).map(q=>({id:q.id,text:q.q,answer:q.a,explanation:q.why}))}))})`,ctx));
  }
  const ctx=vm.createContext({window:{}}),html=fs.readFileSync(path.join(source,'index.html'),'utf8');
  for(const match of html.matchAll(/<script[^>]*src="([^"]+)"/g)) {
    const file=match[1];if(file==='app.js')break;
    vm.runInContext(fs.readFileSync(path.join(source,file),'utf8'),ctx);
  }
  const appjs=fs.readFileSync(path.join(source,'app.js'),'utf8'),boundary=appjs.indexOf("  const STORAGE_KEY =");
  if(boundary<0)throw Error('Administrative source layout changed; review extractor');
  vm.runInContext(appjs.slice(0,boundary)+'})();',ctx);
  return JSON.parse(vm.runInContext(`JSON.stringify({subjects:window.GYOPASS_DATA.subjects.map(s=>({id:s.id,name:s.name,questions:window.GYOPASS_DATA.ox.filter(q=>q.subject===s.id).slice(0,${app.samplePerSubject}).map(q=>({id:q.id,text:q.text,answer:q.answer?0:1,explanation:q.explanation}))}))})`,ctx));
}
function bundleStudy(source,destination) {
  const queue=['index.html','privacy.html','contact.html','sources.html'],copied=new Set();
  if(fs.existsSync(path.join(source,'terms.html')))queue.push('terms.html');
  while(queue.length) {
    const file=queue.shift();if(copied.has(file))continue;copied.add(file);
    if(file.includes('..')||path.isAbsolute(file))throw Error('Invalid asset '+file);
    let bytes=fs.readFileSync(path.join(source,file));
    if(file.endsWith('.html')) {
      let html=bytes.toString();
      html=html.replace(/<script\b[^>]*src="(?:js\/pwa\.js|pwa-[^"]+|monetization(?:-config)?\.js)(?:\?[^"]*)?"[^>]*><\/script>/g,'');
      html=html.replace(/<meta\b[^>]*name="google-adsense-account"[^>]*>/g,'');
      html=html.replace(/<link\b[^>]*rel="manifest"[^>]*>/g,'');
      for(const m of html.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)="([^"]+)"/g)) {
        const asset=m[1].split('?')[0];if(!asset.startsWith('http')&&!asset.startsWith('data:'))queue.push(asset.replace(/^\.\//,''));
      }
      if(file==='index.html')html=html.replace('</head>','<script defer src="../study-bridge.js"></script></head>');
      bytes=Buffer.from(html);
    } else if(file.endsWith('.js')) {
      bytes=Buffer.from(bytes.toString().replaceAll("if ('serviceWorker' in navigator)",'if (false)'));
    }
    const out=path.join(destination,file);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,bytes);
  }
  return [...copied];
}
for(const[id,app]of Object.entries(apps)) {
  const source=path.join(root,'sources',id),out=path.join(root,'dist',id);
  if(!fs.existsSync(source))throw Error('Run node scripts/fetch-sources.mjs first');
  if(fs.readFileSync(path.join(source,'.source-commit'),'utf8').trim()!==app.sourceCommit)throw Error('Source commit does not match apps.json');
  const config={...app,id,revenueCat:{...app.revenueCat,...local[id]?.revenueCat}};
  if(!Number.isInteger(config.samplePerSubject)||config.samplePerSubject<1)throw Error('Invalid free sample limit');
  const sample=samples(id,app,source);
  for(const s of sample.subjects)for(const q of s.questions)if(!q.text||![0,1].includes(q.answer)||!q.explanation)throw Error('Invalid sample '+q.id);
  fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
  for(const file of ['index.html','app.css','study-bridge.js'])fs.copyFileSync(path.join(root,'src',file),path.join(out,file));
  await build({entryPoints:[path.join(root,'src/main.mjs')],bundle:true,outfile:path.join(out,'app.js'),format:'iife',target:['safari15','chrome100'],plugins:[{name:'app-data',setup(b){
    b.onResolve({filter:/^(app-config|sample-data)$/},args=>({path:args.path,namespace:'generated'}));
    b.onLoad({filter:/.*/,namespace:'generated'},args=>({contents:JSON.stringify(args.path==='app-config'?config:sample),loader:'json'}));
  }}]});
  const assets=bundleStudy(source,path.join(out,'study'));
  fs.writeFileSync(path.join(out,'build-info.json'),JSON.stringify({app:id,sourceCommit:app.sourceCommit,subjects:sample.subjects.length,freeQuestions:sample.subjects.reduce((n,s)=>n+s.questions.length,0),assets},null,2));
  console.log(id+': '+sample.subjects.length+' subjects; '+assets.length+' bundled study files');
}
