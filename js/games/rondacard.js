/* ═════════════════════════════════════════════════════════
   Digital Moroccan Casino — روندا الكلاسيكية (rd)
   نقل حرفي أمين لمحرك RondaCore v1 (C# — server-authoritative core)
   المرجع: RondaCore_v1.zip — RondaGame.cs / CaptureResolver.cs /
   ScoringEngine.cs / DeclarationResolver.cs / RondaRulesConfig.cs
   ───────────────────────────────────────────────────────────
   • 40 ورقة: 1..7,10,11,12 × (أورو/كوبة/سيف/عصا) — لا 8 ولا 9
   • توزيع 3 لكل لاعب + 4 على الطاولة؛ يبدأ من يلي الموزّع
   • الأسر: نفس الرتبة + سلسلة متتالية 1→2→…→7→10→11→12
   • ميسة +1 عند تفريغ الطاولة؛ ضربة +1؛ حبل +5؛ حبل مزدوج +10
   • إعلانات التوزيعة الأولى: روندا(زوج)=1، تريندا(ثلاثية)=3، كوادرا=4
   • بقايا الطاولة لآخر آسر + قاعدة الورقة الأخيرة (12 للموزّع/آس للخصم = +5)
   • أغلبية الأوراق: ما فوق 20 ورقة = نقاط؛ الهدف 41/51/61
   ═════════════════════════════════════════════════════════ */
'use strict';

/* ── الرتب بترتيب السلسلة (7 → 10 متتاليتان) ── */
const RD_RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
const RD_SUITS = ['oros', 'copas', 'espadas', 'bastos'];
const RD_SUIT_AR = { oros: 'الذهب', copas: 'الكيسان', espadas: 'السيوف', bastos: 'الزراوط' };

function rdNextRank(rank) {
  const i = RD_RANKS.indexOf(rank);
  return (i >= 0 && i < RD_RANKS.length - 1) ? RD_RANKS[i + 1] : null;
}

/* ── بذرة حتمية (mulberry32) — نفس مبدأ SeededRng ── */
function rdMulberry32(a) {
  a |= 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── RondaDeckFactory.Create + DeckShuffler.Shuffle (Fisher-Yates) ── */
function rdCreateDeck() {
  const deck = [];
  let id = 0;
  for (const suit of RD_SUITS) for (const rank of RD_RANKS) deck.push({ id: id++, rank, suit });
  return deck;
}
function rdShuffle(cards, rng) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = cards[i]; cards[i] = cards[j]; cards[j] = t;
  }
}

/* ── CaptureResolver.Resolve — حرفي ── */
function rdResolveCapture(played, table) {
  if (!table.some(c => c.rank === played.rank)) return [];
  const result = [played];
  let current = played.rank;
  for (;;) {
    const same = table.filter(c => c.rank === current);
    if (same.length) result.push(...same);
    const next = rdNextRank(current);
    if (next == null) break;
    if (!table.some(c => c.rank === next)) break;
    current = next;
  }
  /* distinct بالمعرف */
  const seen = new Set(); const out = [];
  for (const c of result) { if (!seen.has(c.id)) { seen.add(c.id); out.push(c); } }
  return out;
}

/* ── DeclarationResolver.Evaluate — حرفي ── */
function rdEvaluateDeclarations(player, allowQuadra) {
  const byRank = new Map();
  for (const c of player.hand) {
    if (!byRank.has(c.rank)) byRank.set(c.rank, 0);
    byRank.set(c.rank, byRank.get(c.rank) + 1);
  }
  const decls = [];
  for (const [rank, count] of byRank) {
    if (count === 4 && allowQuadra) decls.push({ playerId: player.id, rank, type: 'quadra', points: 4 });
    else if (count === 3) decls.push({ playerId: player.id, rank, type: 'trenda', points: 3 });
    else if (count === 2) decls.push({ playerId: player.id, rank, type: 'ronda', points: 1 });
  }
  return decls;
}

