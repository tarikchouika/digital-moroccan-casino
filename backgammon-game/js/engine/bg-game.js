/**
 * ============================================================================
 *  BG GAME — سير مباراة الطاولة والذكاء الاصطناعي (فوق BgCore)
 * ============================================================================
 *  BgGame : متحكم المباراة (افتتاح → رمي → حركات → نهاية لعبة → لعبة تالية)
 *           بأحداث onEvent للواجهة.
 *  BgAI   : ثلاثة مستويات — تعداد التتابعات + دالة تقييم
 *           0 مبتدئ: عشوائي · 1 متوسط: أفضل تقييم بضجيج
 *           2 محترف: + أفضل ردّ للخصم (عمق ردّ واحد).
 * ============================================================================
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./bg-core.js'));
  else root.BgGameNS = factory(root.BgCore);
})(typeof self !== 'undefined' ? self : this, function (Core) {
  'use strict';

  /* ══════════════ BgGame ══════════════ */

  function BgGame(opts) {
    const o = opts || {};
    this.rng = Core.SeededRng(o.seed);
    this.onEvent = o.onEvent || function () {};
    this.state = Core.newState(o.matchTarget || 5);
  }

  BgGame.prototype._emit = function (type, data) {
    try { this.onEvent({ type: type, data: data || {}, state: this.state }); } catch (e) {}
  };

  BgGame.prototype.newMatch = function (matchTarget) {
    this.state = Core.newState(matchTarget || 5);
    this._emit('matchStarted', {});
    return this.state;
  };

  /** لعبة تالية داخل المباراة — النقاط تبقى والفائز السابق يبدأ الافتتاح */
  BgGame.prototype.nextGame = function () {
    const prevWinner = this.state.winner;
    const score = this.state.matchScore.slice();
    const target = this.state.matchTarget;
    this.state = Core.newState(target);
    this.state.matchScore = score;
    this._emit('gameStarted', { prevWinner: prevWinner });
    return this.state;
  };

  BgGame.prototype.doOpening = function () {
    const r = Core.rollOpening(this.state, this.rng);
    this._emit('opening', { starter: r.starter, dice: r.dice });
    if (this.state.phase === 'roll') this._emit('noMoves', { turn: this.state.turn });
    return r;
  };

  BgGame.prototype.roll = function (p) {
    const r = Core.roll(this.state, p, this.rng);
    this._emit('rolled', { player: p, dice: this.state.lastRoll, doubles: this.state.dice.length === 4 });
    if (this.state.phase === 'roll') this._emit('noMoves', { turn: p });
    return r;
  };

  BgGame.prototype.move = function (p, mv) {
    const legal = Core.legalMoves(this.state, p);
    const ok = legal.some((m) => m.from === mv.from && m.to === mv.to && m.die === mv.die);
    if (!ok) { this._emit('illegal', { player: p, mv: mv }); return { ok: false, error: 'ILLEGAL' }; }
    Core.applyMove(this.state, p, mv);
    this._emit('moved', { player: p, mv: mv });
    const end = Core.checkGameEnd(this.state);
    if (end) {
      this._emit('gameEnded', { result: end, matchWinner: this.state.phase === 'matchEnd' ? this.state.winner : null });
      return { ok: true, ended: end };
    }
    if (!this.state.dice.length || !Core.legalMoves(this.state, p).length) {
      this._emit('turnDone', { player: p });
    }
    return { ok: true, ended: null };
  };

  /** تمرير الدور (بعد استنفاد الحركات أو عدم وجود حركة) */
  BgGame.prototype.endTurn = function () {
    this.state.turn = 1 - this.state.turn;
    this.state.rolled = false;
    this.state.dice = [];
    this.state.phase = 'roll';
    this._emit('turnChanged', { turn: this.state.turn });
  };

  BgGame.prototype.view = function () {
    const s = this.state;
    return {
      points: s.points.slice(), bar: s.bar.slice(), off: s.off.slice(),
      turn: s.turn, dice: s.dice.slice(), rolled: s.rolled,
      opening: s.opening, phase: s.phase,
      matchScore: s.matchScore.slice(), matchTarget: s.matchTarget,
      gameType: s.gameType, lastRoll: s.lastRoll ? s.lastRoll.slice() : null,
      winner: s.winner,
      pip: [Core.pipCount(s, 0), Core.pipCount(s, 1)],
      legal: s.phase === 'move' ? Core.legalMoves(s, s.turn) : []
    };
  };

  /* ══════════════ BgAI ══════════════ */

  function BgAI(game, level) {
    this.game = game;
    this.level = level === undefined ? 1 : level;
  }

  /** دالة التقييم من منظور p */
  BgAI.prototype.evaluate = function (st, p) {
    const o = 1 - p;
    let score = 0;
    const pipMe = Core.pipCount(st, p), pipOp = Core.pipCount(st, o);
    const contact = Core.hasContact(st);
    score += (st.off[p] - st.off[o]) * 11;
    score += (pipOp - pipMe) * (contact ? 1.0 : 1.7);
    score += st.bar[o] * 15;
    score -= st.bar[p] * 19;

    const myBlots = [];
    let madeHome = 0, anchor = 0, prime = 0, run = 0;
    const hm = Core.homeMin(p), hx = Core.homeMax(p);
    const om = Core.homeMin(o), ox = Core.homeMax(o);
    for (let i = 0; i < 24; i++) {
      const c = Core.ownCount(st, p, i);
      if (c > 0) {
        if (i >= hm && i <= hx) madeHome += Math.min(c, 4) * 1.2;
        if (i >= om && i <= ox && c >= 2) anchor += 5;
        if (c >= 2) { run += 1 + Math.min(c - 2, 2) * 0.3; prime += run; }
        else { run = 0; myBlots.push(i); }
      } else run = 0;
    }
    score += madeHome + anchor + Math.min(prime, 26);

    for (let b = 0; b < myBlots.length; b++) {
      const shots = this._directShots(st, p, myBlots[b]);
      const d = Core.dist(p, myBlots[b]);
      score -= (6 + shots * 2.4) * (0.5 + Math.min(d, 18) / 18) * (contact ? 1 : 0.15);
    }
    return score;
  };

  BgAI.prototype._directShots = function (st, p, pointIdx) {
    const o = 1 - p;
    const nums = {};
    for (let i = 0; i < 24; i++) {
      if (Core.ownCount(st, o, i) === 0) continue;
      const d = o === 0 ? (i - pointIdx) : (pointIdx - i);
      if (d >= 1 && d <= 6) nums[d] = 1;
    }
    let n = 0; for (const k in nums) n++;
    return n;
  };

  BgAI.prototype.choosePlay = function (p) {
    const plays = Core.enumeratePlays(this.game.state, p);
    if (!plays.length) return null;

    if (this.level === 0) {
      if (Math.random() < 0.6) return plays[Math.floor(Math.random() * plays.length)];
      return plays[Math.floor(Math.random() * Math.min(5, plays.length))];
    }

    for (let i = 0; i < plays.length; i++) plays[i].ev = this.evaluate(plays[i].state, p);
    plays.sort((a, b) => b.ev - a.ev);

    if (this.level === 1) {
      return plays[Math.random() < 0.25 && plays.length > 1 ? 1 : 0];
    }

    /* محترف: أفضل 24 موضعًا × أفضل ردّ للخصم (رمي محاكى) */
    const top = plays.slice(0, Math.min(24, plays.length));
    let best = top[0], bestV = -Infinity;
    for (let t = 0; t < top.length; t++) {
      const replyV = this._bestReply(top[t].state, 1 - p);
      const total = top[t].ev + replyV * 0.45;
      if (total > bestV) { bestV = total; best = top[t]; }
    }
    return best;
  };

  BgAI.prototype._bestReply = function (stAfter, opp) {
    const st = Core.cloneState(stAfter);
    const a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6);
    st.dice = (a === b) ? [a, a, a, a] : [a, b];
    st.turn = opp;
    const plays = Core.enumeratePlays(st, opp, { seq: 900, nodes: 16000 });
    if (!plays.length) return this.evaluate(st, opp);
    let bestV = -Infinity;
    const step = Math.max(1, Math.floor(plays.length / 60));
    for (let i = 0; i < plays.length; i += step) {
      const v = this.evaluate(plays[i].state, opp);
      if (v > bestV) bestV = v;
    }
    return bestV;
  };

  return { BgGame: BgGame, BgAI: BgAI };
});
