(function () {
  'use strict';

  const PROGRESS_KEY = 'shihoshoshi-pass-progress-v1';
  const SCOPED_KEY = 'shihoshoshi-pass-scoped-progress-v1';
  let activeScope = null;
  let forceFresh = false;
  let suppressSave = 0;
  let fiveReview = false;
  let restoringPast = false;
  let oxChoices = {};
  let fiveChoices = {};
  let returnText = null;

  function readScoped() {
    try {
      const bank = JSON.parse(localStorage.getItem(SCOPED_KEY));
      if (bank?.version === 1 && bank.slots && typeof bank.slots === 'object' && !Array.isArray(bank.slots)) return bank;
    } catch (error) { /* A damaged optional position must not affect answer history. */ }
    return {version: 1, slots: {}};
  }

  function scopeOf(state) {
    if (!state || !['ox', 'five'].includes(state.mode) || state.review || !Array.isArray(state.queue) || !state.queue.length) return null;
    const byId = new Map(questions.map(question => [question.id, question]));
    const topics = state.queue.map(id => state.mode === 'ox' ? byId.get(id)?.t : v11FiveTopic[id]);
    if (topics.some(topic => !topic)) return null;
    const subject = v11Subjects.find(item => topics.every(topic => item.topics.includes(topic)));
    if (!subject) return null;
    const explicit = state.scope;
    const topic = explicit?.subject === subject.id && explicit.topic === ''
      ? '' : topics.every(item => item === topics[0]) ? topics[0] : '';
    const source = ['', 'basic', 'past'].includes(state.source) ? state.source : '';
    return {subject: subject.id, topic, source};
  }

  function scopeKey(mode, scope) {
    return [mode, scope.subject, scope.topic || 'all', scope.source || 'all'].join(':');
  }

  function rememberScoped(state) {
    const scope = scopeOf(state);
    if (!scope) return;
    const bank = readScoped();
    const key = scopeKey(state.mode, scope);
    delete bank.slots[key];
    bank.slots[key] = {...state, scope};
    try { localStorage.setItem(SCOPED_KEY, JSON.stringify(bank)); } catch (error) { /* Preserve all other storage. */ }
  }

  function completeScoped(mode, ids) {
    const source = document.getElementById(mode === 'ox' ? 'v16OxSource' : 'v16FiveSource')?.value || '';
    const scope = scopeOf({mode, queue: ids, source, scope: activeScope, review: mode === 'ox' ? review : fiveReview});
    if (!scope) return;
    const bank = readScoped();
    delete bank.slots[scopeKey(mode, scope)];
    try { localStorage.setItem(SCOPED_KEY, JSON.stringify(bank)); } catch (error) { /* Optional position only. */ }
  }

  function savedFor(subject, topic, mode, source) {
    return Object.values(readScoped().slots).reverse().map(state => {
      if (!state || state.version !== 1 || !Number.isInteger(state.position) || state.position < 0 || !Array.isArray(state.queue)) return null;
      const valid = mode === 'ox' ? validOxState(state) : validFiveState(state);
      if (!valid) return null;
      const scope = scopeOf(valid.state);
      return scope && scope.subject === subject && (topic == null || scope.topic === topic) &&
        (source == null || scope.source === source) ? {...valid.state, scope} : null;
    }).filter(Boolean).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0] || null;
  }

  function resumeTopic(mode, topic) {
    if (forceFresh) return false;
    const subject = v11Subjects.find(item => item.topics.includes(topic));
    const source = document.getElementById(mode === 'ox' ? 'v16OxSource' : 'v16FiveSource')?.value || '';
    const state = subject && savedFor(subject.id, topic, mode, source);
    if (!state) return false;
    restoreProgress(state);
    return true;
  }

  function readProgress() {
    try {
      const state = JSON.parse(localStorage.getItem(PROGRESS_KEY));
      if (!state || state.version !== 1 || !['ox', 'five', 'past'].includes(state.mode)) return null;
      if (!Number.isInteger(state.position) || state.position < 0 || !Array.isArray(state.queue)) return null;
      return state;
    } catch (error) {
      return null;
    }
  }

  function writeProgress(state) {
    const snapshot = {...state, scope: scopeOf({...state, scope: activeScope}), version: 1, updatedAt: new Date().toISOString()};
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(snapshot));
    } catch (error) {
      // Learning history remains usable even if this optional position cannot be stored.
    }
    rememberScoped(snapshot);
    updateResumeCard();
  }

  function clearProgress() {
    try {
      localStorage.removeItem(PROGRESS_KEY);
    } catch (error) {
      // Nothing else should be cleared when storage is unavailable.
    }
    updateResumeCard();
  }

  function validOxState(state) {
    if (!state || state.mode !== 'ox' || !Array.isArray(state.queue) || !Number.isInteger(state.position) || state.position < 0) return null;
    const byId = new Map(questions.map(question => [question.id, question]));
    const restored = state.queue.map(id => byId.get(id)).filter(Boolean);
    const position = state.queue.slice(0, state.position).filter(id => byId.has(id)).length;
    if (!restored.length || position >= restored.length || state.position >= state.queue.length) return null;
    return {state: {...state, queue: restored.map(question => question.id), position}, restored};
  }

  function validFiveState(state) {
    if (!state || state.mode !== 'five' || !Array.isArray(state.queue) || !Number.isInteger(state.position) || state.position < 0) return null;
    const restored = state.queue.filter(index => Number.isInteger(index) && index >= 0 && index < fiveQuestions.length);
    const position = state.queue.slice(0, state.position).filter(index => Number.isInteger(index) && index >= 0 && index < fiveQuestions.length).length;
    if (!restored.length || position >= restored.length || state.position >= state.queue.length) return null;
    return {state: {...state, queue: restored, position}, restored};
  }

  function validPastState(state) {
    if (!state || state.mode !== 'past') return null;
    const byId = new Map(v15PastQuestions.map(question => [question.id, question]));
    const restored = state.queue.map(id => byId.get(id)).filter(Boolean);
    const selected = byId.get(state.questionId) || restored[state.position];
    if (!restored.length || !selected) return null;
    return {state, restored, selected};
  }

  function sanitizeOxChoices(raw, restored) {
    const allowed = new Set(restored.map(question => question.id));
    const clean = {};
    if (!raw || typeof raw !== 'object') return clean;
    Object.entries(raw).forEach(([id, choice]) => {
      if (allowed.has(id) && (choice === 0 || choice === 1)) clean[id] = choice;
    });
    return clean;
  }

  function sanitizeFiveChoices(raw, restored) {
    const allowed = new Set(restored.map(String));
    const clean = {};
    if (!raw || typeof raw !== 'object') return clean;
    Object.entries(raw).forEach(([index, choice]) => {
      if (allowed.has(index) && Number.isInteger(choice) && choice >= -1 && choice <= 4) clean[index] = choice;
    });
    return clean;
  }

  function validReturnText(raw) {
    if (!raw || !['library', 'dashboard'].includes(raw.view)) return null;
    const unit = v16UnitMap.get(raw.topic);
    const subject = v11Subjects.find(item => item.id === raw.subject);
    if (!unit || !subject || unit.subject !== subject.id) return null;
    return {view: raw.view, subject: subject.id, topic: unit.id};
  }

  function addLegacyOxChoices(clean, restored, position) {
    const latest = new Map();
    (data.answers || []).forEach(item => latest.set(item.id, item));
    restored.slice(0, position).forEach(question => {
      if (Object.prototype.hasOwnProperty.call(clean, question.id)) return;
      const record = latest.get(question.id);
      if (record) clean[question.id] = record.correct ? question.a : 1 - question.a;
    });
    return clean;
  }

  function addLegacyFiveChoices(clean, restored, position) {
    const latest = new Map();
    (data.fiveAnswers || []).forEach(item => latest.set(item.id, item));
    restored.slice(0, position).forEach(questionIndex => {
      if (Object.prototype.hasOwnProperty.call(clean, questionIndex)) return;
      const record = latest.get('f5-' + questionIndex);
      if (record) clean[questionIndex] = record.correct ? fiveQuestions[questionIndex].a : -1;
    });
    return clean;
  }

  function progressDescription(state) {
    if (state.mode === 'ox') {
      const title = state.title || (state.review ? '間違い復習' : '○×問題');
      return `${title}：${state.position + 1} / ${state.queue.length}問から`;
    }
    if (state.mode === 'past') {
      const item = validPastState(state)?.selected;
      return item ? `過去問：${item.year}年度 ${item.part} 第${item.number}問から` : '過去問の続き';
    }
    return `5肢択一：${state.position + 1} / ${state.queue.length}問から`;
  }

  function updateResumeCard() {
    const root = document.getElementById('v181Resume');
    const text = document.getElementById('v181ResumeText');
    if (!root || !text) return;
    const state = readProgress();
    const valid = state && (validOxState(state) || validFiveState(state) || validPastState(state));
    root.classList.toggle('hidden', !valid);
    text.textContent = valid ? progressDescription(valid.state) : '';
    if (state && !valid) clearProgress();
  }

  function saveOxProgress(position) {
    if (suppressSave) return;
    const ids = queue.map(question => question && question.id).filter(Boolean);
    if (!ids.length || position >= ids.length) {
      completeScoped('ox', ids);
      clearProgress();
      return;
    }
    writeProgress({
      mode: 'ox',
      queue: ids,
      position,
      choices: oxChoices,
      returnText,
      review: Boolean(review),
      title: document.getElementById('quizTitle')?.textContent || '',
      topic: document.getElementById('topic')?.value || 'all',
      source: document.getElementById('v16OxSource')?.value || ''
    });
  }

  function saveFiveProgress(position) {
    if (suppressSave) return;
    const indices = v11FiveQueue.filter(index => Number.isInteger(index));
    if (!indices.length || position >= indices.length) {
      completeScoped('five', indices);
      clearProgress();
      return;
    }
    const topic = v11Topic?.id && indices.every(index => v11FiveTopic[index] === v11Topic.id) ? v11Topic.id : '';
    writeProgress({
      mode: 'five',
      review: fiveReview,
      queue: indices,
      position,
      choices: fiveChoices,
      returnText,
      topic,
      subject: topic ? v11Subject?.id || '' : '',
      source: document.getElementById('v16FiveSource')?.value || ''
    });
  }

  function savePastProgress(revealed) {
    if (restoringPast) return;
    const select = document.getElementById('v15QuestionSelect');
    const position = Number(select?.value);
    const question = v15PastList[position];
    if (!question || !v15PastList.length) {
      clearProgress();
      return;
    }
    const answer = document.getElementById('v15PastAnswer');
    writeProgress({
      mode: 'past',
      queue: v15PastList.map(item => item.id),
      position,
      questionId: question.id,
      year: document.getElementById('v15Year')?.value || String(question.year),
      kind: document.getElementById('v15Kind')?.value || '',
      part: document.getElementById('v15Part')?.value || '',
      subject: document.getElementById('v15Subject')?.value || '',
      revealed: revealed === true || Boolean(answer?.children.length)
    });
  }

  function updateOxBackButton() {
    const button = document.getElementById('v182OxBack');
    if (button) button.disabled = pos <= 0 || !queue[pos];
  }

  function updateFiveBackButton() {
    const button = document.getElementById('v182FiveBack');
    if (button) button.disabled = v11FiveIndex <= 0 || v11FiveQueue[v11FiveIndex] === undefined;
  }

  function updatePastButtons() {
    const select = document.getElementById('v15QuestionSelect');
    const previous = document.getElementById('v182PastBack');
    const next = document.getElementById('v182PastNext');
    const hasQuestion = Boolean(select?.options.length);
    if (previous) previous.disabled = !hasQuestion || select.selectedIndex <= 0;
    if (next) next.disabled = !hasQuestion || select.selectedIndex >= select.options.length - 1;
  }

  function updateReturnTextButtons() {
    const available = Boolean(validReturnText(returnText));
    const oxButton = document.getElementById('v183TextBack');
    const fiveButton = document.getElementById('v183FiveTextBack');
    if (oxButton) oxButton.classList.toggle('hidden', !available);
    if (fiveButton) fiveButton.classList.toggle('hidden', !available);
  }

  function addOxResources(box, question) {
    if (typeof v16AnswerAppend === 'function') v16AnswerAppend('feedback', question.t, question.origin);
    if (typeof v17AddLinks === 'function') {
      const cases = question.origin ? v17MatchesOrigin(question.origin) : v17Cases.filter(item => item.topics.includes(question.t));
      v17AddLinks(box, cases);
    }
  }

  function addFiveResources(box, questionIndex) {
    const origin = v16FiveMeta.get(questionIndex);
    if (typeof v16AnswerAppend === 'function') v16AnswerAppend('fiveFeedback', v11FiveTopic[questionIndex], origin);
    if (typeof v17AddLinks === 'function') {
      const cases = origin ? v17MatchesOrigin(origin) : v17Cases.filter(item => item.topics.includes(v11FiveTopic[questionIndex]));
      v17AddLinks(box, cases);
    }
  }

  function restoreOxAnswer() {
    const question = queue[pos];
    if (!question || !Object.prototype.hasOwnProperty.call(oxChoices, question.id)) return;
    const choice = oxChoices[question.id];
    const correct = choice === question.a;
    answered = true;
    Array.from(document.getElementById('options').children).forEach((button, index) => {
      button.disabled = true;
      if (index === question.a) button.classList.add('correct');
      else if (index === choice) button.classList.add('wrong');
    });
    const feedback = document.getElementById('feedback');
    feedback.textContent = (correct ? '正解！ ' : '不正解。 ') + question.why;
    addOxResources(feedback, question);
    const next = document.getElementById('next');
    next.textContent = pos === queue.length - 1 ? '終了する' : '次の問題 →';
    next.classList.remove('hidden');
  }

  function restoreFiveAnswer() {
    const questionIndex = v11FiveQueue[v11FiveIndex];
    const question = fiveQuestions[questionIndex];
    if (!question || !Object.prototype.hasOwnProperty.call(fiveChoices, questionIndex)) return;
    const choice = fiveChoices[questionIndex];
    const correct = choice === question.a;
    fiveAnswered = true;
    Array.from(document.getElementById('fiveOptions').children).forEach((button, index) => {
      button.disabled = true;
      if (index === question.a) button.classList.add('correct');
      else if (index === choice) button.classList.add('wrong');
    });
    const feedback = document.getElementById('fiveFeedback');
    feedback.textContent = (correct ? '正解！ ' : '不正解。 ') + question.why;
    addFiveResources(feedback, questionIndex);
    const next = document.getElementById('fiveNext');
    next.textContent = v11FiveIndex === v11FiveQueue.length - 1 ? '終了する' : '次の問題 →';
    next.classList.remove('hidden');
  }

  const originalStartQuiz = startQuiz;
  startQuiz = function (onlyWrong) {
    const topic = document.getElementById('topic')?.value;
    if (!onlyWrong && resumeTopic('ox', topic)) return;
    activeScope = null;
    oxChoices = {};
    returnText = null;
    suppressSave += 1;
    try { originalStartQuiz(onlyWrong); } finally { suppressSave -= 1; }
    updateReturnTextButtons();
    saveOxProgress(pos);
  };

  const originalRenderQuestion = renderQuestion;
  renderQuestion = function () {
    originalRenderQuestion();
    restoreOxAnswer();
    updateOxBackButton();
    updateReturnTextButtons();
    if (queue[pos]) saveOxProgress(pos);
  };

  const originalStartUnit = v16StartUnit;
  v16StartUnit = function (topic, kind = 'all') {
    originalStartUnit(topic, kind);
    const unit = v16UnitMap.get(topic);
    returnText = unit ? {view: 'library', subject: unit.subject, topic: unit.id} : null;
    updateReturnTextButtons();
    saveOxProgress(pos);
  };

  const originalStartTopicQuiz = v11StartTopicQuiz;
  v11StartTopicQuiz = function () {
    if (v11Topic && resumeTopic('ox', v11Topic.id)) return;
    const source = v11Subject && v11Topic
      ? {view: 'dashboard', subject: v11Subject.id, topic: v11Topic.id}
      : null;
    originalStartTopicQuiz();
    returnText = validReturnText(source);
    updateReturnTextButtons();
    saveOxProgress(pos);
  };

  const originalAnswer = answer;
  answer = function (choice) {
    const wasAnswered = answered;
    const question = queue[pos];
    originalAnswer(choice);
    if (!wasAnswered && answered && question) {
      oxChoices[question.id] = choice;
      saveOxProgress(pos + 1);
    }
  };

  const originalNextQuestion = nextQuestion;
  nextQuestion = function () {
    originalNextQuestion();
    if (pos >= queue.length) clearProgress();
    else saveOxProgress(pos);
  };

  const originalStartFive = startFive;
  startFive = function () {
    activeScope = null;
    fiveReview = false;
    fiveChoices = {};
    returnText = null;
    suppressSave += 1;
    try { originalStartFive(); } finally { suppressSave -= 1; }
    updateReturnTextButtons();
    saveFiveProgress(v11FiveIndex);
  };

  const originalStartTopicFive = v11StartTopicFive;
  v11StartTopicFive = function () {
    if (v11Topic && resumeTopic('five', v11Topic.id)) return;
    activeScope = null;
    fiveReview = false;
    const source = v11Subject && v11Topic
      ? {view: 'dashboard', subject: v11Subject.id, topic: v11Topic.id}
      : null;
    fiveChoices = {};
    suppressSave += 1;
    try { originalStartTopicFive(); } finally { suppressSave -= 1; }
    returnText = validReturnText(source);
    updateReturnTextButtons();
    saveFiveProgress(v11FiveIndex);
  };

  const originalRenderFive = v11RenderFive;
  v11RenderFive = function () {
    originalRenderFive();
    restoreFiveAnswer();
    updateFiveBackButton();
    updateReturnTextButtons();
    if (v11FiveQueue[v11FiveIndex] !== undefined) saveFiveProgress(v11FiveIndex);
  };

  const originalAnswerFive = v11AnswerFive;
  v11AnswerFive = function (choice, questionIndex) {
    const wasAnswered = fiveAnswered;
    originalAnswerFive(choice, questionIndex);
    if (!wasAnswered && fiveAnswered) {
      fiveChoices[questionIndex] = choice;
      saveFiveProgress(v11FiveIndex + 1);
    }
  };

  const originalNextFive = nextFive;
  nextFive = function () {
    originalNextFive();
    if (v11FiveIndex >= v11FiveQueue.length) clearProgress();
    else saveFiveProgress(v11FiveIndex);
  };

  const originalOpenPastExam = v15OpenPastExam;
  v15OpenPastExam = function () {
    activeScope = null;
    originalOpenPastExam();
    updatePastButtons();
    savePastProgress(false);
  };

  const originalPastFilter = v15PastFilter;
  v15PastFilter = function () {
    originalPastFilter();
    updatePastButtons();
    savePastProgress(false);
  };

  const originalPastRender = v15PastRender;
  v15PastRender = function () {
    originalPastRender();
    updatePastButtons();
    savePastProgress(false);
  };

  const originalRevealPast = v15RevealPast;
  v15RevealPast = function () {
    originalRevealPast();
    savePastProgress(true);
  };

  const originalNextPast = v15NextPast;
  v15NextPast = function () {
    originalNextPast();
    updatePastButtons();
    savePastProgress(false);
  };

  window.v182PreviousOx = function () {
    if (pos <= 0) return;
    pos -= 1;
    renderQuestion();
  };

  window.v182PreviousFive = function () {
    if (v11FiveIndex <= 0) return;
    v11FiveIndex -= 1;
    v11RenderFive();
  };

  window.v182PreviousPast = function () {
    const select = document.getElementById('v15QuestionSelect');
    if (!select || select.selectedIndex <= 0) return;
    select.selectedIndex -= 1;
    v15PastRender();
  };

  window.v183BackToText = function () {
    const target = validReturnText(returnText);
    if (!target) {
      updateReturnTextButtons();
      return;
    }
    if (target.view === 'dashboard') {
      v11Subject = v11Subjects.find(item => item.id === target.subject) || null;
      v11Topic = chapters.find(item => item.id === target.topic) || null;
      v11Render();
      return;
    }
    show('v14library');
    v14Topic(target.subject, target.topic);
  };

  function restoreProgress(state) {
    const ox = validOxState(state);
    if (ox) {
      state = ox.state;
      activeScope = scopeOf(state);
      queue = ox.restored;
      pos = state.position;
      review = Boolean(state.review);
      oxChoices = addLegacyOxChoices(sanitizeOxChoices(state.choices, ox.restored), ox.restored, state.position);
      returnText = validReturnText(state.returnText);
      v11Subject = activeScope ? v11Subjects.find(item => item.id === activeScope.subject) : null;
      v11Topic = activeScope?.topic ? chapters.find(item => item.id === activeScope.topic) : null;
      const topic = document.getElementById('topic');
      const source = document.getElementById('v16OxSource');
      if (topic && [...topic.options].some(option => option.value === state.topic)) topic.value = state.topic;
      if (source) source.value = state.source || '';
      show('quiz');
      document.getElementById('quizTitle').textContent = state.title || (review ? '間違い復習' : '科目別・確認問題');
      renderQuestion();
      return;
    }

    const five = validFiveState(state);
    if (five) {
      state = five.state;
      activeScope = scopeOf(state);
      fiveReview = Boolean(state.review);
      v11FiveQueue = five.restored;
      v11FiveIndex = state.position;
      fiveChoices = addLegacyFiveChoices(sanitizeFiveChoices(state.choices, five.restored), five.restored, state.position);
      returnText = validReturnText(state.returnText);
      v11Subject = activeScope ? v11Subjects.find(item => item.id === activeScope.subject) || null : null;
      v11Topic = activeScope?.topic ? chapters.find(item => item.id === activeScope.topic) || null : null;
      const source = document.getElementById('v16FiveSource');
      if (source) source.value = state.source || '';
      v11RenderFive();
      return;
    }

    const past = validPastState(state);
    if (past) {
      restoringPast = true;
      try {
        v15OpenPastExam();
        document.getElementById('v15Year').value = state.year || String(past.selected.year);
        document.getElementById('v15Kind').value = state.kind || '';
        document.getElementById('v15Part').value = state.part || '';
        document.getElementById('v15Subject').value = state.subject || '';
        v15PastFilter();
        const index = v15PastList.findIndex(item => item.id === past.selected.id);
        const select = document.getElementById('v15QuestionSelect');
        if (index >= 0) select.value = String(index);
        v15PastRender();
        if (state.revealed) v15RevealPast();
      } finally {
        restoringPast = false;
      }
      updatePastButtons();
      savePastProgress(Boolean(state.revealed));
      return;
    }

    clearProgress();
    window.alert('再開できる途中位置がありません。');
  }

  window.v181ResumeProgress = function () { restoreProgress(readProgress()); };

  window.v181DiscardProgress = function () {
    if (window.confirm('ホームの「前回の続き」を消しますか？ 科目・分野ごとの途中位置と解答履歴は残ります。')) clearProgress();
  };

  function startScope(subjectId, topicId, mode, restart) {
    const subject = v11Subjects.find(item => item.id === subjectId);
    if (!subject || !['ox', 'five'].includes(mode) || (topicId && !subject.topics.includes(topicId))) return;
    const saved = savedFor(subjectId, topicId || null, mode);
    if (!restart && saved) { restoreProgress(saved); return; }
    if (restart && saved && !window.confirm('この範囲の問題を最初から始めますか？ 解答履歴と、他の科目・分野の途中位置は残ります。')) return;
    v11Subject = subject;
    v11Topic = topicId ? chapters.find(item => item.id === topicId) : null;
    const source = document.getElementById(mode === 'ox' ? 'v16OxSource' : 'v16FiveSource');
    if (source) source.value = '';
    if (topicId) {
      forceFresh = true;
      try { if (mode === 'ox') v11StartTopicQuiz(); else v11StartTopicFive(); }
      finally { forceFresh = false; }
      return;
    }
    activeScope = {subject: subjectId, topic: '', source: ''};
    returnText = null;
    if (mode === 'ox') {
      review = false;
      oxChoices = {};
      queue = questions.filter(question => subject.topics.includes(question.t));
      pos = 0;
      document.getElementById('topic').value = 'all';
      document.getElementById('quizTitle').textContent = subject.name + '｜科目全体の○×問題';
      show('quiz');
      renderQuestion();
    } else {
      fiveReview = false;
      fiveChoices = {};
      v11FiveQueue = fiveQuestions.map((question, index) => index).filter(index => subject.topics.includes(v11FiveTopic[index]));
      v11FiveIndex = 0;
      v11RenderFive();
    }
  }

  function scopedCard(subject, topic) {
    const card = document.createElement('section');
    card.className = 'v181-resume v192-scoped-resume';
    const heading = document.createElement('h3');
    heading.textContent = topic ? 'この分野の問題を続きから' : subject.name + 'の問題を続きから';
    card.appendChild(heading);
    const help = document.createElement('p');
    help.className = 'muted';
    help.textContent = '途中位置は科目・分野・問題形式ごとに、このブラウザに自動保存されます。解答後は次の問題から再開します。';
    card.appendChild(help);
    for (const mode of ['ox', 'five']) {
      const saved = savedFor(subject.id, topic?.id || null, mode);
      const title = mode === 'ox' ? '○×問題' : '５肢択一';
      const count = mode === 'ox'
        ? questions.filter(q => topic ? q.t === topic.id : subject.topics.includes(q.t)).length
        : v11FiveTopic.filter(t => topic ? t === topic.id : subject.topics.includes(t)).length;
      const row = document.createElement('div');
      row.className = 'v192-resume-row';
      const description = document.createElement('p');
      const field = saved?.scope.topic ? v16UnitMap.get(saved.scope.topic)?.title || '' : '科目全体';
      const source = saved?.source === 'past' ? '過去問' : saved?.source === 'basic' ? '基本問題' : '全問題';
      description.textContent = saved ? `${title}｜${field}・${source}：${saved.position + 1} / ${saved.queue.length}問目から` : `${title}｜${count}問・保存された途中位置はありません`;
      row.appendChild(description);
      const actions = document.createElement('div');
      actions.className = 'actions';
      const resume = document.createElement('button');
      resume.className = 'primary';
      resume.textContent = saved ? `${title}を続きから` : `${title}を始める`;
      resume.disabled = !saved && count === 0;
      resume.onclick = () => startScope(subject.id, topic?.id || '', mode, false);
      actions.appendChild(resume);
      if (saved) {
        const restart = document.createElement('button');
        restart.textContent = topic ? 'この分野を最初から' : '科目全体を最初から';
        restart.onclick = () => startScope(subject.id, topic?.id || '', mode, true);
        actions.appendChild(restart);
      }
      row.appendChild(actions);
      card.appendChild(row);
    }
    return card;
  }

  const originalDashboard = v11Render;
  v11Render = function () {
    originalDashboard();
    if (!v11Subject) return;
    const root = document.getElementById('v11content');
    root.insertBefore(scopedCard(v11Subject, v11Topic), root.firstChild);
  };

  // Review queues must never replace a subject's regular-practice position.
  const originalReviewOx = v13ReviewOx;
  v13ReviewOx = function () {
    activeScope = null;
    returnText = null;
    oxChoices = {};
    originalReviewOx();
  };
  const originalReviewFive = v13ReviewFive;
  v13ReviewFive = function () {
    activeScope = null;
    returnText = null;
    fiveChoices = {};
    fiveReview = true;
    originalReviewFive();
  };

  // Import the existing single saved position without changing its key or history.
  const legacy = readProgress();
  const validLegacy = validOxState(legacy) || validFiveState(legacy);
  const legacyScope = validLegacy && scopeOf(validLegacy.state);
  if (legacyScope && !savedFor(legacyScope.subject, legacyScope.topic, legacy.mode, legacy.source || '')) rememberScoped(validLegacy.state);

  window.addEventListener('pageshow', updateResumeCard);
  window.addEventListener('storage', updateResumeCard);
  updateResumeCard();
}());
