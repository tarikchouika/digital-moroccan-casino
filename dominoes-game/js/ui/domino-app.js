/**
 * ============================================================================
 *  DominoApp — المتحكم الرئيسي للضومنة
 * ============================================================================
 *  • دورة حياة attach()/detach() — تُربط عند فتح اللعبة وتُنظّف عند الخروج
 *    (مؤقتات، مستمعون، طبقات) — نفس عقد RondaApp.
 *  • تعمل مستقلة تمامًا (محفظة محلية) وتتكامل داخل المنصة:
 *    الترجمة من قاموس المنصة إن وُجد · الصوت يتبع ST.mute ·
 *    الرهان عبر takeBet()/giveWin() · التذاكر عبر recordRound(…,'do') ·
 *    ملء الشاشة يديره openGame/closeGamePage (app-fs) — لا تدخّل هنا.
 *  • حفظ تلقائي + استئناف · تفضيلات محفوظة · ذكاء بثلاثة مستويات.
 *  المبدأ المعماري: الواجهة ترسل أوامر لـ DominoGame وتعرض أحداثه فقط.
 * ============================================================================
 */
(function (root) {
  'use strict';

  const Core = root.DominoCore;
  const NS = root.DominoGameNS;
  const R = root.DominoRenderer;
  const T = root.DMN_T;
  const FMT = root.DMN_FMT;
  const SFX = root.DominoAudio;

  const PREFS_KEY = 'dominoes.prefs';
  const SAVE_KEY = 'dominoes.save';

  const App = {
    /* ═══════════ الحالة ═══════════ */
    config: { mode: 'ai', level: 1, target: 100, drawUntilPlayable: true, bet: 25 },
    game: null,
    ai: null,
    betPlaced: 0,
    localWallet: 500,          /* محفظة الوضع المستقل */
    selTile: null,             /* القطعة المختارة (بطرفين) */
    selOwner: 0,
    busy: false,
    finished: false,
    _attached: false,
    _timers: [],
    _handlers: [],

    /* ═══════════ أدوات منصة اختيارية ═══════════
       المنصة تُصدّر takeBet(amount)→boolean و giveWin(amount) و ST.gold و
       ST.mute — لا يوجد window.take/window.give (تلك لألعاب engines.js). */
    _platform() {
      return {
        lang: typeof root.langIndex === 'function',
        wallet: typeof root.ST === 'object' && root.ST && typeof root.ST.gold === 'number',
        take: typeof root.takeBet === 'function',
        give: typeof root.giveWin === 'function',
        toast: typeof root.toast === 'function',
        winFX: typeof root.winFX === 'function'
      };
    },

    walletBalance() {
      const p = this._platform();
      return p.wallet ? root.ST.gold : this.localWallet;
    },

    _toast(msg, kind) {
      const p = this._platform();
      if (p.toast) { try { root.toast(msg, kind); return; } catch (e) {} }
      const t = document.getElementById('dmToast');
      if (t) {
        t.textContent = msg;
        t.className = 'dm-toast show' + (kind === 'err' ? ' err' : '');
        clearTimeout(this._toastT);
        this._toastT = setTimeout(function () { t.className = 'dm-toast'; }, 2000);
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
      try { root.DMNTranslateStatic(document.getElementById('dmStage') || document); } catch (e) {}
      /* الصوت يتبع كتم المنصة (ST.mute) عند الربط — وأيضًا داخل كل refresh أدناه
         لأن اللاعب قد يبدّل الكتم أثناء اللعب من هيدر المنصة */
      try { if (root.ST && typeof root.ST.mute !== 'undefined') SFX.setMuted(!!root.ST.mute); } catch (e) {}
      this.refreshResumeBtn();
      this.updateBetUI();
    },

    detach: function () {
      if (!this._attached) return;
      this._attached = false;
      this.clearTimers();
      const h = this._handlers;
      for (let i = 0; i < h.length; i++) {
        try { h[i].el.removeEventListener(h[i].ev, h[i].fn); } catch (e) {}
      }
      this._handlers = [];
      /* لا نمسح حفظ المباراة هنا — «استئناف المباراة» يجب أن يصمد بين الجلسات
         (نفس سلوك الطاولة bg-app)؛ الحفظ يُمسح عند انتهاء/انسحاب المباراة فقط */
      this.game = null; this.ai = null; this.busy = false; this.selTile = null;
    },

    clearTimers: function () {
      for (let i = 0; i < this._timers.length; i++) clearTimeout(this._timers[i]);
      this._timers = [];
    },
    later: function (fn, ms) {
      const t = setTimeout(fn, ms);
      this._timers.push(t);
      return t;
    },
    on: function (el, ev, fn) {
      if (!el) return;
      el.addEventListener(ev, fn);
      this._handlers.push({ el: el, ev: ev, fn: fn });
    },
    $(id) { return document.getElementById(id); },

    /* ═══════════ التفضيلات ═══════════ */
    loadPrefs: function () {
      try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (!raw) return;
        const p = JSON.parse(raw);
        if (p.mode) this.config.mode = p.mode;
        if (typeof p.level === 'number') this.config.level = p.level;
        if (p.target) this.config.target = p.target;
        if (typeof p.drawUntilPlayable === 'boolean') this.config.drawUntilPlayable = p.drawUntilPlayable;
        if (p.bet) this.config.bet = p.bet;
      } catch (e) {}
      this.applyConfigToMenu();
    },
    savePrefs: function () {
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(this.config)); } catch (e) {}
    },
    applyConfigToMenu: function () {
      const mark = (segId, attr, val) => {
        const seg = this.$(segId);
        if (!seg) return;
        const btns = seg.querySelectorAll('.dm-segbtn');
        for (let i = 0; i < btns.length; i++) {
          btns[i].classList.toggle('selected', btns[i].getAttribute(attr) === String(val));
        }
      };
      mark('dmModeSeg', 'data-mode', this.config.mode);
      mark('dmLevelSeg', 'data-level', this.config.level);
      mark('dmTargetSeg', 'data-target', this.config.target);
      mark('dmDrawSeg', 'data-draw', this.config.drawUntilPlayable ? 1 : 0);
    },

    /* ═══════════ القائمة ═══════════ */
    bindMenu: function () {
      const seg = (segId, fn) => {
        const el = this.$(segId);
        if (!el) return;
        this.on(el, 'click', (e) => {
          const btn = e.target.closest('.dm-segbtn');
          if (!btn) return;
          const btns = segId ? this.$(segId).querySelectorAll('.dm-segbtn') : [];
          for (let i = 0; i < btns.length; i++) btns[i].classList.remove('selected');
          btn.classList.add('selected');
          SFX.click();
          fn(btn);
          this.savePrefs();
          this.updateBetUI();
        });
      };
      seg('dmModeSeg', (b) => { this.config.mode = b.getAttribute('data-mode'); });
      seg('dmLevelSeg', (b) => { this.config.level = parseInt(b.getAttribute('data-level'), 10) || 0; });
      seg('dmTargetSeg', (b) => { this.config.target = parseInt(b.getAttribute('data-target'), 10) || 100; });
      seg('dmDrawSeg', (b) => { this.config.drawUntilPlayable = b.getAttribute('data-draw') === '1'; });

      /* الرهان */
      const betInput = this.$('dmBetInput');
      if (betInput) {
        this.on(betInput, 'focus', function () { this.select(); });
        this.on(betInput, 'change', () => {
          const v = parseInt(betInput.value, 10);
          this.config.bet = Math.max(10, Math.min(this.walletBalance(), isNaN(v) ? 10 : v));
          betInput.value = this.config.bet;
          this.savePrefs();
        });
      }
      const betBtns = document.querySelectorAll('#dmBetField [data-betstep]');
      for (let i = 0; i < betBtns.length; i++) {
        this.on(betBtns[i], 'click', () => {
          const step = parseInt(document.activeElement && document.activeElement.getAttribute ? (document.activeElement.getAttribute('data-betstep') || '0') : '0', 10);
          SFX.click();
          this.config.bet = Math.max(10, Math.min(this.walletBalance(), this.config.bet + step));
          const inp = this.$('dmBetInput'); if (inp) inp.value = this.config.bet;
          this.savePrefs();
        });
      }

      this.on(this.$('dmStartBtn'), 'click', () => { SFX.click(); this.startMatch(); });
      this.on(this.$('dmResumeBtn'), 'click', () => { SFX.click(); this.resume(); });
      this.on(this.$('dmRulesBtn'), 'click', () => { SFX.click(); this.showLayer('dmRulesLayer', true); });
      this.on(this.$('dmRulesClose'), 'click', () => { SFX.click(); this.showLayer('dmRulesLayer', false); });
    },

    updateBetUI: function () {
      const f = this.$('dmBetField');
      if (f) f.style.display = this.config.mode === 'ai' ? '' : 'none';
      const inp = this.$('dmBetInput');
      if (inp) inp.value = this.config.bet;
      const hint = this.$('dmBetHint');
      if (hint) hint.textContent = FMT('dm.bet.hint');
    },

    renderRulesDoc: function () {
      const box = this.$('dmRulesDoc');
      if (!box) return;
      const doc = root.DMN_RULES_DOC;
      let html = '';
      for (let i = 0; i < doc.length; i++) {
        html += '<div class="dm-rule"><b>' + doc[i][0] + ':</b> ' + doc[i][1] + '</div>';
      }
      box.innerHTML = html;
    },

    /* ═══════════ شاشات وطبقات ═══════════ */
    showScreen: function (which) {
      const menu = this.$('dmMenu'), play = this.$('dmPlay');
      if (!menu || !play) return;
      menu.classList.toggle('dm-screen-active', which === 'menu');
      play.classList.toggle('dm-screen-active', which === 'play');
    },
    showLayer: function (id, show) {
      const el = this.$(id);
      if (el) el.hidden = !show;
    },

    /* ═══════════ حفظ / استئناف ═══════════ */
    saveMatch: function () {
      if (!this.game || this.finished) return;
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          v: 1, cfg: this.game.cfg, s: this.game.state,
          mode: this.config.mode, level: this.config.level, bet: this.betPlaced,
          betLocked: this.config.mode === 'ai' ? 1 : 0   /* الرهان خُصم مرة عند البدء */
        }));
      } catch (e) {}
    },
    loadSave: function () {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const d = JSON.parse(raw);
        if (!d || d.v !== 1 || !d.s || d.s.phase === 'matchEnd') return null;
        return d;
      } catch (e) { return null; }
    },
    /* حذف الحفظ عند مغادرة المنصة نهائيًا (cleanupDominoes) — لا داخل detach()
       كي يصمد «استئناف المباراة» بين الجلسات */
    purgeSave: function () { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} },
    clearSave: function () { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} },
    refreshResumeBtn: function () {
      const b = this.$('dmResumeBtn');
      if (b) b.hidden = !this.loadSave();
    },
    resume: function () {
      const d = this.loadSave();
      if (!d) return;
      /* استئناف مبرمج: رهان الجولة الموقوفة لا يُعاد خصمه — قد خُصم مرة عند البدء */
      this.config.mode = d.mode; this.config.level = d.level;
      this.makeGame(d.cfg);
      this.game.state = d.s;
      this.betPlaced = (d.betLocked && this.config.mode === 'ai') ? (d.bet || 0) : 0;
      this.finished = false;
      this.enterPlay(false);
      this.refresh();
      this.kickAI();
    },

    /* ═══════════ بدء المباراة ═══════════ */
    makeGame: function (cfgOverride) {
      const self = this;
      const cfg = Core.normalizeConfig(Object.assign({
        target: this.config.target,
        drawUntilPlayable: this.config.drawUntilPlayable
      }, cfgOverride || {}));
      this.game = new NS.DominoGame({
        config: cfg,
        onEvent: function (ev) { self.onGameEvent(ev); }
      });
      this.ai = this.config.mode === 'ai' ? new NS.DominoAI(this.game, this.config.level) : null;
    },

    startMatch: function () {
      /* الرهان في نمط AI — المحفظة الحقيقية (takeBet) أو المحلية (الوضع المستقل).
         حدّ الرهان: 10 كحد أدنى؛ الرصيد كحد أعلى — رهان أكبر من الرصيد يُرفض
         بالكامل (بلا خصم جزئي) كي تطابق التذكرةُ المبلغَ المخصوم فعلاً. */
      this.betPlaced = 0;
      if (this.config.mode === 'ai') {
        const bal = this.walletBalance();
        const bet = Math.max(10, this.config.bet);
        if (bal < 10 || bet > bal) { this._toast(T('dm.bet'), 'err'); SFX.error(); return; }
        const p = this._platform();
        if (p.take && p.wallet) {
          try { if (!root.takeBet(bet)) return; } catch (e) { return; }
        } else {
          this.localWallet -= bet;
        }
        this.betPlaced = bet;
        /* في وضع المحفظة: حجز الجلسة «قيد التقدم» يُدار من recordRound عند التسوية */
      }
      this.finished = false;
      this.makeGame();
      this.game.newMatch();
      SFX.shuffle();
      this.enterPlay(true);
      this.refresh();
      this.saveMatch();
      this.kickAI();
    },

    enterPlay: function (fresh) {
      this.showScreen('play');
      this.busy = false; this.selTile = null; this.selOwner = 0;
      if (fresh) this.clearTimers();
      const isAI = this.config.mode === 'ai';
      const nm = R.names(null, isAI ? 'ai' : 'local');
      this.$('dmOppName').textContent = isAI ? (nm.opp + ' · ' + T('dm.level.' + this.config.level)) : nm.opp;
      this.$('dmMyName').textContent = nm.me;
      const av = this.$('dmOppAvatar');
      if (av) av.innerHTML = '<i class="fa-solid ' + (isAI ? 'fa-robot' : 'fa-user') + '" aria-hidden="true"></i>';
      this.showLayer('dmRoundLayer', false);
      this.showLayer('dmMatchLayer', false);
      this.showLayer('dmResignLayer', false);
    },

    /* ═══════════ أحداث المحرك ═══════════ */
    onGameEvent: function (ev) {
      switch (ev.type) {
        case 'played': SFX.place(); break;
        case 'drew': SFX.draw(); if (ev.data.player !== 0) this._toast(T('dm.drew')); break;
        case 'passed': SFX.pass(); if (ev.data.player !== 0) this._toast(T('dm.passed')); break;
        case 'illegal': SFX.error(); break;
        default: break;
      }
    },

    /* ═══════════ الرسم ═══════════ */
    refresh: function () {
      if (!this.game || !this.game.state) return;
      /* الصوت يتبع كتم المنصة لحظيًا (زر السماعة في هيدر المنصة) */
      try { if (root.ST && typeof root.ST.mute !== 'undefined' && SFX.setMuted && SFX.isMuted() !== !!root.ST.mute) SFX.setMuted(!!root.ST.mute); } catch (e) {}
      const view = this.game.view();
      const isAI = this.config.mode === 'ai';

      /* النقاط */
      this.$('dmOppScore').textContent = String(view.scores[1]);
      this.$('dmMyScore').textContent = String(view.scores[0]);
      this.$('dmRoundLbl').textContent = R.roundLabel(view);

      /* مقعد الخصم */
      const oppRow = this.$('dmOppRow');
      if (oppRow) {
        if (isAI) {
          oppRow.innerHTML = R.backsHTML(view.handsCount[1]);
        } else {
          const legal1 = {};
          for (let i = 0; i < view.legal1.length; i++) legal1[view.legal1[i].tile.id] = 1;
          oppRow.innerHTML = R.handTilesHTML(view.hand1, legal1, view.forcedTile && view.forcedTile.id, 'dmPickP2');
        }
      }

      /* السلسلة + التلميحات */
      const pos = R.renderChain(this.$('dmChain'), view);
      const sel = this.selTile;
      R.renderEndHints(this.$('dmHintL'), this.$('dmHintR'), view, pos, sel);

      /* اليد */
      const hand = this.$('dmHand');
      if (hand) {
        const myTurn = view.turn === 0 && view.phase === 'play' && !this.busy;
        const legal0 = {};
        for (let i = 0; i < view.legal0.length; i++) legal0[view.legal0[i].tile.id] = 1;
        hand.innerHTML = R.handTilesHTML(view.hand0, legal0, view.forcedTile && view.forcedTile.id, 'dmPickHand');
        hand.classList.toggle('myturn', myTurn);
      }

      /* البنك */
      const by = this.$('dmBoneyard');
      if (by) {
        this.$('dmByCount').textContent = String(view.boneyardCount);
        const iPlay = view.phase === 'play' && !this.busy && (view.turn === 0 || (!isAI && view.turn === 1));
        const mustDraw = iPlay && !this.game.hasAnyMove(view.turn) && view.boneyardCount > 0 && view.cfg.drawUntilPlayable;
        by.classList.toggle('pulse', mustDraw);
        by.classList.toggle('dim', !mustDraw);
      }

      /* الحالة + زر التمرير */
      const st = this.$('dmStatus');
      const passBtn = this.$('dmPassBtn');
      if (st) {
        let s = '';
        if (view.phase === 'play') {
          const myTurn = view.turn === 0 && !this.busy;
          if (myTurn) {
            if (view.forcedTile) s = T('dm.mustPlayDrawn');
            else if (!this.game.hasAnyMove(0) && view.boneyardCount > 0 && view.cfg.drawUntilPlayable) s = T('dm.mustDraw');
            else if (!this.game.hasAnyMove(0)) s = T('dm.mustPass');
            else s = T(isAI ? 'dm.turn.you' : 'dm.turn.p1');
          } else {
            s = T(isAI ? 'dm.turn.opp' : 'dm.turn.p2');
          }
        }
        st.textContent = s;
      }
      if (passBtn) {
        const humanTurn = view.phase === 'play' && !this.busy && (view.turn === 0 || (!isAI && view.turn === 1));
        passBtn.hidden = !(humanTurn && !this.game.hasAnyMove(view.turn) &&
          (view.boneyardCount === 0 || !view.cfg.drawUntilPlayable));
      }
    },

    /* ═══════════ تفاعل اللاعب 1 (أسفل) ═══════════ */
    bindPlay: function () {
      const hand = this.$('dmHand');
      this.on(hand, 'click', (e) => {
        const btn = e.target.closest('[data-act="dmPickHand"]');
        if (btn) this.pickHand(btn.getAttribute('data-tile'));
      });
      const oppRow = this.$('dmOppRow');
      this.on(oppRow, 'click', (e) => {
        const btn = e.target.closest('[data-act="dmPickP2"]');
        if (btn) this.pickP2(btn.getAttribute('data-tile'));
      });
      this.on(this.$('dmBoneyard'), 'click', () => this.tryDraw());
      this.on(this.$('dmHintL'), 'click', () => this.pickEnd('L'));
      this.on(this.$('dmHintR'), 'click', () => this.pickEnd('R'));
      this.on(this.$('dmPassBtn'), 'click', () => this.tryPass());
      this.on(this.$('dmResignBtn'), 'click', () => {
        SFX.click();
        if (this.config.mode !== 'ai') { this.toMenu(); return; }
        this.$('dmResignText').textContent = T('dm.resignAsk');
        this.showLayer('dmResignLayer', true);
      });
      this.on(this.$('dmResignYes'), 'click', () => {
        this.showLayer('dmResignLayer', false);
        this.finished = true; this.clearSave();
        if (this.config.mode === 'ai' && this.game && this.game.state) {
          /* خسارة بالانسحاب: الخصم يبلغ الهدف — التذكرة تسجّلها showMatchEnd */
          this.game.state.scores[1] = this.game.cfg.target;
          this.game.state.matchWinner = 1;
          this.game.state.phase = 'matchEnd';
          this.showMatchEnd(true);
        } else this.toMenu();
      });
      this.on(this.$('dmResignNo'), 'click', () => { SFX.click(); this.showLayer('dmResignLayer', false); });
      this.on(this.$('dmNextRoundBtn'), 'click', () => {
        SFX.click();
        this.showLayer('dmRoundLayer', false);
        this.game.nextRound();
        this.busy = false; this.selTile = null;
        this.refresh(); this.saveMatch(); this.kickAI();
      });
      this.on(this.$('dmNewMatchBtn'), 'click', () => { SFX.click(); this.toMenu(); });
    },

    pickHand: function (tileId) {
      if (this.busy || !this.game) return;
      const s = this.game.state;
      if (s.phase !== 'play' || s.turn !== 0) return;
      let tile = null;
      for (let i = 0; i < s.hands[0].length; i++) if (s.hands[0][i].id === tileId) { tile = s.hands[0][i]; break; }
      if (!tile) return;
      const ends = Core.legalEnds(s, tile);
      if (!ends.length) { SFX.error(); return; }
      if (s.chain.length && ends.length === 2) {
        this.selTile = (this.selTile && this.selTile.id === tileId) ? null : tile;
        this.selOwner = 0;
        SFX.click();
        this.refresh();
      } else {
        this.playerPlay(tile, ends[0], 0);
      }
    },

    pickEnd: function (end) {
      if (!this.selTile || this.busy) return;
      const s = this.game.state;
      const ends = Core.legalEnds(s, this.selTile);
      if (ends.indexOf(end) < 0) return;
      this.playerPlay(this.selTile, end, this.selOwner);
    },

    playerPlay: function (tile, end, owner) {
      this.busy = true;
      this.selTile = null;
      const r = this.game.play(owner, tile.id, end);
      if (!r.ok) { this.busy = false; this.refresh(); return; }
      this.refresh(); this.saveMatch();
      if (this.game.state.phase !== 'play') {
        this.later(() => this.onRoundOver(), 520);
        return;
      }
      this.later(() => {
        this.busy = false;
        this.refresh();
        if (owner === 0) this.kickAI();
      }, 400);
    },

    pickP2: function (tileId) {
      if (this.busy || !this.game) return;
      const s = this.game.state;
      if (s.phase !== 'play' || s.turn !== 1) return;
      let tile = null;
      for (let i = 0; i < s.hands[1].length; i++) if (s.hands[1][i].id === tileId) { tile = s.hands[1][i]; break; }
      if (!tile) return;
      const ends = Core.legalEnds(s, tile);
      if (!ends.length) { SFX.error(); return; }
      if (s.chain.length && ends.length === 2) {
        this.selTile = (this.selTile && this.selTile.id === tileId) ? null : tile;
        this.selOwner = 1;
        SFX.click();
        this.refresh();
      } else {
        this.playerPlay(tile, ends[0], 1);
      }
    },

    tryDraw: function () {
      const s = this.game && this.game.state;
      if (!s || this.busy || s.phase !== 'play') return;
      const t = s.turn;
      if (t !== 0 && !(this.config.mode === 'local' && t === 1)) return;
      if (this.game.legalMoves(t).length) return;
      if (!s.boneyard.length || !s.cfg.drawUntilPlayable) return;
      const r = this.game.draw(t);
      if (r.ok) { this.refresh(); this.saveMatch(); if (s.forcedTile) this._toast(T('dm.mustPlayDrawn')); }
    },

    tryPass: function () {
      const s = this.game && this.game.state;
      if (!s || this.busy || s.phase !== 'play') return;
      const t = s.turn;
      if (t !== 0 && !(this.config.mode === 'local' && t === 1)) return;
      const r = this.game.pass(t);
      if (!r.ok) return;
      this.refresh(); this.saveMatch();
      if (s.phase !== 'play') { this.later(() => this.onRoundOver(), 420); return; }
      this.kickAI();
    },

    /* ═══════════ دور الذكاء ═══════════ */
    kickAI: function () {
      if (!this.game || !this.ai || this.finished) return;
      const s = this.game.state;
      if (s.phase !== 'play' || s.turn !== 1) return;
      this.busy = true;
      this.refresh();
      this.later(() => this.aiStep(), 620);
    },

    aiStep: function () {
      const s = this.game.state;
      if (!s || s.phase !== 'play' || s.turn !== 1) { this.busy = false; return; }
      const mv = this.ai.choose(1);
      if (mv) {
        const r = this.game.play(1, mv.tile.id, mv.end);
        if (!r.ok) { this.busy = false; this.refresh(); return; }
        this.refresh(); this.saveMatch();
        if (s.phase !== 'play') { this.busy = false; this.later(() => this.onRoundOver(), 520); return; }
        this.busy = false;
        this.refresh();
      } else if (s.boneyard.length && s.cfg.drawUntilPlayable) {
        this.game.draw(1);
        this.refresh(); this.saveMatch();
        this.later(() => this.aiStep(), 520);
      } else {
        this.game.pass(1);
        this.refresh(); this.saveMatch();
        if (s.phase !== 'play') { this.busy = false; this.later(() => this.onRoundOver(), 520); return; }
        this.busy = false;
        this.refresh();
      }
    },

    /* ═══════════ نهاية الجولة/المباراة ═══════════ */
    onRoundOver: function () {
      const s = this.game.state;
      if (!s.result) return;
      this.$('dmOppScore').textContent = String(s.scores[1]);
      this.$('dmMyScore').textContent = String(s.scores[0]);
      if (s.phase === 'matchEnd') { this.showMatchEnd(false); return; }
      const r = s.result;
      const nm = R.names(null, this.config.mode === 'ai' ? 'ai' : 'local');
      this.$('dmRoundEm').textContent = r.reason === 'blocked' ? '🚧' : '🁫';
      this.$('dmRoundTitle').textContent = r.tie
        ? T('dm.tie')
        : (r.winner === 0 ? nm.me : nm.opp) + ' — ' + T(r.reason === 'blocked' ? 'dm.end.blocked' : 'dm.end.empty');
      this.$('dmRoundRows').innerHTML = R.scoreRowsHTML(this.game.view(), this.config.mode === 'ai' ? 'ai' : 'local');
      this.showLayer('dmRoundLayer', true);
      if (r.winner === 0) SFX.winRound(); else if (r.winner === 1) SFX.lose(); else SFX.notify();
    },

    showMatchEnd: function (resigned) {
      const s = this.game.state;
      this.finished = true;
      this.clearSave();
      const isAI = this.config.mode === 'ai';
      const iWon = s.matchWinner === 0;
      const nm = R.names(null, isAI ? 'ai' : 'local');
      this.$('dmMatchEm').textContent = (iWon || !isAI) ? '🏆' : '💀';
      this.$('dmMatchTitle').textContent = resigned
        ? (isAI ? T('dm.lost') : T('dm.resign'))
        : (isAI ? (iWon ? T('dm.won') : T('dm.lost')) : (s.matchWinner === 0 ? T('dm.p1won') : T('dm.p2won')));
      /* المكافأة — تسوية المحفظة + تذكرة سجل الجولة (win/loss) */
      let payout = 0;
      if (isAI && iWon && this.betPlaced > 0) {
        const mult = [1.5, 2, 3][this.config.level] || 2;
        payout = Math.round(this.betPlaced * mult);
        const p = this._platform();
        if (p.give) { try { root.giveWin(payout); } catch (e) {} }
        else this.localWallet += payout;
        if (p.winFX) { try { root.winFX(payout); } catch (e) {} }
      }
      /* تذكرة السجل: الفوز والخسارة كلاهما (بما فيه الانسحاب) */
      if (isAI && this.betPlaced > 0) {
        try {
          if (typeof root.recordRound === 'function') {
            root.recordRound(!!(iWon && payout > 0), payout, T(iWon ? 'dm.won' : 'dm.lost'), this.betPlaced, 'do');
          }
        } catch (e) {}
      }
      this.$('dmMatchAmt').innerHTML = (isAI && payout)
        ? '<span class="plus">+' + payout + '</span> <i class="fa-solid fa-coins" aria-hidden="true"></i>'
        : '';
      this.$('dmMatchRows').innerHTML =
        '<div class="dm-srow"><span>' + nm.me + '</span><b>' + s.scores[0] + '</b></div>' +
        '<div class="dm-srow"><span>' + nm.opp + '</span><b>' + s.scores[1] + '</b></div>';
      this.showLayer('dmMatchLayer', true);
      if (isAI && iWon) SFX.winMatch(); else SFX.lose();
      this.betPlaced = 0;   /* حُسمت التسوية — مباراة جديدة تحتاج رهانًا جديدًا */
    },

    toMenu: function () {
      this.clearTimers();
      this.finished = true; this.busy = false; this.selTile = null;
      this.showLayer('dmRoundLayer', false);
      this.showLayer('dmMatchLayer', false);
      this.showLayer('dmResignLayer', false);
      this.showScreen('menu');
      this.refreshResumeBtn();
      SFX.click();
    }
  };

  root.DominoApp = App;
})(typeof self !== 'undefined' ? self : this);
