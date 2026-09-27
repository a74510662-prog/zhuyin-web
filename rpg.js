// 冒險模式：拯救注音小怪獸（樣本）。
// Relies on globals: state, speak, openDetail (app.js); shuffle, pickRandom, buildDistractors, CHEERS, AUTO_NEXT_MS (quiz.js).
const RPG_KEY = 'zhuyin_rpg_v1';
const RPG_QUESTIONS = 10;
const MAX_LEVEL = 50;
const ASK_LIMIT = 3;
const EXP_PER_CORRECT = 10;
const EXTRA_EXP_RATE = 1 / 3; // 今日任務做完後繼續打怪
const BOSS_FIRST_CLEAR_EXP = 50;
const BADGE_EXP = 300;
const STUDY_EXP = 2; // 學習頁：打開字卡
const STUDY_DAILY_LIMIT = 10; // 今天的字（每日任務出題用）；之後打開的算自主學習，經驗不限
const LEARNED_EXP = 5; // 第一次按「我學會了」
const Q_TYPES = ['char2bpmf', 'bpmf2char', 'listen'];

// 使用者自己畫的怪獸圖放 monsters/<拼音>.png，沒有圖就用程式畫的暫代圖
const ZHUYIN_FILE = {
  'ㄅ': 'b', 'ㄆ': 'p', 'ㄇ': 'm', 'ㄈ': 'f', 'ㄉ': 'd', 'ㄊ': 't', 'ㄋ': 'n', 'ㄌ': 'l',
  'ㄍ': 'g', 'ㄎ': 'k', 'ㄏ': 'h', 'ㄐ': 'j', 'ㄑ': 'q', 'ㄒ': 'x', 'ㄓ': 'zh', 'ㄔ': 'ch',
  'ㄕ': 'sh', 'ㄖ': 'r', 'ㄗ': 'z', 'ㄘ': 'c', 'ㄙ': 's', 'ㄚ': 'a', 'ㄛ': 'o', 'ㄜ': 'e',
  'ㄝ': 'eh', 'ㄞ': 'ai', 'ㄟ': 'ei', 'ㄠ': 'ao', 'ㄡ': 'ou', 'ㄢ': 'an', 'ㄣ': 'en', 'ㄤ': 'ang',
  'ㄥ': 'eng', 'ㄦ': 'er', 'ㄧ': 'i', 'ㄨ': 'u', 'ㄩ': 'yu',
};

const ISLANDS = [
  { id: 'forest', name: '森林', icon: '🌲', color: '#58a55c',
    castles: [['ㄙ', '森林'], ['ㄒ', '熊'], ['ㄊ', '兔子'], ['ㄍ', '蘑菇'], ['ㄠ', '貓頭鷹']],
    guards: [['🐗', '山豬'], ['🦇', '蝙蝠'], ['🕷️', '大蜘蛛'], ['🐍', '毒蛇'], ['🦊', '狐狸']],
    boss: ['🐺', '星夜斗篷怪', 'bosses/forest.png'] },
  { id: 'volcano', name: '火山', icon: '🌋', color: '#e0643c',
    castles: [['ㄏ', '火'], ['ㄖ', '熱'], ['ㄕ', '山'], ['ㄉ', '地震'], ['ㄧ', '岩漿']],
    guards: [['🦎', '火蜥蜴'], ['🦂', '蠍子'], ['🪨', '石頭怪'], ['🔥', '火焰精'], ['🦖', '暴龍']],
    boss: ['🐉', '煤球燈籠怪', 'bosses/volcano.png'] },
  { id: 'beach', name: '海邊', icon: '🏖️', color: '#f0a830',
    castles: [['ㄅ', '貝殼'], ['ㄆ', '螃蟹'], ['ㄌ', '浪花'], ['ㄢ', '海岸'], ['ㄤ', '太陽']],
    guards: [['🐊', '鱷魚'], ['🪼', '水母'], ['🦅', '老鷹'], ['🦞', '龍蝦'], ['🐍', '海蛇']],
    boss: ['🏴‍☠️', '浪花水龍', 'bosses/beach.png'] },
  { id: 'sea', name: '海底', icon: '🌊', color: '#3a8fd6',
    castles: [['ㄩ', '魚'], ['ㄓ', '章魚'], ['ㄐ', '鯨魚'], ['ㄑ', '潛水'], ['ㄨ', '烏龜']],
    guards: [['🦈', '鯊魚'], ['🐡', '河豚'], ['⚓', '鐵錨怪'], ['🦀', '巨蟹'], ['🌀', '漩渦怪']],
    boss: ['🦑', '泡泡章魚王', 'bosses/sea.png'] },
  { id: 'plain', name: '平原', icon: '🌾', color: '#9bbf3a',
    castles: [['ㄋ', '牛'], ['ㄇ', '馬'], ['ㄈ', '風'], ['ㄘ', '草'], ['ㄥ', '平原']],
    guards: [['🐀', '大老鼠'], ['🦗', '蝗蟲'], ['🐃', '野牛'], ['🦅', '禿鷹'], ['🐍', '草蛇']],
    boss: ['🌪️', '粉紅毛毛怪', 'bosses/plain.png'] },
  { id: 'lab', name: '實驗室', icon: '🧪', color: '#8a63d2',
    castles: [['ㄎ', '科學'], ['ㄔ', '秤'], ['ㄝ', '液體'], ['ㄞ', '哎呀']],
    guards: [['🦠', '細菌怪'], ['👾', '外星怪'], ['🧟', '殭屍'], ['💣', '炸彈怪']],
    boss: ['🤖', '時鐘幽靈', 'bosses/lab.png'] },
  { id: 'school', name: '學校', icon: '🏫', color: '#e05d8c',
    castles: [['ㄗ', '寫字'], ['ㄦ', '兒童'], ['ㄟ', '黑板'], ['ㄚ', '回答']],
    guards: [['📚', '書本怪'], ['✏️', '鉛筆怪'], ['🧹', '掃把怪'], ['⏰', '鬧鐘怪']],
    boss: ['👻', '墨水怪', 'bosses/school.png'] },
  { id: 'park', name: '公園', icon: '🎡', color: '#2fb5a3',
    castles: [['ㄜ', '鵝'], ['ㄡ', '溜滑梯'], ['ㄣ', '噴水池'], ['ㄛ', '伯伯']],
    guards: [['🐝', '虎頭蜂'], ['🐜', '螞蟻兵'], ['🦟', '大蚊子'], ['🐌', '蝸牛怪']],
    boss: ['🤡', '青蛙國王', 'bosses/park.png'] },
];
const FINAL_BOSS = ['😈', '大魔王'];
const TOTAL_MONSTERS = ISLANDS.reduce((n, is) => n + is.castles.length, 0);
const SYMBOL_COLOR = Object.fromEntries(ISLANDS.flatMap((is) => is.castles.map(([s]) => [s, is.color])));

