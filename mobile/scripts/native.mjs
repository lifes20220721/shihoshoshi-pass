import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const apps=JSON.parse(fs.readFileSync(path.join(root,'apps.json'))),[id,platform]=process.argv.slice(2);
if(!apps[id]||!['android','ios'].includes(platform))throw Error('Usage: npm run native -- shihoshoshi|gyoseishoshi android|ios');
const dir=path.join(root,'native',id),app=apps[id];fs.mkdirSync(dir,{recursive:true});
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json')));
fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({...pkg,name:'pass-native-'+id},null,2));
const modules=path.join(dir,'node_modules');if(!fs.existsSync(modules))fs.symlinkSync(path.join(root,'node_modules'),modules,'dir');
fs.writeFileSync(path.join(dir,'capacitor.config.json'),JSON.stringify({appId:app.bundleId,appName:app.name,webDir:'../../dist/'+id,backgroundColor:'#eef3f2',ios:{contentInset:'never'},android:{allowMixedContent:false},plugins:{LocalNotifications:{smallIcon:'ic_stat_book',iconColor:'#173f5f'}}},null,2));
const cli=path.join(root,'node_modules/@capacitor/cli/bin/capacitor');
execFileSync(process.execPath,[cli,fs.existsSync(path.join(dir,platform))?'sync':'add',platform],{cwd:dir,stdio:'inherit'});
if(platform==='android') {
  const manifest=path.join(dir,'android/app/src/main/AndroidManifest.xml');
  fs.writeFileSync(manifest,fs.readFileSync(manifest,'utf8').replace('android:launchMode="singleTask"','android:launchMode="singleTop"'));
  const drawable=path.join(dir,'android/app/src/main/res/drawable');fs.mkdirSync(drawable,{recursive:true});
  fs.writeFileSync(path.join(drawable,'ic_stat_book.xml'),'<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24"><path android:fillColor="#FFFFFFFF" android:pathData="M4,3h7v17H4zM13,3h7v17h-7z"/></vector>');
}
const icon=path.join(root,'sources',id,'icons',id==='shihoshoshi'?'icon-512.png':'app-icon.svg');
if(platform==='android') {
  const res=path.join(dir,'android/app/src/main/res');
  for(const[density,size]of Object.entries({mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192})) {
    const folder=path.join(res,'mipmap-'+density);fs.mkdirSync(folder,{recursive:true});
    for(const filename of ['ic_launcher.png','ic_launcher_round.png','ic_launcher_foreground.png'])await sharp(icon).resize(size,size).flatten({background:'#173f5f'}).png().toFile(path.join(folder,filename));
  }
  // Use the full brand icon, without clipping it through the template adaptive mask.
  fs.rmSync(path.join(res,'mipmap-anydpi-v26'),{recursive:true,force:true});
} else {
  await sharp(icon).resize(1024,1024).flatten({background:'#173f5f'}).png().toFile(path.join(dir,'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'));
  fs.copyFileSync(path.join(root,'src/PrivacyInfo.xcprivacy'),path.join(dir,'ios/App/App/PrivacyInfo.xcprivacy'));
  const pbx=path.join(dir,'ios/App/App.xcodeproj/project.pbxproj');let project=fs.readFileSync(pbx,'utf8');
  if(!project.includes('PrivacyInfo.xcprivacy')) {
    project=project.replace('/* End PBXBuildFile section */','\t\tAA0000000000000000000001 /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = AA0000000000000000000002; };\n/* End PBXBuildFile section */');
    project=project.replace('/* End PBXFileReference section */','\t\tAA0000000000000000000002 /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };\n/* End PBXFileReference section */');
    project=project.replace('504EC3131FED79650016851F /* Info.plist */,','504EC3131FED79650016851F /* Info.plist */,\n\t\t\t\tAA0000000000000000000002 /* PrivacyInfo.xcprivacy */,');
    project=project.replace(/(isa = PBXResourcesBuildPhase;[\s\S]*?files = \()/,'$1\n\t\t\t\tAA0000000000000000000001 /* PrivacyInfo.xcprivacy in Resources */,');
    fs.writeFileSync(pbx,project);
  }
}
console.log('Native project: '+path.join(dir,platform));
