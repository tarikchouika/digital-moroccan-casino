/* ══════════════════════════════════════════════════════════════════
   Digital Moroccan casino — الشطرنج الدولي (Chess)
   محرك قواعد كامل بالمعايير الدولية (FIDE):
   • التبييت (كلا الجهتين بشروطه) • الأخذ بالتجاوز (en passant)
   • الترقية باختيار القطعة • الكش/كش مات/التعادل بالجمود (stalemate)
   • قاعدة 50 حركة • تكرار الموقع ثلاثاً • نقص المواد
   أنماط اللعب: وجه لوجه محلي • غرفة أونلاين (رهان اختياري) • بوت تدريبي
   الإحداثيات: صف 0 = الرتبة 8 (أعلى، جهة الأسود) • عمود 0 = a
   ══════════════════════════════════════════════════════════════════ */
"use strict";

/* ─────────────── المحرك النقي (بلا DOM) ─────────────── */

function chessNewState() {
  var state = {
    board: [
      ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
      ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
      ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ],
    turn: 'w',
    log: [],                 /* تدوين الحركات */
    captured: { w: [], b: [] },   /* ما أخذه كل طرف */
    castling: { K: true, Q: true, k: true, q: true },
    ep: null,                    /* خانة العبور للأخذ بالتجاوز */
    half: 0, full: 1,
    over: false, outcome: null,  /* outcome: 'w' | 'b' | 'draw' */
    endReason: null,             /* mate/stalemate/50move/rep/material/agreed */
    log: [],                     /* نصوص الحركات */
    rep: {}                      /* عدّاد تكرار الموقع */
  };
  /* [FIDE] الوضع الافتتاحي يُحتسب في التكرار الثلاثي */
  state.rep[chessPosKey(state)] = 1;
  return state;
}

function chessCloneState(s) {
  var b = [];
  for (var r = 0; r < 8; r++) {
    var row = [];
    for (var c = 0; c < 8; c++) row.push(s.board[r][c]);
    b.push(row);
  }
  return {
    board: b, turn: s.turn,
    castling: { K: s.castling.K, Q: s.castling.Q, k: s.castling.k, q: s.castling.q },
    ep: s.ep ? [s.ep[0], s.ep[1]] : null,
    half: s.half, full: s.full,
    over: s.over, outcome: s.outcome, endReason: s.endReason,
    log: s.log.slice(),
    captured: { w: (s.captured ? s.captured.w : []).slice(), b: (s.captured ? s.captured.b : []).slice() },
    rep: Object.assign({}, s.rep)   /* نسخة مستقلة — عدّاد التكرار لا يتسرب بين الفروع */
  };
}

function chessInB(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function chessIsWhite(p) { return !!p && p === p.toUpperCase(); }
function chessType(p) { return p ? p.toUpperCase() : null; }
function chessOther(c) { return c === 'w' ? 'b' : 'w'; }

/* مفتاح الموقع (للحكم على التكرار الثلاثي): الرقعة + الدور + حقوق التبييت + التجاوز */
function chessPosKey(s) {
  var k = '';
  for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) k += (s.board[r][c] || '.');
  k += '|' + s.turn + '|';
  k += (s.castling.K ? 'K' : '') + (s.castling.Q ? 'Q' : '') + (s.castling.k ? 'k' : '') + (s.castling.q ? 'q' : '');
  k += '|' + (s.ep ? s.ep[0] + ',' + s.ep[1] : '-');
  return k;
}

var CHESS_N = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
var CHESS_KD = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
var CHESS_DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
var CHESS_ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/* هل الخانة (r,c) مهددة من قطع اللون byWhite؟ */
function chessAttacked(board, r, c, byWhite) {
  var rr, cc, i, d, p;
  /* جنود: يهدّدون قطرياً باتجاه تقدمهم */
  var pr = byWhite ? r + 1 : r - 1;   /* الجندي الأبيض في (pr, c±1) يهدّد (r,c) */
  for (i = -1; i <= 1; i += 2) {
    rr = pr; cc = c + i;
    if (chessInB(rr, cc)) {
      p = board[rr][cc];
      if (p && chessType(p) === 'P' && chessIsWhite(p) === byWhite) return true;
    }
  }
  /* فرسان */
  for (i = 0; i < 8; i++) {
    rr = r + CHESS_N[i][0]; cc = c + CHESS_N[i][1];
    if (chessInB(rr, cc)) {
      p = board[rr][cc];
      if (p && chessType(p) === 'N' && chessIsWhite(p) === byWhite) return true;
    }
  }
  /* ملك (لمنع التبييت عبر خانة مهددة) */
  for (i = 0; i < 8; i++) {
    rr = r + CHESS_KD[i][0]; cc = c + CHESS_KD[i][1];
    if (chessInB(rr, cc)) {
      p = board[rr][cc];
      if (p && chessType(p) === 'K' && chessIsWhite(p) === byWhite) return true;
    }
  }
  /* انزلاق قطري: فيلة/ملكات */
  for (i = 0; i < 4; i++) {
    d = CHESS_DIAG[i]; rr = r + d[0]; cc = c + d[1];
    while (chessInB(rr, cc)) {
      p = board[rr][cc];
      if (p) {
        var t = chessType(p);
        if (chessIsWhite(p) === byWhite && (t === 'B' || t === 'Q')) return true;
        break;
      }
      rr += d[0]; cc += d[1];
    }
  }
  /* انزلاق مستقيم: رخاخ/ملكات */
  for (i = 0; i < 4; i++) {
    d = CHESS_ORTH[i]; rr = r + d[0]; cc = c + d[1];
    while (chessInB(rr, cc)) {
      p = board[rr][cc];
      if (p) {
        var t2 = chessType(p);
        if (chessIsWhite(p) === byWhite && (t2 === 'R' || t2 === 'Q')) return true;
        break;
      }
      rr += d[0]; cc += d[1];
    }
  }
  return false;
}

function chessKingPos(board, white) {
  var target = white ? 'K' : 'k';
  for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
    if (board[r][c] === target) return [r, c];
  }
  return null;
}

function chessInCheck(s, white) {
  var kp = chessKingPos(s.board, white);
  if (!kp) return false;
  return chessAttacked(s.board, kp[0], kp[1], !white);
}

