'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {references} = require('./article-links-v1.8.4.js');
const labels = s => references(s).map(r => r.label);
assert.deepEqual(labels('民法３条・３条の２'), ['民法第三条', '民法第三条の二']);
assert.deepEqual(labels('民法４・５条'), ['民法第四条', '民法第五条']);
assert.deepEqual(labels('民法第九十四条第二項・第九十五条'), ['民法第九十四条', '民法第九十五条']);
assert.deepEqual(labels('民法3条2項・3項'), ['民法第三条']);
assert.deepEqual(labels('不動産登記規則158条の39'), ['不動産登記規則第百五十八条の三十九']);
assert.deepEqual(labels('一般法人法49条2項・150条'), ['一般法人法第四十九条', '一般法人法第百五十条']);
assert.deepEqual(labels('民法1条、会社法2条、商法3条'), ['民法第一条', '会社法第二条', '商法第三条']);
assert.equal(new URL(references('商法1条')[0].href).pathname, '/law/132AC0000000048');
assert.equal(new URL(references('供託法1条')[0].href).pathname, '/law/132AC0000000015');
for (const s of ['旧民法903条', '試験時民法903条', '改正前の民法903条', '同法3条', '第3条', '特別民法3条', '民法0条', '民法99999条']) assert.deepEqual(labels(s), []);

// Minimal DOM adapter: verifies preservation of text, existing links and event
// handlers, plus the observer path used for restored answers and rerenders.
class Node {
  constructor(type, text = '') { this.nodeType = type; this.nodeValue = type === 3 ? text : null; this.childNodes = []; this.parentElement = null; this.className = ''; this.attributes = {}; }
  get textContent() { return this.nodeType === 3 ? this.nodeValue : this.childNodes.map(n => n.textContent).join(''); }
  set textContent(text) { this.childNodes.forEach(n => n.parentElement = null); this.childNodes = []; this.appendChild(new Node(3, String(text))); }
  appendChild(node) {
    if (node.nodeType === 11) { [...node.childNodes].forEach(n => this.appendChild(n)); node.childNodes = []; return node; }
    node.parentElement = this; this.childNodes.push(node); return node;
  }
  replaceWith(fragment) {
    const p = this.parentElement, index = p.childNodes.indexOf(this);
    p.childNodes.splice(index, 1, ...fragment.childNodes);
    fragment.childNodes.forEach(n => n.parentElement = p); this.parentElement = null;
  }
  matches(selector) { return selector.startsWith('.') ? this.className.split(' ').includes(selector.slice(1)) : this.tagName === selector.toUpperCase(); }
  closest(selectors) { return selectors.split(',').some(s => this.matches(s)) ? this : this.parentElement?.closest(selectors); }
  querySelectorAll(selector) { return descendants(this).filter(n => n.nodeType === 1 && n.matches(selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  contains(node) { return node === this || descendants(this).includes(node); }
  setAttribute(key, value) { this.attributes[key] = value; }
}
const descendants = root => root.childNodes.flatMap(n => [n, ...descendants(n)]);
const element = tag => { const n = new Node(1); n.tagName = tag.toUpperCase(); return n; };
const ids = Object.fromEntries(['feedback', 'fiveFeedback', 'v15PastAnswer', 'v14libraryContent', 'v13content', 'v17CaseDetail'].map(id => [id, element('div')]));
const root = ids.feedback;
root.textContent = '解説：民法３条・３条の２。';
const existingLink = element('a'); existingLink.href = 'https://example.com/source'; existingLink.textContent = '民法94条'; root.appendChild(existingLink);
const button = element('button'); button.textContent = '民法3条の問題へ'; let clicked = false; button.onclick = () => clicked = true; root.appendChild(button);
const code = element('pre'); code.textContent = '旧民法903条'; root.appendChild(code);
const before = root.textContent;
let observer;
class Observer {
  constructor(callback) { this.callback = callback; this.roots = []; observer = this; }
  observe(root) { this.roots.push(root); }
  disconnect() { this.roots = []; }
  flush(root) { this.callback([{target: root}]); }
}
const document = {
  getElementById: id => ids[id], createElement: element,
  createTextNode: text => new Node(3, text), createDocumentFragment: () => new Node(11),
  createTreeWalker(root) {
    const nodes = descendants(root).filter(n => n.nodeType === 3); let i = 0;
    return {currentNode: null, nextNode() { this.currentNode = nodes[i++]; return !!this.currentNode; }};
  }
};
vm.runInNewContext(fs.readFileSync(__dirname + '/article-links-v1.8.4.js', 'utf8'), {document, NodeFilter: {SHOW_TEXT: 4}, MutationObserver: Observer});
const links = () => root.querySelectorAll('.v184-law-link');
assert.equal(links().length, 2);
assert.equal(root.textContent.replace(root.querySelector('.v184-law-help').textContent, ''), before);
assert(root.childNodes.includes(existingLink)); assert.equal(existingLink.href, 'https://example.com/source');
button.onclick(); assert(clicked);
for (const a of links()) { assert.equal(a.target, '_blank'); assert.equal(a.rel, 'noopener noreferrer'); assert(a.title.includes('現行法')); assert.equal(new URL(a.href).hostname, 'laws.e-gov.go.jp'); }
observer.flush(root); assert.equal(links().length, 2); assert.equal(root.querySelectorAll('.v184-law-help').length, 1);
assert.equal(observer.roots.length, 6);
// Simulates answer restoration, previous/next and text rerenders, not new history.
for (const target of Object.values(ids)) {
  target.textContent = '民法886条1項。会社法309条2項。'; observer.flush(target);
  assert.equal(target.querySelectorAll('.v184-law-link').length, 2);
  target.textContent = '次の問題は未回答'; observer.flush(target);
  assert.equal(target.querySelectorAll('.v184-law-link').length, 0);
  assert.equal(target.querySelectorAll('.v184-law-help').length, 0);
}
let citationCount = 0;
const ledger = JSON.parse(fs.readFileSync(__dirname + '/past-exam-explanation-ledger.json', 'utf8'));
for (const q of ledger) {
  for (const text of Object.values(q.legal_explanation?.statements || {})) {
    let end = 0;
    for (const r of references(text)) { assert(r.start >= end); assert(r.end > r.start && r.end <= text.length); end = r.end; citationCount++; }
  }
}
assert(citationCount > 300);
const page = fs.readFileSync(__dirname + '/index.html', 'utf8');
assert(/v1\.(?:8\.4|9\.0)<\/title>/.test(page));
assert.equal((page.match(/src="article-links-v1.8.4.js"/g) || []).length, 1);
assert(page.includes('<meta name="google-adsense-account" content="ca-pub-8976067134459371">'));
assert(fs.readFileSync(__dirname + '/service-worker.js', 'utf8').includes("'./article-links-v1.8.4.js'"));
console.log(JSON.stringify({passed: true, runtime: 'Node VM with DOM adapter', pastExamCitationLinks: citationCount, checks: ['fullwidth and kanji numbers', 'branch articles', 'lists and paragraph numbers', 'law identity', 'historical and ambiguous citations excluded', 'text and event handlers preserved', 'idempotence', 'all six roots refresh and clear', 'AdSense and PWA assets retained'], limitation: 'Browser launch is blocked by the sandbox. Automatic text-fragment scrolling on e-Gov is not verified; full-law page and table of contents remain the fallback.'}, null, 2));
