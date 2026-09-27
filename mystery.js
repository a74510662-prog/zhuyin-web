// 學習頁的神秘小關卡：今天學到第 3、5、10 個字時出現，用今天學過的字玩連連看／填空。
// Relies on globals: state, speak, fetchExampleWords, fetchWordBopomofo, zhuyinColumnHtml, fixSyllable (app.js);
// shuffle, pickRandom, CHEERS (quiz.js); rpg, saveRpg, todayStr, gainStudyExp (rpg.js).
const MYSTERY_LEVELS = {
  3: { name: '連連看', icon: '🔗', exp: 5, stages: ['match'] },
  5: { name: '填空挑戰', icon: '✏️', exp: 8, stages: ['fill'] },
  10: { name: '神秘大寶箱', icon: '🎁', exp: 15, stages: ['match', 'fill'] },
};
const MATCH_MAX_PAIRS = 5;
const MATCH_MAX_MISTAKES = 2;
const FILL_QUESTIONS = 3;
const FILL_PASS = 2;
const LINE_COLORS = ['#ff6f91', '#4d9de0', '#6bcb77', '#9d65c9', '#ffb238'];

const mystery = {
  level: 0, stageIdx: 0, chars: [],
  matchMistakes: 0, fillScore: 0, fillTotal: 0,
};

const mysteryOverlay = document.createElement('div');
mysteryOverlay.className = 'overlay hidden';
mysteryOverlay.innerHTML = `
  <div class="detail-card mystery-card">
    <div id="mysteryBody"></div>
  </div>`;
document.body.appendChild(mysteryOverlay);
const mysteryBody = document.getElementById('mysteryBody');

const mysteryFab = document.createElement('button');
mysteryFab.className = 'mystery-fab hidden';
document.getElementById('learnView').appendChild(mysteryFab);

// ---------- 進度 ----------

function studyToday() {
  const s = rpg.study;
  return s.date === todayStr() ? { chars: s.chars, bonus: s.bonus || [] } : { chars: [], bonus: [] };
}

function pendingMysteries() {
  const { chars, bonus } = studyToday();
  return Object.keys(MYSTERY_LEVELS).map(Number).filter((n) => chars.length >= n && !bonus.includes(n));
}

// 備用入口：玩到一半重新整理頁面時，還能回來完成；神秘關卡視窗開著時不顯示
function updateMysteryFab() {
  const pending = pendingMysteries();
  const open = !mysteryOverlay.classList.contains('hidden');
  mysteryFab.classList.toggle('hidden', pending.length === 0 || open);
  if (pending.length) mysteryFab.innerHTML = `🎁 神秘小關卡${pending.length > 1 ? ` ×${pending.length}` : ''}`;
}

const MYSTERY_DELAY_MS = 3000;
let mysteryTimer = null;
let mysteryWaiting = 0; // 已達成、等著跳出的關卡

// rewardStudy（rpg.js）每學一個新字就呼叫。學到第 3、5、10 個字時，
// 以先發生的為準跳出神秘小關卡：① 3 秒後 ② 小朋友關掉字卡（onDetailClosed）
function mysteryOnStudy(count) {
  if (!MYSTERY_LEVELS[count]) {
    updateMysteryFab();
    return '';
  }
  mysteryWaiting = count;
  clearTimeout(mysteryTimer);
  mysteryTimer = setTimeout(openWaitingMystery, MYSTERY_DELAY_MS);
  return '<br>✨ 神秘小關卡出現了！';
}

// app.js 的 closeDetail 呼叫
function onDetailClosed() {
  if (mysteryWaiting) openWaitingMystery();
}

function openWaitingMystery() {
  clearTimeout(mysteryTimer);
  const level = mysteryWaiting;
  mysteryWaiting = 0;
  if (level) openMystery(level);
}

function charObjects(list) {
  return list.map((ch) => state.chars.find((c) => c.char === ch)).filter((c) => c && c.bopomofo);
}

// ---------- 開始 ----------