/* حركات شبه قانونية لقطعة (بلا فحص أمان الملك) */
function chessPseudoMoves(s, r, c) {
  var p = s.board[r][c];
  if (!p) return [];
  var white = chessIsWhite(p);
  var t = chessType(p);
  var out = [];
  var i, d, rr, cc, q;
  function push(tr, tc, extra) {
    var tp = s.board[tr][tc];
    if (tp && chessIsWhite(tp) === white) return false;
    var mv = { from: [r, c], to: [tr, tc], piece: p, capture: tp || null };
    if (extra) for (var k in extra) mv[k] = extra[k];
    /* ترقية الجندي */
    if (t === 'P' && ((white && tr === 0) || (!white && tr === 7))) {
      var promos = ['q', 'r', 'b', 'n'];
      for (var pi = 0; pi < 4; pi++) {
        out.push(Object.assign({}, mv, { promo: promos[pi] }));
      }
    } else {
      out.push(mv);
    }
    return !tp;   /* يمكن المواصلة إن كانت فارغة */
  }
  if (t === 'P') {
    var dir = white ? -1 : 1;
    var startRow = white ? 6 : 1;
    /* تقدم للأمام (بلا أكل) */
    rr = r + dir;
    if (chessInB(rr, c) && !s.board[rr][c]) {
      push(rr, c);
      var rr2 = r + 2 * dir;
      if (r === startRow && !s.board[rr2][c]) push(rr2, c, { double: true });
    }
    /* أكل قطري + أخذ بالتجاوز */
    for (i = -1; i <= 1; i += 2) {
      rr = r + dir; cc = c + i;
      if (!chessInB(rr, cc)) continue;
      var tp = s.board[rr][cc];
      if (tp && chessIsWhite(tp) !== white) push(rr, cc);
      else if (!tp && s.ep && s.ep[0] === rr && s.ep[1] === cc) {
        out.push({ from: [r, c], to: [rr, cc], piece: p, capture: s.board[r][cc], ep: true });
      }
    }
  } else if (t === 'N') {
    for (i = 0; i < 8; i++) {
      rr = r + CHESS_N[i][0]; cc = c + CHESS_N[i][1];
      if (chessInB(rr, cc)) push(rr, cc);
    }
  } else if (t === 'K') {
    for (i = 0; i < 8; i++) {
      rr = r + CHESS_KD[i][0]; cc = c + CHESS_KD[i][1];
      if (chessInB(rr, cc)) push(rr, cc);
    }
    /* التبييت — يُفحص بالكامل هنا (الشروط القانونية كاملة) */
    var homeRow = white ? 7 : 0;
    if (r === homeRow && c === 4 && !chessInCheck(s, white)) {
      var kRight = white ? s.castling.K : s.castling.k;
      var qRight = white ? s.castling.Q : s.castling.q;
      var rookK = white ? 'R' : 'r', rookQ = rookK;
      /* جهة الملك: f/g فارغتان، الرخ في h، e/f/g غير مهددة */
      if (kRight && s.board[homeRow][5] === null && s.board[homeRow][6] === null
          && s.board[homeRow][7] === rookK
          && !chessAttacked(s.board, homeRow, 5, !white)
          && !chessAttacked(s.board, homeRow, 6, !white)) {
        out.push({ from: [r, c], to: [homeRow, 6], piece: p, capture: null, castle: 'K' });
      }
      /* جهة الملكة: b/c/d فارغات، الرخ في a، e/d/c غير مهددة */
      if (qRight && s.board[homeRow][1] === null && s.board[homeRow][2] === null && s.board[homeRow][3] === null
          && s.board[homeRow][0] === rookQ
          && !chessAttacked(s.board, homeRow, 3, !white)
          && !chessAttacked(s.board, homeRow, 2, !white)) {
        out.push({ from: [r, c], to: [homeRow, 2], piece: p, capture: null, castle: 'Q' });
      }
    }
  } else {
    var dirs = (t === 'B') ? CHESS_DIAG : (t === 'R') ? CHESS_ORTH : CHESS_DIAG.concat(CHESS_ORTH);
    for (i = 0; i < dirs.length; i++) {
      d = dirs[i]; rr = r + d[0]; cc = c + d[1];
      while (chessInB(rr, cc)) {
        if (!push(rr, cc)) break;
        rr += d[0]; cc += d[1];
      }
    }
  }
  return out;
}

/* تطبيق حركة شبه قانونية على نسخة — لفحص أمان الملك */
function chessApplyPseudo(s, mv) {
  var white = chessIsWhite(mv.piece);
  var fr = mv.from[0], fc = mv.from[1], tr = mv.to[0], tc = mv.to[1];
  if (mv.ep) s.board[mv.from[0]][mv.to[1]] = null;          /* الجندي المُتجاوَز */
  s.board[tr][tc] = mv.piece;
  s.board[fr][fc] = null;
  if (mv.promo) s.board[tr][tc] = white ? mv.promo.toUpperCase() : mv.promo;
  if (mv.castle) {
    var homeRow = white ? 7 : 0;
    if (mv.castle === 'K') { s.board[homeRow][5] = s.board[homeRow][7]; s.board[homeRow][7] = null; }
    else { s.board[homeRow][3] = s.board[homeRow][0]; s.board[homeRow][0] = null; }
  }
}

/* كل الحركات القانونية للاعب الدور */
function chessLegalMoves(s) {
  if (s.over) return [];
  var out = [];
  for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
    var p = s.board[r][c];
    if (!p || chessIsWhite(p) !== (s.turn === 'w')) continue;
    var pseudo = chessPseudoMoves(s, r, c);
    for (var i = 0; i < pseudo.length; i++) {
      var mv = pseudo[i];
      var s2 = chessCloneState(s);
      chessApplyPseudo(s2, mv);
      if (!chessInCheck(s2, s.turn === 'w')) out.push(mv);
    }
  }
  return out;
}

/* الحركات القانونية لقطعة محددة (للواجهة) */
function chessMovesForPiece(s, r, c) {
  var p = s.board[r][c];
  if (!p || s.over || chessIsWhite(p) !== (s.turn === 'w')) return [];
  var mine = chessLegalMoves(s).filter(function (m) { return m.from[0] === r && m.from[1] === c; });
  return mine;
}

/* ملاحظة الحركة: رمز + من–إلى + لاحقات */
function chessNotation(mv) {
  var t = chessType(mv.piece);
  var glyph = { P: '', N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔' }[t] || '';
  var files = 'abcdefgh';
  var from = files[mv.from[1]] + (8 - mv.from[0]);
  var to = files[mv.to[1]] + (8 - mv.to[0]);
  var txt = (t === 'P' ? '' : glyph + ' ') + from + (mv.capture ? '×' : '–') + to;
  if (mv.promo) txt += '=' + { q: '♕', r: '♖', b: '♗', n: '♘' }[mv.promo];
  if (mv.castle) txt = mv.castle === 'K' ? 'O-O' : 'O-O-O';
  return txt;
}

/* تطبيق حركة قانونية على الحالة (تغيير مباشر) — يعيد معلومات النتيجة */
function chessMakeMove(s, mv) {
  var white = chessIsWhite(mv.piece);
  var info = { captured: null, check: false, mate: false, draw: false, end: null };
  var fr = mv.from[0], fc = mv.from[1], tr = mv.to[0], tc = mv.to[1];
  /* سجل نصي قبل التنفيذ */
  var note = chessNotation(mv);
  /* الأخذ (بما فيه التجاوز) */
  if (mv.ep) {
    info.captured = s.board[fr][tc];
    s.board[fr][tc] = null;
  } else if (s.board[tr][tc]) {
    info.captured = s.board[tr][tc];
  }
  if (info.captured && s.captured) s.captured[white ? 'w' : 'b'].push(info.captured);
  /* نقل */
  s.board[tr][tc] = mv.piece;
  s.board[fr][fc] = null;
  if (mv.promo) s.board[tr][tc] = white ? mv.promo.toUpperCase() : mv.promo;
  /* التبييت: انقل الرخ */
  if (mv.castle) {
    var homeRow = white ? 7 : 0;
    if (mv.castle === 'K') { s.board[homeRow][5] = s.board[homeRow][7]; s.board[homeRow][7] = null; }
    else { s.board[homeRow][3] = s.board[homeRow][0]; s.board[homeRow][0] = null; }
  }
  /* حقوق التبييت */
  if (mv.piece === 'K') { s.castling.K = false; s.castling.Q = false; }
  if (mv.piece === 'k') { s.castling.k = false; s.castling.q = false; }
  if (fr === 7 && fc === 0 || tr === 7 && tc === 0) s.castling.Q = false;
  if (fr === 7 && fc === 7 || tr === 7 && tc === 7) s.castling.K = false;
  if (fr === 0 && fc === 0 || tr === 0 && tc === 0) s.castling.q = false;
  if (fr === 0 && fc === 7 || tr === 0 && tc === 7) s.castling.k = false;
  /* التجاوز: خانة العبور لل doble */
  s.ep = null;
  if (mv.double) s.ep = [(fr + tr) / 2, fc];
  /* الساعات */
  if (chessType(mv.piece) === 'P' || info.captured) s.half = 0; else s.half++;
  if (!white) s.full++;
  /* الدور */
  s.turn = chessOther(s.turn);
  /* كش/نهايات */
  var oppWhite = s.turn === 'w';
  info.check = chessInCheck(s, oppWhite);
  var oppMoves = chessLegalMoves(s).length;
  if (oppMoves === 0) {
    if (info.check) {
      info.mate = true;
      s.over = true; s.outcome = white ? 'w' : 'b'; s.endReason = 'mate';
      note += '#';
    } else {
      info.draw = true;
      s.over = true; s.outcome = 'draw'; s.endReason = 'stalemate';
    }
  } else if (info.check) note += '+';
  /* تعادلات */
  if (!s.over) {
    if (s.half >= 100) { s.over = true; s.outcome = 'draw'; s.endReason = '50move'; info.draw = true; }
    else {
      var key = chessPosKey(s);
      s.rep[key] = (s.rep[key] || 0) + 1;
      if (s.rep[key] >= 3) { s.over = true; s.outcome = 'draw'; s.endReason = 'rep'; info.draw = true; }
    }
  }
  if (!s.over && chessInsufficient(s)) { s.over = true; s.outcome = 'draw'; s.endReason = 'material'; info.draw = true; }
  if (s.log) s.log.push(note);
  info.note = note;
  return info;
}

/* نقص المواد: ملك ضد ملك / ملك+فارس / ملك+فيل / فيلا نفس اللون */
function chessInsufficient(s) {
  var minors = [];   /* [type, color-square] */
  for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
    var p = s.board[r][c];
    if (!p) continue;
    var t = chessType(p);
    if (t === 'K') continue;
    if (t === 'P' || t === 'R' || t === 'Q') return false;
    minors.push(t === 'B' ? 'B' + ((r + c) % 2) : 'N');
  }
  if (minors.length === 0) return true;
  if (minors.length === 1) return true;                       /* K+minor ضد K */
  if (minors.length === 2 && minors[0][0] === 'B' && minors[1][0] === 'B'
      && minors[0] === minors[1]) return true;                 /* فيلا نفس اللون */
  return false;
}

