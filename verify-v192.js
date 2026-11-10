'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {boot} = require('./test-support-v192');
const PROGRESS = 'shihoshoshi-pass-progress-v1';
const SCOPED = 'shihoshoshi-pass-scoped-progress-v1';
const HISTORY = 'shihoshoshi-pass-v03';
let app = boot(__dirname + '/index.html');
const run = code => vm.runInContext(code, app.ctx);
const value = code => JSON.parse(run('JSON.stringify(' + code + ')'));
const progress = () => JSON.parse(app.storage.get(PROGRESS) || 'null');
const bank = () => JSON.parse(app.storage.get(SCOPED) || '{"slots":{}}').slots;
const history = () => app.storage.get(HISTORY);
const walk = el => [el, ...el.children.flatMap(walk)];
function choose(subject, topic = '') {
  run(`v11PickSubject(${JSON.stringify(subject)})`);
  if (topic) run(`v11PickTopic(${JSON.stringify(topic)})`);
}
function press(mode, restart = false) {
  const card = app.ids.v11content.children.find(el => el.className.includes('v192-scoped-resume'));
  assert(card, 'resume card exists at subject/topic level');
  const row = card.children[mode === 'ox' ? 2 : 3];
  const buttons = walk(row).filter(el => el.tagName === 'BUTTON');
  assert(buttons[restart ? 1 : 0], 'requested resume/restart button exists');
  buttons[restart ? 1 : 0].onclick();
}
function answerOx(n) {
  for (let i = 0; i < n; i++) run('answer(queue[pos].a);nextQuestion()');
}
function answerFive(n) {
  for (let i = 0; i < n; i++) run('v11AnswerFive(fiveQuestions[v11FiveQueue[v11FiveIndex]].a,v11FiveQueue[v11FiveIndex]);nextFive()');
}
const originalHistory = history();
choose('civil'); assert.equal(history(), originalHistory);
press('ox'); assert.equal(value('queue.length'), 667); answerOx(3);
const civilId = value('queue[pos].id');
assert.equal(progress().position, 3);
choose('realestate'); press('ox'); answerOx(2);
const realestateId = value('queue[pos].id');
assert.equal(bank()['ox:civil:all:all'].position, 3);
assert.equal(bank()['ox:realestate:all:all'].position, 2);
const beforeResume = history();
choose('civil'); press('ox'); assert.equal(value('queue[pos].id'), civilId); assert.equal(history(), beforeResume);
run('window.v182PreviousOx()'); assert.equal(value('answered'), true);
const beforeRepeat = history(); run('answer(1)'); assert.equal(history(), beforeRepeat, 'restored answer cannot be counted twice');
run('nextQuestion()');
choose('civil'); press('five'); answerFive(2);
const civilFive = value('v11FiveQueue[v11FiveIndex]');
assert.equal(bank()['ox:civil:all:all'].position, 3);
assert.equal(bank()['five:civil:all:all'].position, 2);
choose('realestate'); press('ox'); assert.equal(value('queue[pos].id'), realestateId);
// Independent positions survive reloading with a different subject active.
const stored = Object.fromEntries(app.storage);
app = boot(__dirname + '/index.html', stored);
choose('civil'); press('five'); assert.equal(value('v11FiveQueue[v11FiveIndex]'), civilFive);
assert.equal(history(), stored[HISTORY]);
choose('civil', 'capacity'); run('v11StartTopicQuiz()'); answerOx(2);
const capacityId = value('queue[pos].id');
choose('civil', 'minor'); run('v11StartTopicQuiz()'); answerOx(1);
choose('civil', 'capacity'); run('v11StartTopicQuiz()'); assert.equal(value('queue[pos].id'), capacityId);
assert.equal(bank()['ox:civil:minor:all'].position, 1);
assert.equal(bank()['ox:civil:all:all'].position, 3);
run('window.v183BackToText()'); assert.equal(value('v11Topic.id'), 'capacity');
assert(!app.ids.dashboard.classList.contains('hidden'));
// Separate filters and the library entry route preserve each other.
run("v16StartUnit('capacity','basic')"); answerOx(1);
const basicId = value('queue[pos].id');
run("v16StartUnit('capacity','past')"); answerOx(1);
run("v16StartUnit('capacity','basic')"); assert.equal(value('queue[pos].id'), basicId);
run('window.v183BackToText()'); assert(!app.ids.v14library.classList.contains('hidden'));
// Topic five-choice sessions remain isolated from subject-wide sessions.
choose('civil', 'capacity'); run("document.getElementById('v16FiveSource').value='';v11StartTopicFive()"); answerFive(1);
const topicFive = value('v11FiveQueue[v11FiveIndex]');
choose('civil', 'minor'); run('v11StartTopicFive()'); answerFive(1);
choose('civil', 'capacity'); run('v11StartTopicFive()'); assert.equal(value('v11FiveQueue[v11FiveIndex]'), topicFive);
assert.equal(bank()['five:civil:all:all'].position, 2);
// Mixed-subject practice and review queues do not overwrite saved scopes.
const scopesBefore = JSON.stringify(bank());
run("document.getElementById('topic').value='all';document.getElementById('v16OxSource').value='';startQuiz(false)"); answerOx(1);
run("data.wrong=[questions.find(q=>q.t==='capacity').id];v13ReviewOx()");
run('answer(queue[pos].a);nextQuestion()');
run("data.fiveWrong=['f5-0'];v13ReviewFive()"); run('v11AnswerFive(fiveQuestions[v11FiveQueue[0]].a,v11FiveQueue[0]);nextFive()');
assert.equal(JSON.stringify(bank()), scopesBefore);
// Completion removes only the completed position, not other subjects/formats.
choose('civil', 'capacity'); press('ox');
const completedKey = Object.keys(bank()).find(key => key === 'ox:civil:capacity:basic');
assert(completedKey);
run('pos=queue.length-1;renderQuestion();answer(queue[pos].a)');
assert(!bank()[completedKey]); assert(bank()['ox:realestate:all:all']); assert(bank()['five:civil:all:all']);
// Cancelled restart preserves everything; confirmed restart preserves history.
choose('realestate');
const restartBank = JSON.stringify(bank()), restartHistory = history();
app.ctx.window.confirm = () => false; press('ox', true); assert.equal(JSON.stringify(bank()), restartBank);
app.ctx.window.confirm = () => true; press('ox', true); assert.equal(value('pos'), 0); assert.equal(history(), restartHistory);
assert.equal(bank()['five:civil:all:all'].position, 2);
// Existing global resume and past-exam resume continue working.
run('v15OpenPastExam();v15RevealPast()');
const pastState = progress(); assert.equal(pastState.mode, 'past');
const pastHistory = history(); run('window.v181ResumeProgress()'); assert.equal(progress().questionId, pastState.questionId); assert.equal(progress().revealed, true); assert.equal(history(), pastHistory);
// Migrate the legacy single position once; tolerate a removed question before it.
const legacy = {version:1,mode:'ox',queue:['removed-question','m01','m02','m03'],position:2,choices:{m01:0},topic:'capacity',source:'',returnText:{view:'dashboard',subject:'civil',topic:'capacity'}};
app = boot(__dirname + '/index.html', {[PROGRESS]:JSON.stringify(legacy)});
const migratedHistory = history(); choose('civil'); press('ox'); assert.equal(value('queue[pos].id'), 'm02'); assert.equal(history(), migratedHistory);
run('window.v182PreviousOx()'); assert.equal(value('answered'), true);
// Invalid storage never crashes the dashboard or destroys answer history.
app = boot(__dirname + '/index.html', {[SCOPED]:'{broken', [PROGRESS]:'null'});
choose('criminal'); press('ox'); assert(value('queue.length') > 0);
app = boot(__dirname + '/index.html', {[SCOPED]:JSON.stringify({version:1,slots:{bad:{version:1,mode:'ox',position:-1,queue:['m01']}}})});
choose('civil'); press('ox'); assert.equal(value('pos'), 0);
console.log(JSON.stringify({passed:true,runtime:'Node VM with DOM adapter',checks:['all-subject entry creates subject queue','independent subject OX positions','independent OX/five positions','reload persistence','independent topics and source filters','existing problem buttons resume','return to source text','previous answer restoration without duplicate history','review and mixed queues isolated','completion clears only its scope','restart cancellation and history preservation','legacy migration and removed-ID position mapping','past-exam resume regression','invalid storage tolerance']},null,2));
