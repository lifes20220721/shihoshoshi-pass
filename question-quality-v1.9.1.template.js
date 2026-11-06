'use strict';
/* Original reinforcement questions selected from the 2022–2026 coverage audit. */
const v191Questions = __V191_QUESTIONS__;
const v191Ids = new Set(v191Questions.map(question => question.id));
if (v191Ids.size !== v191Questions.length) throw new Error('Duplicate v1.9.1 question ID');
for (const question of v191Questions) {
  if (!v16UnitMap.has(question.t)) throw new Error(`Unknown v1.9.1 topic: ${question.t}`);
  if (question.a !== 0 && question.a !== 1) throw new Error(`Invalid v1.9.1 answer: ${question.id}`);
  if (!question.why || question.why.length < 28) throw new Error(`Short v1.9.1 explanation: ${question.id}`);
}

questions.push(...v191Questions);
if (questions.length !== 2033) throw new Error(`Question count mismatch after v1.9.1: ${questions.length}`);

const v191QuestionMap = new Map(v191Questions.map(question => [question.id, question]));
const v191PreviousAnswer = answer;
answer = function (choice) {
  const current = queue[pos];
  const wasAnswered = answered;
  v191PreviousAnswer(choice);
  if (wasAnswered || !answered || !current || !v191QuestionMap.has(current.id)) return;
  const unit = v16UnitMap.get(current.t);
  const related = unit?.related_questions || [];
  const years = [...new Set(related.map(id => id.slice(0, 4)))].sort();
  const box = document.createElement('div');
  box.className = 'v191-quality-note';
  const heading = document.createElement('strong');
  heading.textContent = '過去問照合による頻出補強';
  const detail = document.createElement('p');
  detail.textContent = `${current.coverage}。関連する過去問を${related.length}問（${years.join('・')}年度）確認した分野です。`;
  const examples = document.createElement('p');
  examples.className = 'muted';
  examples.textContent = related.length ? `関連原問例：${related.slice(0, 5).join('、')}` : '関連原問は科目別テキストから確認できます。';
  box.append(heading, detail, examples);
  document.getElementById('feedback').appendChild(box);
};

const allOption = document.querySelector('#v16OxSource option[value=""]');
const basicOption = document.querySelector('#v16OxSource option[value="basic"]');
if (allOption) allOption.textContent = '全問題（2,033問）';
if (basicOption) basicOption.textContent = '基本・頻出補強（338問）';
