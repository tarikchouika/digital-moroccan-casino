/* ═══════════════════════════════════════════════════════════════
   Digital Moroccan Casino — Legal Pages Chrome (v17)
   يحقن نفس هيدر الصفحة الرئيسية (app-dock) في الصفحات القانونية:
   الحساب + اللغة + الثيم + القائمة — بنفس الشكل والوظائف تماماً.
   يتطلب: state.js, api.js, audio.js, utils.js, translations.js, auth.js
   والملف css/09-chrome.css (FLOATING ICON DOCK).
   ═══════════════════════════════════════════════════════════════ */
"use strict";

/* ── تجاوز آمن لـ translateStatic (تُحمَّل بعد utils.js فتَغلِب نسخته) ──
   نسخة utils.js تستبدل [data-k] بالمفتاح الخام إذا غاب من TR — هنا
   نترجم [data-k] من قاموس D المضمّن في الصفحة فقط، والباقي من TR. */
function translateStatic() {
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    var v = T(el.getAttribute('data-i18n'));
    if (v && v !== el.getAttribute('data-i18n')) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
    var v = T(el.getAttribute('data-i18n-html'));
    if (v && v !== el.getAttribute('data-i18n-html')) el.innerHTML = v;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
    var v = T(el.getAttribute('data-i18n-placeholder'));
    if (v && v !== el.getAttribute('data-i18n-placeholder')) el.setAttribute('placeholder', v);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
    var v = T(el.getAttribute('data-i18n-title'));
    if (v && v !== el.getAttribute('data-i18n-title')) el.setAttribute('title', v);
  });
  /* محتوى الصفحة القانونية [data-k] — من قاموس D المضمّن حصراً */
  if (typeof window.D === 'object' && window.D) {
    document.querySelectorAll('[data-k]').forEach(function (el) {
      var k = el.getAttribute('data-k');
      if (window.D[k] && window.D[k][ST.lang]) el.innerHTML = window.D[k][ST.lang];
    });
  }
}

/* ── تجاوز pickLang: نفس سلوك الرئيسية + مزامنة قاموس الصفحة المضمّن ── */
function pickLang(lang) {
  closeLangMenu();
  if (ST.lang !== lang) {
    ST.lang = lang;
    sSet('rc_lang', lang);
    applyI18n();
    translateStatic();
    syncLangDrop();
    updateCopyright();
  }
  /* دالة الصفحة المضمّنة (تدير currentLang المحلي والاتجاه) إن وُجدت */
  if (typeof window.applyLang === 'function') window.applyLang(lang);
}

/* ── عناصر قائمة الحساب غير المتاحة هنا → العودة للتطبيق الرئيسي ── */
function openTrModal() { window.location.href = 'index.html'; }
function openTransactionHistory() { window.location.href = 'index.html'; }
function openAccountLog() { window.location.href = 'index.html'; }