// ---------- save data ----------

function defaultRpg() {
  return { exp: 0, stars: {}, friends: [], team: [], badges: [],
    task: { date: '' }, stamps: {}, titles: [], weak: {},
    study: { date: '', chars: [], extra: [] }, learnedRewarded: [], seen: null, groupDay: null };
}

function loadRpg() {
  try {
    return Object.assign(defaultRpg(), JSON.parse(localStorage.getItem(RPG_KEY) || '{}'));
  } catch {
    return defaultRpg();
  }
}

function saveRpg() {
  try {
    localStorage.setItem(RPG_KEY, JSON.stringify(rpg));
  } catch {
    // storage full or unavailable, ignore
  }
}

let rpg = loadRpg();
// seen＝打開過的字（決定單字組照順序開啟）；舊存檔用學會的字、今天學的字補上
if (!Array.isArray(rpg.seen)) {
  rpg.seen = [...new Set([...state.learned, ...rpg.learnedRewarded, ...(rpg.study.chars || [])])];
  saveRpg();
}

// ---------- level / perks ----------

// 每級所需經驗遞增；Lv1→Lv50 共 13720 經驗。每天任務＋學習＋神秘關卡＋獎勵約 150～200，
// 大約一學期（90 個上學日左右）練滿
function expToNext(lv) {
  return 80 + lv * 8;
}

function levelInfo(exp) {
  let lv = 1;
  let rest = exp;
  while (lv < MAX_LEVEL && rest >= expToNext(lv)) {
    rest -= expToNext(lv);
    lv++;
  }
  return { lv, rest, need: lv < MAX_LEVEL ? expToNext(lv) : 0 };
}

const teamSize = (lv) => (lv >= 35 ? 4 : lv >= 20 ? 3 : lv >= 8 ? 2 : 1);
const retryCount = (lv) => Math.min(5, Math.floor(lv / 10));
const currentLevel = () => levelInfo(rpg.exp).lv;

function todayStr() {
  return new Date().toLocaleDateString('sv'); // YYYY-MM-DD
}

function studyCount() {
  return rpg.study.date === todayStr() ? rpg.study.chars.length : 0;
}

// ---------- 學習頁的經驗（app.js 呼叫） ----------

function gainStudyExp(exp, message) {
  const before = currentLevel();
  rpg.exp += exp;
  const after = currentLevel();
  if (after > before) fillTeam();
  saveRpg();
  showToast(`+${exp} 經驗　${message}${after > before ? `<br>🎉 升級了！Lv${after}` : ''}`);
}

function rewardStudy(char) {
  const today = todayStr();
  if (rpg.study.date !== today) rpg.study = { date: today, chars: [], extra: [], bonus: [] };
  if (!rpg.study.extra) rpg.study.extra = [];
  const unlockedBefore = unlockedUntil(); // app.js
  if (!rpg.seen.includes(char)) rpg.seen.push(char);
  const unlocked = unlockedUntil() > unlockedBefore ? `🔓 ${groupLabel(unlockedUntil())} 開放了！` : '';
  if (rpg.study.chars.includes(char) || rpg.study.extra.includes(char)) {
    saveRpg();
    if (unlocked) showToast(unlocked);
    return;
  }
  // 前 10 個＝今天的字；之後＝自主學習，一樣 +2 經驗、不設上限
  let message;
  if (rpg.study.chars.length < STUDY_DAILY_LIMIT) {
    rpg.study.chars.push(char);
    const n = rpg.study.chars.length;
    message = `📖 今日學習 ${n}/${STUDY_DAILY_LIMIT}${n === STUDY_DAILY_LIMIT ? ' ✅' : ''}${mysteryOnStudy(n)}`;
  } else {
    rpg.study.extra.push(char);
    const m = rpg.study.extra.length;
    message = `🚀 自主學習第 ${m} 個字${mysteryOnStudy(STUDY_DAILY_LIMIT + m)}`;
  }
  gainStudyExp(STUDY_EXP, message + (unlocked ? `<br>${unlocked}` : ''));
}

function rewardLearned(char) {
  if (rpg.learnedRewarded.includes(char)) return;
  rpg.learnedRewarded.push(char);
  gainStudyExp(LEARNED_EXP, `⭐ 學會「${char}」了！`);
}

