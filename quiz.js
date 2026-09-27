// Quiz mode. Relies on globals from app.js: state, speak, openDetail.
const QUIZ_LENGTH = 10;
const OPTION_COUNT = 4;
const AUTO_NEXT_MS = 1200;

const quiz = {
  range: 'group',
  type: 'char2bpmf',
  questions: [],
  index: 0,
  score: 0,
  wrong: [],
  answered: false,
  timer: null,
  task: null, // 正在做的每日任務題型（task.js），自由練習時是 null
  levelBefore: 1,
};

const qel = {
  modeTabs: document.getElementById('modeTabs'),
  learnView: document.getElementById('learnView'),
  quizView: document.getElementById('quizView'),
  setup: document.getElementById('quizSetup'),
  play: document.getElementById('quizPlay'),
  result: document.getElementById('quizResult'),
  resultExtra: document.getElementById('resultExtra'),
  rangeChoices: document.getElementById('rangeChoices'),
  typeChoices: document.getElementById('typeChoices'),
  setupHint: document.getElementById('setupHint'),
  groupPick: document.getElementById('quizGroupPick'),
  startBtn: document.getElementById('startQuiz'),
  counter: document.getElementById('quizCounter'),
  scoreText: document.getElementById('quizScore'),
  trackFill: document.getElementById('quizTrackFill'),
  prompt: document.getElementById('quizPrompt'),
  options: document.getElementById('quizOptions'),
  feedback: document.getElementById('quizFeedback'),
  nextBtn: document.getElementById('nextQuestion'),
  resultStars: document.getElementById('resultStars'),
  resultText: document.getElementById('resultText'),
  resultWrongWrap: document.getElementById('resultWrongWrap'),
  resultWrong: document.getElementById('resultWrong'),
  retryBtn: document.getElementById('retryQuiz'),
  backBtn: document.getElementById('backToSetup'),
};

const CHEERS = ['答對了！🎉', '好棒喔！👏', '太厲害了！🌟', '完全正確！💯', '你真棒！😄'];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------- mode switching ----------

