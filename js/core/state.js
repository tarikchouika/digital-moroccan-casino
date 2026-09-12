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
/* [i18n-auto 2026-09-12] اكتشاف لغة الزائر الجديد تلقائياً:
   الأولوية: (1) تفضيل محفوظ rc_lang (اختيار المستخدم يغلب دائماً)
   (2) ?lang= في الرابط  (3) لغات المتصفح (ar/fr/en/دارجة da)
   (4) الجغرافيا عبر المنطقة الزمنية (Africa/Casablanca → العربية)
   الافتراضي عند الفشل: العربية */
function _detectInitialLang() {
  var saved = null;
  try { saved = sGet('rc_lang', null); } catch (e) { saved = null; }
  if (saved === 'ar' || saved === 'fr' || saved === 'en' || saved === 'da') return saved;
  try {
    var p = new URLSearchParams(location.search).get('lang');
    if (p === 'ar' || p === 'fr' || p === 'en' || p === 'da') return p;
  } catch (e) { /* ignore */ }
  try {
    var langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'ar'];
    for (var i = 0; i < langs.length; i++) {
      var l = String(langs[i] || '').toLowerCase().slice(0, 2);
      if (l === 'ar') return 'ar';
      if (l === 'fr') return 'fr';
      if (l === 'en') return 'en';
    }
    /* دارجة: أي المغاربة بجهاز عربي مكتوب 'ar-MA' يلتقطهم الشرط أعلاه؛ المتصفحات
       الأجنبية بالمغرب قد تكون en/fr — جغرافيا المنطقة الزمنية تحسم للمغرب */
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { tz = ''; }
    if (/Africa\/Casablanca|Africa\/El_Aaiun/i.test(tz)) {
      for (var j = 0; j < langs.length; j++) {
        var lj = String(langs[j] || '').toLowerCase();
        if (lj.indexOf('fr') === 0) return 'fr';   /* متصفح فرنسي بالمغرب → fr */
      }
      return 'ar';                                  /* غير ذلك بالمغرب → عربية */
    }
  } catch (e) { /* ignore */ }
  return 'ar';
}
var __initialLang = sGet('rc_lang', null) || _detectInitialLang();
/* ثبّت اختيار الكشف الأول في التخزين كي لا يتذبذب بين الأجهزة/الجلسات
   (اختيار المستخدم اللاحق عبر setLang يظل الغالب دائماً) */
try { sSet('rc_lang', __initialLang); } catch (e) { /* ignore */ }
const ST = {
  lang: __initialLang,
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
  ST.lang = sGet('rc_lang', null) || _detectInitialLang();
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
window.initState = initState;
window.sGet = sGet;
window.sSet = sSet;
window.sRemove = sRemove;