let toastTimer = null;
function showToast(html) {
  let toast = document.getElementById('expToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'expToast';
    toast.className = 'exp-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = html;
  toast.classList.remove('show');
  void toast.offsetWidth; // restart animation
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function currentTeam() {
  return rpg.team.filter((s) => rpg.friends.includes(s)).slice(0, teamSize(currentLevel()));
}

// 隊伍有空位（剛救出朋友或升級多了位置）時，用最近救出的朋友補上
function fillTeam() {
  const team = currentTeam();
  const spare = rpg.friends.slice().reverse().filter((s) => !team.includes(s));
  rpg.team = team.concat(spare).slice(0, teamSize(currentLevel()));
}

// ---------- stages / unlocking ----------

const starsOf = (id) => rpg.stars[id] || 0;
const castleId = (island, i) => `${island.id}-${i + 1}`;
const bossId = (island) => `${island.id}-boss`;

function castleUnlocked(island, i) {
  return i === 0 || starsOf(castleId(island, i - 1)) >= 1;
}

function bossProgress(island) {
  return island.castles.reduce((sum, _, i) => sum + Math.min(2, starsOf(castleId(island, i))), 0);
}

function bossUnlocked(island) {
  return island.castles.every((_, i) => starsOf(castleId(island, i)) >= 2);
}

function islandStars(island) {
  return island.castles.reduce((sum, _, i) => sum + starsOf(castleId(island, i)), 0) + starsOf(bossId(island));
}

function islandFull(island) {
  return islandStars(island) === (island.castles.length + 1) * 3;
}

const bossesBeaten = () => ISLANDS.filter((is) => starsOf(bossId(is)) >= 1).length;
const finalUnlocked = () => bossesBeaten() === ISLANDS.length;

function castleStage(island, i) {
  return { kind: 'castle', island, id: castleId(island, i), label: `${island.name}${i + 1}`,
    foe: island.guards[i], captive: island.castles[i][0] };
}

function bossStage(island) {
  return { kind: 'boss', island, id: bossId(island), label: `${island.name}BOSS`, foe: island.boss, captive: null };
}

function finalStage() {
  return { kind: 'final', island: null, id: 'final', label: '魔王城', foe: FINAL_BOSS, captive: null };
}

// ---------- shared html ----------

function monsterHtml(sym, size = '') {
  const file = ZHUYIN_FILE[sym];
  return `<div class="monster ${size}" style="--mc:${SYMBOL_COLOR[sym] || '#999'}">`
    + '<span class="m-eyes"></span>'
    + `<span class="m-sym">${sym}</span>`
    + `<img src="monsters/${file}.png" alt="" onload="this.parentNode.classList.add('has-img')" onerror="this.remove()">`
    + '</div>';
}

// 敵人（守衛／BOSS）：有畫好的圖就用圖，圖載入失敗就退回 emoji
function foeHtml([icon, , img], cls = '') {
  if (!img) return icon;
  return `<img class="foe-img ${cls}" src="${img}" alt="" onerror="this.replaceWith('${icon}')">`;
}

function starStr(n) {
  return '⭐'.repeat(n) + '☆'.repeat(3 - n);
}

function hudHtml() {
  const { lv, rest, need } = levelInfo(rpg.exp);
  const retry = retryCount(lv);
  const pct = need ? Math.floor((rest / need) * 100) : 100;
  return `
    <div class="rpg-hud">
      <div class="hud-lv">Lv<b>${lv}</b></div>
      <div class="hud-exp">
        <div class="exp-track"><div class="exp-fill" style="width:${pct}%"></div></div>
        <span>${need ? `經驗 ${Math.floor(rest)} / ${need}` : '已經滿級！'}</span>
      </div>
      <div class="hud-chips">
        ${taskChipHtml()}
        ${streakChipHtml()}
        <span class="chip ${studyCount() >= STUDY_DAILY_LIMIT ? 'done' : ''}">📖 今日學習 ${studyCount()}/${STUDY_DAILY_LIMIT}${studyCount() >= STUDY_DAILY_LIMIT ? ' ✅' : ''}</span>
        <span class="chip">👥 出戰 ${teamSize(lv)} 隻</span>
        <span class="chip">🔄 重答 ${retry ? `${retry} 次` : 'Lv10 解鎖'}</span>
        <span class="chip">🏅 徽章 ${rpg.badges.length}/${ISLANDS.length}</span>
        ${rpg.titles.length ? `<span class="chip title">🎖️ ${rpg.titles[rpg.titles.length - 1]}</span>` : ''}
      </div>
    </div>`;
}

// ---------- screens ----------

const rpgRoot = document.getElementById('rpgRoot');
const rpgUi = { screen: 'map', island: 0 };

function rpgEnter() {
  if (rpgUi.screen === 'island') renderIsland(rpgUi.island);
  else renderMap();
}

// 切換到其他分頁時放棄進行中的戰鬥
function rpgLeave() {
  clearTimeout(battle.timer);
  if (rpgUi.screen === 'battle' || rpgUi.screen === 'result') {
    rpgUi.screen = battle.stage && battle.stage.island ? 'island' : 'map';
  }
}

function renderMap() {
  rpgUi.screen = 'map';
  const islandCards = ISLANDS.map((is, idx) => {
    const rescued = is.castles.filter(([s]) => rpg.friends.includes(s)).length;
    return `
      <button class="island-card" data-island="${idx}" style="--ic:${is.color}">
        ${rpg.badges.includes(is.id) ? '<span class="ic-badge">🏅</span>' : ''}
        <div class="ic-icon">${is.icon}</div>
        <div class="ic-name">${is.name}</div>
        <div class="ic-stat">⭐ ${islandStars(is)} / ${(is.castles.length + 1) * 3}</div>
        <div class="ic-stat">🧸 救出 ${rescued} / ${is.castles.length}</div>
        ${starsOf(bossId(is)) ? `<div class="ic-boss">${foeHtml(is.boss, 'tiny')} 已打倒</div>` : ''}
      </button>`;
  }).join('');

  const beaten = bossesBeaten();
  rpgRoot.innerHTML = `
    ${hudHtml()}
    ${taskCardHtml('mapTaskBtn')}
    <div class="rpg-actions">
      <button class="big-btn secondary" id="rpgDexBtn">📒 朋友圖鑑 (${rpg.friends.length}/${TOTAL_MONSTERS})</button>
      <button class="big-btn secondary" id="stampBtn">📅 集點卡</button>
    </div>
    <div class="island-grid">
      ${islandCards}
      <button class="island-card final ${finalUnlocked() ? '' : 'locked'}" id="finalCard" ${finalUnlocked() ? '' : 'disabled'}>
        <div class="ic-icon">🏰</div>
        <div class="ic-name">魔王城</div>
        <div class="ic-stat">${finalUnlocked() ? `${FINAL_BOSS[0]} 大魔王在等你！` : `🔒 打倒小魔王 ${beaten}/${ISLANDS.length}`}</div>
        ${starsOf('final') ? `<div class="ic-stat">${starStr(starsOf('final'))}</div>` : ''}
      </button>
    </div>`;

  rpgRoot.querySelectorAll('[data-island]').forEach((b) => {
    b.addEventListener('click', () => renderIsland(Number(b.dataset.island)));
  });
  document.getElementById('finalCard').addEventListener('click', () => startBattle(finalStage()));
  document.getElementById('rpgDexBtn').addEventListener('click', openDex);
  document.getElementById('stampBtn').addEventListener('click', () => openStampCard());
  const taskBtn = document.getElementById('mapTaskBtn');
  if (taskBtn) taskBtn.addEventListener('click', () => switchMode('quiz'));
}

// 島內地圖的場景裝飾（背景顏色在 rpg.css 的 .scene-<id>）
const SCENE_DECOR = {
  forest: ['🌲', '🌳', '🍄', '🌿', '🌲', '🦔', '🌳', '🍂'],
  volcano: ['🪨', '🔥', '🌋', '🪨', '💨', '🔥', '🦴', '🪨'],
  beach: ['🌴', '🐚', '⛱️', '🪣', '🌴', '⭐', '🐚', '🏐'],
  sea: ['🫧', '🐠', '🪸', '🌿', '🫧', '🐟', '🐚', '🪼'],
  plain: ['🌻', '🌾', '🐄', '🌼', '🌾', '🏡', '🌻', '🐑'],
  lab: ['🧪', '⚗️', '🔬', '💡', '🧲', '🖥️', '🧫', '🔭'],
  school: ['📚', '✏️', '🎒', '📐', '🖍️', '🕰️', '🌏', '🎨'],
  park: ['🌳', '🌷', '🎈', '🛝', '⛲', '🦆', '🌳', '🪁'],
};
const MAP_HEIGHT = 380;
const MAP_STEP = 130; // 關卡最小間距 (px)
const MAP_MARGIN = 70;
const NODE_Y = [60, 36, 58, 34, 56, 38]; // 走道上下起伏 (%)

// 固定的偽隨機，讓裝飾位置每次都一樣
const jitter = (n) => {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

function sceneDecorHtml(island, width) {
  const decor = SCENE_DECOR[island.id];
  const count = Math.ceil(width / 64);
  let html = '';
  for (let i = 0; i < count; i++) {
    const top = i % 2 === 0;
    const x = i * 64 + 16 + jitter(i + 1) * 28;
    const y = top ? 4 + jitter(i + 7) * 12 : 80 + jitter(i + 13) * 10;
    const size = 1.5 + jitter(i + 21) * 1;
    html += `<span class="decor" style="left:${x}px;top:${y}%;font-size:${size}rem">${decor[i % decor.length]}</span>`;
  }
  return html;
}

// 平滑的走道：每兩點之間用三次貝茲曲線連起來
function roadPath(points) {
  let d = `M 0 ${points[0].y}`;
  let prev = { x: 0, y: points[0].y };
  points.forEach((p) => {
    const mid = (p.x - prev.x) / 2;
    d += ` C ${prev.x + mid} ${prev.y}, ${p.x - mid} ${p.y}, ${p.x} ${p.y}`;
    prev = p;
  });
  return d;
}

function renderIsland(idx) {
  rpgUi.screen = 'island';
  rpgUi.island = idx;
  const island = ISLANDS[idx];
  const count = island.castles.length + 1;
  // 寬螢幕把關卡拉開填滿；手機則維持最小間距、左右滑動
  const step = Math.max(MAP_STEP, (rpgRoot.clientWidth - MAP_MARGIN * 2) / (count - 1));
  const width = MAP_MARGIN * 2 + step * (count - 1);
  const points = Array.from({ length: count }, (_, i) => ({
    x: MAP_MARGIN + i * step,
    yPct: NODE_Y[i % NODE_Y.length],
    y: (NODE_Y[i % NODE_Y.length] / 100) * MAP_HEIGHT,
  }));

  // 「出發！」標示：第一個開放但還沒過關的關卡
  let current = island.castles.findIndex((_, i) => castleUnlocked(island, i) && !starsOf(castleId(island, i)));
  if (current === -1 && bossUnlocked(island) && !starsOf(bossId(island))) current = count - 1;

  const castleNodes = island.castles.map(([sym], i) => {
    const unlocked = castleUnlocked(island, i);
    const rescued = rpg.friends.includes(sym);
    const stars = starsOf(castleId(island, i));
    return `
      <button class="map-node ${unlocked ? '' : 'locked'} ${stars ? 'cleared' : ''}" data-castle="${i}"
        style="left:${points[i].x}px;top:${points[i].yPct}%" ${unlocked ? '' : 'disabled'}>
        ${i === current ? '<span class="here">出發！</span>' : ''}
        <span class="mn-stop"><span class="${rescued ? '' : 'caged'}">${monsterHtml(sym, 'sm')}</span>${unlocked ? '' : '<span class="mn-lock">🔒</span>'}</span>
        <span class="mn-label">${island.name}${i + 1}</span>
        <span class="mn-stars">${starStr(stars)}</span>
      </button>`;
  }).join('');

  const bossOpen = bossUnlocked(island);
  const b = points[count - 1];
  const bossNode = `
    <button class="map-node boss ${bossOpen ? '' : 'locked'} ${starsOf(bossId(island)) ? 'cleared' : ''}" id="bossNode"
      style="left:${b.x}px;top:${b.yPct}%" ${bossOpen ? '' : 'disabled'}>
      ${current === count - 1 ? '<span class="here">出發！</span>' : ''}
      <span class="mn-stop"><span class="boss-icon">${foeHtml(island.boss)}</span>${bossOpen ? '' : '<span class="mn-lock">🔒</span>'}</span>
      <span class="mn-label">${island.name}BOSS</span>
      <span class="mn-stars">${bossOpen ? starStr(starsOf(bossId(island))) : `2星 ${bossProgress(island)}/${island.castles.length * 2}`}</span>
    </button>`;

  const full = rpg.badges.includes(island.id);
  rpgRoot.innerHTML = `
    ${hudHtml()}
    <div class="rpg-subhead" style="--ic:${island.color}">
      <button class="back-btn" id="rpgBack">⬅ 地圖</button>
      <h2>${island.icon} ${island.name}</h2>
      <span class="sub-stars">⭐ ${islandStars(island)} / ${count * 3}</span>
    </div>
    <div class="island-map" id="islandMap">
      <div class="map-canvas scene-${island.id}" style="width:${width}px;height:${MAP_HEIGHT}px">
        ${sceneDecorHtml(island, width)}
        <svg class="road" width="${width}" height="${MAP_HEIGHT}" aria-hidden="true">
          <path class="road-edge" d="${roadPath(points)}" />
          <path class="road-body" d="${roadPath(points)}" />
          <path class="road-dash" d="${roadPath(points)}" />
        </svg>
        ${castleNodes}${bossNode}
      </div>
    </div>
    <p class="island-tip">${islandHint(island, current)}</p>
    <p class="island-tip">${full ? `🏅 已獲得「${island.name}徽章」！` : `🎁 整座島全部拿到 3 星，可以得到「${island.name}徽章」和 ${BADGE_EXP} 經驗！`}</p>`;

  document.getElementById('rpgBack').addEventListener('click', renderMap);
  rpgRoot.querySelectorAll('[data-castle]').forEach((btn) => {
    btn.addEventListener('click', () => startBattle(castleStage(island, Number(btn.dataset.castle))));
  });
  document.getElementById('bossNode').addEventListener('click', () => startBattle(bossStage(island)));

  // 把地圖捲到「出發！」的關卡
  const map = document.getElementById('islandMap');
  const focusX = points[current === -1 ? 0 : current].x;
  map.scrollLeft = focusX - map.clientWidth / 2;
}

function islandHint(island, current) {
  if (current === -1) {
    if (!bossUnlocked(island)) return `💡 每座城堡都拿到 2 星，BOSS「${island.boss[1]}」就會出現！`;
    return '💡 可以回去挑戰還沒滿星的關卡喔！';
  }
  if (current === island.castles.length) return `👑 BOSS「${island.boss[1]}」出現了！打倒牠！`;
  const [sym] = island.castles[current];
  const [gIcon, gName] = island.guards[current];
  return `🆘 ${sym} 被 ${gIcon}${gName} 抓走了，快去${island.name}${current + 1}救牠！`;
}

// ---------- battle ----------

const battle = {
  stage: null, questions: [], index: 0, score: 0, wrong: [],
  answered: false, retriesLeft: 0, asksLeft: 0, askedThis: false, exp: 0, timer: null,
};

// 這一關要練的注音：城堡＝關在裡面的小怪獸，島 BOSS＝整座島的注音，大魔王＝全部
function stageSymbols(stage) {
  if (stage.kind === 'castle') return [stage.captive];
  if (stage.kind === 'boss') return stage.island.castles.map(([s]) => s);
  return [];
}

const charsWithSymbols = (syms) => state.chars.filter((c) => c.bopomofo && syms.some((s) => c.bopomofo.includes(s)));

// 優先出含這關注音的字；不夠 10 題（如 ㄦ、ㄖ）就用同一座島其他注音的字補，再不夠用全部的字
function buildBattleQuestions(stage) {
  const syms = stageSymbols(stage);
  const pools = syms.length ? [charsWithSymbols(syms)] : [];
  if (stage.island) pools.push(charsWithSymbols(stage.island.castles.map(([s]) => s)));
  pools.push(state.chars.filter((c) => c.bopomofo));
  const picked = [];
  pools.forEach((pool) => {
    shuffle(pool).forEach((c) => {
      if (picked.length < RPG_QUESTIONS && !picked.includes(c)) picked.push(c);
    });
  });
  return shuffle(picked).map((answer) => ({
    answer,
    type: pickRandom(Q_TYPES),
    options: shuffle([answer, ...buildDistractors(answer)]),
  }));
}

function startBattle(stage) {
  clearTimeout(battle.timer);
  Object.assign(battle, {
    stage, questions: buildBattleQuestions(stage), index: 0, score: 0, wrong: [], exp: 0,
    retriesLeft: retryCount(currentLevel()), asksLeft: ASK_LIMIT, levelBefore: currentLevel(),
  });
  rpgUi.screen = 'battle';

  const team = currentTeam();
  const fName = stage.foe[1];
  rpgRoot.innerHTML = `
    <div class="quiz-panel battle">
      <div class="battle-top">
        <button class="back-btn" id="rpgRetreat">🏳️ 撤退</button>
        <span id="bCounter"></span>
      </div>
      <div class="battle-arena">
        <div class="foe">
          <div class="foe-icon" id="foeIcon">${foeHtml(stage.foe)}</div>
          <div class="foe-name">${stage.label}・${fName}</div>
          ${stageSymbols(stage).length ? `<div class="stage-target">🎯 這關練習：${stageSymbols(stage).join(' ')}</div>` : ''}
          <div class="hp-track"><div class="hp-fill" id="foeHp"></div></div>
        </div>
        ${stage.captive ? `<div class="captive"><div class="caged">${monsterHtml(stage.captive, 'sm')}</div><div class="captive-say">救救我！</div></div>` : ''}
      </div>
      <div class="team-row">
        <span class="team-label">我的隊伍</span>
        ${team.length ? team.map((s) => `<div class="team-member" data-sym="${s}">${monsterHtml(s, 'xs')}</div>`).join('') : '<span class="team-empty">還沒有朋友，救出小怪獸就會加入！</span>'}
      </div>
      <div class="friend-bubble hidden" id="friendBubble"></div>
      <div class="quiz-prompt" id="bPrompt"></div>
      <div class="quiz-options" id="bOptions"></div>
      <div class="quiz-feedback" id="bFeedback"></div>
      <div class="battle-tools">
        <button class="tool-btn" id="askBtn">🙋 問朋友 <b id="askLeft"></b></button>
        <span class="tool-chip" id="retryChip"></span>
      </div>
      <button id="bNext" class="big-btn hidden">下一題 ➡️</button>
    </div>`;

  document.getElementById('rpgRetreat').addEventListener('click', retreat);
  document.getElementById('askBtn').addEventListener('click', askFriend);
  document.getElementById('bNext').addEventListener('click', nextBattleQuestion);
  renderBattleQuestion();
}

function retreat() {
  if (!confirm('確定要撤退嗎？這一場不會得到星星喔。')) return;
  clearTimeout(battle.timer);
  saveRpg();
  if (battle.stage.island) renderIsland(ISLANDS.indexOf(battle.stage.island));
  else renderMap();
}

function updateBattleHud() {
  const total = battle.questions.length;
  document.getElementById('bCounter').textContent = `第 ${battle.index + 1} / ${total} 題　⭐ ${battle.score}`;
  document.getElementById('foeHp').style.width = `${((total - battle.score) / total) * 100}%`;
  const askBtn = document.getElementById('askBtn');
  document.getElementById('askLeft').textContent = `${battle.asksLeft}/${ASK_LIMIT}`;
  askBtn.disabled = battle.answered || battle.askedThis || battle.asksLeft <= 0 || currentTeam().length === 0;
  const lv = currentLevel();
  document.getElementById('retryChip').textContent = retryCount(lv)
    ? `🔄 重答剩 ${battle.retriesLeft} 次`
    : '🔄 重答：Lv10 解鎖';
}

function renderBattleQuestion() {
  const q = battle.questions[battle.index];
  battle.answered = false;
  battle.askedThis = false;

  const feedback = document.getElementById('bFeedback');
  feedback.textContent = '';
  feedback.className = 'quiz-feedback';
  document.getElementById('bNext').classList.add('hidden');
  document.getElementById('friendBubble').classList.add('hidden');
  document.querySelectorAll('.team-member').forEach((m) => m.classList.remove('talking'));

  const prompt = document.getElementById('bPrompt');
  if (q.type === 'char2bpmf') {
    prompt.innerHTML = `<div class="prompt-label">這個字怎麼唸？</div><div class="prompt-char">${q.answer.char}</div>`;
  } else if (q.type === 'bpmf2char') {
    prompt.innerHTML = `<div class="prompt-label">哪一個字唸作…</div><div class="prompt-bpmf">${q.answer.bopomofo}</div>`;
  } else {
    prompt.innerHTML = '<div class="prompt-label">聽聽看，是哪一個字？</div>';
    const btn = document.createElement('button');
    btn.className = 'listen-btn';
    btn.textContent = '🔊';
    btn.setAttribute('aria-label', '再聽一次');
    btn.addEventListener('click', () => speak(q.answer.char));
    prompt.appendChild(btn);
    speak(q.answer.char);
  }

  const showBpmf = q.type === 'char2bpmf';
  const options = document.getElementById('bOptions');
  options.innerHTML = '';
  options.classList.toggle('bpmf-options', showBpmf);
  q.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = showBpmf ? opt.bopomofo : opt.char;
    btn.addEventListener('click', () => answerBattle(opt, btn));
    options.appendChild(btn);
  });
  updateBattleHud();
}

// 回傳這題得到的經驗；今日任務做完後，打怪的經驗打折
function awardAnswer(correct) {
  if (!correct) return 0;
  const exp = EXP_PER_CORRECT * (taskDoneToday() ? EXTRA_EXP_RATE : 1);
  rpg.exp += exp;
  battle.exp += exp;
  return exp;
}

function answerBattle(opt, btn) {
  if (battle.answered) return;
  const q = battle.questions[battle.index];
  const correct = opt === q.answer;
  const feedback = document.getElementById('bFeedback');

  if (!correct && battle.retriesLeft > 0) {
    battle.retriesLeft--;
    btn.classList.add('wrong');
    btn.disabled = true;
    feedback.textContent = `差一點！再想想看～（重答剩 ${battle.retriesLeft} 次）`;
    feedback.className = 'quiz-feedback bad';
    updateBattleHud();
    return;
  }

  battle.answered = true;
  const buttons = [...document.getElementById('bOptions').children];
  buttons.forEach((b) => (b.disabled = true));
  buttons[q.options.indexOf(q.answer)].classList.add('correct');

  const gained = awardAnswer(correct);
  saveRpg();

  const reveal = `${q.answer.char}（${q.answer.bopomofo}）`;
  if (correct) {
    battle.score++;
    feedback.textContent = `${pickRandom(CHEERS)} ${reveal}　+${Math.round(gained * 10) / 10} 經驗`;
    feedback.className = 'quiz-feedback good';
    const foe = document.getElementById('foeIcon');
    foe.classList.remove('hit');
    void foe.offsetWidth; // restart animation
    foe.classList.add('hit');
  } else {
    btn.classList.add('wrong');
    battle.wrong.push(q.answer);
    addWeak(q.answer.char); // 記進錯字本（weak.js）
    feedback.textContent = `沒關係！答案是 ${reveal}`;
    feedback.className = 'quiz-feedback bad';
  }
  speak(q.answer.char);
  updateBattleHud();

  const isLast = battle.index === battle.questions.length - 1;
  const nextBtn = document.getElementById('bNext');
  nextBtn.textContent = isLast ? '看結果 🏆' : '下一題 ➡️';
  if (correct) battle.timer = setTimeout(nextBattleQuestion, AUTO_NEXT_MS);
  else nextBtn.classList.remove('hidden');
}

function askFriend() {
  if (battle.answered || battle.askedThis || battle.asksLeft <= 0) return;
  const q = battle.questions[battle.index];
  const knowers = currentTeam().filter((s) => q.answer.bopomofo.includes(s));
  const bubble = document.getElementById('friendBubble');
  battle.askedThis = true;

  if (knowers.length === 0) {
    bubble.innerHTML = '🤔 隊伍裡的朋友都不認識這個字…<small>（不扣問朋友次數）</small>';
  } else {
    battle.asksLeft--;
    const friend = pickRandom(knowers);
    bubble.innerHTML = `${monsterHtml(friend, 'xs')}<span><b>${friend}</b>：我認識他！是這個！</span>`;
    document.querySelector(`.team-member[data-sym="${friend}"]`).classList.add('talking');
    const buttons = [...document.getElementById('bOptions').children];
    buttons[q.options.indexOf(q.answer)].classList.add('hinted');
  }
  bubble.classList.remove('hidden');
  updateBattleHud();
}

function nextBattleQuestion() {
  clearTimeout(battle.timer);
  if (battle.index < battle.questions.length - 1) {
    battle.index++;
    renderBattleQuestion();
  } else if (starsFor(battle.score) > 0) {
    playDefeat();
  } else {
    finishBattle();
  }
}

const starsFor = (score) => (score >= 9 ? 3 : score >= 7 ? 2 : score >= 5 ? 1 : 0);
const DEFEAT_MS = 3400; // 發白光 → 變淡灰 → 停一下再看結果

// 敵人被打倒：慢慢發出白光，再慢慢變成淡灰色
function playDefeat() {
  document.getElementById('foeHp').style.width = '0%';
  document.getElementById('bNext').classList.add('hidden');
  document.getElementById('askBtn').disabled = true;
  const foe = document.getElementById('foeIcon');
  foe.classList.remove('hit');
  foe.classList.add('defeated');
  const feedback = document.getElementById('bFeedback');
  feedback.textContent = `✨ ${battle.stage.foe[1]}被打倒了！`;
  feedback.className = 'quiz-feedback good';
  battle.timer = setTimeout(finishBattle, DEFEAT_MS);
}

// ---------- result ----------

function finishBattle() {
  const { stage, score } = battle;
  const stars = starsFor(score);
  const notes = [];
  const firstClear = starsOf(stage.id) === 0 && stars > 0;
  if (stars > starsOf(stage.id)) rpg.stars[stage.id] = stars;

  let rescued = null;
  if (stage.captive && stars > 0 && !rpg.friends.includes(stage.captive)) {
    rescued = stage.captive;
    rpg.friends.push(rescued);
  }

  if (firstClear && stage.kind !== 'castle') {
    rpg.exp += BOSS_FIRST_CLEAR_EXP;
    battle.exp += BOSS_FIRST_CLEAR_EXP;
    notes.push(`👑 第一次打倒 ${stage.foe[1]}！額外 +${BOSS_FIRST_CLEAR_EXP} 經驗`);
  }

  const island = stage.island;
  if (island) {
    const idx = island.castles.findIndex(([s]) => s === stage.captive);
    if (firstClear && stage.kind === 'castle' && idx + 1 < island.castles.length) {
      notes.push(`🔓 ${island.name}${idx + 2} 開放了！`);
    }
    if (stage.kind === 'castle' && bossUnlocked(island) && !starsOf(bossId(island))) {
      notes.push(`👑 ${island.name}BOSS「${island.boss[1]}」出現了！`);
    }
    if (islandFull(island) && !rpg.badges.includes(island.id)) {
      rpg.badges.push(island.id);
      rpg.exp += BADGE_EXP;
      battle.exp += BADGE_EXP;
      notes.push(`🏅 ${island.name}全部滿星！得到「${island.name}徽章」和 ${BADGE_EXP} 經驗！`);
    }
  }
  if (stage.kind === 'boss' && finalUnlocked() && !starsOf('final')) notes.push('🏰 魔王城的大門打開了！');

  const lvNote = levelUpNote(battle.levelBefore);
  if (lvNote) notes.unshift(lvNote);
  fillTeam();
  saveRpg();

  rpgUi.screen = 'result';
  const msg = stars === 0
    ? `${stage.foe[1]} 還沒被打倒…答對 5 題以上才能過關，再挑戰一次！`
    : { 3: '太厲害了！完美勝利！🏅', 2: '打贏了！很不錯喔！💪', 1: '過關了！再練習可以拿更多星星！🌱' }[stars];

  rpgRoot.innerHTML = `
    <div class="quiz-panel rpg-result">
      <div class="result-stars">${starStr(stars)}</div>
      <div class="result-text">答對 <b>${score}</b> / ${battle.questions.length} 題<br>${msg}</div>
      ${rescued ? `<div class="rescue">${monsterHtml(rescued, 'lg')}<p>救出了 <b>${rescued}</b>！變成好朋友了 🎉</p></div>` : ''}
      <div class="exp-gain">+${Math.floor(battle.exp)} 經驗</div>
      ${notes.map((n) => `<div class="result-note">${n}</div>`).join('')}
      <div id="rpgWrongWrap" class="${battle.wrong.length ? '' : 'hidden'}">
        <h3>再練習一下這些字：</h3>
        <div class="wrong-list" id="rpgWrong"></div>
      </div>
      <div class="result-actions">
        <button class="big-btn" id="rpgAgain">再挑戰 🔁</button>
        <button class="big-btn secondary" id="rpgBackStage">${island ? `回到${island.name}` : '回到地圖'}</button>
      </div>
    </div>`;

  fillWrongChips(document.getElementById('rpgWrong'), battle.wrong);
  document.getElementById('rpgAgain').addEventListener('click', () => startBattle(stage));
  document.getElementById('rpgBackStage').addEventListener('click', () => {
    if (island) renderIsland(ISLANDS.indexOf(island));
    else renderMap();
  });
}

function levelUpNote(before) {
  const after = currentLevel();
  if (after <= before) return '';
  const perks = [];
  if (teamSize(after) > teamSize(before)) perks.push(`出戰隊伍變成 ${teamSize(after)} 隻`);
  if (retryCount(after) > retryCount(before)) perks.push(`重答變成 ${retryCount(after)} 次`);
  return `🎉 升級了！Lv${before} → Lv${after}${perks.length ? `（${perks.join('、')}）` : ''}`;
}

// 結算畫面的「再練習一下這些字」
function fillWrongChips(list, items) {
  items.forEach((item) => {
    const chip = document.createElement('button');
    chip.className = 'wrong-chip';
    chip.innerHTML = `<span class="wc-char">${item.char}</span><span class="wc-bpmf">${item.bopomofo}</span>`;
    chip.addEventListener('click', () => openDetail(item));
    list.appendChild(chip);
  });
}

// ---------- friend dex ----------

const dexOverlay = document.getElementById('dexOverlay');
const dexBody = document.getElementById('dexBody');

function openDex() {
  renderDex();
  dexOverlay.classList.remove('hidden');
}

function closeDex() {
  dexOverlay.classList.add('hidden');
  if (rpgUi.screen === 'map') renderMap();
}

function renderDex() {
  const size = teamSize(currentLevel());
  const team = currentTeam();
  dexBody.innerHTML = `
    <p class="dex-tip">點朋友可以加入／離開出戰隊伍（目前 ${team.length}/${size} 隻）</p>
    ${ISLANDS.map((is) => `
      <h3 style="color:${is.color}">${is.icon} ${is.name}</h3>
      <div class="dex-grid">
        ${is.castles.map(([sym, hint]) => {
          const got = rpg.friends.includes(sym);
          return `<button class="dex-item ${got ? '' : 'unknown'} ${team.includes(sym) ? 'in-team' : ''}" data-sym="${sym}" ${got ? '' : 'disabled'}>
            ${got ? monsterHtml(sym, 'sm') : '<div class="dex-q">?</div>'}
            <span>${got ? `${sym}・${hint}` : '？？？'}</span>
          </button>`;
        }).join('')}
      </div>`).join('')}`;

  dexBody.querySelectorAll('.dex-item:not(.unknown)').forEach((b) => {
    b.addEventListener('click', () => toggleTeam(b.dataset.sym));
  });
}

function toggleTeam(sym) {
  const size = teamSize(currentLevel());
  let team = currentTeam();
  if (team.includes(sym)) team = team.filter((s) => s !== sym);
  else {
    if (team.length >= size) team.shift();
    team.push(sym);
  }
  rpg.team = team;
  saveRpg();
  renderDex();
}

document.getElementById('closeDex').addEventListener('click', closeDex);
dexOverlay.addEventListener('click', (e) => {
  if (e.target === dexOverlay) closeDex();
});