function switchMode(mode) {
  qel.modeTabs.querySelectorAll('.mode-tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  qel.learnView.classList.toggle('hidden', mode !== 'learn');
  qel.quizView.classList.toggle('hidden', mode !== 'quiz');
  document.getElementById('rpgView').classList.toggle('hidden', mode !== 'rpg');
  if (mode !== 'rpg') rpgLeave();
  if (mode === 'quiz') {
    showQuizPanel('setup');
  } else if (mode === 'rpg') {
    clearTimeout(quiz.timer);
    rpgEnter();
  } else {
    clearTimeout(quiz.timer);
    // learned stars may have changed from the result screen's detail popups
    renderGroupNav();
    renderTodayBar();
    renderCardGrid();
    updateProgress();
  }
}

function showQuizPanel(name) {
  clearTimeout(quiz.timer);
  qel.setup.classList.toggle('hidden', name !== 'setup');
  qel.play.classList.toggle('hidden', name !== 'play');
  qel.result.classList.toggle('hidden', name !== 'result');
  document.getElementById('taskSlot').classList.toggle('hidden', name !== 'setup'); // 任務卡只在開始頁顯示
  if (name === 'setup') {
    updateSetupHint();
    renderTaskSlot(); // task.js
  }
}

// ---------- setup ----------

function getPool() {
  if (quiz.range === 'group') return state.groups[state.activeGroup] || [];
  if (quiz.range === 'learned') return state.chars.filter((c) => state.learned.has(c.char));
  if (quiz.range === 'weak') return state.chars.filter((c) => rpg.weak[c.char]); // weak.js
  return state.chars;
}

function updateSetupHint() {
  const pool = getPool();
  const rangeLabel = {
    group: groupLabel(state.activeGroup),
    learned: '學會的字',
    all: '全部的字',
    weak: '我的錯字',
  }[quiz.range];
  renderGroupPick();
  qel.rangeChoices.querySelector('[data-range="weak"]').textContent = `📕 我的錯字 (${weakCount()})`;

  if (pool.length === 0) {
    qel.setupHint.textContent = quiz.range === 'weak'
      ? '錯字本是空的，太棒了！🎉'
      : '還沒有學會的字喔！先去「學習」按「我學會了 ⭐」吧～';
    qel.startBtn.disabled = true;
    return;
  }
  const n = Math.min(QUIZ_LENGTH, pool.length);
  qel.setupHint.innerHTML = `從「${rangeLabel}」出 ${n} 題${quiz.range === 'weak' ? weakHintHtml() : ''}`;
  qel.startBtn.disabled = false;
}

// 選「這一組」時，直接在測驗頁挑第幾組（跟學習頁選的組同步）
function renderGroupPick() {
  qel.groupPick.classList.toggle('hidden', quiz.range !== 'group');
  if (quiz.range !== 'group') return;
  const level = state.groupLevel[state.activeGroup];
  const groups = state.groups
    .map((_, i) => i)
    .filter((i) => state.groupLevel[i] === level)
    .map((i) => `<button class="choice-btn small ${i === state.activeGroup ? 'active' : ''}" data-group="${i}">${groupLabel(i, false)}</button>`)
    .join('');
  qel.groupPick.innerHTML = `<div class="level-tabs">${levelTabsHtml()}</div>${groups}`;
}

qel.groupPick.addEventListener('click', (e) => {
  const lv = e.target.closest('[data-level]');
  const btn = e.target.closest('[data-group]');
  if (lv) state.activeGroup = firstGroupOfLevel(Number(lv.dataset.level));
  else if (btn) state.activeGroup = Number(btn.dataset.group);
  else return;
  updateSetupHint();
});

function bindChoiceRow(row, key) {
  row.addEventListener('click', (e) => {
    const btn = e.target.closest('.choice-btn');
    if (!btn) return;
    row.querySelectorAll('.choice-btn').forEach((b) => b.classList.toggle('active', b === btn));
    quiz[key] = btn.dataset[key];
    updateSetupHint();
  });
}

// ---------- question generation ----------

// Count shared zhuyin symbols (initials, finals, tone marks) so distractors
// look similar to the answer — e.g. ㄉㄚˋ vs ㄉㄚˇ — which trains careful reading.
function similarity(a, b) {
  const setB = new Set(b);
  let score = 0;
  for (const ch of new Set(a)) if (setB.has(ch)) score++;
  return score;
}

function buildDistractors(answer) {
  // Never use a homophone (e.g. 的/得, 他/她) — it would also be a correct answer.
  const seen = new Set([answer.bopomofo]);
  const candidates = [];
  shuffle(state.chars).forEach((c) => {
    if (!c.bopomofo || seen.has(c.bopomofo)) return;
    seen.add(c.bopomofo);
    candidates.push(c);
  });

  candidates.sort((x, y) => similarity(y.bopomofo, answer.bopomofo) - similarity(x.bopomofo, answer.bopomofo));

  // Mix: two look-alikes from the most similar, the rest random, so it's not too hard.
  const similar = shuffle(candidates.slice(0, 6)).slice(0, 2);
  const rest = shuffle(candidates.filter((c) => !similar.includes(c)));
  return similar.concat(rest).slice(0, OPTION_COUNT - 1);
}

function buildQuestions() {
  const pool = shuffle(getPool().filter((c) => c.bopomofo)).slice(0, QUIZ_LENGTH);
  return pool.map((answer) => ({
    answer,
    type: quiz.type,
    options: shuffle([answer, ...buildDistractors(answer)]),
  }));
}

// ---------- play ----------

function startQuiz() {
  quiz.task = null;
  quiz.levelBefore = currentLevel();
  quiz.questions = buildQuestions();
  if (quiz.questions.length === 0) return;
  quiz.index = 0;
  quiz.score = 0;
  quiz.wrong = [];
  showQuizPanel('play');
  renderQuestion();
}

function renderQuestion() {
  const q = quiz.questions[quiz.index];
  quiz.answered = false;
  const total = quiz.questions.length;

  qel.counter.textContent = `${quiz.task ? '📋 每日任務・' : ''}第 ${quiz.index + 1} / ${total} 題`;
  qel.scoreText.textContent = `⭐ ${quiz.score}`;
  qel.trackFill.style.width = `${(quiz.index / total) * 100}%`;
  qel.feedback.textContent = '';
  qel.feedback.className = 'quiz-feedback';
  qel.nextBtn.classList.add('hidden');

  qel.prompt.innerHTML = '';
  qel.prompt.className = 'quiz-prompt';
  if (q.type === 'char2bpmf') {
    qel.prompt.innerHTML = `<div class="prompt-label">這個字怎麼唸？</div><div class="prompt-char">${q.answer.char}</div>`;
  } else if (q.type === 'bpmf2char') {
    qel.prompt.innerHTML = `<div class="prompt-label">哪一個字唸作…</div><div class="prompt-bpmf">${q.answer.bopomofo}</div>`;
  } else {
    qel.prompt.innerHTML = `<div class="prompt-label">聽聽看，是哪一個字？</div>`;
    const btn = document.createElement('button');
    btn.className = 'listen-btn';
    btn.textContent = '🔊';
    btn.setAttribute('aria-label', '再聽一次');
    btn.addEventListener('click', () => speak(q.answer.char));
    qel.prompt.appendChild(btn);
    speak(q.answer.char);
  }

  const showBpmf = q.type === 'char2bpmf';
  qel.options.innerHTML = '';
  qel.options.classList.toggle('bpmf-options', showBpmf);
  q.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = showBpmf ? opt.bopomofo : opt.char;
    btn.addEventListener('click', () => answerQuestion(opt, btn));
    qel.options.appendChild(btn);
  });
}

