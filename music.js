// 背景鋼琴音樂：用 Web Audio 即時合成輕柔的鋼琴琶音，不需要音樂檔。
// 若放了 music/learn.mp3 就改播那個檔案。學習／測驗／冒險都持續循環播放，唸字時自動把音樂調小。
const BGM_KEY = 'zhuyin_bgm_on';
const BGM_FILE = 'music/learn.mp3';
const BGM_VOLUME = 0.16;
const BGM_FILE_VOLUME = 0.35;
const BGM_DUCK = 0.3; // 唸字時音樂剩下的比例
const BGM_FADE_S = 0.8;
const BPM = 72;
const EIGHTH = 60 / BPM / 2;
const LOOKAHEAD_S = 0.4;

// 和弦進行（MIDI 音高），每個和弦一小節：Cmaj7 → Am7 → Fmaj7 → G6
const CHORDS = [
  { bass: 48, tones: [60, 64, 67, 71] },
  { bass: 45, tones: [57, 60, 64, 67] },
  { bass: 41, tones: [53, 57, 60, 64] },
  { bass: 43, tones: [55, 59, 62, 64] },
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 1]; // 每小節 8 個八分音符的琶音順序

const bgm = {
  on: localStorage.getItem(BGM_KEY) !== '0',
  gesture: false, // 瀏覽器規定要使用者點過畫面才能出聲
  playing: false,
  useFile: false,
  ctx: null, master: null, duck: null, bus: null,
  audio: null, timer: null, nextTime: 0, step: 0,
};

// ---------- 合成鋼琴 ----------

function makeReverb(ctx) {
  const len = Math.floor(ctx.sampleRate * 2.2);
  const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  const conv = ctx.createConvolver();
  conv.buffer = impulse;
  return conv;
}

function initSynth() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.value = 0;
  const duck = ctx.createGain();
  const bus = ctx.createBiquadFilter();
  bus.type = 'lowpass';
  bus.frequency.value = 2800;
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  const reverb = makeReverb(ctx);
  bus.connect(duck);
  bus.connect(reverb).connect(wet).connect(duck);
  duck.connect(master).connect(ctx.destination);
  Object.assign(bgm, { ctx, master, duck, bus });
}

// 一個鋼琴音：基音＋少量泛音，快速敲擊後慢慢衰減
function playNote(midi, t, velocity, duration) {
  const { ctx } = bgm;
  const freq = 440 * 2 ** ((midi - 69) / 12);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(velocity, t + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0008, t + duration);
  env.connect(bgm.bus);
  [[1, 'sine', 1], [2, 'triangle', 0.22], [3, 'sine', 0.07]].forEach(([mul, type, amp]) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq * mul;
    const g = ctx.createGain();
    g.gain.value = amp;
    osc.connect(g).connect(env);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  });
}

function scheduleStep(step, t) {
  const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
  const i = step % 8;
  const humanize = () => (Math.random() - 0.5) * 0.02;
  if (i === 0) playNote(chord.bass, t, 0.45, 3.6);
  playNote(chord.tones[ARP[i]], t + humanize(), 0.22 + Math.random() * 0.06, 2.2);
  // 偶爾在高八度加一個和弦內音當旋律
  if ((i === 0 || i === 4) && Math.random() < 0.55) {
    playNote(pickRandom(chord.tones) + 12, t + 0.01 + humanize(), 0.3, 2.8);
  }
}

function scheduler() {
  const { ctx } = bgm;
  while (bgm.nextTime < ctx.currentTime + LOOKAHEAD_S) {
    scheduleStep(bgm.step, bgm.nextTime);
    bgm.nextTime += EIGHTH;
    bgm.step++;
  }
}

// ---------- 播放控制 ----------

function startBgm() {
  bgm.playing = true;
  if (bgm.useFile) {
    bgm.audio.play().catch(() => { bgm.playing = false; });
    return;
  }
  if (!bgm.ctx) initSynth();
  const { ctx, master } = bgm;
  ctx.resume();
  bgm.nextTime = ctx.currentTime + 0.1;
  bgm.step = 0;
  clearInterval(bgm.timer);
  bgm.timer = setInterval(scheduler, 100);
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
  master.gain.linearRampToValueAtTime(BGM_VOLUME, ctx.currentTime + BGM_FADE_S);
}