/* حالة اللعبة للعرض: null ما دامت جارية */
function chessStatus(s) {
  if (!s.over) return null;
  return { outcome: s.outcome, reason: s.endReason };
}

/* perft — عدّ عقد الشجرة (لاختبار مولّد الحركات) */
function chessPerft(s, depth) {
  if (depth === 0) return 1;
  var moves = chessLegalMoves(s);
  if (depth === 1) return moves.length;
  var n = 0;
  for (var i = 0; i < moves.length; i++) {
    var s2 = chessCloneState(s);
    chessMakeMove(s2, moves[i]);
    n += chessPerft(s2, depth - 1);
  }
  return n;
}

/* ─────────────── ذكاء اصطناعي بسيط (بوت الغرف التدريبية) ─────────────── */
var CHESS_VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
/* مكافأة تقدّم خفيفة: دفع الجنود والملك نحو المنتصف بالمنتصف */
var CHESS_PST_P = [0, 0, 0, 0, 0, 0, 0, 0,
                   50, 50, 50, 50, 50, 50, 50, 50,
                   10, 10, 20, 30, 30, 20, 10, 10,
                   5, 5, 10, 25, 25, 10, 5, 5,
                   0, 0, 0, 20, 20, 0, 0, 0,
                   5, -5, -10, 0, 0, -10, -5, 5,
                   5, 10, 10, -20, -20, 10, 10, 5,
                   0, 0, 0, 0, 0, 0, 0, 0];

function chessEvaluate(s, forWhite) {
  var sc = 0;
  for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
    var p = s.board[r][c];
    if (!p) continue;
    var t = chessType(p);
    var v = CHESS_VAL[t] || 0;
    if (t === 'P') v += chessIsWhite(p) ? CHESS_PST_P[r * 8 + c] : CHESS_PST_P[(7 - r) * 8 + c];
    sc += chessIsWhite(p) ? v : -v;
  }
  return forWhite ? sc : -sc;
}

var CHESS_AI_WIN = 100000;
function chessSearch(s, depth, alpha, beta, aiWhite) {
  if (s.over) {
    if (s.outcome === 'draw') return 0;
    return (s.outcome === (aiWhite ? 'w' : 'b')) ? CHESS_AI_WIN - s.full : -CHESS_AI_WIN + s.full;
  }
  if (depth <= 0) return chessEvaluate(s, aiWhite);
  var moves = chessLegalMoves(s);
  /* الأكلات أولاً (تقليم أسرع) */
  moves.sort(function (a, b) {
    var va = a.capture ? (CHESS_VAL[chessType(a.capture)] || 0) - (CHESS_VAL[chessType(a.piece)] || 0) / 10 : -50;
    var vb = b.capture ? (CHESS_VAL[chessType(b.capture)] || 0) - (CHESS_VAL[chessType(b.piece)] || 0) / 10 : -50;
    return vb - va;
  });
  var best = -CHESS_AI_WIN * 2;
  for (var i = 0; i < moves.length; i++) {
    var s2 = chessCloneState(s);
    chessMakeMove(s2, moves[i]);
    var sc = -chessSearch(s2, depth - 1, -beta, -alpha, !aiWhite);
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  if (!moves.length) return 0;   /* (مغطى بـ s.over) */
  return best;
}

function chessPickMove(s, maxDepth, budgetMs) {
  var moves = chessLegalMoves(s);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  var aiWhite = (s.turn === 'w');
  var t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  var best = moves[Math.floor(Math.random() * moves.length)];
  for (var d = 1; d <= (maxDepth || 2); d++) {
    var scored = [];
    var alpha = -CHESS_AI_WIN * 2;
    for (var i = 0; i < moves.length; i++) {
      var s2 = chessCloneState(s);
      chessMakeMove(s2, moves[i]);
      var sc = -chessSearch(s2, d - 1, -CHESS_AI_WIN * 2, -alpha, !aiWhite);
      scored.push({ m: moves[i], s: sc });
      if (sc > alpha) alpha = sc;
    }
    scored.sort(function (a, b) { return b.s - a.s; });
    /* تنويع بسيط ضمن نافذة ضيقة من الأفضل (حتمي عند الفارق الكبير) */
    var bestScore = scored[0].s;
    var pool = scored.filter(function (x) { return x.s >= bestScore - 25; }).slice(0, 3);
    best = pool[Math.floor(Math.random() * pool.length)].m;
    var now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    if (now - t0 > (budgetMs || 400)) break;
  }
  return best;
}

/* Export للنافذة (تُستعمل من الواجهة والاختبارات) */
window.chessNewState = chessNewState;
window.chessCloneState = chessCloneState;
window.chessLegalMoves = chessLegalMoves;
window.chessMovesForPiece = chessMovesForPiece;
window.chessMakeMove = chessMakeMove;
window.chessPerft = chessPerft;
window.chessPickMove = chessPickMove;
window.chessInCheck = chessInCheck;
window.chessNotation = chessNotation;
window.chessPosKey = chessPosKey;
window.chessInsufficient = chessInsufficient;

/* ══════════════════════════════════════════════════════════════════
   واجهة الشطرنج — وجه لوجه • غرفة أونلاين (رهان اختياري) • بوت تدريبي
   ══════════════════════════════════════════════════════════════════ */

var CHESS = null;
var CHESS_BETS = [0, 25, 50, 100, 250];
var CHESS_TIMERS = [0, 60, 120, 300];
var CHESS_GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };

function chessLevelName() { return T('chess.trainingBot'); }

