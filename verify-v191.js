'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const page = fs.readFileSync(__dirname + '/index.html', 'utf8');
const worker = fs.readFileSync(__dirname + '/service-worker.js', 'utf8');
const runtime = fs.readFileSync(__dirname + '/question-quality-v1.9.1.js', 'utf8');
const data = JSON.parse(fs.readFileSync(__dirname + '/question-reinforcement-v1.9.1.json', 'utf8'));

assert(page.includes('v1.9.1</title>'));
assert(page.includes('司法書士PASS Ver.1.9.1'));
assert(page.includes('○×2,033問（基本・頻出補強338問・過去問肢別1,695問）'));
assert(page.includes('全問題（2,033問）'));
assert(page.includes('基本・頻出補強（338問）'));
assert.equal((page.match(/question-quality-v1\.9\.1\.js/g) || []).length, 1);
assert.equal(data.length, 33);
assert(runtime.includes('questions.length !== 2033'));
assert(runtime.includes('過去問照合による頻出補強'));
assert(worker.includes("v191-core-1"));
assert(worker.includes("'./question-quality-v1.9.1.js'"));

const ids = new Set(data.map(question => question.id));
assert.equal(ids.size, 33);
const topics = new Map();
for (const question of data) {
  assert([0, 1].includes(question.a));
  assert(question.why.length >= 28);
  topics.set(question.t, (topics.get(question.t) || 0) + 1);
}
assert.equal(topics.size, 11);
for (const count of topics.values()) assert.equal(count, 3);

const minimal = {
  v16UnitMap: new Map([...topics.keys()].map(topic => [topic, { related_questions: ['2022-午前-01'] }])),
  questions: Array.from({ length: 2000 }, (_, i) => ({ id: `existing-${i}` })),
  queue: [], pos: 0, answered: false,
  answer() {},
  document: { querySelector: () => null }
};
vm.runInNewContext(runtime, minimal);
assert.equal(minimal.questions.length, 2033);

console.log(JSON.stringify({
  passed: true,
  version: '1.9.1',
  counts: { totalOx: 2033, basicAndReinforcement: 338, pastStatements: 1695, added: 33 },
  coverage: { topics: topics.size, each: 3 },
  checks: ['runtime injection', 'unique IDs', 'answer values', 'detailed explanations', 'past-exam linkage', 'PWA cache']
}, null, 2));
