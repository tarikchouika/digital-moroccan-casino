/**
 * ============================================================================
 *  DOMINO GAME — سير المباراة والذكاء الاصطناعي (فوق DominoCore)
 * ============================================================================
 *  DominoGame : متحكم الجولة/المباراة — يلفّ النواة بتحقق كامل وأحداث
 *               (onEvent) ويعرض snapshot آمنًا للعرض.
 *  DominoAI   : ثلاثة مستويات
 *               0 مبتدئ  — عشوائي موجّه لتبديد الثقيل
 *               1 متوسط  — تبديد + دبل مبكر + تنويع الألوان
 *               2 محترف  — + احتكار الأطراف ووعي الانسداد وقرب الإفراغ
 * ============================================================================
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./domino-core.js'));
  else root.DominoGameNS = factory(root.DominoCore);
})(typeof self !== 'undefined' ? self : this, function (Core) {
  'use strict';

  /* ══════════════ DominoGame ══════════════ */

  function DominoGame(opts) {
    const o = opts || {};
    this.cfg = Core.normalizeConfig(o.config);
    this.rng = Core.SeededRng(o.seed);
    this.onEvent = o.onEvent || function () {};
    this.state = null;
  }

  DominoGame.prototype.newMatch = function () {
    this.state = Core.newRound(null, this.rng, null);
    this.state.scores = [0, 0];
    this.state.round = 1;
    this._emit('matchStarted', { starter: this.state.starter });
    return this.state;
  };

  DominoGame.prototype.nextRound = function () {
    this.state = Core.nextRound(this.state, this.rng);
    this._emit('roundStarted', { round: this.state.round, starter: this.state.starter });
    return this.state;
  };

  DominoGame.prototype.play = function (p, tileId, end) {
    const before = this.state;
    const r = Core.play(before, p, tileId, end);
    if (!r.ok) { this._emit('illegal', { player: p, error: r.error }); return r; }
    this._emit('played', { player: p, end: end, tile: before.justPlayed.tile });
    if (r.ended) {
      this._emit('roundEnded', { result: before.result, matchWinner: before.matchWinner });
    } else {
      this._emit('turnChanged', { turn: before.turn });
    }
    return r;
  };

  DominoGame.prototype.draw = function (p) {
    const r = Core.draw(this.state, p, this.rng);
    if (r.ok) this._emit('drew', { player: p, playable: !!this.state.forcedTile });
    else this._emit('illegal', { player: p, error: r.error });
    return r;
  };

  DominoGame.prototype.pass = function (p) {
    const r = Core.pass(this.state, p);
    if (r.ok) this._emit('passed', { player: p });
    else this._emit('illegal', { player: p, error: r.error });
    if (r.ended) this._emit('roundEnded', { result: this.state.result, matchWinner: this.state.matchWinner });
    return r;
  };

  /** snapshot للعرض: كل ما تحتاجه الواجهة بلا منطق */
  DominoGame.prototype.view = function () {
    const s = this.state;
    return {
      cfg: s.cfg,
      round: s.round,
      scores: s.scores.slice(),
      handsCount: [s.hands[0].length, s.hands[1].length],
      hand0: s.hands[0].slice(),
      hand1: s.hands[1].slice(),
      boneyardCount: s.boneyard.length,
      chain: s.chain.slice(),
      leftEnd: s.leftEnd, rightEnd: s.rightEnd,
      turn: s.turn,
      starter: s.starter,
      forcedTile: s.forcedTile,
      justPlayed: s.justPlayed,
      phase: s.phase,
      result: s.result,
      matchWinner: s.matchWinner,
      legal0: Core.legalMoves(s, 0),
      legal1: Core.legalMoves(s, 1)
    };
  };

  DominoGame.prototype.legalMoves = function (p) { return Core.legalMoves(this.state, p); };
  DominoGame.prototype.hasAnyMove = function (p) { return Core.hasAnyMove(this.state, p); };

  DominoGame.prototype._emit = function (type, data) {
    try { this.onEvent({ type: type, data: data, state: this.state }); } catch (e) { /* المستمع معطوب لا يكسر المحرك */ }
  };

  /* ══════════════ DominoAI ══════════════ */

  function DominoAI(game, level) {
    this.game = game;
    this.level = level === undefined ? 1 : level;
  }

  DominoAI.prototype.choose = function (me) {
    const s = this.game.state;
    const moves = Core.legalMoves(s, me);
    if (!moves.length) return null;

    if (this.level === 0) {
      /* مبتدئ: عشوائي مع ميل خفيف لتبديد الثقيل */
      let best = null, bv = -1;
      for (let i = 0; i < moves.length; i++) {
        const v = Math.random() * 6 + (moves[i].tile.a + moves[i].tile.b) * 0.3;
        if (v > bv) { bv = v; best = moves[i]; }
      }
      return best;
    }

    const unseen = this._unseenTiles(me);
    let best2 = null, bv2 = -1e9;
    for (let i = 0; i < moves.length; i++) {
      const v = this._evalMove(me, moves[i], unseen);
      if (v > bv2) { bv2 = v; best2 = moves[i]; }
    }
    /* المستوى 1: ضجيج بسيط يفسد الكمال */
    if (this.level === 1 && Math.random() < 0.22 && moves.length > 1) {
      const alt = moves[Math.floor(Math.random() * moves.length)];
      if (alt !== best2) return alt;
    }
    return best2;
  };

  DominoAI.prototype._unseenTiles = function (me) {
    const s = this.game.state;
    const seen = {};
    for (let h = 0; h < s.hands.length; h++) for (let i = 0; i < s.hands[h].length; i++) seen[s.hands[h][i].id] = 1;
    for (let c = 0; c < s.chain.length; c++) seen[s.chain[c].tile.id] = 1;
    const unseen = [];
    for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) if (!seen[a + '-' + b]) unseen.push({ a: a, b: b });
    return unseen;
  };

  DominoAI.prototype._evalMove = function (me, mv, unseen) {
    const s = this.game.state;
    const t = mv.tile, pip = t.a + t.b;
    let v = pip;
    if (t.a === t.b) v += 4 + t.a;                       /* الدبل خطِر في اليد */

    /* تنويع الألوان: كل لون يفقدُه يدي بعد اللعب عقوبة */
    const suit = {};
    const h = s.hands[me];
    for (let i = 0; i < h.length; i++) { suit[h[i].a] = (suit[h[i].a] || 0) + 1; suit[h[i].b] = (suit[h[i].b] || 0) + 1; }
    suit[t.a]--; suit[t.b]--;
    const openVal = (mv.end === 'L')
      ? (t.a === s.leftEnd ? t.b : t.a)
      : (t.b === s.rightEnd ? t.a : t.b);
    if (!suit[openVal]) v -= 2;

    if (this.level >= 2) {
      /* احتكار الطرف: كلما قلّت القطع غير المرئية الملامسة للطرف الجديد زادت السيطرة */
      let touches = 0;
      for (let u = 0; u < unseen.length; u++) if (unseen[u].a === openVal || unseen[u].b === openVal) touches++;
      v += (7 - Math.min(touches, 7)) * 0.6;

      /* وعي بالانسداد: يبقى الخصم بلا ردود */
      const endsAfter = { L: s.leftEnd, R: s.rightEnd };
      endsAfter[mv.end] = openVal;
      const opp = 1 - me;
      let oppMoves = 0;
      if (s.chain.length) {
        const oh = s.hands[opp];
        for (let o = 0; o < oh.length; o++) {
          const ot = oh[o];
          if (ot.a === endsAfter.L || ot.b === endsAfter.L || ot.a === endsAfter.R || ot.b === endsAfter.R) oppMoves++;
        }
      }
      v += (2 - Math.min(oppMoves, 4)) * 1.5;

      /* قرب الإفراغ */
      if (h.length === 1) v += 25;
      else if (h.length === 2) v += 4;
    }
    return v;
  };

  return { DominoGame: DominoGame, DominoAI: DominoAI };
});
