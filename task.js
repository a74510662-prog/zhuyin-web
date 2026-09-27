// 每日任務（仿英文網站的每日任務）：用「今天在學習頁學的 10 個字」出題，
// 看字選注音／看注音選字／聽聲音選字 三項各要「本場 10 題全對」，三項都達成＝每日挑戰（蓋章、連續天數）。
// 測驗頁每答對一題也有小額經驗（每日上限）。
// Relies on globals: rpg, saveRpg, todayStr, currentLevel, levelUpNote, fillTeam, renderMap, rpgUi, studyToday...
// (rpg.js / mystery.js); quiz, qel, showQuizPanel, switchMode, renderQuestion, buildDistractors, shuffle (quiz.js);
// playChime, playVoice (music.js).
const TASK_WORDS = 10; // 要先學滿 10 個字才能做任務
const TASK_ITEM_EXP = 20; // 每完成一項
const CHALLENGE_EXP = 30; // 三項都完成
const QUIZ_EXP_PER_CORRECT = 3; // 測驗頁每答對一題
const QUIZ_EXP_DAILY_CAP = 60;
const TASK_ITEMS = [
  { type: 'char2bpmf', name: '看字選注音' },
  { type: 'bpmf2char', name: '看注音選字' },
  { type: 'listen', name: '聽聲音選字' },
];
const STREAK_REWARDS = [
  { days: 3, exp: 50, title: '認真小學徒' },
  { days: 7, exp: 100, title: '注音小勇士' },
  { days: 14, exp: 200, title: '注音大師' },
];
const STREAK_REPEAT = { every: 7, exp: 100 }; // 14 天之後，每多 7 天再給一次
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

// ---------- 今日狀態 ----------

function taskToday() {
  if (rpg.task.date !== todayStr() || !rpg.task.done) rpg.task = { date: todayStr(), done: {}, challenge: false, quizExp: 0 };
  return rpg.task;
}

function taskDoneToday() {
  return rpg.task.date === todayStr() && rpg.task.challenge;
}

function taskDoneCount() {
  const t = taskToday();
  return TASK_ITEMS.filter((it) => t.done[it.type]).length;
}

function todayTaskChars() {
  return studyToday().chars.map((ch) => state.chars.find((c) => c.char === ch)).filter((c) => c && c.bopomofo);
}

function dateShift(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('sv');
}

// 連續天數：從今天（今天還沒完成就從昨天）往回數有蓋章的天數
function currentStreak() {
  let day = rpg.stamps[todayStr()] ? todayStr() : dateShift(todayStr(), -1);
  let n = 0;
  while (rpg.stamps[day]) {
    n++;
    day = dateShift(day, -1);
  }
  return n;
}

function streakReward(days) {
  const fixed = STREAK_REWARDS.find((r) => r.days === days);
  if (fixed) return fixed;
  const last = STREAK_REWARDS[STREAK_REWARDS.length - 1].days;
  if (days > last && (days - last) % STREAK_REPEAT.every === 0) return { days, exp: STREAK_REPEAT.exp, title: null };
  return null;
}

function nextStreakGoal(streak) {
  const fixed = STREAK_REWARDS.find((r) => r.days > streak);
  if (fixed) return fixed;
  const last = STREAK_REWARDS[STREAK_REWARDS.length - 1].days;
  const days = last + Math.ceil((streak + 1 - last) / STREAK_REPEAT.every) * STREAK_REPEAT.every;
  return { days, exp: STREAK_REPEAT.exp, title: null };
}

// ---------- 小元件（冒險頁的 HUD、地圖也會用） ----------

function taskChipHtml() {
  if (taskDoneToday()) return '<span class="chip done">📋 每日任務 ✅</span>';
  return `<span class="chip">📋 每日任務 ${taskDoneCount()}/${TASK_ITEMS.length}</span>`;
}

function streakChipHtml() {
  const streak = currentStreak();
  return streak ? `<span class="chip streak">🔥 連續 ${streak} 天</span>` : '';
}

// 冒險地圖上的捷徑卡
function taskCardHtml(id) {
  if (taskDoneToday()) {
    return `
      <div class="task-card done">
        <span class="task-icon">🏆</span>
        <span class="task-text"><b>每日任務全部完成！</b><small>明天再來蓋章喔～現在打怪經驗 1/3</small></span>
      </div>`;
  }
  return `
    <button class="task-card" id="${id}">
      <span class="task-icon">📋</span>
      <span class="task-text"><b>每日任務 ${taskDoneCount()}/${TASK_ITEMS.length}</b><small>三種測驗各全對一次，就能完成每日挑戰</small></span>
      <span class="task-go">去測驗頁 ➡️</span>
    </button>`;
}

