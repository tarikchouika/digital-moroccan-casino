/* ═══════════════════════════════════════════
   Digital Moroccan casino — Authentication & User Session
   Global functions (visible to Playwright + onclick):
   authLogin, authRegister, authLogout, authSync, authSyncNow,
   openAuthModal, closeAuthModal, authTab, renderAuthChip, authRestore
   ═══════════════════════════════════════════ */
"use strict";

/* ── حالة المصادقة ── */
const AUTH = {
  user: null,
  _lastSync: 0
};

/* ── أدوات مساعدة ── */
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function setAuthMsg(msg, msgEl, isError) {
  if (!msgEl) return;
  msgEl.textContent = msg;
  msgEl.className = 'authmsg' + (isError ? ' err' : ' ok');
}
function roleLabel(role) {
  if (role === 'super') return T('auth.roleSuper');
  if (role === 'admin') return T('auth.roleAdmin');
  return T('auth.roleUser');
}

/* ── شريحة المستخدم في التوب بار ── */
function renderAuthChip() {
  const chip = document.getElementById('authChip');
  const adminNav = document.getElementById('navAdmin');
  if (adminNav) {
    adminNav.style.display = (AUTH.user && AUTH.user.role !== 'user') ? '' : 'none';
  }
  if (!chip) return;
  if (!AUTH.user) {
    chip.innerHTML = '<button class="authbtn" id="authLoginBtn" onclick="openAuthModal()"><i class="fa-solid fa-user" aria-hidden="true"></i> ' + T('auth.login') + '</button>';
    return;
  }
  const u = AUTH.user;
  chip.innerHTML =
    '<div class="acct">' +
      '<button class="uchip" id="userChip" onclick="toggleAcctMenu()" aria-haspopup="menu" aria-expanded="false">' +
        '<span class="uavatar" aria-hidden="true"><i class="fa-solid fa-user" aria-hidden="true"></i></span>' +
      '</button>' +
      '<div class="acct-menu" id="acctMenu" role="menu">' +
        '<div class="acct-head" role="none">' +
          '<span class="acct-name">' + esc(u.username) + '</span>' +
          '<span class="acct-balance"><i class="fa-solid fa-coins g" aria-hidden="true"></i> <span id="acctGoldD">' + fmt(u.gold || 0) + '</span></span>' +
        '</div>' +
        '<div class="acct-sep" aria-hidden="true"></div>' +
        '<button class="acct-item" role="menuitem" onclick="closeAcctMenu();openTrModal()"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i> ' + T('auth.sendBalance') + '</button>' +
        '<button class="acct-item" role="menuitem" onclick="closeAcctMenu();openPwModal()"><i class="fa-solid fa-key" aria-hidden="true"></i> ' + T('auth.changePassword') + '</button>' +
        '<button class="acct-item" role="menuitem" onclick="closeAcctMenu();openTransactionHistory()"><i class="fa-solid fa-receipt" aria-hidden="true"></i> ' + T('auth.transactionHistory') + '</button>' +
        '<button class="acct-item" role="menuitem" onclick="closeAcctMenu();openAccountLog()"><i class="fa-solid fa-user" aria-hidden="true"></i> ' + T('auth.accountLog') + '</button>' +
        '<div class="acct-sep" aria-hidden="true"></div>' +
        '<button class="acct-item danger" role="menuitem" onclick="authLogout()"><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i> ' + T('auth.logout') + '</button>' +
      '</div>' +
    '</div>';
}

/* ── قائمة الحساب المنسدلة (خروج / تغيير كلمة المرور / إرسال) ── */
function toggleAcctMenu() {
  const menu = document.getElementById('acctMenu');
  const btn = document.getElementById('userChip');
  if (!menu) return;
  const open = menu.classList.toggle('open');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}
