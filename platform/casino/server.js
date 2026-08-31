const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

/* ═══════ متجر ذاكري: مستخدمون + جلسات + غرف ═══════ */
let nextUserId = 100;
const users = {};               // userId -> {id, username, password, role, gold, lang}
const sessions = {};            // sid -> userId
const rooms = {};               // roomId -> room object
let nextRoomId = 1;
/* رسم الرهان على المنصة: نسبة تُقتطع من الرهان عند تسوية الجولة بين لاعبَين */
const BET_FEE_RATE = 0.05;      /* 5% رسوم المنصة على الرهان */

/* بذور: مستخدمون افتراضيون */
users[1] = { id: 1, username: 'player1', password: '123', role: 'user', gold: 5000, lang: 'ar' };
users[2] = { id: 2, username: 'admin', password: 'admin', role: 'admin', gold: 100000, lang: 'ar' };

const sseClients = [];          // [{res, userId}]
const chatMessages = [
  { username: 'tarik', message: 'السلام عليكم ورحمة الله!', created_at: Date.now() - 60000 },
  { username: 'hamza_casawi', message: 'مبروك للرابحين في الروندا 🏆', created_at: Date.now() - 30000 }
];
let transfersList = [];
const winners = [
  { username: 'tarik', game_id: 'Moroccan Ronda', payout: 350 },
  { username: 'mehdi_rabat', game_id: 'Crash 🚀', payout: 1250 },
  { username: 'ilyas', game_id: 'Parchisi 🎲', payout: 400 }
];