function eChess(g) {
  var betChips = CHESS_BETS.map(function (b, i) {
    return '<button class="dama-chip' + (i === 0 ? ' on' : '') + '" data-bet="' + b + '" onclick="chessSetBet(' + b + ')">'
      + (b === 0 ? T('chess.friendly') : b + ' 🪙') + '</button>';
  }).join('');
  var timerChips = CHESS_TIMERS.map(function (t, i) {
    return '<button class="dama-chip' + (i === 0 ? ' on' : '') + '" data-t="' + t + '" onclick="chessSetTimer(' + t + ')">'
      + (t === 0 ? T('dama.timerOff') : t + ' ' + T('dama.seconds')) + '</button>';
  }).join('');
  return gFrame(
    '<div class="ch-wrap" id="chessWrap">' +
      /* ── شاشة الإعدادات ── */
      '<div class="dama-setup" id="chessSetup">' +
        '<div class="dama-logo"><span class="ch-logo-em">♞</span></div>' +
        '<div class="dama-title">' + T('chess.title') + '</div>' +
        '<div class="dama-sub">' + T('chess.sub') + '</div>' +
        '<div class="dama-field"><div class="dama-flab">' + T('dama.timer') + ' (' + T('chess.localOnly') + ')</div>' +
          '<div class="dama-timer-row" id="chessTimerRow">' + timerChips + '</div>' +
        '</div>' +
        '<div class="ch-modes">' +
          '<button class="big dama-go" onclick="chessStartLocal()">👥 ' + T('chess.faceToFace') + '</button>' +
          '<button class="big ch-online" onclick="Rooms.toggleFromGame()">🌐 ' + T('chess.onlineRoom') + '</button>' +
        '</div>' +
        '<div class="dama-pay ch-hint">' + T('chess.modeHint') + '</div>' +
      '</div>' +
      /* ── شاشة اللعب ── */
      '<div class="dama-play" id="chessPlay" hidden>' +
        '<div class="ch-side">' +
          '<div class="dama-hud">' +
            '<div class="dama-side" id="chessTop"><span class="ch-cap" id="chessCapTop"></span><span class="dama-lab" id="chessTopName">' + T('chess.black') + '</span><b id="chessMatTop">0</b></div>' +
            '<div class="dama-turn" id="chessTurn">' + T('chess.whiteTurn') + '</div>' +
            '<div class="dama-side" id="chessBot"><b id="chessMatBot">0</b><span class="dama-lab" id="chessBotName">' + T('chess.white') + '</span><span class="ch-cap" id="chessCapBot"></span></div>' +
          '</div>' +
          '<div class="dama-timer" id="chessTimer"></div>' +
          '<div class="ch-log" id="chessLog"></div>' +
          '<div class="dama-status" id="chessStatus"></div>' +
          '<div class="dama-ctrls">' +
            '<button class="dama-mini" id="chessDrawBtn" onclick="chessDrawOffer()">🤝 ' + T('chess.drawBtn') + '</button>' +
            '<button class="dama-mini" onclick="chessResign()">🏳️ ' + T('dama.resignBtn') + '</button>' +
          '</div>' +
          '<div class="dama-drawbar" id="chessDrawBar" hidden>' +
            '<span id="chessDrawTxt"></span>' +
            '<button class="dama-mini ok" onclick="chessDrawAccept(true)">' + T('dama.drawAccept') + '</button>' +
            '<button class="dama-mini no" onclick="chessDrawAccept(false)">' + T('dama.drawDecline') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="ch-boardbox" id="chessBoardBox">' +
          /* أيقونتا اللاعبين: فوق/تحت في البورتريه، يمين/يسار في اللاندسكيه */
          '<div class="ch-seat ch-seat-top"><div class="ch-picon" id="chessTopIcon"><span class="ch-pface">♚</span></div></div>' +
          '<div class="ch-seat ch-seat-bot"><div class="ch-picon" id="chessBotIcon"><span class="ch-pface">♔</span></div></div>' +
          '<div class="ch-board" id="chessBoard"></div>' +
        '</div>' +
        /* اختيار الترقية */
        '<div class="ch-promo" id="chessPromo" hidden>' +
          '<div class="ch-promo-card">' +
            '<div class="ch-promo-t">' + T('chess.promoTitle') + '</div>' +
            '<div class="ch-promo-row" id="chessPromoRow"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      /* ── نافذة النتيجة ── */
      '<div class="dama-over" id="chessOver" hidden>' +
        '<div class="dama-over-card">' +
          '<div class="dama-over-em" id="chessOverEm">🏆</div>' +
          '<div class="dama-over-tx" id="chessOverTx"></div>' +
          '<div class="dama-over-amt" id="chessOverAmt"></div>' +
          '<button class="big dama-go" onclick="chessNewMatch()">↩️ ' + T('dama.newMatch') + '</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  , g).replace('<div class="stage">', '<div class="stage" id="chessStage">');
}

function initChess() {
  CHESS = {
    state: null, mode: 'local', myColor: 'w', sel: null, legal: [],
    flipped: false, autoFlip: true, bet: 0, timer: 0, _turnTi: null, _turnLeft: 0,
    isSpectator: false, oppBot: false, _seq: 0, roomOrder: [], drawBanUntil: 0,
    lastFrom: null, lastTo: null, busy: false, _pendingPromo: null
  };
  chessFitBoard();
  chessRegisterRooms();
}
window.initChess = initChess;
window.eChess = eChess;

function chessSetBet(b) {
  if (!CHESS) return;
  CHESS.bet = b;
  var chips = document.querySelectorAll('#chessBet .dama-chip');
  for (var i = 0; i < chips.length; i++) chips[i].classList.toggle('on', +chips[i].getAttribute('data-bet') === b);
  if (typeof SND !== 'undefined' && SND.click) SND.click();
}
function chessSetTimer(t) {
  if (!CHESS) return;
  CHESS.timer = t;
  var chips = document.querySelectorAll('#chessTimerRow .dama-chip');
  for (var i = 0; i < chips.length; i++) chips[i].classList.toggle('on', +chips[i].getAttribute('data-t') === t);
  if (typeof SND !== 'undefined' && SND.click) SND.click();
}

/* حجم اللوحة */
var _chessBoardRO = null;
function chessFitBoard() {
  var box = document.getElementById('chessBoardBox');
  var board = document.getElementById('chessBoard');
  if (!box || !board) return;
  var apply = function () {
    var w = box.clientWidth - 4, h = box.clientHeight - 4;
    var sz = Math.max(150, Math.min(w, h, 440));
    board.style.width = sz + 'px';
    board.style.height = sz + 'px';
  };
  apply();
  if (_chessBoardRO && _chessBoardRO.disconnect) _chessBoardRO.disconnect();
  if (window.ResizeObserver) {
    _chessBoardRO = new ResizeObserver(apply);
    _chessBoardRO.observe(box);
  }
}

/* ── بدء وجه لوجه (شاشة واحدة) ── */
function chessStartLocal() {
  if (typeof SND !== 'undefined' && SND.click) SND.click();
  if (!CHESS) initChess();
  CHESS.mode = 'local';
  CHESS.myColor = 'w';
  CHESS.state = chessNewState();
  CHESS.sel = null; CHESS.legal = []; CHESS.flipped = false;
  CHESS.lastFrom = null; CHESS.lastTo = null; CHESS.drawBanUntil = 0;
  CHESS.isSpectator = false; CHESS.oppBot = false;
  document.getElementById('chessSetup').hidden = true;
  document.getElementById('chessOver').hidden = true;
  document.getElementById('chessPlay').hidden = false;
  document.getElementById('chessTopName').textContent = T('chess.black');
  document.getElementById('chessBotName').textContent = T('chess.white');
  var db = document.getElementById('chessDrawBar'); if (db) db.hidden = true;
  chessSetStatus(T('chess.whiteTurn'));
  chessRender();
  chessStartTimer();
}

/* ── عرض اللوحة ── */
function chessRender() {
  if (!CHESS || !CHESS.state) return;
  var board = document.getElementById('chessBoard');
  if (!board) return;
  var s = CHESS.state;
  var html = '';
  var legalSet = {};
  for (var i = 0; i < CHESS.legal.length; i++) legalSet[CHESS.legal[i].to[0] + ',' + CHESS.legal[i].to[1]] = CHESS.legal[i];
  /* خانة الملك المُشاكَش */
  var checkSq = null;
  if (chessInCheck(s, s.turn === 'w')) {
    var kp = chessKingPos(s.board, s.turn === 'w');
    if (kp) checkSq = kp[0] + ',' + kp[1];
  }
  var files = 'abcdefgh';
  for (var vi = 0; vi < 8; vi++) {
    for (var vj = 0; vj < 8; vj++) {
      var r = CHESS.flipped ? 7 - vi : vi;
      var c = CHESS.flipped ? 7 - vj : vj;
      var dark = ((r + c) % 2) === 1;
      var p = s.board[r][c];
      var cls = 'ch-sq ' + (dark ? 'dark' : 'light');
      if (CHESS.sel && CHESS.sel[0] === r && CHESS.sel[1] === c) cls += ' sel';
      if (CHESS.lastFrom && CHESS.lastFrom[0] === r && CHESS.lastFrom[1] === c) cls += ' last';
      if (CHESS.lastTo && CHESS.lastTo[0] === r && CHESS.lastTo[1] === c) cls += ' last';
      if (checkSq === r + ',' + c) cls += ' check';
      var hint = legalSet[r + ',' + c];
      if (hint) cls += ' hint' + (hint.capture || hint.ep ? ' hint-cap' : '');
      /* إحداثيات الحافة */
      var coord = '';
      if (vj === 0) coord += '<span class="ch-co rank">' + (8 - r) + '</span>';
      if (vi === 7) coord += '<span class="ch-co file">' + files[c] + '</span>';
      html += '<div class="' + cls + '" data-r="' + r + '" data-c="' + c + '" onclick="chessClick(' + r + ',' + c + ')">' + coord;
      if (p) {
        var t = chessType(p);
        var side = chessIsWhite(p) ? 'w' : 'b';
        html += '<span class="ch-pc ' + side + (t === 'K' ? ' king' : '') + '">' + CHESS_GLYPH[t] + '</span>';
      }
      if (hint) html += '<span class="ch-dot' + (hint.capture || hint.ep ? ' cap' : '') + '"></span>';
      html += '</div>';
    }
  }
  board.innerHTML = html;
  chessUpdateHUD();
  chessUpdateLog();
}

function chessUpdateHUD() {
  if (!CHESS || !CHESS.state) return;
  var s = CHESS.state;
  var el = document.getElementById('chessTurn');
  if (el) {
    if (s.over) { el.textContent = T('dama.ended'); el.className = 'dama-turn'; }
    else if (s.turn === 'w') { el.textContent = T('chess.whiteTurn'); el.className = 'dama-turn you'; }
    else { el.textContent = T('chess.blackTurn'); el.className = 'dama-turn bot'; }
  }
  /* [Owner] حلقة ذهبية على أيقونة صاحب الدور: الأبيض ♔ = أسفل، الأسود ♚ = أعلى */
  var topIcon = document.getElementById('chessTopIcon');
  var botIcon = document.getElementById('chessBotIcon');
  if (topIcon) topIcon.classList.toggle('on', !s.over && s.turn === 'b');
  if (botIcon) botIcon.classList.toggle('on', !s.over && s.turn === 'w');
  /* صواني الأسرى (فعلية من الحالة) + فرق المواد */
  var val = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
  var cap = s.captured || { w: [], b: [] };
  var trayW = '', trayB = '', wPts = 0, bPts = 0;   /* wPts = نقاط ما أخذه الأبيض */
  for (var i = 0; i < cap.w.length; i++) {
    var pc = cap.w[i];
    var t = chessType(pc);
    wPts += val[t];
    trayW += '<span class="ch-capp b">' + CHESS_GLYPH[t] + '</span>';
  }
  for (var j = 0; j < cap.b.length; j++) {
    var pb = cap.b[j];
    var tb = chessType(pb);
    bPts += val[tb];
    trayB += '<span class="ch-capp w">' + CHESS_GLYPH[tb] + '</span>';
  }
  /* الشاشة: الأسود أعلى، الأبيض أسفل (أو معكوسة حسب وجهة نظري) */
  var iAmWhiteView = !CHESS.flipped;   /* الأبيض أسفل ما لم تكن اللوحة مقلوبة */
  var capTop = document.getElementById('chessCapTop');
  var capBot = document.getElementById('chessCapBot');
  var matTop = document.getElementById('chessMatTop');
  var matBot = document.getElementById('chessMatBot');
  if (capTop) capTop.innerHTML = iAmWhiteView ? trayB : trayW;   /* أسرى صاحب الأعلى */
  if (capBot) capBot.innerHTML = iAmWhiteView ? trayW : trayB;
  var topPts = iAmWhiteView ? bPts : wPts;   /* ما جمعه لاعب الأعلى */
  var botPts = iAmWhiteView ? wPts : bPts;
  if (matTop) matTop.textContent = topPts > botPts ? '+' + (topPts - botPts) : '0';
  if (matBot) matBot.textContent = botPts > topPts ? '+' + (botPts - topPts) : '0';
  /* الرهان الجاري */
  var st = document.getElementById('chessStake');
  if (st) {
    var playEl = document.getElementById('chessPlay');
    if (!playEl || playEl.hidden || (s.over)) st.hidden = true;
    else {
      st.textContent = (CHESS.mode === 'room')
        ? (CHESS.bet > 0 ? T('dama.stakeLabel') + ' ' + CHESS.bet + ' 🪙' : T('dama.friendly'))
        : T('chess.hotSeatFree');
      st.hidden = false;
    }
  }
}

function chessUpdateLog() {
  var el = document.getElementById('chessLog');
  if (!el || !CHESS || !CHESS.state) return;
  var log = CHESS.state.log;
  var html = '';
  for (var i = 0; i < log.length; i += 2) {
    var n = (i / 2) + 1;
    html += '<span class="ch-lg-i"><b>' + n + '.</b> ' + log[i] + (log[i + 1] ? ' ' + log[i + 1] : '') + '</span>';
  }
  el.innerHTML = html;
  el.scrollLeft = el.scrollWidth;
}

function chessSetStatus(txt) {
  var el = document.getElementById('chessStatus');
  if (el) el.textContent = txt || '';
}

/* ── التفاعل ── */
function chessCanInteract() {
  if (!CHESS || !CHESS.state || CHESS.state.over || CHESS._pendingPromo) return false;
  if (CHESS.isSpectator) return false;
  if (CHESS.mode === 'room') return CHESS.state.turn === CHESS.myColor;
  return true;   /* وجه لوجه: الجهاز واحد */
}

function chessClick(r, c) {
  if (!chessCanInteract()) return;
  var s = CHESS.state;
  /* نقر وجهة قانونية؟ */
  for (var i = 0; i < CHESS.legal.length; i++) {
    var mv = CHESS.legal[i];
    if (mv.to[0] === r && mv.to[1] === c) {
      /* ترقية؟ افتح المنتقي */
      var promos = CHESS.legal.filter(function (m) { return m.from[0] === mv.from[0] && m.from[1] === mv.from[1] && m.to[0] === r && m.to[1] === c && m.promo; });
      if (promos.length) { chessOpenPromo(promos); return; }
      chessPlayMove(mv);
      return;
    }
  }
  /* اختيار قطعة */
  var p = s.board[r][c];
  if (p && chessIsWhite(p) === (s.turn === 'w')) {
    var lm = chessMovesForPiece(s, r, c);
    if (lm.length) {
      CHESS.sel = [r, c];
      CHESS.legal = lm;
      if (typeof SND !== 'undefined' && SND.click) SND.click();
    } else {
      chessSetStatus(T('chess.cantMove'));
    }
  } else {
    CHESS.sel = null; CHESS.legal = [];
  }
  chessRender();
}

function chessOpenPromo(promos) {
  CHESS._pendingPromo = promos;
  var row = document.getElementById('chessPromoRow');
  var side = CHESS.state.turn === 'w' ? 'w' : 'b';
  var html = '';
  var order = ['q', 'r', 'b', 'n'];
  for (var i = 0; i < order.length; i++) {
    var mv = promos.find(function (m) { return m.promo === order[i]; });
    if (mv) html += '<button class="ch-promo-b ' + side + '" onclick="chessPickPromo(\'' + order[i] + '\')">' + CHESS_GLYPH[order[i].toUpperCase()] + '</button>';
  }
  if (row) row.innerHTML = html;
  var ov = document.getElementById('chessPromo');
  if (ov) ov.hidden = false;
}
function chessPickPromo(code) {
  var ov = document.getElementById('chessPromo');
  if (ov) ov.hidden = true;
  if (!CHESS || !CHESS._pendingPromo) return;
  var mv = CHESS._pendingPromo.find(function (m) { return m.promo === code; });
  CHESS._pendingPromo = null;
  if (mv) chessPlayMove(mv);
}

/* تنفيذ حركة (محلية أو عن بعد) */
function chessPlayMove(mv, remote) {
  var s = CHESS.state;
  var wasCheck = chessInCheck(s, s.turn === 'w');
  var moverWhite = s.turn === 'w';
  var info = chessMakeMove(s, mv);
  CHESS.lastFrom = mv.from; CHESS.lastTo = mv.to;
  CHESS.sel = null; CHESS.legal = [];
  if (!remote && CHESS.mode === 'room') chessEmitMove(mv);
  chessRender();
  chessSound(mv, info);
  if (info.mate) { chessSetStatus(T('chess.mateMsg')); setTimeout(function () { chessFinalize(); }, 900); return; }
  if (info.draw) {
    var why = {
      stalemate: T('chess.stalemate'),
      '50move': T('chess.draw50'),
      rep: T('chess.drawRep'),
      material: T('chess.drawMaterial')
    }[s.endReason] || T('dama.draw');
    chessSetStatus(why);
    setTimeout(function () { chessFinalize(); }, 900);
    return;
  }
  /* وجه لوجه: قلب اللوحة مع الدور */
  if (CHESS.mode === 'local' && CHESS.autoFlip) CHESS.flipped = (s.turn === 'b');
  if (info.check) chessSetStatus(T('chess.checkMsg'));
  else if (CHESS.mode === 'local') chessSetStatus(s.turn === 'w' ? T('chess.whiteTurn') : T('chess.blackTurn'));
  else chessSetStatus(s.turn === CHESS.myColor ? T('dama.yourMove') : T('dama.oppTurn'));
  chessRender();
  chessStartTimer();
  /* غرفة ببوت: حركة البوت */
  if (CHESS.mode === 'room' && CHESS.oppBot && !s.over && s.turn !== CHESS.myColor) {
    CHESS.busy = true;
    setTimeout(chessBotTurn, 550);
  }
}

/* صوت الحركة بحسب نوعها */
function chessSound(mv, info) {
  if (typeof SND === 'undefined') return;
  try {
    if (mv.promo && SND.chessPromote) SND.chessPromote();
    else if (mv.castle && SND.chessCastle) SND.chessCastle();
    else if ((mv.capture || mv.ep) && SND.chessCapture) SND.chessCapture();
    else if (SND.chessMove) SND.chessMove();
    if (info.check && SND.chessCheck) setTimeout(function () { try { SND.chessCheck(); } catch (e) {} }, 140);
  } catch (e) {}
}

/* دور بوت الغرفة */
function chessBotTurn() {
  if (!CHESS || !CHESS.state || CHESS.state.over) { if (CHESS) CHESS.busy = false; return; }
  if (CHESS.state.turn === CHESS.myColor) { CHESS.busy = false; return; }
  var mv = chessPickMove(CHESS.state, 2, 650);
  CHESS.busy = false;
  if (mv) chessPlayMove(mv);
  else chessFinalize();
}

/* ── المؤقت (وجه لوجه) ── */
function chessStopTimer() {
  if (CHESS && CHESS._turnTi) { clearInterval(CHESS._turnTi); CHESS._turnTi = null; }
  var el = document.getElementById('chessTimer');
  if (el) el.textContent = '';
}
function chessStartTimer() {
  chessStopTimer();
  if (!CHESS || !CHESS.state || CHESS.state.over) return;
  if (!CHESS.timer || CHESS.mode !== 'local') return;
  CHESS._turnLeft = CHESS.timer;
  chessRenderTimer();
  CHESS._turnTi = setInterval(function () {
    if (!CHESS || !CHESS.state || CHESS.state.over) { chessStopTimer(); return; }
    CHESS._turnLeft--;
    chessRenderTimer();
    if (CHESS._turnLeft <= 0) chessTimeout();
  }, 1000);
}
function chessRenderTimer() {
  var el = document.getElementById('chessTimer');
  if (!el) return;
  var s = CHESS.state;
  var name = s.turn === 'w' ? T('chess.white') : T('chess.black');
  el.textContent = name + ' · ' + Math.max(0, CHESS._turnLeft) + 's';
}
function chessTimeout() {
  chessStopTimer();
  if (!CHESS || !CHESS.state || CHESS.state.over) return;
  /* انتهاء الوقت = خسارة صاحب الدور (بلا كش مستحيل الحسم يُعد تعادلاً — تبسيط: خسارة) */
  CHESS.state.over = true;
  CHESS.state.outcome = chessOther(CHESS.state.turn);
  CHESS.state.endReason = 'timeout';
  chessSetStatus(T('chess.timeUp'));
  chessRender();
  setTimeout(chessFinalize, 700);
}

/* ── إنهاء وتسوية ── */
function chessFinalize() {
  chessStopTimer();
  if (!CHESS || !CHESS.state) return;
  var s = CHESS.state;
  if (s.over === false) return;
  var dbar = document.getElementById('chessDrawBar'); if (dbar) dbar.hidden = true;
  var ov = document.getElementById('chessOver');
  var em = document.getElementById('chessOverEm');
  var tx = document.getElementById('chessOverTx');
  var amt = document.getElementById('chessOverAmt');
  if (!ov) return;
  var reasonTxt = {
    mate: T('chess.byMate'),
    stalemate: T('chess.stalemate'),
    '50move': T('chess.draw50'),
    rep: T('chess.drawRep'),
    material: T('chess.drawMaterial'),
    agreed: T('chess.byAgreement'),
    resign: T('chess.byResign'),
    timeout: T('chess.byTimeout')
  }[s.endReason] || '';
  if (s.outcome === 'draw') {
    if (em) em.textContent = '🤝';
    if (tx) tx.textContent = T('dama.draw') + (reasonTxt ? ' — ' + reasonTxt : '');
    if (amt) {
      if (CHESS.mode === 'room' && CHESS.bet > 0 && !CHESS.isSpectator) {
        giveWin(CHESS.bet);
        if (typeof gres === 'function') gres(T('dama.drawRefund'), 0);
        amt.innerHTML = T('dama.refunded');
      } else if (amt) amt.textContent = reasonTxt || '';
    }
  } else {
    var winnerWhite = s.outcome === 'w';
    var iWon = CHESS.mode === 'local' ? null : (!CHESS.isSpectator && s.outcome === CHESS.myColor);
    if (em) em.textContent = winnerWhite ? '♔' : '♚';
    if (tx) {
      if (CHESS.mode === 'local') tx.textContent = (winnerWhite ? T('chess.whiteWins') : T('chess.blackWins')) + (reasonTxt ? ' — ' + reasonTxt : '');
      else tx.textContent = iWon ? T('dama.win') : T('dama.lose');
    }
    if (amt) {
      if (CHESS.mode === 'room' && CHESS.bet > 0 && !CHESS.isSpectator) {
        if (iWon) {
          var payout = CHESS.bet * 2;
          giveWin(payout);
          if (typeof gres === 'function') gres(T('dama.win') + ' +' + payout + ' 🪙', payout);
          if (typeof winFX === 'function') winFX(payout);
          amt.innerHTML = '+' + payout + ' 🪙';
        } else {
          if (typeof gres === 'function') gres(T('dama.lose') + ' — ' + T('ts.lose'), 0);
          amt.textContent = '−' + CHESS.bet + ' 🪙';
        }
      } else amt.textContent = reasonTxt || '';
    }
    if (CHESS.mode === 'local' && typeof gres !== 'undefined' && !CHESS.bet) { /* ودية: بلا تسجيل مالي */ }
  }
  ov.hidden = false;
  if (typeof SND !== 'undefined' && SND.chessEnd) { try { SND.chessEnd(); } catch (e) {} }
}

function chessNewMatch() {
  var ov = document.getElementById('chessOver');
  if (ov) ov.hidden = true;
  if (CHESS && CHESS.mode === 'room') {
    /* غرفة: إعادة جولة جديدة للجميع */
    if (!CHESS.isSpectator && !CHESS.oppBot) chessEmit('newgame', {});
    chessResetBoardOnly();
    return;
  }
  chessStartLocal();
}

function chessToSetup() {
  if (!CHESS) return;
  chessStopTimer();
  if (CHESS.mode === 'room') {
    /* الغرفة: مغادرة مباراة حية = استسلام */
    if (CHESS.state && !CHESS.state.over && !CHESS.isSpectator) { chessResign(); return; }
    return;
  }
  if (CHESS.state && !CHESS.state.over) {
    CHESS.state.over = true;
    CHESS.state.outcome = 'draw';
    CHESS.state.endReason = 'agreed';
  }
  document.getElementById('chessPlay').hidden = true;
  document.getElementById('chessOver').hidden = true;
  document.getElementById('chessSetup').hidden = false;
  chessSetStatus('');
}

function chessResign() {
  if (!CHESS || !CHESS.state || CHESS.state.over) return;
  if (!confirm(T('chess.confirmResign'))) return;
  if (CHESS.mode === 'room' && !CHESS.oppBot && !CHESS.isSpectator) chessEmit('resign', {});
  var loser = (CHESS.mode === 'room') ? CHESS.myColor : CHESS.state.turn;
  CHESS.state.over = true;
  CHESS.state.outcome = loser === 'w' ? 'b' : 'w';
  CHESS.state.endReason = 'resign';
  chessRender();
  chessFinalize();
}

/* ── التعادل بالتوافق ── */
function chessDrawOffer() {
  if (!CHESS || !CHESS.state || CHESS.state.over || CHESS.isSpectator) return;
  if ((CHESS.drawBanUntil | 0) > (CHESS.state.full | 0)) {
    chessSetStatus(T('dama.drawWait'));
    return;
  }
  if (CHESS.mode === 'room' && !CHESS.oppBot) {
    chessEmit('drawOffer', {});
    CHESS.drawBanUntil = (CHESS.state.full | 0) + 4;
    chessSetStatus(T('dama.drawSent'));
    if (typeof SND !== 'undefined' && SND.notify) SND.notify();
    return;
  }
  if (CHESS.mode === 'local') {
    /* وجه لوجه: مصادقة الطرف الآخر عبر شريط القبول */
    CHESS._drawBy = CHESS.state.turn;
    chessShowDrawBar(T('chess.drawLocalAsk'));
    return;
  }
  /* ضد بوت الغرفة: يقبل إن كان متأخراً */
  var my = 0, op = 0;
  for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
    var p = CHESS.state.board[r][c];
    if (!p) continue;
    var v = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 }[chessType(p)];
    if (chessIsWhite(p)) { if (CHESS.myColor === 'w') my += v; else op += v; }
    else { if (CHESS.myColor === 'b') my += v; else op += v; }
  }
  if (op >= my) {   /* البوت ليس أفضل → يقبل */
    CHESS.state.over = true; CHESS.state.outcome = 'draw'; CHESS.state.endReason = 'agreed';
    chessFinalize();
  } else {
    CHESS.drawBanUntil = (CHESS.state.full | 0) + 4;
    chessSetStatus(T('dama.drawDeclinedTxt'));
  }
}

