/* ═══════════════════════════════════════════
   Digital Moroccan casino — Main Application
   Initialization, Rendering, Navigation
   ═══════════════════════════════════════════ */
"use strict";
/* ═══════════ عرض الألعاب ═══════════ */
/* خريطة: معرف اللعبة → مجلد الأصول (assets/games/<folder>/icon.webp) */
const GAME_IMG = {
  rn: 'ronda', pr: 'parchisi', av: 'crash', mn: 'mines', pl: 'plinko',
  dc: 'dice', cf: 'coin-flip', hl: 'hi-lo', wf: 'wheel', sc: 'scratch',
  wg: 'wingo', rp: 'rock-paper', pn: 'football', l7: 'lucky-7', sb: 'sic-bo',
  rl: 'roulette', bj: 'blackjack', bc: 'baccarat', dt: 'dragon', vp: 'poker',
  ke: 'keno', sl: 'slot-spin', ab: 'andar-bahar',
  crabbin: 'crabbin',
  fishing: 'fishing',
  gates: 'gates',
  lightning: 'lightning',
  lottery: 'lottery',
  mahjong: 'mahjong',
  money: 'money',
  olympus: 'olympus',
  poker: 'poker',
  rose: 'rose',
  'sweet-bonanza': 'sweet-bonanza'
};
function tileHTML(g) {
  const tagClass = { HOT: 'hot', NEW: 'new', LIVE: 'live' }[g.tag] || 'hot';
  const img = GAME_IMG[g.id];
  const art = img
    ? '<div class="art ' + g.art + ' hasimg" aria-hidden="true"><img src="assets/games/' + img + '/icon.webp" alt="" loading="lazy"></div>'
    : '<div class="art ' + g.art + '" aria-hidden="true">' + g.em + '</div>';
  const networkIndicator = [ 'rp', 'pn', 'pr', 'rn' ].includes(g.id) ? '<span class="net-indicator net-enabled">🔌 سريع</span>' : '';
  const playButton = [ 'rp', 'pn', 'pr', 'rn' ].includes(g.id)
    ? '<button class="playbtn net-btn" onclick="Rooms.toggleFromGame()" aria-label="' + T('g.play') + ' →">' + T('g.play') + ' →</button>'
    : '<button class="playbtn" onclick="openGame(\'' + g.id + '\')" aria-label="' + T('g.play') + ' →">' + T('g.play') + ' →</button>';
  return '<div class="tile" onclick="openGame(\'' + g.id + '\')" ' +
    'role="button" tabindex="0" aria-label="' + g.n + '" ' +
    'onkeypress="if(event.key===\'Enter\') openGame(\'' + g.id + '\')">' +
    '<span class="gtag ' + tagClass + '">' + g.tag + '</span>' +
    '<span class="gpl"><span class="dot" aria-hidden="true"></span>' + fmt(g.pl) + '</span>' +
    art +
    '<div class="tinfo">' +
      '<div class="tname">' + g.n + '</div>' +
      '<div class="tmeta">' +
        '<span>' + g.d[langIndex()] + '</span>' +
        '<span class="rtp">' + g.rtp + '%</span>' +
      '</div>' +
      '<div class="tile-meta">' +
        playButton +
        networkIndicator +
      '</div>' +
    '</div>' +
    '</div>';
}
function renderGames() {
  const featured = document.getElementById('rowFeatured');
  const crash = document.getElementById('rowCrash');
  const instant = document.getElementById('rowInstant');
  const all = document.getElementById('allGames');
  const vis = g => !DISABLED[g.id];
  if (featured) {
    featured.innerHTML = [GAMES[0], GAMES[1], GAMES[2], GAMES[17]]
      .filter(Boolean)
      .filter(vis)
      .map(tileHTML)
      .join('');
  }
  if (crash) {
    crash.innerHTML = GAMES.filter(g => g.cat === 'crash').filter(vis).map(tileHTML).join('');
  }
  if (instant) {
    instant.innerHTML = GAMES.filter(g => g.cat === 'instant').filter(vis).slice(0, 8).map(tileHTML).join('');
  }
  if (all) {
    all.innerHTML = GAMES.filter(vis).map(tileHTML).join('');
  }
}
function filterG(c, el) {
  SND.click();
  const chips = document.querySelectorAll('#gameFilters .fchip');
  chips.forEach(chip => chip.classList.remove('active'));
  if (el) {
    el.classList.add('active');
    el.setAttribute('aria-selected', 'true');
  }
  chips.forEach(chip => {
    if (chip !== el) chip.removeAttribute('aria-selected');
  });
  const list = c === 'all' ? GAMES.filter(g => !DISABLED[g.id]) : GAMES.filter(g => g.cat === c && !DISABLED[g.id]);
  const allEl = document.getElementById('allGames');
  if (allEl) allEl.innerHTML = list.map(tileHTML).join('');
}
/* ═══════════ البطولات ═══════════ */
/* ═══════════ صفحة البطولات (حقيقية — من الـ API) ═══════════ */
function renderTourney() {
  const el = document.getElementById('tourneyList');
  if (!el) return;
  el.innerHTML = '<div class="note">…</div>';
  Promise.all([API.get('/api/tournaments'), API.get('/api/games')]).then(function (rs) {
    const ts = (rs[0].ok && rs[0].data && rs[0].data.tournaments) ? rs[0].data.tournaments : [];
    const me = AUTH.user;
    const gmap = {};
    GAMES.forEach(function (g) { gmap[g.id] = g; });
    const statusLabel = {
      pending: '⏳ ' + T('admin.tPending'),
      approved: '✅ ' + T('admin.tApproved'),
      active: '🔴 ' + T('admin.tActive'),
      finished: '🏁 ' + T('admin.tFinished'),
      rejected: '❌ ' + T('admin.tRejected')
    };
    const createBtn = '<button class="btn" onclick="openTcModal()">' + T('tourney.create') + '</button>';
    if (!ts.length) {
      el.innerHTML = '<div style="grid-column:1/-1;display:flex;flex-direction:column;gap:12px;align-items:center">' +
        createBtn + '<div class="note">' + T('tourney.empty') + '</div></div>';
      return;
    }
    el.innerHTML = '<div style="grid-column:1/-1;display:flex;justify-content:flex-end;margin-bottom:4px">' + createBtn + '</div>' +
      ts.map(function (t) {
        const g = gmap[t.game_id] || { em: '🎮', n: t.game_id };
        const joined = me && t.players.some(function (p) { return p.id === me.id; });
        const statusSpan = '<span class="spill ' + (t.status === 'finished' ? 'bad' : (t.status === 'active' ? 'ok' : '')) + '">' + (statusLabel[t.status] || t.status) + '</span>';
        let actionBtn = '';
        if (t.status === 'approved' || t.status === 'pending') {
          if (joined) {
            actionBtn = '<span class="spill ok">' + T('tourney.joined') + '</span>';
          } else if (t.players_count < t.max_players) {
            actionBtn = '<button class="btn" onclick="joinTourney(\'' + t.id + '\')">' + T('tourney.join') + '</button>';
          } else {
            actionBtn = '<span class="spill bad">' + T('tourney.full') + '</span>';
          }
        } else if (t.status === 'active') {
          actionBtn = '<span class="spill ok">🔴</span>';
        } else {
          actionBtn = '—';
        }
        return '<div class="card">' +
          '<div style="font-size:1.6rem;text-align:center">' + g.em + '</div>' +
          '<b>' + esc(t.name) + '</b>' +
          '<div class="mrow"><span>' + T('tourney.game') + '</span><b>' + esc(g.n) + '</b></div>' +
          '<div class="mrow"><span>' + T('tourney.owner') + '</span><b>' + esc(t.owner_name) + '</b></div>' +
          '<div class="mrow"><span>' + T('tourney.prize') + '</span><b class="gold-text">🪙 ' + fmt(t.prize) + '</b></div>' +
          '<div class="mrow"><span>' + T('tourney.players') + '</span><b>' + t.players_count + '/' + t.max_players + '</b></div>' +
          (t.entry_fee > 0 ? '<div class="mrow"><span>' + T('tourney.fee') + '</span><b>🪙 ' + fmt(t.entry_fee) + '</b></div>' : '') +
          '<div class="mrow"><span>' + T('admin.status') + '</span>' + statusSpan + '</div>' +
          '<div style="margin-top:8px;text-align:center">' + actionBtn + '</div>' +
        '</div>';
      }).join('');
  }).catch(function () {
    el.innerHTML = '<div class="note">' + T('auth.error') + '</div>';
  });
}

