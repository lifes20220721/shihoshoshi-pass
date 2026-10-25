(function () {
  'use strict';

  const PROGRESS_KEY = 'shihoshoshi-pass-progress-v1';
  let restoringPast = false;

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

  const originalStartQuiz = startQuiz;
  startQuiz = function (onlyWrong) {
    originalStartQuiz(onlyWrong);
    saveOxProgress(pos);
  };

  const originalRenderQuestion = renderQuestion;
  renderQuestion = function () {
    originalRenderQuestion();
    if (queue[pos]) saveOxProgress(pos);
  };

  const originalAnswer = answer;
  answer = function (choice) {
    const wasAnswered = answered;
    originalAnswer(choice);
    if (!wasAnswered && answered) saveOxProgress(pos + 1);
  };

  const originalNextQuestion = nextQuestion;
  nextQuestion = function () {
    originalNextQuestion();
    if (pos >= queue.length) clearProgress();
    else saveOxProgress(pos);
  };

  const originalStartFive = startFive;
  startFive = function () {
    originalStartFive();
    saveFiveProgress(v11FiveIndex);
  };

  const originalStartTopicFive = v11StartTopicFive;
  v11StartTopicFive = function () {
    originalStartTopicFive();
    saveFiveProgress(v11FiveIndex);
  };

  const originalRenderFive = v11RenderFive;
  v11RenderFive = function () {
    originalRenderFive();
    if (v11FiveQueue[v11FiveIndex] !== undefined) saveFiveProgress(v11FiveIndex);
  };

  const originalAnswerFive = v11AnswerFive;
  v11AnswerFive = function (choice, questionIndex) {
    const wasAnswered = fiveAnswered;
    originalAnswerFive(choice, questionIndex);
    if (!wasAnswered && fiveAnswered) saveFiveProgress(v11FiveIndex + 1);
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
    savePastProgress(false);
  };

  const originalPastFilter = v15PastFilter;
  v15PastFilter = function () {
    originalPastFilter();
    savePastProgress(false);
  };

  const originalPastRender = v15PastRender;
  v15PastRender = function () {
    originalPastRender();
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
    savePastProgress(false);
  };

  window.v181ResumeProgress = function () {
    const state = readProgress();
    const ox = validOxState(state);
    if (ox) {
      queue = ox.restored;
      pos = state.position;
      review = Boolean(state.review);
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