// 直接進入遊戲，沒有開場畫面，也不能關掉，要當場完成
function openMystery(level) {
  mystery.level = level;
  mystery.chars = charObjects(studyToday().chars.slice(0, level));
  mysteryOverlay.classList.remove('hidden');
  updateMysteryFab();
  startMystery();
}

function mysteryBanner() {
  const cfg = MYSTERY_LEVELS[mystery.level];
  return `<div class="mys-banner">🎁 神秘小關卡！過關 ⭐ +${cfg.exp} 經驗</div>`;
}

function closeMystery() {
  mysteryOverlay.classList.add('hidden');
  stopSpeaking(); // app.js
  updateMysteryFab();
}

function startMystery() {
  Object.assign(mystery, { stageIdx: 0, matchMistakes: 0, fillScore: 0, fillTotal: 0 });
  runStage();
}

function runStage() {
  const stage = MYSTERY_LEVELS[mystery.level].stages[mystery.stageIdx];
  if (!stage) finishMystery();
  else if (stage === 'match') renderMatch();
  else renderFill();
}

function nextStage() {
  mystery.stageIdx++;
  runStage();
}

// ---------- 連連看 ----------

function renderMatch() {
  const pairs = shuffle(mystery.chars).slice(0, MATCH_MAX_PAIRS);
  const right = shuffle(pairs);
  let selL = null;
  let selR = null;
  let matched = 0;

  mysteryBody.innerHTML = `
    ${mysteryBanner()}
    <h2 class="mys-title">🔗 連連看</h2>
    <p class="mys-text">點一個字，再點它的注音，把它們連起來！</p>
    <div class="match-board" id="matchBoard">
      <svg class="match-lines" id="matchLines"></svg>
      <div class="match-col">${pairs.map((c, i) => `<button class="match-item char" data-i="${i}">${c.char}</button>`).join('')}</div>
      <div class="match-col">${right.map((c, i) => `<button class="match-item bpmf" data-i="${i}">${c.bopomofo}</button>`).join('')}</div>
    </div>
    <div class="mys-status" id="mysStatus"></div>`;

  const board = document.getElementById('matchBoard');
  const lines = document.getElementById('matchLines');
  const leftBtns = [...board.querySelectorAll('.match-item.char')];
  const rightBtns = [...board.querySelectorAll('.match-item.bpmf')];
  const status = document.getElementById('mysStatus');
  const showStatus = () => {
    status.textContent = `錯誤 ${mystery.matchMistakes} 次（${MATCH_MAX_MISTAKES} 次以內過關）`;
    status.classList.toggle('bad', mystery.matchMistakes > MATCH_MAX_MISTAKES);
  };
  showStatus();

  const drawLine = (a, b, color) => {
    const box = board.getBoundingClientRect();
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', ra.right - box.left);
    line.setAttribute('y1', ra.top + ra.height / 2 - box.top);
    line.setAttribute('x2', rb.left - box.left);
    line.setAttribute('y2', rb.top + rb.height / 2 - box.top);
    line.setAttribute('stroke', color);
    lines.appendChild(line);
  };

  const tryPair = () => {
    if (selL === null || selR === null) return;
    const a = leftBtns[selL];
    const b = rightBtns[selR];
    // 比對注音字串，同音字（如 的/得）連到哪一個都算對
    if (pairs[selL].bopomofo === right[selR].bopomofo) {
      const color = LINE_COLORS[matched % LINE_COLORS.length];
      [a, b].forEach((btn) => {
        btn.classList.remove('selected');
        btn.classList.add('matched');
        btn.style.setProperty('--line', color);
        btn.disabled = true;
      });
      drawLine(a, b, color);
      speak(pairs[selL].char);
      matched++;
      if (matched === pairs.length) {
        status.textContent = `${pickRandom(CHEERS)} 全部連好了！`;
        setTimeout(nextStage, 1300);
      }
    } else {
      mystery.matchMistakes++;
      [a, b].forEach((btn) => {
        btn.classList.remove('selected');
        btn.classList.add('wrong');
        setTimeout(() => btn.classList.remove('wrong'), 400);
      });
      showStatus();
    }
    selL = null;
    selR = null;
  };

  leftBtns.forEach((btn, i) => btn.addEventListener('click', () => {
    leftBtns.forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    selL = i;
    tryPair();
  }));
  rightBtns.forEach((btn, i) => btn.addEventListener('click', () => {
    rightBtns.forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    selR = i;
    tryPair();
  }));
}

