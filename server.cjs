/* ═══════════════════════════════════════════════════════════
   Digital Moroccan casino — Real Backend Server
   Node.js pure: node:http + node:sqlite + node:crypto
   Zero npm dependencies. Serves static files + /api/* on :8000
   ═══════════════════════════════════════════════════════════ */
"use strict";

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const PORT = 8011;
const DB_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DB_DIR, 'royalcoin.db');
const SESSION_DAYS = 7;
const SESSION_MS = SESSION_DAYS * 24 * 3600 * 1000;
const MAX_SYNC_GOLD = 100_000_000;
const REGISTER_GOLD = 1000;

/* ── حدود الحماية (مكافحة البوتات + حجم الطلبات) ── */
const BODY_LIMIT = 100 * 1024; /* حد JSON body: 100kb */
const BLOCK_AUTOMATION = true; /* تفعيل حجب سكريبتات الأتمتة/البوتات */
/* علامات أتمتة معروفة في User-Agent (توسع بحسب الحاجة) */
const AUTOMATION_UA = /playwright|headless|phantomjs|selenium|puppeteer|python-requests|python-urllib|go-http-client|okhttp|axios|^java[ /]/i;

/* ── Database ─────────────────────────────────────────────── */
fs.mkdirSync(DB_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);
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
  last_seen INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS game_stats (
  game_id TEXT PRIMARY KEY,
  plays INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  coins_won INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  username TEXT NOT NULL,
  bet INTEGER NOT NULL DEFAULT 0,
  won INTEGER NOT NULL DEFAULT 0,
  payout INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rounds_game ON rounds(game_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_id ON chat_messages(id);
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  game_id TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  max_players INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','playing','finished')),
  created_at INTEGER NOT NULL,
  room_state TEXT
);
CREATE TABLE IF NOT EXISTS room_players (
  room_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  seat INTEGER NOT NULL,
  ready INTEGER NOT NULL DEFAULT 0,
  joined_at INTEGER NOT NULL,
  spectate INTEGER NOT NULL DEFAULT 0,
  UNIQUE(room_id, user_id)
);
CREATE TABLE IF NOT EXISTS room_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  from_id INTEGER NOT NULL,
  from_name TEXT NOT NULL,
  to_id INTEGER,
  to_name TEXT,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_room_msgs_room ON room_messages(room_id, id DESC);
/* تحويلات الكوينز بين اللاعبين (إرسال لصديق) */
CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id INTEGER NOT NULL,
  from_name TEXT NOT NULL,
  to_id INTEGER NOT NULL,
  to_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transfers_from ON transfers(from_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_to ON transfers(to_id, id DESC);
/* البطولات: ينشئها لاعب/أدمن → موافقة أدمن → مشاركة لاعبين مسجلين */
CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  game_id TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  owner_name TEXT NOT NULL,
  prize INTEGER NOT NULL DEFAULT 0,
  max_players INTEGER NOT NULL DEFAULT 2,
  entry_fee INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','active','finished','rejected')),
  approved_by INTEGER,
  created_at INTEGER NOT NULL,
  starts_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tournament_players (
  tournament_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  joined_at INTEGER NOT NULL,
  UNIQUE(tournament_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status, created_at DESC);
/* الجولات الجماعية (كينو/كراش — السيرفر يحكم الجولة، Provably Fair) */
CREATE TABLE IF NOT EXISTS group_rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  round_no INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'betting' CHECK (status IN ('betting','drawing','flying','finished')),
  seed TEXT,
  seed_hash TEXT,
  outcome TEXT,
  started_at INTEGER,
  bet_ends_at INTEGER,
  crashed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS group_bets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  bet INTEGER NOT NULL,
  picks TEXT,
  cashout_mult REAL,
  won INTEGER NOT NULL DEFAULT 0,
  payout INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_group_bets_round ON group_bets(round_id);
CREATE INDEX IF NOT EXISTS idx_group_rounds_game ON group_rounds(game_id, id DESC);
`);
/* أعمدة جديدة لقواعد البيانات الموجودة (تُتجاهل بأمان إن وُجدت) */
try { db.prepare('ALTER TABLE rooms ADD COLUMN room_state TEXT').run(); } catch (e) { /* موجودة */ }
try { db.prepare('ALTER TABLE room_players ADD COLUMN spectate INTEGER NOT NULL DEFAULT 0').run(); } catch (e) { /* موجودة */ }
/* تبعية اللاعب للأدمن الذي سجّله (null للاعبين العامين/الأدمنز) */
try { db.prepare('ALTER TABLE users ADD COLUMN admin_id INTEGER').run(); } catch (e) { /* موجودة */ }

const nowS = () => Math.floor(Date.now() / 1000);
const nowMs = () => Date.now();

/* ── Default settings ─────────────────────────────────────── */
function setting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));
}
function gameEnabled(id) {
  return setting('game_enabled_' + id, '1') === '1';
}

/* ── Seed accounts (only when users table is empty) ───────── */
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

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) return;
  const t = nowS();
  const seeds = [
    ['super', 'RoyalCoin@Super1', 'super'],
    ['admin', 'RoyalCoin@Admin1', 'admin'],
    ['player', 'RoyalCoin@User1', 'user']
  ];
  const ins = db.prepare('INSERT INTO users (username, pass_hash, pass_salt, role, gold, created_at, last_seen) VALUES (?,?,?,?,?,?,?)');
  for (const [name, pass, role] of seeds) {
    const { salt, hash } = hashPassword(pass, null);
    ins.run(name, hash, salt, role, REGISTER_GOLD, t, t);
  }
  console.log('[seed] created default accounts: super, admin, player');
}
seedIfEmpty();

/* ── Sessions ─────────────────────────────────────────────── */
function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = nowMs();
  db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)')
    .run(token, userId, now, now + SESSION_MS);
  return token;
}
function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}
function userFromToken(token) {
  if (!token) return null;
  const row = db.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`
  ).get(token, nowMs());
  if (!row) return null;
  return row;
}

/* ── Cookie helpers ───────────────────────────────────────── */
const COOKIE_ATTRS = 'HttpOnly; Path=/; SameSite=Lax; Max-Age=' + (SESSION_MS / 1000);
function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `RC_SID=${token}; ${COOKIE_ATTRS}`);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'RC_SID=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
}
function getToken(req) {
  const h = req.headers.cookie || '';
  const m = /(?:^|;\s*)RC_SID=([^;\s]+)/.exec(h);
  return m ? m[1] : null;
}

/* ── Rate limiting (in-memory) ────────────────────────────── */
const rateMap = new Map(); // key(ip[:ns]) -> { first, count }
function rateLimit(ip, max, windowMs, ns) {
  const now = nowMs();
  const key = ns ? ip + ':' + ns : ip; // لكل endpoint عداد مستقل (لا تشارك IP واحد عداداً واحداً)
  let entry = rateMap.get(key);
  if (!entry || now - entry.first > windowMs) {
    entry = { first: now, count: 0 };
    rateMap.set(key, entry);
  }
  entry.count++;
  return entry.count > max;
}

/* ── حماية الدخول من brute force: قفل مؤقت بعد N محاولات فاشلة متتالية ──
   المفتاح = IP + اسم المستخدم معاً (خسارة مفتاح واحد لا يقفل مستخدمين آخرين من نفس IP) */
const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCK_MS = 60_000;
const loginFailures = new Map(); // key(ip|username) -> { fails, lockedUntil }
function loginRecordFailure(key) {
  const e = loginFailures.get(key) || { fails: 0, lockedUntil: 0 };
  e.fails++;
  if (e.fails >= LOGIN_MAX_FAILS) {
    e.lockedUntil = nowMs() + LOGIN_LOCK_MS;
    e.fails = 0;
  }
  loginFailures.set(key, e);
}
/* تنظيف دوري حتى لا تنمو الخريطة بلا حدود */
setInterval(() => {
  const cut = nowMs();
  for (const [k, e] of loginFailures) {
    if (e.lockedUntil > 0 && e.lockedUntil + LOGIN_LOCK_MS < cut) loginFailures.delete(k);
  }
}, 5 * 60_000).unref();

/* ── JSON helpers ─────────────────────────────────────────── */
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}
/* رؤوس أمنية عامة تُضاف لكل استجابة (لا تكسر SSE/WS — headers فقط) */
function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
}
/* كشف سكريبتات الأتمتة من User-Agent فقط:
   - علامات أتمتة صريحة (playwright/headless/python-requests/selenium...)
   ملاحظة: لا نعتمد على sec-ch-ua — المتصفحات الحقيقية لا ترسل Client Hints
   إلا عبر HTTPS، والمنصة http محلياً، فكان يقتل مستخدمي كروم/إيدج الحقيقيين. */
