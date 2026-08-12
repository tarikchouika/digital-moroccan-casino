/* ═══════════════════════════════════════════
   Digital Moroccan casino — Utility Functions
   ═══════════════════════════════════════════ */
"use strict";
/* ── فهرس اللغة الحالي ── */
function langIndex() {
  if (ST.lang === 'fr') return 1;
  if (ST.lang === 'en') return 2;
  return 0;
}
/* ── الترجمة ── */
function T(key) {
  const entry = TR[key];
  if (entry) {
    return entry[langIndex()] || entry[0] || key;
  }
  return key;
}
/* ── تنسيق الأرقام حسب اللغة ── */
function fmt(n) {
  try {
    const locale = ST.lang === 'ar' ? 'ar-MA' :
                   ST.lang === 'fr' ? 'fr-FR' : 'en-US';
    return n.toLocaleString(locale);
  } catch (e) {
    return String(n);
  }
}
/* ── Toast Notifications ── */
function toast(message, type) {
  type = type || 'info';
  const icons = {
    Ok: '✅',
    Err: '❌',
    Warn: '⚠️',
    Info: 'ℹ️'
  };
  const container = document.getElementById('toasts');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.setAttribute('role', 'alert');
  el.innerHTML = '<span>' + (icons[type] || '') + '</span><span>' + message + '</span>';
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}
/* ── التنقل بين الصفحات ── */
function nav(id, el) {
  /* إخفاء كل الصفحات */
  const pages = document.querySelectorAll('.page');
  for (let i = 0; i < pages.length; i++) {
    pages[i].classList.remove('active');
  }
  /* إظهار الصفحة المطلوبة */
  const target = document.getElementById('pg-' + id);
  if (target) {
    target.classList.add('active');
  }
  /* تحديث القائمة الجانبية */
  const navItems = document.querySelectorAll('.nav-item');
  for (let i = 0; i < navItems.length; i++) {
    navItems[i].classList.remove('active');
    navItems[i].removeAttribute('aria-current');
  }
  if (el) {
    el.classList.add('active');
    el.setAttribute('aria-current', 'page');
  }
  /* إعادة رسم صفحة الإدارة والبطولات عند فتحها (تحديث حي من الـ API) */
  if (id === 'admin' && typeof renderAdmin === 'function') renderAdmin();
  if (id === 'tourney' && typeof renderTourney === 'function') renderTourney();
  if (id === 'rooms' && typeof renderRooms === 'function') renderRooms();
  closeSide();
  SND.click();
}
/* ── القائمة الجانبية للموبايل ── */
function openSide() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('backdrop');
  if (sidebar) sidebar.classList.add('open');
  if (backdrop) backdrop.classList.add('show');
  const burger = document.querySelector('.burger');
  if (burger) burger.setAttribute('aria-expanded', 'true');
}
function closeSide() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('backdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('show');
  const burger = document.querySelector('.burger');
  if (burger) burger.setAttribute('aria-expanded', 'false');
}
/* ── تغيير اللغة ── */
function setLang(lang) {
  ST.lang = lang;
  sSet('rc_lang', lang);
  applyI18n();
  translateStatic();
  syncLangDrop();
  renderAll();
}
/* ── قائمة اللغة المنسدلة (ع / FR / EN) ── */
const LANG_MENU_LABEL = { ar: 'ع', fr: 'FR', en: 'EN' };
function syncLangDrop() {
  const abbr = document.getElementById('langAbbr');
  if (abbr) abbr.textContent = LANG_MENU_LABEL[ST.lang] || 'ع';
  const btn = document.getElementById('langBtn');
  if (btn) btn.setAttribute('aria-label', T('ui.lang'));
  const menu = document.getElementById('langMenu');
  if (menu) {
    const opts = menu.querySelectorAll('.lang-opt');
    opts.forEach(function (o) {
      o.classList.toggle('active', o.getAttribute('data-lang') === ST.lang);
    });
  }
}
function toggleLangMenu() {
  const menu = document.getElementById('langMenu');
  const btn = document.getElementById('langBtn');
  if (!menu) return;
  const open = menu.classList.toggle('open');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}
