// 資料層：同一組介面，兩種實作。
// - Firebase：正式上線用（Google 登入 + Firestore）
// - Demo：還沒設定 Firebase 時使用，資料存在瀏覽器的 localStorage

export const MAX_WORD_BYTES = 950_000; // Firestore 單一文件上限 1 MiB，保留一點空間

export function dateKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function prevDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}

// 依「上次練習日期」更新連續天數
export function applyStreak(profile, today = dateKey()) {
  const p = { streak: 0, longest: 0, lastDate: null, totalAnswers: 0, totalCorrect: 0, totalRounds: 0, ...profile };
  if (p.lastDate === today) { /* 今天已經算過 */ }
  else if (p.lastDate === prevDateKey(today)) p.streak += 1;
  else p.streak = 1;
  p.lastDate = today;
  p.longest = Math.max(p.longest || 0, p.streak);
  return p;
}
// 顯示用：如果昨天和今天都沒練習，連續天數歸零
export function liveStreak(profile, today = dateKey()) {
  if (!profile || !profile.lastDate) return 0;
  if (profile.lastDate === today || profile.lastDate === prevDateKey(today)) return profile.streak || 0;
  return 0;
}

function wordBytes(w) { return new Blob([JSON.stringify(w)]).size; }
function checkSize(w) {
  if (wordBytes(w) > MAX_WORD_BYTES) {
    throw new Error(`「${w.en}」的圖片和音檔加起來太大了（上限約 900KB），請換小一點的檔案。`);
  }
}
function cleanWord(w) {
  const out = {};
  for (const k of ['en', 'zh', 'pos', 'ipa', 'img', 'enAudio', 'zhAudio', 'emoji', 'order']) {
    if (w[k] !== undefined && w[k] !== null && w[k] !== '') out[k] = w[k];
  }
  return out;
}
function wordUpdateData(u) {
  return { deckId: u.deckId, wordId: u.wordId, en: u.en, zh: u.zh, lv: u.lv };
}
function aggregate(updates) {
  // 同一回合同一個字可能出現兩次，合併成一筆
  const map = new Map();
  for (const u of updates) {
    const key = `${u.deckId}__${u.wordId}`;
    const cur = map.get(key) || { key, deckId: u.deckId, wordId: u.wordId, en: u.en, zh: u.zh, seen: 0, correct: 0, wrong: 0 };
    cur.seen += 1; if (u.ok) cur.correct += 1; else cur.wrong += 1;
    cur.lv = u.lv;
    map.set(key, cur);
  }
  return [...map.values()];
}

