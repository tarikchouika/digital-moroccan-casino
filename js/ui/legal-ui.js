/* ═══════════════════════════════════════════
Digital Moroccan Casino — Legal Pages UI
Same structure as index.html
═══════════════════════════════════════════ */
"use strict";

(function () {
var PAGE_TITLES = {
about: 'ui.about',
contact: 'ui.contact',
privacy: 'ui.privacy',
terms: 'ui.terms',
security: 'ui.security',
pf: 'ui.pf',
fairness: 'ui.fairness',
'2fa': 'ui.security',
transactions: 'ui.transactions'
};

function buildSidebar() {
return '<aside class="sidebar" id="sidebar" role="navigation" aria-label="القائمة الرئيسية">' +
'<div class="brand">' +
'<div class="brand-logo" aria-hidden="true">' +
'<img src="assets/logo/moroccan-casino-logo-main.webp" alt="Digital Moroccan Casino">' +
'</div>' +
'<div class="brand-name">' +
'<b>Digital</b> Moroccan Casino' +
'<small><i class="fa-solid fa-location-dot" aria-hidden="true"></i> المغرب • 22 لعبة</small>' +
'</div>' +
'</div>' +
'<div class="side-title" id="sideTitleMain" data-i18n="ui.home">الرئيسية</div>' +
'<button class="nav-item active" data-nav="home" onclick="nav(\'home\', this)" aria-current="page">' +
'<span class="ic" aria-hidden="true"><i class="fa-solid fa-house"></i></span>' +
'<span data-i18n="ui.home">الرئيسية</span>' +
'</button>' +
'<button class="nav-item" data-nav="games" onclick="nav(\'games\', this)">' +
'<span class="ic" aria-hidden="true"><i class="fa-solid fa-gamepad"></i></span>' +
'<span data-i18n="ui.games">الألعاب</span>' +
'<span class="badge" aria-label="22 لعبة">22</span>' +
'</button>' +
'<button class="nav-item" data-nav="lb" onclick="nav(\'lb\', this)">' +
'<span class="ic" aria-hidden="true"><i class="fa-solid fa-ranking-star"></i></span>' +
'<span data-i18n="ui.lb">المتصدرون</span>' +
'</button>' +
'<button class="nav-item" data-nav="chat" onclick="nav(\'chat\', this)">' +
'<span class="ic" aria-hidden="true"><i class="fa-solid fa-comments"></i></span>' +
'<span data-i18n="ui.chat">الدردشة</span>' +
'</button>' +
'<button class="nav-item" data-nav="tourney" onclick="nav(\'tourney\', this)">' +
'<span class="ic" aria-hidden="true"><i class="fa-solid fa-award"></i></span>' +
'<span data-i18n="ui.tourney">البطولات</span>' +
'</button>' +
'<button class="nav-item" data-nav="rooms" onclick="nav(\'rooms\', this)">' +
'<span class="ic" aria-hidden="true"><i class="fa-solid fa-users"></i></span>' +
'<span data-i18n="ui.rooms">غرف اللعب</span>' +
'</button>' +
'<button class="nav-item" data-nav="tx" onclick="location.href=\'transactions.html\'">' +
'<span class="ic" aria-hidden="true"><i class="fa-solid fa-receipt"></i></span>' +
'<span data-i18n="ui.transactions">سجل المعاملات</span>' +
'</button>' +
'<div class="side-title" data-i18n="ui.tools">الأدوات</div>' +
'<button class="nav-item" data-nav="fair" onclick="nav(\'fair\', this)">' +
'<span class="ic" aria-hidden="true"><i class="fa-solid fa-shield-halved"></i></span>' +
'<span data-i18n="ui.fair">Provably Fair</span>' +
'</button>' +
'<button class="nav-item" data-nav="admin" id="navAdmin" onclick="nav(\'admin\', this)">' +
'<span class="ic" aria-hidden="true"><i class="fa-solid fa-user-shield"></i></span>' +
'<span data-i18n="ui.admin">الإدارة</span>' +
'</button>' +
'<div class="side-foot">' +
'<div class="sf-icons">' +
'<a class="sf-icon" href="2fa.html" data-i18n-title="ui.fb2fa" title="2FA محمي"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i></a>' +
'<a class="sf-icon" href="provably-fair.html" data-i18n-title="ui.fbFair" title="Provably Fair"><i class="fa-solid fa-dice" aria-hidden="true"></i></a>' +
'<a class="sf-icon" href="fairness.html" data-i18n-title="ui.fbSecure" title="العدالة والشفافية"><i class="fa-regular fa-lock" aria-hidden="true"></i></a>' +
'</div>' +
'</div>' +
'</aside>';
}

function buildTopbar() {
return '<header class="topbar" role="banner">' +
'<button class="burger" onclick="openSide()" aria-label="فتح القائمة" aria-expanded="false"><i class="fa-solid fa-bars" aria-hidden="true"></i></button>' +
'<div class="top-actions">' +
'<button class="mute theme-btn" id="themeBtn" onclick="window.themeToggle()" aria-label="تبديل الوضع المشع/القاتم" aria-pressed="false"><i class="fa-regular fa-lightbulb" id="themeIco" aria-hidden="true"></i></button>' +
'<div class="lang-drop">' +
'<button class="lang-btn" id="langBtn" onclick="toggleLangMenu()" aria-haspopup="menu" aria-expanded="false" aria-label="اختيار اللغة">' +
'<span class="lang-abbr" id="langAbbr">ع</span>' +
'<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>' +
'</button>' +
'<div class="lang-menu" id="langMenu" role="menu" aria-label="اللغة">' +
'<button class="lang-opt" role="menuitem" data-lang="ar" onclick="pickLang(\'ar\')">العربية</button>' +
'<button class="lang-opt" role="menuitem" data-lang="fr" onclick="pickLang(\'fr\')">Français</button>' +
'<button class="lang-opt" role="menuitem" data-lang="en" onclick="pickLang(\'en\')">English</button>' +
'</div>' +
'</div>' +
'<div id="authChip" class="authchip"></div>' +
'</div>' +
'</header>';
}

function buildTicker() {
return '<div class="ticker" role="marquee" aria-label="آخر الفائزين">' +
'<div class="ticker-track" id="ticker"></div>' +
'</div>';
}

function buildFooter() {
return '<footer role="contentinfo" class="watermark">' +
'<div class="foot-inner">' +
'<div class="foot-brand">' +
'<span class="foot-name">Digital Moroccan Casino</span>' +
'<span class="foot-copy">© 2026 — <span data-i18n="ui.footer">جميع الحقوق محفوظة</span></span>' +
'</div>' +
'<div class="foot-legal" role="navigation" aria-label="روابط قانونية">' +
'<a href="about.html" data-i18n="ui.about">من نحن</a>' +
'<a href="contact.html" data-i18n="ui.contact">تواصل معنا</a>' +
'<a href="privacy.html" lang="ar" data-i18n="ui.privacy">الخصوصية</a>' +
'<a href="terms.html" lang="ar" data-i18n="ui.terms">الشروط</a>' +
'</div>' +
'</div>' +
'</footer>';
}

function injectLegalUI(pageKey) {
var contentEl = document.querySelector('.legal-content, .legal-wrap');

var app = document.createElement('div');
app.className = 'app';

var sidebar = document.createElement('aside');
sidebar.innerHTML = buildSidebar();
app.appendChild(sidebar.childNodes[0]);

var backdrop = document.createElement('div');
backdrop.id = 'backdrop';
backdrop.setAttribute('onclick', 'closeSide()');
backdrop.setAttribute('aria-hidden', 'true');
app.appendChild(backdrop);

var main = document.createElement('div');
main.className = 'main';

var topbarWrap = document.createElement('div');
topbarWrap.innerHTML = buildTopbar();
main.appendChild(topbarWrap.childNodes[0]);

var tickerWrap = document.createElement('div');
tickerWrap.innerHTML = buildTicker();
main.appendChild(tickerWrap.childNodes[0]);
/* الصفحات القانونية بلا تغذية فائزين — أخفِ الشريط إن كان فارغاً */
var tickerTrack = document.getElementById('ticker');
if (tickerTrack && !tickerTrack.children.length) {
var _tEl = tickerTrack.closest('.ticker');
if (_tEl) _tEl.style.display = 'none';
}

var content = document.createElement('main');
content.className = 'content';
content.setAttribute('role', 'main');
if (contentEl) { content.appendChild(contentEl); }
main.appendChild(content);

var footerWrap = document.createElement('div');
footerWrap.innerHTML = buildFooter();
main.appendChild(footerWrap.childNodes[0]);

app.appendChild(main);

document.body.insertAdjacentHTML('afterbegin',
'<canvas id="fxCanvas" aria-hidden="true"></canvas><div id="flash" aria-hidden="true"></div>');
document.body.appendChild(app);

if (!document.getElementById('toasts')) {
document.body.insertAdjacentHTML('beforeend',
'<div id="toasts" role="alert" aria-live="assertive"></div>');
}

var titleKey = PAGE_TITLES[pageKey] || PAGE_TITLES.about;
var pageTitle = typeof T === 'function' ? T(titleKey) : '';
document.title = 'Digital Moroccan Casino | ' + pageTitle;

var descKey = 'legal.' + pageKey + 'Desc';
var desc = typeof T === 'function' ? T(descKey) : '';
if (desc) {
var metaDesc = document.querySelector('meta[name="description"]');
if (metaDesc) metaDesc.setAttribute('content', desc);
}

if (typeof updateThemeIcon === 'function') updateThemeIcon();
if (typeof initState === 'function') initState();
if (typeof syncLangDrop === 'function') syncLangDrop();
if (typeof translateStatic === 'function') translateStatic();
if (typeof updateCopyright === 'function') updateCopyright();
if (typeof renderAuthChip === 'function') renderAuthChip();

if (typeof authRestore === 'function') {
authRestore().catch(function () { /* no session */ });
}

window.injectLegalUI = injectLegalUI;
window.LEGAL_PAGE_KEY = pageKey;

})();
