import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const config=JSON.parse(fs.readFileSync(new URL('review-access.public.json',root)));
config.shihoshoshi.referralTrialEnabled=false;
config.shihoshoshi.connectionTestEnabled=true;
fs.writeFileSync(new URL('store-config.local.json',root),JSON.stringify(config,null,2)+'\n',{mode:0o600});
console.log('Internal connection test configured; referral benefits disabled.');