/* ═══════════ RondaGame — المحرك (نقل RondaGame.cs) ═══════════ */
class RondaCardEngine {
  /* players: [{id, seat, teamId}]، rules: RondaRulesConfig */
  constructor(players, dealerSeat, seed, rules) {
    this.rules = Object.assign({
      cardsPerDeal: 3, initialTableCards: 4,
      mesaPoints: 1, strikePoints: 1, ropePoints: 5, doubleRopePoints: 10,
      cardsScoreThreshold: 20,
      dealerTwelveBonus: 5, opponentAceBonus: 5,
      targetScore: 41, allowQuadra: true
    }, rules || {});
    this.rng = rdMulberry32(seed | 0);
    this.phase = 'WaitingForPlayers';
    this.dealerSeat = dealerSeat;
    this.currentSeat = 0;
    this.lastPlayedCard = null;
    this.lastPlayerWhoCaptured = -1;
    this.playedInDeal = 0;
    this.deck = [];
    this.table = [];
    this.players = players.map(p => ({ id: p.id, seat: p.seat, teamId: p.teamId, hand: [], captured: [] }));
    this.teams = [];
    for (const p of this.players) {
      let t = this.teams.find(x => x.id === p.teamId);
      if (!t) { t = { id: p.teamId, score: 0, playerIds: [] }; this.teams.push(t); }
      t.playerIds.push(p.id);
    }
    this.strike = { seq: 'None', rank: null, originalPlayerId: -1, responderPlayerId: -1 };
    this.events = [];   /* سجل أحداث للواجهة */
    this.roundNo = 1;
    this.winnerTeam = null;
  }
  emit(type, data) { this.events.push(Object.assign({ type }, data || {})); }
  getPlayer(id) { return this.players.find(p => p.id === id); }
  getPlayerBySeat(seat) { return this.players.find(p => p.seat === seat); }
  getTeam(id) { return this.teams.find(t => t.id === id); }
  addTeamScore(teamId, pts, why) {
    const t = this.getTeam(teamId);
    t.score += pts;
    this.emit('score', { teamId, points: pts, total: t.score, why });
  }
  draw() { return this.deck.pop(); }
  /* ترتيب التوزيع: يبدأ ممن يلي الموزّع */
  dealOrder() {
    const ordered = this.players.slice().sort((a, b) => a.seat - b.seat);
    const start = (this.dealerSeat + 1) % ordered.length;
    const out = [];
    for (let i = 0; i < ordered.length; i++) out.push(ordered[(start + i) % ordered.length]);
    return out;
  }
  start() {
    if (this.phase !== 'WaitingForPlayers') return;
    this.deck = rdCreateDeck();
    rdShuffle(this.deck, this.rng);
    this.phase = 'InitialDeal';
    this._dealInitial();
    this.currentSeat = (this.dealerSeat + 1) % this.players.length;
    this.phase = 'Declaration';
    this._evalDeclarations();
    this.phase = 'Playing';
  }
  _dealInitial() {
    for (let i = 0; i < this.rules.cardsPerDeal; i++)
      for (const p of this.dealOrder()) p.hand.push(this.draw());
    for (let i = 0; i < this.rules.initialTableCards; i++) this.table.push(this.draw());
  }
  _dealNextHands() {
    this.phase = 'Redeal';
    for (let i = 0; i < this.rules.cardsPerDeal; i++)
      for (const p of this.dealOrder()) { if (!this.deck.length) break; p.hand.push(this.draw()); }
    this.playedInDeal = 0;
    this.currentSeat = (this.dealerSeat + 1) % this.players.length;
    this.phase = 'Playing';
    this.emit('redeal', {});
  }
  /* [قواعد الوثيقة] الإعلانات عند بداية توزيع الجولة: روندا(زوج)=1، تريندا(3)=3.
     «الكبيرة تفوز على الجميع»: صاحب الإعلان الأقوى (النوع ثم الرتبة) وحده يسجّل،
     ويفوز بمجموع نقاط كل الإعلانات المتشابهة عند جميع اللاعبين. */
  _evalDeclarations() {
    const all = [];
    for (const p of this.players) {
      for (const d of rdEvaluateDeclarations(p, this.rules.allowQuadra)) {
        all.push({ player: p, d });
        this.emit('declaration', { playerId: p.id, rank: d.rank, declType: d.type, points: d.points });
      }
    }
    if (!all.length) return;
    const strength = (x) => x.d.points * 100 + x.d.rank;   /* النوع أولاً ثم الرتبة الأعلى */
    all.sort((a, b) => strength(b) - strength(a));
    const winner = all[0];
    const total = all.reduce((s, x) => s + x.d.points, 0);
    this.addTeamScore(winner.player.teamId, total, 'declWin');
    this.emit('declWin', { playerId: winner.player.id, rank: winner.d.rank, declType: winner.d.type, total });
  }
  legalCards(playerId) {
    const p = this.getPlayer(playerId);
    return (this.phase === 'Playing' && p.seat === this.currentSeat) ? p.hand.slice() : [];
  }
  /* PlayCard — حرفي مع أحداث الواجهة */
  playCard(playerId, cardId) {
    if (this.phase !== 'Playing') return { ok: false, error: 'not-playing' };
    const player = this.getPlayer(playerId);
    if (!player || player.seat !== this.currentSeat) return { ok: false, error: 'not-your-turn' };
    const idx = player.hand.findIndex(c => c.id === cardId);
    if (idx < 0) return { ok: false, error: 'not-in-hand' };
    const card = player.hand[idx];
    this.emit('played', { playerId, card });

    const isStrike = this.lastPlayedCard && this.lastPlayedCard.rank === card.rank && this.strike.seq === 'None';
    const capture = rdResolveCapture(card, this.table);
    player.hand.splice(idx, 1);

    if (capture.length === 0) {
      this.table.push(card);
    } else {
      const tableBefore = this.table.length;
      const capturedTable = capture.filter(c => c.id !== card.id);
      const capIds = new Set(capturedTable.map(c => c.id));
      this.table = this.table.filter(c => !capIds.has(c.id));
      player.captured.push(card, ...capturedTable);
      this.lastPlayerWhoCaptured = player.id;
      this.emit('captured', { playerId, cards: capture.slice() });
      if (capturedTable.length === tableBefore) {
        this.addTeamScore(player.teamId, this.rules.mesaPoints, 'mesa');
        this.emit('mesa', { playerId });
      }
    }

    this._resolveSpecial(player, card, isStrike);
    this.lastPlayedCard = card;
    this.playedInDeal++;

    if (this.players.every(p => p.hand.length === 0)) {
      if (this.deck.length > 0) { this._dealNextHands(); return { ok: true, redeal: true }; }
      this._finalizeRound();
      return { ok: true, roundEnd: true };
    }
    this.currentSeat = (this.currentSeat + 1) % this.players.length;
    return { ok: true };
  }
  /* ResolveSpecialSequence — حرفي (ضربة/حبل/حبل مزدوج) */
  _resolveSpecial(player, card, isStrike) {
    if (isStrike) {
      this.strike.seq = 'Strike';
      this.strike.rank = card.rank;
      const orig = this.players.find(p => p.id !== player.id && this.lastPlayedCard && this.lastPlayedCard.rank === card.rank);
      this.strike.originalPlayerId = orig ? orig.id : -1;
      this.strike.responderPlayerId = player.id;
      this.addTeamScore(player.teamId, this.rules.strikePoints, 'strike');
      this.emit('strike', { playerId: player.id, rank: card.rank });
      return;
    }
    if (this.strike.seq === 'Strike' && this.strike.rank === card.rank && this.strike.originalPlayerId === player.id) {
      this.addTeamScore(player.teamId, this.rules.ropePoints, 'rope');
      this.emit('rope', { playerId: player.id, rank: card.rank });
      const hasFourth = player.hand.some(c => c.rank === card.rank);
      this.strike.seq = hasFourth ? 'Rope' : 'None';
      return;
    }
    if (this.strike.seq === 'Rope' && this.strike.rank === card.rank && this.strike.originalPlayerId === player.id) {
      this.addTeamScore(player.teamId, this.rules.doubleRopePoints, 'doublerope');
      this.strike.seq = 'DoubleRope';
      this.emit('doublerope', { playerId: player.id, rank: card.rank });
    }
  }
  /* FinalizeRound + ApplyFinalCardRules + ApplyCardMajority — حرفي */
  _finalizeRound() {
    this.phase = 'FinalCapture';
    if (this.table.length > 0 && this.lastPlayerWhoCaptured >= 0) {
      const last = this.getPlayer(this.lastPlayerWhoCaptured);
      const remaining = this.table.slice();
      last.captured.push(...remaining);
      this.table = [];
      this.emit('finalTake', { playerId: last.id, cards: remaining });
      /* قاعدة الورقة الأخيرة */
      const dealer = this.getPlayerBySeat(this.dealerSeat);
      if (remaining.length > 0) {
        const finalCard = remaining[remaining.length - 1];
        if (last.id === dealer.id && finalCard.rank === 12) {
          this.addTeamScore(dealer.teamId, this.rules.dealerTwelveBonus, 'dealer12');
        } else if (last.id !== dealer.id && finalCard.rank === 1) {
          this.addTeamScore(last.teamId, this.rules.opponentAceBonus, 'lastAce');
        }
      }
    }
    this.phase = 'Scoring';
    /* أغلبية الأوراق لكل فريق */
    for (const team of this.teams) {
      const cards = this.players.filter(p => p.teamId === team.id).reduce((n, p) => n + p.captured.length, 0);
      const pts = Math.max(0, cards - this.rules.cardsScoreThreshold);
      if (pts > 0) this.addTeamScore(team.id, pts, 'cards');
    }
    this.emit('roundEnd', { roundNo: this.roundNo });
    const winner = this.teams.filter(t => t.score >= this.rules.targetScore).sort((a, b) => b.score - a.score)[0];
    if (winner) {
      this.phase = 'Finished';
      this.winnerTeam = winner.id;
      this.emit('gameEnd', { teamId: winner.id });
      return;
    }
    /* جولة تالية: تدوير الموزّع وإعادة التوزيع */
    this.dealerSeat = (this.dealerSeat + 1) % this.players.length;
    this.roundNo++;
    for (const p of this.players) { p.hand = []; p.captured = []; }
    this.deck = rdCreateDeck();
    rdShuffle(this.deck, this.rng);
    this.table = [];
    this.lastPlayedCard = null;
    this.lastPlayerWhoCaptured = -1;
    this.playedInDeal = 0;
    this.strike = { seq: 'None', rank: null, originalPlayerId: -1, responderPlayerId: -1 };
    this.phase = 'InitialDeal';
    this._dealInitial();
    this.currentSeat = (this.dealerSeat + 1) % this.players.length;
    this.phase = 'Declaration';
    this._evalDeclarations();
    this.phase = 'Playing';
    this.emit('newRound', { roundNo: this.roundNo, dealerSeat: this.dealerSeat });
  }
}