function pickLang(lang) {
  closeLangMenu();
  if (ST.lang !== lang) setLang(lang);
}
function closeLangMenu(evt) {
  const menu = document.getElementById('langMenu');
  const btn = document.getElementById('langBtn');
  if (!menu) return;
  if (evt && btn && menu.classList.contains('open') && (evt.target === btn || btn.contains(evt.target))) {
    return;
  }
  if (menu.classList.contains('open')) {
    menu.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
}
/* ── ترجمة العناصر الثابتة (data-i18n / data-i18n-html) ── */
function translateStatic() {
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    const v = T(el.getAttribute('data-i18n'));
    if (v) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
    const v = T(el.getAttribute('data-i18n-html'));
    if (v) el.innerHTML = v;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
    const v = T(el.getAttribute('data-i18n-placeholder'));
    if (v) el.setAttribute('placeholder', v);
  });
  /* زر ملء الشاشة في صفحة اللعبة — نصه يُدار ديناميكياً حسب الوضع */
  if (typeof syncGameFsBtn === 'function') syncGameFsBtn();
}
/* ── تطبيق اتجاه الصفحة ── */
function applyI18n() {
  const dir = ST.lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('dir', dir);
  document.documentElement.setAttribute('lang', ST.lang);
}
/* ── أدوات الورق ── */
const CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const CARD_SUITS = ['♠', '♥', '♦', '♣'];
function randomRank() {
  return CARD_RANKS[Math.floor(Math.random() * CARD_RANKS.length)];
}
function randomSuit() {
  return CARD_SUITS[Math.floor(Math.random() * CARD_SUITS.length)];
}
/* ── توافق مع محركات ألعاب الورق (أسماء rr/rs2/hVal) ── */
function rr() {
  return randomRank();
}
function rs2() {
  return randomSuit();
}
function hVal(rank) {
  return CARD_RANKS.indexOf(rank);
}
function cardValue(rank) {
  return CARD_RANKS.indexOf(rank);
}
function cardDisplayValue(card) {
  if (card.rank === 'A') return 11;
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  return parseInt(card.rank, 10);
}
function handValue(hand) {
  let value = 0;
  let aces = 0;
  for (let i = 0; i < hand.length; i++) {
    value += cardDisplayValue(hand[i]);
    if (hand[i].rank === 'A') aces++;
  }
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  return value;
}
/* ── مسار صورة ورقة من الأصول الموحدة (assets/cards) ── */
const SUIT_FILE = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
function suitKey(s) {
  return SUIT_FILE[s] || 'spades';
}
function cardSrc(card) {
  const rank = card.rank || card.r || 'A';
  const suit = card.suit || card.s || '♠';
  return 'assets/cards/' + rank + '-' + suitKey(suit) + '.webp';
}
/* ── توليد HTML لبطاقة ورق (صور موحدة + شعار) ── */
function cardHTML(card, isBack, isHold) {
  if (isBack) {
    return '<div class="bjc back" aria-hidden="true"><img src="assets/cards/back.webp" alt="" draggable="false"></div>';
  }
  const rank = card.rank || card.r;
  const suit = card.suit || card.s;
  const isRed = suit === '♥' || suit === '♦';
  const colorClass = isRed ? ' red' : '';
  const holdBadge = isHold ? '<span class="hold">HOLD</span>' : '';
  return '<div class="bjc' + colorClass + '" aria-label="' + rank + ' ' + suit + '">' +
    holdBadge +
    '<img src="' + cardSrc(card) + '" alt="' + rank + ' ' + suit + '" draggable="false">' +
    '</div>';
}
/* ── إنشاء مجموعة ورق مخلوطة ── */
function createDeck() {
  const deck = [];
  for (let s = 0; s < 4; s++) {
    for (let r = 0; r < 13; r++) {
      deck.push({ suit: CARD_SUITS[s], rank: CARD_RANKS[r] });
    }
  }
  /* Fisher-Yates shuffle */
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = deck[i];
    deck[i] = deck[j];
    deck[j] = temp;
  }
  return deck;
}
/* ── تأثير الفوز ── */
function winFX(winAmount, bigThreshold) {
  if (winAmount > 0) {
    const big = winAmount >= (bigThreshold || GB * 5);
    celebrate(big);
    if (big && typeof coinRain === 'function') coinRain(16);
  } else {
    SND.lose();
  }
}
/* ── Hash بسيط لـ Provably Fair ── */
function simpleHash(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  let output = '';
  for (let j = 0; j < 64; j++) {
    output += ((hash + str.charCodeAt(j % str.length) * 31 + j * 17) & 15).toString(16);
    hash = (hash * 31 + j) | 0;
  }
  return output;
}

/* ── تبديل الوضع المشع / القاتم ── */
function themeToggle() {
  const html = document.documentElement;
  const radiant = html.getAttribute('data-theme') === 'radiant';
  if (radiant) {
    html.removeAttribute('data-theme');
    sSet('rc_theme', 'dark');
  } else {
    html.setAttribute('data-theme', 'radiant');
    sSet('rc_theme', 'radiant');
  }
  updateThemeIcon();
  SND.click();
}
function updateThemeIcon() {
  const b = document.getElementById('themeBtn');
  if (!b) return;
  const radiant = document.documentElement.getAttribute('data-theme') === 'radiant';
  const ico = document.getElementById('themeIco');
  if (ico) ico.className = radiant ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  b.setAttribute('aria-pressed', radiant ? 'true' : 'false');
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateThemeIcon);
  } else {
    updateThemeIcon();
  }
}
