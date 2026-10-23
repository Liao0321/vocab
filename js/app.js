import { firebaseConfig } from './config.js';
import { createFirebaseBackend, createDemoBackend, dateKey, liveStreak } from './backend.js';

/* ===================================================================== */
/* 小工具                                                                 */
/* ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = n => Math.floor(Math.random() * n);
const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = rand(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const norm = s => String(s || '').trim().toLowerCase();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 忽略 */ } },
};

let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
function errMsg(e) {
  const code = e && e.code;
  if (code === 'permission-denied') return '沒有權限執行這個動作。如果你是老師，請確認帳號已經加入老師名單。';
  if (code === 'unavailable') return '連不上資料庫，請檢查網路後再試一次。';
  return (e && e.message) || '發生錯誤，請再試一次。';
}

const ICON = {
  speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  flame: '<svg class="flame" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2c1 6 8 8 8 17a8 8 0 0 1-16 0c0-4 2-7 4-9 0 3 1 5 3 6-1-5 0-10 1-14z" fill="#FF8A1F"/><path d="M16 14c.5 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 1.5.6 2.4 1.5 3-.3-2.6 0-5 .5-7z" fill="#FFD43B"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor"/></svg>',
  pic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2" fill="currentColor"/><path d="M4 18l5-5 4 4 3-3 4 4"/></svg>',
  ear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 9a5 5 0 1 1 10 0c0 3-3 4-3 7a3 3 0 0 1-5.5 1.6"/><path d="M10 9a2 2 0 1 1 4 0"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h14l-4-4"/><path d="M20 16H6l4 4"/></svg>',
  abc: '<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="16.5" text-anchor="middle" font-size="11" font-weight="700" font-family="Andika, sans-serif" fill="currentColor">Abc</text><path d="M4 19h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="7" height="6" rx="2"/><rect x="14" y="14" width="7" height="6" rx="2"/><rect x="3" y="14" width="7" height="6" rx="2"/><rect x="14" y="4" width="7" height="6" rx="2"/><path d="M10 7l4 10"/></svg>',
  person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4l5 5L9 20H4v-5z"/><path d="M13 6l5 5"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/></svg>',
  google: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>',
};

/* ===================================================================== */
/* 音效與動畫                                                             */
/* ===================================================================== */
const soundOn = true; // 音量交給裝置調整
let actx;
function tone(freq, dur, type = 'sine', when = 0, vol = 0.18) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime + when, o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.03);
  } catch { /* 沒有音效也沒關係 */ }
}
const sfx = {
  good() { tone(784, 0.12, 'triangle'); tone(1175, 0.22, 'triangle', 0.1); },
  bad() { tone(220, 0.22, 'sawtooth', 0, 0.06); tone(160, 0.3, 'sawtooth', 0.13, 0.06); },
  tap() { tone(560, 0.06, 'sine', 0, 0.08); },
  combo() { [880, 1109, 1319, 1760].forEach((f, i) => tone(f, 0.14, 'triangle', i * 0.07, 0.14)); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, 'triangle', i * 0.12)); },
};

const fx = $('#fx'), fctx = fx.getContext('2d');
let parts = [], fxRunning = false;
function burst(x, y, n = 30) {
  if (reduced) return;
  const cs = getComputedStyle(document.documentElement);
  const cols = ['--sun', '--good', '--brand', '--bad'].map(v => cs.getPropertyValue(v).trim());
  for (let i = 0; i < n; i++) {
    parts.push({ x, y, vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 10 - 3, life: 70, c: cols[i % cols.length], s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4 });
  }
  if (!fxRunning) { fxRunning = true; requestAnimationFrame(fxLoop); }
}
function burstAt(el, n) { if (!el) return; const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, n); }
function fxLoop() {
  const dpr = devicePixelRatio || 1;
  if (fx.width !== innerWidth * dpr) { fx.width = innerWidth * dpr; fx.height = innerHeight * dpr; }
  fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.life > 0);
  for (const p of parts) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.38; p.r += p.vr; p.life--;
    fctx.save(); fctx.translate(p.x, p.y); fctx.rotate(p.r); fctx.globalAlpha = Math.min(1, p.life / 25);
    fctx.fillStyle = p.c; fctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66); fctx.restore();
  }
  if (parts.length) requestAnimationFrame(fxLoop); else { fxRunning = false; fctx.clearRect(0, 0, innerWidth, innerHeight); }
}

/* ===================================================================== */
/* 發音：有音檔就播音檔，沒有就用裝置內建的語音                             */
/* ===================================================================== */
const player = new Audio();
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices(); } catch { voices = []; } }
loadVoices();
try { speechSynthesis.onvoiceschanged = loadVoices; } catch { /* 不支援 */ }
function pickVoice(lang) {
  const n = v => v.lang.replace('_', '-');
  if (lang === 'en') return voices.find(v => n(v) === 'en-US') || voices.find(v => n(v).startsWith('en'));
  return voices.find(v => n(v) === 'zh-TW') || voices.find(v => /^zh-(Hant|HK)/.test(n(v))) || voices.find(v => n(v).startsWith('zh'));
}
function speakText(text, lang) {
  return new Promise(res => {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'en' ? 'en-US' : 'zh-TW';
      u.rate = lang === 'en' ? 0.85 : 0.9;
      const v = pickVoice(lang); if (v) u.voice = v;
      u.onend = u.onerror = () => res();
      speechSynthesis.speak(u);
      setTimeout(res, 4000);
    } catch { res(); }
  });
}
function stopAudio() { try { player.pause(); speechSynthesis.cancel(); } catch { /* 忽略 */ } }
function playWord(w, lang = 'en') {
  if (!w) return Promise.resolve();
  const src = lang === 'en' ? w.enAudio : w.zhAudio;
  const text = lang === 'en' ? w.en : w.zh;
  stopAudio();
  if (!src) return speakText(text, lang);
  return new Promise(res => {
    player.src = src;
    player.onended = player.onerror = () => res();
    player.play().catch(() => speakText(text, lang).then(res));
    setTimeout(res, 6000);
  });
}

/* ===================================================================== */
/* 畫面片段                                                               */
/* ===================================================================== */
const hasVisual = w => !!(w.img || w.emoji);
function visual(w, cls = 'pic') {
  if (w.img) return `<img class="${cls}" src="${w.img}" alt="">`;
  if (w.emoji) return `<span class="emo" aria-hidden="true">${w.emoji}</span>`;
  return '';
}
const posTag = w => (w.pos ? `<span class="pos">${esc(w.pos)}</span>` : '');
function speakBtn(w, lang, label = '', extra = '') {
  return `<button class="speak ${lang === 'zh' ? 'zhv' : ''} ${extra}" data-act="say" data-key="${esc(wkey(w))}" data-lang="${lang}" aria-label="播放${lang === 'en' ? '英文' : '中文'}發音">${ICON.speaker}${label ? `<span>${label}</span>` : ''}</button>`;
}
const wkey = w => `${w.deckId}__${w.id}`;
// 所有畫面上出現過的單字，讓喇叭按鈕可以找到它
const wordIndex = new Map();
function indexWords(list) { list.forEach(w => wordIndex.set(wkey(w), w)); }

/* ===================================================================== */
/* 狀態                                                                   */
/* ===================================================================== */
let be;            // backend
let user = null;
let decks = [];
let stats = new Map(); // key -> 單字熟練度
let profile = {};
let round = null;
let study = null;
let timers = [];
const later = (fn, ms) => timers.push(setTimeout(fn, ms));
const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

const MODES = {
  pic: { name: '圖片題', icon: 'pic', types: ['pic2en'] },
  listen: { name: '聲音題', icon: 'ear', types: ['listen2en'] },
  match: { name: '配對題', icon: 'link', types: ['match'] },
  spell: { name: '拼字題', icon: 'abc', types: ['spell'] },
  write: { name: '手寫題', icon: 'pen', types: ['write'] },
  mix: { name: '綜合挑戰', icon: 'star', types: ['pic2en', 'listen2en', 'match', 'spell'] },
};
const ROUND_LEN = 10;
const EXTRA_WEAK = 4; // 每回合額外穿插的常錯字題數上限

/* ===================================================================== */
/* 路由（網址 #後面的部分，讓上一頁按鈕可以用）                              */
/* ===================================================================== */
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [a, b] = h.split('/');
  return { a: a || '', b: b ? decodeURIComponent(b) : '' };
}
function go(path) { if (location.hash === '#/' + path) render(); else location.hash = '/' + path; }
window.addEventListener('hashchange', () => render());

