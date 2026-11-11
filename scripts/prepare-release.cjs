/* Refresh asset revisions and the offline cache after editing source files. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p));
const hash = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16);
const manifest = JSON.parse(read('scripts/assets.json'));
const assets = [...manifest.styles, ...manifest.scripts];
const urls = new Map(assets.map(p => [p, `${p}?v=${hash(read(p))}`]));
let html = read('index.html').toString();
html = html.replace(/\b(src|href)="([^"]+)"/g, (whole, attr, url) => {
  const file = url.split('?')[0];
  return urls.has(file) ? `${attr}="${urls.get(file)}"` : whole;
});
fs.writeFileSync(path.join(root, 'index.html'), html);
const fixed = ['privacy.html', 'contact.html', 'sources.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
const revision = hash(html + fixed.map(p => hash(read(p))).join(''));
const core = ['./', './index.html', ...urls.values()].map(p => p.startsWith('./') ? p : './' + p);
core.push(...fixed.map(p => './' + p));
const worker = read('scripts/service-worker.template.js').toString()
  .replace('__CACHE_NAME__', `shihoshoshi-pass-v2-${revision}`)
  .replace('__CORE_FILES__', JSON.stringify(core, null, 2));
fs.writeFileSync(path.join(root, 'service-worker.js'), worker);
console.log(`Prepared ${manifest.version}: ${assets.length} assets, cache ${revision}`);