// ---------- 測驗頁上方的任務清單 ----------

function renderTaskSlot() {
  const t = taskToday();
  const learned = todayTaskChars().length;
  const ready = learned >= TASK_WORDS;
  const rows = TASK_ITEMS.map((it) => `
    <div class="task-row ${t.done[it.type] ? 'done' : ''}">
      <span class="task-check">${t.done[it.type] ? '✅' : '⬜'}</span>
      <span class="task-name">${it.name}<small>本場 10 題全對・+${TASK_ITEM_EXP} 經驗</small></span>
      ${t.done[it.type] ? '' : `<button class="task-play" data-type="${it.type}" ${ready ? '' : 'disabled'}>挑戰</button>`}
    </div>`).join('');

  document.getElementById('taskSlot').innerHTML = `
    <div class="daily-task-card">
      <div class="dt-head">
        <h2>📋 每日任務</h2>
        <button class="stamp-link" id="taskStamps">📅 集點卡　🔥 ${currentStreak()} 天</button>
      </div>
      ${ready ? '' : `
        <div class="dt-need">
          先到「學習」學滿 ${TASK_WORDS} 個字才能挑戰喔！（今天 ${learned}/${TASK_WORDS}）
          <button class="task-play" id="goLearn">去學習 📖</button>
        </div>`}
      ${rows}
      <div class="task-row challenge ${t.challenge ? 'done' : ''}">
        <span class="task-check">${t.challenge ? '🏆' : '⬜'}</span>
        <span class="task-name">每日挑戰<small>三項都達成・+${CHALLENGE_EXP} 經驗＋集點卡蓋章</small></span>
      </div>
      <p class="dt-hint">題目是今天學的 ${TASK_WORDS} 個字；沒全對可以一直重玩。測驗每答對一題 +${QUIZ_EXP_PER_CORRECT} 經驗（今天 ${t.quizExp}/${QUIZ_EXP_DAILY_CAP}）</p>
    </div>`;

  document.querySelectorAll('.task-play[data-type]').forEach((btn) => {
    btn.addEventListener('click', () => startTask(btn.dataset.type));
  });
  const goLearn = document.getElementById('goLearn');
  if (goLearn) goLearn.addEventListener('click', () => switchMode('learn'));
  document.getElementById('taskStamps').addEventListener('click', () => openStampCard());
}

// ---------- 任務進行（用測驗頁的出題畫面） ----------

function startTask(type) {
  const chars = todayTaskChars();
  if (chars.length < TASK_WORDS) return;
  quiz.task = type;
  quiz.levelBefore = currentLevel();
  quiz.questions = shuffle(chars).slice(0, TASK_WORDS).map((answer) => ({
    answer,
    type,
    options: shuffle([answer, ...buildDistractors(answer)]),
  }));
  quiz.index = 0;
  quiz.score = 0;
  quiz.wrong = [];
  showQuizPanel('play');
  renderQuestion();
}

// 測驗頁（任務和自由練習都算）每答對一題的經驗，有每日上限；回傳顯示用文字
function quizAnswerExp() {
  const t = taskToday();
  const gain = Math.min(QUIZ_EXP_PER_CORRECT, QUIZ_EXP_DAILY_CAP - t.quizExp);
  if (gain <= 0) return '';
  t.quizExp += gain;
  rpg.exp += gain;
  saveRpg();
  return `　+${gain} 經驗`;
}