async function render() {
  clearTimers(); hideSheet(); stopAudio(); round = null; study = null;
  renderTop();
  if (!user) return renderLogin();
  const { a, b } = route();
  try {
    if (a === 'dash') return await renderDash();
    if (a === 'writing' && b) return await renderWriting(b);
    if (a === 'review' && user.isTeacher) return b ? await renderWriting(b) : await renderReviewList();
    if (a === 'teach' && user.isTeacher) return b ? await renderEditor(b) : await renderTeach();
    return await renderHome();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="empty"><p>${esc(errMsg(e))}</p><button class="btn" data-act="home">回首頁</button></div>`;
  }
}

function renderTop() {
  $('#modeLabel').textContent = user && user.isTeacher ? '老師' : '';
  const ta = $('#topActions');
  if (!user) { ta.innerHTML = ''; return; }
  const { a } = route();
  ta.innerHTML = `
    ${user.isTeacher ? `<button class="pill-btn ${a === 'teach' ? 'on' : ''}" data-act="teach">管理字卡組</button><button class="pill-btn ${a === 'review' ? 'on' : ''}" data-act="review">手寫作業</button>` : ''}
    <button class="me-btn ${a === 'dash' ? 'on' : ''}" data-act="dash" aria-label="個人練習紀錄" title="個人練習紀錄">${user.photo ? `<img src="${esc(user.photo)}" alt="" referrerpolicy="no-referrer">` : ICON.person}</button>`;
}

/* ===================================================================== */
/* 登入                                                                   */
/* ===================================================================== */
function renderLogin() {
  const inApp = /Line\/|FBAN|FBAV|Instagram|MicroMessenger/i.test(navigator.userAgent);
  const demo = be.kind === 'demo';
  app.innerHTML = `
  <section class="login">
    <div class="floaters" aria-hidden="true"><span>apple</span><span class="zh">蘋果</span><span>/ˈæp.əl/</span><span>n.</span></div>
    <h1>每天十題，<span class="hl">英文單詞</span>練起來</h1>
    <p class="lead">看圖、聽發音、拼字母、玩配對。答題由系統自動判斷，答錯的字會再出現，直到你記住為止。</p>
    ${inApp ? `<div class="warn"><b>請改用 Chrome 或 Safari 開啟。</b><br>LINE、Facebook 等 App 裡的瀏覽器不能用 Google 登入。請點右上角選單，選「用瀏覽器開啟」。</div>` : ''}
    ${demo ? `
      <div class="note">目前是<b>示範模式</b>（還沒設定 Firebase），資料只存在這台電腦。請選擇身分試用：</div>
      <div class="row center">
        <button class="btn big" data-act="demo-login" data-role="student">我是學生</button>
        <button class="btn big ghost" data-act="demo-login" data-role="teacher">我是老師</button>
      </div>
      <button class="btn small ghost" data-act="demo-reset">重設示範資料</button>`
    : `<button class="btn big gbtn" data-act="signin">${ICON.google}用 Google 帳號登入</button>`}
  </section>`;
}

/* ===================================================================== */
/* 首頁：字卡組列表                                                        */
/* ===================================================================== */
async function loadStats() {
  const [p, ws, mine] = await Promise.all([be.getProfile(), be.getWordStats(), be.listWritings(true).catch(() => [])]);
  profile = p || {};
  stats = new Map(ws.map(s => [s.key, s]));
  myWritings = mine;
  // 老師批改過、還沒算進熟練度的手寫作業：寫錯的字之後會變成「常錯的字」
  for (const h of mine.filter(x => x.reviewedAt && !x.applied && Array.isArray(x.marks))) {
    const updates = h.items.map((it, i) => (h.marks[i] === true || h.marks[i] === false) ? bumpStat({ ...it, deckId: it.deckId || h.deckId }, h.marks[i]) : null).filter(Boolean);
    try { await be.applyReview(h.id, updates); h.applied = true; } catch (e) { console.warn(e); }
  }
}
let myWritings = [];
// 學生不用選字卡組：所有已發布字卡組的單字放在一起出題
let curDeck = null, curWords = [];
const ALL = { id: 'all', title: '全部單字' };
async function loadAllWords(force) {
  if (curDeck && !force) return;
  decks = await be.listDecks();
  const lists = await Promise.all(decks.filter(d => d.published).map(d => be.getWords(d.id).catch(() => [])));
  curWords = lists.flat(); indexWords(curWords); curDeck = ALL;
}

async function renderHome() {
  app.innerHTML = '<p class="loading">載入單字…</p>';
  await Promise.all([loadAllWords(), loadStats()]);
  const st = liveStreak(profile);
  const practicedToday = profile.lastDate === dateKey();
  const n = curWords.length;
  const mastered = curWords.filter(w => lvOf(w) >= 4).length;
  const tile = k => `<button class="tmode" data-act="start" data-mode="${k}"><span class="ico">${ICON[MODES[k].icon]}</span><b>${MODES[k].name}</b></button>`;
  app.innerHTML = `
  <section class="stack">
    <div class="hello">
      <div><h1>嗨，${esc(user.name)}</h1>
        <p class="muted" style="margin:4px 0 0">${practicedToday ? '今天已經練習過了，再來一回合可以記得更牢。' : st ? '今天還沒練習，完成一回合就能延續連續紀錄！' : '選一種題型，開始今天的第一回合。'}</p></div>
      <button class="streak-chip" data-act="dash" style="border:0">${ICON.flame.replace('class="flame"', `class="flame ${st ? '' : 'off'}"`)}<span><b>${st}</b> 天<br><small class="muted">連續練習</small></span></button>
    </div>
    ${n < 2 ? `<div class="empty">${user.isTeacher ? '還沒有已發布的單字。到「管理字卡組」新增單字並發布。' : '老師還沒有發布單字，晚點再回來看看。'}</div>` : `
    <div class="tmodes">${['pic', 'listen', 'match', 'spell', 'write'].map(tile).join('')}</div>
    <div class="wmodes">
      <button class="wmode hero" data-act="start" data-mode="mix"><span class="ico">${ICON.star}</span><b>綜合挑戰</b></button>
      <button class="wmode calm" data-act="study"><span class="ico">${ICON.book}</span><b>練習模式</b></button>
    </div>
    <div class="meter" role="img" aria-label="已熟練 ${mastered} / ${n}"><i style="width:${Math.round(mastered / n * 100)}%"></i></div>
    <p class="muted" style="margin:0;font-size:14px">共 ${n} 個單字，已熟練 ${mastered} 個</p>`}
  </section>`;
}
function wordRow(w, right = '') {
  return `<div class="wrow">${visual(w, 'mini')}<div class="words"><span class="en">${esc(w.en)}</span> ${posTag(w)} <span class="ipa">${esc(w.ipa || '')}</span><div class="zh">${esc(w.zh)}</div></div>${right}${speakBtn(w, 'en')}</div>`;
}

/* ===================================================================== */
/* 出題                                                                   */
/* ===================================================================== */
function lvOf(w) { const s = stats.get(wkey(w)); return s ? s.lv || 0 : 0; }
function weightedPick(pool, avoid) {
  let cand = pool.filter(w => !avoid.includes(w));
  if (!cand.length) cand = pool;
  const weights = cand.map(w => { const s = stats.get(wkey(w)); return (6 - (s ? s.lv || 0 : 0)) + (s ? 0 : 2); });
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cand.length; i++) { r -= weights[i]; if (r <= 0) return cand[i]; }
  return cand[cand.length - 1];
}
function fitType(type, w, pool) {
  if (type === 'pic2en' && !hasVisual(w)) return 'listen2en';
  if (type === 'match' && pool.length < 3) return 'listen2en';
  if (type === 'spell' && (!/[a-z]/i.test(w.en) || w.en.replace(/[^a-z]/gi, '').length > 14)) return 'listen2en';
  return type;
}
function startRound({ mode, pool, forced, title, deckId }) {
  clearTimers();
  if (mode === 'write') return startWriting({ pool, forced, title, deckId });
  const types = MODES[mode].types, queue = [], recent = [];
  const len = forced ? Math.min(Math.max(forced.length, 5), 15) : ROUND_LEN;
  for (let i = 0; i < len; i++) {
    const w = forced ? forced[i % forced.length] : weightedPick(pool, recent);
    recent.push(w); if (recent.length > Math.min(3, pool.length - 1)) recent.shift();
    queue.push({ type: fitType(types[rand(types.length)], w, pool), word: w });
  }
  if (!forced && mode !== 'match') {
    // 常錯的字：在固定題數之外額外加題，隨機穿插（不放第一題）
    const weakKeys = weakList().map(s => s.key);
    const extra = weakKeys.map(k => pool.find(w => wkey(w) === k)).filter(Boolean).slice(0, EXTRA_WEAK);
    for (const w of extra) {
      const at = 1 + rand(queue.length);
      queue.splice(at, 0, { type: fitType(types[rand(types.length)], w, pool), word: w, extra: true });
    }
  }
  round = { mode, pool, queue, idx: 0, correct: 0, combo: 0, best: 0, missed: new Map(), pending: new Set(), updates: [], title, deckId, retryArgs: { mode, pool, forced, title, deckId } };
  renderQ();
}
/* ---------- 誘答選項：挑跟正確答案「很像」的字 ---------- */
function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const similarity = (a, b) => (a && b ? 1 - editDistance(a, b) / Math.max(a.length, b.length) : 0);
// 簡易 Soundex：拼法不同但念起來接近的字會得到一樣的代碼（例如 there / their）
function soundex(word) {
  const s = norm(word).replace(/[^a-z]/g, ''); if (!s) return '';
  const code = { b: 1, f: 1, p: 1, v: 1, c: 2, g: 2, j: 2, k: 2, q: 2, s: 2, x: 2, z: 2, d: 3, t: 3, l: 4, m: 5, n: 5, r: 6 };
  let out = s[0], last = code[s[0]] || 0;
  for (const ch of s.slice(1)) { const c = code[ch] || 0; if (c && c !== last) out += c; if (ch !== 'h' && ch !== 'w') last = c; }
  return (out + '000').slice(0, 4);
}
const ipaCore = s => String(s || '').replace(/[\/\[\]ˈˌ.\s]/g, '');
const zhChars = s => new Set([...String(s || '')].filter(c => /[\u4e00-\u9fff]/.test(c) && !'的了是一個'.includes(c)));
function lureScore(w, x) {
  const a = norm(w.en), b = norm(x.en);
  let score = 0;
  if (a.slice(0, 2) === b.slice(0, 2)) score += 3; else if (a[0] === b[0]) score += 1.5;   // 開頭一樣
  if (a.length > 2 && b.length > 2 && a.slice(-2) === b.slice(-2)) score += 2.5;            // 字尾一樣
  score += similarity(a, b) * 5;                                                             // 拼字接近
  if (Math.abs(a.length - b.length) <= 1) score += 1;
  if (soundex(a) === soundex(b)) score += 2;                                                 // 念起來像
  if (w.ipa && x.ipa) score += similarity(ipaCore(w.ipa), ipaCore(x.ipa)) * 4;              // 音標接近
  const zw = zhChars(w.zh); let shared = 0;
  zhChars(x.zh).forEach(c => { if (zw.has(c)) shared++; });
  score += Math.min(shared, 2) * 3;                                                          // 中文有同一個字
  if (w.pos && x.pos && norm(w.pos) === norm(x.pos)) score += 1.5;                           // 詞性一樣
  return score;
}
function distractors(w, pool, n) {
  const cand = pool.filter(x => x !== w && norm(x.en) !== norm(w.en) && x.zh !== w.zh);
  // 從最像的幾個字裡依分數加權抽選：越像越容易被抽到，但每次組合不完全一樣
  const ranked = cand.map(x => ({ x, s: lureScore(w, x) + Math.random() })).sort((p, q) => q.s - p.s).slice(0, n + 3);
  const out = [];
  while (out.length < n && ranked.length) {
    const ws = ranked.map(r => Math.max(0.2, r.s) ** 2);
    let t = Math.random() * ws.reduce((a, b) => a + b, 0), i = 0;
    while (i < ranked.length - 1 && (t -= ws[i]) > 0) i++;
    out.push(ranked.splice(i, 1)[0].x);
  }
  return out;
}
// 熟練度 lv：0–5，答對 +1，答錯 −2；lv ≥ 4 算「已熟練」
function bumpStat(w, ok) {
  const key = `${w.deckId}__${w.wordId || w.id}`;
  const s = stats.get(key) || { key, deckId: w.deckId, wordId: w.wordId || w.id, lv: 0, seen: 0, correct: 0, wrong: 0 };
  s.lv = ok ? Math.min(5, (s.lv || 0) + 1) : Math.max(0, (s.lv || 0) - 2);
  s.seen++; ok ? s.correct++ : s.wrong++;
  s.en = w.en; s.zh = w.zh;
  stats.set(key, s);
  return { deckId: s.deckId, wordId: s.wordId, en: w.en, zh: w.zh, ok, lv: s.lv };
}
function grade(w, ok) { round.updates.push(bumpStat(w, ok)); }

function renderQ() {
  clearTimers(); hideSheet();
  window.scrollTo(0, 0);
  const q = round.queue[round.idx];
  const pct = round.idx / round.queue.length * 100;
  app.innerHTML = `
  <section class="play">
    <div class="playbar">
      <button class="icon-btn" data-act="quit" aria-label="結束練習">✕</button>
      <div class="track" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><div class="fill" style="width:${pct}%"></div></div>
      <span class="count">${round.idx + 1}/${round.queue.length}</span>
      <span class="combo ${round.combo >= 2 ? 'on' : ''}" id="combo">連對 ${round.combo}</span>
    </div>
    <div class="q" id="q"></div>
  </section>`;
  QT[q.type](q, $('#q'));
  if (q.extra || q.retry) $('#q').insertAdjacentHTML('afterbegin', `<p class="q-flag ${q.retry ? 'retry' : ''}">${q.retry ? '剛剛答錯的字，再考一次' : '常錯的字，加強練習'}</p>`);
}

function choice(q, el, { label, prompt, opt, optCls = '', auto }) {
  const opts = shuffle([q.word, ...distractors(q.word, round.pool, 3)]);
  el.innerHTML = `<p class="q-label">${label}</p><div class="prompt">${prompt}</div>
    <div class="opts">${opts.map((w, i) => `<button class="opt ${optCls}" data-i="${i}"><kbd class="key">${i + 1}</kbd>${opt(w)}</button>`).join('')}</div>
    <p class="kbd-hint">鍵盤：按 1–4 選答案，Enter 下一題</p>`;
  $$('.opt', el).forEach(b => b.addEventListener('click', () => {
    if (q.done) return; q.done = true;
    const ok = opts[+b.dataset.i] === q.word;
    b.classList.add(ok ? 'right' : 'wrong');
    $$('.opt', el).forEach((x, i) => { if (opts[i] === q.word) x.classList.add('right'); else if (x !== b) x.classList.add('dim'); });
    grade(q.word, ok);
    finish(ok, ok ? [] : [q.word], b);
  }));
  if (auto) later(auto, 300);
}
const QT = {
  pic2en(q, el) {
    choice(q, el, { label: '這是什麼？選出英文', prompt: visual(q.word), opt: w => esc(w.en) });
  },
  listen2en(q, el) {
    choice(q, el, {
      label: '聽發音，選出聽到的英文',
      prompt: speakBtn(q.word, 'en', '', 'huge') + '<small class="muted">聽不清楚？再按一次喇叭</small>',
      opt: w => esc(w.en),
      auto: () => sayBtn($('.speak.huge')),
    });
  },
  listen2pic(q, el) {
    const allVis = true;
    choice(q, el, {
      label: '聽發音，點出正確的意思',
      prompt: speakBtn(q.word, 'en', '', 'huge') + '<small class="muted">聽不清楚？再按一次喇叭</small>',
      opt: w => (hasVisual(w) && allVis ? visual(w, 'mini') : `<span class="zh">${esc(w.zh)}</span>`),
      optCls: 'zhopt',
      auto: () => sayBtn($('.speak.huge')),
    });
  },
  zh2en(q, el) {
    choice(q, el, {
      label: '這個中文的英文是？',
      prompt: `<div class="big-zh">${esc(q.word.zh)}</div>${speakBtn(q.word, 'zh', '聽中文')}`,
      opt: w => esc(w.en),
      auto: () => playWord(q.word, 'zh'),
    });
  },
  en2zh(q, el) {
    choice(q, el, {
      label: '這個英文是什麼意思？',
      prompt: `<div class="big-en">${esc(q.word.en)}</div><div>${posTag(q.word)} <span class="ipa">${esc(q.word.ipa || '')}</span></div>${speakBtn(q.word, 'en', '聽英文')}`,
      opt: w => esc(w.zh), optCls: 'zhopt',
      auto: () => playWord(q.word, 'en'),
    });
  },
  spell(q, el) {
    const w = q.word, chars = [...w.en];
    const isL = c => /[a-z]/i.test(c);
    const letters = chars.filter(isL).map(c => c.toLowerCase());
    const extra = [], nExtra = letters.length <= 6 ? 2 : letters.length <= 10 ? 1 : 0;
    while (extra.length < nExtra) { const c = 'abcdefghijklmnopqrstuvwxyz'[rand(26)]; if (!letters.includes(c) && !extra.includes(c)) extra.push(c); }
    const tiles = shuffle([...letters, ...extra]).map((c, i) => ({ c, i, used: false }));
    const slots = chars.map(c => (isL(c) ? { ans: c.toLowerCase(), tile: null, st: '' } : { fixed: true, ch: c }));
    let attempts = 0, hinted = false;
    el.innerHTML = `<p class="q-label">聽發音，拼出英文</p>
      <div class="prompt">${visual(w)}<div class="big-zh" style="font-size:34px">${esc(w.zh)}</div><div>${posTag(w)}</div>${speakBtn(w, 'en', '聽英文')}</div>
      <div class="slots" id="slots"></div><div class="tiles" id="tiles"></div>
      <div class="row center"><button class="btn ghost small" id="hint">給我提示</button><button class="btn ghost small" id="clr">全部清除</button></div>`;
    const sEl = $('#slots', el), tEl = $('#tiles', el);
    const draw = () => {
      sEl.innerHTML = slots.map((s, i) => s.fixed
        ? `<span class="slot fixed">${s.ch === ' ' ? '' : esc(s.ch)}</span>`
        : `<button class="slot ${s.tile ? 'filled' : ''} ${s.st}" data-s="${i}" aria-label="第 ${i + 1} 格">${s.tile ? s.tile.c : ''}</button>`).join('');
      tEl.innerHTML = tiles.map(t => `<button class="tile ${t.used ? 'used' : ''}" data-t="${t.i}">${t.c}</button>`).join('');
    };
    const place = t => {
      const s = slots.find(x => !x.fixed && !x.tile); if (!s || t.used) return;
      s.tile = t; s.st = ''; t.used = true; sfx.tap(); draw();
      if (slots.every(x => x.fixed || x.tile)) check();
    };
    const unplace = s => { if (q.done || !s.tile || s.st === 'good' || s.st === 'hint') return; s.tile.used = false; s.tile = null; s.st = ''; draw(); };
    const check = () => {
      const fill = slots.filter(x => !x.fixed);
      if (fill.every(x => x.tile.c === x.ans)) {
        q.done = true; fill.forEach(x => { if (x.st !== 'hint') x.st = 'good'; }); draw();
        const ok = attempts === 0 && !hinted;
        grade(w, ok);
        finish(ok, ok ? [] : [w], sEl, ok ? {} : { soft: true, msg: hinted ? '拼對了！用了提示，等一下再考一次' : '第二次拼對了！等一下再考一次' });
        return;
      }
      attempts++;
      fill.forEach(x => { if (x.tile.c !== x.ans) x.st = 'bad'; else if (x.st !== 'hint') x.st = 'good'; });
      draw(); sfx.bad();
      if (attempts >= 2) {
        q.done = true;
        later(() => {
          fill.forEach(x => { if (x.st === 'bad') { x.tile = { c: x.ans }; x.st = 'hint'; } });
          draw(); grade(w, false); finish(false, [w], null, { silent: true });
        }, 700);
      } else {
        later(() => { fill.forEach(x => { if (x.st === 'bad') { x.tile.used = false; x.tile = null; x.st = ''; } }); draw(); }, 750);
      }
    };
    el.addEventListener('click', e => {
      if (q.done) return;
      const t = e.target.closest('[data-t]'), s = e.target.closest('[data-s]');
      if (t) place(tiles[+t.dataset.t]);
      if (s) unplace(slots[+s.dataset.s]);
    });
    $('#clr', el).addEventListener('click', () => { if (!q.done) { slots.forEach(s => { if (!s.fixed && s.st !== 'hint' && s.st !== 'good') unplace(s); }); } });
    $('#hint', el).addEventListener('click', () => {
      if (q.done) return;
      const s = slots.find(x => !x.fixed && (!x.tile || x.tile.c !== x.ans)); if (!s) return;
      if (s.tile) { s.tile.used = false; s.tile = null; }
      let t = tiles.find(x => !x.used && x.c === s.ans);
      if (!t) { const other = slots.find(x => !x.fixed && x.tile && x.st !== 'hint' && x.tile.c === s.ans && x.ans !== s.ans); if (other) { t = other.tile; other.tile = null; other.st = ''; } }
      if (!t) return;
      s.tile = t; t.used = true; s.st = 'hint'; hinted = true; sfx.tap(); draw();
      if (slots.every(x => x.fixed || x.tile)) check();
    });
    q.onKey = e => {
      if (q.done) return;
      if (/^[a-z]$/i.test(e.key)) { const t = tiles.find(x => !x.used && x.c === e.key.toLowerCase()); if (t) place(t); }
      else if (e.key === 'Backspace') { const s = [...slots].reverse().find(x => !x.fixed && x.tile && x.st !== 'hint' && x.st !== 'good'); if (s) unplace(s); }
    };
    draw();
    later(() => playWord(w, 'en'), 300);
  },
  match(q, el) {
    const set = shuffle([q.word, ...distractors(q.word, round.pool, 3)]);
    const L = shuffle(set), R = shuffle(set);
    el.innerHTML = `<p class="q-label">把英文和意思配成一對</p>
      <div class="match"><div class="col">${L.map((w, i) => `<button class="mcard en" data-side="L" data-i="${i}">${esc(w.en)}</button>`).join('')}</div>
      <div class="col">${R.map((w, i) => `<button class="mcard mean" data-side="R" data-i="${i}">${visual(w, 'mini')}<span>${esc(w.zh)}</span></button>`).join('')}</div></div>`;
    let selL = null, selR = null, matched = 0;
    const wrongs = new Set();
    el.addEventListener('click', e => {
      const b = e.target.closest('.mcard'); if (!b || b.classList.contains('done') || q.done) return;
      const side = b.dataset.side, w = (side === 'L' ? L : R)[+b.dataset.i];
      if (side === 'L') { playWord(w, 'en'); if (selL) selL.b.classList.remove('sel'); selL = { b, w }; }
      else { sfx.tap(); if (selR) selR.b.classList.remove('sel'); selR = { b, w }; }
      b.classList.add('sel');
      if (!selL || !selR) return;
      const a = selL, c = selR; selL = selR = null;
      a.b.classList.remove('sel'); c.b.classList.remove('sel');
      if (a.w === c.w) {
        a.b.classList.add('done'); c.b.classList.add('done'); matched++;
        grade(a.w, !wrongs.has(a.w)); sfx.good();
        if (matched === set.length) {
          q.done = true;
          const missed = [...wrongs];
          finish(missed.length === 0, missed, null, missed.length ? { soft: true, msg: '全部配對完成！配錯的字等一下會再出現' } : { msg: '全部配對成功！' });
        }
      } else {
        wrongs.add(a.w); wrongs.add(c.w); sfx.bad();
        [a.b, c.b].forEach(x => { x.classList.remove('bad'); void x.offsetWidth; x.classList.add('bad'); });
        later(() => { a.b.classList.remove('bad'); c.b.classList.remove('bad'); }, 450);
      }
    });
  },
};

const PRAISE = ['答對了！', '太棒了！', '好厲害！', '完全正確！', 'Great job!', 'Awesome!'];
function finish(ok, missed, anchor, opt = {}) {
  const q = round.queue[round.idx];
  if (ok) { round.correct++; round.combo++; round.best = Math.max(round.best, round.combo); }
  else round.combo = 0;
  // 答錯的字一定排到這一輪最後，用同一種題型再考（選項順序重新洗牌），答對才算完成
  if (q.retry && ok) round.pending.delete(q.word);
  missed.forEach(w => {
    round.missed.set(wkey(w), w);
    round.pending.add(w);
    const type = q.type === 'match' ? fitType('pic2en', w, round.pool) : q.type;
    round.queue.push({ type, word: w, retry: true });
  });
  const c = $('#combo');
  if (c) { c.textContent = `連對 ${round.combo}`; c.classList.toggle('on', round.combo >= 2); }
  if (ok) { sfx.good(); if (round.combo >= 3 && round.combo % 3 === 0) later(sfx.combo, 250); }
  else if (opt.soft) sfx.good();
  else if (!opt.silent) sfx.bad();
  const kind = ok ? 'good' : opt.soft ? 'mid' : 'bad';
  const msg = opt.msg || (ok ? PRAISE[rand(PRAISE.length)] + (round.combo >= 2 ? ` 連續答對 ${round.combo} 題` : '') : '再加油！正確答案是：');
  const showWord = q.type !== 'match';
  showSheet(kind, msg, showWord ? q.word : null);
  if (showWord && ok) later(() => playWord(q.word, 'en'), 350);
  if (showWord && !ok) repeatAudio(q.word);
  if (ok) later(nextQ, showWord ? 1900 : 1200);
}
function showSheet(kind, msg, w) {
  const s = $('#sheet');
  s.className = `sheet ${kind}`;
  s.innerHTML = `<div class="sheet-in">
    <div class="sheet-msg" role="status"><span class="stamp" aria-hidden="true">${kind === 'good' ? '很棒' : kind === 'mid' ? '加油' : '訂正'}</span><span>${esc(msg)}</span></div>
    ${w ? `<div class="answer">${visual(w, 'mini')}<div class="words"><span class="en">${esc(w.en)}</span> ${posTag(w)} <span class="ipa">${esc(w.ipa || '')}</span><div class="zhw">${esc(w.zh)}</div></div>${speakBtn(w, 'en')}${speakBtn(w, 'zh')}</div>` : ''}
    <button class="btn big ${kind === 'bad' ? 'danger' : kind === 'mid' ? 'sun' : ''}" data-act="next">${round.idx + 1 >= round.queue.length ? (round.mode === 'write' ? '交給老師' : '看成績') : '下一題'}</button>
  </div>`;
  s.hidden = false;
  if (kind !== 'good') later(() => $('[data-act="next"]', s)?.focus(), 50);
}
// 答錯時反覆播放正確答案（英文 → 中文 → 英文 …），直到按下一題
let repeatToken = null;
function repeatAudio(w, times = 3) {
  const token = repeatToken = Symbol();
  const btn = () => $('#sheet .speak');
  later(async () => {
    for (let i = 0; i < times && repeatToken === token; i++) {
      btn()?.classList.add('playing');
      await playWord(w, 'en');
      if (repeatToken !== token) break;
      await new Promise(r => setTimeout(r, 450));
      if (i === 0 && repeatToken === token) { await playWord(w, 'zh'); await new Promise(r => setTimeout(r, 450)); }
    }
    btn()?.classList.remove('playing');
  }, 500);
}
function hideSheet() {
  repeatToken = null; const s = $('#sheet'); s.hidden = true; s.innerHTML = ''; }
function nextQ() {
  if (!round) return;
  clearTimers();
  round.idx++;
  if (round.idx >= round.queue.length) return round.mode === 'write' ? renderWriteResult() : renderResult();
  renderQ();
}

async function renderResult() {
  hideSheet();
  const r = round, total = r.queue.length, pct = Math.round(r.correct / total * 100);
  const stars = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 40 ? 1 : 0;
  const msg = ['再挑戰一次吧！', '有進步喔！', '表現很好！', '太完美了！'][stars];
  const missed = [...r.missed.values()];
  app.innerHTML = `
  <section class="result">
    <div class="stars" aria-label="${stars} 顆星">${[0, 1, 2].map(i => `<span class="star ${i < stars ? 'on' : ''}" style="--d:${0.2 + i * 0.25}s">★</span>`).join('')}</div>
    <h2>${msg}</h2>
    <p class="score">答對 ${r.correct} / ${total} 題 · 最高連對 ${r.best} 題</p>
    ${missed.length ? `<p class="muted" style="margin:0">答錯的 ${missed.length} 個字都已經訂正完成</p>` : ''}
    <p class="saved" id="saved">正在儲存練習紀錄…</p>
    <div class="row center">
      <button class="btn big" data-act="again">再玩一回合</button>
      <button class="btn big ghost" data-act="back-deck">換個玩法</button>
    </div>
    ${missed.length ? `<div class="section-title" style="width:100%"><h2>這回合答錯的字</h2></div><div class="missed">${missed.map(w => wordRow(w)).join('')}</div>` : ''}
  </section>`;
  sfx.win();
  later(() => burst(innerWidth / 2, innerHeight / 3, 10 + stars * 10), 300);
  try {
    profile = await be.recordRound({ deckId: r.deckId, deckTitle: r.title, mode: r.mode, total, correct: r.correct, best: r.best, updates: r.updates });
    const el = $('#saved'); if (el) el.textContent = `已儲存 · 連續練習 ${profile.streak} 天`;
  } catch (e) {
    console.error(e);
    const el = $('#saved'); if (el) el.textContent = '練習紀錄沒有存到：' + errMsg(e);
  }
}

/* ===================================================================== */
/* 聽音手寫：學生寫完一回合，拼成一張圖交給老師批改                           */
/* ===================================================================== */
const PAD_W = 900, PAD_H = 340; // 手寫區看得到的範圍（一行四線格）
const SLIDE = 540;               // 按一次三角形往右滑的距離：保留左邊 40% 剛寫的內容
const MAX_W = PAD_W * 6;         // 一題最長可以寫到 6 個畫面寬
const INK = '#1B2250';
function startWriting({ pool, forced, title, deckId }) {
  const n = Math.min(ROUND_LEN, pool.length);
  const picked = [];
  if (forced) picked.push(...forced.slice(0, n));
  while (picked.length < n) picked.push(weightedPick(pool.filter(w => !picked.includes(w)), []));
  round = { mode: 'write', pool, queue: picked.map(w => ({ type: 'write', word: w })), idx: 0, correct: 0, combo: 0, best: 0, missed: new Map(), pending: new Set(), updates: [], title, deckId, retryArgs: { mode: 'write', pool, forced: null, title, deckId } };
  renderQ();
}
// 畫一段四線格（第三條紅線是基準線）和筆跡；x 從 offset 開始，寬 width，縮放 scale
function drawStrip(ctx, strokes, { offset = 0, width = PAD_W, scale = 1 } = {}) {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, PAD_H);
  [70, 140, 210, 280].forEach((y, i) => {
    ctx.beginPath(); ctx.setLineDash(i === 1 ? [14, 12] : []); ctx.lineDashOffset = offset;
    ctx.strokeStyle = i === 2 ? '#E8838E' : '#C3CBE6'; ctx.lineWidth = i === 2 ? 3 : 2;
    ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.translate(-offset, 0);
  ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const st of strokes) {
    ctx.beginPath(); ctx.moveTo(st[0][0], st[0][1]);
    if (st.length === 1) ctx.lineTo(st[0][0] + 0.1, st[0][1]);
    st.forEach(p => ctx.lineTo(p[0], p[1])); ctx.stroke();
  }
  ctx.restore();
}
const inkRight = strokes => strokes.reduce((m, st) => Math.max(m, ...st.map(p => p[0])), 0);
QT.write = (q, el) => {
  const w = q.word;
  el.innerHTML = `<p class="q-label">聽發音，寫出英文</p>
    <div class="prompt">${speakBtn(w, 'en', '', 'huge')}
      <div class="hint">${visual(w, 'mini')}<span class="zh">${esc(w.zh)}</span>${posTag(w)}</div></div>
    <div class="pad">
      <canvas id="pad" width="${PAD_W}" height="${PAD_H}" aria-label="手寫區，用手指或滑鼠寫英文"></canvas>
      <button class="slide left" id="slideL" aria-label="往左看" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-8 7 8 7z" fill="currentColor"/></svg></button>
      <button class="slide right" id="slideR" aria-label="往右寫"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l8 7-8 7z" fill="currentColor"/></svg></button>
      <div class="pad-track" aria-hidden="true"><i id="padView"></i></div>
    </div>
    <div class="row center"><button class="btn ghost" id="undo">復原一筆</button><button class="btn ghost" id="wclear">全部擦掉</button><button class="btn big" id="wdone">寫好了</button></div>`;
  const cv = $('#pad', el), ctx = cv.getContext('2d');
  const strokes = []; let cur = null;
  let offset = 0, target = 0, anim = 0;
  const btnL = $('#slideL', el), btnR = $('#slideR', el), view = $('#padView', el);
  const redraw = () => {
    drawStrip(ctx, strokes, { offset });
    // 下方的小進度條：目前看到的是整條手寫區的哪一段
    const total = Math.max(PAD_W, offset + PAD_W, inkRight(strokes) + 60);
    view.style.left = (offset / total * 100) + '%'; view.style.width = (PAD_W / total * 100) + '%';
  };
  const slideTo = x => {
    target = Math.max(0, Math.min(MAX_W - PAD_W, x));
    btnL.hidden = target <= 0; btnR.hidden = target >= MAX_W - PAD_W;
    btnR.classList.remove('nudge');
    cancelAnimationFrame(anim);
    const step = () => {
      offset += (target - offset) * (reduced ? 1 : 0.25);
      if (Math.abs(target - offset) < 1) offset = target;
      redraw();
      if (offset !== target) anim = requestAnimationFrame(step);
    };
    step();
  };
  btnR.addEventListener('click', () => { if (!q.done) slideTo(target + SLIDE); });
  btnL.addEventListener('click', () => slideTo(target - SLIDE));
  const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * PAD_W / r.width + offset, (e.clientY - r.top) * PAD_H / r.height]; };
  cv.addEventListener('pointerdown', e => { if (q.done) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); cur = [pt(e)]; strokes.push(cur); redraw(); });
  cv.addEventListener('pointermove', e => { if (!cur) return; cur.push(pt(e)); redraw(); });
  const end = () => {
    if (!cur) return;
    // 寫到靠近右邊時，三角形會跳動提醒可以往右滑
    if (cur.some(p => p[0] - offset > PAD_W * 0.78)) btnR.classList.add('nudge');
    cur = null;
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  $('#undo', el).addEventListener('click', () => { if (!q.done) { strokes.pop(); redraw(); } });
  $('#wclear', el).addEventListener('click', () => { if (!q.done) { strokes.length = 0; slideTo(0); } });
  $('#wdone', el).addEventListener('click', () => {
    if (q.done) return;
    if (!strokes.length) return toast('先寫寫看，再按「寫好了」');
    q.done = true;
    // 交作業的圖：只留有寫字的範圍，所有題目用同一個縮放比例
    const width = Math.min(MAX_W, Math.max(PAD_W / 2, inkRight(strokes) + 50));
    const snap = document.createElement('canvas');
    snap.width = Math.round(width * SNAP_SCALE); snap.height = Math.round(PAD_H * SNAP_SCALE);
    drawStrip(snap.getContext('2d'), strokes, { width, scale: SNAP_SCALE });
    q.snap = snap;
    $$('button', el).forEach(b => { if (!b.classList.contains('speak')) b.disabled = true; });
    sfx.good();
    showSheet('mid', '寫好了！對照看看拼字一樣嗎？', w);
    repeatAudio(w, 2);
  });
  redraw();
  later(() => sayBtn($('.speak.huge', el)), 300);
};
const SNAP_SCALE = 0.5;
function composeSheet(items, title) {
  // 每題的筆跡縮放比例都一樣（字一樣大），高度也一樣；由左往右排，放不下就換列
  const gap = 12, head = 64, lab = 30;
  const stripH = PAD_H * SNAP_SCALE;
  const longest = Math.max(...items.map(q => q.snap.width));
  const inner = Math.min(Math.max(PAD_W, longest), 2400);
  const cells = [];
  let x = gap, y = head;
  items.forEach((q, i) => {
    const w = Math.min(q.snap.width, inner), h = stripH;
    if (x > gap && x + w > gap + inner) { x = gap; y += lab + h + gap; }
    cells.push({ q, i, x, y, w, h });
    x += w + gap;
  });
  const c = document.createElement('canvas');
  c.width = inner + gap * 2; c.height = y + lab + stripH + gap * 2;
  const g = c.getContext('2d');
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#16204A'; g.font = 'bold 24px system-ui, "PingFang TC", "Microsoft JhengHei", sans-serif';
  g.fillText(`${user.name}　${title}`, gap, 34);
  g.font = '16px system-ui, sans-serif'; g.fillStyle = '#5B6690';
  const d = new Date(); g.fillText(`${dateKey(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}　聽音手寫 ${items.length} 題`, gap, 56);
  for (const { q, i, x: cx, y: cy, w, h } of cells) {
    g.fillStyle = '#5B6690'; g.font = '18px system-ui, "PingFang TC", "Microsoft JhengHei", sans-serif';
    g.fillText(`${i + 1}. ${q.word.en}（${q.word.zh}）`, cx + 4, cy + 22, w - 8);
    g.drawImage(q.snap, cx, cy + lab, w, h * (w / q.snap.width));
    g.strokeStyle = '#D5DDF5'; g.lineWidth = 2; g.strokeRect(cx, cy + lab, w, h * (w / q.snap.width));
  }
  // 控制在 Firestore 單一文件的大小內：先降畫質，再縮小尺寸
  let out = c, url = out.toDataURL('image/jpeg', 0.7);
  for (let k = 0; url.length > 800000 && k < 6; k++) {
    if (k === 0) { url = out.toDataURL('image/jpeg', 0.5); continue; }
    const s2 = document.createElement('canvas'); s2.width = Math.round(out.width * 0.8); s2.height = Math.round(out.height * 0.8);
    s2.getContext('2d').drawImage(out, 0, 0, s2.width, s2.height); out = s2;
    url = out.toDataURL('image/jpeg', 0.55);
  }
  return url;
}
async function renderWriteResult() {
  hideSheet();
  const r = round, done = r.queue.filter(q => q.snap);
  const image = composeSheet(done, r.title);
  app.innerHTML = `
  <section class="result">
    <div class="stars">${[0, 1, 2].map(i => `<span class="star on" style="--d:${0.2 + i * 0.25}s">★</span>`).join('')}</div>
    <h2>寫完 ${done.length} 題了！</h2>
    <p class="saved" id="saved">正在交給老師…</p>
    <div class="sheet-scroll"><img class="sheet-img" src="${image}" alt="這回合的手寫答案"></div>
    <div class="row center">
      <button class="btn big" data-act="again">再寫一回合</button>
      <button class="btn big ghost" data-act="back-deck">換個玩法</button>
    </div>
  </section>`;
  fitSheets();
  sfx.win(); later(() => burst(innerWidth / 2, innerHeight / 3, 30), 300);
  try {
    await be.submitWriting({ deckId: r.deckId, deckTitle: r.title, items: done.map(q => ({ deckId: q.word.deckId, wordId: q.word.id, en: q.word.en, zh: q.word.zh })), image });
    profile = await be.recordRound({ deckId: r.deckId, deckTitle: r.title, mode: 'write', total: done.length, correct: 0, graded: false, updates: [] });
    const el = $('#saved'); if (el) el.textContent = `已交給老師，批改後會出現在「我的紀錄」· 連續練習 ${profile.streak} 天`;
  } catch (e) {
    console.error(e);
    const el = $('#saved'); if (el) el.textContent = '沒有交出去：' + errMsg(e);
  }
}

// 作業圖片：一般寬度就縮放到容器寬；很長的句子作業則保持可讀的大小，讓人左右捲動
function fitSheets() {
  $$('.sheet-scroll img').forEach(img => {
    const fit = () => { const box = img.parentElement.clientWidth; img.style.width = img.naturalWidth > box * 1.4 ? Math.round(img.naturalWidth * 0.8) + 'px' : '100%'; };
    if (img.complete) fit(); else img.addEventListener('load', fit, { once: true });
  });
}
/* ---------- 手寫作業：老師批改、學生查看 ---------- */
function writingStatus(h) {
  if (!h.reviewedAt) return '<span class="tag draft">待批改</span>';
  return `<span class="tag ok">已批改 ${h.score ?? 0}/${h.items.length}</span>`;
}
function writingRows(list, showName) {
  return `<div class="wlist">${list.map(h => `
    <button class="wrow hw" data-act="open-writing" data-id="${esc(h.id)}">
      <div class="words">${showName ? `<b>${esc(h.name)}</b> · ` : ''}${esc(h.deckTitle || '')}<div class="muted" style="font-size:13px">${fmtTime(h.at)} · ${h.items.length} 題</div></div>
      ${writingStatus(h)}
    </button>`).join('')}</div>`;
}
async function renderReviewList() {
  app.innerHTML = '<p class="loading">載入手寫作業…</p>';
  const list = await be.listWritings(false);
  const todo = list.filter(h => !h.reviewedAt), done = list.filter(h => h.reviewedAt);
  app.innerHTML = `
  <section class="stack">
    <div class="section-title" style="margin-top:0"><h2>手寫作業</h2><small class="muted">待批改 ${todo.length} 份</small></div>
    ${todo.length ? writingRows(todo, true) : '<div class="empty">目前沒有待批改的作業。</div>'}
    ${done.length ? `<div class="section-title"><h2>已批改</h2></div>${writingRows(done, true)}` : ''}
  </section>`;
}
async function renderWriting(id) {
  app.innerHTML = '<p class="loading">載入作業…</p>';
  const h = await be.getWriting(id);
  if (!h) throw new Error('找不到這份作業，可能已經被刪除。');
  const teacher = user.isTeacher && route().a === 'review';
  const marks = Array.isArray(h.marks) ? [...h.marks] : h.items.map(() => null);
  const draw = () => {
    $('#marks').innerHTML = h.items.map((it, i) => `
      <div class="wrow">
        <div class="words"><span class="muted">${i + 1}.</span> <span class="en">${esc(it.en)}</span> <span class="zh">${esc(it.zh)}</span></div>
        ${teacher ? `<div class="row">
            <button class="mark ${marks[i] === true ? 'on good' : ''}" data-m="${i}" data-v="1" aria-label="第 ${i + 1} 題正確">✓</button>
            <button class="mark ${marks[i] === false ? 'on bad' : ''}" data-m="${i}" data-v="0" aria-label="第 ${i + 1} 題錯誤">✗</button></div>`
        : `<span class="mark on ${marks[i] === true ? 'good' : marks[i] === false ? 'bad' : ''}">${marks[i] === true ? '✓' : marks[i] === false ? '✗' : '–'}</span>`}
      </div>`).join('');
    const sc = $('#hwScore'); if (sc) sc.textContent = `${marks.filter(x => x === true).length} / ${h.items.length}`;
  };
  app.innerHTML = `
  <section class="stack">
    <button class="btn small ghost" data-act="${teacher ? 'review' : 'dash'}" style="justify-self:start">← ${teacher ? '所有手寫作業' : '我的紀錄'}</button>
    <div class="row between"><h2>${esc(h.name)} · ${esc(h.deckTitle || '')}</h2>${writingStatus(h)}</div>
    <p class="muted" style="margin:0">${fmtTime(h.at)} 交出${h.reviewedAt ? ` · ${esc(h.reviewer || '老師')} 批改於 ${fmtTime(h.reviewedAt)}` : ''}</p>
    <div class="dash-grid">
      <div class="card"><div class="sheet-scroll"><img class="sheet-img" src="${h.image}" alt="學生的手寫答案"></div></div>
      <div class="card stack">
        <div class="row between"><h3>${teacher ? '逐題批改' : '老師的批改'}</h3><b id="hwScore" class="acc"></b></div>
        ${teacher ? '<div class="row"><button class="btn small ghost" id="allRight">全部打 ✓</button></div>' : ''}
        <div class="wlist" id="marks"></div>
        ${teacher ? `<div class="row"><button class="btn" id="saveMarks">儲存批改</button>
          <a class="btn ghost" href="${h.image}" download="${esc(`${h.name}-${h.deckTitle || ''}-${dateKey(new Date(h.at))}.jpg`)}">下載圖片</a>
          <button class="btn ghost danger" id="delHw">刪除</button></div>
          <small class="muted">批改後，學生下次登入時寫錯的字會算進「常錯的字」，之後的練習會多出這些題目。</small>` : ''}
      </div>
    </div>
  </section>`;
  draw(); fitSheets();
  if (!teacher) return;
  $('#marks').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    const i = +b.dataset.m, v = b.dataset.v === '1';
    marks[i] = marks[i] === v ? null : v; sfx.tap(); draw();
  });
  $('#allRight').addEventListener('click', () => { marks.fill(true); draw(); });
  $('#saveMarks').addEventListener('click', async () => {
    if (marks.some(m => m === null)) return toast('還有題目沒批改喔');
    try { await be.reviewWriting(id, marks); toast('已儲存批改'); go('review'); } catch (err) { toast(errMsg(err)); }
  });
  $('#delHw').addEventListener('click', async e => {
    if (!confirmTwice(e.currentTarget, 'hw' + id, '再按一次刪除')) return;
    try { await be.deleteWriting(id); toast('已刪除'); go('review'); } catch (err) { toast(errMsg(err)); }
  });
}

/* ===================================================================== */
/* 預習（單字卡，不計分）                                                   */
/* ===================================================================== */
function renderStudy() {
  const w = study.list[study.i];
  app.innerHTML = `
  <section class="stack">
    <div class="playbar">
      <button class="icon-btn" data-act="back-deck" aria-label="結束練習模式">✕</button>
      <div class="track"><div class="fill" style="width:${(study.i + 1) / study.list.length * 100}%"></div></div>
      <span class="count">${study.i + 1}/${study.list.length}</span>
    </div>
    <div class="flash">
      ${visual(w)}
      <div class="big-en">${esc(w.en)}</div>
      <div>${posTag(w)} <span class="ipa">${esc(w.ipa || '')}</span></div>
      <div class="big-zh" style="font-size:36px">${esc(w.zh)}</div>
      <div class="row center">${speakBtn(w, 'en', '英文')}${speakBtn(w, 'zh', '中文')}</div>
    </div>
    <div class="row between">
      <button class="btn ghost" data-act="sprev" ${study.i === 0 ? 'disabled' : ''}>上一個</button>
      ${study.i + 1 < study.list.length ? '<button class="btn big" data-act="snext">下一個</button>' : '<button class="btn big sun" data-act="start" data-mode="mix">看完了，開始綜合挑戰！</button>'}
    </div>
  </section>`;
  const token = study.token = Symbol();
  later(async () => { await playWord(w, 'en'); if (study && study.token === token) { await new Promise(r => setTimeout(r, 350)); if (study && study.token === token) playWord(w, 'zh'); } }, 250);
}

/* ===================================================================== */
/* 儀表板                                                                 */
/* ===================================================================== */
function weakList() {
  return [...stats.values()]
    .filter(s => s.seen >= 1 && (s.lv || 0) < 4 && s.wrong > 0)
    .map(s => ({ ...s, acc: s.correct / s.seen }))
    .sort((a, b) => (a.lv || 0) - (b.lv || 0) || a.acc - b.acc || b.wrong - a.wrong);
}
async function renderDash() {
  app.innerHTML = '<p class="loading">整理你的練習紀錄…</p>';
  const WEEKS = 16;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - start.getDay() - (WEEKS - 1) * 7);
  const [days, sessions] = await Promise.all([be.getDays(dateKey(start)), be.getSessions(8), loadStats(), decks.length ? null : be.listDecks().then(d => { decks = d; })]);
  const byDay = new Map(days.map(d => [d.date, d]));
  const st = liveStreak(profile);
  const weak = weakList().slice(0, 10);
  const deckTitle = id => (decks.find(d => d.id === id) || {}).title || '';
  const lvl = n => (!n ? 0 : n <= 10 ? 1 : n <= 20 ? 2 : n <= 40 ? 3 : 4);
  const cells = [];
  for (let d = new Date(start); d <= today || d.getDay() !== 0; d.setDate(d.getDate() + 1)) {
    const k = dateKey(d), rec = byDay.get(k);
    if (d > today) { cells.push('<i class="future"></i>'); continue; }
    const label = `${d.getMonth() + 1}月${d.getDate()}日：${rec ? `作答 ${rec.answers || 0} 題，答對 ${rec.correct || 0} 題${rec.written ? `，手寫 ${rec.written} 題` : ''}` : '沒有練習'}`;
    cells.push(`<i class="l${lvl(rec && (rec.answers || 0) + (rec.written || 0))} ${k === dateKey(today) ? 'today' : ''}" data-tip="${label}" aria-label="${label}"></i>`);
  }
  const practicedDays = days.filter(d => d.answers > 0 || d.written > 0).length;
  const since30 = new Date(today); since30.setDate(since30.getDate() - 29);
  const recent30 = days.filter(d => d.date >= dateKey(since30) && ((d.answers || 0) + (d.written || 0)) > 0);
  const active30 = recent30.length;
  const avgPerDay = active30 ? Math.round(recent30.reduce((t, d) => t + (d.answers || 0) + (d.written || 0), 0) / active30) : 0;
  app.innerHTML = `
  <section class="stack">
    <div class="section-title" style="margin-top:0"><h2>個人練習紀錄</h2><small class="muted">${esc(user.name)}</small></div>
    <div class="tiles2">
      <div class="stat hot"><span class="k">連續練習</span><span class="v">${st} 天</span><span class="s">${profile.lastDate === dateKey() ? '今天已完成' : st ? '今天練習就能延續' : '今天開始新的連續紀錄'}</span></div>
      <div class="stat"><span class="k">平均每天練習</span><span class="v">${avgPerDay} 題</span><span class="s">${active30 ? `近 30 天裡有練習的 ${active30} 天` : '近 30 天還沒有練習'}</span></div>
    </div>
    <div class="card">
      <div class="row between"><h3>最近 ${WEEKS} 週</h3><small class="muted">練習了 ${practicedDays} 天</small></div>
      <div class="heat-wrap" style="margin-top:10px"><div class="heat" id="heat">${cells.join('')}</div></div>
      <div class="heat-legend">少 <i style="background:var(--heat-0)"></i><i style="background:var(--heat-1)"></i><i style="background:var(--heat-2)"></i><i style="background:var(--heat-3)"></i><i style="background:var(--heat-4)"></i> 多（每天作答題數）</div>
    </div>
    <div class="dash-grid">
      <div class="card stack">
        <div class="row between"><h3>最不熟的單字</h3>${weak.length ? '<button class="btn small sun" data-act="practice-weak">專練這些字</button>' : ''}</div>
        ${weak.length ? `<div class="weak-list">${weak.map(s => `
          <div class="wrow"><div class="words"><span class="en">${esc(s.en)}</span> <span class="zh">${esc(s.zh)}</span></div>
          <div class="acc">${Math.round(s.acc * 100)}%<small>${s.correct}/${s.seen} 答對</small></div>
          <button class="speak" data-act="say-text" data-text="${esc(s.en)}" aria-label="播放發音">${ICON.speaker}</button></div>`).join('')}</div>`
        : '<div class="empty" style="padding:18px">目前沒有常答錯的字，繼續保持！</div>'}
      </div>
      <div class="card stack">
        <h3>最近練習</h3>
        ${sessions.length ? `<div class="table-wrap"><table class="sessions"><thead><tr><th>時間</th><th>題型</th><th class="num">成績</th></tr></thead><tbody>
          ${sessions.map(s => `<tr><td>${fmtTime(s.at)}</td><td>${esc((MODES[s.mode] || {}).name || (s.mode === 'zh2en' || s.mode === 'en2zh' || s.mode === 'meaning' ? '中英選擇題' : ''))}</td><td class="num">${s.correct === null || s.correct === undefined ? `寫 ${s.total} 題` : `${s.correct}/${s.total}`}</td></tr>`).join('')}
          </tbody></table></div>` : '<div class="empty" style="padding:18px">還沒有練習紀錄。</div>'}
      </div>
    </div>
    <div class="card stack">
      <h3>我的手寫作業</h3>
      ${myWritings.length ? writingRows(myWritings.slice(0, 10), false) : '<div class="empty" style="padding:18px">還沒有交過手寫作業。在首頁選「手寫題」就可以開始。</div>'}
    </div>
    <div class="signout-zone"><small class="muted">目前登入：${esc(user.email)}</small><button class="btn ghost" data-act="signout">登出這個帳號</button></div>
  </section>`;
  const tip = $('#tip');
  const heat = $('#heat');
  const showTip = e => {
    const c = e.target.closest('[data-tip]'); if (!c) { tip.hidden = true; return; }
    const r = c.getBoundingClientRect();
    tip.textContent = c.dataset.tip; tip.hidden = false;
    tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px';
    tip.style.top = (r.top - tip.offsetHeight - 8) + 'px';
  };
  heat.addEventListener('pointerover', showTip);
  heat.addEventListener('click', showTip);
  heat.addEventListener('pointerleave', () => { tip.hidden = true; });
}
function fmtTime(ms) {
  if (!ms) return '';
  const d = new Date(ms), t = dateKey(d) === dateKey() ? '今天' : `${d.getMonth() + 1}/${d.getDate()}`;
  return `${t} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
async function practiceWeak() {
  const weak = weakList().slice(0, 10);
  const deckIds = [...new Set(weak.map(s => s.deckId))];
  const lists = await Promise.all(deckIds.map(id => be.getWords(id).catch(() => [])));
  const pool = lists.flat(); indexWords(pool);
  const forced = weak.map(s => pool.find(w => w.deckId === s.deckId && w.id === s.wordId)).filter(Boolean);
  if (forced.length < 1 || pool.length < 2) return toast('這些字所在的字卡組已經不存在了。');
  startRound({ mode: 'mix', pool, forced: shuffle(forced), title: '最不熟的字', deckId: deckIds.length === 1 ? deckIds[0] : 'mixed' });
}

/* ===================================================================== */
/* 老師：字卡組管理                                                        */
/* ===================================================================== */
async function renderTeach() {
  curDeck = null;
  app.innerHTML = '<p class="loading">載入字卡組…</p>';
  decks = await be.listDecks();
  app.innerHTML = `
  <section class="stack">
    <div class="section-title" style="margin-top:0"><h2>管理字卡組</h2></div>
    <form class="panel stack" id="newDeck" style="padding-block:16px">
      <h3>建立新的字卡組</h3>
      <div class="form-grid">
        <div class="field"><label for="nd-title">名稱</label><input id="nd-title" type="text" required placeholder="例如：七年級 Unit 3"></div>
        <div class="field"><label for="nd-desc">說明（選填）</label><input id="nd-desc" type="text" placeholder="例如：課本第 30–35 頁"></div>
      </div>
      <div><button class="btn" type="submit">建立並開始加入單字</button></div>
    </form>
    ${decks.length ? `<div class="decks">${decks.map(d => `
      <button class="deck" data-act="edit-deck" data-id="${esc(d.id)}">
        <div class="row between"><h3>${esc(d.title)}</h3><span class="tag ${d.published ? '' : 'draft'}">${d.published ? '已發布' : '未發布'}</span></div>
        <small class="muted">${d.wordCount || 0} 個單字</small>
      </button>`).join('')}</div>` : '<div class="empty">還沒有字卡組。</div>'}
    ${be.kind === 'demo' ? '' : `<div class="note"><b>發布</b>之後學生才看得到字卡組。老師名單在 Firebase 主控台的 <code>teachers</code> 集合裡管理。</div>`}
  </section>`;
  $('#newDeck').addEventListener('submit', async e => {
    e.preventDefault();
    const title = $('#nd-title').value.trim(); if (!title) return;
    try {
      const id = await be.createDeck({ title, description: $('#nd-desc').value.trim(), published: false });
      toast('已建立字卡組'); go('teach/' + encodeURIComponent(id));
    } catch (err) { toast(errMsg(err)); }
  });
}

const IPA_KEYS = ['ˈ', 'ˌ', 'ː', 'ə', 'æ', 'ɪ', 'i', 'ʊ', 'u', 'ʌ', 'ɑ', 'ɔ', 'ɛ', 'e', 'ɜ', 'ɚ', 'ɝ', 'θ', 'ð', 'ʃ', 'ʒ', 'tʃ', 'dʒ', 'ŋ', 'ɡ', 'aɪ', 'aʊ', 'ɔɪ', 'eɪ', 'oʊ'];
const POS = ['n.', 'v.', 'adj.', 'adv.', 'prep.', 'pron.', 'conj.', 'int.', 'phr.'];
let edit = null; // { deck, words, editingId, media:{img,enAudio,zhAudio} }

async function renderEditor(deckId) {
  app.innerHTML = '<p class="loading">載入字卡組…</p>';
  const [deck, words] = await Promise.all([be.getDeck(deckId), be.getWords(deckId)]);
  if (!deck) throw new Error('找不到這個字卡組。');
  edit = { deck, words, editingId: null, media: {} };
  indexWords(words);
  curDeck = null;
  app.innerHTML = `
  <section class="stack">
    <button class="btn small ghost" data-act="teach" style="justify-self:start">← 所有字卡組</button>
    <form class="panel stack" id="deckForm" style="padding-block:16px">
      <div class="form-grid">
        <div class="field"><label for="dk-title">字卡組名稱</label><input id="dk-title" type="text" required value="${esc(deck.title)}"></div>
        <div class="field"><label for="dk-desc">說明</label><input id="dk-desc" type="text" value="${esc(deck.description || '')}"></div>
      </div>
      <label class="row"><input type="checkbox" id="dk-pub" ${deck.published ? 'checked' : ''}> 發布給學生（勾選後學生才看得到）</label>
      <div class="row"><button class="btn" type="submit">儲存設定</button><button class="btn ghost" type="button" data-act="preview-deck">用學生畫面試玩</button></div>
    </form>

    <details class="panel" id="addPanel" open>
      <summary id="formTitle">新增單字</summary>
      <form id="wordForm" class="stack">
        <div class="form-grid">
          <div class="field"><label for="f-zh">中文單詞 *</label><input id="f-zh" type="text" required placeholder="蘋果"></div>
          <div class="field"><label for="f-en">英文單詞 *</label><input id="f-en" type="text" required placeholder="apple" autocapitalize="off" autocomplete="off" spellcheck="false"></div>
          <div class="field"><label for="f-pos">英文詞性</label><input id="f-pos" type="text" list="pos-list" placeholder="n."><datalist id="pos-list">${POS.map(p => `<option value="${p}">`).join('')}</datalist></div>
          <div class="field"><label for="f-ipa">英文音標</label><input id="f-ipa" type="text" placeholder="/ˈæp.əl/">
            <div class="ipa-keys" id="ipaKeys">${IPA_KEYS.map(k => `<button type="button" data-k="${k}">${k}</button>`).join('')}</div></div>
          <div class="field"><span class="lbl">輔助圖片</span><input id="f-img" type="file" accept="image/*"><div class="media-prev" id="p-img"></div></div>
          <div class="field"><span class="lbl">英文音檔（沒有的話用裝置語音念）</span><input id="f-enAudio" type="file" accept="audio/*"><div class="media-prev" id="p-enAudio"></div></div>
          <div class="field"><span class="lbl">中文音檔（沒有的話用裝置語音念）</span><input id="f-zhAudio" type="file" accept="audio/*"><div class="media-prev" id="p-zhAudio"></div></div>
          <div class="field"><span class="lbl">試聽</span><div class="row"><button class="btn small ghost" type="button" data-act="test-say" data-lang="en">念英文</button><button class="btn small ghost" type="button" data-act="test-say" data-lang="zh">念中文</button></div></div>
        </div>
        <div class="row"><button class="btn" type="submit" id="saveWord">加入單字</button><button class="btn ghost" type="button" id="cancelEdit" hidden>取消編輯</button></div>
        <small class="muted">圖片會自動縮小。音檔每個 300KB 以內（單字音檔通常只有 10–50KB）。</small>
      </form>
    </details>

    <details class="panel" id="batchPanel">
      <summary>批次匯入（Excel／CSV ＋ 音檔、圖片）</summary>
      <div class="stack">
        <p style="margin:0">在 Excel 或 Google 試算表依照下面的欄位排好，可以直接複製貼上，或存成 CSV 上傳。第一列是標題列。</p>
        <div class="code">中文,英文,詞性,音標,中文音檔,英文音檔,圖片
蘋果,apple,n.,/ˈæp.əl/,apple_zh.mp3,apple.mp3,apple.jpg
跑,run,v.,/rʌn/,,,</div>
        <p class="muted" style="margin:0;font-size:14px">音檔和圖片欄填檔名，再把那些檔案一起選進來。檔名欄空白時，會自動找：英文音檔「apple.mp3」、中文音檔「蘋果.mp3」或「apple_zh.mp3」、圖片「apple.jpg」。</p>
        <div class="field"><label for="b-text">貼上表格內容</label><textarea id="b-text" placeholder="從 Excel 複製後貼在這裡"></textarea></div>
        <div class="form-grid">
          <div class="field"><span class="lbl">或上傳 CSV 檔</span><input id="b-csv" type="file" accept=".csv,.tsv,.txt,text/csv"></div>
          <div class="field"><span class="lbl">音檔和圖片（可一次選很多個）</span><input id="b-media" type="file" multiple accept="audio/*,image/*"></div>
        </div>
        <div><button class="btn" type="button" id="b-go">開始匯入</button></div>
        <div class="out" id="b-out" hidden></div>
      </div>
    </details>

    <div class="section-title"><h2>單字 <span class="tag" id="wcount">${words.length}</span></h2></div>
    <div class="wlist" id="wlist"></div>
    <div class="row" style="margin-top:20px"><button class="btn ghost danger" data-act="del-deck" id="delDeck">刪除整個字卡組</button></div>
  </section>`;
  drawWordList();
  bindEditor();
}

function drawWordList() {
  const el = $('#wlist'); if (!el) return;
  $('#wcount').textContent = edit.words.length;
  el.innerHTML = edit.words.length ? edit.words.map(w => `
    <div class="wl" data-id="${esc(w.id)}">
      <div class="thumb">${visual(w, '')}</div>
      <div class="words"><span class="en">${esc(w.en)}</span> ${posTag(w)} <span class="ipa">${esc(w.ipa || '')}</span><div class="zh">${esc(w.zh)}</div></div>
      <div class="acts">
        ${speakBtn(w, 'en', w.enAudio ? '英' : '英（語音）')}${speakBtn(w, 'zh', w.zhAudio ? '中' : '中（語音）')}
        <button class="btn small ghost" data-act="edit-word" data-id="${esc(w.id)}">編輯</button>
        <button class="btn small ghost danger" data-act="del-word" data-id="${esc(w.id)}">刪除</button>
      </div>
    </div>`).join('') : '<div class="empty">還沒有單字。用上面的表單新增，或批次匯入。</div>';
}

function bindEditor() {
  const deckId = edit.deck.id;
  $('#deckForm').addEventListener('submit', async e => {
    e.preventDefault();
    const patch = { title: $('#dk-title').value.trim(), description: $('#dk-desc').value.trim(), published: $('#dk-pub').checked };
    if (!patch.title) return;
    try { await be.updateDeck(deckId, patch); Object.assign(edit.deck, patch); toast(patch.published ? '已儲存，學生看得到這組了' : '已儲存（未發布，學生看不到）'); }
    catch (err) { toast(errMsg(err)); }
  });
  $('#ipaKeys').addEventListener('click', e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const inp = $('#f-ipa'), s = inp.selectionStart ?? inp.value.length, en = inp.selectionEnd ?? s;
    inp.value = inp.value.slice(0, s) + b.dataset.k + inp.value.slice(en);
    inp.focus(); inp.setSelectionRange(s + b.dataset.k.length, s + b.dataset.k.length);
  });
  for (const k of ['img', 'enAudio', 'zhAudio']) {
    $('#f-' + k).addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      try { edit.media[k] = k === 'img' ? await processImage(f) : await processAudio(f); drawMedia(k); }
      catch (err) { toast(errMsg(err)); e.target.value = ''; }
    });
  }
  $('#cancelEdit').addEventListener('click', resetWordForm);
  $('#wordForm').addEventListener('submit', async e => {
    e.preventDefault();
    const w = {
      id: edit.editingId || undefined,
      zh: $('#f-zh').value.trim(), en: $('#f-en').value.trim(), pos: $('#f-pos').value.trim(), ipa: $('#f-ipa').value.trim(),
      img: edit.media.img, enAudio: edit.media.enAudio, zhAudio: edit.media.zhAudio,
    };
    if (!w.zh || !w.en) return toast('中文和英文都要填');
    const old = edit.words.find(x => x.id === w.id);
    if (old) { w.order = old.order; if (old.emoji) w.emoji = old.emoji; }
    const btn = $('#saveWord'); btn.disabled = true;
    try {
      const id = await be.saveWord(deckId, w);
      const saved = { ...w, id, deckId };
      if (old) Object.assign(old, saved); else edit.words.push(saved);
      indexWords([saved]);
      toast(old ? `已更新 ${w.en}` : `已加入 ${w.en}`);
      resetWordForm(); drawWordList(); $('#f-zh').focus();
    } catch (err) { toast(errMsg(err), 4000); }
    finally { btn.disabled = false; }
  });
  $('#b-csv').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    $('#b-text').value = await readTextSmart(f);
  });
  $('#b-go').addEventListener('click', () => batchImport(deckId));
}
function drawMedia(k) {
  const v = edit.media[k], el = $('#p-' + k); if (!el) return;
  if (!v) { el.innerHTML = ''; return; }
  el.innerHTML = (k === 'img' ? `<img src="${v}" alt="">` : `<button type="button" class="btn small ghost" data-act="play-src" data-k="${k}">▶ 播放</button>`)
    + ` <span>${Math.round(v.length * 0.75 / 1024)}KB</span> <button type="button" class="btn small ghost danger" data-act="rm-media" data-k="${k}">移除</button>`;
}
function resetWordForm() {
  edit.editingId = null; edit.media = {};
  $('#wordForm').reset();
  ['img', 'enAudio', 'zhAudio'].forEach(drawMedia);
  $('#formTitle').textContent = '新增單字'; $('#saveWord').textContent = '加入單字'; $('#cancelEdit').hidden = true;
}
function startEditWord(id) {
  const w = edit.words.find(x => x.id === id); if (!w) return;
  edit.editingId = id; edit.media = { img: w.img, enAudio: w.enAudio, zhAudio: w.zhAudio };
  $('#f-zh').value = w.zh; $('#f-en').value = w.en; $('#f-pos').value = w.pos || ''; $('#f-ipa').value = w.ipa || '';
  ['img', 'enAudio', 'zhAudio'].forEach(k => { $('#f-' + k).value = ''; drawMedia(k); });
  $('#formTitle').textContent = `編輯：${w.en}`; $('#saveWord').textContent = '儲存修改'; $('#cancelEdit').hidden = false;
  $('#addPanel').open = true; $('#addPanel').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}