function stopBgm() {
  bgm.playing = false;
  if (bgm.useFile) {
    bgm.audio.pause();
    return;
  }
  const { ctx, master } = bgm;
  clearInterval(bgm.timer);
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
  master.gain.linearRampToValueAtTime(0, ctx.currentTime + BGM_FADE_S);
  setTimeout(() => { if (!bgm.playing) ctx.suspend(); }, BGM_FADE_S * 1000 + 100);
}

function bgmUpdate() {
  const want = bgm.on && bgm.gesture && !document.hidden; // 切到別的瀏覽器分頁才暫停
  if (want && !bgm.playing) startBgm();
  else if (!want && bgm.playing) stopBgm();
  bgmButton.textContent = bgm.on ? '🎵 音樂：開' : '🔇 音樂：關';
  bgmButton.classList.toggle('off', !bgm.on);
}

// 唸字時把音樂調小，唸完再調回來（app.js 的 speak）
function bgmDuck(on) {
  if (bgm.useFile && bgm.audio) {
    bgm.audio.volume = BGM_FILE_VOLUME * (on ? BGM_DUCK : 1);
  } else if (bgm.ctx) {
    bgm.duck.gain.setTargetAtTime(on ? BGM_DUCK : 1, bgm.ctx.currentTime, 0.12);
  }
}

// ---------- 音效 ----------

let sfxCtx = null;

// 「叮咚叮～」的上行三音：答對、學會時用（跟背景音樂分開，音樂關著也會響）
function playChime() {
  if (!sfxCtx) sfxCtx = new (window.AudioContext || window.webkitAudioContext)();
  sfxCtx.resume();
  const t0 = sfxCtx.currentTime + 0.02;
  [76, 79, 84].forEach((midi, i) => { // E5 G5 C6
    const t = t0 + i * 0.11;
    const osc = sfxCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    const g = sfxCtx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(g).connect(sfxCtx.destination);
    osc.start(t);
    osc.stop(t + 0.65);
  });
}

// 播放預錄的語音（sounds/*.mp3，用自然語音事先產生，比瀏覽器語音有感情）；
// 播放時背景音樂調小，檔案載入失敗就退回瀏覽器語音
function playVoice(file, fallbackText) {
  stopSpeaking(); // app.js
  const audio = new Audio(file);
  let done = false;
  const finish = (failed) => {
    if (done) return;
    done = true;
    bgmDuck(false);
    if (failed) speak(fallbackText);
  };
  audio.onended = () => finish(false);
  audio.onerror = () => finish(true);
  bgmDuck(true);
  audio.play().catch(() => finish(true));
}

// ---------- UI ----------

const bgmButton = document.createElement('button');
bgmButton.className = 'bgm-btn';
document.body.appendChild(bgmButton);
bgmButton.addEventListener('click', () => {
  // 還沒出聲前按這顆鈕，意思是「我要聽」，不是關掉
  bgm.on = bgm.gesture ? !bgm.on : true;
  bgm.gesture = true;
  localStorage.setItem(BGM_KEY, bgm.on ? '1' : '0');
  bgmUpdate();
});

document.addEventListener('pointerdown', (e) => {
  if (bgm.gesture || e.target === bgmButton) return;
  bgm.gesture = true;
  bgmUpdate();
});
document.addEventListener('visibilitychange', bgmUpdate);

// 有自訂音樂檔就改用檔案
fetch(BGM_FILE, { method: 'HEAD' })
  .then((res) => {
    if (!res.ok) return;
    if (bgm.playing) stopBgm(); // 合成音樂已經在播，先停掉再換成檔案
    bgm.useFile = true;
    bgm.audio = new Audio(BGM_FILE);
    bgm.audio.loop = true;
    bgm.audio.volume = BGM_FILE_VOLUME;
    bgmUpdate();
  })
  .catch(() => {});

bgmUpdate();
