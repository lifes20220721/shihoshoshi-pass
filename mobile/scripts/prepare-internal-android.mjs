import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=path.join(root,'native/shihoshoshi/android/app/build.gradle');
let gradle=fs.readFileSync(file,'utf8');
if(!gradle.includes('applicationId "com.shihoshoshipass.app"')||!/^\s*versionCode 1$/m.test(gradle)||!/^\s*versionName "1.0"$/m.test(gradle))throw Error('Unexpected fresh Android project');
gradle=gradle.replace(/^(\s*versionCode )1$/m,(_,prefix)=>prefix+'2').replace(/^(\s*versionName )"1.0"$/m,'$1"1.1.0-internal"');
fs.writeFileSync(file,gradle);
console.log('Prepared normal package com.shihoshoshipass.app, versionCode 2, versionName 1.1.0-internal');