// ---------- 填空 ----------

// 從例詞挑一個只出現一次該字的短詞，挖空該字
async function buildFillQuestion(answer) {
  const examples = await fetchExampleWords(answer.char);
  const words = examples.filter((w) => {
    const cs = [...w];
    return cs.length >= 2 && cs.length <= 4 && cs.filter((x) => x === answer.char).length === 1;
  });
  if (words.length === 0) return null;
  const word = pickRandom(words);
  const bopomofo = await fetchWordBopomofo(word);
  return { answer, word, bopomofo };
}

function fillOptions(answer, word) {
  const ok = (c) => c.bopomofo && c.bopomofo !== answer.bopomofo && !word.includes(c.char);
  const picks = shuffle(mystery.chars.filter(ok)).slice(0, 2);
  const extra = shuffle(state.chars.filter((c) => ok(c) && !picks.includes(c)));
  return shuffle([answer, ...picks.concat(extra).slice(0, 2)]);
}

async function renderFill() {
  mysteryBody.innerHTML = `${mysteryBanner()}<h2 class="mys-title">✏️ 填空</h2><p class="mys-text">準備題目中…🐣</p>`;
  const questions = [];
  for (const c of shuffle(mystery.chars)) {
    if (questions.length >= FILL_QUESTIONS) break;
    const q = await buildFillQuestion(c);
    if (q) questions.push(q);
  }
  // 例詞不夠時，改成「哪個字唸…」
  for (const c of shuffle(mystery.chars)) {
    if (questions.length >= FILL_QUESTIONS) break;
    if (!questions.some((q) => q.answer === c)) questions.push({ answer: c, word: c.char, bopomofo: c.bopomofo });
  }
  mystery.fillTotal = questions.length;
  showFillQuestion(questions, 0);
}

function fillWordHtml({ answer, word, bopomofo }, filled) {
  const chars = [...word];
  const syllables = bopomofo ? bopomofo.trim().split(/\s+/) : [];
  const matched = syllables.length === chars.length;
  return chars.map((c, i) => {
    if (c === answer.char) {
      return `<span class="zy-char"><span class="zy-han fill-blank ${filled ? 'filled' : ''}">${filled ? c : '？'}</span>${zhuyinColumnHtml(answer.bopomofo)}</span>`;
    }
    return `<span class="zy-char"><span class="zy-han">${c}</span>${matched ? zhuyinColumnHtml(fixSyllable(c, syllables[i])) : ''}</span>`;
  }).join('');
}

function showFillQuestion(questions, idx) {
  const q = questions[idx];
  const options = fillOptions(q.answer, q.word);
  mysteryBody.innerHTML = `
    ${mysteryBanner()}
    <h2 class="mys-title">✏️ 填空（${idx + 1}/${questions.length}）</h2>
    <p class="mys-text">看注音，選出空格裡的字！</p>
    <div class="fill-word" id="fillWord">${fillWordHtml(q, false)}</div>
    <div class="quiz-options mys-options">${options.map((o, i) => `<button class="option-btn" data-i="${i}">${o.char}</button>`).join('')}</div>
    <div class="quiz-feedback" id="fillFeedback"></div>`;

  const buttons = [...mysteryBody.querySelectorAll('.option-btn')];
  buttons.forEach((btn, i) => btn.addEventListener('click', () => {
    buttons.forEach((b) => (b.disabled = true));
    const correct = options[i] === q.answer;
    buttons[options.indexOf(q.answer)].classList.add('correct');
    document.getElementById('fillWord').innerHTML = fillWordHtml(q, true);
    const feedback = document.getElementById('fillFeedback');
    if (correct) {
      mystery.fillScore++;
      feedback.textContent = pickRandom(CHEERS);
      feedback.className = 'quiz-feedback good';
    } else {
      btn.classList.add('wrong');
      addWeak(q.answer.char); // 記進錯字本（weak.js）
      feedback.textContent = `答案是「${q.answer.char}」喔！`;
      feedback.className = 'quiz-feedback bad';
    }
    speak(q.word);
    setTimeout(() => {
      if (idx + 1 < questions.length) showFillQuestion(questions, idx + 1);
      else nextStage();
    }, 1600);
  }));
}