function isAutomationRequest(req) {
  const ua = String(req.headers['user-agent'] || '');
  if (!ua) return false;
  if (AUTOMATION_UA.test(ua)) return true;
  return false;
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let tooLarge = false;
    req.on('data', (chunk) => {
      if (tooLarge) return; /* نستنزف الباقي دون تخزين حتى نرد 413 بشكل سليم */
      data += chunk;
      if (data.length > BODY_LIMIT) {
        tooLarge = true;
        data = '';
      }
    });
    req.on('end', () => {
      if (tooLarge) { const err = new Error('body too large'); err.code = 'PAYLOAD_TOO_LARGE'; return reject(err); }
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        const err = new Error('invalid JSON');
        err.code = 'BAD_JSON';
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/* ── Public user payload ──────────────────────────────────── */
function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    gold: u.gold,
    lang: u.lang,
    banned: !!u.banned,
    last_seen: u.last_seen,
    created_at: u.created_at,
    admin_id: u.admin_id != null ? u.admin_id : null
  };
}

/* ── Live events hub (SSE) — دردشة/جولات/متصلون/غرف ───────── */
const sseClients = new Map(); // Map<res, {userId|null}>
function sseWrite(res, type, data) {
  res.write('event: ' + type + '\ndata: ' + JSON.stringify(data) + '\n\n');
}
function broadcast(type, data) {
  for (const [c] of sseClients) {
    try { sseWrite(c, type, data); } catch (e) { sseClients.delete(c); }
  }
}
/* بث داخل غرفة: يصل فقط لأعضاء الغرفة المتصلين */
function broadcastRoom(roomId, type, data, excludeUserId) {
  const members = db.prepare('SELECT user_id FROM room_players WHERE room_id = ?').all(roomId);
  const ids = new Set(members.map(r => r.user_id));
  for (const [c, entry] of sseClients) {
    if (entry.userId != null && ids.has(entry.userId) && entry.userId !== excludeUserId) {
      try { sseWrite(c, type, data); } catch (e) { sseClients.delete(c); }
    }
  }
}
/* بث مباشر لمستخدمين محددين فقط (المراسلة الفردية في الغرفة) */
function sendSseToUsers(userIds, type, data) {
  const ids = new Set((userIds || []).filter(n => n != null));
  if (ids.size === 0) return;
  for (const [c, entry] of sseClients) {
    if (entry.userId != null && ids.has(entry.userId)) {
      try { sseWrite(c, type, data); } catch (e) { sseClients.delete(c); }
    }
  }
}
/* شكل رسالة غرفة موحّد (يُستخدم في التخزين والبث) */
function roomChatMessage(roomId, fromId, fromName, text, toId, toName) {
  return {
    id: 'm' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    room_id: roomId,
    from_id: fromId,
    from_name: fromName,
    to_id: toId != null ? toId : null,
    to_name: toName || null,
    text: String(text || '').slice(0, 300),
    created_at: nowS()
  };
}

/* ═══════════════════════════════════════════════════════════
   Group rounds — Keno (ke) & Crash (av) — جولات جماعية خادمية
   السيرفر يولد النتائج (Provably Fair) ويخصم/يضيف الأرصدة في DB.
   العميل يرى نفس الجولة/النتيجة ويضبط رصيده من ردود السيرفر فقط.
   ═══════════════════════════════════════════════════════════ */
const GROUP_KE = 'ke', GROUP_AV = 'av';
const GROUP_ROUND_CFG = {
  ke: { bet_ms: 20000, draw_ms: 5000 },
  av: { bet_ms: 12000 }
};
/* نسخة خادمية من جدول مضاعفات كينو — تطابق js/games/engines.js KENO_PAYS حرفياً */
const KENO_PAYS = [
  null,
  [0, 3.8],
  [0, 1, 10],
  [0, 0, 3, 38],
  [0, 0, 1, 9, 100],
  [0, 0, 0, 4, 26, 448],
  [0, 0, 0, 2, 9, 85, 1324],
  [0, 0, 0, 0, 6, 39, 270, 4199],
  [0, 0, 0, 0, 3, 18, 98, 684, 8924],
  [0, 0, 0, 0, 0, 10, 63, 313, 2170, 28930],
  [0, 0, 0, 0, 0, 5, 28, 154, 794, 4205, 56061]
];
const groupRounds = {}; /* gameId -> {round} الحالة الحية في الذاكرة */

function sha256Hex(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}
/* نتيجة حتمية من البذرة — نفس التوليد يُعاد على العميل في fair.js للتحقق */
function groupOutcome(seed, gameId) {
  const h = (i) => parseInt(sha256Hex(seed + ':' + i).slice(0, 8), 16);
  if (gameId === GROUP_KE) {
    const pool = [];
    for (let n = 1; n <= 80; n++) pool.push(n);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = h(i) % (i + 1);
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    return { numbers: pool.slice(0, 20) };
  }
  if (gameId === GROUP_AV) {
    const u = Math.min(h(1) / 0xFFFFFFFF, 0.999999999);
    return { crash_at: Math.max(1.02, 0.97 / (1 - u)) };
  }
  return null;
}
function kenoPayout(k, hits) {
  const row = KENO_PAYS[k];
  return (row && row[hits]) || 0;
}

/* بدء جولة جديدة للعبة (نافذة رهان ثم سحب/طيران) */
function groupStartNext(gameId) {
  const prev = groupRounds[gameId];
  const base = prev
    ? prev.round_no
    : db.prepare('SELECT COALESCE(MAX(round_no),0) m FROM group_rounds WHERE game_id = ?').get(gameId).m;
  const roundNo = base + 1;
  const seed = crypto.randomBytes(16).toString('hex');
  const seedHash = sha256Hex(seed);
  const outcome = groupOutcome(seed, gameId);
  const cfg = GROUP_ROUND_CFG[gameId];
  const now = nowMs();
  const info = db.prepare(
    'INSERT INTO group_rounds (game_id, round_no, status, seed, seed_hash, outcome, started_at, bet_ends_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(gameId, roundNo, 'betting', seed, seedHash, JSON.stringify(outcome), now, now + cfg.bet_ms, nowS());
  const round = {
    id: Number(info.lastInsertRowid),
    game_id: gameId,
    round_no: roundNo,
    status: 'betting',
    seed, seed_hash: seedHash, outcome,
    started_at: now,
    bet_ends_at: now + cfg.bet_ms,
    draw_ends_at: 0,
    crashed_at: 0,
    timer: null
  };
  groupRounds[gameId] = round;
  broadcast('gr:' + gameId, {
    type: 'new',
    round_no: roundNo,
    bet_ends_at: round.bet_ends_at,
    phase_ends_at: round.bet_ends_at,
    seed_hash: seedHash
  });
  round.timer = setTimeout(() => {
    if (gameId === GROUP_KE) groupKeDraw(round);
    else groupAvFly(round);
  }, cfg.bet_ms);
  return round;
}

/* كينو: نهاية الرهان → كشف الأرقام (5 ثوانٍ) → تسوية */
function groupKeDraw(round) {
  round.status = 'drawing';
  round.draw_ends_at = nowMs() + GROUP_ROUND_CFG.ke.draw_ms;
  db.prepare("UPDATE group_rounds SET status = 'drawing' WHERE id = ?").run(round.id);
  broadcast('gr:ke', { type: 'draw', round_no: round.round_no, numbers: round.outcome.numbers, phase_ends_at: round.draw_ends_at });
  round.timer = setTimeout(() => { groupKeResolve(round); }, GROUP_ROUND_CFG.ke.draw_ms);
}
function groupKeResolve(round) {
  const numbers = round.outcome.numbers;
  const bets = db.prepare('SELECT * FROM group_bets WHERE round_id = ?').all(round.id);
  const updBet = db.prepare('UPDATE group_bets SET won = ?, payout = ? WHERE id = ?');
  const updGold = db.prepare('UPDATE users SET gold = gold + ? WHERE id = ?');
  let totalPaid = 0;
  const winners = [];
  for (const b of bets) {
    let payout = 0;
    try {
      const picks = JSON.parse(b.picks || '[]');
      const hits = picks.filter((n) => numbers.indexOf(n) !== -1).length;
      payout = Math.floor(b.bet * kenoPayout(picks.length, hits));
    } catch (e) { payout = 0; }
    updBet.run(payout > 0 ? 1 : 0, payout, b.id);
    if (payout > 0) {
      updGold.run(payout, b.user_id);
      totalPaid += payout;
      winners.push({ username: b.username, payout });
    }
  }
  round.status = 'finished';
  db.prepare("UPDATE group_rounds SET status = 'finished' WHERE id = ?").run(round.id);
  broadcast('gr:ke', { type: 'resolve', round_no: round.round_no, result: { winners, total_paid: totalPaid } });
  groupStartNext(GROUP_KE);
}

/* كراش: نهاية الرهان → طيران (مدة = ln(crash_at)/0.00006 ms) → انفجار → تسوية */
function groupAvFly(round) {
  round.status = 'flying';
  round.started_at = nowMs();
  db.prepare("UPDATE group_rounds SET status = 'flying', started_at = ? WHERE id = ?").run(round.started_at, round.id);
  broadcast('gr:av', { type: 'fly', round_no: round.round_no, started_at: round.started_at });
  const crashAt = round.outcome.crash_at;
  const flightMs = Math.log(crashAt) / 0.00006;
  round.timer = setTimeout(() => { groupAvResolve(round, crashAt); }, flightMs);
}
function groupAvResolve(round, crashAt) {
  const bets = db.prepare('SELECT * FROM group_bets WHERE round_id = ?').all(round.id);
  let totalPaid = 0;
  const winners = [];
  for (const b of bets) {
    if (b.won) {
      totalPaid += b.payout;
      winners.push({ username: b.username, mult: b.cashout_mult, payout: b.payout });
    }
  }
  round.status = 'finished';
  round.crashed_at = nowMs();
  db.prepare("UPDATE group_rounds SET status = 'finished', crashed_at = ? WHERE id = ?").run(round.crashed_at, round.id);
  broadcast('gr:av', { type: 'crash', round_no: round.round_no, crash_at: crashAt, result: { winners, total_paid: totalPaid } });
  groupStartNext(GROUP_AV);
}

/* عند إقلاع السيرفر: استرداد رهانات أي جولة معلقة (لا تعلق أبداً) ثم تشغيل الحلقات */
function groupSettleLeftover() {
  const rows = db.prepare("SELECT id FROM group_rounds WHERE status IN ('betting','drawing','flying')").all();
  const updBet = db.prepare('UPDATE group_bets SET won = 1, payout = bet WHERE round_id = ? AND won = 0');
  const updGold = db.prepare('UPDATE users SET gold = gold + ? WHERE id = ?');
  for (const r of rows) {
    const bets = db.prepare('SELECT * FROM group_bets WHERE round_id = ? AND won = 0').all(r.id);
    for (const b of bets) updGold.run(b.bet, b.user_id);
    updBet.run(r.id);
    db.prepare("UPDATE group_rounds SET status = 'finished' WHERE id = ?").run(r.id);
  }
  if (rows.length) console.log('[group] refunded ' + rows.length + ' leftover round(s)');
}
function groupStartAll() {
  try {
    groupSettleLeftover();
    groupStartNext(GROUP_KE);
    groupStartNext(GROUP_AV);
    console.log('[group] rounds started: ke + av');
  } catch (e) {
    console.error('[group] start failed', e);
  }
}

/* ── API router ───────────────────────────────────────────── */
const api = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const p = url.pathname;
  const method = req.method;

  /* ── رؤوس أمنية عامة (كل الاستجابات: API + ثابتة + SSE) ── */
  applySecurityHeaders(res);

  /* ── حجب البوتات/سكريبتات الأتمتة (middleware مبكر، قبل أي معالجة) ──
     التجاوز (loopback فقط — بيئة التطوير والتحقق بـ Playwright):
       * كل طلبات loopback (127.0.0.1/::1) تتجاوز الحجب افتراضياً.
       * لتجربة الحجب حياً من loopback: أضف الترويسة  x-rc-test: force
         (يعيد تفعيل الفحص على نفس الطلب) — مثال:
         curl -H "User-Agent: python-requests/2.31" -H "x-rc-test: force" http://127.0.0.1:8011/api/me
       * التجاوز الصريح المعرّف:  x-rc-test: 1  أو  ?bot=test  (يُقبل فقط من loopback).
       * من خارج loopback: الفحص يطبق دائماً، ومفاتيح التجاوز تُتجاهل. */
  const ip = req.socket.remoteAddress || 'local';
  const isLoopback = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  if (BLOCK_AUTOMATION) {
    const forced = isLoopback && String(req.headers['x-rc-test'] || '') === 'force';
    if (!isLoopback || forced) {
      if (isAutomationRequest(req)) {
        console.log('[bot] blocked', ip, String(req.headers['user-agent']).slice(0, 80));
        return sendJson(res, 403, { error: 'bot_blocked', message: 'طلبات الأتمتة مرفوضة على هذه المنصة' });
      }
    }
  }

  /* Static files (non-API) */
  if (!p.startsWith('/api/')) {
    return serveStatic(req, res, p);
  }

  /* ── Live stream (SSE) — عام للجميع، يبقى مفتوحاً ── */
  if (p === '/api/live') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write(': connected\n\n');
    /* ربط الاتصال بمستخدم إن وُجدت كعكة (لأحداث الغرف) */
    const liveToken = getToken(req);
    const liveUser = liveToken ? userFromToken(liveToken) : null;
    sseClients.set(res, { userId: liveUser ? liveUser.id : null });
    try {
      const history = db.prepare('SELECT username, message, created_at FROM chat_messages ORDER BY id DESC LIMIT 30').all().reverse();
      const winners = db.prepare('SELECT game_id, username, bet, payout, created_at FROM rounds WHERE won = 1 AND payout > 0 ORDER BY id DESC LIMIT 10').all().reverse();
      sseWrite(res, 'hello', { online: sseClients.size, history, winners });
      broadcast('online', { online: sseClients.size });
    } catch (e) {
      console.error('[live]', e);
    }
    const hb = setInterval(() => {
      try { res.write(': ping\n\n'); } catch (e) { clearInterval(hb); sseClients.delete(res); }
    }, 20000);
    req.on('close', () => {
      clearInterval(hb);
      sseClients.delete(res);
      broadcast('online', { online: sseClients.size });
    });
    return;
  }

  /* ── Room helpers ─────────────────────────────────────────── */
  const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function genRoomCode() {
    for (let i = 0; i < 10; i++) {
      let code = '';
      for (let j = 0; j < 6; j++) code += ROOM_CODE_CHARS[crypto.randomInt(ROOM_CODE_CHARS.length)];
      if (!db.prepare('SELECT id FROM rooms WHERE code = ?').get(code)) return code;
    }
    return 'XXXXXX';
  }
  function roomState(id) {
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) return null;
    const players = db.prepare(
      `SELECT u.id, u.username, u.gold, rp.seat, rp.ready, rp.spectate
       FROM room_players rp JOIN users u ON u.id = rp.user_id
       WHERE rp.room_id = ? ORDER BY rp.seat`
    ).all(id);
    let roomStateData = null;
    if (room.room_state) {
      try { roomStateData = JSON.parse(room.room_state); } catch (e) { roomStateData = null; }
    }
    return {
      id: room.id,
      code: room.code,
      game_id: room.game_id,
      max_players: room.max_players,
      status: room.status,
      owner_id: room.owner_id,
      room_state: roomStateData,
      players: players.map(p => ({ id: p.id, username: p.username, gold: p.gold, seat: p.seat, ready: !!p.ready, spectate: !!p.spectate }))
    };
  }

  const token = getToken(req);
  const user = token ? userFromToken(token) : null;
  if (user) {
    db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(nowS(), user.id);
  }

  const requireAuth = () => {
    if (!user) { sendJson(res, 401, { error: 'unauthorized', message: 'يرجى تسجيل الدخول أولاً' }); return null; }
    if (user.banned) { destroySession(token); sendJson(res, 403, { error: 'banned', message: 'تم حظر هذا الحساب' }); return null; }
    return user;
  };
  const requireRole = (role) => {
    const u = requireAuth();
    if (!u) return null;
    const order = { user: 1, admin: 2, super: 3 };
    if (order[u.role] < order[role]) {
      sendJson(res, 403, { error: 'forbidden', message: 'لا تملك صلاحية لهذا الإجراء' });
      return null;
    }
    return u;
  };

  try {
    /* ── Public auth ── */
    if (p === '/api/register' && method === 'POST') {
      if (rateLimit(ip, 8, 60_000, 'reg')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — حاول لاحقاً' });
      const body = await readBody(req);
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
        return sendJson(res, 400, { error: 'bad_username', message: 'الاسم: 3-20 حرفاً (حروف/أرقام/_)' });
      if (password.length < 6 || password.length > 128)
        return sendJson(res, 400, { error: 'bad_password', message: 'كلمة المرور: 6 أحرف على الأقل' });
      if (db.prepare('SELECT id FROM users WHERE username = ?').get(username))
        return sendJson(res, 409, { error: 'exists', message: 'الاسم مستخدم بالفعل' });
      const { salt, hash } = hashPassword(password, null);
      const t = nowS();
      const info = db.prepare('INSERT INTO users (username, pass_hash, pass_salt, role, gold, lang, created_at, last_seen) VALUES (?,?,?,?,?,?,?,?)')
        .run(username, hash, salt, 'user', REGISTER_GOLD, 'ar', t, t);
      const sessionToken = createSession(info.lastInsertRowid);
      setSessionCookie(res, sessionToken);
      const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
      return sendJson(res, 200, { ok: true, user: publicUser(fresh) });
    }

    if (p === '/api/login' && method === 'POST') {
      if (rateLimit(ip, 10, 60_000, 'login')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — حاول لاحقاً' });
      const body = await readBody(req);
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      if (password.length > 128) return sendJson(res, 400, { error: 'bad_password', message: 'كلمة المرور طويلة جداً' });
      const lkey = ip + '|' + username.toLowerCase();
      const lock = loginFailures.get(lkey);
      if (lock && lock.lockedUntil > nowMs())
        return sendJson(res, 429, { error: 'locked', message: 'محاولات كثيرة فاشلة — انتظر قليلاً', retry_after_ms: lock.lockedUntil - nowMs() });
      const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      if (!row || !verifyPassword(password, row.pass_salt, row.pass_hash)) {
        loginRecordFailure(lkey);
        return sendJson(res, 401, { error: 'bad_credentials', message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
      }
      loginFailures.delete(lkey);
      if (row.banned) return sendJson(res, 403, { error: 'banned', message: 'تم حظر هذا الحساب' });
      const sessionToken = createSession(row.id);
      setSessionCookie(res, sessionToken);
      db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(nowS(), row.id);
      return sendJson(res, 200, { ok: true, user: publicUser(row) });
    }

    if (p === '/api/logout' && method === 'POST') {
      if (token) destroySession(token);
      clearSessionCookie(res);
      return sendJson(res, 200, { ok: true });
    }

    /* تغيير كلمة المرور (اللاعب لنفسه) — يتحقق من كلمة المرور الحالية ثم يحدّث
       ويُلغي كل الجلسات الأخرى ما عدا الجلسة الحالية */
    if (p === '/api/change-password' && method === 'POST') {
      const u = requireAuth();
      if (!u) return;
      if (rateLimit(ip, 5, 60_000, 'ch_pw')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — انتظر قليلاً' });
      const body = await readBody(req);
      const oldPassword = String(body.oldPassword || '');
      const newPassword = String(body.newPassword || '');
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
      if (!row || !verifyPassword(oldPassword, row.pass_salt, row.pass_hash))
        return sendJson(res, 401, { error: 'bad_credentials', message: 'كلمة المرور الحالية غير صحيحة' });
      if (newPassword.length < 6 || newPassword.length > 128)
        return sendJson(res, 400, { error: 'bad_password', message: 'كلمة المرور: 6 أحرف على الأقل' });
      const { salt, hash } = hashPassword(newPassword, null);
      db.prepare('UPDATE users SET pass_hash = ?, pass_salt = ? WHERE id = ?').run(hash, salt, u.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(u.id, token);
      return sendJson(res, 200, { ok: true, message: 'تم تغيير كلمة المرور بنجاح' });
    }

    /* ── Authenticated user endpoints ── */
    if (p === '/api/me') {
      const u = requireAuth();
      if (!u) return;
      const dailyInterval = parseInt(setting('daily_interval_hours', '24'), 10) || 24;
      const claimReady = nowMs() - (u.last_claim * 1000) >= dailyInterval * 3600 * 1000;
      return sendJson(res, 200, {
        user: publicUser(u),
        games: null,
        claim: { ready: claimReady, interval_hours: dailyInterval }
      });
    }

    if (p === '/api/games' && method === 'GET') {
      const u = requireAuth();
      if (!u) return;
      const keys = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'game_enabled_%'").all();
      const map = {};
      for (const k of keys) map[k.key.replace('game_enabled_', '')] = k.value === '1';
      return sendJson(res, 200, { ok: true, games: map });
    }

    if (p === '/api/claim' && method === 'POST') {
      const u = requireAuth();
      if (!u) return;
      if (rateLimit(ip, 10, 60_000, 'claim')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — حاول لاحقاً' });
      const dailyAmount = parseInt(setting('daily_amount', '100'), 10) || 100;
      const dailyInterval = parseInt(setting('daily_interval_hours', '24'), 10) || 24;
      const nextAllowed = (u.last_claim * 1000) + dailyInterval * 3600 * 1000;
      if (nowMs() < nextAllowed)
        return sendJson(res, 429, { error: 'not_ready', message: 'المكافأة غير متاحة بعد', next_in_ms: nextAllowed - nowMs() });
      const amount = Math.max(0, Math.min(dailyAmount, MAX_SYNC_GOLD));
      db.prepare('UPDATE users SET gold = gold + ?, last_claim = ? WHERE id = ?').run(amount, nowS(), u.id);
      const fresh = db.prepare('SELECT gold FROM users WHERE id = ?').get(u.id);
      return sendJson(res, 200, { ok: true, amount, gold: fresh.gold });
    }

    if (p === '/api/sync' && method === 'POST') {
      const u = requireAuth();
      if (!u) return;
      if (rateLimit(ip, 120, 60_000, 'sync')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — انتظر قليلاً' });
      const body = await readBody(req);
      let gold = parseInt(body.gold, 10);
      if (Number.isNaN(gold) || gold < 0) gold = u.gold;
      if (gold > MAX_SYNC_GOLD) gold = MAX_SYNC_GOLD;
      const lang = String(body.lang || u.lang);
      if (!/^(ar|fr|en)$/.test(lang)) return sendJson(res, 400, { error: 'bad_lang' });
      db.prepare('UPDATE users SET gold = ?, lang = ? WHERE id = ?').run(gold, lang, u.id);
      return sendJson(res, 200, { ok: true, gold });
    }

    /* ── سجل الجولات (اللاعب المسجّل يسجّل جولته) ── */
    if (p === '/api/rounds' && method === 'POST') {
      const u = requireAuth();
      if (!u) return;
      if (rateLimit(ip, 120, 60_000, 'rounds_log')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — انتظر قليلاً' });
      const body = await readBody(req);
      const game_id = String(body.game_id || '').trim();
      if (!/^[\w-]{1,32}$/.test(game_id)) return sendJson(res, 400, { error: 'bad_game' });
      let bet = parseInt(body.bet, 10);
      if (Number.isNaN(bet) || bet < 0) bet = 0;
      if (bet > MAX_SYNC_GOLD) bet = MAX_SYNC_GOLD;
      let payout = parseInt(body.payout, 10);
      if (Number.isNaN(payout) || payout < 0) payout = 0;
      if (payout > MAX_SYNC_GOLD) payout = MAX_SYNC_GOLD;
      const won = body.won ? 1 : 0;
      const t = nowS();
      db.prepare('INSERT INTO rounds (game_id, username, bet, won, payout, created_at) VALUES (?,?,?,?,?,?)')
        .run(game_id, u.username, bet, won, payout, t);
      db.prepare(`INSERT INTO game_stats (game_id, plays, wins, coins_won) VALUES (?,1,?,?)
                  ON CONFLICT(game_id) DO UPDATE SET
                    plays = plays + 1,
                    wins = wins + excluded.wins,
                    coins_won = coins_won + excluded.coins_won`)
        .run(game_id, won, payout);
      broadcast('round', { game_id, username: u.username, bet, won, payout, created_at: t });
      return sendJson(res, 200, { ok: true });
    }

    /* ── الدردشة الحية (لاعب مسجّل، محدود بالمعدل) ── */
    if (p === '/api/chat' && method === 'POST') {
      const u = requireAuth();
      if (!u) return;
      if (rateLimit(ip, 6, 60_000, 'chat')) return sendJson(res, 429, { error: 'rate', message: 'رسائل كثيرة — انتظر قليلاً' });
      const body = await readBody(req);
      const message = String(body.message || '').trim().slice(0, 200);
      if (!message) return sendJson(res, 400, { error: 'empty', message: 'الرسالة فارغة' });
      const t = nowS();
      db.prepare('INSERT INTO chat_messages (username, message, created_at) VALUES (?,?,?)').run(u.username, message, t);
      db.prepare('DELETE FROM chat_messages WHERE id NOT IN (SELECT id FROM chat_messages ORDER BY id DESC LIMIT 500)').run();
      broadcast('chat', { username: u.username, message, created_at: t });
      return sendJson(res, 200, { ok: true, message: { username: u.username, message, created_at: t } });
    }

    /* ── قائمة الغرف المفتوحة (صفحة غرف اللعب: انضمام أو فرجة) ── */
    if (p === '/api/rooms' && method === 'GET') {
      const u = requireAuth();
      if (!u) return;
      /* تنظيف الغرف المعلقة المهجورة (بانتظار منذ أكثر من 6 ساعات) حتى لا تبقى في القائمة للأبد */
      db.prepare("UPDATE rooms SET status = 'finished' WHERE status = 'waiting' AND created_at < ?")
        .run(nowS() - 6 * 3600);
      const rows = db.prepare(
        `SELECT r.id, r.code, r.game_id, r.owner_id, r.max_players, r.status, r.created_at, u.username AS owner_name
         FROM rooms r JOIN users u ON u.id = r.owner_id
         WHERE r.status IN ('waiting','playing')
         ORDER BY r.status = 'playing', r.created_at DESC`
      ).all();
      const list = rows.map(function (r) {
        const cnt = db.prepare('SELECT COUNT(*) c FROM room_players WHERE room_id = ?').get(r.id).c;
        return {
          id: r.id, code: r.code, game_id: r.game_id, owner_id: r.owner_id,
          owner_name: r.owner_name, max_players: r.max_players,
          players_count: cnt, status: r.status, created_at: r.created_at
        };
      });
      return sendJson(res, 200, { ok: true, rooms: list });
    }

    /* ── الغرف: فتح/انضمام/خروج/جاهزية/بدء/حركة ── */
    if (p === '/api/rooms' && method === 'POST') {
      const u = requireAuth();
      if (!u) return;
      if (rateLimit(ip, 20, 60_000, 'rooms_create')) return sendJson(res, 429, { error: 'rate', message: 'غرف كثيرة — انتظر قليلاً' });
      const body = await readBody(req);
      const game_id = String(body.game_id || '').trim();
      if (!/^[\w-]{1,32}$/.test(game_id)) return sendJson(res, 400, { error: 'bad_game' });
      const mp = parseInt(body.max_players, 10);
      const max_players = Number.isNaN(mp) || mp < 2 || mp > 4 ? 2 : mp;
      const id = crypto.randomUUID();
      const t = nowS();
      db.prepare('INSERT INTO rooms (id, code, game_id, owner_id, max_players, status, created_at) VALUES (?,?,?,?,?,?,?)')
        .run(id, genRoomCode(), game_id, u.id, max_players, 'waiting', t);
      db.prepare('INSERT INTO room_players (room_id, user_id, seat, ready, joined_at) VALUES (?,?,?,?,?)')
        .run(id, u.id, 0, 0, t);
      const room = roomState(id);
      broadcastRoom(id, 'room:update', room);
      return sendJson(res, 200, { ok: true, room });
    }

    if (p === '/api/rooms/join' && method === 'POST') {
      const u = requireAuth();
      if (!u) return;
      if (rateLimit(ip, 30, 60_000, 'rooms_join')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — انتظر قليلاً' });
      const body = await readBody(req);
      const code = String(body.code || '').trim().toUpperCase();
      const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(code);
      if (!room) return sendJson(res, 404, { error: 'not_found', message: 'الغرفة غير موجودة' });
      if (room.status !== 'waiting') return sendJson(res, 400, { error: 'started', message: 'اللعبة بدأت بالفعل' });
      const cnt = db.prepare('SELECT COUNT(*) c FROM room_players WHERE room_id = ?').get(room.id).c;
      if (cnt >= room.max_players) return sendJson(res, 400, { error: 'full', message: 'الغرفة ممتلئة' });
      const already = db.prepare('SELECT 1 FROM room_players WHERE room_id = ? AND user_id = ?').get(room.id, u.id);
      if (already) return sendJson(res, 200, { ok: true, room: roomState(room.id) });
      const seat = db.prepare('SELECT COALESCE(MAX(seat), -1) + 1 AS s FROM room_players WHERE room_id = ?').get(room.id).s;
      db.prepare('INSERT INTO room_players (room_id, user_id, seat, ready, joined_at) VALUES (?,?,?,?,?)')
        .run(room.id, u.id, seat, 0, nowS());
      const st = roomState(room.id);
      broadcastRoom(room.id, 'room:update', st);
      return sendJson(res, 200, { ok: true, room: st });
    }

    if (p === '/api/rooms/leave' && method === 'POST') {
      const u = requireAuth();
      if (!u) return;
      if (rateLimit(ip, 60, 60_000, 'rooms_leave')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — انتظر قليلاً' });
      const body = await readBody(req);
      const room_id = String(body.room_id || '');
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room_id);
      if (!room) return sendJson(res, 404, { error: 'not_found', message: 'الغرفة غير موجودة' });
      db.prepare('DELETE FROM room_players WHERE room_id = ? AND user_id = ?').run(room_id, u.id);
      const cnt = db.prepare('SELECT COUNT(*) c FROM room_players WHERE room_id = ?').get(room_id).c;
      if (cnt === 0) {
        db.prepare('DELETE FROM rooms WHERE id = ?').run(room_id);
        return sendJson(res, 200, { ok: true, deleted: true });
      }
      if (room.owner_id === u.id) {
        const next = db.prepare('SELECT user_id FROM room_players WHERE room_id = ? ORDER BY seat LIMIT 1').get(room_id);
        if (next) db.prepare('UPDATE rooms SET owner_id = ? WHERE id = ?').run(next.user_id, room_id);
      }
      const st = roomState(room_id);
      broadcastRoom(room_id, 'room:update', st);
      return sendJson(res, 200, { ok: true, room: st });
    }

    if (p === '/api/rooms/ready' && method === 'POST') {
      const u = requireAuth();
      if (!u) return;
      if (rateLimit(ip, 60, 60_000, 'rooms_ready')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — انتظر قليلاً' });
      const body = await readBody(req);
      const room_id = String(body.room_id || '');
      const ready = body.ready ? 1 : 0;
      const member = db.prepare('SELECT 1 FROM room_players WHERE room_id = ? AND user_id = ?').get(room_id, u.id);
      if (!member) return sendJson(res, 403, { error: 'not_member', message: 'لست عضواً في هذه الغرفة' });
      db.prepare('UPDATE room_players SET ready = ? WHERE room_id = ? AND user_id = ?').run(ready, room_id, u.id);
      const st = roomState(room_id);
      broadcastRoom(room_id, 'room:update', st);
      return sendJson(res, 200, { ok: true, room: st });
    }

    if (p === '/api/rooms/start' && method === 'POST') {
      const u = requireAuth();
      if (!u) return;
      if (rateLimit(ip, 60, 60_000, 'rooms_start')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — انتظر قليلاً' });
      const body = await readBody(req);
      const room_id = String(body.room_id || '');
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room_id);
      if (!room) return sendJson(res, 404, { error: 'not_found', message: 'الغرفة غير موجودة' });
      if (room.owner_id !== u.id) return sendJson(res, 403, { error: 'not_owner', message: 'صاحب الغرفة فقط يبدأ اللعب' });
      const pls = db.prepare('SELECT * FROM room_players WHERE room_id = ?').all(room_id);
      if (pls.length < 2) return sendJson(res, 400, { error: 'need_players', message: 'تحتاج لاعبين على الأقل' });
      if (pls.some(p => !p.ready)) return sendJson(res, 400, { error: 'not_ready', message: 'بانتظار جاهزية الجميع' });
      db.prepare("UPDATE rooms SET status = 'playing' WHERE id = ?").run(room_id);
      const st = roomState(room_id);
      broadcastRoom(room_id, 'room:update', st);
      return sendJson(res, 200, { ok: true, room: st });
    }

    if (p === '/api/rooms/move' && method === 'POST') {
      const u = requireAuth();
      if (!u) return;
      if (rateLimit('rm:' + u.id, 240, 60_000, 'move')) return sendJson(res, 429, { error: 'rate', message: 'حركات كثيرة — تمهل قليلاً' });
      const body = await readBody(req);
      const room_id = String(body.room_id || '');
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room_id);
      if (!room) return sendJson(res, 404, { error: 'not_found', message: 'الغرفة غير موجودة' });
      const member = db.prepare('SELECT 1 FROM room_players WHERE room_id = ? AND user_id = ?').get(room_id, u.id);
      if (!member) return sendJson(res, 403, { error: 'not_member', message: 'لست عضواً في هذه الغرفة' });
      const action = String(body.action || '').slice(0, 40);
      if (!action) return sendJson(res, 400, { error: 'bad_action' });
      const data = (body.data !== undefined && body.data !== null) ? body.data : {};
      /* ── الاختيار الأعمى (ألعاب زوجية): نخزن الاختيار دون بثه للخصم، ونكشف الزوج معاً عند اكتماله
            (يمنع من يختار ثانياً من رؤية حركة الأول — عدالة وجهاً لوجه) ── */
      if (action === 'blind') {
        if ((room.max_players || 2) !== 2) return sendJson(res, 400, { error: 'blind_pair', message: 'الاختيار الأعمى للألعاب الثنائية فقط' });
        const dir = String(data.d !== undefined && data.d !== null ? data.d : '').slice(0, 10);
        if (!dir) return sendJson(res, 400, { error: 'bad_dir', message: 'اتجاه غير صالح' });
        let cur = db.prepare('SELECT room_state FROM rooms WHERE id = ?').get(room_id);
        let st = null;
        try { st = cur && cur.room_state ? JSON.parse(cur.room_state) : {}; } catch (e) { st = {}; }
        if (!st || typeof st !== 'object') st = {};
        if (!st.blind || typeof st.blind !== 'object') st.blind = {};
        if (st.blind[u.id]) return sendJson(res, 200, { ok: true }); /* تكرار من نفس اللاعب — تجاهل */
        st.blind[u.id] = dir;
        if (Object.keys(st.blind).length >= 2) {
          const dirs = st.blind;
          st.blind = {};
          try { db.prepare('UPDATE rooms SET room_state = ? WHERE id = ?').run(JSON.stringify(st), room_id); } catch (e) {}
          broadcastRoom(room_id, 'room:move', { from: null, action: 'blindResult', data: { dirs } }, null);
          return sendJson(res, 200, { ok: true });
        }
        try { db.prepare('UPDATE rooms SET room_state = ? WHERE id = ?').run(JSON.stringify(st), room_id); } catch (e) {}
        return sendJson(res, 200, { ok: true }); /* الزوج لم يكتمل — لا بث (الخصم لا يعرف القيمة) */
      }
      /* حالة الغرفة الرسمية (يكتبها اللاعبون المتقدمون — آخر كتابة تفوز، الترتيب تسلسلي) */
      const state = (body.state !== undefined && body.state !== null) ? body.state : null;
      if (state !== null) {
        let s = null;
        try { s = JSON.stringify(state); } catch (e) { s = null; }
        if (s === null) return sendJson(res, 400, { error: 'bad_state' });
        if (s.length > 50_000) return sendJson(res, 400, { error: 'state_too_large', message: 'حالة الغرفة كبيرة جداً' });
        db.prepare('UPDATE rooms SET room_state = ? WHERE id = ?').run(s, room_id);
      }
      broadcastRoom(room_id, 'room:move', { from: u.username, action, data, state: state !== null ? state : undefined }, u.id);
      return sendJson(res, 200, { ok: true, room: roomState(room_id) });
    }

    /* ── وضع الفرجة: ضيف يلعب أو يكتفي بالمشاهدة (قبل بدء اللعب فقط) ── */
    if (p === '/api/rooms/spectate' && method === 'POST') {
      const u = requireAuth();
      if (!u) return;
      if (rateLimit(ip, 30, 60_000, 'rooms_spectate')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — انتظر قليلاً' });
      const body = await readBody(req);
      const room_id = String(body.room_id || '');
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room_id);
      if (!room) return sendJson(res, 404, { error: 'not_found', message: 'الغرفة غير موجودة' });
      if (room.status !== 'waiting') return sendJson(res, 400, { error: 'started', message: 'لا يمكن تغيير وضع الفرجة بعد بدء اللعب' });
      const member = db.prepare('SELECT 1 FROM room_players WHERE room_id = ? AND user_id = ?').get(room_id, u.id);
      if (!member) return sendJson(res, 403, { error: 'not_member', message: 'لست عضواً في هذه الغرفة' });
      if (room.owner_id === u.id) return sendJson(res, 400, { error: 'owner_spectate', message: 'صاحب الغرفة هو الموزع ولا يمكنه الفرجة' });
      const spectate = body.spectate ? 1 : 0;
      /* المشاهد جاهز تلقائياً (لا يعطل بدء اللعب)، والعودة للعب تعيد ضبط الجاهزية */
      db.prepare('UPDATE room_players SET spectate = ?, ready = ? WHERE room_id = ? AND user_id = ?')
        .run(spectate, spectate, room_id, u.id);
      const st = roomState(room_id);
      broadcastRoom(room_id, 'room:update', st);
      return sendJson(res, 200, { ok: true, room: st });
    }

    /* ── مراسلة الغرفة: جماعية (إلى الجميع) أو فردية (إلى لاعب محدد) ── */
    if (p === '/api/rooms/chat' && method === 'POST') {
      const u = requireAuth();
      if (!u) return;
      const body = await readBody(req);
      const room_id = String(body.room_id || '');
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room_id);
      if (!room) return sendJson(res, 404, { error: 'not_found', message: 'الغرفة غير موجودة' });
      const member = db.prepare('SELECT 1 FROM room_players WHERE room_id = ? AND user_id = ?').get(room_id, u.id);
      if (!member) return sendJson(res, 403, { error: 'not_member', message: 'لست عضواً في هذه الغرفة' });
      const text = String(body.text || '').trim().slice(0, 300);
      if (!text) return sendJson(res, 400, { error: 'empty', message: 'الرسالة فارغة' });
      /* مكافحة الإغراق: رسالة كل 800ms كحد أقصى */
      if (rateLimit('rc:' + u.id, 40, 30_000)) return sendJson(res, 429, { error: 'rate', message: 'رسائل كثيرة — تمهل قليلاً' });
      let toId = null, toName = null;
      const rawTo = body.to != null && body.to !== '' ? String(body.to) : null;
      if (rawTo) {
        const target = db.prepare(
          'SELECT u.id, u.username FROM room_players rp JOIN users u ON u.id = rp.user_id WHERE rp.room_id = ? AND rp.user_id = ?'
        ).get(room_id, Number(rawTo));
        if (!target) return sendJson(res, 400, { error: 'not_in_room', message: 'اللاعب المستهدف ليس في الغرفة' });
        toId = target.id;
        toName = target.username;
      }
      const msg = roomChatMessage(room_id, u.id, u.username, text, toId, toName);
      try {
        db.prepare('INSERT INTO room_messages (room_id, from_id, from_name, to_id, to_name, text, created_at) VALUES (?,?,?,?,?,?,?)')
          .run(msg.room_id, msg.from_id, msg.from_name, msg.to_id, msg.to_name, msg.text, msg.created_at);
      } catch (e) { /* التخزين اختياري — البث أهم */ }
      if (toId) {
        /* فردية: المستلم فقط عبر SSE (المرسل يرسم من الاستجابة — لا ازدواج) */
        sendSseToUsers([toId], 'room:chat', msg);
      } else {
        /* جماعية: بقية الأعضاء عبر SSE (المرسل يرسم من الاستجابة) */
        broadcastRoom(room_id, 'room:chat', msg, u.id);
      }
      return sendJson(res, 200, { ok: true, msg: msg });
    }

    /* ── سجل رسائل الغرفة (آخر 50) — يُجلب عند فتح المودال ── */
    let cmsg;
    if ((cmsg = /^\/api\/rooms\/([\w-]+)\/chat$/.exec(p)) && method === 'GET') {
      const u = requireAuth();
      if (!u) return;
      const room_id = cmsg[1];
      const member = db.prepare('SELECT 1 FROM room_players WHERE room_id = ? AND user_id = ?').get(room_id, u.id);
      if (!member) return sendJson(res, 403, { error: 'not_member', message: 'لست عضواً في هذه الغرفة' });
      const rows = db.prepare(
        'SELECT from_id, from_name, to_id, to_name, text, created_at FROM room_messages WHERE room_id = ? ORDER BY id DESC LIMIT 50'
      ).all(room_id).reverse();
      return sendJson(res, 200, { ok: true, messages: rows });
    }

    let rm;
    if ((rm = /^\/api\/rooms\/([\w-]+)$/.exec(p)) && method === 'GET') {
      const u = requireAuth();
      if (!u) return;
      const st = roomState(rm[1]);
      if (!st) return sendJson(res, 404, { error: 'not_found', message: 'الغرفة غير موجودة' });
      return sendJson(res, 200, { ok: true, room: st });
    }

    /* ── سجل الجولات العام للعبة (حي — عام للجميع) ── */
    let hm;
    if ((hm = /^\/api\/games\/([\w-]+)\/history$/.exec(p)) && method === 'GET') {
      const game_id = hm[1];
      const rows = db.prepare(
        'SELECT username, bet, won, payout, created_at FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 25'
      ).all(game_id);
      return sendJson(res, 200, { ok: true, rounds: rows });
    }

    /* ── الجولات الجماعية: كينو/كراش (السيرفر يحكم الجولة والرصيد) ── */
    function grpRoundResult(gameId, round) {
      const bets = db.prepare('SELECT * FROM group_bets WHERE round_id = ?').all(round.id);
      let totalPaid = 0;
      const winners = [];
      for (const b of bets) {
        if (!b.won) continue;
        totalPaid += b.payout;
        winners.push({ username: b.username, mult: b.cashout_mult, payout: b.payout });
      }
      return { winners, total_paid: totalPaid };
    }

    if (p === '/api/games/ke/round' && method === 'GET') {
      const u = requireAuth();
      if (!u) return;
      const r = groupRounds.ke;
      if (!r) return sendJson(res, 404, { error: 'no_round', message: 'لا جولة نشطة حالياً' });
      const pub = {
        game_id: 'ke', round_no: r.round_no, status: r.status,
        bet_ends_at: r.bet_ends_at,
        phase_ends_at: r.status === 'betting' ? r.bet_ends_at : r.draw_ends_at,
        seed_hash: r.seed_hash
      };
      if (r.status === 'drawing' || r.status === 'finished') pub.numbers = r.outcome.numbers;
      if (r.status === 'finished') pub.result = grpRoundResult('ke', r);
      const myBets = db.prepare('SELECT bet, picks, won, payout FROM group_bets WHERE round_id = ? AND user_id = ?').all(r.id, u.id);
      const live = db.prepare('SELECT username, bet, picks, created_at FROM group_bets WHERE round_id = ? ORDER BY id DESC LIMIT 20').all(r.id);
      return sendJson(res, 200, { ok: true, round: pub, my_bets: myBets, live });
    }

    if (p === '/api/games/ke/bet' && method === 'POST') {
      const u = requireAuth();
      if (!u) return;
      if (rateLimit(ip, 12, 60_000, 'ke_bet')) return sendJson(res, 429, { error: 'rate', message: 'رهانات كثيرة — انتظر قليلاً' });
      const r = groupRounds.ke;
      if (!r) return sendJson(res, 404, { error: 'no_round' });
      if (r.status !== 'betting') return sendJson(res, 400, { error: 'round_closed', message: 'انتهى وقت الرهان — انتظر الجولة التالية' });
      if (nowMs() >= r.bet_ends_at) return sendJson(res, 400, { error: 'round_closed', message: 'انتهى وقت الرهان — انتظر الجولة التالية' });
      const body = await readBody(req);
      const amount = parseInt(body.amount, 10);
      const picksRaw = body.picks;
      if (!Array.isArray(picksRaw) || picksRaw.length < 1 || picksRaw.length > 10)
        return sendJson(res, 400, { error: 'bad_picks', message: 'اختر من 1 إلى 10 أرقام' });
      const picks = [];
      for (const v of picksRaw) {
        const n = parseInt(v, 10);
        if (!Number.isInteger(n) || n < 1 || n > 80 || picks.indexOf(n) !== -1)
          return sendJson(res, 400, { error: 'bad_picks', message: 'أرقام غير صالحة (1-80، بدون تكرار)' });
        picks.push(n);
      }
      if (!Number.isInteger(amount) || amount < 1 || amount > MAX_SYNC_GOLD)
        return sendJson(res, 400, { error: 'bad_amount', message: 'مبلغ غير صالح' });
      const upd = db.prepare('UPDATE users SET gold = gold - ? WHERE id = ? AND gold >= ?').run(amount, u.id, amount);
      if (upd.changes === 0) return sendJson(res, 400, { error: 'no_funds', message: 'رصيد غير كافٍ' });
      db.prepare('INSERT INTO group_bets (round_id, user_id, username, bet, picks, created_at) VALUES (?,?,?,?,?,?)')
        .run(r.id, u.id, u.username, amount, JSON.stringify(picks), nowS());
      const fresh = db.prepare('SELECT gold FROM users WHERE id = ?').get(u.id);
      broadcast('gr:ke', { type: 'bet', round_no: r.round_no, username: u.username, amount, picks });
      return sendJson(res, 200, { ok: true, gold: fresh.gold, round_no: r.round_no, amount });
    }

    if (p === '/api/games/av/round' && method === 'GET') {
      const u = requireAuth();
      if (!u) return;
      const r = groupRounds.av;
      if (!r) return sendJson(res, 404, { error: 'no_round', message: 'لا جولة نشطة حالياً' });
      const pub = {
        game_id: 'av', round_no: r.round_no, status: r.status,
        bet_ends_at: r.bet_ends_at,
        phase_ends_at: r.status === 'betting' ? r.bet_ends_at : null,
        started_at: r.status === 'flying' ? r.started_at : null,
        seed_hash: r.seed_hash
      };
      if (r.status === 'finished') {
        pub.crash_at = r.outcome.crash_at;
        pub.result = grpRoundResult('av', r);
      }
      const myBets = db.prepare('SELECT bet, cashout_mult, won, payout FROM group_bets WHERE round_id = ? AND user_id = ?').all(r.id, u.id);
      const live = db.prepare('SELECT username, bet, created_at FROM group_bets WHERE round_id = ? ORDER BY id DESC LIMIT 20').all(r.id);
      return sendJson(res, 200, { ok: true, round: pub, my_bets: myBets, live });
    }

    if (p === '/api/games/av/bet' && method === 'POST') {
      const u = requireAuth();
      if (!u) return;
      if (rateLimit(ip, 12, 60_000, 'av_bet')) return sendJson(res, 429, { error: 'rate', message: 'رهانات كثيرة — انتظر قليلاً' });
      const r = groupRounds.av;
      if (!r) return sendJson(res, 404, { error: 'no_round' });
      if (r.status !== 'betting') return sendJson(res, 400, { error: 'round_closed', message: 'انتهى وقت الرهان — انتظر الجولة التالية' });
      if (nowMs() >= r.bet_ends_at) return sendJson(res, 400, { error: 'round_closed', message: 'انتهى وقت الرهان — انتظر الجولة التالية' });
      const body = await readBody(req);
      const amount = parseInt(body.amount, 10);
      if (!Number.isInteger(amount) || amount < 1 || amount > MAX_SYNC_GOLD)
        return sendJson(res, 400, { error: 'bad_amount', message: 'مبلغ غير صالح' });
      const upd = db.prepare('UPDATE users SET gold = gold - ? WHERE id = ? AND gold >= ?').run(amount, u.id, amount);
      if (upd.changes === 0) return sendJson(res, 400, { error: 'no_funds', message: 'رصيد غير كافٍ' });
      db.prepare('INSERT INTO group_bets (round_id, user_id, username, bet, created_at) VALUES (?,?,?,?,?)')
        .run(r.id, u.id, u.username, amount, nowS());
      const fresh = db.prepare('SELECT gold FROM users WHERE id = ?').get(u.id);
      broadcast('gr:av', { type: 'bet', round_no: r.round_no, username: u.username, amount });
      return sendJson(res, 200, { ok: true, gold: fresh.gold, round_no: r.round_no, amount });
    }

    if (p === '/api/games/av/cashout' && method === 'POST') {
      const u = requireAuth();
      if (!u) return;
      if (rateLimit(ip, 8, 60_000, 'av_cash')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — انتظر قليلاً' });
      const r = groupRounds.av;
      if (!r) return sendJson(res, 404, { error: 'no_round' });
      if (r.status !== 'flying') return sendJson(res, 400, { error: 'not_flying', message: 'الجولة ليست في مرحلة الطيران الآن' });
      const bet = db.prepare('SELECT * FROM group_bets WHERE round_id = ? AND user_id = ? AND cashout_mult IS NULL').get(r.id, u.id);
      if (!bet) return sendJson(res, 400, { error: 'no_bet', message: 'لا يوجد رهان نشط للسحب' });
      const crashAt = r.outcome && r.outcome.crash_at ? r.outcome.crash_at : Infinity;
      const mult = Math.exp(0.00006 * (nowMs() - r.started_at));
      /* لا يُسمح بالسحب بعد نقطة الانفجار الخادمية أبداً — المعامل لا يتجاوز crashAt */
      if (!isFinite(mult) || mult < 1 || (crashAt !== Infinity && mult >= crashAt))
        return sendJson(res, 400, { error: 'crashed', message: 'انفجرت الطائرة قبل السحب — حظاً أوفر' });
      const payout = Math.floor(bet.bet * mult);
      db.prepare('UPDATE users SET gold = gold + ? WHERE id = ?').run(payout, u.id);
      db.prepare('UPDATE group_bets SET cashout_mult = ?, won = 1, payout = ? WHERE id = ?').run(mult, payout, bet.id);
      const fresh = db.prepare('SELECT gold FROM users WHERE id = ?').get(u.id);
      broadcast('gr:av', { type: 'cashout', round_no: r.round_no, username: u.username, mult, payout });
      return sendJson(res, 200, { ok: true, gold: fresh.gold, payout, mult });
    }

    /* سجل الجولات الجماعية المنتهية (ببذرة مكشوفة للتحقق Provably Fair) */
    let gmh;
    if ((gmh = /^\/api\/games\/([\w-]+)\/group-history$/.exec(p)) && method === 'GET') {
      const gameId = gmh[1];
      if (gameId !== GROUP_KE && gameId !== GROUP_AV) return sendJson(res, 404, { error: 'not_found' });
      const rows = db.prepare("SELECT * FROM group_rounds WHERE game_id = ? AND status = 'finished' ORDER BY id DESC LIMIT 10").all(gameId);
      const out = rows.map((r) => {
        let outcome = null;
        try { outcome = JSON.parse(r.outcome); } catch (e) { /* ignore */ }
        const agg = db.prepare('SELECT COUNT(*) c, COALESCE(SUM(payout),0) p FROM group_bets WHERE round_id = ? AND won = 1').get(r.id);
        return {
          round_no: r.round_no, seed: r.seed, seed_hash: r.seed_hash,
          outcome, winners_count: agg.c, total_paid: agg.p, created_at: r.created_at
        };
      });
      return sendJson(res, 200, { ok: true, rounds: out });
    }

    /* ── Admin endpoints ── */
    /* دورات الصلاحيات:
       super  → كل شيء (كل المستخدمين، ban، الأدوار، التحكم بالألعاب، المكافآت)
       admin  → لاعبيه فقط (admin_id = u.id): تسجيل/تعديل/شحن/خصم/كلمة مرور + بطولات
                ممنوع: ban، الأدوار، التحكم بالألعاب، رؤية أدمنز/سوبر آخرين
       user   → إرسال كوينز لصديق + إنشاء بطولة (تنتظر موافقة أدمن) + المشاركة */
    let m;

    /* الإحصائيات: السوبر يرى كل شيء؛ الأدمن يرى لاعبيه فقط */
    if (p === '/api/admin/stats' && method === 'GET') {
      const u = requireRole('admin');
      if (!u) return;
      const isSuper = u.role === 'super';
      const scope = isSuper ? '1=1' : 'admin_id = ' + u.id;
      const us = db.prepare('SELECT COUNT(*) c, COALESCE(SUM(gold),0) g, SUM(CASE WHEN banned THEN 1 ELSE 0 END) b FROM users WHERE ' + scope).get();
      const today = nowS() - 86400;
      const act = db.prepare('SELECT COUNT(*) c FROM users WHERE ' + scope + ' AND last_seen >= ?').get(today).c;
      return sendJson(res, 200, {
        ok: true,
        users_total: us.c, gold_total: us.g, banned: us.b,
        plays_total: 0, coins_won_total: 0, active_today: act
      });
    }

    /* قائمة المستخدمين: السوبر الكل؛ الأدمن لاعبيه فقط (ولا يرى أدمنز/سوبر آخرين) */
    if (p === '/api/admin/users' && method === 'GET') {
      const u = requireRole('admin');
      if (!u) return;
      const rows = u.role === 'super'
        ? db.prepare('SELECT * FROM users ORDER BY id').all()
        : db.prepare('SELECT * FROM users WHERE admin_id = ? ORDER BY id').all(u.id);
      return sendJson(res, 200, { ok: true, users: rows.map(publicUser) });
    }

    /* تسجيل لاعب جديد من طرف الأدمن (يُربط به عبر admin_id) — السوبر لا يُلزم بالربط */
    if (p === '/api/admin/register' && method === 'POST') {
      const u = requireRole('admin');
      if (!u) return;
      const body = await readBody(req);
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
        return sendJson(res, 400, { error: 'bad_username', message: 'الاسم: 3-20 حرفاً (حروف/أرقام/_)' });
      if (password.length < 6 || password.length > 128)
        return sendJson(res, 400, { error: 'bad_password', message: 'كلمة المرور: 6 أحرف على الأقل' });
      if (db.prepare('SELECT id FROM users WHERE username = ?').get(username))
        return sendJson(res, 409, { error: 'exists', message: 'الاسم مستخدم بالفعل' });
      const { salt, hash } = hashPassword(password, null);
      const t = nowS();
      const info = db.prepare('INSERT INTO users (username, pass_hash, pass_salt, role, gold, admin_id, lang, created_at, last_seen) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(username, hash, salt, 'user', REGISTER_GOLD, u.id, 'ar', t, t);
      const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
      return sendJson(res, 200, { ok: true, user: publicUser(fresh) });
    }

    /* شحن/خصم كوينز لاعب:
       admin → يخصم/يضيف نفس المبلغ من رصيد الأدمن نفسه (شحن: اللاعب+X والأدمن-X
               خصم: اللاعب-X والأدمن+X) — لاعبيه فقط
       super → يضبط الرصيد مباشرة (لا ينعكس على أحد) */
    if ((m = /^\/api\/admin\/user\/(\d+)\/balance$/.exec(p)) && method === 'POST') {
      const u = requireRole('admin');
      if (!u) return;
      if (rateLimit(ip, 30, 60_000, 'adm_balance')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — انتظر قليلاً' });
      const id = parseInt(m[1], 10);
      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!target) return sendJson(res, 404, { error: 'not_found' });
      if (target.role !== 'user') return sendJson(res, 403, { error: 'not_player', message: 'لا يمكن تعديل رصيد أدمن/سوبر' });
      if (u.role !== 'super' && target.admin_id !== u.id)
        return sendJson(res, 403, { error: 'not_yours', message: 'هذا اللاعب ليس من لاعبيك' });
      const body = await readBody(req);
      if (u.role === 'super') {
        /* السوبر: ضبط مطلق */
        let gold = parseInt(body.gold, 10);
        if (Number.isNaN(gold) || gold < 0) return sendJson(res, 400, { error: 'bad_gold' });
        if (gold > MAX_SYNC_GOLD) gold = MAX_SYNC_GOLD;
        db.prepare('UPDATE users SET gold = ? WHERE id = ?').run(gold, id);
        return sendJson(res, 200, { ok: true, gold, admin_after: u.gold });
      }
      /* الأدمن: شحن (charge) أو خصم (deduct) مع انعكاس على رصيده */
      const action = String(body.action || 'charge');
      const amount = parseInt(body.amount, 10);
      if (Number.isNaN(amount) || amount <= 0 || amount > MAX_SYNC_GOLD)
        return sendJson(res, 400, { error: 'bad_amount', message: 'المبلغ غير صالح' });
      const adminRow = db.prepare('SELECT gold FROM users WHERE id = ?').get(u.id);
      if (action === 'charge') {
        const upd = db.prepare('UPDATE users SET gold = gold - ? WHERE id = ? AND gold >= ?').run(amount, u.id, amount);
        if (upd.changes === 0)
          return sendJson(res, 400, { error: 'no_funds', message: 'رصيدك لا يكفي لشحن هذا المبلغ' });
        db.prepare('UPDATE users SET gold = MIN(gold + ?, ?) WHERE id = ?').run(amount, MAX_SYNC_GOLD, id);
        const adminAfter = db.prepare('SELECT gold FROM users WHERE id = ?').get(u.id).gold;
        return sendJson(res, 200, { ok: true, action: 'charge', amount, gold: Math.min(target.gold + amount, MAX_SYNC_GOLD), admin_after: adminAfter });
      }
      if (action === 'deduct') {
        const upd = db.prepare('UPDATE users SET gold = gold - ? WHERE id = ? AND gold >= ?').run(amount, id, amount);
        if (upd.changes === 0)
          return sendJson(res, 400, { error: 'no_funds', message: 'رصيد اللاعب لا يكفي للخصم' });
        db.prepare('UPDATE users SET gold = gold + ? WHERE id = ?').run(amount, u.id);
        const adminAfter = db.prepare('SELECT gold FROM users WHERE id = ?').get(u.id).gold;
        return sendJson(res, 200, { ok: true, action: 'deduct', amount, gold: target.gold - amount, admin_after: adminAfter });
      }
      return sendJson(res, 400, { error: 'bad_action', message: 'action يجب أن يكون charge أو deduct' });
    }

    /* تعديل كلمة مرور لاعب (للأدمن: لاعبيه فقط) — تعديل الحسابات المسجلة من طرفه */
    if ((m = /^\/api\/admin\/user\/(\d+)\/password$/.exec(p)) && method === 'POST') {
      const u = requireRole('admin');
      if (!u) return;
      if (rateLimit(ip, 30, 60_000, 'adm_pw')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — انتظر قليلاً' });
      const id = parseInt(m[1], 10);
      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!target) return sendJson(res, 404, { error: 'not_found' });
      if (u.role !== 'super' && target.admin_id !== u.id)
        return sendJson(res, 403, { error: 'not_yours', message: 'هذا اللاعب ليس من لاعبيك' });
      const body = await readBody(req);
      const password = String(body.password || '');
      if (password.length < 6 || password.length > 128) return sendJson(res, 400, { error: 'bad_password', message: 'كلمة المرور: 6 أحرف على الأقل' });
      const { salt, hash } = hashPassword(password, null);
      db.prepare('UPDATE users SET pass_hash = ?, pass_salt = ? WHERE id = ?').run(hash, salt, id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
      return sendJson(res, 200, { ok: true });
    }

    /* إيقاف/إلغاء إيقاف حساب: السوبر فقط (الأدمن لا يمكنه توقيف حساب) */
    if ((m = /^\/api\/admin\/user\/(\d+)\/ban$/.exec(p)) && method === 'POST') {
      const u = requireRole('super');
      if (!u) return;
      if (rateLimit(ip, 30, 60_000, 'adm_ban')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — انتظر قليلاً' });
      const id = parseInt(m[1], 10);
      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!target) return sendJson(res, 404, { error: 'not_found' });
      if (id === u.id) return sendJson(res, 400, { error: 'self', message: 'لا يمكنك إيقاف حسابك' });
      const body = await readBody(req);
      db.prepare('UPDATE users SET banned = ? WHERE id = ?').run(body.banned ? 1 : 0, id);
      if (body.banned) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
      return sendJson(res, 200, { ok: true, banned: !!body.banned });
    }

    if ((m = /^\/api\/admin\/user\/(\d+)\/role$/.exec(p)) && method === 'POST') {
      const u = requireRole('super');
      if (!u) return;
      if (rateLimit(ip, 30, 60_000, 'adm_role')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — انتظر قليلاً' });
      const id = parseInt(m[1], 10);
      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!target) return sendJson(res, 404, { error: 'not_found' });
      if (id === u.id) return sendJson(res, 400, { error: 'self', message: 'لا يمكن تغيير دورك بنفسك' });
      const role = String((await readBody(req)).role || '');
      if (!/^(user|admin|super)$/.test(role)) return sendJson(res, 400, { error: 'bad_role' });
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
      return sendJson(res, 200, { ok: true, role });
    }

    /* التحكم في الألعاب (تعطيل/تفعيل) والمكافآت: السوبر فقط — الأدمن لا يتحكم في الألعاب */
    if (p === '/api/admin/games' && method === 'GET') {
      const u = requireRole('super');
      if (!u) return;
      const keys = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'game_enabled_%'").all();
      const enabled = {};
      for (const k of keys) enabled[k.key.replace('game_enabled_', '')] = k.value === '1';
      return sendJson(res, 200, { ok: true, games: enabled });
    }

    if ((m = /^\/api\/admin\/games\/([\w-]+)\/toggle$/.exec(p)) && method === 'POST') {
      const u = requireRole('super');
      if (!u) return;
      if (rateLimit(ip, 30, 60_000, 'adm_game_toggle')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — انتظر قليلاً' });
      const id = m[1];
      const body = await readBody(req);
      const enabled = body.enabled ? '1' : '0';
      setSetting('game_enabled_' + id, enabled);
      return sendJson(res, 200, { ok: true, game: id, enabled: enabled === '1' });
    }

    if (p === '/api/admin/rewards' && method === 'GET') {
      const u = requireRole('super');
      if (!u) return;
      return sendJson(res, 200, {
        ok: true,
        amount: parseInt(setting('daily_amount', '100'), 10) || 100,
        interval_hours: parseInt(setting('daily_interval_hours', '24'), 10) || 24
      });
    }

    if (p === '/api/admin/rewards' && method === 'POST') {
      const u = requireRole('super');
      if (!u) return;
      if (rateLimit(ip, 30, 60_000, 'adm_rewards')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — انتظر قليلاً' });
      const body = await readBody(req);
      const amount = parseInt(body.amount, 10);
      const interval = parseInt(body.interval_hours, 10);
      if (Number.isNaN(amount) || amount < 0 || amount > 1_000_000) return sendJson(res, 400, { error: 'bad_amount' });
      if (Number.isNaN(interval) || interval < 1 || interval > 720) return sendJson(res, 400, { error: 'bad_interval' });
      setSetting('daily_amount', amount);
      setSetting('daily_interval_hours', interval);
      return sendJson(res, 200, { ok: true, amount, interval_hours: interval });
    }

    if (p === '/api/admin/stats/games' && method === 'GET') {
      const u = requireRole('super');
      if (!u) return;
      const rows = db.prepare('SELECT * FROM game_stats ORDER BY plays DESC').all();
      return sendJson(res, 200, { ok: true, games: rows });
    }

    /* ── إرسال الكوينز لصديق (لاعب مسجّل) ── */
    if (p === '/api/transfer' && method === 'POST') {
      const u = requireAuth();
      if (!u) return;
      if (rateLimit('tr:' + u.id, 10, 60_000)) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — حاول لاحقاً' });
      const body = await readBody(req);
      const toName = String(body.to || '').trim();
      const amount = parseInt(body.amount, 10);
      if (!toName) return sendJson(res, 400, { error: 'bad_to', message: 'اسم المستلم مطلوب' });
      if (Number.isNaN(amount) || amount <= 0) return sendJson(res, 400, { error: 'bad_amount', message: 'المبلغ غير صالح' });
      if (toName === u.username) return sendJson(res, 400, { error: 'self', message: 'لا يمكنك إرسال كوينز لنفسك' });
      const target = db.prepare('SELECT * FROM users WHERE username = ?').get(toName);
      if (!target) return sendJson(res, 404, { error: 'not_found', message: 'المستخدم غير موجود' });
      if (target.banned) return sendJson(res, 403, { error: 'banned_target', message: 'المستخدم موقوف' });
      if (u.gold < amount) return sendJson(res, 400, { error: 'no_funds', message: 'رصيدك لا يكفي' });
      if (amount > MAX_SYNC_GOLD) return sendJson(res, 400, { error: 'bad_amount', message: 'المبلغ كبير جداً' });
      const t = nowS();
      const upd = db.prepare('UPDATE users SET gold = gold - ? WHERE id = ? AND gold >= ?').run(amount, u.id, amount);
      if (upd.changes === 0) return sendJson(res, 400, { error: 'no_funds', message: 'رصيدك لا يكفي' });
      db.prepare('UPDATE users SET gold = MIN(gold + ?, ?) WHERE id = ?').run(amount, MAX_SYNC_GOLD, target.id);
      db.prepare('INSERT INTO transfers (from_id, from_name, to_id, to_name, amount, created_at) VALUES (?,?,?,?,?,?)')
        .run(u.id, u.username, target.id, target.username, amount, t);
      broadcast('transfer', { from: u.username, to: target.username, amount, created_at: t });
      return sendJson(res, 200, { ok: true, amount, to: target.username });
    }

    /* ── سجل تحويلاتي (آخر 30) ── */
    if (p === '/api/transfers' && method === 'GET') {
      const u = requireAuth();
      if (!u) return;
      const rows = db.prepare(
        'SELECT from_id, from_name, to_id, to_name, amount, created_at FROM transfers WHERE from_id = ? OR to_id = ? ORDER BY id DESC LIMIT 30'
      ).all(u.id, u.id);
      return sendJson(res, 200, { ok: true, transfers: rows });
    }

    /* ── البطولات ── */
    const GAME_IDS_ALLOWED = new Set(['rn', 'rp', 'pn', 'pr', 'ke', 'av', 'rl', 'bj', 'bc']);
    function tourneyState(t) {
      const players = db.prepare(
        'SELECT u.id, u.username, tp.joined_at FROM tournament_players tp JOIN users u ON u.id = tp.user_id WHERE tp.tournament_id = ? ORDER BY tp.joined_at'
      ).all(t.id);
      return {
        id: t.id,
        name: t.name,
        game_id: t.game_id,
        owner_id: t.owner_id,
        owner_name: t.owner_name,
        prize: t.prize,
        max_players: t.max_players,
        entry_fee: t.entry_fee,
        status: t.status,
        created_at: t.created_at,
        starts_at: t.starts_at,
        players_count: players.length,
        players: players
      };
    }

    /* قائمة البطولات (الكل يرى البطولات المقبولة/الجارية/المنتهية + صاحبها يرى بطولاته) */
    if (p === '/api/tournaments' && method === 'GET') {
      const u = requireAuth();
      if (!u) return;
      const rows = u.role !== 'user'
        ? db.prepare("SELECT * FROM tournaments ORDER BY status = 'pending' DESC, created_at DESC").all()
        : db.prepare("SELECT * FROM tournaments WHERE status != 'rejected' ORDER BY status = 'pending' DESC, created_at DESC").all();
      return sendJson(res, 200, { ok: true, tournaments: rows.map(tourneyState) });
    }

    /* إنشاء بطولة: اللاعب (pending بانتظار موافقة أدمن) أو الأدمن/السوبر (approved فوراً) */
    if (p === '/api/tournaments' && method === 'POST') {
      const u = requireAuth();
      if (!u) return;
      if (rateLimit(ip, 10, 60_000, 'tourney_create')) return sendJson(res, 429, { error: 'rate', message: 'بطولات كثيرة — انتظر قليلاً' });
      const body = await readBody(req);
      const name = String(body.name || '').trim().slice(0, 60);
      const game_id = String(body.game_id || '').trim();
      if (!name) return sendJson(res, 400, { error: 'bad_name', message: 'اسم البطولة مطلوب' });
      if (!GAME_IDS_ALLOWED.has(game_id)) return sendJson(res, 400, { error: 'bad_game', message: 'لعبة غير مدعومة للبطولات' });
      const mp = parseInt(body.max_players, 10);
      const max_players = Number.isNaN(mp) || mp < 2 || mp > 16 ? 8 : mp;
      const ef = parseInt(body.entry_fee, 10);
      const entry_fee = Number.isNaN(ef) || ef < 0 ? 0 : Math.min(ef, MAX_SYNC_GOLD);
      if (u.role === 'user' && entry_fee > 0 && u.gold < entry_fee)
        return sendJson(res, 400, { error: 'no_funds', message: 'رصيدك لا يكفي لرسوم الدخول' });
      const id = crypto.randomUUID();
      const t = nowS();
      const status = u.role === 'user' ? 'pending' : 'approved';
      db.prepare('INSERT INTO tournaments (id, name, game_id, owner_id, owner_name, prize, max_players, entry_fee, status, created_at, starts_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(id, name, game_id, u.id, u.username, 0, max_players, entry_fee, status, t, t);
      db.prepare('INSERT INTO tournament_players (tournament_id, user_id, joined_at) VALUES (?,?,?)').run(id, u.id, t);
      /* رسوم الدخول تذهب لخزينة البطولة (prize) — خصم ذري مشروط بالرصيد */
      if (entry_fee > 0) {
        const upd = db.prepare('UPDATE users SET gold = gold - ? WHERE id = ? AND gold >= ?').run(entry_fee, u.id, entry_fee);
        if (upd.changes === 0) {
          db.prepare('DELETE FROM tournament_players WHERE tournament_id = ?').run(id);
          return sendJson(res, 400, { error: 'no_funds', message: 'رصيدك لا يكفي لرسوم الدخول' });
        }
        db.prepare('UPDATE tournaments SET prize = prize + ? WHERE id = ?').run(entry_fee, id);
      }
      broadcast('tourney', { id, name, status, created_at: t });
      return sendJson(res, 200, { ok: true, tournament: tourneyState(db.prepare('SELECT * FROM tournaments WHERE id = ?').get(id)) });
    }

    /* مشاركة لاعب مسجّل في بطولة (أو انسحاب) */
    if (p === '/api/tournaments/join' && method === 'POST') {
      const u = requireAuth();
      if (!u) return;
      if (rateLimit(ip, 20, 60_000, 'tourney_join')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — انتظر قليلاً' });
      const body = await readBody(req);
      const id = String(body.id || '');
      const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(id);
      if (!t) return sendJson(res, 404, { error: 'not_found', message: 'البطولة غير موجودة' });
      if (t.status !== 'approved' && t.status !== 'pending') return sendJson(res, 400, { error: 'not_open', message: 'البطولة غير مفتوحة للمشاركة' });
      const already = db.prepare('SELECT 1 FROM tournament_players WHERE tournament_id = ? AND user_id = ?').get(id, u.id);
      if (already) return sendJson(res, 200, { ok: true, tournament: tourneyState(t) });
      const cnt = db.prepare('SELECT COUNT(*) c FROM tournament_players WHERE tournament_id = ?').get(id).c;
      if (cnt >= t.max_players) return sendJson(res, 400, { error: 'full', message: 'البطولة ممتلئة' });
      if (t.entry_fee > 0) {
        const upd = db.prepare('UPDATE users SET gold = gold - ? WHERE id = ? AND gold >= ?').run(t.entry_fee, u.id, t.entry_fee);
        if (upd.changes === 0) return sendJson(res, 400, { error: 'no_funds', message: 'رصيدك لا يكفي لرسوم الدخول' });
        db.prepare('UPDATE tournaments SET prize = prize + ? WHERE id = ?').run(t.entry_fee, id);
      }
      db.prepare('INSERT INTO tournament_players (tournament_id, user_id, joined_at) VALUES (?,?,?)').run(id, u.id, nowS());
      const fresh = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(id);
      broadcast('tourney', { id, name: t.name, joined: u.username });
      return sendJson(res, 200, { ok: true, tournament: tourneyState(fresh) });
    }

    /* موافقة/رفض بطولة: الأدمن أو السوبر (pending → approved/rejected) */
    if ((m = /^\/api\/admin\/tournaments\/([\w-]+)\/(approve|reject)$/.exec(p)) && method === 'POST') {
      const u = requireRole('admin');
      if (!u) return;
      if (rateLimit(ip, 30, 60_000, 'adm_tourney')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — انتظر قليلاً' });
      const id = m[1];
      const decision = m[2];
      const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(id);
      if (!t) return sendJson(res, 404, { error: 'not_found', message: 'البطولة غير موجودة' });
      if (t.status !== 'pending') return sendJson(res, 400, { error: 'not_pending', message: 'البطولة لم تعد قيد الانتظار' });
      const status = decision === 'approve' ? 'approved' : 'rejected';
      db.prepare('UPDATE tournaments SET status = ?, approved_by = ? WHERE id = ?').run(status, u.id, id);
      /* رفض → إرجاع رسوم الدخول للمشاركين */
      if (status === 'rejected' && t.entry_fee > 0) {
        db.prepare('UPDATE users SET gold = gold + ? WHERE id IN (SELECT user_id FROM tournament_players WHERE tournament_id = ?)').run(t.entry_fee, id);
      }
      broadcast('tourney', { id, name: t.name, status });
      return sendJson(res, 200, { ok: true, status });
    }

    /* بدء البطولة (approved → active): الأدمن/السوبر */
    if ((m = /^\/api\/admin\/tournaments\/([\w-]+)\/start$/.exec(p)) && method === 'POST') {
      const u = requireRole('admin');
      if (!u) return;
      if (rateLimit(ip, 30, 60_000, 'adm_tourney')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — انتظر قليلاً' });
      const id = m[1];
      const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(id);
      if (!t) return sendJson(res, 404, { error: 'not_found', message: 'البطولة غير موجودة' });
      if (t.status !== 'approved') return sendJson(res, 400, { error: 'not_approved', message: 'البطولة غير معتمدة' });
      db.prepare("UPDATE tournaments SET status = 'active', starts_at = ? WHERE id = ?").run(nowS(), id);
      broadcast('tourney', { id, name: t.name, status: 'active' });
      return sendJson(res, 200, { ok: true, status: 'active' });
    }

    /* إنهاء البطولة وتوزيع الجائزة (active → finished): الأدمن/السوبر */
    if ((m = /^\/api\/admin\/tournaments\/([\w-]+)\/finish$/.exec(p)) && method === 'POST') {
      const u = requireRole('admin');
      if (!u) return;
      if (rateLimit(ip, 30, 60_000, 'adm_tourney')) return sendJson(res, 429, { error: 'rate', message: 'طلبات كثيرة — انتظر قليلاً' });
      const id = m[1];
      const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(id);
      if (!t) return sendJson(res, 404, { error: 'not_found', message: 'البطولة غير موجودة' });
      if (t.status !== 'active') return sendJson(res, 400, { error: 'not_active', message: 'البطولة ليست نشطة' });
      const body = await readBody(req);
      const winnerId = parseInt(body.winner_id, 10);
      const winner = db.prepare('SELECT * FROM users WHERE id = ?').get(winnerId);
      if (!winner) return sendJson(res, 400, { error: 'bad_winner', message: 'الفائز غير موجود' });
      if (t.prize > 0) db.prepare('UPDATE users SET gold = MIN(gold + ?, ?) WHERE id = ?').run(t.prize, MAX_SYNC_GOLD, winnerId);
      db.prepare("UPDATE tournaments SET status = 'finished' WHERE id = ?").run(id);
      broadcast('tourney', { id, name: t.name, status: 'finished', winner: winner.username });
      return sendJson(res, 200, { ok: true, status: 'finished', prize: t.prize, winner: winner.username });
    }

    return sendJson(res, 404, { error: 'not_found', message: 'المسار غير موجود' });
  } catch (err) {
    if (err && err.code === 'PAYLOAD_TOO_LARGE') return sendJson(res, 413, { error: 'payload_too_large', message: 'حجم الطلب أكبر من المسموح' });
    if (err && err.code === 'BAD_JSON') return sendJson(res, 400, { error: 'bad_json', message: 'JSON غير صالح' });
    console.error('[api]', err);
    sendJson(res, 500, { error: 'server_error', message: String(err.message || err) });
  }
});

/* ── Static file serving ──────────────────────────────────── */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.webmanifest': 'application/manifest+json'
};

function serveStatic(req, res, p) {
  let rel = p === '/' ? '/index.html' : p;
  const filePath = path.normalize(path.join(ROOT, rel));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT' || err.code === 'EISDIR') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500); res.end('500');
      }
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    /* في التطوير: لا تخزين مؤقت للـ html/js/css حتى تصل التعديلات فوراً */
    const noCache = ext === '.html' || ext === '.js' || ext === '.css';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': noCache ? 'no-cache' : 'public, max-age=3600'
    });
    res.end(data);
  });
}

/* ── تشغيل جولات كينو وكراش الجماعية ────────────────────────── */
groupStartAll();

api.listen(PORT, '0.0.0.0', () => {
  console.log(`[digital-moroccan-casino] server listening on http://0.0.0.0:${PORT} (DB: ${DB_PATH})`);
});
