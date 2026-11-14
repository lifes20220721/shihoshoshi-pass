import fs from 'node:fs';
const apps=JSON.parse(fs.readFileSync(new URL('../apps.json',import.meta.url)));
const localURL=new URL('../store-config.local.json',import.meta.url);
const local=fs.existsSync(localURL)?JSON.parse(fs.readFileSync(localURL)):{};
const errors=[];
for(const[id,app]of Object.entries(apps)) {
  const settings=local[id]||{};
  for(const platform of ['ios','android']) {
    const key=settings.revenueCat?.[platform]||app.revenueCat[platform];
    if(!key||key.startsWith('test_')||!(platform==='ios'?key.startsWith('appl_'):key.startsWith('goog_')))errors.push(`${id}: ${platform} の公開用RevenueCat SDKキーが未設定です`);
  }
  for(const check of ['bundleIdsRegistered','monthlyAnnualProductsConfigured','privacyReviewed','storeSandboxPurchasesTested','nativeDevicesTested'])if(settings[check]!==true)errors.push(`${id}: ${check} の確認が必要です`);
}
if(errors.length){console.error('ストア提出前の未完了項目:\n'+errors.map(x=>' - '+x).join('\n'));process.exitCode=1;}else console.log('設定確認は完了。署名・審査提出は各ストアで行ってください。');