function answerQuestion(opt, btn) {
  if (quiz.answered) return;
  quiz.answered = true;
  const q = quiz.questions[quiz.index];
  const correct = opt === q.answer;

  const buttons = [...qel.options.children];
  buttons.forEach((b) => (b.disabled = true));
  const correctBtn = buttons[q.options.indexOf(q.answer)];
  correctBtn.classList.add('correct');

  const reveal = `${q.answer.char}（${q.answer.bopomofo}）`;
  if (correct) {
    quiz.score++;
    qel.scoreText.textContent = `⭐ ${quiz.score}`;
    // 答對一般 +3（task.js）；錯字本裡的字練回來另外 +10（weak.js）
    qel.feedback.textContent = `${pickRandom(CHEERS)} ${reveal}${quizAnswerExp()}${reviewWeak(q.answer.char)}`;
    qel.feedback.classList.add('good');
  } else {
    btn.classList.add('wrong');
    quiz.wrong.push(q.answer);
    addWeak(q.answer.char); // 記進錯字本（weak.js）
    qel.feedback.textContent = `沒關係！答案是 ${reveal}`;
    qel.feedback.classList.add('bad');
  }
  speak(q.answer.char);

  const isLast = quiz.index === quiz.questions.length - 1;
  qel.nextBtn.textContent = isLast ? '看成績 🏆' : '下一題 ➡️';
  if (correct) {
    // Auto-advance on correct answers to keep the pace; wait for the child after mistakes.
    quiz.timer = setTimeout(nextQuestion, AUTO_NEXT_MS);
  } else {
    qel.nextBtn.classList.remove('hidden');
  }
}

function nextQuestion() {
  clearTimeout(quiz.timer);
  if (quiz.index < quiz.questions.length - 1) {
    quiz.index++;
    renderQuestion();
  } else {
    showResult();
  }
}

// ---------- result ----------

function showResult() {
  const total = quiz.questions.length;
  const ratio = quiz.score / total;
  const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
  const messages = { 3: '太厲害了！你是注音小達人！🏅', 2: '很不錯喔！再加油一點點！💪', 1: '慢慢來，多練習就會越來越棒！🌱' };

  qel.resultStars.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
  qel.resultText.innerHTML = `答對 <b>${quiz.score}</b> / ${total} 題<br>${messages[stars]}`;
  qel.trackFill.style.width = '100%';
  qel.resultExtra.innerHTML = taskResultHtml(); // 任務達成、測驗經驗（task.js）
  qel.retryBtn.textContent = quiz.task ? '再挑戰一次 🔁' : '再玩一次 🔁';

  qel.resultWrong.innerHTML = '';
  qel.resultWrongWrap.classList.toggle('hidden', quiz.wrong.length === 0);
  quiz.wrong.forEach((item) => {
    const chip = document.createElement('button');
    chip.className = 'wrong-chip';
    chip.innerHTML = `<span class="wc-char">${item.char}</span><span class="wc-bpmf">${item.bopomofo}</span>`;
    chip.addEventListener('click', () => openDetail(item));
    qel.resultWrong.appendChild(chip);
  });

  showQuizPanel('result');
}

// ---------- events ----------

qel.modeTabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.mode-tab');
  if (tab) switchMode(tab.dataset.mode);
});
bindChoiceRow(qel.rangeChoices, 'range');
bindChoiceRow(qel.typeChoices, 'type');
qel.startBtn.addEventListener('click', startQuiz);
qel.nextBtn.addEventListener('click', nextQuestion);
qel.retryBtn.addEventListener('click', () => (quiz.task ? startTask(quiz.task) : startQuiz()));
qel.backBtn.addEventListener('click', () => showQuizPanel('setup'));
