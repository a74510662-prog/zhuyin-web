const API_BASE = 'https://api.taiwanmandarin.com';
const CACHE_KEY = 'zhuyin_char_cache_v2'; // v2：擴充到 TOCFL 基礎一（362 字）
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const LEARNED_KEY = 'zhuyin_learned_chars';
const WORD_CACHE_KEY = 'zhuyin_word_bopomofo_v3';
const GROUP_SIZE = 10;
// TOCFL 分級，依序載入；每一級自己分組，組別不跨級
const LEVELS = [
  { slug: 'novice-1', name: '入門一' },
  { slug: 'novice-2', name: '入門二' },
  { slug: 'level-1', name: '基礎一' },
];

// API 主要讀音有誤的字，改成台灣課本讀音（API 有備用讀音但放錯順序）
// 不適合小朋友的例詞，不顯示
const BLOCKED_WORDS = new Set(['他媽的', '安非他命']);

const READING_FIX = {
  '姊': { bopomofo: 'ㄐㄧㄝˇ', pinyin: 'jiě' },
  '長': { bopomofo: 'ㄔㄤˊ', pinyin: 'cháng' }, // API 主要給 ㄓㄤˇ；單獨認字時 ㄔㄤˊ（長短）較基本
};

const state = {
  chars: [],
  groups: [],
  groupLevel: [], // 每一組屬於哪一級（LEVELS 的索引）
  activeGroup: 0,
  learned: new Set(JSON.parse(localStorage.getItem(LEARNED_KEY) || '[]')),
  detailCache: new Map(),
  wordBopomofo: new Map(Object.entries(JSON.parse(localStorage.getItem(WORD_CACHE_KEY) || '{}'))),
};

const el = {
  loading: document.getElementById('loading'),
  error: document.getElementById('error'),
  groupNav: document.getElementById('groupNav'),
  progressWrap: document.getElementById('progressBar'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  cardGrid: document.getElementById('cardGrid'),
  todayBar: document.getElementById('todayBar'),
  detailTodayNote: document.getElementById('detailTodayNote'),
  overlay: document.getElementById('detailOverlay'),
  detailChar: document.getElementById('detailChar'),
  detailBopomofo: document.getElementById('detailBopomofo'),
  detailPinyin: document.getElementById('detailPinyin'),
  detailExamples: document.getElementById('detailExamples'),
  speakBtn: document.getElementById('speakBtn'),
  learnedToggle: document.getElementById('learnedToggle'),
  closeDetail: document.getElementById('closeDetail'),
};

let activeChar = null;

async function loadChars() {
  const cached = readCache();
  if (cached) {
    state.chars = cached;
    onDataReady();
    return;
  }

  try {
    const perLevel = await Promise.all(LEVELS.map(async ({ slug }, level) => {
      const res = await fetch(`${API_BASE}/tocfl/${slug}?kind=char&pageSize=200`);
      if (!res.ok) throw new Error(`API 回應錯誤 (${res.status})`);
      const data = await res.json();
      return (data.results || []).sort((a, b) => a.taiwan_rank - b.taiwan_rank).map((c) => ({ ...c, level }));
    }));
    const results = perLevel.flat();
    if (results.length === 0) throw new Error('沒有取得任何資料');
    state.chars = results;
    writeCache(results);
    onDataReady();
  } catch (err) {
    showError(`無法載入資料：${err.message}。請檢查網路連線後重新整理頁面。`);
  }
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.time > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), data }));
  } catch {
    // storage full or unavailable, ignore
  }
}

function showError(msg) {
  el.loading.classList.add('hidden');
  el.error.textContent = msg;
  el.error.classList.remove('hidden');
}

