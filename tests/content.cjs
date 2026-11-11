'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {boot} = require('./support.cjs');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const {ctx, storage, before} = boot(path.join(root,'index.html'));
const baseline = require('./content-baseline.json');
for (const [name, item] of Object.entries(baseline.hashes)) {
  const content = vm.runInContext(`JSON.stringify(${item.expression})`, ctx);
  assert.equal(crypto.createHash('sha256').update(content).digest('hex'), item.sha256, `${name}: text, IDs and order match v1.9.2`);
}
assert.equal(storage.get('shihoshoshi-pass-v03'),before,'startup preserves history');
assert(html.includes('ca-pub-8976067134459371'));
assert.equal((html.match(/https:\/\/gyoseishoshipass\.com\//g)||[]).length,2);
assert.equal((html.match(/<script\b[^>]*>/g)||[]).length,33);
assert(!/<script\b[^>]*>\s*\S+/.test(html.replace(/<script[^>]*><\/script>/g,'')), 'no inline executable code');
assert(!html.includes('<style'), 'CSS is external');
const assets = require('../scripts/assets.json');
for(const file of assets.scripts) new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
const worker = fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
const sandbox = vm.createContext({self:{addEventListener(){}}});
vm.runInContext(worker,sandbox);
const core = vm.runInContext('CORE_FILES',sandbox);
for(const match of html.matchAll(/(?:src|href)="([^"]+\?v=[a-f0-9]+)"/g)) {
  assert(core.includes('./'+match[1]),`offline cache includes ${match[1]}`);
  const [file, query] = match[1].split('?v=');
  const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex').slice(0,16);
  assert.equal(query,digest,`asset revision matches ${file}`);
}
console.log('Content, history, script syntax, AdSense, reciprocal links and offline manifest: PASS');