/* ═══════════ الذكاء الاصطناعي الخبير ═══════════ */
const RondaCardAI = {
  pick(engine, player) {
    const hand = engine.legalCards(player.id);
    if (!hand.length) return null;
    let best = null, bestScore = -Infinity;
    for (const c of hand) {
      const cap = rdResolveCapture(c, engine.table);
      let s = 0;
      if (cap.length) {
        s += cap.length * 10;                                     /* كل ورقة مأسورة ثمينة */
        const tableTaken = cap.length - 1;
        if (tableTaken === engine.table.length) s += 14;          /* ميسة */
        /* حبل: أنا صاحب الضربة الأصلي وألعب رتبتها */
        if (engine.strike.seq === 'Strike' && engine.strike.rank === c.rank &&
            engine.strike.originalPlayerId === player.id) s += 45;
        if (engine.strike.seq === 'Rope' && engine.strike.rank === c.rank &&
            engine.strike.originalPlayerId === player.id) s += 90;
      } else {
        /* رمية بلا أسر: قيّم الخطر — هل تفتح للخصم أسراً كبيراً؟ */
        const after = engine.table.concat([c]);
        let danger = 0;
        for (const r of RD_RANKS) {
          const probe = { id: -1, rank: r, suit: 'oros' };
          const oppCap = rdResolveCapture(probe, after);
          if (oppCap.length - 1 > danger) danger = oppCap.length - 1;
        }
        s -= danger * 6;
        /* ضربة محتملة للخصم: نفس رتبة آخر ورقة ملعوبة */
        if (engine.lastPlayedCard && engine.lastPlayedCard.rank === c.rank && engine.strike.seq === 'None') s += 8; /* ضربتي أنا (+1) */
        /* الاحتفاظ بأوراق الزوج (احتمال حبل لاحقاً) */
        const dup = hand.filter(x => x.rank === c.rank).length;
        if (dup >= 2) s -= 5;
        s -= c.rank * 0.1;   /* كسر تعادل حتمي */
      }
      if (s > bestScore) { bestScore = s; best = c; }
    }
    return best;
  }
};