function closeAcctMenu() {
  const menu = document.getElementById('acctMenu');
  const btn = document.getElementById('userChip');
  if (menu) menu.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

/* ── تطبيق بيانات المستخدم من الخادم ── */
function applyAuthUser(user) {
  AUTH.user = user;
  if (typeof user.gold === 'number') {
    ST.gold = user.gold;
  }
  if (user.lang && user.lang !== ST.lang) {
    ST.lang = user.lang;
    sSet('rc_lang', user.lang);
    if (typeof syncLangDrop === 'function') syncLangDrop();
    applyI18n();
    translateStatic();
    if (typeof renderAll === 'function') renderAll();
  }
  wallet();
  save();
  renderAuthChip();
  /* تحميل الألعاب المعطلة من الخادم وإعادة رسم الشبكة */
  if (typeof loadDisabledGames === 'function') {
    loadDisabledGames().then(function () {
      if (typeof renderAll === 'function') renderAll();
    });
  }
  AUTH._lastSync = Date.now();
}

/* ── تسجيل الدخول / إنشاء حساب ── */
function authSubmit() {
  const form = document.getElementById('authForm');
  const mode = form ? form.getAttribute('data-mode') : 'login';
  if (mode === 'register') {
    authRegister();
  } else {
    authLogin();
  }
}

function authLogin() {
  const uEl = document.getElementById('authUsername');
  const pEl = document.getElementById('authPassword');
  const msg = document.getElementById('authMsg');
  const username = uEl ? uEl.value.trim() : '';
  const password = pEl ? pEl.value : '';
  if (!username || !password) {
    setAuthMsg(T('auth.fill'), msg, true);
    return;
  }
  const submit = document.getElementById('authSubmit');
  if (submit) submit.disabled = true;
  API.post('/api/login', { username: username, password: password }).then(function (r) {
    if (submit) submit.disabled = false;
    if (r.ok && r.data && r.data.user) {
      applyAuthUser(r.data.user);
      closeAuthModal();
      toast(T('auth.welcome') + ' ' + username + ' 👋', 'ok');
    } else {
      setAuthMsg((r.data && r.data.message) || T('auth.error'), msg, true);
    }
  }).catch(function () {
    if (submit) submit.disabled = false;
    setAuthMsg(T('auth.error'), msg, true);
  });
}

function authRegister() {
  const uEl = document.getElementById('authUsername');
  const pEl = document.getElementById('authPassword');
  const msg = document.getElementById('authMsg');
  const username = uEl ? uEl.value.trim() : '';
  const password = pEl ? pEl.value : '';
  if (!username || !password) {
    setAuthMsg(T('auth.fill'), msg, true);
    return;
  }
  const submit = document.getElementById('authSubmit');
  if (submit) submit.disabled = true;
  API.post('/api/register', { username: username, password: password }).then(function (r) {
    if (submit) submit.disabled = false;
    if (r.ok && r.data && r.data.user) {
      applyAuthUser(r.data.user);
      closeAuthModal();
      toast(T('auth.accountCreated') + ' 🎉', 'ok');
    } else {
      setAuthMsg((r.data && r.data.message) || T('auth.error'), msg, true);
    }
  }).catch(function () {
    if (submit) submit.disabled = false;
    setAuthMsg(T('auth.error'), msg, true);
  });
}

function authLogout() {
  authSyncNow();
  API.post('/api/logout').then(function () {
    AUTH.user = null;
    if (typeof DISABLED === 'object' && DISABLED) DISABLED = {};
    renderAuthChip();
    if (typeof renderAll === 'function') renderAll();
    toast(T('auth.loggedOut'), 'info');
  }).catch(function () {
    AUTH.user = null;
    if (typeof DISABLED === 'object' && DISABLED) DISABLED = {};
    renderAuthChip();
    if (typeof renderAll === 'function') renderAll();
  });
}

/* ── تغيير كلمة المرور ── */
function openPwModal() {
  if (!AUTH.user) return;
  const m = document.getElementById('pwModal');
  if (!m) return;
  setAuthMsg('', document.getElementById('pwMsg'), false);
  const oldEl = document.getElementById('pwOld');
  const newEl = document.getElementById('pwNew');
  if (oldEl) oldEl.value = '';
  if (newEl) newEl.value = '';
  m.classList.add('show');
  if (oldEl) {
    setTimeout(function () { oldEl.focus(); }, 60);
  }
}
function closePwModal() {
  const m = document.getElementById('pwModal');
  if (m) m.classList.remove('show');
}
function pwSubmit() {
  const oldEl = document.getElementById('pwOld');
  const newEl = document.getElementById('pwNew');
  const msg = document.getElementById('pwMsg');
  const oldPassword = oldEl ? oldEl.value : '';
  const newPassword = newEl ? newEl.value : '';
  if (!oldPassword || !newPassword) {
    setAuthMsg(T('auth.pwFill'), msg, true);
    return;
  }
  if (newPassword.length < 6) {
    setAuthMsg(T('auth.pwShort'), msg, true);
    return;
  }
  const submit = document.getElementById('pwSubmitBtn');
  if (submit) submit.disabled = true;
  API.post('/api/change-password', { oldPassword: oldPassword, newPassword: newPassword }).then(function (r) {
    if (submit) submit.disabled = false;
    if (r.ok && r.data && r.data.ok) {
      closePwModal();
      toast((r.data && r.data.message) || T('auth.pwChanged'), 'ok');
    } else {
      setAuthMsg((r.data && r.data.message) || T('auth.error'), msg, true);
    }
  }).catch(function () {
    if (submit) submit.disabled = false;
    setAuthMsg(T('auth.error'), msg, true);
  });
}

/* ── استعادة الجلسة عند التحميل ── */
function authRestore() {
  return API.get('/api/me').then(function (r) {
    if (r.ok && r.data && r.data.user) {
      applyAuthUser(r.data.user);
    } else {
      renderAuthChip();
    }
  }).catch(function () {
    renderAuthChip();
  });
}

/* ── معالجة انتهاء الجلسة (401) ── */
function authHandle401() {
  if (AUTH.user) {
    AUTH.user = null;
    if (typeof DISABLED === 'object' && DISABLED) DISABLED = {};
    renderAuthChip();
    if (typeof renderAll === 'function') renderAll();
    toast(T('auth.sessionExpired'), 'warn');
  }
}

/* ── مزامنة الرصيد التلقائية ── */
function authSync() {
  if (!AUTH.user) return;
  const now = Date.now();
  if (now - AUTH._lastSync < 5000) return;
  AUTH._lastSync = now;
  /* مزامنة أحادية الاتجاه: الرصيد المحلي هو مصدر الحقيقة أثناء اللعب.
     الخادم مجرد مرآة — لا نعيد ضبط الرصيد من رده (يُمسح أي ربح حديث داخل نافذة الـ5 ثواني). */
  return API.post('/api/sync', { gold: ST.gold, lang: ST.lang }).catch(function () {});
}
function authSyncNow() {
  if (!AUTH.user) return;
  AUTH._lastSync = 0;
  return authSync();
}

/* ── المودال ── */
function openAuthModal() {
  if (AUTH.user) return;
  const m = document.getElementById('authModal');
  if (!m) return;
  m.classList.add('show');
  authTab('login');
  const uEl = document.getElementById('authUsername');
  if (uEl) {
    setTimeout(function () { uEl.focus(); }, 60);
  }
}
function closeAuthModal() {
  const m = document.getElementById('authModal');
  if (m) m.classList.remove('show');
}
function authTab(tab) {
  const btns = document.querySelectorAll('#authModal .atab');
  btns.forEach(function (b) { b.classList.remove('active'); });
  const btn = document.querySelector('#authModal .atab[data-auth-tab="' + tab + '"]');
  if (btn) btn.classList.add('active');
  const title = document.getElementById('authTitle');
  const submit = document.getElementById('authSubmit');
  const msg = document.getElementById('authMsg');
  if (title) title.textContent = T(tab === 'login' ? 'auth.login' : 'auth.register');
  if (submit) submit.textContent = T(tab === 'login' ? 'auth.submitLogin' : 'auth.submitRegister');
  if (msg) msg.textContent = '';
  const form = document.getElementById('authForm');
  if (form) form.setAttribute('data-mode', tab);
}

/* ── مزامنة عند مغادرة الصفحة ── */
if (typeof document !== 'undefined') {
  /* إغلاق القوائم المنسدلة عند النقر خارجها */
  document.addEventListener('click', function (e) {
    const menu = document.getElementById('acctMenu');
    if (menu && menu.classList.contains('open')) {
      const acct = menu.closest('.acct');
      if (!acct || !acct.contains(e.target)) closeAcctMenu();
    }
    if (typeof closeLangMenu === 'function') closeLangMenu(e);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeAcctMenu();
      closePwModal();
    }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') authSyncNow();
  });
  window.addEventListener('beforeunload', function () {
    if (AUTH.user) {
      try {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gold: ST.gold, lang: ST.lang }),
          keepalive: true
        });
      } catch (e) { /* ignore */ }
    }
  });
}