function chessDrawAccept(yes) {
  var bar = document.getElementById('chessDrawBar');
  if (bar) bar.hidden = true;
  if (!CHESS || !CHESS.state || CHESS.state.over) return;
  if (CHESS.mode === 'local') {
    if (yes) {
      CHESS.state.over = true; CHESS.state.outcome = 'draw'; CHESS.state.endReason = 'agreed';
      chessFinalize();
    } else chessSetStatus(T('dama.drawYouDeclined'));
    return;
  }
  if (yes) {
    if (!CHESS.oppBot && !CHESS.isSpectator) chessEmit('drawAgree', {});
    CHESS.state.over = true; CHESS.state.outcome = 'draw'; CHESS.state.endReason = 'agreed';
    chessFinalize();
  } else {
    if (!CHESS.oppBot && !CHESS.isSpectator) chessEmit('drawDecline', {});
    chessSetStatus(T('dama.drawYouDeclined'));
  }
}

function chessShowDrawBar(txt) {
  var bar = document.getElementById('chessDrawBar');
  var t = document.getElementById('chessDrawTxt');
  if (bar) { if (t) t.textContent = txt; bar.hidden = false; }
}

/* ── الغرف (MP) ── */
function chessMeId() {
  if (typeof AUTH !== 'undefined' && AUTH.user) return AUTH.user.id;
  if (typeof ST !== 'undefined' && ST.user) return ST.user.id;
  return null;
}
function chessEmitMove(mv) {
  CHESS._seq = (CHESS._seq || 0) + 1;
  chessEmit('move', { mv: { from: mv.from, to: mv.to, promo: mv.promo || null, piece: mv.piece, capture: mv.capture || null, castle: mv.castle || null, ep: !!mv.ep }, dedup: 'ch-' + CHESS._seq });
}
function chessEmit(action, data) {
  if (typeof Rooms === 'undefined' || !Rooms || typeof Rooms.sendMove !== 'function') return;
  var payload = { action: action, data: data || {}, by: chessMeId(), seq: (CHESS._seq || 0), ts: Date.now() };
  try { Rooms.sendMove('rmove', payload, { game_id: 'ch', status: 'playing' }); } catch (e) {}
}