/* ---------- 檔案處理 ---------- */
const AUDIO_MAX = 300 * 1024;
const readURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
async function processImage(f) {
  const url = await readURL(f);
  if (f.type === 'image/gif' || f.type === 'image/svg+xml') {
    if (f.size > 250 * 1024) throw new Error(`圖片「${f.name}」太大，GIF／SVG 請小於 250KB。`);
    return url;
  }
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`看不懂圖片「${f.name}」`)); i.src = url; });
  const max = 480, s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  let out = c.toDataURL('image/webp', 0.82);
  if (!out.startsWith('data:image/webp')) out = f.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85);
  return out;
}
async function processAudio(f) {
  if (f.size > AUDIO_MAX) throw new Error(`音檔「${f.name}」有 ${Math.round(f.size / 1024)}KB，超過 300KB。請剪短或轉成 MP3。`);
  return readURL(f);
}
async function readTextSmart(f) {
  const buf = await f.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); }
  catch { return new TextDecoder('big5').decode(buf); } // 舊版 Excel 存的中文 CSV
}
function parseTable(text) {
  const first = text.split(/\r?\n/)[0] || '';
  const delim = first.includes('\t') ? '\t' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"' && cell === '') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(c => c.trim())).filter(r => r.some(c => c));
}
const HEADERS = {
  zh: ['中文', '中文單詞', '中文單字', '中文意思', 'chinese', 'zh'],
  en: ['英文', '英文單詞', '英文單字', 'english', 'en', 'word'],
  pos: ['詞性', '英文詞性', 'pos', 'part of speech'],
  ipa: ['音標', '英文音標', 'kk', 'ipa', 'phonetic'],
  zhAudio: ['中文音檔', '中文發音', 'chinese audio', 'zh audio'],
  enAudio: ['英文音檔', '英文發音', 'english audio', 'en audio', 'audio'],
  img: ['圖片', '輔助圖片', '圖', 'image', 'picture', 'img'],
};
const DEFAULT_ORDER = ['zh', 'en', 'pos', 'ipa', 'zhAudio', 'enAudio', 'img'];