/* ═══════════ الواجهة ═══════════ */
let RD = null;

function eRondaCard(g) {
  return '<div class="stage" id="rdStage">' +
    '<div class="glogo-wm" aria-hidden="true"></div>' +
    /* ── الإعداد ── */
    '<div class="dama-setup" id="rdSetup">' +
      '<div class="dama-set-title">🂡 ' + (T('rd.title') || 'روندا الكلاسيكية') + '</div>' +
      '<div class="dama-field"><div class="dama-flab">' + (T('rd.target') || 'نقاط الفوز') + '</div>' +
        '<div class="dama-chips" id="rdTargetPick"></div></div>' +
      '<div class="dama-field"><div class="dama-flab">' + (T('dama.yourBet') || 'رهانك') + '</div>' +
        '<div class="dama-chips" id="rdBetPick"></div></div>' +
      '<button class="big dama-go" onclick="rondaCardStart()">🎮 ' + (T('dama.startBtn') || 'ابدأ اللعب') + '</button>' +
    '</div>' +
    /* ── الطاولة ── */
    '<div class="rd-board" id="rdBoard" hidden>' +
      '<div class="rd-oppo">' +
        '<span class="bl-av p2">🤖</span>' +
        '<div class="rd-oppo-hand" id="rdOppHand"></div>' +
        '<span class="rd-pile" id="rdOppPile" title="أوراق مأسورة">0</span>' +
      '</div>' +
      '<div class="rd-score" id="rdScore"></div>' +
      '<div class="rd-table" id="rdTable"></div>' +
      '<div class="rd-msg" id="rdMsg"></div>' +
      '<div class="rd-me">' +
        '<span class="rd-pile" id="rdMyPile" title="أوراق مأسورة">0</span>' +
        '<div class="rd-hand" id="rdMyHand"></div>' +
        '<span class="bl-av p1" id="rdMyAv">👤</span>' +
      '</div>' +
      '<div class="bl-minis bl-sr">' +
        '<button class="dama-mini" onclick="rondaCardToSetup()">↩️ ' + (T('dama.newGame') || 'لعبة جديدة') + '</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function initRondaCard() {
  RD = {
    engine: null, bet: 50, target: 41, busy: false,
    msgT: null, over: false
  };
  rdBuildSetup();
}