function onDataReady() {
  // 快取裡可能是修正前的資料，所以每次載入都套用
  state.chars = state.chars.map((c) => (READING_FIX[c.char] ? { ...c, ...READING_FIX[c.char] } : c));
  el.loading.classList.add('hidden');
  state.groups = [];
  state.groupLevel = [];
  LEVELS.forEach((_, level) => {
    chunk(state.chars.filter((c) => c.level === level), GROUP_SIZE).forEach((g) => {
      state.groups.push(g);
      state.groupLevel.push(level);
    });
  });
  renderGroupNav();
  el.groupNav.classList.remove('hidden');
  el.progressWrap.classList.remove('hidden');
  el.todayBar.classList.remove('hidden');
  document.getElementById('modeTabs').classList.remove('hidden');
  selectGroup(0);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const firstGroupOfLevel = (level) => state.groupLevel.indexOf(level);

// 「入門一 第 3 組」這種名稱；組號在每一級裡從 1 開始
function groupLabel(idx, withLevel = true) {
  const level = state.groupLevel[idx];
  const n = idx - firstGroupOfLevel(level) + 1;
  return withLevel ? `${LEVELS[level].name} 第 ${n} 組` : `第 ${n} 組`;
}

// 分級分頁的 HTML（學習頁、測驗頁的選組都用）；按下去會切到該級第一組
function levelTabsHtml() {
  const current = state.groupLevel[state.activeGroup];
  return LEVELS.map((L, i) => {
    const chars = state.chars.filter((c) => c.level === i);
    const learned = chars.filter((c) => state.learned.has(c.char)).length;
    return `<button class="level-tab ${i === current ? 'active' : ''}" data-level="${i}">${L.name}<small>${learned}/${chars.length}</small></button>`;
  }).join('');
}

function renderGroupNav() {
  const level = state.groupLevel[state.activeGroup];
  el.groupNav.innerHTML = `<div class="level-tabs">${levelTabsHtml()}</div>`;
  el.groupNav.querySelectorAll('[data-level]').forEach((b) => {
    b.addEventListener('click', () => selectGroup(firstGroupOfLevel(Number(b.dataset.level))));
  });
  state.groups.forEach((group, idx) => {
    if (state.groupLevel[idx] !== level) return;
    const btn = document.createElement('button');
    btn.className = 'group-btn' + (idx === state.activeGroup ? ' active' : '');
    const learnedCount = group.filter((c) => state.learned.has(c.char)).length;
    btn.innerHTML = `${groupLabel(idx, false)} <span class="badge">${learnedCount}/${group.length}</span>`;
    btn.addEventListener('click', () => selectGroup(idx));
    el.groupNav.appendChild(btn);
  });
}

function selectGroup(idx) {
  state.activeGroup = idx;
  renderGroupNav();
  renderTodayBar();
  renderCardGrid();
  updateProgress();
}

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';

function renderCardGrid() {
  const group = state.groups[state.activeGroup] || [];
  const today = studyToday().chars; // mystery.js
  el.cardGrid.innerHTML = '';
  group.forEach((item) => {
    const card = document.createElement('div');
    const isLearned = state.learned.has(item.char);
    const todayIdx = today.indexOf(item.char);
    card.className = 'char-card' + (isLearned ? ' learned' : '') + (todayIdx >= 0 ? ' today' : '');
    card.innerHTML = `
      ${todayIdx >= 0 ? `<span class="today-badge">今日 ${CIRCLED[todayIdx]}</span>` : ''}
      ${isLearned ? '<span class="star">⭐</span>' : ''}
      <div class="big-char">${item.char}</div>
      <div class="bopomofo-hint">${item.bopomofo || ''}</div>
    `;
    card.addEventListener('click', () => openDetail(item));
    el.cardGrid.appendChild(card);
  });
}

// 學習頁上方「今天的字 x/10」；學滿後提示去測驗頁做每日任務
function renderTodayBar() {
  const chars = studyToday().chars;
  const n = chars.length;
  const full = n >= STUDY_DAILY_LIMIT; // rpg.js
  el.todayBar.classList.toggle('full', full);
  el.todayBar.innerHTML = `
    <div class="today-head">
      ${full
        ? `<span>✅ 今天的 ${STUDY_DAILY_LIMIT} 個字學完了！</span><button class="today-go" id="todayGoQuiz">去測驗做任務 ✏️</button>`
        : `<span>📖 今天的字 <b>${n}</b>/${STUDY_DAILY_LIMIT}</span><span class="today-tip">打開字卡就算學一個字</span>`}
    </div>
    ${full ? '' : `<div class="today-track"><div class="today-fill" style="width:${(n / STUDY_DAILY_LIMIT) * 100}%"></div></div>`}
    ${n ? `<div class="today-chars">${chars.map((c, i) => `<span>${CIRCLED[i]}${c}</span>`).join('')}</div>` : ''}`;
  const go = document.getElementById('todayGoQuiz');
  if (go) go.addEventListener('click', () => switchMode('quiz'));
}

function updateProgress() {
  const total = state.chars.length;
  const learnedTotal = state.chars.filter((c) => state.learned.has(c.char)).length;
  const pct = total ? Math.round((learnedTotal / total) * 100) : 0;
  el.progressFill.style.width = pct + '%';
  el.progressText.textContent = `${learnedTotal} / ${total} 字 (${pct}%)`;
}

async function openDetail(item) {
  activeChar = item;
  el.detailChar.textContent = item.char;
  el.detailBopomofo.textContent = item.bopomofo || '';
  el.detailPinyin.textContent = item.pinyin || '';

  const isLearned = state.learned.has(item.char);
  el.learnedToggle.textContent = isLearned ? '已學會 ✅' : '我學會了 ⭐';
  el.learnedToggle.classList.toggle('active', isLearned);

  el.overlay.classList.remove('hidden');
  el.detailExamples.innerHTML = '<span>載入中...</span>';
  rewardStudy(item.char); // 打開字卡＝學了這個字（每日學習經驗、神秘小關卡，rpg.js）
  showTodayNote(item.char);
  renderCardGrid();
  renderTodayBar();

  const examples = await fetchExampleWords(item.char);
  if (activeChar !== item) return; // user moved to a different card while loading

  const bopomofos = await Promise.all(examples.map(fetchWordBopomofo));
  if (activeChar !== item) return;

  renderExamples(examples, bopomofos);
}

// 字卡上說明這個字是不是「今天的字」
function showTodayNote(char) {
  const today = studyToday().chars;
  const idx = today.indexOf(char);
  let note = '';
  if (idx >= 0) note = `📖 今天的第 ${idx + 1} 個字`;
  else if (today.length >= STUDY_DAILY_LIMIT) note = `今天的 ${STUDY_DAILY_LIMIT} 個字已經學滿，這個字不算任務喔（可以複習）`;
  el.detailTodayNote.textContent = note;
  el.detailTodayNote.classList.toggle('hidden', !note);
  el.detailTodayNote.classList.toggle('extra', idx < 0);
}

function renderExamples(examples, bopomofos = []) {
  el.detailExamples.innerHTML = '';
  if (examples.length === 0) {
    el.detailExamples.innerHTML = '<span class="example-list">（暫無例詞）</span>';
    return;
  }
  examples.forEach((w, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'example-chip';
    chip.title = '點我唸唸看';
    chip.innerHTML = '<span class="chip-icon">🔊</span>' + zhuyinWordHtml(w, bopomofos[i]);
    chip.addEventListener('click', () => speak(w));
    el.detailExamples.appendChild(chip);
  });
}

const TONE_MARKS = 'ˊˇˋ';

// 把一個字的注音排成直式：符號由上往下，二三四聲調號放右邊，輕聲˙放最上面
function zhuyinColumnHtml(syllable) {
  let symbols = '';
  let tone = '';
  let light = false;
  for (const ch of syllable) {
    if (TONE_MARKS.includes(ch)) tone = ch;
    else if (ch === '˙') light = true;
    else symbols += `<span>${ch}</span>`;
  }
  return `<span class="zy-col">${light ? '<span class="zy-light">˙</span>' : ''}${symbols}${tone ? `<span class="zy-tone">${tone}</span>` : ''}</span>`;
}

// 詞裡的字若在 READING_FIX，也換成正確讀音；原本是輕聲就保留輕聲（如 姊姊 ㄐㄧㄝˇ ˙ㄐㄧㄝ）
function fixSyllable(char, syllable) {
  const fix = READING_FIX[char];
  if (!fix) return syllable;
  if (syllable.startsWith('˙')) return '˙' + fix.bopomofo.replace(/[ˊˇˋ]/g, '');
  return fix.bopomofo;
}

function zhuyinWordHtml(word, bopomofo) {
  const chars = [...word];
  const syllables = bopomofo ? bopomofo.trim().split(/\s+/) : [];
  const matched = syllables.length === chars.length;
  return chars
    .map((c, i) => `<span class="zy-char"><span class="zy-han">${c}</span>${matched ? zhuyinColumnHtml(fixSyllable(c, syllables[i])) : ''}</span>`)
    .join('');
}

// ---- 拼音轉注音（API 缺注音時的備援） ----
const PY_TONED = { ā: 'a1', á: 'a2', ǎ: 'a3', à: 'a4', ē: 'e1', é: 'e2', ě: 'e3', è: 'e4',
  ī: 'i1', í: 'i2', ǐ: 'i3', ì: 'i4', ō: 'o1', ó: 'o2', ǒ: 'o3', ò: 'o4',
  ū: 'u1', ú: 'u2', ǔ: 'u3', ù: 'u4', ǖ: 'ü1', ǘ: 'ü2', ǚ: 'ü3', ǜ: 'ü4' };
const PY_INITIALS = { b: 'ㄅ', p: 'ㄆ', m: 'ㄇ', f: 'ㄈ', d: 'ㄉ', t: 'ㄊ', n: 'ㄋ', l: 'ㄌ',
  g: 'ㄍ', k: 'ㄎ', h: 'ㄏ', j: 'ㄐ', q: 'ㄑ', x: 'ㄒ', zh: 'ㄓ', ch: 'ㄔ', sh: 'ㄕ', r: 'ㄖ',
  z: 'ㄗ', c: 'ㄘ', s: 'ㄙ' };
const PY_FINALS = { a: 'ㄚ', o: 'ㄛ', e: 'ㄜ', ê: 'ㄝ', ai: 'ㄞ', ei: 'ㄟ', ao: 'ㄠ', ou: 'ㄡ',
  an: 'ㄢ', en: 'ㄣ', ang: 'ㄤ', eng: 'ㄥ', ong: 'ㄨㄥ', er: 'ㄦ',
  i: 'ㄧ', ia: 'ㄧㄚ', ie: 'ㄧㄝ', iao: 'ㄧㄠ', iu: 'ㄧㄡ', iou: 'ㄧㄡ', ian: 'ㄧㄢ', in: 'ㄧㄣ',
  iang: 'ㄧㄤ', ing: 'ㄧㄥ', iong: 'ㄩㄥ',
  u: 'ㄨ', ua: 'ㄨㄚ', uo: 'ㄨㄛ', uai: 'ㄨㄞ', ui: 'ㄨㄟ', uei: 'ㄨㄟ', uan: 'ㄨㄢ', un: 'ㄨㄣ',
  uen: 'ㄨㄣ', uang: 'ㄨㄤ', ueng: 'ㄨㄥ',
  ü: 'ㄩ', üe: 'ㄩㄝ', üan: 'ㄩㄢ', ün: 'ㄩㄣ' };

// 把帶聲調的拼音拆成 { base: 無調號字串, tone: 1-5 }；逐字對應，長度不變
function splitPinyinTone(py) {
  let base = '';
  let tone = 5;
  for (const ch of py.toLowerCase().replace(/v/g, 'ü')) {
    const t = PY_TONED[ch];
    if (t) { base += t[0]; tone = Number(t[1]); } else base += ch;
  }
  return { base, tone };
}

function pinyinSyllableToBopomofo(py) {
  const { base, tone } = splitPinyinTone(py);
  let rest = base;
  let initial = '';
  const ini = ['zh', 'ch', 'sh', ...Object.keys(PY_INITIALS)].find((k) => rest.startsWith(k));
  if (ini) { initial = PY_INITIALS[ini]; rest = rest.slice(ini.length); }
  else if (rest.startsWith('yu')) rest = 'ü' + rest.slice(2);
  else if (rest.startsWith('yi')) rest = rest.slice(1);
  else if (rest.startsWith('y')) rest = 'i' + rest.slice(1);
  else if (rest.startsWith('wu')) rest = rest.slice(1);
  else if (rest.startsWith('w')) rest = 'u' + rest.slice(1);

  if ('jqx'.includes(ini || '-') && rest.startsWith('u')) rest = 'ü' + rest.slice(1);
  let final;
  if (rest === 'i' && ['zh', 'ch', 'sh', 'r', 'z', 'c', 's'].includes(ini)) final = '';
  else final = PY_FINALS[rest];
  if (final === undefined || !(initial + final)) return null;

  const body = initial + final;
  return tone === 5 ? '˙' + body : body + ['', '', 'ˊ', 'ˇ', 'ˋ'][tone];
}

// 用每個字的讀音清單把整個詞的拼音（如 "mùdì"）切成一個字一個音節
function pinyinWordToBopomofo(data) {
  // API 的 characters 會把重複的字合併（如「謝謝」只給一個），所以依詞本身逐字查
  const byChar = new Map((data.characters || []).map((c) => [c.char, c]));
  const chars = [...(data.word || '')].map((c) => byChar.get(c));
  if (!data.pinyin || chars.length === 0 || chars.some((c) => !c)) return null;
  // 「jiějie/jiě」這種有兩種唸法的，取第一種
  const full = data.pinyin.split('/')[0].toLowerCase().replace(/[\s'’()-]/g, '');
  const fullBase = splitPinyinTone(full).base;
  const plain = (s) => splitPinyinTone(s).base.replace(/[1-5]/g, '');

  const walk = (ci, pos) => {
    if (ci === chars.length) return pos === full.length ? [] : null;
    const readings = [...new Set((chars[ci].pinyin_readings || [chars[ci].pinyin]).filter(Boolean).map(plain))]
      .sort((a, b) => b.length - a.length);
    for (const r of readings) {
      if (!fullBase.startsWith(r, pos)) continue;
      const rest = walk(ci + 1, pos + r.length);
      if (rest) return [full.slice(pos, pos + r.length), ...rest];
    }
    return null;
  };

  const syllables = walk(0, 0);
  if (!syllables) return null;
  const bopo = syllables.map(pinyinSyllableToBopomofo);
  return bopo.every(Boolean) ? bopo.join(' ') : null;
}

async function fetchWordBopomofo(word) {
  if (state.wordBopomofo.has(word)) return state.wordBopomofo.get(word);
  try {
    const res = await fetch(`${API_BASE}/words/${encodeURIComponent(word)}`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    // 有些詞 API 沒給注音（bopomofo: null），改用拼音自己轉
    const bopomofo = data.bopomofo || pinyinWordToBopomofo(data) || '';
    state.wordBopomofo.set(word, bopomofo);
    localStorage.setItem(WORD_CACHE_KEY, JSON.stringify(Object.fromEntries(state.wordBopomofo)));
    return bopomofo;
  } catch (err) {
    return '';
  }
}

async function fetchExampleWords(char) {
  if (state.detailCache.has(char)) {
    return state.detailCache.get(char);
  }
  try {
    const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(char)}`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    const examples = Array.isArray(data.example_words) ? data.example_words.slice(0, 8).filter((w) => !BLOCKED_WORDS.has(w)) : [];
    state.detailCache.set(char, examples);
    return examples;
  } catch (err) {
    return [];
  }
}

function closeDetail() {
  el.overlay.classList.add('hidden');
  stopSpeaking();
  activeChar = null;
  onDetailClosed(); // 神秘小關卡：關掉字卡時若有等著的關卡就立刻跳出（mystery.js）
}

// 雲哲事先錄好的字和詞（tools/make_voices.py 產生）；沒錄到的才用瀏覽器語音
let voiceClips = new Set();
fetch('voice/index.json')
  .then((res) => (res.ok ? res.json() : []))
  .then((list) => { voiceClips = new Set(list); })
  .catch(() => {});
let currentClip = null;

function stopSpeaking() {
  if (currentClip) {
    currentClip.pause();
    currentClip = null;
    bgmDuck(false);
  }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

function speak(text) {
  stopSpeaking();
  if (!voiceClips.has(text)) {
    speakTts(text);
    return;
  }
  const clip = new Audio(`voice/${encodeURIComponent(text)}.mp3`);
  currentClip = clip;
  let finished = false;
  const finish = (failed) => {
    if (finished || currentClip !== clip) return;
    finished = true;
    currentClip = null;
    bgmDuck(false);
    if (failed) speakTts(text);
  };
  clip.onended = () => finish(false);
  clip.onerror = () => finish(true);
  bgmDuck(true); // 唸字時背景音樂調小（music.js）
  clip.play().catch(() => finish(true));
}

function speakTts(text) {
  if (!('speechSynthesis' in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-TW';
  utter.rate = 0.8;
  // 唸字時背景音樂調小（music.js）
  utter.onstart = () => bgmDuck(true);
  utter.onend = () => bgmDuck(false);
  utter.onerror = () => bgmDuck(false);
  speechSynthesis.speak(utter);
}

function speakActiveChar() {
  if (activeChar) speak(activeChar.char);
}

// 按下「我學會了」：叮咚音效＋說「你好棒！」＋按鈕跳一下
function cheerLearned() {
  playChime(); // music.js
  setTimeout(() => playVoice('sounds/great.mp3', '你好棒！'), 350); // music.js
  el.learnedToggle.classList.remove('cheer');
  void el.learnedToggle.offsetWidth; // restart animation
  el.learnedToggle.classList.add('cheer');
}

function toggleLearned() {
  if (!activeChar) return;
  const char = activeChar.char;
  if (state.learned.has(char)) {
    state.learned.delete(char);
  } else {
    state.learned.add(char);
  }
  localStorage.setItem(LEARNED_KEY, JSON.stringify([...state.learned]));

  const isLearned = state.learned.has(char);
  if (isLearned) {
    rewardLearned(char);
    cheerLearned();
  }
  el.learnedToggle.textContent = isLearned ? '已學會 ✅' : '我學會了 ⭐';
  el.learnedToggle.classList.toggle('active', isLearned);

  renderGroupNav();
  renderCardGrid();
  updateProgress();
}

el.closeDetail.addEventListener('click', closeDetail);
el.overlay.addEventListener('click', (e) => {
  if (e.target === el.overlay) closeDetail();
});
el.speakBtn.addEventListener('click', speakActiveChar);
el.learnedToggle.addEventListener('click', toggleLearned);

// 等所有 script（rpg.js、mystery.js…）都載入後再開始，畫字卡時會用到它們
document.addEventListener('DOMContentLoaded', loadChars);