// ---------- 結算 ----------

function finishMystery() {
  const cfg = MYSTERY_LEVELS[mystery.level];
  const results = [];
  let passed = true;
  if (cfg.stages.includes('match')) {
    const ok = mystery.matchMistakes <= MATCH_MAX_MISTAKES;
    passed = passed && ok;
    results.push(`🔗 連連看：錯 ${mystery.matchMistakes} 次 ${ok ? '✅' : '❌'}`);
  }
  if (cfg.stages.includes('fill')) {
    const ok = mystery.fillScore >= Math.min(FILL_PASS, mystery.fillTotal);
    passed = passed && ok;
    results.push(`✏️ 填空：答對 ${mystery.fillScore}/${mystery.fillTotal} ${ok ? '✅' : '❌'}`);
  }

  if (passed) {
    rpg.study.bonus = [...(rpg.study.bonus || []), mystery.level];
    gainStudyExp(cfg.exp, '🎁 神秘小關卡過關！');
  }
  const next = pendingMysteries()[0];
  // 第 10 個字的神秘關卡＝今天的字學完了，提醒去測驗頁做每日任務
  const lastOfDay = mystery.level === STUDY_DAILY_LIMIT;

  mysteryBody.innerHTML = `
    <div class="mys-box">${passed ? '🎉' : '💪'}</div>
    <h2 class="mys-title">${passed ? '過關了！好厲害！' : '差一點點！'}</h2>
    ${passed && !next && mystery.level === STUDY_DAILY_LIMIT ? `<p class="mys-text">🎉 今天的 ${STUDY_DAILY_LIMIT} 個字學完了！去測驗頁完成每日任務吧！</p>` : ''}
    ${results.map((r) => `<div class="result-note">${r}</div>`).join('')}
    <p class="mys-reward">${passed ? `⭐ 得到 ${cfg.exp} 經驗！` : `再挑戰一次就能拿到 ${cfg.exp} 經驗！`}</p>
    <div class="result-actions">
      ${!passed
        ? '<button class="big-btn" id="mysRetry">再玩一次 🔁</button>'
        : next
          ? '<button class="big-btn" id="mysNext">下一個神秘關卡 🎁</button>'
          : `${lastOfDay ? '<button class="big-btn" id="mysQuiz">去測驗做任務 ✏️</button>' : ''}
             <button class="big-btn secondary" id="mysDone">繼續學習 📖</button>`}
    </div>`;
  if (passed && !next && lastOfDay) {
    document.getElementById('mysQuiz').addEventListener('click', () => {
      closeMystery();
      closeDetail(); // app.js
      switchMode('quiz'); // quiz.js
    });
  }

  // 沒過關只能再玩一次，要當場完成才能回去學習
  if (!passed) document.getElementById('mysRetry').addEventListener('click', startMystery);
  else if (next) document.getElementById('mysNext').addEventListener('click', () => openMystery(next));
  else document.getElementById('mysDone').addEventListener('click', closeMystery);
  updateMysteryFab();
}

// ---------- events ----------

mysteryFab.addEventListener('click', () => {
  const pending = pendingMysteries();
  if (pending.length) openMystery(pending[0]);
});
updateMysteryFab();