function rdBuildSetup() {
  const tp = document.getElementById('rdTargetPick');
  if (tp) tp.innerHTML = [41, 51, 61].map(n =>
    '<button class="dama-chip' + (RD.target === n ? ' on' : '') + '" onclick="rondaCardSetTarget(' + n + ')">' + n + '</button>').join('');
  const bp = document.getElementById('rdBetPick');
  if (bp) bp.innerHTML = [10, 50, 100, 250, 500].map((b, i) =>
    '<button class="dama-chip' + (RD.bet === b ? ' on' : '') + '" onclick="rondaCardSetBet(' + b + ')">' + b + ' 🪙</button>').join('');
}
function rondaCardSetTarget(n) { if (RD) { RD.target = n; rdBuildSetup(); SND.click(); } }
function rondaCardSetBet(b) { if (RD) { RD.bet = b; rdBuildSetup(); SND.click(); } }

function rondaCardStart() {
  if (!RD) return;
  if (typeof ST !== 'undefined' && ST.gold < RD.bet) { toast(T('ts.noc') || 'رصيد غير كافٍ', 'err'); return; }
  if (typeof ST !== 'undefined') { ST.gold -= RD.bet; save(); wallet(); }
  const seed = (Math.random() * 0xFFFFFFFF) >>> 0;
  /* 1v1: أنا مقعد 0 فريق 0 — الآلي مقعد 1 فريق 1؛ الموزّع الأول عشوائي حتمي */
  const dealer = seed % 2;
  RD.engine = new RondaCardEngine(
    [{ id: 0, seat: 0, teamId: 0 }, { id: 1, seat: 1, teamId: 1 }],
    dealer, seed, { targetScore: RD.target });
  RD.engine.start();
  RD.over = false; RD.busy = false;
  const su = document.getElementById('rdSetup'), bo = document.getElementById('rdBoard');
  if (su) su.hidden = true;
  if (bo) bo.hidden = false;
  const av = document.getElementById('rdMyAv');
  if (av && typeof AUTH !== 'undefined' && AUTH.user) av.textContent = (AUTH.user.username || 'أنا').slice(-1);
  SND.card();
  rdConsumeEvents();
  rdRender();
  rdMaybeAI();
}
function rondaCardToSetup() {
  if (!RD) return;
  RD.engine = null; RD.over = false;
  const su = document.getElementById('rdSetup'), bo = document.getElementById('rdBoard');
  if (su) su.hidden = false;
  if (bo) bo.hidden = true;
}

