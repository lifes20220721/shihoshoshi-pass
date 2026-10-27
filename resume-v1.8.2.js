(function () {
  'use strict';

  const PROGRESS_KEY = 'shihoshoshi-pass-progress-v1';
  let restoringPast = false;
  let oxChoices = {};
  let fiveChoices = {};

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
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({
        ...state,
        version: 1,
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {
      // Learning history remains usable even if this optional position cannot be stored.
    }
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
    if (!state || state.mode !== 'ox') return null;
    const byId = new Map(questions.map(question => [question.id, question]));
    const restored = state.queue.map(id => byId.get(id)).filter(Boolean);
    if (!restored.length || state.position >= restored.length) return null;
    return {state, restored};
  }

  function validFiveState(state) {
    if (!state || state.mode !== 'five') return null;
    const restored = state.queue.filter(index => Number.isInteger(index) && index >= 0 && index < fiveQuestions.length);
    if (!restored.length || state.position >= restored.length) return null;
    return {state, restored};
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
    text.textContent = valid ? progressDescription(state) : '';
    if (state && !valid) clearProgress();
  }

  function saveOxProgress(position) {
    const ids = queue.map(question => question && question.id).filter(Boolean);
    if (!ids.length || position >= ids.length) {
      clearProgress();
      return;
    }
    writeProgress({
      mode: 'ox',
      queue: ids,
      position,
      choices: oxChoices,
      review: Boolean(review),
      title: document.getElementById('quizTitle')?.textContent || '',
      topic: document.getElementById('topic')?.value || 'all',
      source: document.getElementById('v16OxSource')?.value || ''
    });
  }

  function saveFiveProgress(position) {
    const indices = v11FiveQueue.filter(index => Number.isInteger(index));
    if (!indices.length || position >= indices.length) {
      clearProgress();
      return;
    }
    const topic = v11Topic?.id && indices.every(index => v11FiveTopic[index] === v11Topic.id) ? v11Topic.id : '';
    writeProgress({
      mode: 'five',
      queue: indices,
      position,
      choices: fiveChoices,
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
    oxChoices = {};
    originalStartQuiz(onlyWrong);
    saveOxProgress(pos);
  };

  const originalRenderQuestion = renderQuestion;
  renderQuestion = function () {
    originalRenderQuestion();
    restoreOxAnswer();
    updateOxBackButton();
    if (queue[pos]) saveOxProgress(pos);
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
    fiveChoices = {};
    originalStartFive();
    saveFiveProgress(v11FiveIndex);
  };

  const originalStartTopicFive = v11StartTopicFive;
  v11StartTopicFive = function () {
    fiveChoices = {};
    originalStartTopicFive();
    saveFiveProgress(v11FiveIndex);
  };

  const originalRenderFive = v11RenderFive;
  v11RenderFive = function () {
    originalRenderFive();
    restoreFiveAnswer();
    updateFiveBackButton();
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

  window.v181ResumeProgress = function () {
    const state = readProgress();
    const ox = validOxState(state);
    if (ox) {
      queue = ox.restored;
      pos = state.position;
      review = Boolean(state.review);
      oxChoices = addLegacyOxChoices(sanitizeOxChoices(state.choices, ox.restored), ox.restored, state.position);
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
      v11FiveQueue = five.restored;
      v11FiveIndex = state.position;
      fiveChoices = addLegacyFiveChoices(sanitizeFiveChoices(state.choices, five.restored), five.restored, state.position);
      v11Subject = state.subject ? v11Subjects.find(item => item.id === state.subject) || null : null;
      v11Topic = state.topic ? chapters.find(item => item.id === state.topic) || null : null;
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
  };

  window.v181DiscardProgress = function () {
    if (window.confirm('保存されている途中位置を消しますか？ 解答履歴は削除されません。')) clearProgress();
  };

  window.addEventListener('pageshow', updateResumeCard);
  window.addEventListener('storage', updateResumeCard);
  updateResumeCard();
}());
