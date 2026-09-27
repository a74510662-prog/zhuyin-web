// 錯字本（仿英文網站的弱點單字）：測驗、冒險、神秘關卡答錯的字會記進來。
// 在「測驗」頁答對錯字本裡的字：+10 經驗（不算每日上限），答對 2 次就從錯字本畢業。
// 今天才錯的字要「隔天」才能練回來——避免故意答錯刷經驗，也符合隔一段時間再複習才記得牢。
// Relies on globals: rpg, saveRpg, todayStr (rpg.js).
const WEAK_CLEAR_COUNT = 2;
const WEAK_REVIEW_EXP = 10;

function addWeak(char) {
  rpg.weak[char] = { date: todayStr(), ok: 0 }; // 在錯字本裡又錯了，就重新計算
  saveRpg();
}

function weakCount() {
  return Object.keys(rpg.weak).length;
}

function weakWaiting(char) {
  const w = rpg.weak[char];
  return !!w && w.date === todayStr();
}

// 測驗頁答對時呼叫；回傳要加在回饋文字後面的說明
function reviewWeak(char) {
  const w = rpg.weak[char];
  if (!w || w.date === todayStr()) return '';
  w.ok++;
  rpg.exp += WEAK_REVIEW_EXP;
  let msg = `　🔄 錯字練回來了！+${WEAK_REVIEW_EXP}`;
  if (w.ok >= WEAK_CLEAR_COUNT) {
    delete rpg.weak[char];
    msg += '　📕 從錯字本畢業！';
  }
  saveRpg();
  return msg;
}

// 自由練習選「我的錯字」時的說明
function weakHintHtml() {
  const chars = Object.keys(rpg.weak);
  if (!chars.length) return '';
  const waiting = chars.filter(weakWaiting);
  return `<span class="weak-list">📕 ${chars.map((c) => `<span class="${weakWaiting(c) ? 'waiting' : ''}">${c}<small>${rpg.weak[c].ok}/${WEAK_CLEAR_COUNT}</small></span>`).join('')}</span>
    <span class="weak-tip">答對 ${WEAK_CLEAR_COUNT} 次就畢業，每次 +${WEAK_REVIEW_EXP} 經驗${waiting.length ? '；灰色的是今天才錯的，明天才能練回來' : ''}</span>`;
}