function rdSay(t) {
  const el = document.getElementById('rdMsg');
  if (!el) return;
  el.textContent = t;
  el.classList.add('show');
  if (RD.msgT) clearTimeout(RD.msgT);
  RD.msgT = setTimeout(() => el.classList.remove('show'), 2600);
}

function rdCardHTML(c, cls, onclick) {
  return '<div class="rd-card ' + (cls || '') + '"' + (onclick ? ' onclick="' + onclick + '"' : '') +
    ' style="background-image:url(\'assets/cards/es/' + c.rank + '-' + c.suit + '.webp\')"></div>';
}

function rdRender() {
  const e = RD.engine;
  if (!e) return;
  const me = e.getPlayer(0), opp = e.getPlayer(1);
  const myTurn = e.phase === 'Playing' && e.currentSeat === me.seat && !RD.over;
  const hand = document.getElementById('rdMyHand');
  if (hand) hand.innerHTML = me.hand.map(c =>
    rdCardHTML(c, myTurn ? 'live' : '', myTurn ? 'rondaCardPlay(' + c.id + ')' : null)).join('');
  const oh = document.getElementById('rdOppHand');
  if (oh) oh.innerHTML = opp.hand.map(() => '<div class="rd-card back"></div>').join('');
  const tb = document.getElementById('rdTable');
  if (tb) tb.innerHTML = e.table.map(c => rdCardHTML(c, 'tbl')).join('') ||
    '<div class="rd-empty">' + (T('rd.emptyTable') || 'الطاولة فارغة') + '</div>';
  const mp = document.getElementById('rdMyPile'), op = document.getElementById('rdOppPile');
  if (mp) mp.textContent = me.captured.length;
  if (op) op.textContent = opp.captured.length;
  const sc = document.getElementById('rdScore');
  if (sc) {
    const t0 = e.getTeam(0).score, t1 = e.getTeam(1).score;
    const dealerMe = e.dealerSeat === 0;
    sc.innerHTML =
      '<b class="' + (myTurn ? 'rd-on' : '') + '">' + (T('rd.you') || 'أنت') + ' ' + t0 + '</b>' +
      '<span class="rd-target">🎯 ' + e.rules.targetScore + (dealerMe ? ' · 🂠' + (T('rd.dealerYou') || 'أنت الموزّع') : '') + '</span>' +
      '<b class="' + (!myTurn && !RD.over ? 'rd-on' : '') + '">🤖 ' + t1 + '</b>';
  }
}

