/* ═══════════════════════════════════════════
   Digital Moroccan casino — Moroccan Ronda ♦️♠️ Engine
   محرك روندا المغربية — تخمين البطاقة قبل الموزع
   ═══════════════════════════════════════════ */
"use strict";
let RN_ADAPTER = null;

/* ── الرموز المغاربية (أوراق اللعب الإسبانية المغربية) ──
   A = الدنانير (ذهب) ◆   B = الكؤوس ♥   C = السيوف ♠   D = الصولجان ♣ */
const RN_SUITS = {
  A: { glyph: '◆', name: 'suitA', dark: '#F5C518', face: '#C27803' },
  B: { glyph: '♥', name: 'suitB', dark: '#EF4444', face: '#DC2626' },
  C: { glyph: '♠', name: 'suitC', dark: '#CBD5E1', face: '#1E293B' },
  D: { glyph: '♣', name: 'suitD', dark: '#34D399', face: '#059669' }
};
const RN_NUMS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

/* ── الواجهة ── */
function eRonda(g) {
  return '<div class="stage" id="rnContainer"></div>';
}
function initRonda() {
  if (RN_ADAPTER) {
    try { RN_ADAPTER.destroy(); } catch (e) {}
  }
  RN_ADAPTER = new RondaPlatformAdapter();
  RN_ADAPTER.start('rnContainer');
  /* الغرف: وضع جماعي بأدوار دائرية (الموزع/المتخمن/منتظر/مشاهد) */
  if (typeof Rooms !== 'undefined' && Rooms.setGameHandler) {
    Rooms.setGameHandler(RN_roomMove);
    Rooms.setStartHandler(RN_roomStart);
  }
  if (typeof Rooms !== 'undefined' && Rooms.state && Rooms.state.game_id === 'rn') {
    RN_ADAPTER.enterRoom(Rooms.state);
  }
}
/* ── أدوات وضع الغرفة ── */
function rnMe() {
  return (typeof AUTH !== 'undefined' && AUTH.user) ? AUTH.user : null;
}
function rnEsc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
/* دوران دائري: فوز المتخمن → يصبح موزعاً والموزع لآخر الترتيب؛ خسارته → يذهب لآخر الترتيب */
function rnRotate(order, selectorWon) {
  if (!order || order.length < 2) return (order || []).slice();
  if (selectorWon) return order.slice(1).concat(order[0]);
  return [order[0]].concat(order.slice(2)).concat([order[1]]);
}
/* ── فئة الورقة ── */
class Card {
  constructor(n, s, i) {
    this.number = n;
    this.symbol = s;
    this.deckIndex = i;
    this.id = n + '-' + s;
  }
  equals(o) {
    return o && this.number === o.number && this.symbol === o.symbol;
  }
  matchNumber(o) {
    return o && this.number === o.number;
  }
}
/* ── مصنع الأوراق (40 ورقة مغاربية) ── */
class CardFactory {
  static buildDeck() {
    const d = [];
    let idx = 0;
    RN_NUMS.forEach(n => {
      Object.keys(RN_SUITS).forEach(s => {
        d.push(new Card(n, s, idx++));
      });
    });
    return d;
  }
}
/* ── مولد عشوائي ── */
/* PRNG حتمي (mulberry32) لمزامنة المجموعة في الغرف عبر بذرة مشتركة */
function mulberry32(a) {
  a |= 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
class LocalRandomProvider {
  constructor(seed) {
    this._fn = null;
    if (seed !== undefined && seed !== null) this.setSeed(seed);
  }
  setSeed(seed) {
    this._fn = mulberry32(seed >>> 0);
  }
  next(max) {
    if (this._fn) return Math.floor(this._fn() * max);
    return Math.floor(Math.random() * max);
  }
}
/* ── مدير المجموعة ── */
class DeckManager {
  constructor(rng) {
    this.rng = rng;
    this.deck = [];
    this.shuffleId = '';
  }
  createDeck() {
    this.deck = CardFactory.buildDeck();
    this.shuffle();
    return this;
  }
  shuffle() {
    this.shuffleId = 'S-' + Math.random().toString(36).slice(2, 10);
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = this.rng.next(i + 1);
      const t = this.deck[i];
      this.deck[i] = this.deck[j];
      this.deck[j] = t;
    }
  }
  draw() {
    return this.deck.shift();
  }
  remaining() {
    return this.deck.length;
  }
}
/* ── نظام الأحداث ── */
class EventEmitter {
  constructor() {
    this.handlers = {};
  }
  on(e, f) {
    if (!this.handlers[e]) this.handlers[e] = [];
    this.handlers[e].push(f);
  }
  emit(e, d) {
    (this.handlers[e] || []).forEach(f => f(d));
  }
}
/* ── محرك اللعبة ── */
class RondaGame extends EventEmitter {
  constructor(opts) {
    super();
    this.rng = opts.rng || new LocalRandomProvider();
    this.deck = new DeckManager(this.rng);
    this.state = 'BOOT';
    this.mode = null;
    this.myRole = 'selector';
    this.selection = null;
    this.roundId = 0;
    this.bet = 10;
    this.multiplayer = !!opts.multiplayer;
    this._lastWinner = null;
    this._pendingPick = null;
    this.stats = { selectorWins: 0, dealerWins: 0, totalRounds: 0 };
    this.roundResults = []; /* نتائج الجولات من منظور اللاعب */
  }
  start() {
    this.state = 'MAIN_MENU';
    this.emit('STATE_CHANGED', { to: 'MAIN_MENU' });
  }
  chooseMode(m) {
    if (this.dead) return;
    this.mode = m;
    this.state = 'MODE_SELECTION';
    this.emit('MODE_CHOSEN', { mode: m });
    setTimeout(() => this._enterRoleAssignment(), 350);
  }
  _enterRoleAssignment() {
    if (this.dead) return;
    this.state = 'ROLE_ASSIGNMENT';
    this.myRole = 'selector';
    this.emit('ROLE_ASSIGNED', { myRole: this.myRole });
    setTimeout(() => this._enterRoundReady(), 900);
  }
  _enterRoundReady() {
    if (this.dead) return;
    /* وضع الغرفة: لا رهان — الأدوار والجولات يديرها صاحب الغرفة */
    if (!this.multiplayer) {
      /* خصم رهان الجولة — مع فحص الرصيد (إصلاح: سابقاً لم يكن يُخصم شيء عند الخسارة) */
      if (typeof ST !== 'undefined' && ST.gold < this.bet) {
        toast(T('ts.noc') || '❌ رصيد غير كافٍ', 'err');
        this.state = 'MAIN_MENU';
        this.emit('STATE_CHANGED', { to: 'MAIN_MENU' });
        return;
      }
      if (typeof ST !== 'undefined') {
        ST.gold -= this.bet;
        save();
        wallet();
      }
      this.emit('BET_PLACED', { bet: this.bet, gold: typeof ST !== 'undefined' ? ST.gold : 0 });
    }
    this.roundId++;
    this.selection = null;
    this.deck.createDeck();
    this.state = 'ROUND_READY';
    this.emit('ROUND_READY', { roundId: this.roundId });
    setTimeout(() => this.startShuffle(), 250);
  }
  startShuffle() {
    if (this.dead) return;
    this.state = 'SHUFFLING';
    SND.shuffle();
    this.emit('SHUFFLING_STARTED', { remaining: this.deck.remaining() });
    setTimeout(() => {
      if (this.dead) return;
      this.state = 'SELECTING';
      this.emit('SELECTION_REQUIRED', {});
      if (this.myRole !== 'selector') {
        if (this.multiplayer) {
          /* الغرفة: الموزع/المنتظر يستقبلون اختيار المتخمن عبر SSE — لا اختيار تلقائي */
          if (this._pendingPick) this._applyPendingPick();
        } else {
          /* المستخدم هو الموزع — الخصم يختار تلقائياً (يمنع تجمد اللعبة) */
          setTimeout(() => this.autoSelectOpponent(), 1100);
        }
      }
    }, 1400);
  }
  selectNumber(n) {
    if (this.dead) return;
    if (this.state !== 'SELECTING' || this.myRole !== 'selector') return;
    this.selection = new Card(n, 'A', -1);
    this.state = 'NUMBER_PICKED';
    this.emit('NUMBER_PICKED', { selection: this.selection });
  }
  selectSymbol(s) {
    if (this.dead) return;
    if (this.state !== 'SYMBOL_PICKING' || !this.selection) return;
    this.selection.symbol = s;
    this.state = 'SYMBOL_PICKED';
    this.emit('SYMBOL_PICKED', { selection: this.selection });
  }
  confirmSelection() {
    if (this.dead) return;
    if (this.mode === 'number_only') {
      if (this.state !== 'NUMBER_PICKED') return;
      this._finalizeSelection();
    } else {
      if (this.state === 'NUMBER_PICKED') {
        this.state = 'SYMBOL_PICKING';
        this.emit('SYMBOL_SELECTION_REQUIRED', { selection: this.selection });
      } else if (this.state === 'SYMBOL_PICKED') {
        this._finalizeSelection();
      }
    }
  }
  /* الخصم (AI) يختار تلقائياً عندما يكون المستخدم هو الموزع — يمنع تجمد اللعبة */
  autoSelectOpponent() {
    if (this.dead || this.state !== 'SELECTING') return;
    const num = 1 + this.rng.next(10);
    this.selection = new Card(num, 'A', -1);
    this.state = 'NUMBER_PICKED';
    this.emit('NUMBER_PICKED', { selection: this.selection });
    if (this.mode === 'number_only') {
      this.confirmSelection();
    } else {
      const keys = Object.keys(RN_SUITS);
      const sym = keys[this.rng.next(keys.length)];
      this.selection.symbol = sym;
      this.state = 'SYMBOL_PICKED';
      this.emit('SYMBOL_PICKED', { selection: this.selection });
      this._finalizeSelection();
    }
  }
  _finalizeSelection() {
    this.state = 'SELECTED';
    this.emit('SELECTION_CONFIRMED', { selection: this.selection });
    setTimeout(() => this.startDraw(), 650);
  }
  /* اختيار المتخمن البعيد (الغرفة) — يُطبَّق محلياً بنفس النتيجة الحتمية */
  receivePick(num, sym) {
    if (this.dead || !this.multiplayer) return;
    this._pendingPick = { num: num, sym: sym };
    if (this.state === 'SELECTING') this._applyPendingPick();
  }
  _applyPendingPick() {
    if (!this._pendingPick) return;
    const p = this._pendingPick;
    this._pendingPick = null;
    this.selection = new Card(p.num, p.sym, -1);
    this.state = 'SELECTED';
    this.emit('SELECTION_CONFIRMED', { selection: this.selection, remote: true });
    setTimeout(() => this.startDraw(), 650);
  }
  startDraw() {
    if (!this.deck.remaining()) {
      this._endRound('dealer');
      return;
    }
    this.state = 'PLAYER_DRAW';
    setTimeout(() => this.performDraw(), 350);
  }
  performDraw() {
    const c = this.deck.draw();
    if (!c) {
      this._endRound('dealer');
      return;
    }
    const cond = this.mode === 'number_only'
      ? c.matchNumber(this.selection)
      : c.equals(this.selection);
    if (cond) {
      this.emit('CARD_MATCHED', { card: c, who: 'player' });
      setTimeout(() => this._endRound('selector'), 750);
    } else {
      this.emit('CARD_MISSED', { card: c, who: 'player' });
      setTimeout(() => this.dealerDraw(), 850);
    }
  }
  dealerDraw() {
    if (!this.deck.remaining()) {
      this._endRound('selector');
      return;
    }
    setTimeout(() => {
      const c = this.deck.draw();
      if (!c) {
        this._endRound('selector');
        return;
      }
      const cond = this.mode === 'number_only'
        ? c.matchNumber(this.selection)
        : c.equals(this.selection);
      if (cond) {
        this.emit('CARD_MATCHED', { card: c, who: 'dealer' });
        setTimeout(() => this._endRound('dealer'), 750);
      } else {
        this.emit('CARD_MISSED', { card: c, who: 'dealer' });
        this.state = 'PLAYER_DRAW';
        setTimeout(() => this.startDraw(), 550);
      }
    }, 350);
  }
  _endRound(winner) {
    const myRole = this.myRole;
    const playerWon = myRole === 'selector' ? winner === 'selector'
                    : myRole === 'dealer' ? winner === 'dealer' : false;
    this._lastWinner = winner;
    this.stats.totalRounds++;
    if (winner === 'selector') this.stats.selectorWins++;
    else this.stats.dealerWins++;
    this.roundResults.push(playerWon);
    const mult = this.mode === 'number_only' ? 2 : 3;
    this.emit('ROUND_RESULT', {
      won: playerWon,
      amount: playerWon ? this.bet * mult : -this.bet,
      payout: playerWon ? this.bet * mult : 0
    });
    const isActive = myRole === 'selector' || myRole === 'dealer';
    if (this.multiplayer) {
      /* وضع الغرفة: لا رهان ولا قلب أدوار محلياً — الدوران يطبّقه صاحب الغرفة */
      if (isActive) this.emit(playerWon ? 'PLAYER_WON' : 'DEALER_WON', {});
      this.state = 'ROUND_ENDED';
      this.emit('ROUND_ENDED', { won: playerWon, winner: winner });
      return;
    }
    /* solo: لا نقلب الأدوار أبداً — اللاعب متخمن دائماً */
    this.emit(playerWon ? 'PLAYER_WON' : 'DEALER_WON', {});
    setTimeout(() => {
      this.state = 'ROUND_ENDED';
      this.emit('ROLES_KEPT', {});
      setTimeout(() => this._enterRoundReady(), 900);
    }, 1500);
  }
}
/* ── الرندر ── */
class RondaRenderer {
  constructor(core) {
    this.core = core;
    this._logEntries = [];
    this._chips = [];
    this._subscribe();
  }
  _subscribe() {
    this.core.on('STATE_CHANGED', (d) => {
      if (d.to === 'MAIN_MENU') this._showModeMenu();
    });
    this.core.on('ROLE_ASSIGNED', () => this._renderRound());
    this.core.on('ROUND_READY', () => this._updateRound());
    this.core.on('SHUFFLING_STARTED', (d) => {
      this._setHint('🔄 ' + RL('shuffling'));
      this._addLog('🔄 ' + RL('shuffling'), 'event');
      const badge = document.getElementById('rnDeckBadge');
      if (badge) badge.textContent = d.remaining;
    });
    this.core.on('SELECTION_REQUIRED', () => this._showSelection());
    this.core.on('NUMBER_PICKED', (d) => this._onNumberPicked(d));
    this.core.on('SYMBOL_SELECTION_REQUIRED', () => this._showSymbol());
    this.core.on('SYMBOL_PICKED', (d) => this._onSymbolPicked(d));
    this.core.on('SELECTION_CONFIRMED', (d) => this._showConfirmed(d));
    this.core.on('BET_PLACED', (d) => {
      this._addLog('🪙 ' + RL('betPlaced') + ' −' + fmt(d.bet), 'event');
      this._refreshBetBar();
    });
    this.core.on('CARD_MATCHED', (d) => this._showCard(d, true));
    this.core.on('CARD_MISSED', (d) => this._showCard(d, false));
    this.core.on('ROUND_RESULT', (d) => {
      /* وضع الغرفة: المشاهد/المنتظر لا يراهن — تظهرهم اللافتة المحايدة فقط */
      if (this.core.multiplayer && (this.core.myRole === 'waiting' || this.core.myRole === 'spectator')) return;
      this._chips.push(d.won);
      if (this._chips.length > 10) this._chips.shift();
      this._renderChips();
      if (this.core.multiplayer) {
        this._addLog((d.won ? '🏆 ' : '💔 ') + (d.won ? RL('youWin') : RL('youLose')), d.won ? 'win' : 'lose');
      } else if (d.won) {
        this._addLog('🏆 ' + RL('youWin') + ' +' + fmt(d.payout) + ' 🪙', 'win');
      } else {
        this._addLog('💔 ' + RL('youLose') + ' −' + fmt(this.core.bet) + ' 🪙', 'lose');
      }
    });
    this.core.on('PLAYER_WON', () => this._showResult(true, 'selector'));
    this.core.on('DEALER_WON', () => this._showResult(false, 'dealer'));
    this.core.on('ROUND_ENDED', (d) => {
      /* الأدوار غير النشطة (منتظر/مشاهد): لافتة محايدة بمن ربح الجولة */
      if (this.core.myRole === 'selector' || this.core.myRole === 'dealer') return;
      this._showNeutralEnd(d.winner);
    });
  }
  _alive() {
    return RN_ADAPTER && RN_ADAPTER.renderer === this && !RN_ADAPTER.core.dead;
  }
  _cardFaceHTML(c, extra) {
    const s = RN_SUITS[c.symbol] || RN_SUITS.A;
    return '<div class="ronda-card face rn-suit-' + c.symbol + (extra ? ' ' + extra : '') + '">' +
      '<div class="ronda-card-corner tl"><b class="rn-num">' + c.number + '</b><span class="rn-glyph">' + s.glyph + '</span></div>' +
      '<div class="ronda-card-center"><span class="rn-glyph big">' + s.glyph + '</span></div>' +
      '<div class="ronda-card-corner br"><b class="rn-num">' + c.number + '</b><span class="rn-glyph">' + s.glyph + '</span></div>' +
      '</div>';
  }
  _addLog(cls, text) {
    this._logEntries.push({ cls: cls, text: text });
    if (this._logEntries.length > 40) this._logEntries.shift();
    const log = document.getElementById('rnLog');
    if (!log) return;
    const row = document.createElement('div');
    row.className = 'ronda-log-entry ' + cls;
    row.textContent = text;
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }
  _renderLog() {
    const log = document.getElementById('rnLog');
    if (!log) return;
    log.innerHTML = '';
    this._logEntries.forEach(e => {
      const row = document.createElement('div');
      row.className = 'ronda-log-entry ' + e.cls;
      row.textContent = e.text;
      log.appendChild(row);
    });
    log.scrollTop = log.scrollHeight;
  }
  _renderChips() {
    const el = document.getElementById('rnChips');
    if (!el) return;
    el.innerHTML = this._chips.map(w =>
      '<span class="ronda-chip ' + (w ? 'win' : 'lose') + '" title="' + (w ? RL('youWin') : RL('youLose')) + '">' +
      (w ? '✔' : '✖') + '</span>'
    ).join('');
  }
  _setHint(t) {
    const el = document.getElementById('rnDrawHint');
    if (el) el.textContent = t || '';
  }
  _refreshBetBar() {
    const amt = document.getElementById('rnBetAmt');
    if (amt) amt.textContent = fmt(this.core.bet);
    const minus = document.getElementById('rnBetMinus');
    const plus = document.getElementById('rnBetPlus');
    if (minus) minus.disabled = this.core.bet <= 10;
    if (plus && typeof ST !== 'undefined') plus.disabled = this.core.bet >= ST.gold;
  }
  _renderRound() {
    if (!this._alive()) return;
    const c = document.getElementById('rnContainer');
    if (!c) return;
    const mp = this.core.multiplayer;
    const roleIc = this.core.myRole === 'selector' ? '🎯'
                 : this.core.myRole === 'spectator' ? '👁️'
                 : this.core.myRole === 'waiting' ? '⏳' : '🃏';
    c.innerHTML =
      '<div class="ronda-stage">' +
        '<div class="ronda-top">' +
          '<div class="ronda-role ' + this.core.myRole + '">' +
            '<span class="pulse"></span>' +
            '<span class="ronda-role-ic">' + roleIc + '</span>' +
            '<span>' + RL('you are') + ' <b>' + RL(this.core.myRole) + '</b></span>' +
          '</div>' +
          '<div class="ronda-state">' + RL('round') + ' <b>#' + this.core.roundId + '</b></div>' +
          '<div class="ronda-chips" id="rnChips" role="list" aria-label="' + RL('score') + '"></div>' +
        '</div>' +
        '<div class="ronda-table">' +
          '<div class="ronda-seat">' +
            '<div class="ronda-label"><span class="ronda-label-ic">🃏</span> ' + RL('dealer') + (mp ? '' : ' · AI') + '</div>' +
            '<div class="ronda-row" id="rnDealerRow">' +
              '<div id="rnDealerCard"><div class="ronda-card back"></div></div>' +
            '</div>' +
          '</div>' +
          '<div class="ronda-table-center">' +
            '<div class="ronda-deck" id="rnDeck">' +
              '<div class="ronda-deck-pile"><div class="ronda-card back mini"></div></div>' +
              '<div class="ronda-deck-count" id="rnDeckBadge">40</div>' +
            '</div>' +
            '<div class="ronda-draw-area" id="rnDrawArea">' +
              '<div class="ronda-draw-slot" id="rnDrawSlot"></div>' +
              '<div class="ronda-draw-hint" id="rnDrawHint">' + RL('chooseMode') + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="ronda-seat">' +
            '<div class="ronda-label"><span class="ronda-label-ic">🎯</span> ' + RL('selector') + '</div>' +
            '<div class="ronda-row" id="rnSelectorRow">' +
              '<div id="rnSelectorCard"><div class="ronda-card back"></div></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        (mp
          ? '<div class="ronda-rotation" id="rnRotation"></div>'
          : '<div class="ronda-betbar">' +
              '<span class="ronda-betbar-label">🪙 ' + RL('bet') + '</span>' +
              '<button class="ronda-bet-btn" id="rnBetMinus" onclick="RN_changeBet(-10)" aria-label="−10">−</button>' +
              '<div class="ronda-bet-amt" id="rnBetAmt">10</div>' +
              '<button class="ronda-bet-btn" id="rnBetPlus" onclick="RN_changeBet(10)" aria-label="+10">+</button>' +
            '</div>') +
        '<div id="rnSelectionPanel" class="ronda-sel-wrap"></div>' +
        '<div class="ronda-log" id="rnLog" role="log" aria-live="polite"></div>' +
        '<div class="ronda-result-banner" id="rnBanner">' +
          '<div class="ronda-result-inner" id="rnBannerInner">' +
            '<div class="ronda-result-ic" id="rnBannerIc"></div>' +
            '<div class="big" id="rnBannerText"></div>' +
            '<div class="ronda-result-sub" id="rnBannerSub"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    if (mp) this._renderRotation();
    this._renderChips();
    this._renderLog();
    this._refreshBetBar();
  }
  _showModeMenu() {
    if (!this._alive()) return;
    const p = document.getElementById('rnSelectionPanel');
    if (!p) return;
    p.innerHTML =
      '<div class="ronda-sel-panel">' +
        '<div class="ronda-sel-title">♦️ ' + RL('chooseMode') + '</div>' +
        '<div class="ronda-modes">' +
          '<button class="ronda-mode-btn" onclick="RN_chooseMode(\'number_only\')">' +
            '<span class="ronda-mode-em">🎯</span>' +
            '<span class="ronda-mode-name">' + RL('mode num') + '</span>' +
            '<span class="ronda-mode-desc">' + RL('mode numDesc') + '</span>' +
            '<span class="ronda-mode-mult">×2</span>' +
          '</button>' +
          '<button class="ronda-mode-btn" onclick="RN_chooseMode(\'number_symbol\')">' +
            '<span class="ronda-mode-em">♦️♠️</span>' +
            '<span class="ronda-mode-name">' + RL('mode sym') + '</span>' +
            '<span class="ronda-mode-desc">' + RL('mode symDesc') + '</span>' +
            '<span class="ronda-mode-mult">×3</span>' +
          '</button>' +
        '</div>' +
      '</div>';
    this._setHint(RL('chooseMode'));
  }
  _updateRound() {
    if (!this._alive()) return;
    const label = document.querySelector('.ronda-state');
    if (label) label.innerHTML = RL('round') + ' <b>#' + this.core.roundId + '</b>';
    const badge = document.getElementById('rnDeckBadge');
    if (badge) badge.textContent = this.core.deck.remaining();
    const panel = document.getElementById('rnSelectionPanel');
    if (panel) {
      panel.innerHTML =
        '<div class="ronda-sel-panel ronda-wait-panel">' +
          '<div class="ronda-wait-ic">🎲</div>' +
          '<div class="ronda-wait-text">' + RL('roundReady') + '</div>' +
        '</div>';
    }
  }
  _showSelection() {
    if (!this._alive()) return;
    const p = document.getElementById('rnSelectionPanel');
    if (!p) return;
    if (this.core.myRole === 'waiting' || this.core.myRole === 'spectator') {
      p.innerHTML =
        '<div class="ronda-sel-panel ronda-wait-panel">' +
          '<div class="ronda-wait-ic">' + (this.core.myRole === 'spectator' ? '👁️' : '⏳') + '</div>' +
          '<div class="ronda-wait-text">' + RL(this.core.myRole === 'spectator' ? 'spectating' : 'waitingTurn') + '</div>' +
        '</div>';
      return;
    }
    if (this.core.myRole !== 'selector') {
      p.innerHTML =
        '<div class="ronda-sel-panel ronda-wait-panel">' +
          '<div class="ronda-wait-ic">🃏</div>' +
          '<div class="ronda-wait-text">' + RL('waitDealer') + '</div>' +
        '</div>';
      return;
    }
    p.innerHTML =
      '<div class="ronda-sel-panel">' +
        '<div class="ronda-sel-title">🎯 ' + RL('chooseNum') + '</div>' +
        '<div class="ronda-nums">' +
          RN_NUMS.map(n =>
            '<button class="ronda-num-btn" data-num="' + n + '" onclick="RN_selectNum(' + n + ')">' + n + '</button>'
          ).join('') +
        '</div>' +
        '<button class="ronda-btn primary ronda-confirm" id="rnConfirmNum" onclick="RN_confirm()" disabled>' +
          RL('confirm') + ' ▶</button>' +
      '</div>';
    this._setHint(RL('chooseNum'));
  }
  _onNumberPicked(d) {
    if (!this._alive()) return;
    const sel = d.selection;
    this._addLog('🎯 ' + RL('pickedNum') + ': ' + sel.number, 'event');
    const p = document.getElementById('rnSelectionPanel');
    if (!p) return;
    p.querySelectorAll('.ronda-num-btn').forEach(b => {
      b.classList.toggle('sel', parseInt(b.dataset.num, 10) === sel.number);
      b.disabled = true;
    });
    const cBtn = document.getElementById('rnConfirmNum');
    if (cBtn) cBtn.disabled = false;
    if (this.core.mode !== 'number_only') {
      /* وضع رقم+رمز: ننتقل تلقائياً لاختيار الرمز */
      this.core.confirmSelection();
    }
  }
  _showSymbol() {
    if (!this._alive()) return;
    const p = document.getElementById('rnSelectionPanel');
    if (!p) return;
    const sel = this.core.selection;
    p.innerHTML =
      '<div class="ronda-sel-panel">' +
        '<div class="ronda-sel-title">✦ ' + RL('chooseSym') + '</div>' +
        '<div class="ronda-sel-recap">' + RL('yourNum') + ': <b>' + sel.number + '</b></div>' +
        '<div class="ronda-syms">' +
          Object.keys(RN_SUITS).map(k => {
            const s = RN_SUITS[k];
            return '<button class="ronda-sym-btn" data-sym="' + k + '" onclick="RN_selectSym(\'' + k + '\')">' +
              '<span class="ronda-sym-glyph" style="color:' + s.dark + '">' + s.glyph + '</span>' +
              '<span class="ronda-sym-name">' + RL(s.name) + '</span>' +
            '</button>';
          }).join('') +
        '</div>' +
        '<button class="ronda-btn primary ronda-confirm" id="rnConfirmSym" onclick="RN_confirm()" disabled>' +
          RL('confirm') + ' ▶</button>' +
      '</div>';
    this._setHint(RL('chooseSym'));
  }
  _onSymbolPicked(d) {
    if (!this._alive()) return;
    const sel = d.selection;
    const s = RN_SUITS[sel.symbol];
    this._addLog('✦ ' + RL('pickedSym') + ': ' + s.glyph + ' ' + RL(s.name), 'event');
    const p = document.getElementById('rnSelectionPanel');
    if (!p) return;
    p.querySelectorAll('.ronda-sym-btn').forEach(b => {
      b.classList.toggle('sel', b.dataset.sym === sel.symbol);
      b.disabled = true;
    });
    const cBtn = document.getElementById('rnConfirmSym');
    if (cBtn) cBtn.disabled = false;
  }
  _showConfirmed(d) {
    if (!this._alive()) return;
    SND.flip();
    const sel = d.selection;
    const s = RN_SUITS[sel.symbol] || RN_SUITS.A;
    if (d.remote) {
      this._addLog('🎯 ' + RL('pickedNum') + ': ' + sel.number + ' ' + s.glyph + ' (' + RL(s.name) + ')', 'event');
    } else {
      this._addLog('🃏 ' + RL('yourChoice') + ': ' + sel.number + ' ' + s.glyph + ' (' + RL(s.name) + ')', 'event');
    }
    const el = document.getElementById('rnSelectorCard');
    if (el) {
      el.innerHTML = this._cardFaceHTML(sel, 'selected drawn-card');
    }
    const panel = document.getElementById('rnSelectionPanel');
    if (panel) {
      panel.innerHTML =
        '<div class="ronda-sel-panel ronda-wait-panel">' +
          '<div class="ronda-wait-ic">🎲</div>' +
          '<div class="ronda-wait-text">' + RL('dealing') + '</div>' +
        '</div>';
    }
    this._setHint(RL('dealing'));
  }
  _showCard(d, matched) {
    if (!this._alive()) return;
    const c = d.card;
    const s = RN_SUITS[c.symbol] || RN_SUITS.A;
    const who = d.who === 'dealer' ? RL('dealer') : RL('you');
    const slot = document.getElementById('rnDrawSlot');
    /* نعرض ظهر الورقة أولاً ثم نقلبها على وجهها */
    if (slot) {
      slot.innerHTML = '<div class="ronda-card back drawn"></div>';
    }
    const reveal = () => {
      if (!this._alive()) return;
      if (slot) {
        slot.innerHTML = this._cardFaceHTML(c, (matched ? 'matched' : 'miss') + ' drawn-card');
      }
      if (matched) {
        this._addLog('🔥 ' + RL('drewMatch') + ': ' + c.number + ' ' + s.glyph + ' (' + who + ')', 'win');
        SND.match();
      } else {
        this._addLog('🃏 ' + RL('drewMiss') + ': ' + c.number + ' ' + s.glyph + ' (' + who + ')', 'event');
        SND.draw();
      }
      const badge = document.getElementById('rnDeckBadge');
      if (badge) badge.textContent = this.core.deck.remaining();
    };
    setTimeout(reveal, 240);
  }
  _showResult(isWin, winner) {
    if (!this._alive()) return;
    const banner = document.getElementById('rnBanner');
    const inner = document.getElementById('rnBannerInner');
    if (!banner || !inner) return;
    const mp = this.core.multiplayer;
    const mult = this.core.mode === 'number_only' ? 2 : 3;
    const amt = isWin ? this.core.bet * mult : this.core.bet;
    const ic = document.getElementById('rnBannerIc');
    const txt = document.getElementById('rnBannerText');
    const sub = document.getElementById('rnBannerSub');
    const whoWon = winner === 'dealer' ? RL('dealerWon') : RL('selectorWon');
    if (isWin) {
      if (!mp && typeof ST !== 'undefined') {
        ST.gold += amt;
        save();
        wallet();
      }
      SND.win();
      if (typeof celebrate === 'function' && !mp) celebrate(true);
      inner.className = 'ronda-result-inner win';
      if (ic) ic.textContent = '🏆';
      if (txt) txt.textContent = RL('youWin');
      if (sub) sub.innerHTML = mp ? whoWon : ('+' + fmt(amt) + ' 🪙');
      if (typeof burst === 'function' && !mp) {
        const r = banner.getBoundingClientRect();
        if (r.width) burst(r.left + r.width / 2, r.top + r.height / 2, ['#F5C518', '#FFD93D', '#34D399'], 18, 4.5);
      }
    } else {
      SND.lose();
      inner.className = 'ronda-result-inner lose';
      if (ic) ic.textContent = '💔';
      if (txt) txt.textContent = RL('youLose');
      if (sub) sub.innerHTML = mp ? whoWon : ('−' + fmt(amt) + ' 🪙');
    }
    banner.classList.add('show');
    setTimeout(() => {
      banner.classList.remove('show');
    }, 1900);
  }
  /* شريط ترتيب الأدوار الدائرية (الغرفة) */
  _renderRotation() {
    const el = document.getElementById('rnRotation');
    if (!el) return;
    const room = RN_ADAPTER.room;
    if (!room || !room.order || !room.order.length) { el.innerHTML = ''; return; }
    const u = rnMe();
    const items = room.order.map(function (pid, i) {
      const pl = (room.players || []).find(function (p) { return p.id === pid; });
      const name = pl ? pl.username : pid;
      const role = i === 0 ? 'dealer' : i === 1 ? 'selector' : 'waiting';
      const meCls = (u && pid === u.id) ? ' me' : '';
      const you = (u && pid === u.id) ? ' <i>(' + RL('you') + ')</i>' : '';
      return '<span class="ronda-rot-item ' + role + meCls + '">' + rnEsc(name) + you +
        '<span class="ronda-rot-lbl">' + RL(role) + '</span></span>';
    });
    el.innerHTML = '<span class="ronda-rot-title">🔁 ' + RL('rotation') + '</span>' +
      items.join('<span class="ronda-rot-arrow">→</span>');
  }
  /* ضيف بانتظار اختيار صاحب الغرفة للوضع (قبل أول جولة) */
  _showWaitingRoom() {
    if (!this._alive()) return;
    const p = document.getElementById('rnSelectionPanel');
    if (!p) return;
    p.innerHTML =
      '<div class="ronda-sel-panel ronda-wait-panel">' +
        '<div class="ronda-wait-ic">🛡️</div>' +
        '<div class="ronda-wait-text">' + RL('waitingRoomStart') + '</div>' +
      '</div>';
    this._setHint('');
  }
  /* صاحب الغرفة (الموزع): تأكيد الوضع وبدء أول جولة */
  _showOwnerRoundStart() {
    if (!this._alive()) return;
    const p = document.getElementById('rnSelectionPanel');
    if (!p) return;
    const room = RN_ADAPTER.room;
    const modeName = room && room.mode === 'number_symbol' ? RL('mode sym') : RL('mode num');
    p.innerHTML =
      '<div class="ronda-sel-panel">' +
        '<div class="ronda-sel-title">🃏 ' + RL('you are') + ' <b>' + RL('dealer') + '</b></div>' +
        '<div class="ronda-sel-recap">' + RL('chooseMode') + ': <b>' + modeName + '</b></div>' +
        '<button class="ronda-btn primary" onclick="RN_startRound()">' + RL('startRound') + '</button>' +
      '</div>';
    this._setHint(RL('pickMode'));
  }
  /* لافتة محايدة للأدوار غير النشطة (منتظر/مشاهد): من ربح الجولة */
  _showNeutralEnd(winner) {
    if (!this._alive()) return;
    const banner = document.getElementById('rnBanner');
    const inner = document.getElementById('rnBannerInner');
    if (!banner || !inner) return;
    const isSel = winner === 'selector';
    const ic = document.getElementById('rnBannerIc');
    const txt = document.getElementById('rnBannerText');
    const sub = document.getElementById('rnBannerSub');
    inner.className = 'ronda-result-inner neutral';
    if (ic) ic.textContent = '🔁';
    if (txt) txt.textContent = isSel ? RL('selectorWon') : RL('dealerWon');
    if (sub) sub.innerHTML = RL('waitingRound');
    banner.classList.add('show');
    setTimeout(() => {
      banner.classList.remove('show');
    }, 1900);
  }
  mount(id) {
    this._renderRound();
  }
}
/* ── المحول ── */
class RondaPlatformAdapter {
  constructor() {
    this.core = new RondaGame({ rng: new LocalRandomProvider() });
    this.renderer = new RondaRenderer(this.core);
    this.room = null;
  }
  start(id) {
    this.renderer.mount(id);
    this.core.start();
  }
  /* وضع الغرفة: المالك يثبّت الوضع ويبدأ الجولات — لا قلب أدوار محلي */
  chooseMode(m) {
    if (this.core.multiplayer) {
      this.core.mode = m;
      if (this.room && this.room.isOwner) {
        this.room.mode = m;
        this.room.phase = 'ready';
        Rooms.sendMove('mode', { mode: m }, this._statePayload());
        this.renderer._showOwnerRoundStart();
      }
      return;
    }
    this.core.chooseMode(m);
  }
  selectNum(n) {
    this.core.selectNumber(n);
  }
  selectSym(s) {
    this.core.selectSymbol(s);
  }
  confirm() {
    this.core.confirmSelection();
  }
  setBet(d) {
    const b = Math.max(10, Math.min(typeof ST !== 'undefined' ? ST.gold : 100, this.core.bet + d));
    this.core.bet = b;
    this.renderer._refreshBetBar();
  }
  /* ═══ وضع الغرفة ═══ */
  _statePayload() {
    const r = this.room;
    return {
      order: r.order,
      round: r.round,
      mode: r.mode,
      seed: r.seed,
      pick: r.pick || null,
      phase: r.phase || 'playing'
    };
  }
  /* دخول الغرفة: يحدد الدور حسب ترتيب الحضور ويعيد بناء حالة الجولة */
  enterRoom(room) {
    const u = rnMe();
    const players = (room.players || []).slice();
    const nonSpect = players.filter(function (p) { return !p.spectate; });
    const rs = room.room_state || {};
    const isOwner = room.owner_id === (u && u.id);
    const order = (rs.order && rs.order.length)
      ? rs.order.slice()
      : nonSpect.slice().sort(function (a, b) { return (a.seat || 0) - (b.seat || 0); }).map(function (p) { return p.id; });
    const myIdx = order.indexOf(u && u.id);
    let myRole = myIdx === 0 ? 'dealer' : myIdx === 1 ? 'selector' : 'waiting';
    const mySpect = players.some(function (p) { return p.id === (u && u.id) && p.spectate; });
    if (mySpect) myRole = 'spectator';

    this.core = new RondaGame({ rng: new LocalRandomProvider(), multiplayer: true });
    this.core.myRole = myRole;
    this.renderer = new RondaRenderer(this.core);
    this.renderer.mount('rnContainer');
    this.room = {
      id: room.id,
      code: room.code,
      isOwner: isOwner,
      ownerId: room.owner_id,
      players: players,
      order: order,
      round: rs.round || 0,
      mode: rs.mode || null,
      seed: rs.seed || null,
      pick: rs.pick || null,
      phase: rs.phase || 'mode'
    };

    /* نهاية الجولة: المالك يدوّر الأدوار ويطلق الجولة التالية تلقائياً */
    this.core.on('ROUND_ENDED', (d) => {
      if (!this.room) return;
      if (this.room.isOwner) {
        this.room.order = rnRotate(this.room.order, d.winner === 'selector');
        setTimeout(() => this.ownerStartRound(), 1600);
      } else {
        this.renderer._setHint(RL('waitingRound'));
      }
    });
    /* المتخمن يبث اختياره بعد التأكيد — الجميع يشغّل نفس البذرة فيرى النتيجة نفسها */
    this.core.on('SELECTION_CONFIRMED', (d) => {
      if (!this.room || !this.core.multiplayer || d.remote) return;
      if (this.core.myRole !== 'selector' || !this.core.selection) return;
      const pick = { num: this.core.selection.number, sym: this.core.selection.symbol };
      this.room.pick = pick;
      Rooms.sendMove('pick', { num: pick.num, sym: pick.sym, mode: this.core.mode }, this._statePayload());
    });

    if (!isOwner && (!rs.mode || rs.round === 0)) {
      /* ضيف: بانتظار اختيار المالك للوضع أو بدء الجولة الأولى */
      this.renderer._showWaitingRoom();
      return;
    }
    if (rs.mode && rs.round > 0) {
      /* إعادة تحميل منتصف اللعب (محدث للجولة الحالية) */
      this.applyRound(rs);
      if (rs.pick) this.core.receivePick(rs.pick.num, rs.pick.sym);
      return;
    }
    /* المالك قبل أول جولة */
    if (isOwner && !rs.mode) {
      this.renderer._showModeMenu();
      this.renderer._setHint(RL('pickMode'));
    } else {
      this.renderer._showOwnerRoundStart();
    }
  }
  /* تطبيق جولة (من المالك أو من حالة الغرفة الرسمية) — بذرة مشتركة = نتيجة حتمية */
  applyRound(d) {
    if (!this.room || !this.core) return;
    this.room.round = d.round;
    this.room.seed = d.seed;
    this.room.order = d.order;
    this.room.mode = d.mode;
    this.room.pick = d.pick || null;
    this.room.phase = d.phase || 'playing';
    const c = this.core;
    c.mode = d.mode;
    const u = rnMe();
    const idx = (d.order || []).indexOf(u && u.id);
    c.myRole = idx === 0 ? 'dealer' : idx === 1 ? 'selector' : 'waiting';
    const spect = (this.room.players || []).some(function (p) { return p.id === (u && u.id) && p.spectate; });
    if (spect) c.myRole = 'spectator';
    c.roundId = d.round;
    c.selection = null;
    c._pendingPick = null;
    if (d.seed !== null && d.seed !== undefined) c.rng.setSeed(d.seed);
    c.deck.createDeck();
    c.state = 'ROUND_READY';
    c.emit('ROUND_READY', { roundId: d.round });
    /* إعادة بناء الواجهة (شارة الدور + ترتيب الدوران) — لأن الدور يتغير بعد كل جولة */
    this.renderer._renderRound();
    this.renderer._updateRound();
    setTimeout(() => {
      if (c.dead) return;
      c.startShuffle();
    }, 250);
  }
  /* المالك يطلق جولة جديدة (بذرة عشوائية تُبث للجميع) */
  ownerStartRound() {
    if (!this.room || !this.room.isOwner || !this.room.mode) return;
    this.room.round++;
    this.room.seed = (Math.random() * 0xFFFFFFFF) >>> 0;
    this.room.pick = null;
    const payload = {
      order: this.room.order,
      round: this.room.round,
      mode: this.room.mode,
      seed: this.room.seed,
      pick: null,
      phase: 'playing'
    };
    Rooms.sendMove('round', payload, payload);
    this.applyRound(payload);
  }
  startRound() {
    if (!this.room || !this.room.isOwner) return;
    this.ownerStartRound();
  }
  destroy() {
    if (this.core) this.core.dead = true;
    this.core = null;
    this.renderer = null;
    this.room = null;
  }
}
/* ── دوال عامة ── */
function RN_selectNum(n) {
  SND.click();
  if (RN_ADAPTER) RN_ADAPTER.selectNum(n);
}
function RN_selectSym(s) {
  SND.click();
  if (RN_ADAPTER) RN_ADAPTER.selectSym(s);
}
function RN_confirm() {
  SND.click();
  if (RN_ADAPTER) RN_ADAPTER.confirm();
}
function RN_chooseMode(m) {
  SND.click();
  if (RN_ADAPTER) RN_ADAPTER.chooseMode(m);
}
function RN_changeBet(d) {
  SND.click();
  if (RN_ADAPTER) RN_ADAPTER.setBet(d);
}
/* ── الغرفة: أحداث وبدء الجولة ── */
function RN_startRound() {
  SND.click();
  if (RN_ADAPTER) RN_ADAPTER.startRound();
}
function RN_roomStart(room) {
  if (RN_ADAPTER) RN_ADAPTER.enterRoom(room);
}
function RN_roomMove(d) {
  if (!RN_ADAPTER || !RN_ADAPTER.room || !d || !d.action) return;
  const ad = RN_ADAPTER;
  if (d.action === 'mode') {
    if (ad.core) ad.core.mode = d.data.mode;
    if (!ad.room.isOwner && ad.renderer) {
      ad.renderer._renderRound();
      ad.renderer._showWaitingRoom();
    }
    return;
  }
  if (d.action === 'round') {
    /* تجاهل الجولات القديمة (وصلت متأخرة أو مكررة) */
    if (!ad.room.isOwner && ad.room.round > 0 && d.data.round <= ad.room.round) return;
    ad.applyRound(d.data);
    if (d.data.pick) ad.core.receivePick(d.data.pick.num, d.data.pick.sym);
    return;
  }
  if (d.action === 'pick') {
    if (ad.core.myRole !== 'selector') ad.core.receivePick(d.data.num, d.data.sym);
    return;
  }
}
/* ── ترجمات Moroccan Ronda ── */
const RONDA_L = {
  'you are': ['دورك:', 'Votre rôle:', 'Your role:'],
  selector: ['المتخمّن', 'Devineur', 'Guesser'],
  dealer: ['الموزع', 'Donneur', 'Dealer'],
  you: ['أنت', 'Vous', 'You'],
  chooseNum: ['اختر رقماً (1-7, 10-12)', 'Choisissez un numéro', 'Pick a number'],
  chooseSym: ['اختر الرمز', 'Choisissez le symbole', 'Choose the suit'],
  chooseMode: ['اختر وضع اللعب', 'Choisissez le mode', 'Choose game mode'],
  'mode num': ['🎯 رقم فقط', '🎯 Numéro seul', '🎯 Number only'],
  'mode numDesc': ['تخمين رقم الورقة فقط — ربح أسهل', 'Devinez seulement le numéro', 'Guess only the card number'],
  'mode sym': ['♦️♠️ رقم + رمز', '♦️♠️ Numéro + symbole', '♦️♠️ Number + suit'],
  'mode symDesc': ['تخمين الرقم والرمز معاً — ربح أعلى', 'Devinez numéro et symbole', 'Guess number and suit'],
  youWin: ['فوز!', 'Victoire!', 'Win!'],
  youLose: ['خسارة', 'Défaite', 'Loss'],
  round: ['الجولة', 'Tour', 'Round'],
  bet: ['الرهان', 'Mise', 'Bet'],
  betPlaced: ['رهان الجولة:', 'Mise du tour:', 'Round bet:'],
  confirm: ['تأكيد', 'Confirmer', 'Confirm'],
  remaining: ['المتبقي', 'Restantes', 'Left'],
  score: ['النتيجة', 'Score', 'Score'],
  shuffling: ['خلط الأوراق…', 'Mélange du paquet…', 'Shuffling…'],
  roundReady: ['الجولة جاهزة…', 'Tour prêt…', 'Round ready…'],
  waitDealer: ['أنت الموزع الآن — انتظر سحب الخصم', 'Vous êtes donneur — attendez', 'You are the dealer — wait'],
  dealing: ['سحب البطاقات…', 'Tirage des cartes…', 'Dealing…'],
  pickedNum: ['اخترت الرقم', 'Numéro choisi', 'Picked number'],
  pickedSym: ['اخترت الرمز', 'Symbole choisi', 'Picked suit'],
  yourNum: ['رقمك', 'Votre numéro', 'Your number'],
  yourChoice: ['اختيارك', 'Votre choix', 'Your pick'],
  drewMatch: ['تطابق!', 'Correspondance !', 'Match!'],
  drewMiss: ['لا تطابق', 'Pas de correspondance', 'No match'],
  rolesSwapped: ['تبديل الأدوار — أنت الآن', 'Rôles inversés — vous êtes', 'Roles swapped — you are now'],
  suitA: ['ذهب', 'Or', 'Gold'],
  suitB: ['كؤوس', 'Coupes', 'Cups'],
  suitC: ['سيوف', 'Épées', 'Swords'],
  suitD: ['صولجان', 'Bâtons', 'Clubs'],
  /* وضع الغرفة */
  waiting: ['منتظر', 'En attente', 'Waiting'],
  spectator: ['مشاهد', 'Spectateur', 'Spectator'],
  waitingTurn: ['دورك سيأتي — أنت في الانتظار', 'Votre tour viendra', 'Your turn comes later'],
  spectating: ['أنت تكتفي بالفرجة', 'Vous regardez', 'You are spectating'],
  rotation: ['ترتيب الأدوار', 'Ordre des rôles', 'Role order'],
  startRound: ['🚀 ابدأ الجولة', '🚀 Lancer le tour', '🚀 Start round'],
  waitingRound: ['بانتظار الجولة التالية…', 'En attente du prochain tour…', 'Waiting for next round…'],
  pickMode: ['اختر وضع اللعب لبدء الغرفة (أنت الموزع)', 'Choisissez le mode (vous êtes donneur)', 'Pick the game mode (you are dealer)'],
  waitingRoomStart: ['بانتظار بدء اللعب…', 'En attente du début…', 'Waiting for the game to start…'],
  dealerWon: ['الموزع ربح الجولة', 'Le donneur gagne', 'Dealer wins the round'],
  selectorWon: ['المتخمن ربح الجولة', 'Le devineur gagne', 'Guesser wins the round']
};
function RL(k) {
  return RONDA_L[k] ? RONDA_L[k][langIndex()] : k;
}