/* ═══════ أدوات الجلسة ═══════ */
function parseCookies(req) {
  const out = {};
  const hdr = req.headers.cookie || '';
  hdr.split(';').forEach(function (p) {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function startSession(res, user) {
  const sid = crypto.randomBytes(18).toString('hex');
  sessions[sid] = user.id;
  res.setHeader('Set-Cookie', 'sid=' + sid + '; Path=/; HttpOnly; SameSite=Lax');
}
function getUser(req) {
  const sid = parseCookies(req).sid;
  const uid = sid ? sessions[sid] : null;
  return (uid != null && users[uid]) ? users[uid] : null;
}
function publicUser(u) {
  if (!u) return null;
  return { id: u.id, username: u.username, role: u.role, gold: u.gold, lang: u.lang };
}

/* ═══════ الغرف: تسلسل + بثّ ═══════ */
function serializeRoom(room) {
  const nonspec = room.players.filter(function (p) { return !p.spectate; }).sort(function (a, b) { return a.seat - b.seat; });
  return {
    id: room.id,
    code: room.code,
    game_id: room.game_id,
    owner_id: room.owner_id,
    owner_name: room.owner_name,
    max_players: room.max_players,
    status: room.status,
    bet: room.bet || 0,   /* [B10] رهان الغرفة */
    players: room.players.map(function (p) {
      return { id: p.id, username: p.username, ready: !!p.ready, spectate: !!p.spectate, seat: p.seat, isBot: !!p.isBot };
    }),
    order: nonspec.map(function (p) { return p.id; }),
    room_state: room.room_state || {},
    /* [Spectator] ملخّص المقاعد وطابور طلبات الانضمام */
    seats: { players: nonspec.length, max: room.max_players, free: Math.max(0, room.max_players - nonspec.length) },
    joinQueue: (room.joinQueue || []).map(function (r) { return { id: r.id, username: r.username, ts: r.ts }; }),
    /* [Req3] حالة تصويت المباراة الجديدة */
    driverId: room.driverId != null ? room.driverId : room.owner_id,   /* [Resilience] السائق الحالي */
    hasHistory: !!(room.moveHistory && room.moveHistory.length),   /* [Resilience] هل بدأت الجولة؟ يمنع إعادة استضافة المالك عند العودة */
    online: Object.keys(room.online || {}),   /* [Resilience] اللاعبون المتصلون */
    rematch: room.rematch ? {
      participants: room.rematch.participants || [],
      votes: room.rematch.votes || {},
      resolved: !!room.rematch.resolved,
      rematch: !!room.rematch.rematch,
      agreed: room.rematch.agreed || [],
      names: room.rematch.names || {},
      ts: room.rematch.ts || 0
    } : null
  };
}
function sendSSE(res, event, data) {
  try { res.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n'); } catch (e) {}
}
function broadcastRoom(room, event, payload) {
  const memberIds = new Set(room.players.map(function (p) { return p.id; }));
  sseClients.forEach(function (c) {
    if (c.userId != null && memberIds.has(c.userId)) sendSSE(c.res, event, payload);
  });
}
function updateRoom(room) { broadcastRoom(room, 'room:update', serializeRoom(room)); }


/* [Req3] حلّ تصويت المباراة الجديدة: حين يقرّر كل المشاركين (تصويت أو مغادرة=رفض)
   الموافقون المتبقّون (≥2 ويحويهم المُنشئ) يبدؤون مباراة جديدة؛ وإلا فلا مباراة جديدة */
function tryResolveRematch(room) {
  if (!room || !room.rematch || room.rematch.resolved) return false;
  var rm = room.rematch;
  var inRoom = function (id) { return room.players.some(function (p) { return p.id === id; }); };
  var allDecided = rm.participants.every(function (id) { return rm.votes[id] || !inRoom(id); });
  if (!allDecided) return false;
  var agreed = rm.participants.filter(function (id) { return rm.votes[id] === 'agree' && inRoom(id); });
  rm.resolved = true;
  var ownerPresent = inRoom(room.owner_id);
  if (agreed.length >= 2 && (!ownerPresent || agreed.indexOf(room.owner_id) !== -1)) {
    /* مباراة جديدة: الموافقون لاعبون، البقية متفرجون */
    room.players.forEach(function (p) {
      if (agreed.indexOf(p.id) !== -1) { p.spectate = false; p.ready = true; }
      else { p.spectate = true; p.ready = true; }
    });
    var seat = 0;
    room.players.filter(function (p) { return !p.spectate; }).forEach(function (p) { p.seat = seat++; });
    room.status = 'playing';          /* انتظار→لعب يُطلق إعادة التهيئة عند الجميع */
    room.rematch = null;
    room.moveHistory = [];           /* [Resilience] مباراة جديدة = سجل جديد (يسمح للمالك بالاستضافة) */
    room.dedupSeen = {};
  } else {
    rm.rematch = false; rm.agreed = agreed; /* لا موافقة كافية */
  }
  return true;
}

/* [Spectator] ترقية المتفرجين في الطابور إلى مقاعد شاغرة (بقدر المتاح) */
function promoteQueued(room) {
  if (!room || !room.joinQueue || !room.joinQueue.length) return;
  for (;;) {
    const nonSpec = room.players.filter(function (p) { return !p.spectate; }).length;
    if (nonSpec >= room.max_players) break;
    const req = room.joinQueue.shift();
    if (!req) break;
    const p = room.players.find(function (x) { return x.id === req.id; });
    if (p) {
      p.spectate = false;
      p.ready = true;
      p.seat = nonSpec;
    } else {
      /* لم يعد في الغرفة — أعدّه لاعباً مباشرةً */
      room.players.push({ id: req.id, username: req.username, ready: true, spectate: false, seat: nonSpec });
    }
  }
  if (!room.joinQueue.length) room.joinQueue = [];
}

/* [Resilience] تتبّع المتصلين وإعادة تعيين السائق عند انقطاعه */
function markOnline(room, uid) {
  if (!room) return;
  if (!room.online) room.online = {};
  room.online[uid] = (room.online[uid] || 0) + 1;
  /* [Resilience] إن كان السائق الحالي غير متصل (انقطع الجميع ثم عاد أحدهم) → نوّط له */
  if (room.driverId != null && !isOnline(room, room.driverId)) {
    var me = room.players.find(function (p) { return p.id === uid && !p.spectate; });
    if (me) { var before = room.driverId; room.driverId = uid; if (before !== uid) updateRoom(room); }
  }
}
function markOffline(room, uid) {
  if (!room || !room.online) return;
  room.online[uid] = (room.online[uid] || 1) - 1;
  if (room.online[uid] <= 0) { delete room.online[uid]; }
  /* إن كان السائق قد انقطع → نوّط الساقة لأقرب لاعب متصل */
  if (room.driverId === uid) reassignDriver(room);
}
function isOnline(room, uid) { return !!(room && room.online && room.online[uid] > 0); }
function reassignDriver(room) {
  if (!room) return;
  const nonspec = room.players.filter(function (p) { return !p.spectate; }).sort(function (a, b) { return a.seat - b.seat; });
  const next = nonspec.find(function (p) { return isOnline(room, p.id) && !p.isBot; });
  const before = room.driverId;
  /* لا يُعطى السائق لبوت (لا عميل له): يُفضَّل أول إنسان متصل، ثم أول إنسان، ثم المالك */
  const humanFallback = nonspec.find(function (p) { return !p.isBot; });
  room.driverId = next ? next.id : (humanFallback ? humanFallback.id : (nonspec.length ? nonspec[0].id : room.owner_id));
  if (before !== room.driverId) { updateRoom(room); }
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  /* ═══════ SSE الحيّ ═══════ */
  if (pathname === '/api/live' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    });
    const me = getUser(req);
    const helloData = {
      online: 42 + sseClients.length,
      history: chatMessages,
      winners: winners
    };
    res.write('event: hello\ndata: ' + JSON.stringify(helloData) + '\n\n');
    sseClients.push({ res: res, userId: me ? me.id : null });

    /* بثّ حالة الغرفة الحالية للمنضمّ المتأخر */
    if (me) {
      for (const rid in rooms) {
        const r = rooms[rid];
        if (r.players.some(function (p) { return p.id === me.id; })) {
          markOnline(r, me.id);
          sendSSE(res, 'room:update', serializeRoom(r));
          /* [Resilience] أعد بناء حالة الجولة الجارية للاعب العائد */
          if (r.status === 'playing' && r.moveHistory && r.moveHistory.length) {
            sendSSE(res, 'room:replay', { room_id: r.id, history: r.moveHistory });
          }
        }
      }
    }

    req.on('close', () => {
      const idx = sseClients.findIndex(function (c) { return c.res === res; });
      if (idx !== -1) sseClients.splice(idx, 1);
      /* [Resilience] انقطاع لاعب → تحديث الاتصال وإعادة تعيين السائق */
      if (me) {
        for (const rid in rooms) {
          const r = rooms[rid];
          if (r.players.some(function (p) { return p.id === me.id; })) markOffline(r, me.id);
        }
      }
    });
    return;
  }

  /* ═══════ نقاط API ═══════ */
  if (pathname.startsWith('/api/')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let data = {};
      try { data = body ? JSON.parse(body) : {}; } catch (e) {}
      const me = getUser(req);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');

      function json(obj, status) { res.writeHead(status || 200); res.end(JSON.stringify(obj)); }

      /* ── المصادقة ── */
      if (pathname === '/api/me') {
        json({ ok: true, user: publicUser(me), claim: { ready: true, interval_hours: 2 } });
        return;
      }
      if (pathname === '/api/login') {
        const existing = Object.values(users).find(function (u) { return u.username === (data.username || ''); });
        const u = existing || { id: nextUserId++, username: data.username || 'player', password: data.password || '', role: 'user', gold: 2500, lang: 'ar' };
        if (!existing) users[u.id] = u;
        startSession(res, u);
        json({ ok: true, user: publicUser(u) });
        return;
      }
      if (pathname === '/api/register') {
        let u = Object.values(users).find(function (x) { return x.username === (data.username || ''); });
        if (u && u.password) {
          json({ ok: false, message: 'اسم المستخدم محجوز' }, 400);
          return;
        }
        u = { id: nextUserId++, username: data.username || 'new_player', password: data.password || '', role: 'user', gold: 1000, lang: 'ar' };
        users[u.id] = u;
        startSession(res, u);
        json({ ok: true, user: publicUser(u) });
        return;
      }
      if (pathname === '/api/logout') {
        const sid = parseCookies(req).sid;
        if (sid) delete sessions[sid];
        res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0');
        json({ ok: true });
        return;
      }
      if (pathname === '/api/sync') {
        if (me) { if (data.gold !== undefined) me.gold = data.gold; if (data.lang) me.lang = data.lang; }
        json({ ok: true, gold: me ? me.gold : 0 });
        return;
      }
      if (pathname === '/api/change-password') {
        if (!me) { json({ ok: false, message: 'غير مسجّل' }, 401); return; }
        if (me.password && me.password !== data.oldPassword) { json({ ok: false, message: 'كلمة المرور القديمة خاطئة' }, 400); return; }
        me.password = data.newPassword;
        json({ ok: true, message: 'تم تغيير كلمة المرور' });
        return;
      }
      if (pathname === '/api/transfer') {
        const amt = parseInt(data.amount, 10);
        if (!me || !data.to || isNaN(amt) || amt <= 0) { json({ ok: false, message: 'المبلغ غير صالح' }, 400); return; }
        if ((me.gold || 0) < amt) { json({ ok: false, message: 'رصيدك غير كافٍ' }, 400); return; }
        me.gold -= amt;
        transfersList.unshift({ id: Date.now(), from_id: me.id, from_name: me.username, to_name: data.to, amount: amt, created_at: Math.floor(Date.now() / 1000) });
        json({ ok: true, amount: amt, to: data.to, gold: me.gold });
        return;
      }
      if (pathname === '/api/transfers') { json({ ok: true, transfers: transfersList }); return; }
      if (pathname === '/api/claim') { if (me) me.gold = (me.gold || 0) + 100; json({ ok: true, amount: 100, gold: me ? me.gold : 100 }); return; }
      if (pathname === '/api/chat') {
        const msg = { username: me ? me.username : 'زائر', message: data.message || '', created_at: Date.now() };
        chatMessages.push(msg); if (chatMessages.length > 50) chatMessages.shift();
        sseClients.forEach(c => sendSSE(c.res, 'chat', msg));
        json({ ok: true, message: msg });
        return;
      }
      if (pathname === '/api/tournaments') {
        json({ ok: true, tournaments: [] });
        return;
      }
      if (pathname === '/api/games' || pathname === '/api/admin/games') { json({ ok: true, games: [] }); return; }
      if (pathname === '/api/rounds') { json({ ok: true }); return; }

      /* ── الغرف ── */
      if (pathname === '/api/rooms' && req.method === 'GET') {
        const list = Object.values(rooms).filter(function (r) { return r.status === 'waiting'; }).map(function (r) {
          return { id: r.id, code: r.code, game_id: r.game_id, owner_name: r.owner_name, max_players: r.max_players, players_count: r.players.length, status: r.status, bet: r.bet || 0 };
        });
        json({ ok: true, rooms: list });
        return;
      }
      if (pathname === '/api/rooms' && req.method === 'POST') {
        /* إنشاء غرفة */
        if (!me) { json({ ok: false, message: 'يلزم تسجيل الدخول' }, 401); return; }
        const gid = data.game_id || 'rm';
        const maxp = Math.max(2, Math.min(8, parseInt(data.max_players, 10) || 4));
        /* [B10] غرفات الرهان (شطرنج): مبلغ اختياري يُعرض على المنضمّين */
        const bet = Math.max(0, Math.min(10000, parseInt(data.bet, 10) || 0));
        const rid = 'r' + (nextRoomId++);
        const code = crypto.randomBytes(3).toString('hex').toUpperCase();
        const room = {
          id: rid, code: code, game_id: gid,
          owner_id: me.id, owner_name: me.username,
          max_players: maxp, status: 'waiting', bet: bet,
          players: [{ id: me.id, username: me.username, ready: false, spectate: false, seat: 0 }],
          moveHistory: [], dedupSeen: {}, driverId: me.id, online: {},
          room_state: {}, chat: []
        };
        rooms[rid] = room;
        markOnline(room, me.id);   /* [Resilience] المنشئ متصل */
        json({ ok: true, room: serializeRoom(room) });
        return;
      }
      if (pathname === '/api/rooms/join') {
        if (!me) { json({ ok: false, message: 'يلزم تسجيل الدخول' }, 401); return; }
        const code = String(data.code || '').toUpperCase();
        const room = Object.values(rooms).find(function (r) { return r.code === code; });
        if (!room) { json({ ok: false, message: 'رمز الغرفة غير موجود' }, 404); return; }
        if (room.status === 'playing' && !room.players.some(function (p) { return p.id === me.id; })) {
          json({ ok: false, message: 'اللعبة بدأت بالفعل' }, 400); return;
        }
        let p = room.players.find(function (x) { return x.id === me.id; });
        if (!p) {
          const nonSpec = room.players.filter(function (x) { return !x.spectate; }).length;
          if (nonSpec >= room.max_players) {
            /* أضف كمشاهد إن امتلأت */
            p = { id: me.id, username: me.username, ready: true, spectate: true, seat: room.players.length };
          } else {
            p = { id: me.id, username: me.username, ready: false, spectate: !!data.spectate, seat: nonSpec };
          }
          room.players.push(p);
        }
        markOnline(room, me.id);   /* [Resilience] اللاعب متصل (SSE فعّال) */
        updateRoom(room);
        json({ ok: true, room: serializeRoom(room) });
        return;
      }
      if (pathname === '/api/rooms/leave') {
        const room = rooms[data.room_id];
        if (room) {
          /* [Req6] المُنشئ لا يغلق الغرفة حتى ينتهي الرهان الجاري */
          if (room.status === 'playing' && room.owner_id === (me && me.id)) {
            json({ ok: false, message: 'لا يمكن إغلاق الغرفة حتى انتهاء الرهان الجاري — انتظر نهاية المباراة' }, 400);
            return;
          }
          room.players = room.players.filter(function (p) { return p.id !== (me && me.id); });
          /* إزالة أي طلب انضمام خاص بالمغادر */
          if (room.joinQueue) room.joinQueue = room.joinQueue.filter(function (r) { return r.id !== (me && me.id); });
          if (room.players.length === 0 || room.owner_id === (me && me.id)) {
            /* خروج المالك يحلّ الغرفة */
            broadcastRoom(room, 'room:update', null);
            delete rooms[room.id];
          } else {
            promoteQueued(room); /* [Spectator] املأ المقعد الشاغر من الطابور */
            tryResolveRematch(room); /* [Req3] مغادرة مشارك = رفض → قد يحلّ التصويت */
            updateRoom(room);
          }
        }
        json({ ok: true });
        return;
      }
      if (pathname === '/api/rooms/ready') {
        const room = rooms[data.room_id];
        if (room && me) {
          const p = room.players.find(function (x) { return x.id === me.id; });
          if (p) p.ready = !!data.ready;
          updateRoom(room);
        }
        json({ ok: true, room: room ? serializeRoom(room) : null });
        return;
      }
      if (pathname === '/api/rooms/start') {
        const room = rooms[data.room_id];
        if (room && me && room.owner_id === me.id) {
          room.status = 'playing';
          updateRoom(room);
        }
        json({ ok: true, room: room ? serializeRoom(room) : null });
        return;
      }
      if (pathname === '/api/rooms/spectate') {
        const room = rooms[data.room_id];
        if (room && me) {
          let p = room.players.find(function (x) { return x.id === me.id; });
          if (!p) { p = { id: me.id, username: me.username, ready: true, spectate: false, seat: room.players.length }; room.players.push(p); }
          /* [B10] لا يجوز الترقّي من مشاهد إلى لاعب والمقاعد ممتلئة */
          if (!data.spectate && p.spectate) {
            const nonSpec = room.players.filter(function (x) { return !x.spectate && x.id !== me.id; }).length;
            if (nonSpec >= room.max_players) {
              json({ ok: false, message: 'المقاعد ممتلئة — يمكنك المشاهدة فقط' }, 400);
              return;
            }
          }
          p.spectate = !!data.spectate;
          if (data.spectate) p.ready = true;
          updateRoom(room);
        }
        json({ ok: true, room: room ? serializeRoom(room) : null });
        return;
      }
      /* [Spectator] طلب انضمام متفرج: يُضاف للطابور ويُرقّى فوراً إن وُجد مقعد شاغر */
      if (pathname === '/api/rooms/joinRequest') {
        const room = rooms[data.room_id];
        if (room && me) {
          let p = room.players.find(function (x) { return x.id === me.id; });
          if (!p) { p = { id: me.id, username: me.username, ready: true, spectate: true, seat: room.players.length }; room.players.push(p); }
          if (p.spectate) {
            if (!room.joinQueue) room.joinQueue = [];
            if (!room.joinQueue.some(function (r) { return r.id === me.id; })) {
              room.joinQueue.push({ id: me.id, username: me.username, ts: Date.now() });
            }
            promoteQueued(room);
            updateRoom(room);
          }
        }
        json({ ok: true, room: room ? serializeRoom(room) : null });
        return;
      }
      /* [Req6] انتهاء الرهان: المُنشئ يُعلن نهاية المباراة فتعود الغرفة للانتظار ويصبح الإغلاق ممكناً */
      if (pathname === '/api/rooms/endBet') {
        const room = rooms[data.room_id];
        if (room && me && room.owner_id === me.id && room.status === 'playing') {
          room.status = 'waiting';
          room.players.forEach(function (p) { if (!p.spectate) p.ready = false; });
          updateRoom(room);
        }
        json({ ok: true, room: room ? serializeRoom(room) : null });
        return;
      }

      /* [Req3] بدء تصويت المباراة الجديدة عند نهاية المباراة (المُنشئ) */
      /* [MP-AI] المضيف يضيف لاعباً آلياً لملء مقعد (لاعب آلي يلعب وفق القواعد) */
      /* [Settle] تسوية رهان فلات دوچ بين لاعبَين: يُقتطع من الخاسر ويُضاف للرابح
         بعد اقتطاع رسم الرهان (BET_FEE_RATE). للمالك فقط (نتيجة حتمية). */
      if (pathname === '/api/rooms/settle') {
        const room = rooms[data.room_id];
        const isHost = room && me && room.owner_id === me.id;
        if (!isHost || !data.loser || !data.winner) { json({ ok: false, message: 'غير مصرّح' }, 403); return; }
        const amt = parseInt(data.amount, 10);
        if (isNaN(amt) || amt <= 0) { json({ ok: false, message: 'مبلغ غير صالح' }, 400); return; }
        const loser = Object.values(users).find(function (u) { return u.username === data.loser; });
        const winner = Object.values(users).find(function (u) { return u.username === data.winner; });
        if (!loser || !winner) { json({ ok: false, message: 'لاعب غير موجود' }, 400); return; }
        if ((loser.gold || 0) < amt) { json({ ok: false, message: 'رصيد الخاسر غير كافٍ' }, 400); return; }
        const fee = Math.round(amt * BET_FEE_RATE);
        loser.gold = (loser.gold || 0) - amt;
        winner.gold = (winner.gold || 0) + (amt - fee);
        transfersList.unshift({ id: Date.now(), from_id: loser.id, from_name: loser.username, to_name: winner.username, amount: amt, created_at: Math.floor(Date.now() / 1000) });
        json({ ok: true, fee: fee, loser: { username: loser.username, gold: loser.gold }, winner: { username: winner.username, gold: winner.gold } });
        return;
      }
      /* [Timeout] انتهاء مهلة المتخمّن: يُصبح متفرجاً ويُرقّى متفرج من الطابور لمقعده */
      if (pathname === '/api/rooms/timeoutSeat') {
        const room = rooms[data.room_id];
        const isHost = room && me && room.owner_id === me.id;
        if (!isHost || data.playerId == null) { json({ ok: false, message: 'غير مصرّح' }, 403); return; }
        const p = room.players.find(function (x) { return String(x.id) === String(data.playerId) && !x.spectate; });
        if (p) { p.spectate = true; p.ready = true; }
        promoteQueued(room);
        updateRoom(room);
        json({ ok: true, room: room ? serializeRoom(room) : null });
        return;
      }
      if (pathname === '/api/rooms/addBot') {
        const room = rooms[data.room_id];
        const isHost = room && me && room.owner_id === me.id && room.status === 'waiting';
        if (isHost) {
          const nonspec = room.players.filter(function (p) { return !p.spectate; });
          if (nonspec.length < room.max_players) {
            const botNum = nonspec.filter(function (p) { return p.isBot; }).length + 1;
            const botId = 'bot:' + room.id + ':' + botNum;
            if (!room.players.some(function (p) { return p.id === botId; })) {
              room.players.push({ id: botId, username: 'AI ' + botNum, ready: true, spectate: false, seat: nonspec.length, isBot: true });
              updateRoom(room);
            }
          }
        }
        json({ ok: true, room: room ? serializeRoom(room) : null });
        return;
      }
      /* [MP-AI] المضيف يحذف لاعباً آلياً */
      if (pathname === '/api/rooms/removeBot') {
        const room = rooms[data.room_id];
        const isHost = room && me && room.owner_id === me.id && room.status === 'waiting';
        if (isHost && data.botId) {
          const idx = room.players.findIndex(function (p) { return p.id === data.botId && p.isBot; });
          if (idx !== -1) { room.players.splice(idx, 1); updateRoom(room); }
        }
        json({ ok: true, room: room ? serializeRoom(room) : null });
        return;
      }
      if (pathname === '/api/rooms/rematch/start') {
        const room = rooms[data.room_id];
        const mePart = room && me && room.players.some(function (p) { return p.id === me.id && !p.spectate; });
        if (mePart && !room.rematch) {
          const parts = room.players.filter(function (p) { return !p.spectate; });
          const names = {};
          parts.forEach(function (p) { names[p.id] = p.username; });
          room.rematch = { participants: parts.map(function (p) { return p.id; }), votes: {}, names: names, ts: Date.now() };
          room.status = 'waiting';           /* انتهى الرهان → يُسمح بالإغلاق (بند 6) */
          updateRoom(room);
          /* مهلة أمان 60ث: من لم يقرّر يُعدّ رافضاً ثم الحلّ */
          const rid = room.id;
          setTimeout(function () {
            const r = rooms[rid];
            if (r && r.rematch && !r.rematch.resolved) {
              r.rematch.participants.forEach(function (id) { if (!r.rematch.votes[id]) r.rematch.votes[id] = 'refuse'; });
              if (tryResolveRematch(r)) updateRoom(r);
            }
          }, 60000);
        }
        json({ ok: true, room: room ? serializeRoom(room) : null });
        return;
      }
      /* [Req3] تصويت مشارك: موافقة/رفض المباراة الجديدة */
      if (pathname === '/api/rooms/rematch/vote') {
        const room = rooms[data.room_id];
        if (room && me && room.rematch && !room.rematch.resolved && room.rematch.participants.indexOf(me.id) !== -1) {
          room.rematch.votes[me.id] = (data.vote === 'agree') ? 'agree' : 'refuse';
          if (tryResolveRematch(room)) updateRoom(room); else updateRoom(room);
        }
        json({ ok: true, room: room ? serializeRoom(room) : null });
        return;
      }

      /* [Req7] بثّ رمز تعبيري/تفاعل لكل أعضاء الغرفة (لاعبين + متفرجين) */
      if (pathname === '/api/rooms/react') {
        const room = rooms[data.room_id];
        if (room && me) {
          const emoji = String(data.emoji || '').slice(0, 16);
          broadcastRoom(room, 'room:react', { room_id: room.id, emoji: emoji, from_id: me.id, from_name: me.username, ts: Date.now() });
        }
        json({ ok: true });
        return;
      }

      /* [Req8] بثّ رسالة صوتية (≤10ث) لكل أعضاء الغرفة */
      if (pathname === '/api/rooms/voice') {
        const room = rooms[data.room_id];
        if (room && me) {
          let audio = String(data.audio || '');
          /* حدّ أمان: لا تقبل رسائل صوتية أكبر من ~700KB */
          if (audio.length > 980000) audio = '';
          const dur = Math.max(0, Math.min(10, parseInt(data.dur, 10) || 0));
          if (audio) broadcastRoom(room, 'room:voice', { room_id: room.id, audio: audio, dur: dur, from_id: me.id, from_name: me.username, ts: Date.now() });
        }
        json({ ok: true });
        return;
      }

      if (pathname === '/api/rooms/move') {
        const room = rooms[data.room_id];
        if (room) {
          if (data.state !== undefined && data.state !== null) room.room_state = data.state;
          const payload = data.data || {};
          /* [Resilience] تسجيل تاريخ الحركات لإعادة بناء حالة العائد */
          if (data.action === 'rmove' && payload && payload.action) {
            const dedupKey = payload.dedup;
            if (dedupKey) {
              if (!room.dedupSeen) room.dedupSeen = {};
              if (room.dedupSeen[dedupKey]) { json({ ok: true, room: serializeRoom(room) }); return; }  /* مكرَّر — تجاهله */
              room.dedupSeen[dedupKey] = 1;
            }
            if (!room.moveHistory) room.moveHistory = [];
            room.moveHistory.push(payload);
            if (room.moveHistory.length > 2000) room.moveHistory.shift();
          }
          broadcastRoom(room, 'room:move', { room_id: room.id, action: data.action, data: payload, from_id: me ? me.id : null });
          json({ ok: true, room: serializeRoom(room) });
        } else {
          json({ ok: false, message: 'الغرفة غير موجودة' }, 404);
        }
        return;
      }
      const chatMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/chat$/);
      if (chatMatch && req.method === 'GET') {
        const room = rooms[chatMatch[1]];
        const msgs = room ? room.chat.slice(-100) : [];
        json({ ok: true, messages: msgs });
        return;
      }
      if (pathname === '/api/rooms/chat') {
        const room = rooms[data.room_id];
        if (room) {
          const msg = {
            room_id: data.room_id, text: data.text || '',
            from_id: me ? me.id : null, from_name: me ? me.username : 'زائر',
            to_id: data.to != null ? Number(data.to) : null,
            to_name: '', created_at: Date.now()
          };
          if (data.to != null) {
            const to = room.players.find(function (x) { return x.id === Number(data.to); });
            if (to) msg.to_name = to.username;
          }
          room.chat.push(msg);
          if (room.chat.length > 200) room.chat.shift();
          broadcastRoom(room, 'room:chat', msg);
          json({ ok: true, msg: msg });
        } else {
          json({ ok: false, message: 'الغرفة غير موجودة' }, 404);
        }
        return;
      }

      // Default API fallback
      json({ ok: true });
    });
    return;
  }

  /* ═══════ الملفات الثابتة ═══════ */
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath.replace(/^\//, ''));
  if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + pathname);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Digital Moroccan Casino Live Server running at http://0.0.0.0:' + PORT);
});