/* ── صفحة غرف اللعب المفتوحة: انضمام أو فرجة ── */
function renderRooms() {
  const el = document.getElementById('roomsList');
  if (!el) return;
  el.innerHTML = '<div class="note">…</div>';
  API.get('/api/rooms').then(function (r) {
    const rooms = (r.ok && r.data && r.data.rooms) ? r.data.rooms : [];
    if (!rooms.length) {
      el.innerHTML = '<div class="note" style="grid-column:1/-1;text-align:center">' + T('rooms.empty') + '</div>';
      return;
    }
    const gmap = {};
    GAMES.forEach(function (g) { gmap[g.id] = g; });
    el.innerHTML = rooms.map(function (rm) {
      const g = gmap[rm.game_id] || { em: '🎮', n: rm.game_id };
      const statusSpan = rm.status === 'playing'
        ? '<span class="spill bad">🔴 ' + T('rooms.playing') + '</span>'
        : '<span class="spill ok">⏳ ' + T('rooms.waiting') + '</span>';
      let action = '';
      if (rm.status === 'waiting' && rm.players_count < rm.max_players) {
        action = '<button class="btn" onclick="joinOpenRoom(\'' + esc(rm.code) + '\')">' + T('rooms.join') + '</button>';
      } else if (rm.status === 'waiting') {
        action = '<span class="spill bad">' + T('rooms.full') + '</span>';
      } else {
        action = '<span class="spill bad">🔴 ' + T('rooms.playing') + '</span>';
      }
      return '<div class="card">' +
        '<div style="font-size:1.6rem;text-align:center">' + g.em + '</div>' +
        '<b>' + esc(g.n) + '</b>' +
        '<div class="mrow"><span>' + T('rooms.host') + '</span><b>' + esc(rm.owner_name) + '</b></div>' +
        '<div class="mrow"><span>' + T('rooms.players') + '</span><b>' + rm.players_count + '/' + rm.max_players + '</b></div>' +
        '<div class="mrow"><span>' + T('rooms.code') + '</span><b dir="ltr">' + esc(rm.code) + '</b></div>' +
        '<div class="mrow"><span>' + T('admin.status') + '</span>' + statusSpan + '</div>' +
        '<div style="margin-top:8px;text-align:center">' + action + '</div>' +
      '</div>';
    }).join('');
  }).catch(function () {
    el.innerHTML = '<div class="note">' + T('auth.error') + '</div>';
  });
}
function joinOpenRoom(code) {
  if (typeof Rooms !== 'undefined' && Rooms.joinRoom) Rooms.joinRoom(code);
}

/* ── إنشاء بطولة (مودال) ── */
function openTcModal() {
  if (!AUTH.user) { toast(T('auth.sessionExpired'), 'warn'); return; }
  const sel = document.getElementById('tcGame');
  if (sel && !sel.options.length) {
    const allowed = ['rn', 'rp', 'pn', 'pr', 'ke', 'av', 'rl', 'bj', 'bc'];
    sel.innerHTML = GAMES.filter(function (g) { return allowed.indexOf(g.id) >= 0; })
      .map(function (g) { return '<option value="' + g.id + '">' + g.em + ' ' + esc(g.n) + '</option>'; })
      .join('');
  }
  const msg = document.getElementById('tcMsg');
  if (msg) msg.textContent = '';
  const mw = document.getElementById('tcModal');
  if (mw) mw.classList.add('show');
}
function closeTcModal() {
  const mw = document.getElementById('tcModal');
  if (mw) mw.classList.remove('show');
}
function createTourney() {
  const nameEl = document.getElementById('tcName');
  const maxEl = document.getElementById('tcMax');
  const feeEl = document.getElementById('tcFee');
  const name = nameEl ? nameEl.value.trim() : '';
  const game_id = (document.getElementById('tcGame') || {}).value;
  const max_players = parseInt(maxEl ? maxEl.value : '8', 10);
  const entry_fee = parseInt(feeEl ? feeEl.value : '0', 10);
  if (!name) { toast(T('tourney.name') + ' ⚠', 'warn'); return; }
  API.post('/api/tournaments', {
    name: name,
    game_id: game_id,
    max_players: Number.isNaN(max_players) ? 8 : max_players,
    entry_fee: Number.isNaN(entry_fee) ? 0 : entry_fee
  }).then(function (r) {
    if (r.ok) {
      const st = r.data.tournament && r.data.tournament.status;
      toast((st === 'approved' ? T('admin.tApproved') : T('admin.tPending')) + ' ✔', 'ok');
      closeTcModal();
      renderTourney();
      if (typeof wallet === 'function') wallet();
    } else {
      toast((r.data && r.data.message) || T('auth.error'), 'err');
    }
  });
}
function joinTourney(id) {
  API.post('/api/tournaments/join', { id: id }).then(function (r) {
    if (r.ok) {
      toast(T('tourney.join') + ' ✔', 'ok');
      renderTourney();
      if (typeof wallet === 'function') wallet();
    } else {
      toast((r.data && r.data.message) || T('auth.error'), 'err');
    }
  });
}