/* ===================================================================== */
/* Firebase                                                               */
/* ===================================================================== */
export async function createFirebaseBackend(cfg) {
  const V = '10.12.2';
  const base = `https://www.gstatic.com/firebasejs/${V}/`;
  const [{ initializeApp }, A, F] = await Promise.all([
    import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  let user = null;
  const ms = t => (t && t.toMillis ? t.toMillis() : (t || 0));
  const uref = (...p) => F.doc(db, 'users', user.uid, ...p);

  return {
    kind: 'firebase',
    init(cb) {
      A.onAuthStateChanged(auth, async u => {
        if (!u) { user = null; cb(null); return; }
        let isTeacher = false;
        try { isTeacher = (await F.getDoc(F.doc(db, 'teachers', u.email))).exists(); } catch { /* 不是老師時規則會拒絕讀取 */ }
        user = { uid: u.uid, name: u.displayName || u.email, email: u.email, photo: u.photoURL, isTeacher };
        F.setDoc(uref(), { name: user.name, email: u.email, photo: u.photoURL || '', lastLogin: F.serverTimestamp() }, { merge: true }).catch(() => {});
        cb(user);
      });
    },
    async signIn() {
      const p = new A.GoogleAuthProvider();
      p.setCustomParameters({ prompt: 'select_account' });
      try { await A.signInWithPopup(auth, p); }
      catch (e) {
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return A.signInWithRedirect(auth, p);
        if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
        throw e;
      }
    },
    signOut: () => A.signOut(auth),

    async listDecks() {
      const col = F.collection(db, 'decks');
      const snap = await F.getDocs(user.isTeacher ? col : F.query(col, F.where('published', '==', true)));
      return snap.docs.map(d => ({ id: d.id, ...d.data(), updatedAt: ms(d.data().updatedAt) }))
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || b.updatedAt - a.updatedAt);
    },
    async getDeck(id) {
      const s = await F.getDoc(F.doc(db, 'decks', id));
      return s.exists() ? { id: s.id, ...s.data(), updatedAt: ms(s.data().updatedAt) } : null;
    },
    async getWords(deckId) {
      const snap = await F.getDocs(F.collection(db, 'decks', deckId, 'words'));
      return snap.docs.map(d => ({ id: d.id, deckId, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
    },
    async createDeck(data) {
      const ref = await F.addDoc(F.collection(db, 'decks'), {
        title: data.title, description: data.description || '', published: !!data.published, wordCount: 0,
        owner: user.email, createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp(),
      });
      return ref.id;
    },
    async updateDeck(id, patch) {
      await F.updateDoc(F.doc(db, 'decks', id), { ...patch, updatedAt: F.serverTimestamp() });
    },
    async deleteDeck(id) {
      const snap = await F.getDocs(F.collection(db, 'decks', id, 'words'));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const b = F.writeBatch(db);
        snap.docs.slice(i, i + 400).forEach(d => b.delete(d.ref));
        await b.commit();
      }
      await F.deleteDoc(F.doc(db, 'decks', id));
    },
    async saveWord(deckId, word) {
      const data = cleanWord(word);
      checkSize(data);
      const deckRef = F.doc(db, 'decks', deckId);
      if (word.id) {
        await F.setDoc(F.doc(db, 'decks', deckId, 'words', word.id), data);
        await F.updateDoc(deckRef, { updatedAt: F.serverTimestamp() });
        return word.id;
      }
      data.order = data.order || Date.now();
      const ref = F.doc(F.collection(db, 'decks', deckId, 'words'));
      const b = F.writeBatch(db);
      b.set(ref, data);
      b.update(deckRef, { wordCount: F.increment(1), updatedAt: F.serverTimestamp() });
      await b.commit();
      return ref.id;
    },
    async deleteWord(deckId, wordId) {
      const b = F.writeBatch(db);
      b.delete(F.doc(db, 'decks', deckId, 'words', wordId));
      b.update(F.doc(db, 'decks', deckId), { wordCount: F.increment(-1), updatedAt: F.serverTimestamp() });
      await b.commit();
    },

    // 指定字卡組：assignments/{uid} = { decks: [字卡組 id] }；沒有這筆就是練習全部已發布的字卡組
    async listStudents() {
      const snap = await F.getDocs(F.collection(db, 'users'));
      return snap.docs.map(d => ({ uid: d.id, ...d.data(), lastLogin: ms(d.data().lastLogin) }));
    },
    async listAssignments() {
      const snap = await F.getDocs(F.collection(db, 'assignments'));
      return Object.fromEntries(snap.docs.map(d => [d.id, d.data().decks || []]));
    },
    async setAssignments(uids, deckIds) {
      for (let i = 0; i < uids.length; i += 400) {
        const b = F.writeBatch(db);
        uids.slice(i, i + 400).forEach(uid => {
          const ref = F.doc(db, 'assignments', uid);
          if (deckIds && deckIds.length) b.set(ref, { decks: deckIds, by: user.email, updatedAt: F.serverTimestamp() });
          else b.delete(ref);
        });
        await b.commit();
      }
    },
    async getMyDecks() {
      try { const s = await F.getDoc(F.doc(db, 'assignments', user.uid)); return s.exists() ? (s.data().decks || null) : null; }
      catch { return null; }
    },

    async getProfile() {
      const s = await F.getDoc(uref());
      return s.exists() ? s.data() : {};
    },
    async getDays(fromKey) {
      const snap = await F.getDocs(F.query(F.collection(db, 'users', user.uid, 'days'), F.where('date', '>=', fromKey)));
      return snap.docs.map(d => d.data());
    },
    async getWordStats() {
      const snap = await F.getDocs(F.collection(db, 'users', user.uid, 'words'));
      return snap.docs.map(d => ({ key: d.id, ...d.data(), lastSeen: ms(d.data().lastSeen) }));
    },
    async getSessions(n = 10) {
      const snap = await F.getDocs(F.query(F.collection(db, 'users', user.uid, 'sessions'), F.orderBy('at', 'desc'), F.limit(n)));
      return snap.docs.map(d => ({ ...d.data(), at: ms(d.data().at) }));
    },
    async recordRound(r) {
      const today = dateKey();
      const prof = applyStreak(await this.getProfile(), today);
      const graded = r.graded !== false;
      if (graded) {
        prof.totalAnswers = (prof.totalAnswers || 0) + r.total;
        prof.totalCorrect = (prof.totalCorrect || 0) + r.correct;
      }
      prof.totalRounds = (prof.totalRounds || 0) + 1;
      const b = F.writeBatch(db);
      b.set(uref(), {
        streak: prof.streak, longest: prof.longest, lastDate: prof.lastDate,
        totalAnswers: prof.totalAnswers, totalCorrect: prof.totalCorrect, totalRounds: prof.totalRounds,
      }, { merge: true });
      b.set(uref('days', today), graded
        ? { date: today, answers: F.increment(r.total), correct: F.increment(r.correct), rounds: F.increment(1) }
        : { date: today, written: F.increment(r.total), rounds: F.increment(1) }, { merge: true });
      b.set(F.doc(F.collection(db, 'users', user.uid, 'sessions')), {
        deckId: r.deckId, deckTitle: r.deckTitle, mode: r.mode, total: r.total, correct: graded ? r.correct : null, best: r.best || 0, at: F.serverTimestamp(),
      });
      for (const u of aggregate(r.updates)) {
        b.set(uref('words', u.key), {
          ...wordUpdateData(u),
          seen: F.increment(u.seen), correct: F.increment(u.correct), wrong: F.increment(u.wrong), lastSeen: F.serverTimestamp(),
        }, { merge: true });
      }
      await b.commit();
      return prof;
    },

    // ---- 手寫作業：清單資料放 writings，圖片另外放 writingImages（列清單時不用下載圖片）
    async submitWriting(d) {
      const ref = F.doc(F.collection(db, 'writings'));
      const meta = { uid: user.uid, name: user.name, email: user.email, deckId: d.deckId, deckTitle: d.deckTitle, items: d.items, at: F.serverTimestamp(), marks: null, score: null, reviewedAt: null, applied: false };
      if (new Blob([d.image]).size > MAX_WORD_BYTES) throw new Error('手寫圖片太大，無法上傳。');
      const b = F.writeBatch(db);
      b.set(ref, meta);
      b.set(F.doc(db, 'writingImages', ref.id), { uid: user.uid, image: d.image });
      await b.commit();
      return ref.id;
    },
    async listWritings(mine) {
      const col = F.collection(db, 'writings');
      const snap = await F.getDocs(mine ? F.query(col, F.where('uid', '==', user.uid)) : F.query(col, F.orderBy('at', 'desc'), F.limit(100)));
      return snap.docs.map(d => ({ id: d.id, ...d.data(), at: ms(d.data().at), reviewedAt: ms(d.data().reviewedAt) })).sort((a, b) => b.at - a.at);
    },
    async getWriting(id) {
      const [m, img] = await Promise.all([F.getDoc(F.doc(db, 'writings', id)), F.getDoc(F.doc(db, 'writingImages', id))]);
      if (!m.exists()) return null;
      return { id, ...m.data(), at: ms(m.data().at), reviewedAt: ms(m.data().reviewedAt), image: img.exists() ? img.data().image : '' };
    },
    async reviewWriting(id, marks) {
      await F.updateDoc(F.doc(db, 'writings', id), { marks, score: marks.filter(x => x === true).length, reviewedAt: F.serverTimestamp(), reviewer: user.name, applied: false });
    },
    async deleteWriting(id) {
      const b = F.writeBatch(db);
      b.delete(F.doc(db, 'writings', id)); b.delete(F.doc(db, 'writingImages', id));
      await b.commit();
    },
    // 學生把老師批改的結果併入自己的熟練度
    async applyReview(id, updates) {
      const b = F.writeBatch(db);
      for (const u of aggregate(updates)) {
        b.set(uref('words', u.key), { ...wordUpdateData(u), seen: F.increment(u.seen), correct: F.increment(u.correct), wrong: F.increment(u.wrong), lastSeen: F.serverTimestamp() }, { merge: true });
      }
      b.update(F.doc(db, 'writings', id), { applied: true });
      await b.commit();
    },
  };
}

/* ===================================================================== */
/* Demo（localStorage）                                                   */
/* ===================================================================== */
const DEMO_KEY = 'vocab-demo-v1';
const DEMO_USERS = {
  student: { uid: 'demo-student', name: '示範學生 小安', email: 'student@example.com', isTeacher: false },
  teacher: { uid: 'demo-teacher', name: '示範老師', email: 'teacher@example.com', isTeacher: true },
};
const SAMPLE_DECKS = [
  { id: 'd-fruit', title: '水果與食物', description: '範例字卡組：常見的水果和食物', words: [
    ['apple', '蘋果', 'n.', '/ˈæp.əl/', '🍎'], ['banana', '香蕉', 'n.', '/bəˈnæn.ə/', '🍌'], ['grape', '葡萄', 'n.', '/ɡreɪp/', '🍇'],
    ['bread', '麵包', 'n.', '/bred/', '🍞'], ['ice cream', '冰淇淋', 'n.', '/ˌaɪs ˈkriːm/', '🍦'], ['egg', '蛋', 'n.', '/eɡ/', '🥚'],
    ['milk', '牛奶', 'n.', '/mɪlk/', '🥛'], ['carrot', '紅蘿蔔', 'n.', '/ˈkær.ət/', '🥕'] ] },
  { id: 'd-animal', title: '動物與動作', description: '範例字卡組：動物、動作和心情', words: [
    ['cat', '貓', 'n.', '/kæt/', '🐱'], ['dog', '狗', 'n.', '/dɔːɡ/', '🐶'], ['rabbit', '兔子', 'n.', '/ˈræb.ɪt/', '🐰'],
    ['run', '跑', 'v.', '/rʌn/', '🏃'], ['swim', '游泳', 'v.', '/swɪm/', '🏊'], ['sleep', '睡覺', 'v.', '/sliːp/', '😴'],
    ['happy', '快樂的', 'adj.', '/ˈhæp.i/', '😄'], ['angry', '生氣的', 'adj.', '/ˈæŋ.ɡri/', '😠'] ] },
];

function seedDemo() {
  const db = { decks: {}, users: {}, current: null };
  SAMPLE_DECKS.forEach((d, di) => {
    const words = {};
    d.words.forEach(([en, zh, pos, ipa, emoji], i) => { words[`${d.id}-w${i}`] = { en, zh, pos, ipa, emoji, order: i }; });
    db.decks[d.id] = { title: d.title, description: d.description, published: true, wordCount: d.words.length, sort: di, updatedAt: Date.now() - di * 1000, words };
  });
  // 示範學生：放一些過去的練習紀錄，讓儀表板有東西看
  const days = {}, sessions = [], wstats = {};
  const today = new Date();
  let streak = 0;
  for (let back = 40; back >= 1; back--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
    const practiced = back <= 5 || (back % 3 !== 0 && back % 7 !== 1);
    if (!practiced) { streak = 0; continue; }
    streak += 1;
    const rounds = 1 + ((back * 7) % 3), answers = rounds * 10, correct = Math.round(answers * (0.6 + ((back * 13) % 30) / 100));
    days[dateKey(d)] = { date: dateKey(d), answers, correct, rounds };
    if (back <= 4) sessions.push({ deckId: back % 2 ? 'd-fruit' : 'd-animal', deckTitle: back % 2 ? '水果與食物' : '動物與動作', mode: 'mix', total: 10, correct: 6 + (back % 4), best: 3 + (back % 3), at: d.getTime() + 15 * 3600e3 });
  }
  const weak = { 'd-fruit-w4': [6, 2], 'd-fruit-w7': [5, 2], 'd-animal-w2': [5, 3], 'd-animal-w7': [4, 2], 'd-fruit-w0': [8, 7], 'd-animal-w0': [7, 7], 'd-animal-w5': [4, 2] };
  for (const [wid, [seen, correct]] of Object.entries(weak)) {
    const deckId = wid.startsWith('d-fruit') ? 'd-fruit' : 'd-animal';
    const w = db.decks[deckId].words[wid];
    wstats[`${deckId}__${wid}`] = { deckId, wordId: wid, en: w.en, zh: w.zh, seen, correct, wrong: seen - correct, lv: correct === seen ? 4 : 1, lastSeen: Date.now() - 86400e3 };
  }
  const totalAnswers = Object.values(days).reduce((s, x) => s + x.answers, 0);
  const totalCorrect = Object.values(days).reduce((s, x) => s + x.correct, 0);
  db.users['demo-student'] = {
    profile: { streak, longest: Math.max(streak, 9), lastDate: dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)), totalAnswers, totalCorrect, totalRounds: Object.values(days).reduce((s, x) => s + x.rounds, 0) },
    days, sessions: sessions.reverse(), words: wstats,
  };
  db.users['demo-teacher'] = { profile: {}, days: {}, sessions: [], words: {} };
  return db;
}

export function createDemoBackend() {
  let db;
  try { db = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch { db = null; }
  if (!db) db = seedDemo();
  const persist = () => {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); }
    catch { throw new Error('瀏覽器空間不足，示範模式存不下這麼大的檔案。正式版（Firebase）沒有這個限制。'); }
  };
  let cb = () => {};
  const me = () => db.current && DEMO_USERS[db.current];
  const udata = () => (db.users[me().uid] ||= { profile: {}, days: {}, sessions: [], words: {} });
  const deckOut = (id, d) => ({ id, title: d.title, description: d.description, published: d.published, wordCount: Object.keys(d.words).length, sort: d.sort, updatedAt: d.updatedAt });
  const delay = v => new Promise(r => setTimeout(() => r(v), 60));

  return {
    kind: 'demo',
    init(f) { cb = f; setTimeout(() => cb(me() || null), 0); },
    async signIn(role = 'student') { db.current = role; persist(); cb(me()); },
    async signOut() { db.current = null; persist(); cb(null); },
    reset() { localStorage.removeItem(DEMO_KEY); },

    async listDecks() {
      return delay(Object.entries(db.decks).map(([id, d]) => deckOut(id, d))
        .filter(d => me().isTeacher || d.published)
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || b.updatedAt - a.updatedAt));
    },
    async getDeck(id) { const d = db.decks[id]; return delay(d ? deckOut(id, d) : null); },
    async getWords(deckId) {
      const d = db.decks[deckId]; if (!d) return [];
      return delay(Object.entries(d.words).map(([id, w]) => ({ id, deckId, ...w })).sort((a, b) => (a.order || 0) - (b.order || 0)));
    },
    async createDeck(data) {
      const id = 'd-' + Math.random().toString(36).slice(2, 9);
      db.decks[id] = { title: data.title, description: data.description || '', published: !!data.published, sort: 100, updatedAt: Date.now(), words: {} };
      persist(); return id;
    },
    async updateDeck(id, patch) { Object.assign(db.decks[id], patch, { updatedAt: Date.now() }); persist(); },
    async deleteDeck(id) { delete db.decks[id]; persist(); },
    async saveWord(deckId, word) {
      const data = cleanWord(word); checkSize(data);
      const id = word.id || 'w-' + Math.random().toString(36).slice(2, 10);
      if (!word.id) data.order = data.order || Date.now();
      const prev = db.decks[deckId].words[id];
      db.decks[deckId].words[id] = data;
      db.decks[deckId].updatedAt = Date.now();
      try { persist(); } catch (e) { if (prev) db.decks[deckId].words[id] = prev; else delete db.decks[deckId].words[id]; throw e; }
      return id;
    },
    async deleteWord(deckId, wordId) { delete db.decks[deckId].words[wordId]; persist(); },

    async listStudents() {
      return delay(Object.values(DEMO_USERS).map(u => ({ uid: u.uid, name: u.name, email: u.email, ...((db.users[u.uid] || {}).profile || {}) })));
    },
    async listAssignments() { return delay({ ...(db.assignments || {}) }); },
    async setAssignments(uids, deckIds) {
      db.assignments ||= {};
      uids.forEach(uid => { if (deckIds && deckIds.length) db.assignments[uid] = deckIds; else delete db.assignments[uid]; });
      persist();
    },
    async getMyDecks() { return delay((db.assignments || {})[me().uid] || null); },

    async getProfile() { return delay({ ...udata().profile }); },
    async getDays(fromKey) { return delay(Object.values(udata().days).filter(d => d.date >= fromKey)); },
    async getWordStats() { return delay(Object.entries(udata().words).map(([key, v]) => ({ key, ...v }))); },
    async getSessions(n = 10) { return delay([...udata().sessions].sort((a, b) => b.at - a.at).slice(0, n)); },
    async recordRound(r) {
      const u = udata(), today = dateKey();
      const prof = applyStreak(u.profile, today);
      const graded = r.graded !== false;
      if (graded) {
        prof.totalAnswers = (prof.totalAnswers || 0) + r.total;
        prof.totalCorrect = (prof.totalCorrect || 0) + r.correct;
      }
      prof.totalRounds = (prof.totalRounds || 0) + 1;
      u.profile = prof;
      const day = u.days[today] ||= { date: today, answers: 0, correct: 0, rounds: 0 };
      if (graded) { day.answers += r.total; day.correct += r.correct; } else day.written = (day.written || 0) + r.total;
      day.rounds += 1;
      u.sessions.push({ deckId: r.deckId, deckTitle: r.deckTitle, mode: r.mode, total: r.total, correct: graded ? r.correct : null, best: r.best || 0, at: Date.now() });
      if (u.sessions.length > 50) u.sessions.shift();
      this._applyWords(r.updates);
      persist();
      return { ...prof };
    },
    _applyWords(updates) {
      const u = udata();
      for (const a of aggregate(updates)) {
        const cur = u.words[a.key] || { deckId: a.deckId, wordId: a.wordId, seen: 0, correct: 0, wrong: 0 };
        Object.assign(cur, { en: a.en, zh: a.zh, lv: a.lv, seen: cur.seen + a.seen, correct: cur.correct + a.correct, wrong: cur.wrong + a.wrong, lastSeen: Date.now() });
        u.words[a.key] = cur;
      }
    },

    async submitWriting(d) {
      const id = 'h-' + Math.random().toString(36).slice(2, 10);
      (db.writings ||= {})[id] = { uid: me().uid, name: me().name, email: me().email, deckId: d.deckId, deckTitle: d.deckTitle, items: d.items, image: d.image, at: Date.now(), marks: null, score: null, reviewedAt: null, applied: false };
      try { persist(); } catch (e) { delete db.writings[id]; throw e; }
      return id;
    },
    async listWritings(mine) {
      return delay(Object.entries(db.writings || {}).map(([id, w]) => { const { image, ...rest } = w; return { id, ...rest }; })
        .filter(w => !mine || w.uid === me().uid).sort((a, b) => b.at - a.at));
    },
    async getWriting(id) { const w = (db.writings || {})[id]; return delay(w ? { id, ...w } : null); },
    async reviewWriting(id, marks) {
      Object.assign(db.writings[id], { marks, score: marks.filter(x => x === true).length, reviewedAt: Date.now(), reviewer: me().name, applied: false });
      persist();
    },
    async deleteWriting(id) { delete db.writings[id]; persist(); },
    async applyReview(id, updates) {
      // 示範模式裡老師和學生共用同一份資料，所以寫進作業主人的紀錄
      const owner = db.writings[id].uid, saved = db.current;
      const role = Object.keys(DEMO_USERS).find(k => DEMO_USERS[k].uid === owner);
      if (role) { db.current = role; this._applyWords(updates); db.current = saved; }
      db.writings[id].applied = true;
      persist();
    },
  };
}
