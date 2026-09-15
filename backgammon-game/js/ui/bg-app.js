/**
 * ============================================================================
 *  BackgammonApp — المتحكم الرئيسي للطاولة
 * ============================================================================
 *  • دورة حياة attach()/detach() — نفس عقد RondaApp/DominoApp.
 *  • التدفق: افتتاح بنردَين → رمي → حركات (نقر مصدر ثم وجهة، الأدمن
 *    والصواني قابلة للنقر) → تمرير تلقائي → نهاية لعبة → لعبة تالية
 *    → نهاية مباراة بمكافأة.
 *  • تراجع ضمن الدور · حفظ تلقائي واستئناف · ذكاء ثلاثي المستويات.
 * ============================================================================
 */
(function (root) {
  'use strict';

  const Core = root.BgCore;
  const NS = root.BgGameNS;
  const R = root.BgRenderer;
  const T = root.BWG_T;
  const FMT = root.BWG_FMT;
  const SFX = root.BgAudio;

  const PREFS_KEY = 'backgammon.prefs';
  const SAVE_KEY = 'backgammon.save';

  const App = {
    config: { mode: 'ai', level: 1, len: 5, bet: 25 },
    game: null,
    ai: null,
    betPlaced: 0,
    localWallet: 500,
    sel: null,
    undoStack: [],
    busy: false,
    finished: false,
    _attached: false,
    _timers: [],
    _handlers: [],

    /* ═══════════ منصة اختيارية (عقد dmgames-arena) ═══════════ */
    _platform() {
      return {
        wallet: typeof root.ST === 'object' && root.ST && typeof root.ST.gold === 'number',
        take: typeof root.takeBet === 'function',
        give: typeof root.giveWin === 'function',
        toast: typeof root.toast === 'function',
        winFX: typeof root.winFX === 'function',
        record: typeof root.recordRound === 'function'
      };
    },
    walletBalance() { return this._platform().wallet ? root.ST.gold : this.localWallet; },
    /* كتم الصوت من زر السماعة في المنصة (ST.mute) — يُفحص عند كل نغمة */
    _syncMute() { try { if (root.ST && typeof root.ST.mute !== 'undefined') SFX.setMuted(!!root.ST.mute); } catch (e) {} },
    _toast(msg, kind) {
      const p = this._platform();
      if (p.toast) { try { root.toast(msg, kind); return; } catch (e) {} }
      const t = document.getElementById('bwToast');
      if (t) {
        t.textContent = msg;
        t.className = 'bw-toast show' + (kind === 'err' ? ' err' : '');
        clearTimeout(this._toastT);
        this._toastT = setTimeout(function () { t.className = 'bw-toast'; }, 2000);
      }
    },

    /* ═══════════ دورة الحياة ═══════════ */
    attach: function () {
      if (this._attached) return;
      this._attached = true;
      this.loadPrefs();
      this.renderRulesDoc();
      this.bindMenu();
      this.bindPlay();
      this.showScreen('menu');
      try { root.BGTranslateStatic(document.getElementById('bwStage') || document); } catch (e) {}
      this._syncMute();
      R.buildBoard(document.getElementById('bwPoints'));
      this.refreshResumeBtn();
      this.updateBetUI();
    },

    detach: function () {
      if (!this._attached) return;
      this._attached = false;
      this.clearTimers();
      for (let i = 0; i < this._handlers.length; i++) {
        try { this._handlers[i].el.removeEventListener(this._handlers[i].ev, this._handlers[i].fn); } catch (e) {}
      }
      this._handlers = [];
      this.game = null; this.ai = null; this.busy = false; this.sel = null; this.undoStack = [];
    },

    clearTimers: function () { for (let i = 0; i < this._timers.length; i++) clearTimeout(this._timers[i]); this._timers = []; },
    later: function (fn, ms) { const t = setTimeout(fn, ms); this._timers.push(t); return t; },
    on: function (el, ev, fn) { if (!el) return; el.addEventListener(ev, fn); this._handlers.push({ el: el, ev: ev, fn: fn }); },
    $(id) { return document.getElementById(id); },

    /* ═══════════ التفضيلات ═══════════ */
    loadPrefs: function () {
      try {
        const p = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
        if (p) {
          if (p.mode) this.config.mode = p.mode;
          if (typeof p.level === 'number') this.config.level = p.level;
          if (p.len) this.config.len = p.len;
          if (p.bet) this.config.bet = p.bet;
        }
      } catch (e) {}
      const mark = (segId, attr, val) => {
        const seg = this.$(segId); if (!seg) return;
        seg.querySelectorAll('.bw-segbtn').forEach((b) => b.classList.toggle('selected', b.getAttribute(attr) === String(val)));
      };
      mark('bwModeSeg', 'data-mode', this.config.mode);
      mark('bwLevelSeg', 'data-level', this.config.level);
      mark('bwLenSeg', 'data-len', this.config.len);
    },
    savePrefs: function () { try { localStorage.setItem(PREFS_KEY, JSON.stringify(this.config)); } catch (e) {} },

    /* ═══════════ القائمة ═══════════ */
    bindMenu: function () {
      const seg = (segId, fn) => {
        const el = this.$(segId); if (!el) return;
        this.on(el, 'click', (e) => {
          const btn = e.target.closest('.bw-segbtn');
          if (!btn) return;
          el.querySelectorAll('.bw-segbtn').forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
          SFX.click(); fn(btn); this.savePrefs(); this.updateBetUI();
        });
      };
      seg('bwModeSeg', (b) => { this.config.mode = b.getAttribute('data-mode'); });
      seg('bwLevelSeg', (b) => { this.config.level = parseInt(b.getAttribute('data-level'), 10) || 0; });
      seg('bwLenSeg', (b) => { this.config.len = parseInt(b.getAttribute('data-len'), 10) || 5; });

      const betInput = this.$('bwBetInput');
      if (betInput) {
        this.on(betInput, 'focus', function () { this.select(); });
        this.on(betInput, 'change', () => {
          const v = parseInt(betInput.value, 10);
          this.config.bet = Math.max(10, Math.min(this.walletBalance(), isNaN(v) ? 10 : v));
          betInput.value = this.config.bet;
          this.savePrefs();
        });
      }
      document.querySelectorAll('#bwBetField [data-betstep]').forEach((b) => {
        this.on(b, 'click', () => {
          const step = parseInt(b.getAttribute('data-betstep'), 10) || 0;
          SFX.click();
          this.config.bet = Math.max(10, Math.min(this.walletBalance(), this.config.bet + step));
          const inp = this.$('bwBetInput'); if (inp) inp.value = this.config.bet;
          this.savePrefs();
        });
      });

      this.on(this.$('bwStartBtn'), 'click', () => { SFX.click(); this.startMatch(); });
      this.on(this.$('bwResumeBtn'), 'click', () => { SFX.click(); this.resume(); });
      this.on(this.$('bwRulesBtn'), 'click', () => { SFX.click(); this.showLayer('bwRulesLayer', true); });
      this.on(this.$('bwRulesClose'), 'click', () => { SFX.click(); this.showLayer('bwRulesLayer', false); });
    },

    updateBetUI: function () {
      const f = this.$('bwBetField');
      if (f) f.style.display = this.config.mode === 'ai' ? '' : 'none';
      const inp = this.$('bwBetInput');
      if (inp) inp.value = this.config.bet;
      const hint = this.$('bwBetHint');
      if (hint) hint.textContent = FMT('bg.bet.hint');
    },

    renderRulesDoc: function () {
      const box = this.$('bwRulesDoc');
      if (!box) return;
      let html = '';
      const doc = root.BWG_RULES_DOC;
      for (let i = 0; i < doc.length; i++) html += '<div class="bw-rule"><b>' + doc[i][0] + ':</b> ' + doc[i][1] + '</div>';
      box.innerHTML = html;
    },

    /* ═══════════ شاشات وطبقات ═══════════ */
    showScreen: function (which) {
      const menu = this.$('bwMenu'), play = this.$('bwPlay');
      menu.classList.toggle('bw-screen-active', which === 'menu');
      play.classList.toggle('bw-screen-active', which === 'play');
    },
    showLayer: function (id, show) { const el = this.$(id); if (el) el.hidden = !show; },

    /* ═══════════ حفظ / استئناف ═══════════ */
    saveMatch: function () {
      if (!this.game || this.finished) return;
      try {
        const s = this.game.state;
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          v: 1, mode: this.config.mode, level: this.config.level, bet: this.betPlaced,
          st: {
            points: s.points, bar: s.bar, off: s.off, turn: s.turn, dice: s.dice,
            rolled: s.rolled, opening: s.opening,
            phase: s.phase === 'matchEnd' ? 'gameEnd' : s.phase,
            matchScore: s.matchScore, matchTarget: s.matchTarget,
            gameType: s.gameType, lastRoll: s.lastRoll, winner: s.winner
          }
        }));
      } catch (e) {}
    },
    loadSave: function () {
      try {
        const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
        if (!d || d.v !== 1 || !d.st || d.st.phase === 'matchEnd') return null;
        return d;
      } catch (e) { return null; }
    },
    clearSave: function () { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} },
    refreshResumeBtn: function () { const b = this.$('bwResumeBtn'); if (b) b.hidden = !this.loadSave(); },
    resume: function () {
      const d = this.loadSave();
      if (!d) return;
      this.config.mode = d.mode; this.config.level = d.level;
      this.makeGame(d.st.matchTarget || 5);
      this.game.state = Object.assign(Core.newState(d.st.matchTarget || 5), d.st);
      if (this.game.state.phase !== 'gameEnd') {
        const s = this.game.state;
        s.phase = (s.turn >= 0 && s.rolled && s.dice.length) ? (Core.legalMoves(s, s.turn).length ? 'move' : 'roll') : (s.turn >= 0 ? 'roll' : 'opening');
      }
      this.betPlaced = d.bet || 0;
      this.finished = false;
      this.enterPlay();
      this.refresh();
      if (this.game.state.phase === 'gameEnd') { this.later(() => this.showGameEnd(false), 500); return; }
      this.continueFlow();
    },

    /* ═══════════ بدء المباراة ═══════════ */
    makeGame: function (target) {
      const self = this;
      this.game = new NS.BgGame({
        matchTarget: target || this.config.len,
        onEvent: function (ev) { self.onGameEvent(ev); }
      });
      this.ai = this.config.mode === 'ai' ? new NS.BgAI(this.game, this.config.level) : null;
    },

    startMatch: function () {
      this.betPlaced = 0;
      if (this.config.mode === 'ai') {
        const amt = Math.min(this.config.bet, this.walletBalance());
        if (amt < 10) { this._toast(T('bg.bet'), 'err'); SFX.error(); return; }
        const p = this._platform();
        if (p.wallet && p.take) {
          /* المنصة: خصم حقيقي من الرصيد (takeBet يرفض إن لم يكفِ الرصيد) */
          try { if (!root.takeBet(amt)) return; } catch (e) { return; }
        } else {
          this.localWallet -= amt;
        }
        this.betPlaced = amt;
      }
      this.finished = false;
      this.clearTimers();
      this.makeGame(this.config.len);
      this.enterPlay();
      this.refresh();
      this.later(() => this.doOpening(), 450);
    },

    enterPlay: function () {
      this.showScreen('play');
      this.busy = false; this.sel = null; this.undoStack = [];
      this.showLayer('bwOverLayer', false);
      this.showLayer('bwResignLayer', false);
      const isAI = this.config.mode === 'ai';
      this.$('bwTopName').textContent = isAI ? (T('bg.opp') + ' · ' + T('bg.level.' + this.config.level)) : T('bg.p2');
      this.$('bwBotName').textContent = isAI ? T('bg.you') : T('bg.p1');
      const av = this.$('bwTopAvatar');
      if (av) av.innerHTML = '<i class="fa-solid ' + (isAI ? 'fa-robot' : 'fa-user') + '" aria-hidden="true"></i>';
    },

    onGameEvent: function (ev) {
      switch (ev.type) {
        case 'rolled': SFX.dice(); break;
        case 'moved': if (ev.data.mv && ev.data.mv.hit) SFX.hit(); else SFX.move(); break;
        case 'opening': SFX.dice(); break;
        case 'noMoves': SFX.noMoves(); this._toast(T('bg.noMoves')); break;
        case 'illegal': SFX.error(); break;
        default: break;
      }
    },

    /* ═══════════ الرسم ═══════════ */
    refresh: function () {
      if (!this.game) return;
      this._syncMute();   /* كتم المنصة (ST.mute) يُزامَن عند كل رسم */
      const view = this.game.view();
      const isAI = this.config.mode === 'ai';
      this.$('bwTopScore').textContent = String(view.matchScore[1]);
      this.$('bwBotScore').textContent = String(view.matchScore[0]);
      this.$('bwTopPip').textContent = T('bg.pip') + ': ' + view.pip[1];
      this.$('bwBotPip').textContent = T('bg.pip') + ': ' + view.pip[0];
      this.$('bwMatchLbl').textContent = R.matchLabel(view) + (isAI ? '' : ' · ' + view.matchScore[0] + ' : ' + view.matchScore[1]);
      R.renderChks(this.game.state, view.legal, this.sel);
      R.renderDice(this.$('bwDice'), this.game.state);
      this.$('bwStatus').textContent = R.statusText(view, isAI ? 'ai' : 'local');

      /* زر الرمي */
      const btn = this.$('bwRollBtn');
      if (btn) {
        const canRoll = !this.busy && (view.phase === 'opening' ||
          (view.phase === 'roll' && !view.rolled && view.turn === (isAI ? 0 : view.turn)));
        btn.hidden = !canRoll;
        btn.classList.toggle('pulse', !!canRoll);
      }
      /* زر التراجع */
      const ub = this.$('bwUndoBtn');
      if (ub) ub.disabled = !(this.undoStack.length > 0 && !this.busy && (isAI ? view.turn === 0 : true) && view.phase === 'move');
    },

    /* ═══════════ التدفق ═══════════ */
    continueFlow: function () {
      const s = this.game.state;
      if (s.phase === 'gameEnd' || s.phase === 'matchEnd') { this.showGameEnd(false); return; }
      if (s.phase === 'opening') { this.later(() => this.doOpening(), 450); return; }
      if (s.phase === 'roll') {
        if (!s.rolled) {
          if (this.config.mode === 'ai' && s.turn === 1) {
            this.later(() => this.aiRoll(), 650);
          }
          return;
        }
        this.later(() => this.passTurn(), 850);
        return;
      }
      if (s.phase === 'move' && this.config.mode === 'ai' && s.turn === 1) this.aiPlay();
    },

    doOpening: function () {
      const s = this.game.state;
      if (s.phase !== 'opening') return;
      this.busy = true;
      const res = this.game.doOpening();
      this.busy = false;
      this.refresh();
      this._toast(T('bg.starter'));
      this.saveMatch();
      if (this.config.mode === 'ai' && res.starter === 1) this.later(() => this.aiPlay(), 800);
    },

    rollClick: function () {
      const s = this.game.state;
      if (this.busy || s.phase === 'gameEnd' || s.phase === 'matchEnd') return;
      if (this.config.mode === 'ai' && s.turn === 1 && !s.opening) return;
      if (s.phase === 'opening') { this.doOpening(); return; }
      if (s.rolled && s.phase === 'move') return;
      this.sel = null;
      this.game.roll(s.turn);
      this.refresh();
      this.saveMatch();
      if (s.phase === 'roll') this.later(() => this.passTurn(), 950);
    },

    passTurn: function () {
      this.sel = null;
      this.undoStack = [];
      this.game.endTurn();
      this.refresh();
      this.saveMatch();
      if (this.config.mode === 'ai' && this.game.state.turn === 1) this.later(() => this.aiRoll(), 620);
    },

    /* ═══════════ تفاعل اللاعب ═══════════ */
    bindPlay: function () {
      const pts = this.$('bwPoints');
      this.on(pts, 'click', (e) => {
        const col = e.target.closest('[data-point]');
        if (col) this.colClick(parseInt(col.getAttribute('data-point'), 10));
        const bar = e.target.closest('[data-bar]');
        if (bar) this.barClick();
      });
      this.on(this.$('bwTrayBot'), 'click', () => this.trayClick(0));
      this.on(this.$('bwTrayTop'), 'click', () => this.trayClick(1));
      this.on(this.$('bwRollBtn'), 'click', () => { SFX.click(); this.rollClick(); });
      this.on(this.$('bwUndoBtn'), 'click', () => this.undo());
      this.on(this.$('bwResignBtn'), 'click', () => {
        SFX.click();
        if (this.config.mode !== 'ai' || !this.game) { this.toMenu(); return; }
        this.$('bwResignText').textContent = T('bg.resignAsk');
        this.showLayer('bwResignLayer', true);
      });
      this.on(this.$('bwResignYes'), 'click', () => {
        this.showLayer('bwResignLayer', false);
        this.finished = true; this.clearSave();
        if (this.config.mode === 'ai' && this.game) {
          const s = this.game.state;
          s.matchScore[1] = s.matchTarget;
          s.winner = 1; s.gameType = 'single'; s.phase = 'matchEnd';
          this.showGameEnd(true);
        } else this.toMenu();
      });
      this.on(this.$('bwResignNo'), 'click', () => { SFX.click(); this.showLayer('bwResignLayer', false); });
      this.on(this.$('bwOverBtn'), 'click', () => { SFX.click(); this.overBtn(); });
    },

    colClick: function (idx) {
      const s = this.game.state;
      if (this.busy || s.phase !== 'move') return;
      if (this.config.mode === 'ai' && s.turn !== 0) return;
      if (this.config.mode === 'local' && !s.rolled) return;
      const legal = Core.legalMoves(s, s.turn);
      if (this.sel !== null) {
        for (let i = 0; i < legal.length; i++) {
          if (legal[i].from === this.sel && legal[i].to === idx) { this.doMove(legal[i]); return; }
        }
      }
      let hasFrom = false;
      for (let i = 0; i < legal.length; i++) if (legal[i].from === idx) { hasFrom = true; break; }
      if (hasFrom) {
        this.sel = (this.sel === idx) ? null : idx;
        SFX.click();
        this.refresh();
        return;
      }
      this.sel = null;
      this.refresh();
    },

    barClick: function () {
      const s = this.game.state;
      if (this.busy || s.phase !== 'move') return;
      if (this.config.mode === 'ai' && s.turn !== 0) return;
      const legal = Core.legalMoves(s, s.turn);
      for (let i = 0; i < legal.length; i++) if (legal[i].from === -1) {
        this.sel = -1; SFX.click(); this.refresh(); return;
      }
    },

    trayClick: function (p) {
      const s = this.game.state;
      if (this.busy || s.phase !== 'move' || s.turn !== p) return;
      if (this.config.mode === 'ai' && p !== 0) return;
      if (this.sel === null) return;
      const legal = Core.legalMoves(s, s.turn);
      for (let i = 0; i < legal.length; i++) {
        if (legal[i].from === this.sel && legal[i].to === -1) { this.doMove(legal[i]); return; }
      }
    },

    doMove: function (mv) {
      const s = this.game.state;
      this.undoStack.push({
        points: s.points.slice(), bar: s.bar.slice(), off: s.off.slice(),
        dice: s.dice.slice(), phase: s.phase, rolled: s.rolled
      });
      const r = this.game.move(s.turn, mv);
      if (!r.ok) { this.undoStack.pop(); return; }
      this.sel = null;
      this.refresh();
      this.saveMatch();
      if (r.ended) { this.later(() => this.showGameEnd(false), 650); return; }
      if (!s.dice.length || !Core.legalMoves(s, s.turn).length) {
        this.later(() => this.passTurn(), 560);
      } else {
        this.later(() => this.refresh(), 60);
      }
    },

    undo: function () {
      const s = this.game.state;
      if (!this.undoStack.length || this.busy) return;
      if (this.config.mode === 'ai' && s.turn !== 0) return;
      const snap = this.undoStack.pop();
      s.points = snap.points; s.bar = snap.bar; s.off = snap.off;
      s.dice = snap.dice; s.phase = snap.phase; s.rolled = snap.rolled;
      this.sel = null;
      SFX.click();
      this.refresh(); this.saveMatch();
    },

    /* ═══════════ الذكاء ═══════════ */
    aiRoll: function () {
      const s = this.game.state;
      if (!s || s.phase !== 'roll' || s.turn !== 1 || s.rolled) return;
      this.game.roll(1);
      this.refresh();
      this.saveMatch();
      if (s.phase === 'roll') this.later(() => this.passTurn(), 850);
      else this.later(() => this.aiPlay(), 600);
    },

    aiPlay: function () {
      const s = this.game.state;
      if (!this.ai || s.phase !== 'move' || s.turn !== 1 || this.busy) return;
      this.busy = true;
      this.later(() => {
        const play = this.ai.choosePlay(1);
        this.busy = false;
        if (!play || !play.moves.length) { this.passTurn(); return; }
        this.aiStep(play.moves.slice(), 0);
      }, 560);
    },

    aiStep: function (moves, i) {
      if (this.finished) return;
      const s = this.game.state;
      if (i >= moves.length) {
        /* game.move حسم اللعبة إن انتهت — لا يُعاد checkGameEnd هنا (خصم مزدوج للنقاط) */
        if (s.phase === 'gameEnd' || s.phase === 'matchEnd') { this.later(() => this.showGameEnd(false), 650); return; }
        this.later(() => this.passTurn(), 460);
        return;
      }
      const r = this.game.move(1, moves[i]);
      this.refresh();
      this.saveMatch();
      if (r.ended || s.phase === 'gameEnd' || s.phase === 'matchEnd') { this.later(() => this.showGameEnd(false), 650); return; }
      this.later(() => this.aiStep(moves, i + 1), 440);
    },

    /* ═══════════ النهايات ═══════════ */
    showGameEnd: function (resigned) {
      const s = this.game.state;
      if (s.phase !== 'gameEnd' && s.phase !== 'matchEnd' && !resigned) return;
      const isAI = this.config.mode === 'ai';
      const iWon = s.winner === 0;
      const em = this.$('bwOverEm'), tt = this.$('bwOverTitle'), ty = this.$('bwOverType'),
        amt = this.$('bwOverAmt'), rows = this.$('bwOverRows'), btn = this.$('bwOverBtn');

      if (em) em.textContent = (iWon || !isAI) ? '🏆' : '💀';
      if (tt) {
        if (resigned) tt.textContent = T('bg.resign');
        else if (isAI) tt.textContent = s.phase === 'matchEnd' ? (iWon ? T('bg.match.won') : T('bg.match.lost')) : (iWon ? T('bg.game.won') : T('bg.game.lost'));
        else tt.textContent = s.winner === 0 ? T('bg.p1won') : T('bg.p2won');
      }
      if (ty) {
        if (!resigned) {
          const typeT = s.gameType === 'gammon' ? T('bg.gammon') : (s.gameType === 'backgammon' ? T('bg.backgammon') : T('bg.single'));
          const ptsW = s.gameType === 'gammon' ? 2 : (s.gameType === 'backgammon' ? 3 : 1);
          ty.textContent = typeT + ' +' + ptsW;
        } else ty.textContent = '';
      }
      /* مكافأة نهاية المباراة فقط — تسوية مالية + تذكرة سجل الجولات */
      let payout = 0;
      const p = this._platform();
      if (isAI && s.phase === 'matchEnd' && this.betPlaced > 0) {
        if (iWon) {
          const mult = [1.5, 2, 3][this.config.level] || 2;
          payout = Math.round(this.betPlaced * mult);
          if (p.wallet && p.give) { try { root.giveWin(payout); } catch (e) {} }
          else this.localWallet += payout;
          if (p.winFX) { try { root.winFX(payout); } catch (e) {} }
          if (p.record) { try { root.recordRound(true, payout, T('bg.match.won'), this.betPlaced, 'bg'); } catch (e) {} }
        } else if (p.record) {
          /* خسارة أو انسحاب المباراة المُراهن عليها — تذكرة خسارة واحدة */
          try { root.recordRound(false, 0, resigned ? T('bg.resign') : T('bg.match.lost'), this.betPlaced, 'bg'); } catch (e) {}
        }
      }
      if (amt) amt.innerHTML = (isAI && payout && s.phase === 'matchEnd')
        ? '<span class="plus">+' + payout + '</span> <i class="fa-solid fa-coins" aria-hidden="true"></i>' : '';
      if (rows) rows.innerHTML = R.scoreRowsHTML(this.game.view(), isAI ? 'ai' : 'local');
      if (btn) btn.innerHTML = (s.phase === 'matchEnd' || resigned) ? T('bg.newMatch') : T('bg.nextGame');
      this.showLayer('bwOverLayer', true);
      if (isAI && iWon) { if (s.phase === 'matchEnd' || resigned) SFX.winMatch(); else SFX.winGame(); }
      else SFX.lose();
      if (s.phase === 'matchEnd' || resigned) { this.finished = true; this.clearSave(); }
    },

    overBtn: function () {
      const s = this.game.state;
      if (s.phase === 'matchEnd' || this.finished) { this.toMenu(); return; }
      this.game.nextGame();
      this.sel = null; this.undoStack = [];
      this.showLayer('bwOverLayer', false);
      this.refresh();
      this.saveMatch();
      this.later(() => this.doOpening(), 420);
    },

    toMenu: function () {
      this.clearTimers();
      this.finished = true; this.busy = false; this.sel = null; this.undoStack = [];
      this.showLayer('bwOverLayer', false);
      this.showLayer('bwResignLayer', false);
      this.showScreen('menu');
      this.refreshResumeBtn();
      SFX.click();
    }
  };

  root.BackgammonApp = App;
})(typeof self !== 'undefined' ? self : this);