/* ═══════════ تحويل الكوينز بين اللاعبين ═══════════ */
function openTrModal() {
  if (!AUTH.user) { toast(T('tr.needLogin'), 'warn'); return; }
  const msg = document.getElementById('trMsg');
  if (msg) msg.textContent = '';
  const mw = document.getElementById('trModal');
  if (mw) mw.classList.add('show');
  loadTrHistory();
}
function closeTrModal() {
  const mw = document.getElementById('trModal');
  if (mw) mw.classList.remove('show');
}
function sendCoins() {
  const to = ((document.getElementById('trTo') || {}).value || '').trim();
  const amtEl = document.getElementById('trAmt');
  const amount = parseInt(amtEl ? amtEl.value : '0', 10);
  if (!to) { toast(T('tr.recipient') + ' ⚠', 'warn'); return; }
  if (Number.isNaN(amount) || amount <= 0) { toast(T('tr.badAmount'), 'err'); return; }
  if (AUTH.user && to === AUTH.user.username) { toast(T('tr.self'), 'warn'); return; }
  API.post('/api/transfer', { to: to, amount: amount }).then(function (r) {
    if (r.ok) {
      toast('🪙 ' + fmt(amount) + ' → ' + esc(r.data.to) + ' ✔', 'ok');
      if (amtEl) amtEl.value = '100';
      if (typeof wallet === 'function') wallet();
      loadTrHistory();
    } else {
      toast((r.data && r.data.message) || T('auth.error'), 'err');
    }
  });
}
function loadTrHistory() {
  const list = document.getElementById('trList');
  if (!list) return;
  list.innerHTML = '<div class="note">…</div>';
  API.get('/api/transfers').then(function (r) {
    const trs = (r.ok && r.data && r.data.transfers) ? r.data.transfers : [];
    if (!trs.length) { list.innerHTML = '<div class="note">' + T('tr.noHistory') + '</div>'; return; }
    const meId = AUTH.user ? AUTH.user.id : null;
    list.innerHTML = trs.map(function (tr) {
      const outgoing = tr.from_id === meId;
      const who = outgoing ? tr.to_name : tr.from_name;
      const sign = outgoing ? '−' : '+';
      return '<div class="trow"><span>' + (outgoing ? '→' : '←') + ' ' + esc(who) + '</span>' +
        '<b class="' + (outgoing ? '' : 'gold-text') + '">' + sign + ' 🪙 ' + fmt(tr.amount) + '</b></div>';
    }).join('');
  }).catch(function () {
    list.innerHTML = '<div class="note">' + T('auth.error') + '</div>';
  });
}
/* ═══════════ صفحة سجل المعاملات ═══════════ */
function openTransactionHistory() {
  if (!AUTH.user) { toast(T('tr.needLogin'), 'warn'); return; }
  closeAcctMenu();
  nav('transactions', null);
  renderTransactions();
}
function renderTransactions() {
  const pg = document.getElementById('pg-transactions');
  if (!pg || !pg.classList.contains('active')) return;
  const txTransfers = document.getElementById('txTransfers');
  const txRounds = document.getElementById('txRounds');
  if (!txTransfers || !txRounds) return;
  if (!AUTH.user) {
    txTransfers.innerHTML = '<div class="note">' + T('tr.needLogin') + '</div>';
    txRounds.innerHTML = '<div class="note">' + T('tr.needLogin') + '</div>';
    return;
  }
  /* التحويلات بين اللاعبين */
  txTransfers.innerHTML = '<div class="note">…</div>';
  API.get('/api/transfers').then(function (r) {
    const trs = (r.ok && r.data && r.data.transfers) ? r.data.transfers : [];
    if (!trs.length) { txTransfers.innerHTML = '<div class="note">' + T('tr.noHistory') + '</div>'; return; }
    const meId = AUTH.user.id;
    txTransfers.innerHTML =
      '<table class="atable tr-t">' +
      '<thead><tr>' +
        '<th>' + T('tr.type') + '</th>' +
        '<th>' + T('tr.counterparty') + '</th>' +
        '<th>' + T('tr.sent') + '</th>' +
        '<th>' + T('tr.received') + '</th>' +
        '<th>' + T('tr.time') + '</th>' +
      '</tr></thead><tbody>' +
      trs.map(function (tr) {
        const outgoing = tr.from_id === meId;
        const who = outgoing ? tr.to_name : tr.from_name;
        const t = tr.created_at ? new Date(tr.created_at * 1000).toLocaleString() : '—';
        const sentCell = outgoing ? '<td>− 🪙 ' + fmt(tr.amount) + '</td>' : '<td>—</td>';
        const recvCell = outgoing ? '<td>—</td>' : '<td class="gold-text">+ 🪙 ' + fmt(tr.amount) + '</td>';
        const spillClass = outgoing ? 'bad' : 'ok';
        const dirLabel = outgoing ? '→ ' + T('tr.sent') : '← ' + T('tr.received');
        return '<tr>' +
          '<td><span class="spill ' + spillClass + '">' + dirLabel + '</span></td>' +
          '<td>' + esc(who) + '</td>' +
          sentCell + recvCell +
          '<td>' + t + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';
  }).catch(function () {
    txTransfers.innerHTML = '<div class="note">' + T('auth.error') + '</div>';
  });
  /* سجل المراهنات (الألعاب) */
  txRounds.innerHTML = '<div class="note">…</div>';
  API.get('/api/rounds').then(function (r) {
    const rounds = (r.ok && r.data && r.data.rounds) ? r.data.rounds : [];
    if (!rounds.length) { txRounds.innerHTML = '<div class="note">' + T('tr.noHistory') + '</div>'; return; }
    txRounds.innerHTML =
      '<table class="atable tr-t">' +
      '<thead><tr>' +
        '<th>' + T('tr.game') + '</th>' +
        '<th>' + T('tr.bet') + '</th>' +
        '<th>' + T('tr.outcome') + '</th>' +
        '<th>' + T('tr.time') + '</th>' +
      '</tr></thead><tbody>' +
      rounds.map(function (rd) {
        const g = (typeof GAMES !== 'undefined') ? GAMES.find(function (x) { return x.id === rd.game_id; }) : null;
        const label = g ? (g.em + ' ' + esc(g.n)) : esc(rd.game_id);
        const outcome = rd.won
          ? '<span class="spill ok">+🪙 ' + fmt(rd.payout) + '</span>'
          : '<span class="spill bad">−🪙 ' + fmt(rd.bet) + '</span>';
        const t = rd.created_at ? new Date(rd.created_at * 1000).toLocaleString() : '—';
        return '<tr>' +
          '<td>' + label + '</td>' +
          '<td>🪙 ' + fmt(rd.bet) + '</td>' +
          '<td>' + outcome + '</td>' +
          '<td>' + t + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';
  }).catch(function () {
    txRounds.innerHTML = '<div class="note">' + T('auth.error') + '</div>';
  });
}
/* ═══════════ صفحة سجل الحساب ═══════════ */
function openAccountLog() {
  if (!AUTH.user) { toast(T('tr.needLogin'), 'warn'); return; }
  closeAcctMenu();
  nav('account', null);
  renderAccountLog();
}
function renderAccountLog() {
  const pg = document.getElementById('pg-account');
  if (!pg || !pg.classList.contains('active')) return;
  const el = document.getElementById('accountInfo');
  if (!el) return;
  if (!AUTH.user) {
    el.innerHTML = '<div class="note">' + T('tr.needLogin') + '</div>';
    return;
  }
  const u = AUTH.user;
  const joined = u.created_at ? new Date(u.created_at * 1000).toLocaleString() : '—';
  const lastSeen = u.last_seen ? new Date(u.last_seen * 1000).toLocaleString() : '—';
  el.innerHTML =
    '<table class="atable">' +
    '<tbody>' +
      '<tr><th>' + T('auth.username') + '</th><td><b>' + esc(u.username) + '</b></td></tr>' +
      '<tr><th>' + T('auth.balance') + '</th><td>🪙 ' + fmt(u.gold) + '</td></tr>' +
      '<tr><th>' + T('admin.role') + '</th><td>' + roleLabel(u.role) + '</td></tr>' +
      '<tr><th>' + T('acct.joined') + '</th><td>' + joined + '</td></tr>' +
      '<tr><th>' + T('acct.lastSeen') + '</th><td>' + lastSeen + '</td></tr>' +
      (u.admin_id ? '<tr><th>' + T('acct.adminRef') + '</th><td>' + esc(String(u.admin_id)) + '</td></tr>' : '') +
    '</tbody></table>';
}
/* خريطة محرك التهيئة — تُستدعى بعد رسم واجهة اللعبة */
function initFor(eng) {
  const map = {
    ronda: (typeof initRonda === 'function') ? initRonda : null,
    plinko: (typeof initPlinko === 'function') ? initPlinko : null,
    wheel: (typeof initWheel === 'function') ? initWheel : null,
    hilo: (typeof initHilo === 'function') ? initHilo : null,
    rl: (typeof initRoulette === 'function') ? initRoulette : null,
    crash: (typeof window.initCrash === 'function') ? window.initCrash : null
  };
  return map[eng] || null;
}
function openGame(id) {
  /* لعبة معطلة من قبل الأدمن */
  if (DISABLED[id]) {
    toast(T('admin.gameDisabledMsg') || 'اللعبة معطلة حالياً', 'warn');
    return;
  }
  const g = GAMES.find(x => x.id === id);
  if (!g) {
    toast('اللعبة غير موجودة', 'err');
    return;
  }
  SND.click();
  /* إغلاق أي مودال قديم أولاً — cleanupCrash() يجب أن يسبق initCrash()
     وإلا صُفّر scene ثلاثي الأبعاد أثناء await التهيئة فيكسر لعبة Crash */
  closeModal();
  window._currentGameId = id;
  /* زر «العب مع صديق» فقط للألعاب المدعومة (rp/pn/pr) */
  if (typeof Rooms !== 'undefined' && Rooms.syncBtn) Rooms.syncBtn();
  /* رأس صفحة اللعبة */
  const iconEl = document.getElementById('gamePageIcon');
  const nameEl = document.getElementById('gamePageName');
  if (iconEl) iconEl.textContent = g.em;
  if (nameEl) nameEl.textContent = g.n;
  const bodyEl = document.getElementById('gamePageBody');
  if (!bodyEl) return;
  /* Parchisi: يُستنسخ من القالب داخل صفحة اللعبة */
  if (id === 'pr') {
    const tpl = document.getElementById('parchisiTpl');
    if (tpl) {
      bodyEl.innerHTML = tpl.innerHTML;
      ParchisiApp.init();
    }
  } else {
    const engFn = (typeof ENG !== 'undefined' && ENG[g.eng]) || eSlots;
    bodyEl.innerHTML = engFn(g);
    const initFn = initFor(g.eng);
    if (initFn) {
      try { initFn(); } catch (e) { console.error('Init error:', e); }
    }
  }
  /* اللعبة الحالية وفتح الصفحة (closeModal سبق تنفيذه قبل الرسم) */
  window._currentGameId = id;
  nav('game', null);
  window.scrollTo(0, 0);
  startGameHistory(id);
  /* اللعب الجماعي (كينو/كراش): تفعيل لوحة الجولة + السجل الحي */
  if ((id === 'ke' || id === 'av') && typeof Group !== 'undefined') {
    Group.activate(id);
  }
  /* شاشة ممتلئة تلقائية عند فتح أي لعبة — تُطلب فوراً بعد فتح الصفحة
     (تنجح لأن openGame يُستدعى من نقرة المستخدم؛ إن رفضها المتصفح نتجاهل بصمت) */
  if (gameFsSupported()) {
    const pg = document.getElementById('pg-game');
    if (pg) {
      const fn = pg.requestFullscreen || pg.webkitRequestFullscreen;
      if (fn) {
        try {
          const p = fn.call(pg);
          if (p && typeof p.catch === 'function') p.catch(function () { /* مرفوض — لا مشكلة */ });
        } catch (e) { /* غير مدعوم في هذا السياق */ }
      }
    }
  }
  /* نافذة القواعد لا تُفتح إلا عند الضغط على أيقونة «القواعد» */
  /* فحص فرض الوضع العرضي بعد رسم المرحلة (للألعاب العريضة على الموبايل) */
  setTimeout(checkRotateHint, 180);
}
function closeGamePage() {
  stopGameHistory();
  /* إيقاف لوحة الجولات الجماعية إن كانت نشطة */
  if (typeof Group !== 'undefined') Group.deactivate();
  /* مغادرة صامتة لأي غرفة (الانضمام عبر زر الرجوع من صفحة اللعبة) */
  if (typeof Rooms !== 'undefined') Rooms.leaveQuiet();
  window._currentGameId = null;
  /* تنظيف Crash إن كان نشطاً */
  if (typeof cleanupCrash === 'function') {
    cleanupCrash();
  }
  /* خروج تلقائي من ملء الشاشة إن كنا فيه */
  const doc = document;
  if (doc.fullscreenElement || doc.webkitFullscreenElement) {
    const ex = doc.exitFullscreen || doc.webkitExitFullscreen;
    if (ex) ex.call(doc);
  }
  const gamesNav = document.querySelector('[data-nav=games]');
  nav('games', gamesNav || null);
  window.scrollTo(0, 0);
}
/* ═══════════ ملء الشاشة للعبة ═══════════ */
function gameFsSupported() {
  const d = document;
  return !!(d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen);
}
function toggleGameFullscreen() {
  if (!gameFsSupported()) {
    toast(T('ui.fsUnsupported'), 'warn');
    return;
  }
  const pg = document.getElementById('pg-game');
  if (!pg) return;
  const doc = document;
  if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
    const fn = pg.requestFullscreen || pg.webkitRequestFullscreen;
    if (fn) { fn.call(pg); }
  } else {
    const ex = doc.exitFullscreen || doc.webkitExitFullscreen;
    if (ex) ex.call(doc);
  }
}
function syncGameFsBtn() {
  const btn = document.getElementById('gameFsBtn');
  if (!btn) return;
  const on = document.fullscreenElement || document.webkitFullscreenElement;
  const label = on ? T('ui.exitFullscreen') : T('ui.fullscreen');
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}
/* ═══════════ فرض الوضع العرضي للألعاب العريضة (عرض > طول) ═══════════ */
function isRotateRelevant() {
  /* جهاز لمس + شاشة عمودية ضيقة + داخل لعبة */
  const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (!touch || !window._currentGameId) return false;
  const narrow = window.innerWidth <= 900 && window.innerWidth < window.innerHeight;
  return narrow;
}
function checkRotateHint() {
  const hint = document.getElementById('rotateHint');
  if (!hint) return;
  let wide = false;
  if (isRotateRelevant()) {
    const body = document.getElementById('gamePageBody');
    if (body) {
      /* أعرض عنصر لعب (مرحلة، طاولة، كانفس) — يلتقط الطبيعة العرضية للعبة
         حتى لو كانت أزرار التحكم تحته تطيل المرحلة عمودياً */
      const els = body.querySelectorAll('.stage, .bjt, canvas, .slots-wrap, .reels');
      let best = null;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.height <= 40) continue;
        if (!best || r.width / r.height > best.w / best.h) best = { w: r.width, h: r.height };
      }
      wide = !!best && best.w > best.h * 1.15;
    }
  }
  if (wide) {
    hint.hidden = false;
    /* محاولة قفل الاتجاه العرضي في ملء الشاشة (حيث يُدعم) */
    if (document.fullscreenElement && screen.orientation && typeof screen.orientation.lock === 'function') {
      try { screen.orientation.lock('landscape').catch(function () {}); } catch (e) { /* غير مدعوم */ }
    }
  } else {
    hint.hidden = true;
  }
}
function closeModal() {
  const gModal = document.getElementById('gModal');
  if (gModal) {
    gModal.classList.remove('show');
  }
  /* إيقاف لوحة الجولات الجماعية إن كانت نشطة */
  if (typeof Group !== 'undefined') Group.deactivate();
  /* تنظيف Crash إن كان نشطاً */
  if (typeof cleanupCrash === 'function') {
    cleanupCrash();
  }
  window._currentGameId = null;
}
/* ═══════════ سجل الجولات الحي ═══════════ */
let _histTimer = null;
let _histGame = null;
let _localRounds = [];
let _serverRounds = [];
/* تسجيل جولة محلية (وإرسالها للخادم إن كان المستخدم مسجلاً) */
function recordRound(won, payout, txt) {
  const gid = window._currentGameId;
  if (!gid) return;
  const me = (AUTH && AUTH.user) ? AUTH.user.username : 'أنت';
  const bet = (typeof GB === 'number') ? GB : 0;
  const row = {
    username: me,
    bet: bet,
    won: won ? 1 : 0,
    payout: (typeof payout === 'number' && payout > 0) ? payout : 0,
    created_at: Math.floor(Date.now() / 1000),
    local: true
  };
  _localRounds.unshift(row);
  if (_localRounds.length > 25) _localRounds.pop();
  if (_histGame === gid) renderGameHistory();
  /* إرسال للخادم إن كان المستخدم مسجلاً */
  if (AUTH && AUTH.user && typeof API !== 'undefined') {
    API.post('/api/rounds', { game_id: gid, bet: row.bet, won: row.won, payout: row.payout })
      .catch(function () {});
  }
}
/* بدء تحديث السجل من الخادم كل 4 ثوانٍ */
function startGameHistory(gid) {
  stopGameHistory();
  _histGame = gid;
  _localRounds = [];
  _serverRounds = [];
  fetchHistory();
  _histTimer = setInterval(fetchHistory, 4000);
}
function stopGameHistory() {
  if (_histTimer) {
    clearInterval(_histTimer);
    _histTimer = null;
  }
  _histGame = null;
}
function fetchHistory() {
  if (!_histGame || typeof API === 'undefined') return;
  API.get('/api/games/' + _histGame + '/history').then(function (r) {
    if (r.ok && r.data && r.data.rounds) {
      _serverRounds = r.data.rounds;
      renderGameHistory();
    }
  }).catch(function () {});
}
function renderGameHistory() {
  const el = document.getElementById('gameHistory');
  if (!el) return;
  const rows = _localRounds.concat(_serverRounds);
  if (!rows.length) {
    el.innerHTML = '<div class="note">لا توجد جولات بعد — كن أول من يلعب!</div>';
    return;
  }
  el.innerHTML =
    '<table class="atable ghist-t">' +
      '<thead><tr>' +
        '<th>اللاعب</th><th>الرهان</th><th>النتيجة</th><th>المكسب</th><th>الوقت</th>' +
      '</tr></thead><tbody>' +
      rows.slice(0, 25).map(function (r) {
        const t = r.created_at ? new Date(r.created_at * 1000).toLocaleTimeString() : '—';
        const winCell = r.won
          ? '<span class="spill ok">فوز</span>'
          : '<span class="spill bad">خسارة</span>';
        const who = r.local
          ? '<b class="gold-text">' + esc(r.username) + '</b>'
          : esc(r.username);
        return '<tr>' +
          '<td>' + who + '</td>' +
          '<td>🪙 ' + fmt(r.bet) + '</td>' +
          '<td>' + winCell + '</td>' +
          '<td class="gold-text">+' + fmt(r.payout) + '</td>' +
          '<td>' + t + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';
}
/* ═══════════ المتصدرون ═══════════ */
function renderLB() {
  const players = [
    ['RondaMaster', 58230, '#F5C518'],
    ['KingPlayer', 45230, '#7C3AED'],
    ['CrashKing', 38900, '#1A6CF6'],
    ['LuckyGirl', 31200, '#10B981'],
    ['ProGamer', 28500, '#EF4444'],
    ['GoldHunter', 24100, '#F59E0B'],
    ['StarPlayer', 19800, '#A78BFA'],
    ['WinMaster', 15400, '#60A5FA'],
    ['CoinCollector', 12300, '#34D399'],
    ['NewChamp', 9800, '#F87171']
  ];
  const el = document.getElementById('lbList');
  if (!el) return;
  el.innerHTML = players.map((p, i) => {
    const rankClass = i < 3 ? ' r' + (i + 1) : '';
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
    return '<div class="lrow' + rankClass + '" role="listitem">' +
      '<div class="lrank">' + medal + '</div>' +
      '<div class="lpl">' +
        '<div class="avatar" style="background:' + p[2] + '">' + p[0].slice(-1) + '</div>' +
        '<b>' + p[0] + '</b>' +
      '</div>' +
      '<div class="lcoins">🪙 ' + fmt(p[1]) + '</div>' +
      '</div>';
  }).join('');
}
/* ═══════════ Provably Fair ═══════════ */
function renderFair() {
  if (!ST.serverSeed) {
    ST.serverSeed = Math.random().toString(36).slice(2, 18);
  }
  const hSeedEl = document.getElementById('hSeed');
  const nonceEl = document.getElementById('nonceD');
  if (hSeedEl) hSeedEl.textContent = simpleHash(ST.serverSeed);
  if (nonceEl) nonceEl.textContent = ST.nonce;
}
/* ═══════════ لوحة الإدارة (حقيقية — من الـ API) ═══════════ */
let ADMIN_TAB = 'users';
let DISABLED = {};

/* الألعاب المعطلة: تحميل من الخادم عند تسجيل الدخول */
function loadDisabledGames() {
  if (!AUTH.user) {
    DISABLED = {};
    return Promise.resolve();
  }
  return API.get('/api/games').then(function (r) {
    DISABLED = {};
    const g = (r.ok && r.data && r.data.games) ? r.data.games : {};
    Object.keys(g).forEach(function (id) {
      if (!g[id]) DISABLED[id] = true;
    });
  }).catch(function () {
    DISABLED = {};
  });
}

function renderAdmin() {
  const el = document.getElementById('adminBox');
  if (!el) return;
  /* حماية: غير أدمن → رسالة */
  if (!AUTH.user || AUTH.user.role === 'user') {
    el.innerHTML = '<div class="note">' + T('admin.notAuthorized') + '</div>';
    return;
  }
  const isSuper = AUTH.user.role === 'super';
  adminLoadStats();
  const tabs = isSuper
    ? '<button class="atab' + (ADMIN_TAB === 'users' ? ' active' : '') + '" role="tab" onclick="adminTab(\'users\')">' + T('admin.usersTab') + '</button>' +
      '<button class="atab' + (ADMIN_TAB === 'tourneys' ? ' active' : '') + '" role="tab" onclick="adminTab(\'tourneys\')">🏆 ' + T('ui.tourney') + '</button>' +
      '<button class="atab' + (ADMIN_TAB === 'games' ? ' active' : '') + '" role="tab" onclick="adminTab(\'games\')">' + T('admin.gamesTab') + '</button>' +
      '<button class="atab' + (ADMIN_TAB === 'rewards' ? ' active' : '') + '" role="tab" onclick="adminTab(\'rewards\')">' + T('admin.rewardsTab') + '</button>' +
      '<button class="atab' + (ADMIN_TAB === 'fin' ? ' active' : '') + '" role="tab" onclick="adminTab(\'fin\')">' + T('admin.finTab') + '</button>'
    : '<button class="atab' + (ADMIN_TAB === 'users' ? ' active' : '') + '" role="tab" onclick="adminTab(\'users\')">👥 ' + T('admin.myPlayers') + '</button>' +
      '<button class="atab' + (ADMIN_TAB === 'tourneys' ? ' active' : '') + '" role="tab" onclick="adminTab(\'tourneys\')">🏆 ' + T('ui.tourney') + '</button>';
  el.innerHTML =
    '<div class="atabs" role="tablist">' + tabs + '</div>' +
    '<div id="adminContent"><div class="note">…</div></div>';
  if (ADMIN_TAB === 'users') adminLoadUsers();
  else if (ADMIN_TAB === 'tourneys') adminLoadTourneys();
  else if (ADMIN_TAB === 'games') adminLoadGames();
  else if (ADMIN_TAB === 'rewards') adminLoadRewards();
  else adminLoadFinance();
}

function adminTab(tab) {
  SND.click();
  ADMIN_TAB = tab;
  renderAdmin();
}

/* ── البطاقات العلوية ── */
function adminLoadStats() {
  if (!AUTH.user || AUTH.user.role === 'user') return;
  API.get('/api/admin/stats').then(function (r) {
    if (!r.ok || !r.data) return;
    const s = r.data;
    const set = function (id, val) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('adminStatUsers', fmt(s.users_total || 0));
    set('adminStatOnline', fmt(s.active_today || 0));
    set('adminStatPlays', fmt(s.plays_total || 0));
    set('adminStatCoins', fmt((s.gold_total || 0) + (s.coins_won_total || 0)));
  }).catch(function () {});
}

/* ── تبويب المستخدمون ── */
function adminLoadUsers() {
  const c = document.getElementById('adminContent');
  if (!c) return;
  c.innerHTML = '<div class="note">…</div>';
  API.get('/api/admin/users').then(function (r) {
    if (!r.ok) {
      c.innerHTML = '<div class="note">' + ((r.data && r.data.message) || T('auth.error')) + '</div>';
      return;
    }
    const users = r.data.users || [];
    const isSuper = AUTH.user && AUTH.user.role === 'super';
    /* نموذج تسجيل لاعب جديد (للأدمن: لاعبيه؛ للسوبر: أي لاعب) */
    const regForm =
      '<div class="card" style="margin-bottom:14px">' +
        '<div class="ctitle">➕ ' + T('admin.registerNew') + '</div>' +
        '<div class="reg-row">' +
          '<input class="ainp" id="regU" placeholder="' + T('auth.username') + '" maxlength="20" style="width:150px">' +
          '<input class="ainp" id="regP" type="password" placeholder="' + T('auth.password') + '" maxlength="40" style="width:150px">' +
          '<button class="abtn" onclick="adminRegister()">' + T('admin.registerBtn') + '</button>' +
        '</div>' +
      '</div>';
    if (!users.length) {
      c.innerHTML = regForm + '<div class="note">' + T('admin.noUsers') + '</div>';
      return;
    }
    c.innerHTML = regForm +
      '<div class="atable-wrap"><table class="atable">' +
      '<thead><tr>' +
        '<th>ID</th><th>' + T('auth.username') + '</th><th>' + T('admin.balance') + '</th>' +
        (isSuper ? '<th>' + T('admin.lastSeen') + '</th><th>' + T('admin.status') + '</th><th>' + T('admin.setBalance') + '</th>' : '') +
        '<th>' + T('admin.charge') + '</th><th>' + T('admin.deduct') + '</th><th>' + T('admin.password') + '</th>' +
        (isSuper ? '<th></th><th>' + T('admin.role') + '</th>' : '') +
      '</tr></thead><tbody>' +
      users.map(function (u) {
        const balCell = isSuper
          ? '<td>🪙 ' + fmt(u.gold) + '</td>' +
            '<td>' + (u.last_seen ? new Date(u.last_seen * 1000).toLocaleString() : '—') + '</td>' +
            '<td>' + (u.banned ? '<span class="spill bad">' + T('admin.banned') + '</span>' : '<span class="spill ok">' + T('admin.active') + '</span>') + '</td>' +
            '<td class="abal"><input class="ainp" id="bal-' + u.id + '" type="number" value="' + u.gold + '" min="0" aria-label="رصيد ' + esc(u.username) + '" style="width:90px">' +
            '<button class="abtn" onclick="adminSetBalance(' + u.id + ')">' + T('admin.save') + '</button></td>'
          : '<td>🪙 ' + fmt(u.gold) + '</td>';
        const chargeCell =
          '<input class="ainp" id="ch-' + u.id + '" type="number" value="100" min="1" aria-label="شحن ' + esc(u.username) + '" style="width:80px">' +
          '<button class="abtn ok" onclick="adminChargeDeduct(' + u.id + ',\'charge\')">+' + T('admin.charge') + '</button>';
        const deductCell =
          '<input class="ainp" id="dc-' + u.id + '" type="number" value="100" min="1" aria-label="خصم ' + esc(u.username) + '" style="width:80px">' +
          '<button class="abtn bad" onclick="adminChargeDeduct(' + u.id + ',\'deduct\')">−' + T('admin.deduct') + '</button>';
        const passCell =
          '<input class="ainp" id="pw-' + u.id + '" type="password" placeholder="' + T('admin.newPass') + '" aria-label="كلمة مرور ' + esc(u.username) + '" style="width:110px">' +
          '<button class="abtn" onclick="adminSetPassword(' + u.id + ')">' + T('admin.save') + '</button>';
        const banCell = isSuper
          ? '<td>' + (u.banned
              ? '<button class="abtn ok" onclick="adminToggleBan(' + u.id + ',0)">' + T('admin.unban') + '</button>'
              : '<button class="abtn bad" onclick="adminToggleBan(' + u.id + ',1)">' + T('admin.ban') + '</button>') + '</td>'
          : '';
        const roleCell = isSuper
          ? '<td><select class="ainp" id="role-' + u.id + '" aria-label="دور ' + esc(u.username) + '">' +
              ['user', 'admin', 'super'].map(function (ro) {
                return '<option value="' + ro + '"' + (u.role === ro ? ' selected' : '') + '>' + roleLabel(ro) + '</option>';
              }).join('') +
            '</select><button class="abtn" onclick="adminSetRole(' + u.id + ')">' + T('admin.save') + '</button></td>'
          : '';
        const bannedRow = u.banned && !isSuper ? '<span class="spill bad">' + T('admin.banned') + '</span>' : '';
        return '<tr>' +
          '<td>' + u.id + '</td>' +
          '<td><b>' + esc(u.username) + '</b> ' + bannedRow + '</td>' +
          balCell +
          '<td class="abal">' + chargeCell + '</td>' +
          '<td class="abal">' + deductCell + '</td>' +
          '<td class="abal">' + passCell + '</td>' +
          banCell + roleCell +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }).catch(function () {
    c.innerHTML = '<div class="note">' + T('auth.error') + '</div>';
  });
}

/* تسجيل لاعب جديد من طرف الأدمن */
function adminRegister() {
  const uEl = document.getElementById('regU');
  const pEl = document.getElementById('regP');
  if (!uEl || !pEl) return;
  const username = uEl.value.trim();
  const password = pEl.value;
  if (!username || password.length < 6) {
    toast(T('auth.fill'), 'warn');
    return;
  }
  API.post('/api/admin/register', { username: username, password: password }).then(function (r) {
    if (r.ok) {
      toast(T('auth.accountCreated') + ' ✔', 'ok');
      adminLoadUsers();
      adminLoadStats();
    } else {
      toast((r.data && r.data.message) || T('auth.error'), 'err');
    }
  });
}

/* شحن/خصم: للأدمن ينعكس على رصيده تلقائياً في السيرفر */
function adminChargeDeduct(id, action) {
  const inp = document.getElementById(action === 'charge' ? 'ch-' + id : 'dc-' + id);
  if (!inp) return;
  const amount = parseInt(inp.value, 10);
  if (Number.isNaN(amount) || amount <= 0) {
    toast('مبلغ غير صالح', 'err');
    return;
  }
  const isSuper = AUTH.user && AUTH.user.role === 'super';
  const payload = isSuper
    ? { action: action, amount: amount }
    : { action: action, amount: amount };
  API.post('/api/admin/user/' + id + '/balance', payload).then(function (r) {
    if (r.ok) {
      let msg = (action === 'charge' ? T('admin.charge') + ' ✔' : T('admin.deduct') + ' ✔') + ' ' + fmt(amount);
      if (action === 'charge' && r.data && r.data.commission && r.data.commission > 0) {
        msg += ' | ' + T('admin.commission') + ': ' + fmt(r.data.commission);
      }
      toast(msg, 'ok');
      adminLoadUsers();
      adminLoadStats();
      if (typeof wallet === 'function') wallet();
    } else {
      toast((r.data && r.data.message) || T('auth.error'), 'err');
    }
  });
}

/* تغيير كلمة مرور لاعب (للأدمن: لاعبيه فقط) */
function adminSetPassword(id) {
  const inp = document.getElementById('pw-' + id);
  if (!inp) return;
  const password = inp.value;
  if (password.length < 6) {
    toast(T('admin.badPass'), 'warn');
    return;
  }
  API.post('/api/admin/user/' + id + '/password', { password: password }).then(function (r) {
    if (r.ok) {
      toast(T('admin.password') + ' ✔', 'ok');
      inp.value = '';
    } else {
      toast((r.data && r.data.message) || T('auth.error'), 'err');
    }
  });
}

function adminSetBalance(id) {
  const inp = document.getElementById('bal-' + id);
  if (!inp) return;
  const gold = parseInt(inp.value, 10);
  if (Number.isNaN(gold) || gold < 0) {
    toast('رصيد غير صالح', 'err');
    return;
  }
  API.post('/api/admin/user/' + id + '/balance', { gold: gold }).then(function (r) {
    if (r.ok) {
      toast(T('admin.setBalance') + ' ✔', 'ok');
      adminLoadUsers();
      adminLoadStats();
    } else {
      toast((r.data && r.data.message) || T('auth.error'), 'err');
    }
  });
}

function adminToggleBan(id, banned) {
  API.post('/api/admin/user/' + id + '/ban', { banned: !!banned }).then(function (r) {
    if (r.ok) {
      toast(banned ? T('admin.ban') + ' ✔' : T('admin.unban') + ' ✔', 'ok');
      adminLoadUsers();
      adminLoadStats();
    } else {
      toast((r.data && r.data.message) || T('auth.error'), 'err');
    }
  });
}

function adminSetRole(id) {
  const sel = document.getElementById('role-' + id);
  if (!sel) return;
  if (AUTH.user && id === AUTH.user.id) {
    toast('لا يمكنك تغيير دورك', 'warn');
    return;
  }
  API.post('/api/admin/user/' + id + '/role', { role: sel.value }).then(function (r) {
    if (r.ok) {
      toast(T('admin.save') + ' ✔', 'ok');
      adminLoadUsers();
    } else {
      toast((r.data && r.data.message) || T('auth.error'), 'err');
    }
  });
}

/* ── تبويب البطولات (الأدمن: موافقة/بدء/إنهاء) ── */
function adminLoadTourneys() {
  const c = document.getElementById('adminContent');
  if (!c) return;
  c.innerHTML = '<div class="note">…</div>';
  Promise.all([API.get('/api/tournaments'), API.get('/api/games')]).then(function (rs) {
    const ts = (rs[0].ok && rs[0].data && rs[0].data.tournaments) ? rs[0].data.tournaments : [];
    if (!ts.length) {
      c.innerHTML = '<div class="note">لا توجد بطولات بعد</div>';
      return;
    }
    const statusLabel = { pending: '⏳ ' + T('admin.tPending'), approved: '✅ ' + T('admin.tApproved'), active: '🔴 ' + T('admin.tActive'), finished: '🏁 ' + T('admin.tFinished'), rejected: '❌ ' + T('admin.tRejected') };
    c.innerHTML = '<div class="atable-wrap"><table class="atable">' +
      '<thead><tr><th>الاسم</th><th>اللعبة</th><th>المنشئ</th><th>الجائزة</th><th>اللاعبون</th><th>الحالة</th><th></th></tr></thead><tbody>' +
      ts.map(function (t) {
        let actions = '';
        if (t.status === 'pending') {
          actions = '<button class="abtn ok" onclick="adminApproveTourney(\'' + t.id + '\',\'approve\')">✔ ' + T('admin.tApprove') + '</button> ' +
                    '<button class="abtn bad" onclick="adminApproveTourney(\'' + t.id + '\',\'reject\')">✖ ' + T('admin.tReject') + '</button>';
        } else if (t.status === 'approved') {
          actions = '<button class="abtn ok" onclick="adminStartTourney(\'' + t.id + '\')">▶ ' + T('admin.tStart') + '</button>';
        } else if (t.status === 'active') {
          const pls = t.players || [];
          const opts = pls.map(function (p) { return '<option value="' + p.id + '">' + esc(p.username) + '</option>'; }).join('');
          actions = '<select class="ainp" id="tw-' + t.id + '" style="width:110px">' + opts + '</select> ' +
                    '<button class="abtn" onclick="adminFinishTourney(\'' + t.id + '\')">🏁 ' + T('admin.tFinish') + '</button>';
        } else {
          actions = '—';
        }
        return '<tr>' +
          '<td><b>' + esc(t.name) + '</b></td>' +
          '<td>' + esc(t.game_id) + '</td>' +
          '<td>' + esc(t.owner_name) + '</td>' +
          '<td class="gold-text">🪙 ' + fmt(t.prize || 0) + '</td>' +
          '<td>' + t.players_count + '/' + t.max_players + '</td>' +
          '<td>' + (statusLabel[t.status] || t.status) + '</td>' +
          '<td class="abal">' + actions + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }).catch(function () {
    c.innerHTML = '<div class="note">' + T('auth.error') + '</div>';
  });
}

function adminApproveTourney(id, decision) {
  API.post('/api/admin/tournaments/' + id + '/' + decision).then(function (r) {
    if (r.ok) {
      toast(decision === 'approve' ? T('admin.tApproved') + ' ✔' : T('admin.tRejected') + ' ✔', 'ok');
      adminLoadTourneys();
    } else {
      toast((r.data && r.data.message) || T('auth.error'), 'err');
    }
  });
}

function adminStartTourney(id) {
  API.post('/api/admin/tournaments/' + id + '/start').then(function (r) {
    if (r.ok) {
      toast(T('admin.tActive') + ' ✔', 'ok');
      adminLoadTourneys();
    } else {
      toast((r.data && r.data.message) || T('auth.error'), 'err');
    }
  });
}

function adminFinishTourney(id) {
  const sel = document.getElementById('tw-' + id);
  if (!sel || !sel.value) {
    toast('اختر الفائز أولاً', 'warn');
    return;
  }
  API.post('/api/admin/tournaments/' + id + '/finish', { winner_id: parseInt(sel.value, 10) }).then(function (r) {
    if (r.ok) {
      toast(T('admin.tFinished') + ' ✔ — ' + (r.data.winner || ''), 'ok');
      adminLoadTourneys();
    } else {
      toast((r.data && r.data.message) || T('auth.error'), 'err');
    }
  });
}

/* ── تبويب الألعاب ── */
function adminLoadGames() {
  const c = document.getElementById('adminContent');
  if (!c) return;
  API.get('/api/admin/games').then(function (r) {
    const map = (r.ok && r.data && r.data.games) ? r.data.games : {};
    const rows = GAMES.map(function (g) {
      const enabled = !DISABLED[g.id];
      const st = enabled
        ? '<span class="spill ok">' + T('admin.active') + '</span>'
        : '<span class="spill bad">' + T('admin.banned') + '</span>';
      const btn = enabled
        ? '<button class="abtn bad" onclick="adminToggleGame(\'' + g.id + '\')">' + T('admin.disable') + '</button>'
        : '<button class="abtn ok" onclick="adminToggleGame(\'' + g.id + '\')">' + T('admin.enable') + '</button>';
      return '<tr>' +
        '<td>' + g.em + ' <b>' + esc(g.n) + '</b></td>' +
        '<td>' + g.cat + '</td>' +
        '<td>' + g.rtp + '%</td>' +
        '<td>' + st + '</td>' +
        '<td>' + btn + '</td>' +
      '</tr>';
    }).join('');
    c.innerHTML =
      '<div class="note" style="margin-top:0">' + T('admin.gamesDisabled') + '</div>' +
      '<div class="atable-wrap"><table class="atable">' +
        '<thead><tr><th>اللعبة</th><th>التصنيف</th><th>RTP</th><th>' + T('admin.status') + '</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>';
  }).catch(function () {
    c.innerHTML = '<div class="note">' + T('auth.error') + '</div>';
  });
}

function adminToggleGame(id) {
  const cur = DISABLED[id] ? false : true;
  API.post('/api/admin/games/' + id + '/toggle', { enabled: !cur }).then(function (r) {
    if (r.ok) {
      if (r.data.enabled) {
        delete DISABLED[id];
      } else {
        DISABLED[id] = true;
      }
      adminLoadGames();
      renderAll();
      toast(r.data.enabled ? T('admin.enable') + ' ✔' : T('admin.disable') + ' ✔', 'ok');
    } else {
      toast((r.data && r.data.message) || T('auth.error'), 'err');
    }
  });
}

/* ── تبويب المكافآت ── */
function adminLoadRewards() {
  const c = document.getElementById('adminContent');
  if (!c) return;
  API.get('/api/admin/rewards').then(function (r) {
    const d = (r.ok && r.data) ? r.data : { amount: 100, interval_hours: 24 };
    c.innerHTML =
      '<div class="reward-form">' +
        '<label class="aflabel" for="rwAmount">' + T('admin.rewardAmount') + '</label>' +
        '<input class="afinput" id="rwAmount" type="number" value="' + d.amount + '" min="0">' +
        '<label class="aflabel" for="rwInterval">' + T('admin.rewardInterval') + '</label>' +
        '<input class="afinput" id="rwInterval" type="number" value="' + d.interval_hours + '" min="1" max="720">' +
        '<button class="btn" style="margin-top:14px" onclick="adminSaveRewards()">' + T('admin.save') + '</button>' +
      '</div>';
  }).catch(function () {
    c.innerHTML = '<div class="note">' + T('auth.error') + '</div>';
  });
}

function adminSaveRewards() {
  const a = document.getElementById('rwAmount');
  const i = document.getElementById('rwInterval');
  if (!a || !i) return;
  API.post('/api/admin/rewards', {
    amount: parseInt(a.value, 10),
    interval_hours: parseInt(i.value, 10)
  }).then(function (r) {
    if (r.ok) {
      toast(T('admin.save') + ' ✔', 'ok');
    } else {
      toast((r.data && r.data.message) || T('auth.error'), 'err');
    }
  });
}

/* ── تبويب المالية ── */
function adminLoadFinance() {
  const c = document.getElementById('adminContent');
  if (!c) return;
  c.innerHTML = '<div class="note">…</div>';
  Promise.all([API.get('/api/admin/stats'), API.get('/api/admin/stats/games')]).then(function (rs) {
    const s = (rs[0].ok && rs[0].data) ? rs[0].data : {};
    const gs = (rs[1].ok && rs[1].data && rs[1].data.games) ? rs[1].data.games : [];
    const rows = gs.length
      ? '<div class="atable-wrap"><table class="atable">' +
        '<thead><tr><th>اللعبة</th><th>' + T('admin.plays') + '</th><th>' + T('admin.wins') + '</th><th>' + T('admin.coinsWon') + '</th></tr></thead><tbody>' +
        gs.map(function (g) {
          return '<tr><td><b>' + esc(g.game_id) + '</b></td><td>' + fmt(g.plays) + '</td><td>' + fmt(g.wins) + '</td><td>🪙 ' + fmt(g.coins_won) + '</td></tr>';
        }).join('') +
        '</tbody></table></div>'
      : '<div class="note">' + T('admin.noUsers') + '</div>';
    c.innerHTML =
      '<div class="grid g3" style="margin-bottom:14px">' +
        '<div class="stat"><div class="si">👥</div><div><div class="sv">' + fmt(s.users_total || 0) + '</div><div class="sl">' + T('admin.totalUsers') + '</div></div></div>' +
        '<div class="stat"><div class="si">🪙</div><div><div class="sv">' + fmt(s.gold_total || 0) + '</div><div class="sl">' + T('admin.totalCoins') + '</div></div></div>' +
        '<div class="stat"><div class="si">🎮</div><div><div class="sv">' + fmt(s.plays_total || 0) + '</div><div class="sl">' + T('admin.plays') + '</div></div></div>' +
      '</div>' + rows;
  }).catch(function () {
    c.innerHTML = '<div class="note">' + T('auth.error') + '</div>';
  });
}
/* ═══════════ Ticker ═══════════ */
function renderTicker() {
  /* البيانات الحقيقية تأتي من SSE (RC_ticks) — fallback مؤقت قبل الاتصال */
  const src = (window.RC_ticks && window.RC_ticks.length) ? window.RC_ticks : [
    ['RondaMaster', 'Moroccan Ronda', 15240],
    ['KingPlayer', 'Aviator', 5240],
    ['LuckyGirl', 'Mines', 8900],
    ['ProGamer', 'Blackjack', 3200],
    ['GoldHunter', 'Plinko', 12500]
  ];
  const el = document.getElementById('ticker');
  if (!el) return;
  const items = src.map(x =>
    '<span class="tk"> <span class="p">' + x[0] + '</span> ' + T('tk.won') +
    ' <span class="w">🪙 ' + fmt(x[2]) + '</span> <span class="g">(' + x[1] + ')</span></span>'
  ).join('');
  el.innerHTML = items + items;
}
/* ═══════════ الدردشة ═══════════ */
/* الرسائل الحية تُدار من js/core/live.js عبر RC_renderChat — هنا مجرد توجيه */
function renderChat() {
  if (typeof window.RC_renderChat === 'function') { window.RC_renderChat(); return; }
  const el = document.getElementById('chatMsgs');
  if (el) el.innerHTML = '';
}
/* ═══════════ Daily Reward ═══════════ */
function claimDaily() {
  /* عند تسجيل الدخول: المكافأة تُصرف من الخادم */
  if (AUTH.user) {
    API.post('/api/claim').then(function (r) {
      if (r.ok && r.data) {
        ST.gold = r.data.gold;
        ST.lastClaim = Date.now();
        save();
        wallet();
        SND.coin();
        confetti(40);
        toast(T('ts.claim'), 'ok');
        AUTH._lastSync = Date.now();
      } else if (r.data && r.data.error === 'not_ready') {
        toast(T('ts.wait'), 'warn');
      } else {
        toast((r.data && r.data.message) || T('auth.error'), 'err');
      }
    }).catch(function () {
      toast(T('auth.error'), 'err');
    });
    return;
  }
  /* وضع الضيف: محلي */
  const now = Date.now();
  if (now - ST.lastClaim < 10000) {
    toast(T('ts.wait'), 'warn');
    return;
  }
  ST.gold += 100;
  ST.lastClaim = now;
  save();
  wallet();
  SND.coin();
  confetti(40);
  toast(T('ts.claim'), 'ok');
}
/* ═══════════ Render All ═══════════ */
function renderAll() {
  renderGames();
  renderLB();
  renderTourney();
  renderFair();
  renderAdmin();
  renderTicker();
  renderChat();
  wallet();
}
/* ═══════════ التهيئة عند التحميل ═══════════ */
function initApp() {
  /* تحميل الحالة */
  initState();
  /* ضبط اللغة */
  if (typeof syncLangDrop === 'function') syncLangDrop();
  /* ضبط زر الصوت (قد يوجد أكثر من زر في صفحات مختلفة) */
  const muteBtns = document.querySelectorAll('#muteBtn');
  muteBtns.forEach(function (btn) {
    /* الأيقونة عبر CSS ::before وفق aria-pressed — لا نص إيموجي */
    btn.setAttribute('aria-pressed', ST.mute ? 'true' : 'false');
  });
  /* تطبيق الاتجاه */
  applyI18n();
  /* ترجمة العناصر الثابتة (لغة محفوظة) */
  translateStatic();
  /* تحديث سنة حقوق النشر */
  updateCopyright();
  /* تهيئة التأثيرات */
  fxInit();
  /* استعادة جلسة المستخدم (إن وُجدت) */
  if (typeof authRestore === 'function') {
    authRestore().then(function () {
      /* غرف متعددة اللاعبين: SSE + انضمام تلقائي من رابط الدعوة */
      if (typeof Rooms !== 'undefined') {
        Rooms.joinSse();
        Rooms.tryAutoJoin();
      }
    });
  }
  /* مزامنة الرصيد مع الخادم كل 30 ثانية */
  setInterval(function() {
    if (typeof authSync === 'function') authSync();
  }, 30000);
  /* تحديث حي لصفحة غرف اللعب (كل 5 ثوانٍ أثناء فتح الصفحة فقط) */
  setInterval(function() {
    const pg = document.getElementById('pg-rooms');
    if (pg && pg.classList.contains('active') && typeof renderRooms === 'function') renderRooms();
  }, 5000);
  /* رسم كل شيء */
  renderAll();
  /* Hash routing: activate the section matching the URL hash (e.g. index.html#games) */
  navFromHash();
  /* أرقام المتصلين والدردشة الحية تأتي الآن من SSE (js/core/live.js) */
  /* زر ملء الشاشة: نص أولي + تزامن مع تغيير الوضع */
  syncGameFsBtn();
  document.addEventListener('fullscreenchange', syncGameFsBtn);
  document.addEventListener('webkitfullscreenchange', syncGameFsBtn);
  /* تلميح التدوير: يُقيَّم عند تغيير الاتجاه أو الحجم أو وضع ملء الشاشة */
  window.addEventListener('resize', function () {
    clearTimeout(window._rotT);
    window._rotT = setTimeout(checkRotateHint, 250);
  });
  window.addEventListener('orientationchange', function () {
    setTimeout(checkRotateHint, 400);
  });
  document.addEventListener('fullscreenchange', function () {
    setTimeout(checkRotateHint, 300);
  });
  /* إغلاق بمفتاح Escape */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const gp = document.getElementById('pg-game');
      if (gp && gp.classList.contains('active')) {
        closeGamePage();
        return;
      }
      closeModal();
      closeRulesModal();
    }
  });
  console.log(' Digital Moroccan casino loaded successfully!');
}
/* ═══════════ معالجة الأخطاء العامة ═══════════ */
window.addEventListener('error', function(e) {
  console.error('Digital Moroccan casino Error:', e.error);
  toast('حدث خطأ غير متوقع — أعد المحاولة', 'err');
});
window.addEventListener('unhandledrejection', function(e) {
  console.error('Promise Error:', e.reason);
});
/* ═══════════ تشغيل التطبيق ═══════════ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
