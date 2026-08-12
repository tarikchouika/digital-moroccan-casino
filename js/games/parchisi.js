/* ═══════════════════════════════════════════
   Digital Moroccan casino — Parchisi Engine
   ═══════════════════════════════════════════ */
"use strict";
const ParchisiApp = {
  bet: 20,
  playerCount: 4,
  difficulty: 'medium',
  humanPlayerIndex: 0,
  engine: null,
  gameActive: false,
  trackPoints: [],
  init() {
    this.canvas = document.getElementById('parchisiCanvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    /* إزالة الـ listener القديم قبل إضافة جديد */
    if (this._clickHandler) {
      this.canvas.removeEventListener('click', this._clickHandler);
    }
    this._clickHandler = (e) => this.handleCanvasClick(e);
    this.canvas.addEventListener('click', this._clickHandler);
    /* وضع الغرفة: استقبال حركات الخصم + بدء تلقائي عند بدء الغرفة */
    if (typeof Rooms !== 'undefined' && Rooms.setGameHandler) {
      Rooms.setGameHandler((d) => ParchisiApp.prRoomMove(d));
      Rooms.setStartHandler((room) => ParchisiApp.prRoomStart(room));
    }
  },
  /* ── وضع الغرفة: أدوات ── */
  inRoomMode() {
    return typeof Rooms !== 'undefined' && Rooms.state &&
      Rooms.state.game_id === 'pr' && Rooms.state.status === 'playing';
  },
  isMyTurn() {
    return !!(this.engine && this.engine.currentPlayerIndex === this.humanPlayerIndex);
  },
  roomPlayerName(i) {
    if (i === this.humanPlayerIndex) return T('parchisi.you');
    if (typeof Rooms !== 'undefined' && Rooms.state && Rooms.state.players[i]) {
      return Rooms.state.players[i].username;
    }
    return 'P' + (i + 1);
  },
  /* بدء تلقائي لكل الأطراف فور بدء الغرفة (ضمان تزامن المحركات) */
  prRoomStart(room) {
    if (!room || room.game_id !== 'pr' || this.gameActive) return;
    this.start();
  },
  /* استقبال حركة خصم: تطبيق حرفي لنفس النرد/القطعة */
  prRoomMove(d) {
    if (!this.gameActive || !this.engine) return;
    if (d.action === 'roll') {
      this.engine.applyRoll(d.data.dice);
      this.draw();
      this.updateUI();
      this.processTurn();
    } else if (d.action === 'move') {
      this.engine.selectPiece(d.data.pieceId);
      this.draw();
      this.updateUI();
      this.processTurn();
    }
  },
  updateSetup() {
    const countEl = document.getElementById('parchisiPlayerCount');
    if (countEl) this.playerCount = parseInt(countEl.value, 10);
    const diffEl = document.getElementById('parchisiDifficulty');
    if (diffEl) this.difficulty = diffEl.value;
  },
  changeBet(d) {
    this.bet = Math.max(10, Math.min(ST.gold, this.bet + d));
    const el = document.getElementById('parchisiBet');
    if (el) el.textContent = this.bet;
  },
  start() {
    const roomMode = this.inRoomMode();
    if (roomMode) {
      /* غرفة: لا رهان، عدد اللاعبين = أعضاء الغرفة، الجميع بشر */
      this.playerCount = Rooms.state.players.length;
      const me = (typeof AUTH !== 'undefined' && AUTH.user) ? AUTH.user : null;
      this.humanPlayerIndex = Rooms.state.players.findIndex(p => p.id === (me && me.id));
      if (this.humanPlayerIndex < 0) this.humanPlayerIndex = 0;
      this.bet = 0;
    } else {
      if (ST.gold < this.bet) {
        toast(T('ts.noc'), 'err');
        return;
      }
      ST.gold -= this.bet;
      save();
      wallet();
    }
    SND.click();
    document.getElementById('parchisiSetup').style.display = 'none';
    document.getElementById('parchisiGame').style.display = 'block';
    this.gameActive = true;
    /* إعادة ضبط حالة الجولة السابقة (إن وُجدت) */
    this._winChecked = false;
    this._winnerIndex = null;
    this._lastDice = '';
    const types = [];
    for (let i = 0; i < this.playerCount; i++) {
      types.push(roomMode ? 'human' : (i === this.humanPlayerIndex ? 'human' : 'ai'));
    }
    this.engine = new ParchisiEngine(this.playerCount, types, this.difficulty);
    this.engine.onStateChange = () => {
      this.draw();
      this.updateUI();
      if (this.engine.gameOver) {
        this.handleGameOver();
        return;
      }
      /* إشعار الأسر: قطعة خصم أُعيدت إلى home (+20، أو بلا مكافأة عند الدهس في الساليدة) */
      if (this.engine.lastCapture) {
        const c = this.engine.lastCapture;
        this.engine.lastCapture = null;
        const bonus = c.despachurro ? '' : ' (+20)';
        toast(T('parchisi.capture') + ' ' + this.roomPlayerName(c.victim) + bonus, 'ok');
        if (typeof burst === 'function' && this.trackPoints[c.at]) {
          const r = this.canvas.getBoundingClientRect();
          if (r.width) {
            burst(
              r.left + this.trackPoints[c.at].x * (r.width / 600),
              r.top + this.trackPoints[c.at].y * (r.height / 600),
              ['#F5C518', '#EF4444', '#FFFFFF'],
              10, 4
            );
          }
        }
        if (typeof SND !== 'undefined' && SND.win) SND.win();
      }
      /* إشعار دخول الميتا: +10 */
      if (this.engine.bonusNotice !== null) {
        this.engine.bonusNotice = null;
        toast(T('parchisi.entry10'), 'ok');
      }
      /* إشعار كارثة 3 ستات */
      if (this.engine.catastropheNotice !== null) {
        const cpid = this.engine.catastropheNotice;
        this.engine.catastropheNotice = null;
        toast(T('parchisi.catastrophe') + ' ' + this.roomPlayerName(cpid), 'warn');
        return; /* التمرير يحدث في استدعاء onStateChange الثاني من applyRoll */
      }
      /* إشعار «لا حركة»: الدور انتقل تلقائياً (لا processTurn هنا —
         التمرير يحدث في استدعاء onStateChange الثاني من applyRoll) */
      if (this.engine.noMoveNotice !== null) {
        const pid = this.engine.noMoveNotice;
        this.engine.noMoveNotice = null;
        toast(T('parchisi.nomove') + ' ' + this.roomPlayerName(pid), 'warn');
        return;
      }
      this.processTurn();
    };
    this.engine.startGame();
    this.draw();
    this.updateUI();
    this.processTurn();
  },
  draw() {
    const ctx = this.ctx;
    const w = 600;
    const h = 600;
    if (!ctx) return;
    /* خلفية متدرجة فاخرة */
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#0c1322');
    bg.addColorStop(0.5, '#17213c');
    bg.addColorStop(1, '#0a0f1c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    /* إطار ذهبي داخلي */
    ctx.strokeStyle = 'rgba(245,197,24,0.30)';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    const pts = [];
    const margin = 60;
    const corners = [
      { x: margin, y: margin },
      { x: w - margin, y: margin },
      { x: w - margin, y: h - margin },
      { x: margin, y: h - margin }
    ];
    for (let s = 0; s < 4; s++) {
      const start = corners[s];
      const end = corners[(s + 1) % 4];
      for (let i = 0; i < 17; i++) {
        const t = i / 17;
        pts.push({
          x: start.x + (end.x - start.x) * t,
          y: start.y + (end.y - start.y) * t
        });
      }
    }
    this.trackPoints = pts;
    /* خط المسار المستمر الخافت */
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.restore();
    /* نقاط المسار + الخلايا الآمنة (نجوم ذهبية متوهجة) +
       الممر الأخير ملوّن بلون اللاعب + الحواجز بحلقة بيضاء متقطعة */
    const safe = this.engine ? this.engine.SAFE_CELLS : [];
    const stretchOf = {};
    const barrierCells = [];
    if (this.engine) {
      for (let pl = 0; pl < this.engine.players.length; pl++) {
        for (let rel = 60; rel <= 67; rel++) {
          stretchOf[this.engine.toGlobal(pl, rel)] = pl;
        }
      }
      for (let i = 0; i < pts.length; i++) {
        if (this.engine.barrierAt(i)) barrierCells.push(i);
      }
    }
    const cols = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B'];
    const colsSoft = ['rgba(239,68,68,0.16)', 'rgba(59,130,246,0.16)', 'rgba(16,185,129,0.16)', 'rgba(245,158,11,0.16)'];
    pts.forEach((p, i) => {
      if (safe.includes(i)) {
        ctx.save();
        ctx.shadowColor = 'rgba(245,197,24,0.9)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#F5C518';
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#7a5c00';
        ctx.fill();
      } else if (stretchOf[i] !== undefined) {
        /* الممر الأخير: دائرة ملونة بلون اللاعب صاحب الممر */
        const pl = stretchOf[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5.5, 0, 2 * Math.PI);
        ctx.fillStyle = colsSoft[pl];
        ctx.fill();
        ctx.strokeStyle = cols[pl];
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#2b3a55';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      if (barrierCells.includes(i)) {
        /* حاجز قطعتين: حلقة بيضاء متقطعة حول الخلية */
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, 2 * Math.PI);
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
    });
    /* مركز اللوحة — شعار ذهبي */
    ctx.save();
    const cg = ctx.createRadialGradient(300, 300, 8, 300, 300, 54);
    cg.addColorStop(0, 'rgba(245,197,24,0.28)');
    cg.addColorStop(1, 'rgba(245,197,24,0.04)');
    ctx.beginPath();
    ctx.arc(300, 300, 54, 0, 2 * Math.PI);
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(245,197,24,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '26px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎲', 300, 302);
    ctx.restore();
    /* قواعد اللاعبين — زوايا ملونة */
    corners.forEach((c, s) => {
      const size = 56;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(c.x - size / 2, c.y - size / 2, size, size, 12);
      else ctx.rect(c.x - size / 2, c.y - size / 2, size, size);
      ctx.fillStyle = colsSoft[s];
      ctx.fill();
      ctx.strokeStyle = cols[s];
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = '11px sans-serif';
      ctx.fillStyle = cols[s];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P' + (s + 1), c.x, c.y - 18);
    });
    if (!this.engine) return;
    /* القطع */
    for (let pl = 0; pl < this.engine.players.length; pl++) {
      const player = this.engine.players[pl];
      player.pieces.forEach(piece => {
        let pos = null;
        if (piece.state === 'home') {
          const base = corners[pl];
          pos = {
            x: base.x + (piece.id % 2) * 16 - 8,
            y: base.y + Math.floor(piece.id / 2) * 16 - 8
          };
        } else if (piece.state === 'onboard') {
          const global = this.engine.toGlobal(pl, piece.position);
          if (global < pts.length) pos = pts[global];
        } else if (piece.state === 'finished') {
          pos = {
            x: 300 + (pl % 2 === 0 ? -20 : 20) + piece.id * 6,
            y: 300 + (pl < 2 ? -20 : 20) + piece.id * 4
          };
        }
        if (pos) {
          /* تمييز القطع القابلة للتحريك بحلقة ذهبية متوهجة */
          if (this.engine.phase === 'SELECT_PIECE' && this.engine.legalMoves.includes(piece)) {
            ctx.save();
            ctx.shadowColor = 'rgba(245,197,24,0.95)';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 11.5, 0, 2 * Math.PI);
            ctx.strokeStyle = '#F5C518';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.restore();
          }
          /* ظل القطعة */
          ctx.beginPath();
          ctx.arc(pos.x + 1, pos.y + 2.5, 8, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fill();
          /* جسم القطعة بتدرج لوني */
          const pg = ctx.createRadialGradient(pos.x - 2, pos.y - 3, 1, pos.x, pos.y, 9);
          pg.addColorStop(0, '#ffffff');
          pg.addColorStop(0.35, cols[pl]);
          pg.addColorStop(1, cols[pl]);
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 8, 0, 2 * Math.PI);
          ctx.fillStyle = pg;
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 2;
          ctx.stroke();
          /* نقطة لمعان */
          ctx.beginPath();
          ctx.arc(pos.x - 2.5, pos.y - 3.5, 2.2, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.fill();
        }
      });
    }
  },
  updateUI() {
    if (!this.engine) return;
    /* كشف نهاية اللعبة (عرض فقط — لا يغيّر منطق المحرك) */
    if (this.gameActive && !this._winChecked) {
      for (let i = 0; i < this.engine.players.length; i++) {
        const pl = this.engine.players[i];
        if (pl.pieces.every(x => x.state === 'finished')) {
          this._winChecked = true;
          this._winnerIndex = i;
          this.engine.gameOver = true;
          this.handleGameOver();
          return;
        }
      }
    }
    const p = this.engine.currentPlayerIndex;
    const player = this.engine.players[p];
    const turnEl = document.getElementById('parchisiTurnLabel');
    if (turnEl) {
      if (this.inRoomMode()) {
        turnEl.textContent = T('parchisi.turn') + ' ' + this.roomPlayerName(p);
      } else {
        turnEl.textContent = T('parchisi.turn') + ' ' +
          (player.type === 'human' ? T('parchisi.you') : 'AI ' + player.id);
      }
    }
    /* في الغرفة: زر النرد مفعّل فقط لصاحب الدور */
    const rollBtn = document.getElementById('parchisiRollBtn');
    if (rollBtn) {
      rollBtn.disabled = this.inRoomMode() && p !== this.humanPlayerIndex;
    }
    const diceEl = document.getElementById('parchisiDiceValue');
    if (diceEl) {
      const val = this.engine.diceValue ? ' ' + this.engine.diceValue : '';
      if (val !== this._lastDice) {
        this._lastDice = val;
        diceEl.textContent = val;
        if (val) {
          diceEl.classList.remove('parchisi-dice-pop');
          void diceEl.offsetWidth;
          diceEl.classList.add('parchisi-dice-pop');
        }
      }
    }
  },
  processTurn() {
    if (!this.gameActive || !this.engine || this.engine.gameOver) return;
    const player = this.engine.players[this.engine.currentPlayerIndex];
    if (player.type === 'ai') {
      setTimeout(() => {
        if (!this.engine || this.engine.gameOver) return;
        if (this.engine.phase === 'BONUS_10') {
          /* AI في طور المكافأة +10: يحرك أقرب قطعة قانونية ثم يكمل */
          if (this.engine.legalMoves.length > 0) {
            const mv = this.engine.legalMoves[0];
            this.engine.selectPiece(mv.id);
            this.draw();
            this.updateUI();
            this.processTurn();
          }
          return;
        }
        if (this.engine.phase === 'WAIT_ROLL') {
          this.engine.rollDice();
          this.draw();
          this.updateUI();
          setTimeout(() => {
            if (!this.engine || this.engine.gameOver) return;
            if (this.engine.phase === 'SELECT_PIECE' || this.engine.phase === 'BONUS_10') {
              const moves = this.engine.legalMoves;
              if (moves.length > 0) {
                this.engine.selectPiece(moves[0].id);
                this.draw();
                this.updateUI();
                this._pieceFx(moves[0], player.id);
              } else {
                this.draw();
                this.updateUI();
              }
              this.processTurn();
            }
          }, 500);
        }
      }, 800);
    }
  },
  handleCanvasClick(e) {
    if (!this.gameActive || !this.engine ||
      (this.engine.phase !== 'SELECT_PIECE' && this.engine.phase !== 'BONUS_10')) return;
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * sx;
    const my = (e.clientY - rect.top) * sy;
    const player = this.engine.players[this.engine.currentPlayerIndex];
    if (player.type !== 'human') return;
    if (this.inRoomMode() && !this.isMyTurn()) return;
    for (const piece of this.engine.legalMoves) {
      const pos = this.getPiecePosition(piece);
      if (pos && Math.hypot(mx - pos.x, my - pos.y) < 12) {
        if (this.inRoomMode()) Rooms.sendMove('move', { pieceId: piece.id });
        this.engine.selectPiece(piece.id);
        this.draw();
        this.updateUI();
        this._pieceFx(piece, player.id);
        this.processTurn();
        return;
      }
    }
  },
  getPiecePosition(piece) {
    const pl = this.engine.currentPlayerIndex;
    const corners = [
      { x: 60, y: 60 },
      { x: 540, y: 60 },
      { x: 540, y: 540 },
      { x: 60, y: 540 }
    ];
    if (piece.state === 'home') {
      const b = corners[pl];
      return {
        x: b.x + (piece.id % 2) * 16 - 8,
        y: b.y + Math.floor(piece.id / 2) * 16 - 8
      };
    } else if (piece.state === 'onboard') {
      const g = this.engine.toGlobal(pl, piece.position);
      return this.trackPoints[g];
    }
    return null;
  },
  rollDice() {
    if (!this.engine || this.engine.phase !== 'WAIT_ROLL') return;
    if (this.inRoomMode()) {
      /* غرفة: صاحب الدور فقط يرمي — يرسل النرد ثم يطبقه حرفياً */
      if (!this.isMyTurn()) {
        toast('⏳ انتظر دورك', 'warn');
        return;
      }
      const d = Math.floor(Math.random() * 6) + 1;
      Rooms.sendMove('roll', { dice: d });
      this.engine.applyRoll(d);
      this.draw();
      this.updateUI();
      return;
    }
    this.engine.rollDice();
    this.draw();
    this.updateUI();
  },
  /* انفجار ذهبي صغير عند وجهة القطعة بعد تحريكها */
  _pieceFx(piece, plId) {
    if (!piece || typeof burst !== 'function') return;
    let pos = null;
    const corners = [
      { x: 60, y: 60 },
      { x: 540, y: 60 },
      { x: 540, y: 540 },
      { x: 60, y: 540 }
    ];
    if (piece.state === 'home') {
      const b = corners[plId];
      pos = {
        x: b.x + (piece.id % 2) * 16 - 8,
        y: b.y + Math.floor(piece.id / 2) * 16 - 8
      };
    } else if (piece.state === 'onboard') {
      const g = this.engine.toGlobal(plId, piece.position);
      if (g < this.trackPoints.length) pos = this.trackPoints[g];
    }
    if (!pos) return;
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    burst(
      r.left + pos.x * (r.width / 600),
      r.top + pos.y * (r.height / 600),
      ['#F5C518', '#FFD93D', '#34D399'],
      10,
      3
    );
  },
  autoMove() {
    if (!this.engine || (this.engine.phase !== 'SELECT_PIECE' && this.engine.phase !== 'BONUS_10') ||
      this.engine.legalMoves.length === 0) return;
    if (this.inRoomMode() && !this.isMyTurn()) return;
    const mv = this.engine.legalMoves[0];
    if (this.inRoomMode()) Rooms.sendMove('move', { pieceId: mv.id });
    this.engine.selectPiece(mv.id);
    this.draw();
    this.updateUI();
    this.processTurn();
  },
  handleGameOver() {
    if (!this.gameActive) return; /* حماية من النداء المزدوج */
    this.gameActive = false;
    const win = typeof this._winnerIndex === 'number' && this._winnerIndex === this.humanPlayerIndex;
    /* دفع الفائز في وضع اللعب الفردي (RTP 95%):
       مكسب = رهان × مضاعف حسب عدد اللاعبين */
    let paid = 0;
    if (win && !this.inRoomMode()) {
      const mult = { 2: 1.9, 3: 2.85, 4: 3.8 }[this.playerCount] || 1.9;
      paid = Math.floor(this.bet * mult);
      give(paid);
      winFX(paid);
    }
    const msg = (win ? T('parchisi.win') : T('parchisi.lose')) +
      (paid > 0 ? ' (+' + paid + ' 🪙)' : '');
    const msgEl = document.getElementById('parchisiMessage');
    if (msgEl) msgEl.textContent = msg;
    if (win) {
      toast(T('parchisi.win') + ' 🏆' + (paid > 0 ? ' +' + paid : ''), 'ok');
      if (typeof celebrate === 'function') celebrate(true);
    } else {
      toast(T('parchisi.lose'), 'info');
      SND.lose();
    }
    /* سجل الجولات الحي */
    if (typeof recordRound === 'function') {
      recordRound(win, paid, win
        ? ('فزت بالـ Parchisi 🏆' + (paid > 0 ? ' +' + paid : ''))
        : 'خسرت الـ Parchisi');
    }
  },
  close() {
    this.gameActive = false;
    if (typeof closeGamePage === 'function') {
      closeGamePage();
    }
  }
};
/* ── محرك Parchisi ── */
class ParchisiEngine {
  constructor(pc, types, diff) {
    this.playerCount = pc;
    this.players = [];
    this.difficulty = diff;
    for (let i = 0; i < pc; i++) {
      this.players.push(new ParchisiPlayer(i, types[i]));
    }
    this.currentPlayerIndex = 0;
    this.diceValue = 0;
    this.phase = 'WAIT_ROLL';
    this.legalMoves = [];
    this.gameOver = false;
    /* قواعد البارشيسي الإسباني الحقيقية: 12 خلية آمنة (4 ساليدات + 8)،
       خروج بـ5، 6 = رمية إضافية (حد 3)، الدخول للميتا بنرد مضبوط، أكل = +20 */
    this.SAFE_CELLS = [0, 5, 12, 17, 22, 29, 34, 39, 46, 51, 56, 63];
    this.FINISH = 68; /* 68 = الميتا؛ الممر الأخير = الخانات 60..67 */
    this.EXIT_DICE = 5;
    this.onStateChange = null;
    this.noMoveNotice = null;
    this.lastCapture = null;
    this.bonusNotice = null; /* إدخال قطعة → +10 */
    this.catastropheNotice = null; /* 3 ستات متتالية */
    this._sixStreak = 0;
    this._lastMoved = null;
  }
  startGame() {
    this.currentPlayerIndex = 0;
    this.phase = 'WAIT_ROLL';
    this._sixStreak = 0;
    this._lastMoved = null;
  }
  rollDice() {
    this.applyRoll(Math.floor(Math.random() * 6) + 1);
  }
  /* تطبيق نرد حرفي (وضع الغرفة) */
  applyRoll(dice) {
    this.diceValue = dice;
    SND.dice();
    const p = this.players[this.currentPlayerIndex];
    this.legalMoves = [];
    if (dice === 6) this._sixStreak++; else this._sixStreak = 0;
    /* كارثة: 3 ستات متتالية → آخر قطعة تحركت تعود للقاعدة (إلا في الممر) */
    if (this._sixStreak === 3) {
      this._sixStreak = 0;
      const lm = this._lastMoved;
      if (lm && lm.state === 'onboard' && lm.position < 60) {
        lm.state = 'home';
        lm.position = -1;
        this.catastropheNotice = p.id;
      } else {
        this.noMoveNotice = p.id;
      }
      this.phase = 'WAIT_ROLL';
      this.diceValue = 0;
      if (this.onStateChange) this.onStateChange();
      this._passTurn();
      return;
    }
    /* لا قطع في القاعدة + نرد 6 → حركة 7 */
    const eff = (dice === 6 && !this.anyInHome()) ? 7 : dice;
    for (let i = 0; i < p.pieces.length; i++) {
      if (this.canMoveDist(p.pieces[i], eff, dice)) this.legalMoves.push(p.pieces[i]);
    }
    /* حاجز خاص + 6 → فتحه إلزامي (إن أمكن) */
    if (dice === 6 && this.ownBarrier()) {
      const forced = this.legalMoves.filter(pc => pc.state === 'onboard' && this.isInOwnBarrier(pc));
      if (forced.length > 0) this.legalMoves = forced;
    }
    if (this.legalMoves.length === 0) {
      this.noMoveNotice = p.id;
      this.phase = 'WAIT_ROLL';
      this.diceValue = 0;
      if (this.onStateChange) this.onStateChange();
      this._passTurn();
      return;
    }
    this.phase = 'SELECT_PIECE';
    if (this.onStateChange) this.onStateChange();
  }
  anyInHome() {
    return this.players[this.currentPlayerIndex].pieces.some(x => x.state === 'home');
  }
  ownBarrier() {
    const p = this.players[this.currentPlayerIndex];
    const seen = {};
    for (const pc of p.pieces) {
      if (pc.state !== 'onboard') continue;
      const g = this.toGlobal(p.id, pc.position);
      seen[g] = (seen[g] || 0) + 1;
      if (seen[g] >= 2) return true;
    }
    return false;
  }
  barrierAt(g) {
    for (const pl of this.players) {
      let n = 0;
      for (const pc of pl.pieces) {
        if (pc.state === 'onboard' && this.toGlobal(pl.id, pc.position) === g) n++;
      }
      if (n >= 2) return true;
    }
    return false;
  }
  isInOwnBarrier(piece) {
    const p = this.players[this.currentPlayerIndex];
    const g = this.toGlobal(p.id, piece.position);
    for (const pc of p.pieces) {
      if (pc === piece || pc.state !== 'onboard') continue;
      if (this.toGlobal(p.id, pc.position) === g) return true;
    }
    return false;
  }
  canMoveDist(piece, dist, dice) {
    const p = this.players[this.currentPlayerIndex];
    if (piece.state === 'finished') return false;
    if (piece.state === 'home') {
      if (dice !== this.EXIT_DICE) return false;
      const g = this.toGlobal(p.id, 0);
      let own = 0;
      for (const pc of p.pieces) {
        if (pc.state === 'onboard' && this.toGlobal(p.id, pc.position) === g) own++;
      }
      return own < 2; /* حد قطعتين بالساليدة */
    }
    const target = piece.position + dist;
    if (target > this.FINISH) return false; /* دخول بنرد مضبوط */
    if (target === this.FINISH) return true;
    for (let s = 1; s < dist; s++) {
      if (this.barrierAt(this.toGlobal(p.id, piece.position + s))) return false; /* لا مرور فوق الحواجز */
    }
    return this.canLand(p, target);
  }
  canLand(p, target) {
    const g = this.toGlobal(p.id, target);
    let own = 0, opp = 0, capturable = 0;
    for (const pl of this.players) {
      for (const pc of pl.pieces) {
        if (pc.state !== 'onboard' || this.toGlobal(pl.id, pc.position) !== g) continue;
        if (pl.id === p.id) own++;
        else {
          opp++;
          if (!this.SAFE_CELLS.includes(g) && pc.position < 60) capturable++;
        }
      }
    }
    if (capturable >= 2) return false; /* حاجز خصم لا يُكسر */
    if (capturable === 1) return true; /* أكل */
    if (own >= 2 || own + opp > 2) return false; /* حد قطعتين بالخلية */
    return true;
  }
  selectPiece(id) {
    const p = this.players[this.currentPlayerIndex];
    const piece = p.pieces.find(x => x.id === id);
    if (!piece || !this.legalMoves.includes(piece)) return;
    const bonus = this.phase === 'BONUS_10';
    if (piece.state === 'home') {
      piece.state = 'onboard';
      piece.position = 0;
      this.eatOnSalida(p.id);
    } else {
      const dist = bonus ? 10 : ((this.diceValue === 6 && !this.anyInHome()) ? 7 : this.diceValue);
      const target = piece.position + dist;
      if (target === this.FINISH) {
        piece.state = 'finished';
        piece.position = -1;
        if (!bonus) this.bonusNotice = p.id;
      } else {
        piece.position = target;
        this.captureChain(piece, p.id);
      }
    }
    this._lastMoved = piece;
    if (this.bonusNotice !== null && this.phase !== 'BONUS_10') {
      /* مكافأة +10: يمكن تحريك قطعة أخرى بعد الدخول للميتا */
      this.phase = 'BONUS_10';
      this.legalMoves = p.pieces.filter(pc => pc.state === 'onboard' && this.canMoveDist(pc, 10, this.diceValue));
      if (this.legalMoves.length > 0) {
        if (this.onStateChange) this.onStateChange();
        return;
      }
      this._resolveTurnEnd();
      return;
    }
    this._resolveTurnEnd();
  }
  _resolveTurnEnd() {
    if (this.diceValue === 6 && this._sixStreak < 3) {
      /* رمية إضافية */
      this.phase = 'WAIT_ROLL';
      this.legalMoves = [];
      this.diceValue = 0;
      if (this.onStateChange) this.onStateChange();
    } else {
      this._passTurn();
    }
  }
  _passTurn() {
    this.phase = 'WAIT_ROLL';
    this.diceValue = 0;
    this.legalMoves = [];
    this._sixStreak = 0;
    this._lastMoved = null;
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerCount;
    if (this.onStateChange) this.onStateChange();
  }
  toGlobal(pid, rel) {
    const off = [0, 17, 34, 51];
    if (rel < 60) return (off[pid] + rel) % 68;
    return (off[pid] - 8 + (rel - 60) + 68) % 68; /* الممر الأخير: 8 خلايا قبل الساليدة */
  }
  /* أكل قطعة وحيدة في خلية غير آمنة → +20 وقد يدخل الميتا */
  captureChain(piece, pid) {
    for (let guard = 0; guard < 10; guard++) {
      const g = this.toGlobal(pid, piece.position);
      if (piece.position >= 60) break; /* الممر محمي */
      if (this.SAFE_CELLS.includes(g)) break; /* الآمن محمي */
      const targets = [];
      for (const opp of this.players) {
        if (opp.id === pid) continue;
        for (const op of opp.pieces) {
          if (op.state !== 'onboard' || op.position >= 60) continue;
          if (this.toGlobal(opp.id, op.position) === g) targets.push(op);
        }
      }
      if (targets.length === 0 || targets.length >= 2) break; /* حاجز خصم لا يُكسر */
      targets[0].state = 'home';
      targets[0].position = -1;
      this.lastCapture = { victim: targets[0].owner, by: pid, at: g, count: 1 };
      const np = piece.position + 20;
      if (np >= this.FINISH) {
        piece.state = 'finished';
        piece.position = -1;
        this.bonusNotice = pid;
        return;
      }
      piece.position = np;
    }
  }
  /* دهس الخصوم عند الخروج على الساليدة (بلا مكافأة) */
  eatOnSalida(pid) {
    const g = this.toGlobal(pid, 0);
    for (const opp of this.players) {
      if (opp.id === pid) continue;
      for (const op of opp.pieces) {
        if (op.state === 'onboard' && this.toGlobal(opp.id, op.position) === g) {
          op.state = 'home';
          op.position = -1;
          this.lastCapture = { victim: opp.id, by: pid, at: g, count: 1, despachurro: true };
        }
      }
    }
  }
}
class ParchisiPlayer {
  constructor(id, type) {
    this.id = id;
    this.type = type;
    this.pieces = [];
    for (let i = 0; i < 4; i++) {
      this.pieces.push({ id: i, state: 'home', position: -1, owner: this.id });
    }
  }
}