/* استهلاك أحداث المحرك → أصوات ورسائل */
function rdConsumeEvents() {
  const e = RD.engine;
  if (!e) return;
  const evs = e.events.splice(0);
  for (const ev of evs) {
    switch (ev.type) {
      case 'declaration': {
        const who = ev.playerId === 0 ? (T('rd.you') || 'أنت') : '🤖';
        const nm = ev.declType === 'quadra' ? (T('rd.quadra') || 'كوادرا') : ev.declType === 'trenda' ? (T('rd.trenda') || 'تريندا') : (T('rd.ronda') || 'روندا');
        rdSay('📣 ' + who + ': ' + nm + ' +' + ev.points);
        if (SND.coin) { try { SND.coin(); } catch (er) {} }
        break;
      }
      case 'declWin': {
        const who = ev.playerId === 0 ? (T('rd.you') || 'أنت') : '🤖';
        rdSay('👑 ' + who + ' ' + (T('rd.declWin') || 'يفوز بالإعلانات') + ' +' + ev.total);
        if (SND.coin) { try { SND.coin(); } catch (er) {} }
        break;
      }
      case 'mesa': rdSay('✨ ' + (T('rd.mesa') || 'ميسة!') + ' +1'); if (SND.win) { try { SND.win(); } catch (er) {} } break;
      case 'strike': rdSay('⚡ ' + (T('rd.strike') || 'ضربة!') + ' +1'); break;
      case 'rope': rdSay('🪢 ' + (T('rd.rope') || 'حبل!') + ' +5'); if (SND.win) { try { SND.win(); } catch (er) {} } break;
      case 'doublerope': rdSay('🪢🪢 ' + (T('rd.doubleRope') || 'حبل مزدوج!') + ' +10'); if (SND.win) { try { SND.win(); } catch (er) {} } break;
      case 'redeal': rdSay('🂠 ' + (T('rd.redeal') || 'توزيعة جديدة')); if (SND.card) { try { SND.card(); } catch (er) {} } break;
      case 'newRound': rdSay('🔄 ' + (T('rd.newRound') || 'جولة جديدة') + ' #' + ev.roundNo); break;
      case 'gameEnd': rdGameOver(ev.teamId); break;
    }
  }
}

function rdGameOver(teamId) {
  RD.over = true;
  const won = teamId === 0;
  const w = won ? Math.floor(RD.bet * 1.95) : 0;
  if (won && typeof ST !== 'undefined') { ST.gold += w; save(); wallet(); }
  if (won) { if (SND.win) { try { SND.win(); } catch (er) {} } if (typeof celebrate === 'function') celebrate(true); }
  else if (SND.lose) { try { SND.lose(); } catch (er) {} }
  rdSay(won ? ('🏆 ' + (T('rd.win') || 'فزت بالمباراة!') + ' +' + fmt(w) + ' 🪙') : ('💔 ' + (T('rd.lose') || 'خسرت المباراة')));
  if (typeof recordRound === 'function') { try { recordRound(won, w, won ? 'فوز روندا' : 'خسارة روندا', RD.bet, 'rd'); } catch (er) {} }
}

function rondaCardPlay(cardId) {
  const e = RD && RD.engine;
  if (!e || RD.busy || RD.over) return;
  if (e.phase !== 'Playing' || e.currentSeat !== 0) return;
  const res = e.playCard(0, cardId);
  if (!res.ok) return;
  if (SND.card) { try { SND.card(); } catch (er) {} }
  rdConsumeEvents();
  rdRender();
  rdMaybeAI();
}

function rdMaybeAI() {
  const e = RD && RD.engine;
  if (!e || RD.over || e.phase !== 'Playing') return;
  if (e.currentSeat !== 1) return;
  RD.busy = true;
  setTimeout(() => {
    const en = RD && RD.engine;
    RD.busy = false;
    if (!en || RD.over || en.phase !== 'Playing' || en.currentSeat !== 1) return;
    const pick = RondaCardAI.pick(en, en.getPlayer(1));
    if (!pick) return;
    en.playCard(1, pick.id);
    if (SND.card) { try { SND.card(); } catch (er) {} }
    rdConsumeEvents();
    rdRender();
    rdMaybeAI();   /* توزيعة جديدة قد تعيد الدور للآلي */
  }, 700 + Math.random() * 500);
}

/* ── تصدير ── */
window.RondaCardEngine = RondaCardEngine;
window.RondaCardAI = RondaCardAI;
window.rdResolveCapture = rdResolveCapture;
window.rdEvaluateDeclarations = rdEvaluateDeclarations;
window.rdCreateDeck = rdCreateDeck;
window.eRondaCard = eRondaCard;
window.initRondaCard = initRondaCard;
window.rondaCardStart = rondaCardStart;
window.rondaCardToSetup = rondaCardToSetup;
window.rondaCardPlay = rondaCardPlay;
window.rondaCardSetTarget = rondaCardSetTarget;
window.rondaCardSetBet = rondaCardSetBet;