function chessRoomMove(d) {
  try {
    if (!d) return;
    if (d.action === 'rmove' && d.data) d = d.data;
    var by = d.by;
    if (by != null && String(by) === String(chessMeId())) return;
    var action = d.action;
    if (action === 'newgame') { chessResetBoardOnly(); return; }
    if (action === 'resign') {
      if (CHESS && CHESS.state && !CHESS.state.over) {
        CHESS.state.over = true;
        CHESS.state.outcome = CHESS.myColor;   /* خصمي انسحب → فوزي */
        CHESS.state.endReason = 'resign';
        chessRender();
        chessFinalize();
      }
      return;
    }
    if (action === 'drawOffer') {
      if (CHESS && CHESS.state && !CHESS.state.over) {
        if (CHESS.isSpectator) { chessSetStatus('🤝 ' + T('dama.drawOffered')); return; }
        chessShowDrawBar(T('dama.drawIncoming'));
        if (typeof SND !== 'undefined' && SND.notify) SND.notify();
      }
      return;
    }
    if (action === 'drawAgree') {
      var barEl = document.getElementById('chessDrawBar'); if (barEl) barEl.hidden = true;
      if (CHESS && CHESS.state && !CHESS.state.over) {
        CHESS.state.over = true; CHESS.state.outcome = 'draw'; CHESS.state.endReason = 'agreed';
        chessFinalize();
      }
      return;
    }
    if (action === 'drawDecline') {
      var barEl2 = document.getElementById('chessDrawBar'); if (barEl2) barEl2.hidden = true;
      chessSetStatus(T('dama.drawDeclinedTxt'));
      return;
    }
    if (action === 'move') {
      var mv = (d.data && d.data.mv) ? d.data.mv : null;
      if (mv) chessApplyRemoteMove(mv);
    }
  } catch (e) { if (typeof console !== 'undefined') console.error('[Chess MP] roomMove', e && e.message, e); }
}