// 測驗結算時呼叫（quiz.js showResult），回傳要加在成績下面的 HTML
function taskResultHtml() {
  const t = taskToday();
  const lines = [`<div class="result-note">⭐ 今天測驗經驗 ${t.quizExp}/${QUIZ_EXP_DAILY_CAP}</div>`];
  if (!quiz.task) return lines.join('');

  const item = TASK_ITEMS.find((it) => it.type === quiz.task);
  const total = quiz.questions.length;
  if (quiz.score < total) {
    lines.unshift(`<div class="result-note miss">📋 ${item.name}：答對 ${quiz.score}/${total}，要全對才算達成任務喔！再試一次～</div>`);
    return lines.join('');
  }
  if (t.done[item.type]) return lines.join('');

  t.done[item.type] = true;
  rpg.exp += TASK_ITEM_EXP;
  lines.unshift(`<div class="result-note got">📋 任務達成：${item.name}！+${TASK_ITEM_EXP} 經驗</div>`);
  let voice = 'sounds/great.mp3';

  if (!t.challenge && TASK_ITEMS.every((it) => t.done[it.type])) {
    t.challenge = true;
    rpg.stamps[todayStr()] = 'done';
    let bonus = CHALLENGE_EXP;
    const streak = currentStreak();
    const reward = streakReward(streak);
    lines.splice(1, 0, `<div class="challenge-done"><div class="perfect-burst">🏆</div><b>每日挑戰完成！</b>+${CHALLENGE_EXP} 經驗・集點卡蓋章</div>`);
    if (reward) {
      bonus += reward.exp;
      if (reward.title && !rpg.titles.includes(reward.title)) rpg.titles.push(reward.title);
      lines.splice(2, 0, `<div class="result-note got">🔥 連續 ${streak} 天！+${reward.exp}${reward.title ? `，得到稱號「${reward.title}」` : ''}</div>`);
    }
    const goal = nextStreakGoal(streak);
    lines.push(`<p class="island-tip">🔥 已經連續 ${streak} 天！再 ${goal.days - streak} 天可以得到 +${goal.exp} 經驗${goal.title ? `和稱號「${goal.title}」` : ''}</p>`);
    rpg.exp += bonus;
    voice = 'sounds/perfect.mp3';
  }

  const lvNote = levelUpNote(quiz.levelBefore);
  if (lvNote) lines.unshift(`<div class="result-note got">${lvNote}</div>`);
  fillTeam();
  saveRpg();
  playChime();
  setTimeout(() => playVoice(voice, '你好棒！'), 350);
  return lines.join('');
}

// ---------- 集點卡 ----------

const stampOverlay = document.createElement('div');
stampOverlay.className = 'overlay hidden';
stampOverlay.innerHTML = `
  <div class="detail-card stamp-card">
    <button class="close-btn" id="closeStamps" aria-label="關閉">✕</button>
    <div id="stampBody"></div>
  </div>`;
document.body.appendChild(stampOverlay);
const stampBody = document.getElementById('stampBody');

function openStampCard(monthOffset = 0) {
  renderStampCard(monthOffset);
  stampOverlay.classList.remove('hidden');
}

function renderStampCard(monthOffset) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = first.getFullYear();
  const month = first.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayStr();

  let cells = '';
  for (let i = 0; i < first.getDay(); i++) cells += '<span class="cal-cell empty"></span>';
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = new Date(year, month, d).toLocaleDateString('sv');
    const stamp = rpg.stamps[key];
    if (stamp) count++;
    const cls = stamp ? 'stamped' : key > today ? 'future' : '';
    cells += `<span class="cal-cell ${cls} ${key === today ? 'today' : ''}"><small>${d}</small>${stamp ? '🏆' : ''}</span>`;
  }

  const streak = currentStreak();
  const goal = nextStreakGoal(streak);
  stampBody.innerHTML = `
    <h2 class="dex-title">📅 集點卡</h2>
    <div class="cal-head">
      <button class="cal-nav" id="calPrev" aria-label="上個月">‹</button>
      <b>${year} 年 ${month + 1} 月</b>
      <button class="cal-nav" id="calNext" aria-label="下個月" ${monthOffset >= 0 ? 'disabled' : ''}>›</button>
    </div>
    <div class="cal-grid">
      ${WEEKDAYS.map((w) => `<span class="cal-week">${w}</span>`).join('')}
      ${cells}
    </div>
    <div class="cal-sum">這個月完成每日挑戰 🏆 ${count} 天</div>
    <div class="streak-box">
      <div class="streak-now">🔥 連續 <b>${streak}</b> 天</div>
      <div class="streak-goals">
        ${STREAK_REWARDS.map((r) => `
          <span class="goal ${rpg.titles.includes(r.title) ? 'got' : ''}">
            ${rpg.titles.includes(r.title) ? '🎖️' : '🔒'} ${r.days} 天・${r.title}<small>+${r.exp}</small>
          </span>`).join('')}
      </div>
      <div class="streak-next">再 ${goal.days - streak} 天：+${goal.exp} 經驗${goal.title ? `・稱號「${goal.title}」` : ''}</div>
    </div>`;

  document.getElementById('calPrev').addEventListener('click', () => renderStampCard(monthOffset - 1));
  document.getElementById('calNext').addEventListener('click', () => renderStampCard(monthOffset + 1));
}

function closeStampCard() {
  stampOverlay.classList.add('hidden');
  if (rpgUi.screen === 'map' && !document.getElementById('rpgView').classList.contains('hidden')) renderMap();
  if (!qel.setup.classList.contains('hidden')) renderTaskSlot();
}

document.getElementById('closeStamps').addEventListener('click', closeStampCard);
stampOverlay.addEventListener('click', (e) => {
  if (e.target === stampOverlay) closeStampCard();
});
