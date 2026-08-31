/* ══════════════════════════════════════════
   Digital Moroccan casino — State Management
   ══════════════════════════════════════════ */
"use strict";
/* ── Fallback للـ localStorage في البيئات المقيدة ── */
const memoryStorage = {};
function sGet(key, defaultVal) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? defaultVal : value;
  } catch (e) {
    return memoryStorage[key] !== undefined ? memoryStorage[key] : defaultVal;
  }
}
function sSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    memoryStorage[key] = value;
  }
}
function sRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    delete memoryStorage[key];
  }
}
/* ── الحالة الرئيسية للتطبيق ── */
const ST = {
  lang: sGet('rc_lang', 'ar'),
  gold: parseInt(sGet('rc_gold', '1000'), 10) || 1000,
  streak: 3,
  lastClaim: 0,
  clientSeed: 'Player',
  serverSeed: '',
  nonce: 1,
  mute: sGet('rc_mute', '0') === '1',
  currentGame: null,
  tutorialSeen: sGet('rc_tutorial_seen', '0') === '1'
};
/* ── حفظ واستعادة ── */
function save() {
  sSet('rc_gold', ST.gold);
  sSet('rc_lang', ST.lang);
  sSet('rc_mute', ST.mute ? '1' : '0');
  if (typeof authSync === 'function') {
    authSync();
  }
}
function loadState() {
  ST.gold = parseInt(sGet('rc_gold', '1000'), 10) || 1000;
  ST.lang = sGet('rc_lang', 'ar');
  ST.mute = sGet('rc_mute', '0') === '1';
}
/* ── تحديث الواجهة بالرصيد ── */
function wallet() {
  const goldEls = document.querySelectorAll('#goldD');
  goldEls.forEach(function (el) { el.textContent = fmt(ST.gold); });
  const acctGoldEl = document.getElementById('acctGoldD');
  if (acctGoldEl) acctGoldEl.textContent = fmt(ST.gold);
}
/* ── عمليات الرصيد ── */
function takeBet(amount) {
  if (ST.gold < amount) {
    toast(T('ts.noc'), 'err');
    SND.lose();
    return false;
  }
  ST.gold -= amount;
  wallet();
  save();
  return true;
}
function giveWin(amount) {
  ST.gold += amount;
  wallet();
  save();
  /* إنهاء حالة «الجولة قيد التقدم» عند تحقيق الربح */
  if (typeof window.SessionResume !== 'undefined') {
    try { window.SessionResume.onResolve(); } catch (e) {}
  }
}
/* ── Provably Fair ── */
function fairTick() {
  ST.nonce++;
  renderFair();
}
function generateServerSeed() {
  ST.serverSeed = Math.random().toString(36).slice(2, 18);
  ST.nonce = 1;
}
function newSeeds() {
  generateServerSeed();
  renderFair();
  toast('تم تحديث البذور', 'info');
}
/* ── Daily Reward ── */
function claimDaily() {
  const now = Date.now();
  if (now - ST.lastClaim < 15000) {
    toast(T('ts.wait') || 'انتظر قليلاً بين كل مطالبة', 'warn');
    return;
  }
  ST.lastClaim = now;
  save();
  if (typeof openWheelModal === 'function') {
    openWheelModal();
  } else {
    ST.gold += 100;
    save();
    wallet();
    if (typeof SND !== 'undefined' && SND.coin) SND.coin();
    if (typeof confetti === 'function') confetti(40);
    toast(T('ts.claim') || 'تم استلام المكافأة اليومية +100', 'ok');
  }
}
/* ── تهيئة الحالة عند التحميل ── */
function initState() {
  loadState();
  if (!ST.serverSeed) {
    generateServerSeed();
  }
  wallet();
}

/* ── Export to global ────────────────── */
window.ST = ST;
window.save = save;
window.loadState = loadState;
window.wallet = wallet;
window.takeBet = takeBet;
window.giveWin = giveWin;
window.fairTick = fairTick;
window.generateServerSeed = generateServerSeed;
window.newSeeds = newSeeds;
window.claimDaily = claimDaily;
window.initState = initState;
window.sGet = sGet;
window.sSet = sSet;
window.sRemove = sRemove;