function chessApplyRemoteMove(mv) {
  if (!CHESS || !CHESS.state || CHESS.state.over || !mv || !mv.from || !mv.to) return;
  if (!CHESS.isSpectator && CHESS.state.turn === CHESS.myColor) return;   /* ليس دور الخصم */
  /* [تحقق] الحركة يجب أن تكون ضمن القائمة القانونية (محرك حتمي عند الطرفين) */
  var legal = chessLegalMoves(CHESS.state).filter(function (m) {
    return m.from[0] === mv.from[0] && m.from[1] === mv.from[1]
      && m.to[0] === mv.to[0] && m.to[1] === mv.to[1]
      && (m.promo || null) === (mv.promo || null);
  });
  if (!legal.length) return;
  chessPlayMove(legal[0], true);
}

function chessResetBoardOnly() {
  if (!CHESS) return;
  /* جولة جديدة في غرفة الرهان: كل طرف يعيد حصته (جولة = رهن مستقل) */
  if (CHESS.mode === 'room' && CHESS.bet > 0 && !CHESS.isSpectator && !CHESS.oppBot) {
    if (typeof takeBet === 'function' && !takeBet(CHESS.bet)) CHESS.bet = 0;   /* لا يكفي الرصيد → تكمل ودية */
  }
  CHESS.state = chessNewState();
  CHESS.sel = null; CHESS.legal = []; CHESS.busy = false;
  CHESS.lastFrom = null; CHESS.lastTo = null;
  CHESS.drawBanUntil = 0;
  var ov = document.getElementById('chessOver'); if (ov) ov.hidden = true;
  var db = document.getElementById('chessDrawBar'); if (db) db.hidden = true;
  CHESS.flipped = (CHESS.mode === 'room' && CHESS.myColor === 'b');
  chessRender();
  chessSetStatus(CHESS.state.turn === CHESS.myColor ? T('dama.yourMove') : T('dama.waitOpp'));
}