(function () {
  /* ═══ Sidebar — نفس قائمة الرئيسية بروابط مباشرة ═══ */
  var SIDEBAR_HTML =
    '<aside class="sidebar" id="sidebar" role="navigation" aria-label="القائمة الرئيسية">' +
      '<div class="brand">' +
        '<div class="brand-logo" aria-hidden="true">' +
          '<img src="assets/logo/moroccan-casino-logo-main.webp" alt="Digital Moroccan Casino">' +
        '</div>' +
        '<div class="brand-name"><b>Digital</b> Moroccan Casino' +
          '<small><i class="fa-solid fa-location-dot" aria-hidden="true"></i> المغرب • 41 لعبة</small>' +
        '</div>' +
      '</div>' +
      '<div class="side-title" data-i18n="ui.home">الرئيسية</div>' +
      '<a class="nav-item" href="index.html"><span class="ic" aria-hidden="true"><i class="fa-solid fa-house"></i></span><span data-i18n="ui.home">الرئيسية</span></a>' +
      '<a class="nav-item" href="index.html#games"><span class="ic" aria-hidden="true"><i class="fa-solid fa-gamepad"></i></span><span data-i18n="ui.games">الألعاب</span></a>' +
      '<a class="nav-item" href="index.html#lb"><span class="ic" aria-hidden="true"><i class="fa-solid fa-ranking-star"></i></span><span data-i18n="ui.lb">المتصدرون</span></a>' +
      '<a class="nav-item" href="index.html#chat"><span class="ic" aria-hidden="true"><i class="fa-solid fa-comments"></i></span><span data-i18n="ui.chat">الدردشة</span></a>' +
      '<a class="nav-item" href="index.html#tourney"><span class="ic" aria-hidden="true"><i class="fa-solid fa-award"></i></span><span data-i18n="ui.tourney">البطولات</span></a>' +
      '<a class="nav-item" href="index.html#rooms"><span class="ic" aria-hidden="true"><i class="fa-solid fa-users"></i></span><span data-i18n="ui.rooms">غرف اللعب</span></a>' +
      '<div class="side-title" data-i18n="ui.tools">الأدوات</div>' +
      '<a class="nav-item" href="index.html#fair"><span class="ic" aria-hidden="true"><i class="fa-solid fa-shield-halved"></i></span><span data-i18n="ui.fair">Provably Fair</span></a>' +
      '<a class="nav-item" href="index.html#admin" id="navAdmin" style="display:none"><span class="ic" aria-hidden="true"><i class="fa-solid fa-user-shield"></i></span><span data-i18n="ui.admin">الإدارة</span></a>' +
      '<div class="side-foot"><div class="sf-icons">' +
        '<a class="sf-icon" href="2fa.html" data-i18n-title="ui.fb2fa" title="حماية الحساب 2FA" aria-label="حماية الحساب 2FA"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i></a>' +
        '<a class="sf-icon" href="provably-fair.html" data-i18n-title="ui.fbFair" title="Provably Fair" aria-label="العدالة المشفرة"><i class="fa-solid fa-dice" aria-hidden="true"></i></a>' +
        '<a class="sf-icon" href="fairness.html" data-i18n-title="ui.fbSecure" title="العدالة والشفافية" aria-label="العدالة والشفافية"><i class="fa-solid fa-scale-balanced" aria-hidden="true"></i></a>' +
      '</div></div>' +
    '</aside>';

  /* ═══ App Dock — منسوخ حرفياً من index.html (نفس الشكل والوظائف) ═══ */
  var DOCK_HTML =
    '<div class="app-dock" id="appDock">' +
      '<div class="dock-left">' +
        '<div id="authChip" class="authchip"></div>' +
        '<div class="lang-drop">' +
          '<button class="lang-btn dock-ic" id="langBtn" onclick="toggleLangMenu()" aria-haspopup="menu" aria-expanded="false" aria-label="اختيار اللغة">' +
            '<span class="lang-abbr" id="langAbbr">ع</span>' +
            '<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>' +
          '</button>' +
          '<div class="lang-menu" id="langMenu" role="menu" aria-label="اللغة">' +
            '<button class="lang-opt" role="menuitem" data-lang="ar" onclick="pickLang(\'ar\')">العربية</button>' +
            '<button class="lang-opt" role="menuitem" data-lang="da" onclick="pickLang(\'da\')">🇲🇦 الدارجة المغربية</button>' +
            '<button class="lang-opt" role="menuitem" data-lang="fr" onclick="pickLang(\'fr\')">Français</button>' +
            '<button class="lang-opt" role="menuitem" data-lang="en" onclick="pickLang(\'en\')">English</button>' +
          '</div>' +
        '</div>' +
        '<button class="dock-ic" id="themeBtn" onclick="window.themeToggle()" aria-label="تبديل الوضع المشع/القاتم" aria-pressed="false" title="تبديل الوضع"><i class="fa-regular fa-lightbulb" id="themeIco" aria-hidden="true"></i></button>' +
      '</div>' +
      '<div class="dock-right">' +
        '<button class="dock-ic dock-menu" onclick="openSide()" aria-label="فتح القائمة" aria-expanded="false"><i class="fa-solid fa-bars" aria-hidden="true"></i></button>' +
      '</div>' +
    '</div>';

  /* ═══ نوافذ الدخول/كلمة المرور + حاوية التوست — نفس الرئيسية ═══ */
  var EXTRAS_HTML =
    '<div class="mwrap" id="authModal" role="dialog" aria-modal="true" aria-labelledby="authTitle" onclick="if(event.target.id===\'authModal\') closeAuthModal()">' +
      '<div class="modal modal-sm">' +
        '<div class="mhead">' +
          '<h3 id="authTitle"><i class="fa-solid fa-key" aria-hidden="true"></i> دخول</h3>' +
          '<button class="mclose" onclick="closeAuthModal()" aria-label="إغلاق">✕</button>' +
        '</div>' +
        '<div class="mbody">' +
          '<div class="atabs" role="tablist" aria-label="تسجيل الدخول أو إنشاء حساب">' +
            '<button class="atab active" role="tab" aria-selected="true" data-auth-tab="login" onclick="authTab(\'login\')"><i class="fa-solid fa-key" aria-hidden="true"></i> دخول</button>' +
            '<button class="atab" role="tab" aria-selected="false" data-auth-tab="register" onclick="authTab(\'register\')"><i class="fa-solid fa-user-plus" aria-hidden="true"></i> تسجيل</button>' +
          '</div>' +
          '<form id="authForm" data-mode="login" onsubmit="event.preventDefault()">' +
            '<label class="aflabel" for="authUsername"><i class="fa-solid fa-user" aria-hidden="true"></i> اسم المستخدم</label>' +
            '<input class="afinput" id="authUsername" autocomplete="username" placeholder="3-20 حرفاً (حروف/أرقام/_ )" maxlength="20">' +
            '<label class="aflabel" for="authPassword"><i class="fa-solid fa-lock" aria-hidden="true"></i> كلمة المرور</label>' +
            '<input class="afinput" id="authPassword" type="password" autocomplete="current-password" placeholder="6 أحرف على الأقل">' +
            '<div id="authMsg" class="authmsg" role="alert" aria-live="polite"></div>' +
            '<button class="btn full" id="authSubmit" onclick="window.authSubmit()">تسجيل الدخول</button>' +
          '</form>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="mwrap" id="pwModal" role="dialog" aria-modal="true" aria-labelledby="pwTitle" onclick="if(event.target.id===\'pwModal\') closePwModal()">' +
      '<div class="modal modal-sm">' +
        '<div class="mhead">' +
          '<h3 id="pwTitle"><i class="fa-solid fa-key" aria-hidden="true"></i> <span data-i18n="auth.changePassword">تغيير كلمة المرور</span></h3>' +
          '<button class="mclose" onclick="closePwModal()" aria-label="إغلاق">✕</button>' +
        '</div>' +
        '<div class="mbody">' +
          '<label class="aflabel" for="pwOld"><i class="fa-solid fa-lock" aria-hidden="true"></i> <span data-i18n="auth.pwCurrent">كلمة المرور الحالية</span></label>' +
          '<input class="afinput" id="pwOld" type="password" autocomplete="current-password">' +
          '<label class="aflabel" for="pwNew"><i class="fa-solid fa-lock" aria-hidden="true"></i> <span data-i18n="auth.pwNewLabel">كلمة المرور الجديدة</span></label>' +
          '<input class="afinput" id="pwNew" type="password" autocomplete="new-password" placeholder="6 أحرف على الأقل">' +
          '<div id="pwMsg" class="authmsg" role="alert" aria-live="polite"></div>' +
          '<button class="btn full" id="pwSubmitBtn" onclick="pwSubmit()"><i class="fa-solid fa-check" aria-hidden="true"></i> <span data-i18n="auth.pwSave">حفظ</span></button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div id="toasts" role="alert" aria-live="assertive"></div>';

  function initLegalChrome() {
    var body = document.body;
    if (!body || document.getElementById('appDock')) return;
    /* بنية الرئيسية: .app > (sidebar + backdrop + .main > dock + المحتوى) */
    var content = [];
    while (body.firstChild) content.push(body.removeChild(body.firstChild));
    var app = document.createElement('div');
    app.className = 'app';
    app.innerHTML = SIDEBAR_HTML +
      '<div id="backdrop" onclick="closeSide()" aria-hidden="true"></div>' +
      '<div class="main">' + DOCK_HTML + '</div>';
    body.appendChild(app);
    var main = app.querySelector('.main');
    content.forEach(function (n) { main.appendChild(n); });
    var extras = document.createElement('div');
    extras.innerHTML = EXTRAS_HTML;
    while (extras.firstChild) body.appendChild(extras.firstChild);
    /* مزامنة أولية: اللغة + الثيم + الترجمة الثابتة + جلسة الحساب */
    if (typeof syncLangDrop === 'function') syncLangDrop();
    if (typeof window.updateThemeIcon === 'function') window.updateThemeIcon();
    translateStatic();
    if (typeof authRestore === 'function') authRestore();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLegalChrome);
  } else {
    initLegalChrome();
  }
})();