async function batchImport(deckId) {
  const out = $('#b-out'), btn = $('#b-go');
  const say = t => { out.hidden = false; out.textContent = t; };
  const rows = parseTable($('#b-text').value);
  if (!rows.length) return say('沒有讀到任何資料。請貼上表格內容或選擇 CSV 檔。');
  let cols = DEFAULT_ORDER, body = rows;
  const head = rows[0].map(h => h.toLowerCase());
  const found = {};
  head.forEach((h, i) => { for (const [k, names] of Object.entries(HEADERS)) if (names.includes(h) && found[k] === undefined) found[k] = i; });
  if (found.zh !== undefined || found.en !== undefined) { cols = null; body = rows.slice(1); }
  const get = (r, k) => (cols ? r[cols.indexOf(k)] : r[found[k]]) || '';

  const files = [...$('#b-media').files];
  const byName = new Map(), byBase = new Map();
  const isAudio = f => f.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|aac|webm)$/i.test(f.name);
  const isImage = f => f.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|svg)$/i.test(f.name);
  for (const f of files) {
    const n = f.name.normalize('NFC').toLowerCase();
    byName.set(n, f);
    const base = n.replace(/\.[^.]+$/, '');
    (byBase.get(base) || byBase.set(base, []).get(base)).push(f);
  }
  const find = (name, kind, guesses) => {
    const test = kind === 'img' ? isImage : isAudio;
    if (name) {
      const n = name.normalize('NFC').toLowerCase();
      const f = byName.get(n) || (byBase.get(n) || []).find(test);
      return f ? { f } : { missing: name };
    }
    for (const g of guesses) { const f = (byBase.get(g.normalize('NFC').toLowerCase()) || []).find(test); if (f) return { f }; }
    return {};
  };

  btn.disabled = true;
  const log = [], missing = [];
  let ok = 0, nImg = 0, nEn = 0, nZh = 0;
  for (let i = 0; i < body.length; i++) {
    const r = body[i];
    const w = { zh: get(r, 'zh'), en: get(r, 'en'), pos: get(r, 'pos'), ipa: get(r, 'ipa') };
    if (!w.zh || !w.en) { log.push(`第 ${i + 1} 列缺少中文或英文，略過。`); continue; }
    say(`匯入中… ${i + 1} / ${body.length}：${w.en}`);
    const en = w.en.toLowerCase();
    const plan = {
      img: find(get(r, 'img'), 'img', [en, w.zh, en.replace(/\s+/g, '_'), en.replace(/\s+/g, '-')]),
      enAudio: find(get(r, 'enAudio'), 'audio', [en, en + '_en', en + '-en', en.replace(/\s+/g, '_'), en.replace(/\s+/g, '-')]),
      zhAudio: find(get(r, 'zhAudio'), 'audio', [w.zh, en + '_zh', en + '-zh', en + '_cn', en + '_ch']),
    };
    try {
      for (const [k, p] of Object.entries(plan)) {
        if (p.missing) missing.push(p.missing);
        if (p.f) w[k] = k === 'img' ? await processImage(p.f) : await processAudio(p.f);
      }
      const id = await be.saveWord(deckId, w);
      const saved = { ...w, id, deckId };
      edit.words.push(saved); indexWords([saved]);
      ok++; if (w.img) nImg++; if (w.enAudio) nEn++; if (w.zhAudio) nZh++;
    } catch (err) { log.push(`「${w.en}」沒有匯入：${errMsg(err)}`); }
  }
  btn.disabled = false;
  drawWordList();
  say([`完成！匯入 ${ok} 個單字，其中 ${nImg} 個有圖片、${nEn} 個有英文音檔、${nZh} 個有中文音檔。`,
    missing.length ? `找不到這些檔案（請確認有一起選進來）：${[...new Set(missing)].join('、')}` : '',
    ...log].filter(Boolean).join('\n'));
}