function chessRoomStart(room) {
  if (!room || room.game_id !== 'ch' || room.status !== 'playing') return;
  var order = (room.order && room.order.length) ? room.order.slice() : [];
  if (!order.length) return;
  var meId = chessMeId();
  var mySeat = -1;
  for (var i = 0; i < order.length; i++) if (String(order[i]) === String(meId)) mySeat = i;
  var spec = mySeat === -1;
  var oppBot = false;
  try {
    if (room.players) {
      for (var j = 0; j < room.players.length; j++) {
        var pl = room.players[j];
        if (pl.spectate || String(pl.id) === String(meId)) continue;
        oppBot = !!pl.isBot;
        break;
      }
    }
  } catch (e) {}
  var bet = 0;
  try { bet = parseInt(room.bet, 10) || 0; } catch (e) {}
  chessStartRoom(mySeat === 0 ? 'w' : 'b', oppBot, spec, bet);
}

function chessStartRoom(myColor, oppBot, spec, bet) {
  if (!CHESS) initChess();
  CHESS.mode = 'room';
  CHESS.myColor = myColor;
  CHESS.oppBot = !!oppBot;
  CHESS.isSpectator = !!spec;
  CHESS.bet = spec ? 0 : (bet || 0);
  CHESS.state = chessNewState();
  CHESS.sel = null; CHESS.legal = []; CHESS.busy = false;
  CHESS.lastFrom = null; CHESS.lastTo = null; CHESS.drawBanUntil = 0;
  CHESS.flipped = (myColor === 'b');
  /* رهان الغرفة: كل طرف يخصم حصته */
  if (!spec && CHESS.bet > 0) {
    if (typeof takeBet === 'function' && !takeBet(CHESS.bet)) {
      CHESS.bet = 0;
      CHESS.state.over = true;
      chessSetStatus(T('ts.noc'));
      return;
    }
  }
  document.getElementById('chessSetup').hidden = true;
  document.getElementById('chessOver').hidden = true;
  document.getElementById('chessPlay').hidden = false;
  document.getElementById('chessTopName').textContent = spec ? T('chess.spectating') : (myColor === 'w' ? T('chess.oppLabel') : T('chess.youLabel'));
  document.getElementById('chessBotName').textContent = spec ? T('chess.spectating') : (myColor === 'w' ? T('chess.youLabel') : T('chess.oppLabel'));
  var db = document.getElementById('chessDrawBar'); if (db) db.hidden = true;
  chessRender();
  chessSetStatus(spec ? '👁️ ' + T('dama.spec') : (CHESS.state.turn === myColor ? T('dama.yourMove') : T('dama.waitOpp')));
}

function chessApplyReplay(d) {
  try {
    if (!d || !d.history || !d.history.length) return;
    if (!CHESS || CHESS.mode !== 'room' || !CHESS.state) return;
    CHESS.state = chessNewState();
    var resignedBy = null;
    for (var i = 0; i < d.history.length; i++) {
      var h = d.history[i];
      if (!h || !h.action) continue;
      if (h.action === 'newgame') { CHESS.state = chessNewState(); resignedBy = null; continue; }
      if (h.action === 'resign') { resignedBy = h.by; continue; }
      if (h.action === 'drawAgree') { CHESS.state.over = true; CHESS.state.outcome = 'draw'; CHESS.state.endReason = 'agreed'; continue; }
      if (h.action === 'move' && h.data && h.data.mv) {
        var mv = h.data.mv;
        var legal = chessLegalMoves(CHESS.state).filter(function (m) {
          return m.from[0] === mv.from[0] && m.from[1] === mv.from[1] && m.to[0] === mv.to[0] && m.to[1] === mv.to[1] && (m.promo || null) === (mv.promo || null);
        });
        if (legal.length) chessMakeMove(CHESS.state, legal[0]);
      }
    }
    CHESS.sel = null; CHESS.legal = [];
    if (resignedBy != null) {
      CHESS.state.over = true;
      CHESS.state.outcome = (String(resignedBy) === String(chessMeId())) ? (CHESS.myColor === 'w' ? 'b' : 'w') : CHESS.myColor;
      CHESS.state.endReason = 'resign';
    }
    chessRender();
  } catch (e) { if (typeof console !== 'undefined') console.error('[Chess MP] replay', e && e.message, e); }
}

function chessRegisterRooms() {
  if (typeof Rooms === 'undefined' || !Rooms || typeof Rooms.setGameHandler !== 'function') return;
  Rooms.setGameHandler(chessRoomMove);
  Rooms.setStartHandler(chessRoomStart);
  if (typeof Rooms.setUpdateHandler === 'function') Rooms.setUpdateHandler(function () {});
  if (typeof window !== 'undefined') window.applyRoomReplay = chessApplyReplay;
  if (Rooms.state && Rooms.state.game_id === 'ch' && Rooms.state.status === 'playing') {
    var rp = (typeof Rooms.hasPendingReplay === 'function' && Rooms.hasPendingReplay()) ? Rooms.consumePendingReplay() : null;
    chessRoomStart(Rooms.state);
    if (rp && rp.history && rp.history.length) chessApplyReplay(rp);
  }
}

/* تصدير دوال الواجهة */
window.chessStartLocal = chessStartLocal;
window.chessClick = chessClick;
window.chessSetBet = chessSetBet;
window.chessSetTimer = chessSetTimer;
window.chessPickPromo = chessPickPromo;
window.chessResign = chessResign;
window.chessDrawOffer = chessDrawOffer;
window.chessDrawAccept = chessDrawAccept;
window.chessNewMatch = chessNewMatch;
window.chessToSetup = chessToSetup;
