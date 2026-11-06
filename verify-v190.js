'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const page = fs.readFileSync(__dirname + '/index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/design-v1.9.css', 'utf8');
const worker = fs.readFileSync(__dirname + '/service-worker.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync(__dirname + '/manifest.webmanifest', 'utf8'));

assert(/v1\.9\.[01]<\/title>/.test(page));
assert(/司法書士PASS Ver\.1\.9\.[01]/.test(page));
assert.equal((page.match(/design-v1\.9\.css/g) || []).length, 1);
assert.equal((page.match(/class="v190-mark"/g) || []).length, 1);
assert.equal((page.match(/class="v190-kicker"/g) || []).length, 1);
for (const id of ['home', 'pastExam', 'lessons', 'quiz', 'choice5', 'v13view', 'v14library', 'casebook']) {
  assert(page.includes(`id="${id}"`), `missing functional view: ${id}`);
}
for (const handler of ['openDashboard()', 'v14OpenLibrary()', 'startQuiz(false)', 'startFive()', 'v13Backup()', 'v18InstallApp()']) {
  assert(page.includes(handler), `missing action: ${handler}`);
}
assert(css.includes('#home > .actions'));
assert(css.includes('grid-template-columns: repeat(2'));
assert(css.includes('@media (prefers-reduced-motion: reduce)'));
assert(/v19[01]-core-1/.test(worker));
assert(worker.includes("'./design-v1.9.css'"));
assert.equal(manifest.background_color, '#f3f5f2');
assert.equal(manifest.theme_color, '#173f5f');
for (const infoName of ['privacy.html', 'contact.html', 'sources.html']) {
  const infoPage = fs.readFileSync(__dirname + '/' + infoName, 'utf8');
  assert.equal((infoPage.match(/design-v1\.9\.css/g) || []).length, 1, `${infoName}: shared design missing`);
  assert(infoPage.includes('content="#173f5f"'), `${infoName}: theme color not updated`);
}

console.log(JSON.stringify({
  passed: true,
  version: '1.9.x',
  checks: ['shared PASS palette', 'responsive card menu', 'functional views retained', 'core actions retained', 'information pages restyled', 'PWA cache updated', 'manifest colors updated']
}, null, 2));