/* ===================================================================== */
/* 點擊事件                                                               */
/* ===================================================================== */
const pending = new Map(); // 兩段式刪除
function confirmTwice(btn, key, label) {
  if (pending.get(key)) { pending.delete(key); return true; }
  const old = btn.textContent; btn.textContent = label; pending.set(key, true);
  setTimeout(() => { pending.delete(key); if (btn.isConnected) btn.textContent = old; }, 3500);
  return false;
}
function sayBtn(b) {
  if (!b) return;
  const w = wordIndex.get(b.dataset.key);
  b.classList.add('playing');
  playWord(w, b.dataset.lang).finally(() => b.classList.remove('playing'));
}

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  try {
    switch (act) {
      case 'home': return go('');
      case 'dash': return go('dash');
      case 'teach': return go('teach');
      case 'review': return go('review');
      case 'open-writing': return go((user.isTeacher && route().a === 'review' ? 'review/' : 'writing/') + encodeURIComponent(b.dataset.id));
      case 'signin': return await be.signIn();
      case 'demo-login': return await be.signIn(b.dataset.role);
      case 'demo-reset': be.reset(); location.reload(); return;
      case 'signout': stats = new Map(); profile = {}; curDeck = null; return await be.signOut();
      case 'edit-deck': return go('teach/' + encodeURIComponent(b.dataset.id));
      case 'say': return sayBtn(b);
      case 'say-text': return speakText(b.dataset.text, 'en');
      case 'start': {
        await loadAllWords();
        if (curWords.length < 2) return toast('單字太少，還不能出題');
        return startRound({ mode: b.dataset.mode, pool: curWords, forced: null, title: ALL.title, deckId: ALL.id });
      }
      case 'next': return nextQ();
      case 'quit':
        if (round && round.pending.size) return toast(`還有 ${round.pending.size} 個答錯的字要訂正，完成後才能結束這一輪`, 3200);
        return go('');
      case 'back-deck': return go('');
      case 'again': { const a = round.retryArgs; return startRound({ ...a, forced: a.forced ? shuffle(a.forced) : null }); }
      case 'study': await loadAllWords(); study = { list: shuffle(curWords), i: 0 }; return renderStudy();
      case 'snext': study.i++; return renderStudy();
      case 'sprev': study.i = Math.max(0, study.i - 1); return renderStudy();
      case 'practice-weak': return await practiceWeak();
      case 'test-say': {
        const w = { en: $('#f-en').value.trim() || 'apple', zh: $('#f-zh').value.trim() || '蘋果', enAudio: edit.media.enAudio, zhAudio: edit.media.zhAudio };
        return playWord(w, b.dataset.lang);
      }
      case 'play-src': return playWord({ en: '', zh: '', [b.dataset.k]: edit.media[b.dataset.k] }, b.dataset.k === 'enAudio' ? 'en' : 'zh');
      case 'rm-media': edit.media[b.dataset.k] = null; $('#f-' + b.dataset.k).value = ''; return drawMedia(b.dataset.k);
      case 'edit-word': return startEditWord(b.dataset.id);
      case 'del-word': {
        if (!confirmTwice(b, 'w' + b.dataset.id, '確定刪除？')) return;
        await be.deleteWord(edit.deck.id, b.dataset.id);
        edit.words = edit.words.filter(w => w.id !== b.dataset.id);
        if (edit.editingId === b.dataset.id) resetWordForm();
        drawWordList(); return toast('已刪除');
      }
      case 'del-deck': {
        if (!confirmTwice(b, 'deck', `再按一次就會刪除「${edit.deck.title}」和裡面全部 ${edit.words.length} 個單字`)) return;
        await be.deleteDeck(edit.deck.id); toast('已刪除字卡組'); return go('teach');
      }
      case 'preview-deck': curDeck = null; return go('');
    }
  } catch (err) { console.error(err); toast(errMsg(err), 4000); }
});
document.addEventListener('keydown', e => {
  if (!round || e.target.closest('input, textarea')) return;
  const q = round.queue[round.idx];
  if (!$('#sheet').hidden && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return nextQ(); }
  if (q && q.onKey) q.onKey(e);
  else if (q && !q.done && /^[1-4]$/.test(e.key)) $$('.opt')[+e.key - 1]?.click();
});

/* ===================================================================== */
/* 啟動                                                                   */
/* ===================================================================== */
(async function boot() {
  try { be = firebaseConfig ? await createFirebaseBackend(firebaseConfig) : createDemoBackend(); }
  catch (e) {
    console.error(e);
    app.innerHTML = `<div class="empty"><p>連不上 Firebase：${esc(e.message)}</p><p>請檢查 js/config.js 的設定是否正確。</p></div>`;
    return;
  }
  be.init(u => { user = u; stats = new Map(); profile = {}; decks = []; curDeck = null; render(); });
})();
