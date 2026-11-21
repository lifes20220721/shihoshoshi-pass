import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const apps=JSON.parse(fs.readFileSync(path.join(root,'apps.json')));
for(const[id,app]of Object.entries(apps)) {
  const destination=path.join(root,'sources',id),stamp=path.join(destination,'.source-commit');
  if(fs.existsSync(stamp)&&fs.readFileSync(stamp,'utf8').trim()===app.sourceCommit)continue;
  if(!/^[a-f0-9]{40}$/.test(app.sourceCommit)||!/^lifes20220721\/[a-z-]+$/.test(app.repository))throw Error('Invalid source reference');
  const archive=path.join(root,'sources',id+'.tar.gz');fs.mkdirSync(path.dirname(archive),{recursive:true});
  execFileSync('curl',['-L','--fail','--retry','2','--max-time','180','-o',archive,`https://api.github.com/repos/${app.repository}/tarball/${app.sourceCommit}`],{stdio:'inherit'});
  fs.rmSync(destination,{recursive:true,force:true});fs.mkdirSync(destination,{recursive:true});
  execFileSync('tar',['-xzf',archive,'--strip-components=1','-C',destination]);
  fs.writeFileSync(stamp,app.sourceCommit+'\n');fs.unlinkSync(archive);
}
