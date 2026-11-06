'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const existing = JSON.parse(fs.readFileSync(__dirname + '/question-expansion-v1.6.json', 'utf8'));
const units = JSON.parse(fs.readFileSync(__dirname + '/study-content-v1.6.json', 'utf8'));
const added = JSON.parse(fs.readFileSync(__dirname + '/question-reinforcement-v1.9.1.json', 'utf8'));
const unitMap = new Map(units.map(unit => [unit.id, unit]));
const idSet = new Set(existing.map(question => question.id));

assert.equal(existing.filter(question => question.kind === 'past').length, 1695);
assert.equal(new Set(existing.filter(question => question.kind === 'past').map(question => question.origin)).size, 339);
assert.equal(added.length, 33);
assert.equal(new Set(added.map(question => question.id)).size, added.length);

for (const question of added) {
  assert(!idSet.has(question.id), `duplicate existing ID: ${question.id}`);
  assert(unitMap.has(question.t), `unknown topic: ${question.t}`);
  assert([0, 1].includes(question.a), `invalid answer: ${question.id}`);
  assert(question.why.length >= 28, `short explanation: ${question.id}`);
  assert(question.coverage.length >= 6, `missing coverage note: ${question.id}`);
}

const topicCounts = added.reduce((counts, question) => counts.set(question.t, (counts.get(question.t) || 0) + 1), new Map());
assert.equal(topicCounts.size, 11);
for (const count of topicCounts.values()) assert.equal(count, 3);

const audit = [...topicCounts].map(([topic, addedCount]) => {
  const unit = unitMap.get(topic);
  return { topic, title: unit.title, pastQuestions: unit.related_questions.length, added: addedCount };
}).sort((a, b) => b.pastQuestions - a.pastQuestions);

console.log(JSON.stringify({
  passed: true,
  existingPastStatements: 1695,
  existingPastOrigins: 339,
  reinforcementQuestions: added.length,
  targetTopics: audit,
  qualityChecks: ['unique IDs', 'valid answers', 'topic linkage', 'detailed explanations', 'coverage labels']
}, null, 2));
