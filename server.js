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

/* ═══════ تخزين الحسابات: SQLite (نفس باك-أند المنصة القديم royalcoin.db) ═══════ */
const { DatabaseSync } = require('node:sqlite');
const DB_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DB_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DB_DIR, 'royalcoin.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  pass_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin','super')),
  gold INTEGER NOT NULL DEFAULT 1000,
  lang TEXT NOT NULL DEFAULT 'ar',
  banned INTEGER NOT NULL DEFAULT 0,
  last_claim INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL DEFAULT 0,
  totp_secret TEXT,
  twofa_enabled INTEGER NOT NULL DEFAULT 0
);
`);
/* [2FA] ترحيل آمن: إضافة أعمدة المصادقة الثنائية لقواعد البيانات القديمة (royalcoin.db) */
try { db.exec('ALTER TABLE users ADD COLUMN totp_secret TEXT'); } catch (e) {}
try { db.exec('ALTER TABLE users ADD COLUMN twofa_enabled INTEGER NOT NULL DEFAULT 0'); } catch (e) {}

/* [Friends] جداول الأصدقاء والرسائل الخاصة */
db.exec(`
CREATE TABLE IF NOT EXISTS friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  friend_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_friends ON friends(user_id, friend_id);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  room_code TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_created ON messages(created_at);
CREATE TABLE IF NOT EXISTS admin_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`);

/* مخطط تشفير كلمات المرور مطابق للباك-أند القديم (scrypt) */
function hashPassword(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}
function verifyPassword(password, saltHex, expectedHash) {
  const { hash } = hashPassword(password, saltHex);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ═══════ [2FA] TOTP (RFC 6238) — node:crypto فقط (HMAC-SHA1, 30s, 6 أرقام, base32) ═══════ */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32_ALPHABET[(value >>> bits) & 31];
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(str) {
  const lookup = {};
  for (let i = 0; i < BASE32_ALPHABET.length; i++) lookup[BASE32_ALPHABET[i]] = i;
  str = String(str || '').toUpperCase().replace(/=+$/, '');
  let bits = 0, value = 0;
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const c = lookup[str[i]];
    if (c === undefined) continue;
    value = (value << 5) | c;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}
/* سر TOTP عشوائي (20 بايت → base32) */
function totpSecret() { return base32Encode(crypto.randomBytes(20)); }
/* رمز TOTP عند لحظة زمنية معيّنة (ميلي ثانية) */
function totpAt(secret, time) {
  const key = base32Decode(secret);
  if (!key.length) return '';
  const counter = Math.floor(time / 30000);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, '0');
}
/* التحقق من رمز TOTP مع نافذة ±1 خطوة زمنية */
function totpVerify(secret, code) {
  if (!secret || code == null) return false;
  code = String(code).trim();
  if (!/^\d{6}$/.test(code)) return false;
  const now = Date.now();
  for (let w = -1; w <= 1; w++) {
    if (totpAt(secret, now + w * 30000) === code) return true;
  }
  return false;
}

let nextUserId = 100;
const users = {};               // userId -> {id, username, passHash, passSalt, role, gold, lang, banned}
const sessions = {};            // sid -> userId
const rooms = {};               // roomId -> room object
let nextRoomId = 1;
/* رسم الرهان على المنصة: نسبة تُقتطع من الرهان عند تسوية الجولة بين لاعبَين */
const BET_FEE_RATE = 0.05;      /* 5% رسوم المنصة على الرهان */

/* تحميل المستخدمين من قاعدة البيانات إلى الذاكرة */
function loadUsersFromDB() {
  const rows = db.prepare('SELECT id, username, pass_hash, pass_salt, role, gold, lang, banned, totp_secret, twofa_enabled FROM users').all();
  rows.forEach(function (r) {
    users[r.id] = {
      id: r.id, username: r.username,
      passHash: r.pass_hash, passSalt: r.pass_salt,
      role: r.role, gold: r.gold, lang: r.lang, banned: !!r.banned,
      totpSecret: r.totp_secret || null, twofaEnabled: !!r.twofa_enabled
    };
    if (r.id >= nextUserId) nextUserId = r.id + 1;
  });
}
/* حفظ مستخدم جديد في قاعدة البيانات وربطه بالذاكرة */
function persistUser(u) {
  const t = Math.floor(Date.now() / 1000);
  const info = db.prepare('INSERT INTO users (username, pass_hash, pass_salt, role, gold, lang, created_at, last_seen) VALUES (?,?,?,?,?,?,?,?)').run(
    u.username, u.passHash, u.passSalt, u.role || 'user', u.gold || 0, u.lang || 'ar', t, t
  );
  u.id = Number(info.lastInsertRowid);
  if (u.id >= nextUserId) nextUserId = u.id + 1;
  users[u.id] = u;
}
/* إنشاء الحسابات الافتراضية فقط إن كانت القاعدة فارغة (نفس حسابات الباك-أند القديم) */
(function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) return;
  const t = Math.floor(Date.now() / 1000);
  const seeds = [
    ['super', 'RoyalCoin@Super1', 'super'],
    ['admin', 'RoyalCoin@Admin1', 'admin'],
    ['player', 'RoyalCoin@User1', 'user']
  ];
  const ins = db.prepare('INSERT INTO users (username, pass_hash, pass_salt, role, gold, created_at, last_seen) VALUES (?,?,?,?,?,?,?)');
  for (const [name, pass, role] of seeds) {
    const { salt, hash } = hashPassword(pass, null);
    ins.run(name, hash, salt, role, 1000, t, t);
  }
  console.log('[seed] created default accounts: super, admin, player');
})();
loadUsersFromDB();

/* [Friends] مؤقّت تنظيف الرسائل الأقدم من 24 ساعة */
setInterval(() => {
  try { db.prepare('DELETE FROM messages WHERE created_at < ?').run(Date.now() - 24 * 3600 * 1000); } catch (e) {}
}, 5 * 60 * 1000);

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
  return { id: u.id, username: u.username, role: u.role, gold: u.gold, lang: u.lang, twofa_enabled: !!u.twofaEnabled };
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
    room_type: room.room_type || null,   /* [B10] نوع الرهان: 'hour' | 'percentage' */
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
/* [Friends] إرسال حدث SSE لمستخدم محدّد (يطابق بنية sseClients الموجودة) */
function sendToUser(userId, event, data) {
  sseClients.forEach(function (c) {
    if (c.userId != null && c.userId === userId) sendSSE(c.res, event, data);
  });
}


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
        /* [Auth] لا إنشاء تلقائي عند الدخول — الحسابات تُنشأ فقط عبر المشرفين */
        if (!existing) {
          json({ ok: false, message: 'الحساب غير موجود. تواصل مع المشرف لإنشاء حساب.' }, 404);
          return;
        }
        if (existing.banned) { json({ ok: false, message: 'تم حظر هذا الحساب' }, 403); return; }
        if (existing.passHash && !verifyPassword(data.password || '', existing.passSalt, existing.passHash)) {
          json({ ok: false, message: 'كلمة المرور غير صحيحة' }, 401); return;
        }
        /* [2FA] إذا كانت المصادقة الثنائية مفعّلة يلزم رمز TOTP صالح قبل إصدار الجلسة */
        if (existing.twofaEnabled) {
          if (!data.totp || !totpVerify(existing.totpSecret, data.totp)) {
            json({ twofa_required: true, userId: existing.id });
            return;
          }
        }
        try { db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), existing.id); } catch (e) {}
        startSession(res, existing);
        json({ ok: true, user: publicUser(existing) });
        return;
      }
      if (pathname === '/api/admin/register') {
        /* [Auth] إنشاء حساب لاعب من طرف المشرف (super/admin) — يبدأ بدون جلسة */
        if (!me || (me.role !== 'admin' && me.role !== 'super')) {
          json({ ok: false, message: 'صلاحية غير كافية: إنشاء الحسابات متاح للمشرفين فقط' }, 403); return;
        }
        const username = (data.username || '').toString().trim();
        const password = (data.password || '').toString();
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
          json({ ok: false, message: 'اسم المستخدم غير صالح (3-20 حرفاً: حروف/أرقام/_)' }, 400); return;
        }
        if (password.length < 6) { json({ ok: false, message: 'كلمة المرور 6 أحرف على الأقل' }, 400); return; }
        if (Object.values(users).some(function (x) { return x.username === username; })) {
          json({ ok: false, message: 'اسم المستخدم محجوز' }, 400); return;
        }
        const { salt, hash } = hashPassword(password, null);
        const u = { username: username, passHash: hash, passSalt: salt, role: 'user', gold: 0, lang: 'ar', banned: false };
        persistUser(u);
        json({ ok: true, user: publicUser(u) });
        return;
      }
      if (pathname === '/api/register') {
        /* [Auth] إنشاء الحسابات مخصّص للمشرفين فقط (super/admin) — لا تسجيل ذاتي من نافذة الدخول */
        if (!me || (me.role !== 'admin' && me.role !== 'super')) {
          json({ ok: false, message: 'صلاحية غير كافية: إنشاء الحسابات متاح للمشرفين فقط' }, 403); return;
        }
        const username = (data.username || '').toString().trim();
        const password = (data.password || '').toString();
        const role = (data.role === 'admin' || data.role === 'super' || data.role === 'user') ? data.role : 'user';
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
          json({ ok: false, message: 'اسم المستخدم غير صالح (3-20 حرفاً: حروف/أرقام/_)' }, 400); return;
        }
        if (password.length < 6) { json({ ok: false, message: 'كلمة المرور 6 أحرف على الأقل' }, 400); return; }
        if (Object.values(users).some(function (x) { return x.username === username; })) {
          json({ ok: false, message: 'اسم المستخدم محجوز' }, 400); return;
        }
        const { salt, hash } = hashPassword(password, null);
        const u = { username: username, passHash: hash, passSalt: salt, role: role, gold: (data.gold != null ? Number(data.gold) : 0), lang: 'ar', banned: false };
        persistUser(u);
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
        if (me) {
          if (data.gold !== undefined) me.gold = data.gold;
          if (data.lang) me.lang = data.lang;
          try { db.prepare('UPDATE users SET gold = ?, lang = ? WHERE id = ?').run(me.gold, me.lang, me.id); } catch (e) {}
        }
        json({ ok: true, gold: me ? me.gold : 0 });
        return;
      }
      if (pathname === '/api/change-password') {
        if (!me) { json({ ok: false, message: 'غير مسجّل' }, 401); return; }
        if (me.passHash && !verifyPassword(data.oldPassword || '', me.passSalt, me.passHash)) { json({ ok: false, message: 'كلمة المرور القديمة خاطئة' }, 400); return; }
        const { salt, hash } = hashPassword(data.newPassword || '', null);
        me.passHash = hash; me.passSalt = salt;
        try { db.prepare('UPDATE users SET pass_hash = ?, pass_salt = ? WHERE id = ?').run(hash, salt, me.id); } catch (e) {}
        json({ ok: true, message: 'تم تغيير كلمة المرور' });
        return;
      }
      /* ── [2FA] المصادقة الثنائية ── */
      if (pathname === '/api/2fa/login') {
        /* إكمال الدخول بعد إدخال رمز TOTP (userId + code) */
        const user = (data.userId != null) ? users[data.userId] : null;
        if (!user) { json({ ok: false, message: 'المستخدم غير موجود' }, 401); return; }
        if (user.twofaEnabled && !totpVerify(user.totpSecret, data.code)) { json({ ok: false, message: 'رمز التحقق غير صحيح' }, 401); return; }
        try { db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), user.id); } catch (e) {}
        startSession(res, user);
        json({ ok: true, user: publicUser(user) });
        return;
      }
      if (pathname === '/api/2fa/enable') {
        if (!me) { json({ ok: false, message: 'يلزم تسجيل الدخول' }, 401); return; }
        const secret = totpSecret();
        me.totpSecret = secret;
        try { db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(secret, me.id); } catch (e) {}
        const otpauth = 'otpauth://totp/DigitalMoroccanCasino:' + me.username + '?secret=' + secret + '&issuer=DigitalMoroccanCasino&algorithm=SHA1&digits=6&period=30';
        json({ ok: true, secret: secret, otpauth: otpauth });
        return;
      }
      if (pathname === '/api/2fa/verify') {
        if (!me) { json({ ok: false, message: 'يلزم تسجيل الدخول' }, 401); return; }
        if (!totpVerify(me.totpSecret, data.code)) { json({ ok: false, error: 'رمز التحقق غير صحيح' }, 400); return; }
        me.twofaEnabled = 1;
        try { db.prepare('UPDATE users SET totp_secret = ?, twofa_enabled = ? WHERE id = ?').run(me.totpSecret, 1, me.id); } catch (e) {}
        json({ ok: true });
        return;
      }
      if (pathname === '/api/2fa/disable') {
        if (!me) { json({ ok: false, message: 'يلزم تسجيل الدخول' }, 401); return; }
        if (me.passHash && !verifyPassword(data.password || '', me.passSalt, me.passHash)) { json({ ok: false, message: 'كلمة المرور غير صحيحة' }, 401); return; }
        me.twofaEnabled = 0; me.totpSecret = null;
        try { db.prepare('UPDATE users SET totp_secret = ?, twofa_enabled = ? WHERE id = ?').run(null, 0, me.id); } catch (e) {}
        json({ ok: true });
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

      /* ── [Friends] الأصدقاء والرسائل الخاصة ── */
      if (pathname === '/api/friends/add' && req.method === 'POST') {
        if (!me) { json({ ok: false, message: 'يلزم تسجيل الدخول' }, 401); return; }
        const target = Object.values(users).find(function (u) { return u.username === (data.username || ''); });
        if (!target) { json({ ok: false, message: 'المستخدم غير موجود' }, 404); return; }
        if (target.id === me.id) { json({ ok: false, message: 'لا يمكنك إضافة نفسك' }, 400); return; }
        try { db.prepare('INSERT OR REPLACE INTO friends (user_id, friend_id, status, created_at) VALUES (?,?,?,?)').run(me.id, target.id, 'pending', Date.now()); } catch (e) {}
        json({ ok: true });
        return;
      }
      if (pathname === '/api/friends/accept' && req.method === 'POST') {
        if (!me) { json({ ok: false, message: 'يلزم تسجيل الدخول' }, 401); return; }
        const fid = Number(data.friendUserId);
        if (isNaN(fid)) { json({ ok: false, message: 'معرّف غير صالح' }, 400); return; }
        try {
          db.prepare("UPDATE friends SET status='accepted' WHERE user_id = ? AND friend_id = ?").run(me.id, fid);
          db.prepare("UPDATE friends SET status='accepted' WHERE user_id = ? AND friend_id = ?").run(fid, me.id);
        } catch (e) {}
        json({ ok: true });
        return;
      }
      if (pathname === '/api/friends/remove' && req.method === 'POST') {
        if (!me) { json({ ok: false, message: 'يلزم تسجيل الدخول' }, 401); return; }
        const fid = Number(data.friendUserId);
        if (isNaN(fid)) { json({ ok: false, message: 'معرّف غير صالح' }, 400); return; }
        try {
          db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?').run(me.id, fid);
          db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?').run(fid, me.id);
        } catch (e) {}
        json({ ok: true });
        return;
      }
      if (pathname === '/api/friends' && req.method === 'GET') {
        if (!me) { json({ ok: false, message: 'يلزم تسجيل الدخول' }, 401); return; }
        const uname = function (id) { const u = users[id]; return u ? u.username : ('user' + id); };
        const accepted = db.prepare('SELECT friend_id FROM friends WHERE user_id = ? AND status = ?').all(me.id, 'accepted');
        const incoming = db.prepare('SELECT user_id FROM friends WHERE friend_id = ? AND status = ?').all(me.id, 'pending');
        const outgoing = db.prepare('SELECT friend_id FROM friends WHERE user_id = ? AND status = ?').all(me.id, 'pending');
        json({
          ok: true,
          friends: accepted.map(function (r) { return { id: r.friend_id, username: uname(r.friend_id), status: 'accepted' }; }),
          incoming: incoming.map(function (r) { return { id: r.user_id, username: uname(r.user_id) }; }),
          outgoing: outgoing.map(function (r) { return { id: r.friend_id, username: uname(r.friend_id) }; })
        });
        return;
      }
      if (pathname === '/api/messages' && req.method === 'POST') {
        if (!me) { json({ ok: false, message: 'يلزم تسجيل الدخول' }, 401); return; }
        let receiverId;
        const to = data.to;
        if (to != null && /^\d+$/.test(String(to))) {
          receiverId = Number(to);
          if (!users[receiverId]) { json({ ok: false, message: 'المستخدم غير موجود' }, 404); return; }
        } else {
          const target = Object.values(users).find(function (u) { return u.username === String(to || ''); });
          if (!target) { json({ ok: false, message: 'المستخدم غير موجود' }, 404); return; }
          receiverId = target.id;
        }
        const text = String(data.text || '').slice(0, 4000);
        if (!text) { json({ ok: false, message: 'الرسالة فارغة' }, 400); return; }
        const now = Date.now();
        const roomCode = data.room_code || null;
        let msg;
        try {
          const info = db.prepare('INSERT INTO messages (sender_id, receiver_id, text, room_code, created_at) VALUES (?,?,?,?,?)').run(me.id, receiverId, text, roomCode, now);
          msg = { id: Number(info.lastInsertRowid), sender_id: me.id, receiver_id: receiverId, text: text, room_code: roomCode, created_at: now };
        } catch (e) { json({ ok: false, message: 'تعذّر إرسال الرسالة' }, 500); return; }
        sendToUser(me.id, 'dm', msg);
        sendToUser(receiverId, 'dm', msg);
        json({ ok: true, message: msg });
        return;
      }
      if (pathname === '/api/messages' && req.method === 'GET') {
        if (!me) { json({ ok: false, message: 'يلزم تسجيل الدخول' }, 401); return; }
        const otherId = Number(parsedUrl.query.with);
        if (isNaN(otherId)) { json({ ok: false, message: 'مطلوب معرّف المستخدم' }, 400); return; }
        const since = Date.now() - 24 * 3600 * 1000;
        const msgs = db.prepare('SELECT id, sender_id, receiver_id, text, room_code, created_at FROM messages WHERE created_at >= ? AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) ORDER BY created_at ASC')
          .all(since, me.id, otherId, otherId, me.id);
        json({ ok: true, messages: msgs });
        return;
      }
      if (pathname === '/api/messages/inbox' && req.method === 'GET') {
        if (!me) { json({ ok: false, message: 'يلزم تسجيل الدخول' }, 401); return; }
        const since = Date.now() - 24 * 3600 * 1000;
        const rows = db.prepare('SELECT id, sender_id, receiver_id, text, created_at FROM messages WHERE created_at >= ? AND (sender_id = ? OR receiver_id = ?) ORDER BY created_at ASC').all(since, me.id, me.id);
        const map = {};
        let totalUnread = 0;
        rows.forEach(function (m) {
          const other = (m.sender_id === me.id) ? m.receiver_id : m.sender_id;
          if (!map[other]) map[other] = { lastText: m.text, at: m.created_at, unread: 0 };
          else { map[other].lastText = m.text; map[other].at = m.created_at; }
          if (m.receiver_id === me.id) { map[other].unread += 1; totalUnread += 1; }
        });
        const conversations = Object.keys(map).map(function (k) {
          const o = map[k];
          const u = users[k];
          return { with: Number(k), username: u ? u.username : ('user' + k), lastText: o.lastText, unread: o.unread, at: o.at };
        });
        json({ ok: true, conversations: conversations, unread: totalUnread });
        return;
      }
      /* ── مراسلة المشرفين (admin ⇄ super) ── */
      if (pathname === '/api/admin/messages' && req.method === 'GET') {
        /* للأدمن والسوبر فقط — قناة تنسيق مخصّصة */
        if (!me || (me.role !== 'admin' && me.role !== 'super')) { json({ ok: false, message: 'غير مصرّح' }, 403); return; }
        const since = Date.now() - 7 * 24 * 3600 * 1000;
        const msgs = db.prepare('SELECT id, sender_id, text, created_at FROM admin_messages WHERE created_at >= ? ORDER BY created_at ASC').all(since);
        json({ ok: true, messages: msgs.map(function (m) { const u = users[m.sender_id]; return { id: m.id, sender_id: m.sender_id, sender_name: u ? u.username : ('user' + m.sender_id), text: m.text, created_at: m.created_at }; }) });
        return;
      }
      if (pathname === '/api/admin/messages' && req.method === 'POST') {
        if (!me || (me.role !== 'admin' && me.role !== 'super')) { json({ ok: false, message: 'غير مصرّح' }, 403); return; }
        const text = String(data.text || '').slice(0, 4000);
        if (!text) { json({ ok: false, message: 'الرسالة فارغة' }, 400); return; }
        const now = Date.now();
        let msg;
        try {
          const info = db.prepare('INSERT INTO admin_messages (sender_id, text, created_at) VALUES (?,?,?)').run(me.id, text, now);
          msg = { id: Number(info.lastInsertRowid), sender_id: me.id, sender_name: me.username, text: text, created_at: now };
        } catch (e) { json({ ok: false, message: 'تعذّر إرسال الرسالة' }, 500); return; }
        /* بثّ لكل المشرفين المتصلين */
        Object.keys(users).forEach(function (uid) {
          const u = users[uid];
          if (u && (u.role === 'admin' || u.role === 'super')) sendToUser(Number(uid), 'admin_msg', msg);
        });
        json({ ok: true, message: msg });
        return;
      }
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
          return { id: r.id, code: r.code, game_id: r.game_id, owner_name: r.owner_name, max_players: r.max_players, players_count: r.players.length, status: r.status, bet: r.bet || 0, room_type: r.room_type || null };
        });
        json({ ok: true, rooms: list });
        return;
      }
      if (pathname === '/api/rooms' && req.method === 'POST') {
        /* إنشاء غرفة — الرهان مدفوع إلزامياً (لا غرف مجانية) */
        if (!me) { json({ ok: false, message: 'يلزم تسجيل الدخول' }, 401); return; }
        /* [Auth] المشرفون (admin/super) لا يفتحون غرفاً كلاعبين ولا يراهنون */
        if (me.role !== 'user') { json({ ok: false, message: 'المشرفون لا يمكنهم الدخول كلاعبين أو المراهنة' }, 403); return; }
        const room_type = data.room_type;
        if (room_type !== 'hour' && room_type !== 'percentage') { json({ ok: false, error: 'room_type_required' }, 400); return; }
        const bet = Number(data.bet);
        if (isNaN(bet) || bet <= 0) { json({ ok: false, error: 'bet_required' }, 400); return; }
        const gid = data.game_id || 'rm';
        const maxp = Math.max(2, Math.min(8, parseInt(data.max_players, 10) || 4));
        const rid = 'r' + (nextRoomId++);
        const code = crypto.randomBytes(3).toString('hex').toUpperCase();
        const room = {
          id: rid, code: code, game_id: gid,
          owner_id: me.id, owner_name: me.username,
          max_players: maxp, status: 'waiting', bet: bet, room_type: room_type,
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
        /* [Auth] المشرفون (admin/super) لا ينضمون كلاعبين ولا يراهنون */
        if (me.role !== 'user') { json({ ok: false, message: 'المشرفون لا يمكنهم الدخول كلاعبين أو المراهنة' }, 403); return; }
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
        /* [Auth] المشرفون (admin/super) لا يبدؤون جولات كلاعبين ولا يراهنون */
        if (me && me.role !== 'user') { json({ ok: false, message: 'المشرفون لا يمكنهم الدخول كلاعبين أو المراهنة' }, 403); return; }
        const room = rooms[data.room_id];
        if (room && me && room.owner_id === me.id) {
          const bet = Number(room.bet) || 0;
          /* [B10] اقتطاع الرهان من كل لاعب غير متفرّج (وليس بوتّاً) عند بدء المباراة */
          const payers = room.players.filter(function (p) { return !p.spectate && users[p.id]; });
          let insufficient = null;
          for (const p of payers) {
            if ((users[p.id].gold || 0) < bet) { insufficient = users[p.id].username; break; }
          }
          if (insufficient) { json({ ok: false, error: 'insufficient_funds', user: insufficient }, 400); return; }
          payers.forEach(function (p) {
            const u = users[p.id];
            u.gold = (u.gold || 0) - bet;
            try { db.prepare('UPDATE users SET gold = ? WHERE id = ?').run(u.gold, u.id); } catch (e) {}
          });
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
