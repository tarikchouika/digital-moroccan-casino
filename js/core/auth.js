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

/* حالة مؤقتة أثناء إتمام دخول 2FA: { userId, username } */
var _twofaPending = null;

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
          '<div style="display:flex;justify-content:space-between;align-items:center;width:100%">' +
            '<span class="acct-name">' + esc(u.username) + '</span>' +
            '<span class="vip-badge ' + (typeof getVipLevel === 'function' ? getVipLevel(u.gold).badge : '') + '">' +
              (typeof getVipLevel === 'function' ? getVipLevel(u.gold).name : '') +
            '</span>' +
          '</div>' +
          '<span class="acct-balance"><i class="fa-solid fa-coins g" aria-hidden="true"></i> <span id="acctGoldD">' + fmt(u.gold || 0) + '</span></span>' +
        '</div>' +
        '<div class="acct-sep" aria-hidden="true"></div>' +
        '<button class="acct-item" role="menuitem" onclick="closeAcctMenu();openTrModal()"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i> ' + T('auth.sendBalance') + '</button>' +
        '<button class="acct-item" role="menuitem" onclick="closeAcctMenu();openPwModal()"><i class="fa-solid fa-key" aria-hidden="true"></i> ' + T('auth.changePassword') + '</button>' +
        '<button class="acct-item" role="menuitem" onclick="closeAcctMenu();openTransactionHistory()"><i class="fa-solid fa-receipt" aria-hidden="true"></i> ' + T('auth.transactionHistory') + '</button>' +
        '<button class="acct-item" role="menuitem" onclick="closeAcctMenu();openAccountLog()"><i class="fa-solid fa-user" aria-hidden="true"></i> ' + T('auth.accountLog') + '</button>' +
        '<button class="acct-item" role="menuitem" onclick="closeAcctMenu();openSecurity()"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> ' + T('sec.title') + '</button>' +
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
  /* توحيد حقل 2FA: الخادم يُرجع twofa_enabled والواجهة تستعمل twofaEnabled */
  if (AUTH.user) AUTH.user.twofaEnabled = !!(AUTH.user.twofaEnabled || AUTH.user.twofa_enabled);
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
  if (typeof Rooms !== 'undefined' && Rooms.checkPendingRoom) {
    Rooms.checkPendingRoom();
  }
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
    } else if (r.ok && r.data && r.data.twofa_required) {
      /* تسجيل الدخول يتطلب رمز 2FA لإتمامه */
      _twofaPending = { userId: r.data.userId, username: username };
      show2faLogin();
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

/* ═══════════ المصادقة الثنائية (2FA) ═══════════ */
/* فتح صفحة الحساب + الكشف عن بطاقة الأمان وتشغيل إعداد 2FA */
function openSecurity() {
  if (!AUTH.user) { toast(T('auth.sessionExpired'), 'warn'); if (typeof openAuthModal === 'function') openAuthModal(); return; }
  if (typeof nav === 'function') nav('account', null);
  setTimeout(function () {
    if (typeof init2fa === 'function') init2fa();
    var card = document.getElementById('secCard') || document.getElementById('twofaCard');
    if (card) {
      card.style.display = '';
      try { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    }
    var enable = document.getElementById('btnEnable2fa');
    if (enable && typeof enable.focus === 'function') enable.focus();
  }, 160);
}
window.openSecurity = openSecurity;

/* إظهار مودال إدخال رمز 2FA أثناء الدخول */
function show2faLogin() {
  var m = document.getElementById('twofaModal');
  if (!m) { toast(T('auth.error'), 'err'); return; }
  m.classList.add('show');
  var inp = document.getElementById('twofaLoginCode');
  if (inp) setTimeout(function () { inp.focus(); }, 60);
}
window.show2faLogin = show2faLogin;

/* إتمام الدخول بعد إدخال رمز 2FA */
function submit2faLogin() {
  if (!_twofaPending) return;
  var inp = document.getElementById('twofaLoginCode');
  var code = inp ? inp.value.trim() : '';
  if (!code) { toast(T('sec.code') + ' ' + T('rm.required'), 'warn'); return; }
  var pending = _twofaPending;
  API.post('/api/2fa/login', { userId: pending.userId, code: code }).then(function (r) {
    if (!r.ok) { toast((r.data && r.data.message) || T('auth.error'), 'err'); return; }
    var user = r.data && r.data.user;
    if (!user) { toast(T('auth.error'), 'err'); return; }
    /* تخزين الرمز المُعاد إن وُجد */
    if (r.data && r.data.token) {
      try { AUTH.token = r.data.token; localStorage.setItem('rc_token', r.data.token); } catch (e) {}
    }
    _twofaPending = null;
    var m = document.getElementById('twofaModal');
    if (m) m.classList.remove('show');
    if (inp) inp.value = '';
    applyAuthUser(user);
    closeAuthModal();
    toast(T('auth.welcome') + ' ' + pending.username + ' 👋', 'ok');
  });
}
window.submit2faLogin = submit2faLogin;

/* ربط عناصر واجهة 2FA (في pg-account ومودال الدخول) */
function init2fa() {
  if (window._twofaBound) return;
  window._twofaBound = true;

  var enable = document.getElementById('btnEnable2fa');
  var verify = document.getElementById('twofaVerify');
  var codeInput = document.getElementById('twofaCode');
  var status = document.getElementById('twofaStatus');
  var statusLine = document.getElementById('twofaStatusLine');
  var setup = document.getElementById('twofaSetup');
  var secretEl = document.getElementById('twofaSecret');
  var qrEl = document.getElementById('twofaQr');
  var oaEl = document.getElementById('twofaOtpauth');
  var hint = document.getElementById('twofaHint');
  var disable = document.getElementById('twofaDisable');
  var loginVerify = document.getElementById('twofaLoginVerify');
  var loginInp = document.getElementById('twofaLoginCode');

  function refreshStatus() {
    var enabled = !!(AUTH.user && AUTH.user.twofaEnabled);
    if (statusLine) statusLine.textContent = enabled ? T('sec.enabled') : (T('sec.status') + ': —');
    if (enable) enable.style.display = enabled ? 'none' : '';
    if (disable) disable.style.display = enabled ? '' : 'none';
    /* إخفاء عناصر نموذج التفعيل فقط (دون إخفاء زر التعطيل إن كان خارجه) */
    if (enabled) {
      if (qrEl) qrEl.style.display = 'none';
      if (secretEl) secretEl.style.display = 'none';
      if (codeInput) codeInput.style.display = 'none';
      if (verify) verify.style.display = 'none';
    }
    if (status) {
      status.style.display = enabled ? '' : 'none';
      status.className = 'twofa-status ok';
      status.innerHTML = '✅ ' + T('sec.enabled');
    }
  }
  window._refresh2faStatus = refreshStatus;

  /* تفعيل 2FA: فتح المودال + جلب السر/QR ثم إظهار قسم إدخال الرمز */
  if (enable) enable.addEventListener('click', function () {
    if (!AUTH.user) { toast(T('auth.sessionExpired'), 'warn'); if (typeof openAuthModal === 'function') openAuthModal(); return; }
    if (AUTH.user.twofaEnabled) { if (typeof openTwofaModal === 'function') openTwofaModal(); return; }
    openTwofaModal();
    if (status) { status.textContent = ''; status.className = 'authmsg'; status.style.display = ''; }
    API.post('/api/2fa/enable', {}).then(function (r) {
      if (!r.ok) { toast((r.data && r.data.message) || T('auth.error'), 'err'); return; }
      var secret = (r.data && r.data.secret) || '';
      var otpauth = (r.data && r.data.otpauth) || '';
      if (qrEl) { qrEl.style.display = ''; qrEl.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(otpauth); }
      if (secretEl) { secretEl.style.display = ''; secretEl.textContent = secret; }
      if (oaEl) oaEl.textContent = otpauth;
      if (codeInput) { codeInput.style.display = ''; codeInput.value = ''; codeInput.focus(); }
      if (verify) verify.style.display = '';
      if (hint) hint.textContent = T('sec.qrHint');
      if (setup) setup.style.display = '';
    });
  });

  /* التحقق من الرمز → تفعيل 2FA */
  if (verify) verify.addEventListener('click', function () {
    var code = codeInput ? codeInput.value.trim() : '';
    if (!code) { toast(T('sec.code') + ' ' + T('rm.required'), 'warn'); return; }
    API.post('/api/2fa/verify', { code: code }).then(function (r) {
      if (!r.ok) {
        var msg = (r.data && (r.data.message || r.data.error)) || T('auth.error');
        if (status) { status.textContent = msg; status.className = 'authmsg err'; status.style.display = ''; }
        toast(msg, 'err');
        return;
      }
      if (AUTH.user) AUTH.user.twofaEnabled = true;
      if (codeInput) codeInput.value = '';
      refreshStatus();
      toast(T('sec.enabled'), 'ok');
    });
  });

  /* تعطيل 2FA (يتطلب كلمة المرور) */
  if (disable) disable.addEventListener('click', function () {
    if (!AUTH.user || !AUTH.user.twofaEnabled) return;
    var pwd = window.prompt('كلمة المرور (لتعطيل 2FA)');
    if (pwd == null) return;
    API.post('/api/2fa/disable', { password: pwd }).then(function (r) {
      if (!r.ok) { toast((r.data && r.data.message) || T('auth.error'), 'err'); return; }
      if (AUTH.user) AUTH.user.twofaEnabled = false;
      refreshStatus();
      toast(T('sec.disable2fa') + ' ✔', 'ok');
    });
  });

  if (loginVerify) loginVerify.addEventListener('click', submit2faLogin);
  if (loginInp) loginInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit2faLogin(); });

  refreshStatus();
}
window.init2fa = init2fa;

function openTwofaModal() {
  var m = document.getElementById('twofaModal');
  if (m) m.classList.add('show');
}
window.openTwofaModal = openTwofaModal;

function closeTwofaModal() {
  var m = document.getElementById('twofaModal');
  if (m) m.classList.remove('show');
}
window.closeTwofaModal = closeTwofaModal;

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

/* ربط واجهة 2FA عند جاهزية DOM (إن وُجدت عناصرها في الصفحة) */
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof init2fa === 'function') init2fa();
  });
}
