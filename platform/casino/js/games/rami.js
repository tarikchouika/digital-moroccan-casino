/* ═══════════ Moroccan Rami Helpers ═══════════ */
function _ramiT(key, fallback) {
  if (typeof T === 'function') {
    const val = T(key);
    if (val && val !== key) return val;
  }
  if (typeof window !== 'undefined' && typeof window.T === 'function') {
    const val = window.T(key);
    if (val && val !== key) return val;
  }
  return fallback !== undefined ? fallback : key;
}
/* نسخة بقالب: تستبدل {x} بالقيم قبل/بعد الترجمة — _ramiF('k','fb',{a:5}) */
function _ramiF(key, fallback, vars) {
  let s = _ramiT(key, fallback);
  if (vars && typeof vars === 'object') {
    for (const k in vars) {
      s = s.split('{' + k + '}').join(vars[k]);
    }
  }
  return s;
}

var _lastRamiToast = { msg: '', t: 0, el: null, timer: null };
function _ramiToast(msg, type) {
  /* منع التوستات المكررة/المتناقضة في نفس اللحظة: نفس الرسالة خلال 400ms تُتجاهل */
  const now = Date.now();
  if (msg === _lastRamiToast.msg && (now - _lastRamiToast.t) < 400) return;
  _lastRamiToast.msg = msg;
  _lastRamiToast.t = now;

  /* [V14] توست واحد ثابت يُستبدل بدل التكديس: عنصر واحد يُعاد استخدامه */
  if (typeof document !== 'undefined') {
    let el = _lastRamiToast.el;
    const container = document.getElementById('toasts');
    if (!container) {
      if (typeof toast === 'function') return toast(msg, type);
      if (typeof window !== 'undefined' && typeof window.toast === 'function') return window.toast(msg, type);
      if (typeof console !== 'undefined') console.log('[TOAST ' + (type || 'info') + '] ' + msg);
      return;
    }
    const icons = { Ok: '✅', ok: '✅', Err: '❌', err: '❌', Warn: '⚠️', warn: '⚠️', Info: 'ℹ️', info: 'ℹ️' };
    if (!el || !el.parentNode) {
      /* إزالة أي توستات رامي سابقة متراكمة من جلسات أقدم */
      const prev = container.querySelectorAll('.toast.rami-toast');
      prev.forEach(function (p) { p.remove(); });
      el = document.createElement('div');
      el.className = 'toast rami-toast ' + (type || 'info');
      el.setAttribute('role', 'alert');
      container.appendChild(el);
      _lastRamiToast.el = el;
    } else {
      el.className = 'toast rami-toast ' + (type || 'info');
    }
    /* الرسائل تحمل رموزها التعبيرية مسبقاً — لا نضيف أيقونة مكررة */
    el.innerHTML = '<span>' + msg + '</span>';
    el.style.opacity = '1';
    el.style.transform = 'none';
    if (_lastRamiToast.timer) clearTimeout(_lastRamiToast.timer);
    _lastRamiToast.timer = setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
    }, 2600);
    return;
  }
  if (typeof toast === 'function') return toast(msg, type);
  if (typeof window !== 'undefined' && typeof window.toast === 'function') return window.toast(msg, type);
  if (typeof console !== 'undefined') console.log('[TOAST ' + (type || 'info') + '] ' + msg);
}

/* ═══════════ Crisp Vector Card HTML Generator (100% Zero Broken Images) ═══════════ */
function getRamiCardHTML(card, isBack, extraClass) {
  if (isBack || !card) {
    return '<div class="rcard-vector rcard-back ' + (extraClass || '') + '" aria-hidden="true">' +
      '<div class="rcard-back-pattern"></div>' +
    '</div>';
  }

  if (card.isJoker) {
    return '<div class="rcard-vector rcard-joker ' + (extraClass || '') + '" data-id="' + card.id + '">' +
      '<div class="rcard-corner top-left"><span class="rcard-glyph">🃏</span></div>' +
      '<div class="rcard-center-emblem"><span class="joker-star">★</span><span class="joker-lbl">JOKER</span></div>' +
      '<div class="rcard-corner bottom-right"><span class="rcard-glyph">🃏</span></div>' +
    '</div>';
  }

  const rankStr = (card.rank === 6) ? '6.' : ((card.rank === 9) ? '9.' : (RAMI_RANK_NAMES[card.rank - 1] || String(card.rank)));
  const glyph = RAMI_SUIT_GLYPH[card.suit] || '♣';
  const isRed = (card.suit === 'heart' || card.suit === 'diamond');
  const colorCls = isRed ? 'red' : 'black';

  return '<div class="rcard-vector rcard-front ' + colorCls + ' ' + (extraClass || '') + '" data-id="' + card.id + '">' +
    '<div class="rcard-corner top-left">' +
      '<span class="rcard-rank">' + rankStr + '</span>' +
      '<span class="rcard-glyph">' + glyph + '</span>' +
    '</div>' +
    '<div class="rcard-center-emblem">' +
      '<span class="rcard-big-glyph">' + glyph + '</span>' +
    '</div>' +
    '<div class="rcard-corner bottom-right">' +
      '<span class="rcard-rank">' + rankStr + '</span>' +
      '<span class="rcard-glyph">' + glyph + '</span>' +
    '</div>' +
  '</div>';
}

function getPlayerInitials(name, index) {
  if (!name) return 'P' + (index + 1);
  if (name.includes('AI')) return 'AI' + name.replace(/[^0-9]/g, '');
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}


/* ── خوارزمية تقسيم الأوراق المحددة إلى مجموعات متتالية ومتماثلة صالحة للافتتاح والإنزال ── */
/* [EXPERT-AI] ذاكرة نتائج التقسيم — التقسيم الدقيق أغلى عملية حسابية،
   ويُستدعى مراراً بنفس مجموعة الأوراق خلال الدور الواحد.
   المفتاح يشمل هوية الجوكر-المؤشر، والنتيجة تُستنسخ دائماً (المستدعي قد يعدّلها). */
const __ramiPartCache = new Map();
function clearRamiPartitionCache() { __ramiPartCache.clear(); }
if (typeof window !== 'undefined') window.clearRamiPartitionCache = clearRamiPartitionCache;

function partitionSelectedCards(cards, rules, mode) {
  if (!cards || cards.length < 3) return [];
  const validator = rules.validator;
  const n = cards.length;
  /* mode='opening': تعظيم النقاط الحرة أولاً (للافتتاح/الإنهاء) —
     الافتراضي تعظيم التغطية (للإنزال بعد الافتتاح) */
  const openingMode = (mode === 'opening');

  const cacheKey = (openingMode ? 'O:' : 'C:') + n + '|' + (rules.jokerIndicator ? 'i' + rules.jokerIndicator.id + ':' : '-') +
    cards.map(c => c.id + '#' + c.rank + c.suit + (c.isJoker ? 'J' : '')).sort().join(',');
  if (__ramiPartCache.has(cacheKey)) {
    return __ramiPartCache.get(cacheKey).map(m => new RamiMeld(m.type, m.cards.slice()));
  }

  if (validator.isValidSet(cards, true)) return [new RamiMeld(MELD_TYPE.SET, cards.slice())];
  if (validator.isValidSequence(cards, true)) return [new RamiMeld(MELD_TYPE.SEQUENCE, cards.slice())];

  const validSubsets = [];
  const seenSubset = new Set();
  function pushIfValid(type, combo) {
    const key = combo.map(c => c.id).sort().join(',');
    if (seenSubset.has(key)) return;
    const ok = (type === MELD_TYPE.SET) ? validator.isValidSet(combo, true) : validator.isValidSequence(combo, true);
    if (ok) {
      seenSubset.add(key);
      validSubsets.push({ type, cards: combo.slice() });
    }
  }
  function getCombos(arr, k) {
    const res = [];
    function bt(start, cur) {
      if (cur.length === k) { res.push(cur.slice()); return; }
      for (let i = start; i < arr.length; i++) {
        cur.push(arr[i]); bt(i + 1, cur); cur.pop();
      }
    }
    bt(0, []);
    return res;
  }

  /* [EXPERT-AI] تعداد موجّه: المتتاليات من نفس الرمز فقط، والمتماثلات من نفس
     الرقم فقط (3-4 أوراق)، والجوكرات تنضم لكل مجموعة — نفس النتائج تماماً
     مع خفض حجم التعداد أضعافاً مضاعفة */
  const wilds = cards.filter(c => rules.isWildCard(c));
  const suitGroups = new Map();
  const rankGroups = new Map();
  for (const c of cards) {
    if (rules.isWildCard(c)) continue;
    if (!suitGroups.has(c.suit)) suitGroups.set(c.suit, []);
    suitGroups.get(c.suit).push(c);
    if (!rankGroups.has(c.rank)) rankGroups.set(c.rank, []);
    rankGroups.get(c.rank).push(c);
  }
  for (const group of suitGroups.values()) {
    const pool = group.concat(wilds);
    for (let sz = 3; sz <= Math.min(pool.length, 7); sz++) {
      for (const combo of getCombos(pool, sz)) pushIfValid(MELD_TYPE.SEQUENCE, combo);
    }
  }
  for (const group of rankGroups.values()) {
    const pool = group.concat(wilds);
    for (let sz = 3; sz <= Math.min(pool.length, 4); sz++) {
      for (const combo of getCombos(pool, sz)) pushIfValid(MELD_TYPE.SET, combo);
    }
  }

  if (validSubsets.length === 0) return [];

  let bestCombination = [];
  let maxCoveredCards = 0;
  let bestFreeScore = -1;

  const meldFreeScore = (m) => {
    if (m.cards.some(c => rules.isWildCard(c))) return 0;
    /* [v18] الآس سياقي: 10 في المتماثلة/نهاية المتتالية، 1 في بدايتها */
    return rules.meldPoints(m);
  };

  function search(idx, currentUsed, currentMelds) {
    const curFree = currentMelds.reduce((sm, m) => sm + meldFreeScore(m), 0);
    if (openingMode) {
      /* الافتتاح: النقاط الحرة أولاً ثم التغطية */
      if (curFree > bestFreeScore || (curFree === bestFreeScore && currentUsed.size > maxCoveredCards)) {
        bestFreeScore = curFree;
        maxCoveredCards = currentUsed.size;
        bestCombination = currentMelds.slice();
      }
    } else if (currentUsed.size > maxCoveredCards) {
      maxCoveredCards = currentUsed.size;
      bestCombination = currentMelds.slice();
    }
    for (let i = idx; i < validSubsets.length; i++) {
      const sub = validSubsets[i];
      const hasOverlap = sub.cards.some(c => currentUsed.has(c.id));
      if (!hasOverlap) {
        const nextUsed = new Set(currentUsed);
        sub.cards.forEach(c => nextUsed.add(c.id));
        search(i + 1, nextUsed, [...currentMelds, new RamiMeld(sub.type, sub.cards.slice())]);
      }
    }
  }

  search(0, new Set(), []);
  if (__ramiPartCache.size > 3000) __ramiPartCache.clear();
  __ramiPartCache.set(cacheKey, bestCombination.map(m => new RamiMeld(m.type, m.cards.slice())));
  return bestCombination;
}

/* ═══════════════════════════════════════════════════════════════
   [EXPERT-AI] محرّك الخبير لرامي — قرارات أمثل بنسبة خطأ 0%:
   • السحب: لا يأخذ المرموق إلا إذا كان سيُنزَل في نفس الدور فعلاً
     (إنهاء فوري / إكمال افتتاح / إدراج في طاولة / إكمال مجموعة جديدة)
   • الإنزال: بعد الافتتاح يُنزّل كل مجموعة مكتمّلة في يده فوراً —
     أسرع طريق لتفريغ اليد والفوز، ويحمي من جزاء ورقة المرموق
   • الرمي: أسوأ ورقة حسابياً — لا يرمي جوكراً ولا ورقة داخل مجموعة
     حية ولا يُطعم خصماً مفتوحاً (خطر قانون الـ12) ويرمي الأعلى قيمة أولاً
   ═══════════════════════════════════════════════════════════════ */
const RamiExpertAI = {
  /* محاكاة إنهاء الشوط بإضافة ورقة: كل اليد مجموعات + ورقة معزولة واحدة */
  simCanFinish(hand, extra, rules) {
    if (!extra) return false;
    const testHand = hand.concat([extra]);
    const melds = partitionSelectedCards(testHand, rules);
    if (!melds || melds.length === 0) return false;
    const ids = new Set();
    for (const m of melds) for (const c of m.cards) ids.add(c.id);
    if (!ids.has(extra.id)) return false;            /* المرموق يجب أن يُنزّل ضمن المجموعات */
    const leftover = testHand.filter(c => !ids.has(c.id));
    if (leftover.length !== 1) return false;
    return rules.validateFinishStructure(melds, extra).valid;
  },

  /* هل تُكمل الورقة الإضافية مجموعة جديدة في اليد (ستُنزّل هذا الدور)؟ */
  completesNewMeld(hand, extra, rules) {
    if (!extra) return false;
    const melds = partitionSelectedCards(hand.concat([extra]), rules);
    if (!melds) return false;
    for (const m of melds) if (m.cards.some(c => c.id === extra.id)) return true;
    return false;
  },

  /* قرار السحب — allowLayoffTake: الإدراج المباشر في الطاولة (محلي فقط) */
  chooseDraw(game, player, allowLayoffTake) {
    const rm = game.roundManager;
    if (rm.discardPile.length === 0) return 'draw_deck';
    const top = rm.discardPile[rm.discardPile.length - 1];
    /* موانع قانونية من سحب المرموق */
    const dealerBarred = (player.id === rm.dealerIndex && rm.dealerFirstCycle);
    if (dealerBarred || player.hand.length === 1 || player.meldCount() >= 13) return 'draw_deck';
    /* قانون الـ12: مع 12+ منزلة يجب أخذ الورقة المطابقة وإلا جزاء مؤكد */
    if (player.meldCount() >= 12 && game.doesCardFitAnyTableMeld(top)) return 'draw_discard';
    /* 1) إنهاء الشوط فوراً بهذه الورقة */
    if (this.simCanFinish(player.hand, top, game.rules)) return 'draw_discard';
    /* 2) إكمال شروط الافتتاح */
    if (!player.hasOpened) {
      const testHand = player.hand.concat([top]);
      const candidateMelds = partitionSelectedCards(testHand, game.rules);
      const check = game.rules.validateOpening(candidateMelds, top, rm.jokerIndicator, rm.highestOpeningScore || 0, false);
      return check.valid ? 'draw_discard' : 'draw_deck';
    }
    /* 3) مفتوح: تصلح للإدراج الفوري في مجموعات الطاولة (بيد ≥ 4 فقط —
       أقل من ذلك لا يفرّغ اليد بل يقود للحصار) */
    if (allowLayoffTake && player.hand.length >= 4 && game.doesCardFitAnyTableMeld(top)) return 'draw_discard';
    /* 4) مفتوح: تُكمل مجموعة جديدة في اليد (تُنزّل هذا الدور) */
    if (this.completesNewMeld(player.hand, top, game.rules)) return 'draw_discard';
    return 'draw_deck';
  },

  /* درجة إبقاء الورقة في اليد — الأدنى هي المرشّحة للرمي */
  keepScore(game, player, card, inMeldIds) {
    const rules = game.rules, rm = game.roundManager;
    if (rules.isWildCard(card)) {
      /* الجوكر لا يُرمى أبداً — إلا فائضاً ثالثاً فأكثر في نهاية ميتة */
      const jc = player.hand.filter(c => rules.isWildCard(c)).length;
      return jc <= 2 ? 1e9 : 2500;
    }
    let s = 0;
    if (!player.hasOpened) {
      /* قبل الافتتاح: المهمة جمع 71 نقطة حرة + متتالية ومتماثلة نقطيتين —
         تُحفظ الأوراق العالية القيمة والثنائيات الواعدة، وتُرمى المنخفضة المعزولة */
      s += card.baseValue * 10;
      if (inMeldIds.has(card.id)) s += 1200 + card.baseValue * 20;  /* داخل مجموعة حية */
      for (const o of player.hand) {
        if (o.id === card.id) continue;
        if (rules.isWildCard(o)) { s += 200; continue; }
        if (o.rank === card.rank) s += 30 + o.baseValue * 4;        /* ثنائية عالية أفضل */
        else if (o.suit === card.suit) {
          const d = Math.abs(o.rank - card.rank);
          if (d === 1) s += 35 + o.baseValue * 3.5;                 /* جوار متتالية */
          else if (d === 2) s += 14 + o.baseValue * 1.5;
        }
      }
    } else {
      /* بعد الافتتاح: تفريغ اليد بأمان — رمي الأعلى قيمة أولاً لتقليل الحصيلة */
      if (inMeldIds.has(card.id)) s += 5000 + card.baseValue * 10;  /* داخل مجموعة حية */
      for (const o of player.hand) {
        if (o.id === card.id) continue;
        if (rules.isWildCard(o)) { s += 30; continue; }
        if (o.rank === card.rank) s += 60;
        else if (o.suit === card.suit) {
          const d = Math.abs(o.rank - card.rank);
          if (d === 1) s += 70; else if (d === 2) s += 35;
        }
      }
      s -= card.baseValue * 8;
      if (rm.tableMelds.length > 0 && game.doesCardFitAnyTableMeld(card)) s += 400;
    }
    /* خطر الإطعام: خصم مفتوح سيلتقطها وينزلها فوراً */
    const openOpps = game.players.filter(p => p.id !== player.id && p.hasOpened);
    if (openOpps.length > 0 && game.doesCardFitAnyTableMeld(card)) s -= 8000;
    if (openOpps.some(o => o.meldCount() >= 12) && game.doesCardFitAnyTableMeld(card)) s -= 1e8; /* قانون الـ12 */
    return s;
  },

  /* الافتتاح الخبير: افتتاح كامل التقسيم، إلا إذا ترك ورقتين فقط
     (حصار دائم بعد رمي التخلص) — حينها يُسقط أصغر مجموعة تبقي الشروط
     مستوفاة وبقايا >= 3، أو يؤجّل الافتتاح دوراً آخر */
  /* كل المتتاليات النقية المرشّحة (3-5 نفس الرمز بلا جوكر) */
  _pureSequences(hand, rules) {
    const res = [];
    const bySuit = new Map();
    for (const c of hand) {
      if (rules.isWildCard(c)) continue;
      if (!bySuit.has(c.suit)) bySuit.set(c.suit, []);
      bySuit.get(c.suit).push(c);
    }
    for (const arr of bySuit.values()) {
      const uniq = [];
      const seen = new Set();
      for (const c of arr.slice().sort((a, b) => a.rank - b.rank)) {
        const k = c.rank;                        /* نسخة واحدة من كل رتبة تكفي للمرشّح */
        if (!seen.has(k)) { seen.add(k); uniq.push(c); }
      }
      for (let i = 0; i < uniq.length; i++) {
        const run = [uniq[i]];
        for (let j = i + 1; j < uniq.length; j++) {
          if (uniq[j].rank === run[run.length - 1].rank + 1) {
            run.push(uniq[j]);
            if (run.length >= 3 && run.length <= 5) res.push(run.slice());
          } else break;
        }
      }
    }
    return res;
  },

  /* كل المتماثلات النقية المرشّحة (3-4 برموز مختلفة بلا جوكر) */
  _pureSets(hand, rules) {
    const res = [];
    const byRank = new Map();
    for (const c of hand) {
      if (rules.isWildCard(c)) continue;
      if (!byRank.has(c.rank)) byRank.set(c.rank, []);
      byRank.get(c.rank).push(c);
    }
    for (const arr of byRank.values()) {
      const suits = new Map();
      for (const c of arr) if (!suits.has(c.suit)) suits.set(c.suit, c);
      const uniq = [...suits.values()];
      if (uniq.length >= 3) {
        res.push(uniq.slice(0, 4));
      }
    }
    return res;
  },

  expertOpening(game, player) {
    const rm = game.roundManager;
    if (player.id === rm.dealerIndex && rm.dealerFirstCycle) return null;
    const rules = game.rules;
    let melds = partitionSelectedCards(player.hand, rules, 'opening');
    if (!melds || melds.length === 0) return null;
    /* [0% خطأ] لا محاولة افتتاح إلا إذا كانت الشروط مستوفاة فعلاً.
       تقسيم التغطية القصوى قد يُفقد المتتالية/المتماثلة النقية المطلوبة —
       لذا نبحث عن تقسيم بديل يضمن وجودهما مع أعلى مجموع */
    let chk = rules.validateOpening(melds, player.drawnDiscardCard, rm.jokerIndicator, rm.highestOpeningScore || 0, false);
    if (!chk.valid) {
      let bestMelds = null, bestScore = -1;
      const tryFix = (anchor) => {
        const anchorIds = new Set(anchor.map(c => c.id));
        const restCards = player.hand.filter(c => !anchorIds.has(c.id));
        const rest = partitionSelectedCards(restCards, rules, 'opening');
        const cand = [new RamiMeld(
          (anchor[1] && anchor[0] && anchor[0].suit !== undefined && new Set(anchor.map(c => c.suit)).size === 1)
            ? MELD_TYPE.SEQUENCE : MELD_TYPE.SET, anchor.slice())].concat(rest || []);
        const c2 = rules.validateOpening(cand, player.drawnDiscardCard, rm.jokerIndicator, rm.highestOpeningScore || 0, false);
        if (c2.valid && c2.score > bestScore) { bestScore = c2.score; bestMelds = cand; }
      };
      for (const seq of this._pureSequences(player.hand, rules)) tryFix(seq);
      for (const set of this._pureSets(player.hand, rules)) tryFix(set);
      if (!bestMelds) return null;
      melds = bestMelds;
      chk = { valid: true };
    }
    const total = player.hand.length;
    const covered = melds.reduce((sm, m) => sm + m.cards.length, 0);
    let chosen = melds;
    if (total - covered === 2) {
      const bySize = melds.slice().sort((a, b) => a.cards.length - b.cards.length);
      let ok = false;
      for (let i = 0; i < bySize.length && !ok; i++) {
        const keep = bySize.slice(0, i).concat(bySize.slice(i + 1));
        if (keep.length === 0) break;
        const keepCards = keep.flatMap(m => m.cards.map(c => c.id));
        if (total - keepCards.length >= 3) {
          /* تحقق على إعادة تقسيم الأوراق نفسها — نفس ما سيراه المحرك */
          const rePart = partitionSelectedCards(
            keepCards.map(id => player.hand.find(c => c.id === id)), game.rules);
          const chk = game.rules.validateOpening(rePart, player.drawnDiscardCard, rm.jokerIndicator, rm.highestOpeningScore || 0, false);
          if (chk.valid) { chosen = rePart.length ? rePart : keep; ok = true; }
        }
      }
      if (!ok) return null; /* تأجيل الافتتاح */
    }
    return { type: 'open', playerId: player.id, cardIds: chosen.flatMap(m => m.cards.map(c => c.id)) };
  },

  /* النقاط الحرة لمجموعات التقسيم (بدون جوكر — كما في عتبة الافتتاح)
     [v18] الآس سياقي عبر rules.meldPoints */
  _freeScore(melds, rules) {
    let f = 0;
    if (melds) for (const m of melds) {
      if (m.cards.some(c => rules.isWildCard(c))) continue;
      f += rules.meldPoints(m);
    }
    return f;
  },

  /* رمي مرحلة ما قبل الافتتاح: تحليل حديّ — أي ورقة إزالتها أخسر
     للمسار نحو 71 نقطة حرة؟ + كيمياء الثنائيات المستقبلية */
  _chooseOpeningDiscard(game, player, banned) {
    const rules = game.rules, hand = player.hand;
    const melds = partitionSelectedCards(hand, rules, 'opening');
    const F0 = this._freeScore(melds, rules);
    const C0 = melds ? melds.reduce((sm, m) => sm + m.cards.length, 0) : 0;
    /* الجوكرات قبل الافتتاح: قيّمة للإكمال لكنها لا تساهم في الـ71 الحرة */
    const jokerCount = hand.filter(c => rules.isWildCard(c)).length;
    let best = null, bestScore = Infinity;
    for (const c of hand) {
      if (banned.has(c.id)) continue;
      let keep;
      if (rules.isWildCard(c)) {
        keep = (jokerCount <= 2) ? 1e6 : 60000;   /* الفائض أقل قداسة */
      } else {
        const sub = hand.filter(x => x.id !== c.id);
        const pm = partitionSelectedCards(sub, rules, 'opening');
        const F = this._freeScore(pm, rules);
        const C = pm ? pm.reduce((sm, m) => sm + m.cards.length, 0) : 0;
        const loss = (F0 - F) * 6 + (C0 - C) * 30;         /* ما نخسره بإزالتها */
        /* القيمة هي رصيد الافتتاح الحقيقي: الأوراق العالية تبني الـ71 */
        let syn = c.baseValue * 6;
        let dup = false;
        for (const o of hand) {
          if (o.id === c.id) continue;
          if (rules.isWildCard(o)) { syn += 25; continue; }
          if (o.rank === c.rank && o.suit === c.suit) { dup = true; continue; }  /* المكررة لا تشارك المجموعة */
          if (o.rank === c.rank) syn += 8 + o.baseValue;          /* ثنائية برموز مختلفة */
          else if (o.suit === c.suit) {
            const d = Math.abs(o.rank - c.rank);
            if (d === 1) syn += 14 + o.baseValue * 1.2;           /* جوار متتالية */
            else if (d === 2) syn += 5;
          }
        }
        if (dup) syn -= 60;                                 /* النسخة المكررة شبه ميتة */
        keep = loss + syn;
      }
      /* الأدنى قيمةً في الإبقاء هي المرشّحة للرمي */
      if (keep < bestScore) { bestScore = keep; best = c; }
    }
    return best ? best.id : hand[hand.length - 1].id;
  },

  /* اختيار ورقة الرمي المثلى */
  chooseDiscard(game, player) {
    const hand = player.hand;
    if (!hand || hand.length === 0) return null;
    /* ورقة المرموق/لا تور غير المنزلة تُسترجع آلياً — لا يجوز أن تكون هي المرمومة */
    const banned = new Set();
    if (player.drawnDiscardCard) banned.add(player.drawnDiscardCard.id);
    if (player.drawnLaTourCard) banned.add(player.drawnLaTourCard.id);
    if (!player.hasOpened) return this._chooseOpeningDiscard(game, player, banned);
    const melds = partitionSelectedCards(hand, game.rules);
    const inMeldIds = new Set();
    if (melds) for (const m of melds) for (const c of m.cards) inMeldIds.add(c.id);
    let best = null, bestScore = Infinity;
    for (const c of hand) {
      if (banned.has(c.id)) continue;
      const sc = this.keepScore(game, player, c, inMeldIds);
      if (sc < bestScore) { bestScore = sc; best = c; }
    }
    return best ? best.id : hand[hand.length - 1].id;
  }
};
if (typeof window !== 'undefined') window.RamiExpertAI = RamiExpertAI;

/* ═══════════════════════════════════════════
   Digital Moroccan Casino — Rami Engine (Multiplayer Rami/Talaj Card Game)
   محرك رامي — لعبة أوراق متعددة اللاعين (Talaj/Simple)
   ═══════════════════════════════════════════ */
"use strict";

/* ── بذرة عشوائية حتمية (mulberry32) للمزامنة والاختبار ── */
function mulberry32(a) {
  a |= 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── بطاريق Rami Core ── */
/* Ranks: 1–10, J, Q, K */
const RAMI_RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const RAMI_RANK_NAMES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/* Suits: قلب، مربع، سيف، عنب (Moroccan style) */
const RAMI_SUITS = ['heart', 'diamond', 'sword', 'grape'];
const RAMI_SUIT_GLYPH = { heart: '♥', diamond: '♦', sword: '♠', grape: '♣', club: '♣' };
const RAMI_SUIT_COLOR = { heart: 'red', diamond: 'red', sword: 'black', grape: 'black' };
/* ── تعيين أسماء ملفات الأصول (تطابق assets/games/rami/*.webp) ── */
const RAMI_SUIT_ASSET = { heart: 'hearts', diamond: 'diamonds', sword: 'spades', grape: 'clubs' };
/* Maps internal suit keys to asset file names in assets/games/rami/ */

/* CardType */
const CARD_TYPE = { NORMAL: 0, JOKER: 1 };

/* ── صنف الورقة ── */
class RamiCard {
  constructor(id, rank, suit, type) {
    this.id = id;
    this.rank = rank;           // 1-13 (1=Ace, 11=J, 12=Q, 13=K)
    this.suit = suit;           // 'heart'|'diamond'|'sword'|'grape'
    this.type = type || CARD_TYPE.NORMAL;
    this.isJoker = (type === CARD_TYPE.JOKER);
  }

  get baseValue() {
    if (this.isJoker) return 10;
    if (this.rank === 1) return 10; // الآس A = 10 نقاط في حساب الافتتاح والرامي
    return this.rank >= 10 ? 10 : this.rank;
  }

  get rankName() {
    return RAMI_RANK_NAMES[this.rank - 1];
  }

  get suitGlyph() {
    return RAMI_SUIT_GLYPH[this.suit];
  }

  get colorClass() {
    return RAMI_SUIT_COLOR[this.suit];
  }

  get displayName() {
    return this.isJoker ? 'جوكر 🃏' : this.rankName + ' ' + (RAMI_SUIT_GLYPH[this.suit] || '♣');
  }

  clone() {
    return new RamiCard(this.id, this.rank, this.suit, this.type);
  }
}

/* ── مصنع المجموعة ── */
class RamiDeck {
  constructor(rules) {
    this.rules = rules;
    this.cards = [];
    this.build();
  }

  build() {
    this.cards = [];
    let id = 1;
    for (const rank of RAMI_RANKS) {
      for (const suit of RAMI_SUITS) {
        for (let copy = 0; copy < 2; copy++) {
          this.cards.push(new RamiCard(id++, rank, suit, CARD_TYPE.NORMAL));
        }
      }
    }
    if (this.rules.hasPhysicalJokers) {
      for (let i = 0; i < 4; i++) {
        this.cards.push(new RamiCard(id++, 1, 'heart', CARD_TYPE.JOKER));
      }
    }
  }

  shuffle(rng) {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = rng.next(i + 1);
      const t = this.cards[i];
      this.cards[i] = this.cards[j];
      this.cards[j] = t;
    }
  }

}

/* ── مزوّد عشوائية قابل للتحكم ── */
class DeterministicRng {
  constructor(seed) {
    this._fn = mulberry32(seed >>> 0);
  }
  next(max) {
    return Math.floor(this._fn() * max);
  }
}

/* ── اللاعب ── */
class RamiPlayer {
  constructor(id, name, isBot) {
    this.id = id;
    this.name = name;
    this.isBot = !!isBot;
    this.hand = [];      // RamiCard[]
    this.melds = [];     // RamiMeld[]
    this.totalScore = 0;
    this.hasOpened = false;
    this.penaltyScore = 0;
    this.drawnDiscardCard = null;
    this.displayCards = []; // ترتيب عرض ثابت: كل ورقة تحتفظ بموضعها وتنقلب في مكانها عند الإنزال
  }

  handSize() { return this.hand.length; }

  getCard(id) {
    return this.hand.find(c => c.id === id);
  }

  removeCard(id) {
    const idx = this.hand.findIndex(c => c.id === id);
    if (idx < 0) return null;
    return this.hand.splice(idx, 1)[0];
  }

  meldCount() {
    let n = 0;
    for (const m of this.melds) n += m.cards.length;
    return n;
  }
}

/* ── الـ Meld ── */
const MELD_TYPE = { SET: 'set', SEQUENCE: 'sequence' };

class RamiMeld {
  constructor(type, cards) {
    this.type = type;
    this.cards = cards.slice();
    this.id = Math.random().toString(36).slice(2, 10);
  }

  findJokerSwapIndex(card, rules) {
    /* استبدال الجوكر المطبوع فقط — لا الجوكرات البرية (السامبل) لأنها أوراق طبيعية في المجموعة */
    if (!card || card.isJoker) return -1;
    const jokerIdx = this.cards.findIndex(c => c.isJoker);
    if (jokerIdx === -1) return -1;

    const testCards = this.cards.slice();
    testCards[jokerIdx] = card;

    if (this.type === MELD_TYPE.SET && rules.isValidSet(testCards, true)) {
      return jokerIdx;
    }
    if (this.type === MELD_TYPE.SEQUENCE && rules.isValidSequence(testCards, true)) {
      return jokerIdx;
    }
    return -1;
  }

  clone() {
    return new RamiMeld(this.type, this.cards.map(c => c.clone()));
  }
}

/* ── Meld Validator ── */
class MeldValidator {
  constructor(wildChecker) {
    /* wildChecker(card) => true إذا كانت البطاقة جوكراً برياً (مثل جوكر السامبل المعكوس اللون) */
    this._wildChecker = wildChecker || null;
  }

  _isWild(c) {
    if (!c) return false;
    if (c.isJoker) return true;
    return this._wildChecker ? !!this._wildChecker(c) : false;
  }

  /* التحقق الصارم من الـ SET: نفس الرقم، رموز مختلفة بدون تكرار، من 3 إلى 4 بطاقات فقط، وجوكر واحد على الأكثر */
  isValidSet(cards, jokerAllowed) {
    if (!cards || cards.length < 3 || cards.length > 4) return false;

    // الأوراق الطبيعية غير الجوكر؛ الجوكرات: المطبوعة + البرية (في السامبل)
    const naturals = cards.filter(c => !this._isWild(c));
    const wilds = cards.filter(c => this._isWild(c) && !c.isJoker);
    const physJokers = cards.filter(c => c.isJoker);
    if (physJokers.length > 1) return false;
    if (physJokers.length === 1 && !jokerAllowed) return false;

    // تحديد الرتبة: من الأوراق الطبيعية، وإلا من الأوراق البرية (الجوكرات البرية تحدد الرتبة)
    let rank = null;
    if (naturals.length > 0) {
      rank = naturals[0].rank;
      if (naturals.some(c => c.rank !== rank)) return false;
    } else if (wilds.length > 0) {
      rank = wilds[0].rank;
    }
    if (rank === null) return false; // كل البطاقات جوكر مطبوع

    // الرموز يجب أن تكون مختلفة
    const suits = new Set();
    for (const card of naturals) {
      if (suits.has(card.suit)) return false;
      suits.add(card.suit);
    }

    // الجوكرات البرية: تُعامل كطبيعية إن تطابقت رتبتها ورمزها غير مكرر، وإلا كجوكر
    let jokers = physJokers.length;
    let members = naturals.length;
    for (const wc of wilds) {
      if (wc.rank === rank && !suits.has(wc.suit) && members < 4) {
        suits.add(wc.suit);
        members++;
      } else {
        jokers++;
      }
    }

    if (jokers > 1) return false;
    if (jokers === 1 && !jokerAllowed) return false;

    // لا يجوز وضع الجوكر مع متماثلة كاملة من 4 أوراق
    if (members === 4 && jokers > 0) return false;

    return (members + jokers >= 3) && (members + jokers <= 4);
  }

  /* [v18] هل تصحّ هذه المتتالية باعتبار الآس مرتفعاً (...Q-K-A)؟
     تُستعمل لتحديد قيمة الآس السياقية: 10 في نهاية المتتالية، و1 في بدايتها (A-2-3) */
  isAceHighSequence(cards, jokerAllowed) {
    return this._checkSequence(cards, jokerAllowed, 'high');
  }

  /* التحقق الصارم من الـ Sequence: رموز متطابقة، قيم متسلسلة، 3 بطاقات أو أكثر، وجوكر واحد على الأكثر */
  isValidSequence(cards, jokerAllowed) {
    return this._checkSequence(cards, jokerAllowed, 'any');
  }

  /* الفحص الداخلي للمتتالية — aceMode: 'any' (منخفض أو مرتفع) | 'high' (مرتفع فقط) */
  _checkSequence(cards, jokerAllowed, aceMode) {
    if (!cards || cards.length < 3) return false;

    const naturals = cards.filter(c => !this._isWild(c));
    const wilds = cards.filter(c => this._isWild(c) && !c.isJoker);
    const physJokers = cards.filter(c => c.isJoker);
    if (physJokers.length > 1) return false;
    if (physJokers.length === 1 && !jokerAllowed) return false;

    if (naturals.length === 0 && wilds.length === 0) return false;

    // جميع الأوراق الطبيعية يجب أن تكون من نفس الرمز وبرتب مختلفة
    let suit = null;
    if (naturals.length > 0) {
      suit = naturals[0].suit;
      if (naturals.some(c => c.suit !== suit)) return false;
    }
    const natRanks = naturals.map(c => c.rank);
    if (new Set(natRanks).size !== natRanks.length) return false;

    function testSequence(ranks, jokers) {
      ranks.sort((a, b) => a - b);
      let needed = 0;
      for (let i = 1; i < ranks.length; i++) {
        if (ranks[i] === ranks[i - 1]) return false; // تكرار نفس الرقم في نفس الرمز غير مسموح
        needed += (ranks[i] - ranks[i - 1] - 1);
      }
      return needed <= jokers;
    }

    // تجربة كل الاحتمالات: كل جوكر بري إمّا «طبيعي» (يركب بقيمته) أو «جوكر» يسد فجوة
    const totalCombos = 1 << wilds.length;
    for (let mask = 0; mask < totalCombos; mask++) {
      const usedRanks = new Set(natRanks);
      let seqSuit = suit;
      let jokers = physJokers.length;
      let ok = true;

      for (let i = 0; i < wilds.length; i++) {
        const wc = wilds[i];
        if (mask & (1 << i)) {
          // استخدامه كبطاقة طبيعية
          if (seqSuit === null) seqSuit = wc.suit;
          else if (wc.suit !== seqSuit) { ok = false; break; }
          if (usedRanks.has(wc.rank)) { ok = false; break; }
          usedRanks.add(wc.rank);
        } else {
          jokers++;
        }
      }
      if (!ok) continue;
      if (jokers > 1) continue;
      if (jokers === 1 && !jokerAllowed) continue;
      if (usedRanks.size === 0) continue;

      // 1. فحص الآس كرتبة منخفضة (A, 2, 3) — يُتجاوز في وضع 'high'
      if (aceMode !== 'high' && testSequence(Array.from(usedRanks), jokers)) return true;

      // 2. فحص الآس كرتبة مرتفعة (10, J, Q, K, A)
      if (usedRanks.has(1)) {
        const ranksHigh = Array.from(usedRanks).map(r => (r === 1 ? 14 : r));
        if (testSequence(ranksHigh, jokers)) return true;
      }
    }

    return false;
  }

  /* التحقق العام للـ Meld (SET أو Sequence) */
  isValidMeld(cards, jokerAllowed) {
    return this.isValidSet(cards, jokerAllowed) || this.isValidSequence(cards, jokerAllowed);
  }

}

/* ── قواعد Joker Resolver (Simple Mode) ── */
/* في Simple، تظهر بطاقة جوكر محددة، وتصبح بطاقة معينة Joker بناءً على اللون المعاكس */
class OppositeColorJokerResolver {
  isJoker(card, indicator) {
    if (card.isJoker) return true;
    if (!indicator) return false;
    return card.rank === indicator.rank &&
           RAMI_SUIT_COLOR[card.suit] !== RAMI_SUIT_COLOR[indicator.suit];
  }
}

/* ── القواعد الأساسية للعبة ── */
class RamiRules {
  constructor(mode, turnSeconds) {
    this.mode = mode || 'talaj'; // 'talaj' or 'simple'
    this.turnSeconds = turnSeconds || 90;
    this.jokerIndicator = null;
    this.jokerResolver = new OppositeColorJokerResolver();
    this.validator = new MeldValidator((c) => this.isWildCard(c));
  }

  /* بطاقة جوكر بري؟ (مطبوعة في الطالاج، أو معكوسة اللون في السامبل) */
  isWildCard(c) {
    if (!c) return false;
    if (c.isJoker) return true;
    if (this.jokerIndicator && this.jokerResolver.isJoker(c, this.jokerIndicator)) return true;
    return false;
  }

  get deckSize() { return this.mode === 'talaj' ? 108 : 104; }
  get initialHandSize() { return this.mode === 'talaj' ? 14 : 13; }
  get dealerHandSize() { return this.mode === 'talaj' ? 15 : 13; }
  /* سقف عدد الأوراق في اليد أثناء اللعب (قبل رمي ورقة التخلص) */
  get playHandSize() { return this.mode === 'talaj' ? 15 : 14; }
  get openingThreshold() { return this.mode === 'talaj' ? 71 : 51; }
  get finishPenalty() { return this.mode === 'talaj' ? 71 : 51; }
  get fullHandPenalty() { return this.mode === 'talaj' ? 100 : 51; }
  get hasPhysicalJokers() { return this.mode === 'talaj'; }

  isValidSet(cards, jokerAllowed) {
    return this.validator.isValidSet(cards, jokerAllowed);
  }

  isValidSequence(cards, jokerAllowed) {
    return this.validator.isValidSequence(cards, jokerAllowed);
  }

  isValidMeld(cards, jokerAllowed) {
    return this.validator.isValidMeld(cards, jokerAllowed);
  }

  /* [v18] قيمة الورقة داخل مجموعة — الآس سياقي:
     A = 10 في المتماثلة وفي نهاية المتتالية (...Q-K-A / ...J-Q-K-A)
     A = 1  في بداية المتتالية (A-2-3 / A-2-3-4 ...) */
  cardPointsInMeld(card, meld) {
    if (this.isWildCard(card)) return 0;
    if (card.rank !== 1) return card.baseValue;
    if (meld && meld.type === MELD_TYPE.SEQUENCE &&
        !this.validator.isAceHighSequence(meld.cards, true)) {
      return 1; // متتالية تصح فقط بالآس المنخفض (A-2-3...)
    }
    return 10; // متماثلة، أو متتالية بالآس المرتفع (Q-K-A)
  }

  /* [v18] مجموع نقاط مجموعة (الجوكرات = 0، الآس سياقي) */
  meldPoints(meld) {
    let s = 0;
    for (const c of meld.cards) s += this.cardPointsInMeld(c, meld);
    return s;
  }

  /* التحقق من الافتتاح: SET + Sequence، المجموع > threshold، لا Joker */
    /* التحقق الصارم من شروط الافتتاح: متتالية نقية + متماثلة نقية + مجموع ≥ 71 بدون جوكر + تجاوز أعلى افتتاح سابق */
  validateOpening(melds, drawnDiscardCard, jokerIndicator, highestPrevScore, isLaTour) {
    if (!melds || melds.length === 0) return { valid: false, error: 'لا توجد مجموعات صالحة للافتتاح' };

    // 1. التحقق من وجود متماثلة نقية (Set) خالية من الجوكر ولا تعتمد على ورقة المرموق/لا تور للافتتاح
    const pureSets = melds.filter(m => {
      if (m.type !== MELD_TYPE.SET || m.cards.length < 3) return false;
      // خالية من الجوكر (المطبوع أو البري)
      if (m.cards.some(c => this.isWildCard(c))) return false;
      // خالية من ورقة المرموق المسحوبة / لا تور
      if (drawnDiscardCard && m.cards.some(c => c.id === drawnDiscardCard.id)) return false;
      return true;
    });

    // 2. التحقق من وجود متتالية نقية (Sequence) خالية من الجوكر ولا تعتمد على ورقة المرموق/لا تور للافتتاح
    const pureSequences = melds.filter(m => {
      if (m.type !== MELD_TYPE.SEQUENCE || m.cards.length < 3) return false;
      if (m.cards.some(c => this.isWildCard(c))) return false;
      if (drawnDiscardCard && m.cards.some(c => c.id === drawnDiscardCard.id)) return false;
      return true;
    });

    /* الطالاج: متتالية نقية + متماثلة نقية معاً.
       السامبل: متتالية نقية واحدة تكفي (بدون اشتراط المتماثلة). */
    const needsPureSet = (this.mode === 'talaj');
    if (pureSequences.length === 0 || (needsPureSet && pureSets.length === 0)) {
      return {
        valid: false,
        error: needsPureSet
          ? 'يجب أن يتضمن الافتتاح متتالية نقية من نفس الرمز (3+ أرقام) ومتماثلة نقية (3-4 أرقام برموز مختلفة) خاليتين تماماً من الجوكر وورقة المرموق'
          : 'يجب أن يتضمن الافتتاح متتالية نقية واحدة على الأقل من نفس الرمز (3+ أرقام) خالية تماماً من الجوكر وورقة المرموق'
      };
    }

    // 3. [V19] حساب المجموع الحر: أوراق المجموعات الخالية تماماً من الجوكر فقط.
    //    المجموعات التي تحوي جوكراً لا تساهم في عتبة الافتتاح، بل تزيد المجموع الإجمالي
    //    لتجاوز أعلى افتتاح سابق فقط.
    //    [v18] الآس سياقي: A = 10 في المتماثلة وفي نهاية المتتالية (Q-K-A)،
    //    و A = 1 في بداية المتتالية (A-2-3). الصور = 10، الجوكر = 0.
    let freeScore = 0;
    let extraScore = 0;
    for (const meld of melds) {
      const hasWild = meld.cards.some(c => this.isWildCard(c));
      for (const card of meld.cards) {
        if (this.isWildCard(card)) continue;
        const pts = this.cardPointsInMeld(card, meld);
        if (hasWild) extraScore += pts;
        else freeScore += pts;
      }
    }
    const totalScore = freeScore + extraScore;

    if (freeScore < this.openingThreshold) {
      return {
        valid: false,
        score: totalScore,
        freeScore: freeScore,
        error: 'المجموع الحر للافتتاح (' + freeScore + ') أقل من الحد القانوني (' + this.openingThreshold + ' نقطة بدون جوكر) — مجموعات الجوكر لا تُحتسب في العتبة، يجب أن تحقق ' + this.openingThreshold + ' نقطة حرة أولاً'
      };
    }

    // 4. قاعدة تجاوز أعلى افتتاح سابق (> X) — تُقارن بالمجموع الإجمالي (يشمل مجموعات الجوكر)
    if (highestPrevScore && highestPrevScore > 0 && totalScore <= highestPrevScore) {
      return {
        valid: false,
        score: totalScore,
        freeScore: freeScore,
        error: 'يجب أن يتجاوز مجموع افتتاحك (' + totalScore + ') أعلى افتتاح سابق في الشوط (' + highestPrevScore + ' نقطة)'
      };
    }

    return { valid: true, score: totalScore, freeScore: freeScore };
  }

  /* [V28] البنية الهيكلية للإنهاء: متتالية حرة + متماثلة حرة خاليتين من الجوكر والمرموق —
     بدون عتبة الـ71 (العتبة تُطبَّق فقط في مسار الافتتاح). */
  validateFinishStructure(melds, drawnDiscardCard) {
    if (!melds || melds.length === 0) return { valid: false, pureSets: 0, pureSequences: 0 };
    const isPure = (m) => {
      if (!m.cards || m.cards.length < 3) return false;
      if (m.cards.some(c => this.isWildCard(c))) return false;
      if (drawnDiscardCard && m.cards.some(c => c.id === drawnDiscardCard.id)) return false;
      return true;
    };
    const pureSets = melds.filter(m => m.type === MELD_TYPE.SET && isPure(m)).length;
    const pureSequences = melds.filter(m => m.type === MELD_TYPE.SEQUENCE && isPure(m)).length;
    const needsPureSet = (this.mode === 'talaj');
    return {
      valid: pureSequences > 0 && (!needsPureSet || pureSets > 0),
      pureSets: pureSets,
      pureSequences: pureSequences
    };
  }

}

/* ── مدير الجولة ── */
class RoundManager {
  constructor(rules, rng) {
    this.rules = rules;
    this.rng = rng;
    this.deck = new RamiDeck(rules);
    this.players = [];
    this.currentPlayerIndex = 0;
    this.dealerIndex = 0;
    this.drawPile = [];
    this.discardPile = [];
    this.tableMelds = [];
    this.jokerIndicator = null;
    this.turnPhase = 'WAITING_DRAW';
    this.roundNumber = 0;
    this.turnSecondsRemaining = rules.turnSeconds;
    this.highestOpeningScore = 0;
    this.highestOpeningPlayer = null;
    this.jokerDouble = false; // تضاعف جزاء الشوط عند إنهاء بجوكر حر معزول
    /* [V29] دورة الموزع الأولى: لا يفتتح ولا يسحب المرموق قبل السحب من ورق التوزيع */
    this.dealerFirstCycle = false;
  }

  initPlayers(playerCount, botCount, botSeats) {
    this.players = [];
    const humanCount = Math.max(1, playerCount - (botCount || 0));
    /* botSeats: قائمة بمقاعد الآلي صراحةً (للغرف المختلطة بشر+آلي في مقاعد متفرقة) */
    const seatIsBot = (botSeats && botSeats.length)
      ? (i) => botSeats.indexOf(i) !== -1
      : (i) => (i >= humanCount);
    for (let i = 0; i < playerCount; i++) {
      const isBot = seatIsBot(i);
      const nm = isBot ? ('AI ' + (i + 1)) : _ramiT('parchisi.you', 'أنت');
      this.players.push(new RamiPlayer(i, nm, isBot));
    }
    this.dealerIndex = 0;
    this.currentPlayerIndex = (this.rules.mode === 'talaj') ? this.dealerIndex : (this.dealerIndex + 1) % playerCount;
  }

  startRound() {
    if (typeof clearRamiPartitionCache === 'function') clearRamiPartitionCache();
    this.roundNumber++;
    this.dealRound();
  }

  /* [V14] فحص سلامة الرزمة: العدد الكلي (108 طلاج / 104 سامبل) وتكرار كل ورقة مرتين فقط (جوكر 4) */
  verifyDeckIntegrity(cards) {
    const expected = this.rules.hasPhysicalJokers ? 108 : 104;
    const counts = new Map();
    for (const c of cards) {
      const k = c.isJoker ? 'JOKER' : (c.rank + ':' + c.suit);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    if (cards.length !== expected) {
      return { ok: false, problem: 'العدد الإجمالي ' + cards.length + ' بدل ' + expected };
    }
    for (const [k, n] of counts) {
      const limit = (k === 'JOKER') ? 4 : 2;
      if (n !== limit) {
        return { ok: false, problem: 'الورقة ' + k + ' تكررت ' + n + '× بدل ' + limit };
      }
    }
    return { ok: true, problem: null };
  }

  dealRound() {
    this.deck = new RamiDeck(this.rules);
    this.deck.shuffle(this.rng);
    /* [V14] حارس سلامة الرزمة: 108/104 ورقة بالضبط — زوجان من كل ورقة طبيعية + 4 جواكر.
       يمنع برمجياً أي تكرار لورقة معينة أكثر من مرتين قبل خلط المرموق. */
    const check = this.verifyDeckIntegrity(this.deck.cards);
    if (!check.ok && typeof console !== 'undefined') {
      console.error('[Rami] تكرار ورقة في الرزمة — تم إعادة البناء:', check.problem);
    }
    this.drawPile = this.deck.cards.slice();
    this.discardPile = [];
    this.tableMelds = [];
    this.jokerIndicator = null;
    this.laTourCard = null;
    this.turnCount = 0;
    this.isFirstTourCycle = true;
    this.turnPhase = 'WAITING_DRAW';
    this.jokerDouble = false;
    this.highestOpeningScore = 0;
    this.highestOpeningPlayer = null;
    this.turnSecondsRemaining = this.rules.turnSeconds;
    /* [V29] الموزع يبدأ دورته الأولى (لا افتتاح ولا سحب مرموق قبل السحب من التوزيع) */
    this.dealerFirstCycle = true;

    /* مسح أيدي اللاعبين وكل الحالات العالقة من الشوط السابق (منع تسرب ورقة مرموق/لا تور بين الأشواط) */
    for (const p of this.players) {
      p.hand = [];
      p.melds = [];
      p.hasOpened = false;
      p.drawnDiscardCard = null;
      p.drawnLaTourCard = null;
      p.tookLaTour = false;
    }

    /* توزيع البطاقات: Talaj يمنح الموزع 15 ورقة والآخرين 14 ورقة.
       [V18] اللاعبون المُقصون لا تُوزَّع لهم أوراق (خرجوا من الجولة). */
    for (let i = 0; i < this.players.length; i++) {
      const playerIdx = i;
      if (this.players[playerIdx].isEliminated) continue;
      const isDealer = (playerIdx === this.dealerIndex);
      const amount = isDealer ? this.rules.dealerHandSize : this.rules.initialHandSize;
      const cards = this.drawFromPile(amount);
      this.players[playerIdx].hand.push(...cards);
    }
    /* ترتيب عرض ثابت: الأوراق تحفظ مواضعها منذ التوزيع وتنقلب في مكانها عند الإنزال */
    for (let i = 0; i < this.players.length; i++) {
      this.players[i].displayCards = this.players[i].hand.slice();
    }
    /* [V18] أول لاعب نشط يبدأ الشوط (تخطي المُقصيين) */
    this.currentPlayerIndex = this.firstActiveFrom((this.rules.mode === 'talaj') ? this.dealerIndex : (this.dealerIndex + 1));

    /* للـ Simple: بطاقة جوكر محددة من أعلى المجرف */
    if (!this.rules.hasPhysicalJokers && this.drawPile.length > 0) {
      this.jokerIndicator = this.drawPile.pop();
      this.rules.jokerIndicator = this.jokerIndicator;
    } else {
      this.rules.jokerIndicator = null;
    }

    /* في وضع الطالاج: الموزع يملك 15 ورقة بالفعل، ويبدأ دوره في مرحلة رمي الورقة الـ15 دون سحب */
    if (this.rules.mode === 'talaj') {
      this.turnPhase = 'WAITING_DISCARD';
    } else {
      this.turnPhase = 'WAITING_DRAW';
      /* في السامبل: بطاقة مرموقة أولى يرميها الموزع */
      if (this.drawPile.length > 0) {
        this.discardPile.push(this.drawPile.pop());
      }
    }
  }

  drawFromPile(n) {
    const result = [];
    for (let i = 0; i < n; i++) {
      if (this.drawPile.length === 0) {
        this.recycleDiscardPile();
        if (this.drawPile.length === 0) break;
      }
      result.push(this.drawPile.pop());
    }
    return result;
  }

  drawFromDiscard() {
    if (this.discardPile.length === 0) return null;
    return this.discardPile.pop();
  }

  recycleDiscardPile() {
    /* القاعدة الصحيحة: عند نفاد المجرف يُعاد خلط أوراق المرموق فقط (ما عدا أعلى ورقة)
       وتُترك مجموعات الطاولة المنزلة كما هي — لا يجوز المساس بها وإلا تكررت الأوراق */
    if (this.drawPile.length > 0) return 0;

    if (this.discardPile.length <= 1) return 0;

    const topCard = this.discardPile.pop();
    const recycleCards = this.discardPile.splice(0);
    this.discardPile = [topCard];

    this.laTourCard = null;

    if (recycleCards.length === 0) return 0;

    // إعادة خلط أوراق المرموق المسترجعة عشوائياً إلى المجرف
    for (let i = recycleCards.length - 1; i > 0; i--) {
      const j = this.rng.next(i + 1);
      const t = recycleCards[i];
      recycleCards[i] = recycleCards[j];
      recycleCards[j] = t;
    }
    this.drawPile = recycleCards;
    return recycleCards.length;
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  /* [V18] أول لاعب نشط (غير مُقصى) ابتداءً من المؤشر المعطى */
  firstActiveFrom(index) {
    const n = this.players.length;
    for (let k = 0; k < n; k++) {
      const i = (index + k) % n;
      if (!this.players[i].isEliminated) return i;
    }
    return index % n;
  }

  nextPlayer() {
    this.turnCount = (this.turnCount || 0) + 1;
    if (this.turnCount >= this.players.length) {
      this.isFirstTourCycle = false; // انتهاء الدور الأول لكل لاعب -> إغلاق إمكانية أخذ ورقة الموزع الأولى (لا تور)
    }
    /* [V18] تخطي اللاعبين المُقصيين */
    this.currentPlayerIndex = this.firstActiveFrom(this.currentPlayerIndex + 1);
    this.turnPhase = 'WAITING_DRAW';
    this.turnSecondsRemaining = this.rules.turnSeconds;
  }

}

/* ── مدير الألعاب الكامل ── */
class RamiGame {
  constructor(mode, playerCount, botCount, seed, turnSeconds, botSeats) {
    this.mode = mode || 'talaj';
    this.seed = seed !== undefined ? seed : Math.floor(Math.random() * 0xFFFFFFFF);
    this.turnSeconds = turnSeconds || 90;
    this.rng = new DeterministicRng(this.seed);
    this.rules = new RamiRules(this.mode, this.turnSeconds);
    this.roundManager = new RoundManager(this.rules, this.rng);
    this.players = [];
    this.gamePhase = 'LOBBY'; // LOBBY, ROUND_SETUP, PLAYING, ROUND_END, MATCH_END
    this.targetScore = this.rules.mode === 'talaj' ? 701 : 501;
    this.playerCount = playerCount || 4;
    this.botCount = botCount || 0;
    this.botSeats = botSeats || null;   /* [MP-AI] مقاعد الآلي صراحةً (غرف مختلطة) */
  }

  get currentPlayerIndex() {
    return this.roundManager ? this.roundManager.currentPlayerIndex : 0;
  }
  set currentPlayerIndex(val) {
    if (this.roundManager) this.roundManager.currentPlayerIndex = val;
  }

  /* بدء المباراة */
  startMatch(targetScore) {
    this.targetScore = targetScore || this.targetScore;
    this.playerCount = Math.min(Math.max(this.playerCount, 2), 5);
    this.botCount = Math.min(Math.max(this.botCount, 0), this.playerCount - 1);
    this.roundManager.initPlayers(this.playerCount, this.botCount, this.botSeats);
    this.players = this.roundManager.players;
    this.dealRound();
    this.gamePhase = 'PLAYING';
  }

  startRound() {
    this.roundManager.startRound();
    this.players = this.roundManager.players;
    /* [V18] دور البداية يُحسب داخل roundManager.dealRound (يتخطى المُقصيين) */
    this.currentPlayerIndex = this.roundManager.currentPlayerIndex;
  }

  /* توزيع الأوراق فقط دون زيادة رقم الشوط (يُستخدم للشوط التجريبي قبل اختيار الموزع) */
  dealRound() {
    this.roundManager.dealRound();
    this.players = this.roundManager.players;
    this.currentPlayerIndex = this.roundManager.currentPlayerIndex;
  }

  /* مزامنة طور اللعب مع حجم اليد: اليد الممتلئة تعني أن اللاعب سحب بالفعل وعليه الرمي فقط.
     يمنع الـ Deadlock (يد ممتلئة + طور سحب = لا سحب ولا رمي). */
  normalizeTurnPhase() {
    const rm = this.roundManager;
    if (!rm || rm.turnPhase !== 'WAITING_DRAW') return;
    const curP = rm.getCurrentPlayer();
    if (curP && curP.hand && curP.hand.length >= this.rules.playHandSize) {
      rm.turnPhase = 'WAITING_DISCARD';
    }
  }

  doesCardFitAnyTableMeld(card) {
    if (!card || !this.roundManager.tableMelds) return false;
    for (const meld of this.roundManager.tableMelds) {
      const temp = meld.cards.concat([card]);
      if (meld.type === MELD_TYPE.SET && this.rules.isValidSet(temp, true)) return true;
      if (meld.type === MELD_TYPE.SEQUENCE && this.rules.isValidSequence(temp, true)) return true;
      if (typeof meld.findJokerSwapIndex === 'function' && meld.findJokerSwapIndex(card, this.rules) !== -1) return true;
    }
    return false;
  }

  /* منطق استخراج كل الحركات القانونية للاعب الحالي */
  getLegalMoves(playerId) {
    const moves = [];
    const player = this.players.find(p => p.id === playerId);
    if (!player || this.gamePhase !== 'PLAYING') return moves;
    this.normalizeTurnPhase();

    if (this.roundManager.turnPhase === 'WAITING_DRAW') {
      const maxHand = this.rules.playHandSize;
      if (player.hand.length < maxHand) {
        if (this.roundManager.drawPile.length > 0 || this.roundManager.discardPile.length > 1) {
          moves.push({ type: 'draw_deck', playerId });
        }
        // قانون الـ 13 ورقة: إذا كانت اليد بها ورقة واحدة، يحرم من سحب المرموق
        // [V29] الموزع لا يسحب المرموق في دورته الأولى
        const dealerBarred = (player.id === this.roundManager.dealerIndex && this.roundManager.dealerFirstCycle);
        if (!dealerBarred && this.roundManager.discardPile.length > 0 && player.hand.length > 1 && player.meldCount() < 13) {
          moves.push({ type: 'draw_discard', playerId });
        }
      } else {
        for (const card of player.hand) {
          moves.push({ type: 'discard', playerId, cardId: card.id });
        }
      }
    } else if (this.roundManager.turnPhase === 'WAITING_DISCARD' || this.roundManager.turnPhase === 'WAITING_ACTION') {
      // رمي ورقة التخلص
      for (const card of player.hand) {
        moves.push({ type: 'discard', playerId, cardId: card.id });
      }

      // إمكانية الافتتاح (لمن لم يفتتح بعد): تتطلب متتالية نقية + متماثلة نقية بمجموع كافٍ
      // نعتمد تقسيم كامل اليد (كما يفعل اللاعب البشري) لضمان احتساب كل المجموعات نحو عتبة الافتتاح
      // [V29] الموزع لا يفتتح في دورته الأولى
      const dealerFirstBarred = (player.id === this.roundManager.dealerIndex && this.roundManager.dealerFirstCycle);
      if (!player.hasOpened && !dealerFirstBarred) {
        /* نمطا التقسيم: التغطية القصوى ثم تعظيم النقاط الحرة —
           نشر الجوكرات قد يخفي مجموعات نقية يستحقها اللاعب للافتتاح */
        let openingMelds = partitionSelectedCards(player.hand, this.rules, 'opening');
        let check = (openingMelds && openingMelds.length >= 1)
          ? this.rules.validateOpening(openingMelds, player.drawnDiscardCard, this.roundManager.jokerIndicator)
          : { valid: false };
        if (!check.valid) {
          openingMelds = partitionSelectedCards(player.hand, this.rules);
          check = (openingMelds && openingMelds.length >= 1)
            ? this.rules.validateOpening(openingMelds, player.drawnDiscardCard, this.roundManager.jokerIndicator)
            : { valid: false };
        }
        if (check.valid && openingMelds && openingMelds.length >= 1) {
          moves.push({ type: 'open', playerId, cardIds: openingMelds.flatMap(m => m.cards.map(c => c.id)) });
        }
      }

      // إمكانية إنهاء الشوط (للأيدي الصغيرة المتبقية — اليد الكبيرة تنهي عبر الافتتاح والإنزال)
      if (player.hand.length <= 7 && this.canFinish(player)) {
        moves.push({ type: 'finish', playerId });
      }
    }

    return moves;
  }

  /* تنفيذ حركة — يُستخدم من قبل السيرفر أو الوضع المحلي */
  executeMove(move) {
    const player = this.players.find(p => p.id === move.playerId);
    if (!player) return { success: false, error: 'لاعب غير صالح' };
    this.normalizeTurnPhase();
    const currentPlayer = this.roundManager.getCurrentPlayer();
    if (currentPlayer.id !== player.id) {
      return { success: false, error: 'ليس دورك' };
    }

    try {
      switch (move.type) {
        case 'draw_deck':
          return this._doDrawDeck(player);
        case 'draw_discard':
          return this._doDrawDiscard(player);
        case 'open':
          return this._doOpen(player, move.cardIds);
        case 'discard':
          return this._doDiscard(player, move.cardId);
        case 'finish':
          return this._doFinish(player, move);
      }
      return { success: false, error: 'نوع الحركة غير معروف' };
    } catch (e) {
      console.error('[Rami] executeMove error:', e && e.message, e);
      return { success: false, error: 'خطأ داخلي في الحركة — أعد المحاولة' };
    }
  }

  _doDrawDeck(player) {
    if (this.roundManager.turnPhase !== 'WAITING_DRAW') {
      return { success: false, error: 'لست في مرحلة السحب — يجب رمي ورقة التخلص' };
    }
    const maxHand = this.rules.playHandSize;
    if (player.hand.length >= maxHand) {
      return { success: false, error: 'يدك ممتلئة (' + player.hand.length + ' ورقة) — لا يجوز سحب ورقة إضافية، يجب التخلص من ورقة' };
    }

    // فحص قانون الـ 12 ورقة: إذا كان لدى اللاعب 12 ورقة منزلة وكانت ورقة المرموق تطابق مجموعات الطاولة.
    // لا يُطبَّق الجزاء إذا كان اللاعب ممنوعاً من سحب المرموق أصلاً (قانون الـ 13 ورقة: ورقة واحدة في اليد أو 13 ورقة منزلة).
    const barredFromDiscard = (player.hand.length === 1 || player.meldCount() >= 13);
    if (this.roundManager.feederDiscard && this.roundManager.feederDiscard.receiverId === player.id) {
      if (barredFromDiscard) {
        this.roundManager.feederDiscard = null; // اللاعب ممنوع من سحب المرموق — يسقط الالتزام
      } else {
        this._applyPenalty(player, 'RULE_12_IGNORED', '');
        _ramiToast('⚠️ قانون الـ 12 ورقة: غفلت عن سحب ورقة المرموق المطابقة لمجموعات الطاولة — تم تسجيل مخالفة +71 نقطة جزاء لحسابك بنهاية الشوط!', 'warn');
        this.roundManager.feederDiscard = null;
      }
    } else if (!barredFromDiscard && player.meldCount() >= 12 && this.roundManager.discardPile.length > 0) {
      const topDiscard = this.roundManager.discardPile[this.roundManager.discardPile.length - 1];
      if (this.doesCardFitAnyTableMeld(topDiscard)) {
        this._applyPenalty(player, 'RULE_12_IGNORED', topDiscard.displayName);
        _ramiToast('⚠️ قانون الـ 12 ورقة: ورقة المرموق (' + topDiscard.displayName + ') تطابق مجموعات الطاولة وكان يجب سحبها — تم تسجيل مخالفة +71 نقطة جزاء لحسابك بنهاية الشوط!', 'warn');
      }
    }

    // إذا نفدت أوراق المجرف، يُعاد خلط أوراق المرموق
    if (this.roundManager.drawPile.length === 0) {
      const recycledCount = this.roundManager.recycleDiscardPile();
      if (recycledCount > 0 && typeof SND !== 'undefined' && SND.shuffle) {
        SND.shuffle();
        _ramiToast(_ramiT('rami.recycledMsg') || '🔄 نفدت أوراق السحب — تم خلط المرموق وتجديد المجرف بنجاح!', 'info');
      }
    }

    if (this.roundManager.drawPile.length === 0) {
      return { success: false, error: 'نفدت جميع أوراق السحب والمرموق' };
    }

    const card = this.roundManager.drawFromPile(1)[0];
    player.hand.push(card);
    if (player.displayCards) player.displayCards.push(card);
    this.roundManager.turnPhase = 'WAITING_DISCARD';
    /* [V29] الموزع سحب من ورق التوزيع → انتهت دورة الموزع الأولى (يستطيع الافتتاح الآن) */
    if (player.id === this.roundManager.dealerIndex) this.roundManager.dealerFirstCycle = false;
    return { success: true, card: card };
  }

  _doDrawDiscard(player) {
    if (this.roundManager.turnPhase !== 'WAITING_DRAW') {
      return { success: false, error: 'لست في مرحلة السحب — يجب رمي ورقة التخلص' };
    }
    const maxHand = this.rules.playHandSize;
    if (player.hand.length >= maxHand) {
      return { success: false, error: 'يدك ممتلئة (' + player.hand.length + ' ورقة) — لا يجوز سحب ورقة إضافية، يجب التخلص من ورقة' };
    }
    if (this.roundManager.discardPile.length === 0) {
      return { success: false, error: 'المرموق فارغ' };
    }

    /* [V29] الموزع لا يسحب المرموق في دورته الأولى (أول ورقة بعد لا تور من ورق التوزيع) */
    if (player.id === this.roundManager.dealerIndex && this.roundManager.dealerFirstCycle) {
      return { success: false, error: 'لا يمكن للموزع سحب المرموق في دوره الأول — يجب السحب من ورق التوزيع أولاً' };
    }

    // قانون الـ 13 ورقة: اللاعب الذي تتبقى لديه ورقة واحدة يحرم من سحب المرموق
    if (player.hand.length === 1 || player.meldCount() >= 13) {
      return {
        success: false,
        error: 'لديك ورقة واحدة فقط في يدك — قانون الطالاج يفرض السحب من المجرف فقط لإنهاء الشوط'
      };
    }

    // فحص قانون «لا تور» (ورقة الموزع الأولى)
    const topDiscard = this.roundManager.discardPile[this.roundManager.discardPile.length - 1];
    const isLaTour = (this.roundManager.laTourCard && topDiscard.id === this.roundManager.laTourCard.id);
    
    if (isLaTour && !this.roundManager.isFirstTourCycle) {
      return {
        success: false,
        error: 'انتهى الدور الأول (لا تور) — لا يمكن أخذ ورقة الموزع الأولى بعد مرور الدور الأول لجميع اللاعبين'
      };
    }

    const card = this.roundManager.drawFromDiscard();
    /* وسم مصدر الورقة: ورقة المرموق/لا تور ليست «حرة» (لا تُفعّل تضاعف الجوكر) */
    card.fromDiscard = true;
    card.fromLaTour = !!isLaTour;
    if (isLaTour) {
      this.roundManager.laTourCard = null; // حرمان باقي اللاعبين بعد سحبها
      player.tookLaTour = true;
      player.drawnLaTourCard = card;
    }

    // فحص قانون الـ 12 ورقة: إذا سحب اللاعب صاحب الـ 12 ورقة الورقة المطابقة، يقيد جزاء 71 على من رماها
    if (this.roundManager.feederDiscard && this.roundManager.feederDiscard.receiverId === player.id) {
      const feeder = this.players.find(p => p.id === this.roundManager.feederDiscard.feederId);
      if (feeder) {
        this._applyPenalty(feeder, 'RULE_12_FED', feeder.name);
        _ramiToast('⚠️ قانون الـ 12 ورقة: سحب اللاعب الورقة المطابقة — تم تسجيل جزاء +71 نقطة على اللاعب السابق (' + feeder.name + ') الذي رمى الورقة!', 'warn');
      }
      this.roundManager.feederDiscard = null;
    }

    player.hand.push(card);
    player.drawnDiscardCard = card;
    if (player.displayCards) player.displayCards.push(card);
    
    this.roundManager.turnPhase = 'WAITING_DISCARD';
    return { success: true, card: card, isLaTour: isLaTour };
  }

      _doOpen(player, cardIds) {
    let meldObjects = [];
    const adapter = (typeof window !== 'undefined' && (window.RamiAdapter || window.RAMI_ADAPTER)) ? (window.RamiAdapter || window.RAMI_ADAPTER) : null;

    /* [V29] الموزع لا يفتتح في دوره الأول (ملزم بالسحب من ورق التوزيع قبل الافتتاح) */
    if (player.id === this.roundManager.dealerIndex && this.roundManager.dealerFirstCycle) {
      return { success: false, error: 'لا يمكن للموزع الافتتاح في دوره الأول — يجب السحب من ورق التوزيع أولاً' };
    }

    /* الخانات الخمس تنتمي للاعب البشري فقط — لا يجوز أبداً للـ AI أن يستخدمها.
       لكل لاعب تُشتق المجموعات من يده هو (player.hand) حصراً. */
    const isHuman = !player.isBot;

    // 1. إذا تم تحديد بطاقات معينة
    if (cardIds && cardIds.length >= 3) {
      const ids = new Set(cardIds);
      /* [V29] للبشري: تُبنى المجموعة من الأوراق المحددة مباشرة (بغضّ النظر عن الخانة)،
         مع بقاء الجوكر في موضعه الذي وضعه اللاعب. لا إدراج تلقائي لأي ورقة أخرى. */
      if (isHuman) {
        const selCards = cardIds.map(id => player.getCard(id)).filter(c => c);
        if (selCards.length >= 3) {
          if (this.rules.isValidSet(selCards, true)) {
            meldObjects.push(new RamiMeld(MELD_TYPE.SET, selCards.slice()));
          } else if (this.rules.isValidSequence(selCards, true)) {
            const ordered = ramiOrderSequenceCards(selCards.slice(), c => this.rules.isWildCard(c));
            meldObjects.push(new RamiMeld(MELD_TYPE.SEQUENCE, ordered));
          }
        }
      } else if (adapter && adapter.handSlots) {
        for (let s = 0; s < 5; s++) {
          const slotCards = (adapter.handSlots[s] || []).filter(c => ids.has(c.id));
          if (slotCards.length >= 3) {
            if (this.rules.isValidSet(slotCards, true)) {
              meldObjects.push(new RamiMeld(MELD_TYPE.SET, slotCards.slice()));
            } else if (this.rules.isValidSequence(slotCards, true)) {
              const ordered = ramiOrderSequenceCards(slotCards.slice(), c => this.rules.isWildCard(c));
              meldObjects.push(new RamiMeld(MELD_TYPE.SEQUENCE, ordered));
            }
          }
        }
      }
      if (meldObjects.length === 0) {
        const cards = cardIds.map(id => player.getCard(id)).filter(c => c);
        meldObjects = partitionSelectedCards(cards, this.rules);
      }
    }

    // 2. للبشري فقط: إذا لم تكن هناك مجموعات محددة، نفحص الخانات الـ 5 المرتبة
    if (meldObjects.length === 0 && isHuman && adapter && adapter.handSlots) {
      /* الخانات اليدوية فقط (باستثناء الأوراق المنزلة سابقاً) */
      const activeSlots = (typeof adapter._activeHandSlots === 'function') ? adapter._activeHandSlots() : adapter.handSlots;
      for (let s = 0; s < 5; s++) {
        const slotCards = activeSlots[s];
        if (slotCards && slotCards.length >= 3) {
          if (this.rules.isValidSet(slotCards, true)) {
            meldObjects.push(new RamiMeld(MELD_TYPE.SET, slotCards.slice()));
          } else if (this.rules.isValidSequence(slotCards, true)) {
            const ordered = ramiOrderSequenceCards(slotCards.slice(), c => this.rules.isWildCard(c));
            meldObjects.push(new RamiMeld(MELD_TYPE.SEQUENCE, ordered));
          } else {
            /* [V29] إن لم تكن الخانة كلها مجموعة صالحة، ابحث عن مجموعة صالحة ضمنها
               (اللاعب عزل أوراقه في خانة خاصة لكنها قد تتضمن ورقة زائدة) */
            const found = partitionSelectedCards(slotCards, this.rules);
            for (const fm of found) {
              if (fm.type === MELD_TYPE.SEQUENCE) {
                fm.cards = ramiOrderSequenceCards(fm.cards.slice(), c => this.rules.isWildCard(c));
              }
              meldObjects.push(fm);
            }
          }
        }
      }
    }

    // 3. [V29] التقسيم الاحتياطي لكامل اليد يُستعمل للافتتاح الأولي فقط —
    //    لا للاعب المفتوح (منع الإنزال/الإدراج التلقائي غير المقصود)
    if (meldObjects.length === 0 && !player.hasOpened) {
      /* الورقة المعزولة تُستثنى من مجموعات الافتتاح */
      const handForOpen = (adapter && adapter.isolateCardId) ? player.hand.filter(c => c.id !== adapter.isolateCardId) : player.hand;
      meldObjects = partitionSelectedCards(handForOpen, this.rules);
    }

    if (meldObjects.length === 0) {
      // إذا سحب اللاعب ورقة المرموق/لا تور ولم يستطع إنزالها: تُسترجع فوراً + جزاء + حرمان من الدور
      if (player.drawnDiscardCard || player.tookLaTour) {
        const pen = this.rules.finishPenalty;
        const penaltyCardId = player.drawnDiscardCard ? player.drawnDiscardCard.id : (player.drawnLaTourCard ? player.drawnLaTourCard.id : null);
        this._applyPenalty(player, 'DISCARD_DRAW', 'لا توجد مجموعات صالحة');
        if (penaltyCardId) {
          const retCard = player.removeCard(penaltyCardId);
          if (retCard) {
            this.roundManager.discardPile.push(retCard);
            if (player.displayCards) player.displayCards = player.displayCards.filter(c => c.id !== penaltyCardId);
          }
          if (adapter && adapter.handSlots) {
            for (let s2 = 0; s2 < 5; s2++) adapter.handSlots[s2] = adapter.handSlots[s2].filter(c => c.id !== penaltyCardId);
          }
        }
        player.drawnDiscardCard = null;
        player.drawnLaTourCard = null;
        player.tookLaTour = false;
        this.roundManager.nextPlayer();
        return { success: false, penaltyApplied: true, penalty: pen, error: 'مخالفة: سحبت ورقة المرموق دون إنزالها في مجموعات صالحة — تم استرجاعها وتطبيق جزاء +' + pen + ' وتمرير الدور' };
      }
      /* [T3.4] إظهار بدون شروط = +71 — فقط لمن لم يفتتح بعد (اللاعب المفتوح يُنزل بحرية ولا يُعاقب) */
      if (!player.hasOpened) {
        this._applyPenalty(player, 'OPEN_ERROR', '');
        return { success: false, penaltyApplied: true, penalty: this.rules.finishPenalty, error: 'لا توجد مجموعات صالحة للإنزال (تحتاج 3 بطاقات متتالية أو متماثلة على الأقل)' };
      }
      return { success: false, error: 'لا توجد مجموعات صالحة للإنزال (تحتاج 3 بطاقات متتالية أو متماثلة على الأقل)' };
    }

    // إذا كان اللاعب قد افتتح بالفعل في دور سابق، يمكنه إنزال أي مجموعات جديدة صالحة
    if (player.hasOpened) {
      const allIds = new Set(meldObjects.flatMap(m => m.cards.map(c => c.id)));
      player.hand = player.hand.filter(c => !allIds.has(c.id));
      /* الأوراق المنزلة تبقى في خاناتها (تُحاط بحلقة ذهبية) — لا تُحذف من العرض */

      player.melds = player.melds.concat(meldObjects);
      this.roundManager.tableMelds.push(...meldObjects);

      // إذا كانت ورقة المرموق/لا تور المسحوبة ضمن الأوراق المنزلة، تُسقَط إلزامية إنزالها
      if (player.drawnDiscardCard && allIds.has(player.drawnDiscardCard.id)) {
        player.drawnDiscardCard = null;
        player.tookLaTour = false;
      }
      if (player.drawnLaTourCard && allIds.has(player.drawnLaTourCard.id)) {
        player.drawnLaTourCard = null;
        player.tookLaTour = false;
      }

      // إذا فرغت اليد أو تبقت ورقة واحدة للرمي: إنهاء الشوط فوراً
      if (player.hand.length <= 1) {
        let iso = null;
        if (player.hand.length === 1) {
          iso = player.hand.pop();
          this.roundManager.discardPile.push(iso);
        }
        this._setJokerDoubleIfFree(iso);
        this._endRound(player);
        return { success: true, finished: true, melds: meldObjects };
      }

      if (adapter) adapter.isolateCardId = null; /* الورقة المعزولة تعود لليد للتخلص منها */
      return { success: true, melds: meldObjects, isSubsequent: true };
    }

    // الافتتاح الأولي: فحص شروط الافتتاح (متتالية نقية + متماثلة نقية + مجموع نقاط)
    const highestPrev = this.roundManager.highestOpeningScore || 0;
    const checkResult = this.rules.validateOpening(
      meldObjects,
      player.drawnDiscardCard,
      this.roundManager.jokerIndicator,
      highestPrev,
      player.tookLaTour
    );

    if (!checkResult.valid) {
      /* تطبيق قانون الخطأ في الافتتاح عند سحب ورقة المرموق/لا تور: استرجاع الورقة + جزاء 71 نقطة + حرمان من الدور وتمريره للاعب التالي */
      const pen = this.rules.finishPenalty;
      if (player.drawnDiscardCard || player.tookLaTour) {
        const penaltyCardId = player.drawnDiscardCard ? player.drawnDiscardCard.id : (player.drawnLaTourCard ? player.drawnLaTourCard.id : null);
        this._applyPenalty(player, 'OPEN_ERROR', '');

        if (penaltyCardId) {
          const retCard = player.removeCard(penaltyCardId);
          if (retCard) {
            this.roundManager.discardPile.push(retCard);
            if (player.displayCards) player.displayCards = player.displayCards.filter(c => c.id !== penaltyCardId);
          }
          if (adapter && adapter.handSlots && penaltyCardId) {
            for (let s = 0; s < 5; s++) {
              adapter.handSlots[s] = adapter.handSlots[s].filter(c => c.id !== penaltyCardId);
            }
          }
        }

        player.drawnDiscardCard = null;
        player.drawnLaTourCard = null;
        player.tookLaTour = false;

        // حرمان اللاعب من دوره وتمرير الدور مباشرة للاعب الموالي
        this.roundManager.nextPlayer();

        return {
          success: false,
          penaltyApplied: true,
          penalty: pen,
          error: checkResult.error || ('خطأ في شروط الافتتاح — تم استرجاع ورقة المرموق/لا تور، وتطبيق جزاء +' + pen + ' نقطة، وتمرير الدور مباشرة للاعب التالي!')
        };
      }

      /* [T3.4] إظهار بدون شروط = +71 حتى لو لم يسحب المرموق */
      this._applyPenalty(player, 'OPEN_ERROR', '');
      return {
        success: false,
        penaltyApplied: true,
        penalty: this.rules.finishPenalty,
        error: checkResult.error || ('الأوراق لا تستوفي شروط الافتتاح — يلزم متتالية ومتماثلة نقيتين بمجموع ≥ ' + this.rules.openingThreshold + ' نقطة بدون جوكر')
      };
    }

    // الافتتاح الأولي ناجح!
    player.drawnDiscardCard = null;
    player.drawnLaTourCard = null;
    player.tookLaTour = false;

    if (checkResult.score > (this.roundManager.highestOpeningScore || 0)) {
      this.roundManager.highestOpeningScore = checkResult.score;
      this.roundManager.highestOpeningPlayer = player;
    }

    // إزالة الأوراق المنزلة من يد اللاعب (تبقى ظاهرة في خاناتها بحلقة ذهبية)
    const allIds = new Set(meldObjects.flatMap(m => m.cards.map(c => c.id)));
    player.hand = player.hand.filter(c => !allIds.has(c.id));

    player.melds = player.melds.concat(meldObjects);
    player.hasOpened = true;
    this.roundManager.tableMelds.push(...meldObjects);

    // إذا تم إنزال كامل اليد (14 ورقة) وتبقت ورقة واحدة أو صفر: إنهاء الشوط فوراً
    if (player.hand.length <= 1) {
      let iso = null;
      if (player.hand.length === 1) {
        iso = player.hand.pop();
        this.roundManager.discardPile.push(iso);
      }
      this._setJokerDoubleIfFree(iso);
      this._endRound(player);
      return { success: true, finished: true, melds: meldObjects, score: checkResult.score };
    }

    if (adapter) adapter.isolateCardId = null; /* الورقة المعزولة تعود لليد للتخلص منها */
    this.roundManager.turnPhase = 'WAITING_DISCARD';
    return { success: true, melds: meldObjects, score: checkResult.score };
  }

  _doDiscard(player, cardId) {
    if (this.roundManager.turnPhase !== 'WAITING_DISCARD') {
      return { success: false, error: 'يجب سحب ورقة أولاً من المجرف أو المرموق قبل رمي ورقة التخلص' };
    }

    // قاعدة سحب المهملات و«لا تور» الصارمة: لا يجوز سحب ورقة المهملات أو لا تور والاحتفاظ بها دون افتتاح أو إنهاء الشوط أو دمجها
    if (player.tookLaTour || player.drawnDiscardCard) {
      const adapter = (typeof window !== 'undefined' && (window.RamiAdapter || window.RAMI_ADAPTER)) ? (window.RamiAdapter || window.RAMI_ADAPTER) : null;
      const penaltyCard = player.drawnDiscardCard || player.drawnLaTourCard;

      if (penaltyCard) {
        const retCard = player.removeCard(penaltyCard.id);
        if (retCard) {
          this.roundManager.discardPile.push(retCard);
          if (player.displayCards) player.displayCards = player.displayCards.filter(c => c.id !== penaltyCard.id);
        }
        if (adapter && adapter.handSlots) {
          for (let s = 0; s < 5; s++) {
            adapter.handSlots[s] = adapter.handSlots[s].filter(c => c.id !== penaltyCard.id);
          }
        }
      }

      player.tookLaTour = false;
      player.drawnLaTourCard = null;
      player.drawnDiscardCard = null;
      this._applyPenalty(player, 'DISCARD_DRAW', '');

      _ramiToast('⚠️ مخالفة: سحبت ورقة المرموق دون إنزالها في مجموعة أو دمجها في الطاولة — تم استرجاع الورقة وتسجيل جزاء +' + this.rules.finishPenalty + ' نقطة وتمرير الدور للاعب التالي!', 'err');
      
      if (adapter) {
        adapter.selectedCards.clear();
        adapter._updateUI();
      }

      this.roundManager.nextPlayer();
      return { success: false, penaltyApplied: true, error: 'مخالفة سحب المرموق دون إنزال — تم تطبيق جزاء +' + this.rules.finishPenalty + ' واسترجاع الورقة' };
    }

    const card = player.removeCard(cardId);
    if (!card) return { success: false, error: 'بطاقة غير موجودة في اليد' };
    if (player.displayCards) player.displayCards = player.displayCards.filter(c => c.id !== cardId);
    
    // إذا كانت هذه أول ورقة مرمية في الشوط (من الموزع)، تُعيّن كورقة «لا تور»
    if (this.roundManager.discardPile.length === 0 && !this.roundManager.laTourCard) {
      this.roundManager.laTourCard = card;
      this.roundManager.isFirstTourCycle = true;
    }

    // فحص قانون الـ 12 ورقة للاعب التالي (إذا كان اللاعب التالي قد أنزل 12 ورقة أو أكثر)
    const nextPlayerIdx = (this.roundManager.currentPlayerIndex + 1) % this.players.length;
    const nextPlayer = this.players[nextPlayerIdx];
    const nextBarredFromDiscard = nextPlayer && (nextPlayer.hand.length === 1 || nextPlayer.meldCount() >= 13);
    if (nextPlayer && nextPlayer.meldCount() >= 12 && !nextBarredFromDiscard) {
      if (this.doesCardFitAnyTableMeld(card)) {
        this.roundManager.feederDiscard = { feederId: player.id, receiverId: nextPlayer.id, cardId: card.id };
      }
    }

    player.drawnDiscardCard = null;
    player.drawnLaTourCard = null;
    player.tookLaTour = false;

    this.roundManager.discardPile.push(card);

    /* التحقق من إنهاء الجولة تلقائياً إذا كانت اليد فارغة أو بعد إنزال الأوراق */
    if (player.hand.length === 0) {
      this._setJokerDoubleIfFree(card);
      this._endRound(player);
      return { success: true, finished: true, card: card };
    }

    this.roundManager.nextPlayer();
    return { success: true, card: card };
  }

  _doFinish(player, move) {
    const adapter = (typeof window !== 'undefined' && (window.RamiAdapter || window.RAMI_ADAPTER)) ? (window.RamiAdapter || window.RAMI_ADAPTER) : null;

    // الحالة 1: اليد فارغة أو تبقى ورقة واحدة فقط للرمي
    if (player.hand.length <= 1) {
      let iso = null;
      if (player.hand.length === 1) {
        iso = player.hand.pop();
        this.roundManager.discardPile.push(iso);
      }
      this._setJokerDoubleIfFree(iso);
      this._endRound(player);
      return { success: true, finished: true };
    }

    // الحالة 2: دمج الأوراق المتبقية التي تطابق مجموعات الطاولة
    if (player.hasOpened && this.roundManager.tableMelds.length > 0) {
      let laidOffAny = false;
      const handCopy = player.hand.slice();
      for (const card of handCopy) {
        for (const meld of this.roundManager.tableMelds) {
          const temp = meld.cards.concat([card]);
          let canAdd = false;
          if (meld.type === MELD_TYPE.SET && this.rules.isValidSet(temp, true)) canAdd = true;
          if (meld.type === MELD_TYPE.SEQUENCE && this.rules.isValidSequence(temp, true)) canAdd = true;
          
          if (canAdd) {
            player.removeCard(card.id);
            meld.cards.push(card);
            laidOffAny = true;
            /* الورقة المركّبة تبقى ظاهرة في خانتها بحلقة ذهبية */
            break;
          }
        }
      }
      if (player.hand.length <= 1) {
        let iso = null;
        if (player.hand.length === 1) {
          iso = player.hand.pop();
          this.roundManager.discardPile.push(iso);
        }
        this._setJokerDoubleIfFree(iso);
        this._endRound(player);
        return { success: true, finished: true };
      }
    }

    // الحالة 3: إنهاء الشوط بإنزال ما تبقّى من اليد على شكل مجموعات صالحة
    // نجمع المجموعات المرشحة: من خانات اللاعب المرتبة أولاً، ثم من تقسيم كامل اليد كاحتياط
    let candidateMelds = [];
    if (adapter && adapter.handSlots) {
      const activeSlots = (typeof adapter._activeHandSlots === 'function') ? adapter._activeHandSlots() : adapter.handSlots;
      for (let s = 0; s < 5; s++) {
        const slotCards = activeSlots[s];
        if (slotCards && slotCards.length >= 3) {
          if (this.rules.isValidSet(slotCards, true)) {
            candidateMelds.push(new RamiMeld(MELD_TYPE.SET, slotCards.slice()));
          } else if (this.rules.isValidSequence(slotCards, true)) {
            /* [V21] ترتيب المتتالية: الأصغر يميناً ثم الأكبر شمالاً، والجوكر في موضع الناقص */
            const ordered = ramiOrderSequenceCards(slotCards.slice(), c => this.rules.isWildCard(c));
            candidateMelds.push(new RamiMeld(MELD_TYPE.SEQUENCE, ordered));
          }
        }
      }
    }

    /* ورقة معزولة (من خانة العزل ♛ بجنب تاج التوزيع): تُستثنى من المجموعات وتُقلب
       كالورقة الأخيرة. تصل عبر move.isolateCardId (للبثّ الجماعي) أو adapter.isolateCardId (محلياً). */
    const isoId = (move && move.isolateCardId != null) ? move.isolateCardId : (adapter ? adapter.isolateCardId : null);
    const effectiveIso = isoId || null;
    const handForMelds = effectiveIso ? player.hand.filter(c => c.id !== effectiveIso) : player.hand;

    const partitionMelds = partitionSelectedCards(handForMelds, this.rules);
    const slotCoverage = candidateMelds.reduce((sum, m) => sum + m.cards.length, 0);
    const partitionCoverage = partitionMelds.reduce((sum, m) => sum + m.cards.length, 0);

    /* احترام ترتيب اللاعب: إن كانت خاناته تشكّل إنهاءً قانونياً تُعتمد كما هي —
       مع الورقة المعزولة كالورقة الأخيرة بدل امتصاصها في المجموعات */
    const needLeftover = effectiveIso ? 0 : 1;
    let useSlotsAsIs = false;
    if (candidateMelds.length > 0) {
      const slotIds = new Set(candidateMelds.flatMap(m => m.cards.map(c => c.id)));
      const slotLeftover = handForMelds.filter(c => !slotIds.has(c.id));
      if (slotLeftover.length === needLeftover) useSlotsAsIs = true;
    }
    if (!useSlotsAsIs && partitionCoverage > slotCoverage) candidateMelds = partitionMelds;

    if (candidateMelds.length === 0) {
      return { success: false, error: 'لا يمكن إنهاء الشوط — لا توجد مجموعات صالحة (3 أوراق متتالية أو متماثلة على الأقل) بين أوراق يدك المتبقية' };
    }

    const meldedIds = new Set(candidateMelds.flatMap(m => m.cards.map(c => c.id)));
    const leftover = handForMelds.filter(c => !meldedIds.has(c.id));

    // يجب أن تغطي المجموعات اليد كلها ما عدا ورقة واحدة معزولة للتخلص منها (أو صفر إن وُجدت ورقة معزولة في خانة العزل)
    if (leftover.length !== needLeftover) {
      return {
        success: false,
        error: leftover.length === 0
          ? 'لا يمكن إنهاء الشوط — يجب عزل الورقة الـ15 وحدها (إنزال 14 ورقة في مجموعات صالحة + ورقة معزولة تُقلب ظهراً)؛ إنزال الـ15 كاملة مرفوض. ضع ورقة واحدة في خانة العزل ♛ بجنب تاج التوزيع'
          : 'لا يمكن إنهاء الشوط — تبقّى ' + leftover.length + ' أوراق خارج المجموعات. يجب أن تشكّل أوراق يدك مجموعات كاملة صالحة وتتبقى ورقة واحدة فقط للتخلص منها (' + (this.rules.mode === 'talaj' ? 'الطالاج' : 'السامبل') + ')'
      };
    }

    // ورقة المرموق / لا تور المسحوبة في هذا الدور يجب إنزالها ضمن المجموعات
    const drawnCard = player.drawnDiscardCard || player.drawnLaTourCard || null;
    if (drawnCard && !meldedIds.has(drawnCard.id)) {
      player.removeCard(drawnCard.id);
      this.roundManager.discardPile.push(drawnCard);
      if (player.displayCards) player.displayCards = player.displayCards.filter(c => c.id !== drawnCard.id);
      player.drawnDiscardCard = null;
      player.drawnLaTourCard = null;
      player.tookLaTour = false;
      this._applyPenalty(player, 'DISCARD_DRAW', 'عند إنهاء الشوط');
      if (adapter && adapter.handSlots) {
        for (let s = 0; s < 5; s++) adapter.handSlots[s] = adapter.handSlots[s].filter(c => c.id !== drawnCard.id);
      }
      this.roundManager.nextPlayer();
      return { success: false, penaltyApplied: true, penalty: this.rules.finishPenalty, error: 'مخالفة: ورقة المرموق المسحوبة يجب إنزالها ضمن المجموعات — تم استرجاعها وتطبيق جزاء +' + this.rules.finishPenalty + ' وتمرير الدور' };
    }

    /* [V28] شروط الإنهاء الأساسية: متتالية حرة + متماثلة حرة خاليتان من الجوكر والمرموق.
       عتبة الـ71 (شروط الافتتاح) لا تُطبَّق هنا — بل في مسار الافتتاح فقط. */
    const finishStruct = this.rules.validateFinishStructure(candidateMelds, player.drawnDiscardCard);
    if (!finishStruct.valid) {
      return {
        success: false,
        error: 'لا يمكن إنهاء الشوط — يجب أن تتضمن مجموعاتك متتالية حرة ومتماثلة حرة خاليتين تماماً من الجوكر وورقة المرموق'
      };
    }
    player.hasOpened = true;

    // إنزال المجموعات على الطاولة
    player.hand = player.hand.filter(c => !meldedIds.has(c.id));
    player.melds = player.melds.concat(candidateMelds);
    this.roundManager.tableMelds.push(...candidateMelds);
    /* الأوراق المنزلة تبقى ظاهرة في خاناتها بحلقة ذهبية */

    // التخلص من الورقة الأخيرة في المرموق (المعزولة إن وُجدت، أو الوحيدة المتبقية)
    let iso = null;
    if (player.hand.length === 1) {
      iso = player.hand.pop();
      this.roundManager.discardPile.push(iso);
    }
    this._setJokerDoubleIfFree(iso);
    if (adapter) adapter.isolateCardId = null; /* إفراغ خانة العزل بعد الإنهاء */

    this._endRound(player);
    return { success: true, finished: true };
  }

  canFinish(player) {
    if (!player || !player.hand) return false;
    if (player.hand.length <= 1) return true;

    let melds = partitionSelectedCards(player.hand, this.rules, 'opening');
    if (!melds || melds.length === 0) melds = partitionSelectedCards(player.hand, this.rules);
    if (!melds || melds.length === 0) return false;

    const ids = new Set();
    for (const m of melds) for (const c of m.cards) ids.add(c.id);
    const leftover = player.hand.filter(c => !ids.has(c.id));
    /* يجب عزل الورقة الـ15 وحدها — إنزال الـ15 كاملة لا يُعدّ إنهاءً قانونياً */
    if (leftover.length !== 1) return false;

    // ورقة المرموق/لا تور المسحوبة يجب أن تكون ضمن المجموعات
    const drawnCard = player.drawnDiscardCard || player.drawnLaTourCard || null;
    if (drawnCard && !ids.has(drawnCard.id)) return false;

    /* [V28] شروط الإنهاء الأساسية: متتالية حرة + متماثلة حرة (خاليتان من الجوكر والمرموق)
       + 14 ورقة في مجموعات + ورقة معزولة. عتبة الـ71 لا تُطبَّق هنا —
       تُطبَّق فقط في مسار الإنهاء عبر الافتتاح (إنزال 8+ + إدراج الباقي في مجموعات الخصوم). */
    const struct = this.rules.validateFinishStructure(melds, player.drawnDiscardCard);
    if (!struct.valid) return false;
    return true;
  }

  /* ═══ جدول الجزاءات الثابت: اسم القاعدة + قيمتها — يُطبَّق على الإنسان والـAI على حد سواء ═══ */
  penaltyValue(ruleKey) {
    switch (ruleKey) {
      case 'OPEN_ERROR':        // خطأ في شروط الافتتاح
      case 'DISCARD_DRAW':      // سحب المرموق دون إنزالها
        return this.rules.finishPenalty;   // 71 طلاج / 51 سامبل
      case 'RULE_12_IGNORED':   // قانون الـ 12 ورقة: غفلت عن ورقة مطابقة
      case 'RULE_12_FED':       // قانون الـ 12 ورقة: رميت ورقة غذّت منزلاً 12 ورقة
        return 71;                         // قيمة ثابتة في القانون
      default:
        return 0;
    }
  }

  penaltyLabel(ruleKey) {
    const labels = {
      OPEN_ERROR: 'خطأ في شروط الافتتاح',
      DISCARD_DRAW: 'سحب المرموق دون إنزالها',
      RULE_12_IGNORED: 'قانون الـ 12 ورقة: غفلت عن سحب ورقة المرموق المطابقة',
      RULE_12_FED: 'قانون الـ 12 ورقة: رميت ورقة غذّت لاعباً منزلاً 12 ورقة'
    };
    return labels[ruleKey] || ruleKey;
  }

  /* تسجيل جزاء موحّد مع اسم القاعدة وقيمتها */
  _applyPenalty(player, ruleKey, detail) {
    const val = this.penaltyValue(ruleKey);
    player.penaltyScore = (player.penaltyScore || 0) + val;
    if (!player.penaltyReasons) player.penaltyReasons = [];
    player.penaltyReasons.push({ rule: ruleKey, label: this.penaltyLabel(ruleKey), value: val, detail: detail || '' });
  }

  /* إنهاء الشوط بجوكر حر معزول كالورقة الـ15 (مسحوب من ورق التوزيع، لا من المرموق/لا تور)
     ⇒ تضاعف جزاء الشوط على اللاعبين الآخرين دون مضاعفة جزاء الخطأ */
  _setJokerDoubleIfFree(isolatedCard) {
    if (isolatedCard && isolatedCard.isJoker && !isolatedCard.fromDiscard && !isolatedCard.fromLaTour) {
      this.roundManager.jokerDouble = true;
    }
  }

  _endRound(winner) {
    /* حراسة: لا يُحسب الشوط مرتين (منع مضاعفة النقاط) */
    if (this.gamePhase === 'ROUND_END' || this.gamePhase === 'MATCH_END') return;
    this.gamePhase = 'ROUND_END';
    this.roundManager.lastWinner = winner;

    /* تضاعف الشوط: إن أنهى الفائز بجوكر حر معزول كالورقة الـ15 تُضاعف نقاط
       الأوراق المتبقية / اليد الكاملة للخاسرين، دون مضاعفة جزاء الخطأ */
    const doubled = !!this.roundManager.jokerDouble;
    this.roundManager.jokerDouble = false;

    /* نموذج نقاط واحد متسق:
       - الفائز بالشوط: 0 نقطة أوراق متبقية.
       - من لم يفتتح إطلاقاً: عقوبة اليد الكاملة (طلاج 100 / سامبل 51).
       - المفتوح: مجموع قيم الأوراق المتبقية (الطلاج: 10 ثابتة/ورقة؛ السامبل: قيمة وجهية بحد 51).
       - عند التضاعف: تُضاعف هذه النقاط الأساسية فقط.
       - ثم تُضاف الجزاءات المسجلة خلال الشوط (لا تُضاعف أبداً).
       التفصيل الكامل لكل لاعب يُحفظ في lastRoundDetail. */
    for (const p of this.players) {
      let roundPts = 0;
      let detail = { kind: 'winner', cardsCount: 0, cardsValue: 0, penalty: 0, total: 0 };
      if (p.id === winner.id) {
        roundPts = 0;
        detail.kind = 'winner';
      } else if (!p.hasOpened) {
        roundPts = this.rules.fullHandPenalty;
        detail = { kind: 'unopened', cardsCount: p.hand.length, cardsValue: 0, penalty: 0, total: roundPts };
      } else {
        let sum = 0;
        if (this.mode === 'talaj') {
          /* الطلاج: كل ورقة متبقية = 10 نقاط ثابتة بغضّ النظر عن رقمها */
          sum = p.hand.length * 10;
        } else {
          /* السامبل [S4]: الأرقام 1–10 بقيمتها الوجهية، J/Q/K/A وورقة الجوكر المعينة = 10،
             وإن تجاوز المجموع 51 = +51 */
          for (const card of p.hand) {
            sum += this.rules.isWildCard(card) ? 10 : card.baseValue;
          }
          if (sum > 51) sum = 51;
        }
        roundPts = sum;
        detail = { kind: 'opened', cardsCount: p.hand.length, cardsValue: sum, penalty: 0, total: sum };
      }
      if (doubled && p.id !== winner.id) {
        roundPts *= 2;
        detail.doubled = true;
        detail.total = roundPts;
      }
      p.lastRoundPoints = roundPts;
      p.lastRoundDetail = detail;
      p.totalScore += roundPts;
    }

    /* الجزاءات لا تسقط أبداً: تُقيّد على صاحبها وتُضاف للمجموع التراكمي ولو أنهى الشوط أو فاز به */
    for (const p of this.players) {
      const pen = p.penaltyScore || 0;
      const reasons = (p.penaltyReasons || []).slice();
      p.lastPenalty = pen;
      p.lastPenaltyReasons = reasons;
      p.lastRoundTotal = p.lastRoundPoints + pen;
      if (p.lastRoundDetail) {
        p.lastRoundDetail.penalty = pen;
        p.lastRoundDetail.total = p.lastRoundTotal;
      }
      p.totalScore += pen;
      p.penaltyScore = 0;
      p.penaltyReasons = [];
    }

    /* تسجيل سجل الشوط في تاريخ الجولة */
    if (!this.roundManager.roundHistory) this.roundManager.roundHistory = [];
    this.roundManager.roundHistory.push({
      roundNumber: this.roundManager.roundNumber,
      winnerName: winner.name,
      doubled: doubled,
      playerScores: this.players.map(p => ({
        name: p.name,
        pts: p.lastRoundPoints || 0,   /* نقاط الأوراق فقط (بدون الجزاءات) */
        pen: p.lastPenalty || 0,
        penReasons: (p.lastPenaltyReasons || []).map(r => (typeof r === 'string' ? r : r.label)),
        cardsCount: p.lastRoundDetail ? p.lastRoundDetail.cardsCount : 0,
        cardsValue: p.lastRoundDetail ? p.lastRoundDetail.cardsValue : 0,
        total: p.totalScore
      }))
    });

    /* [V18] الإقصاء عند نهاية الشوط: من تجاوز سقف الجولة يُقصى.
       تنتهي الجولة بفائز واحد فقط: من بقي مجموعُه دون السقف (أو الأقل مجموعاً إذا تجاوز الجميع). */
    for (const p of this.players) {
      p.isEliminated = p.totalScore > this.targetScore;
    }
    const aliveCount = this.players.filter(p => !p.isEliminated).length;
    /* شوط واحد (رهان على شوط واحد): تنتهي المباراة فور انتهاء أول شوط */
    if (aliveCount <= 1 || this.isSingleRound) this.gamePhase = 'MATCH_END';

    /* ملاحظة: انتقال دور التوزيع للاعب التالي يتم في nextRound() فقط — لا تدوير هنا لتجنب القفز بلاعبين */
  }

  /* تصفير اللعبة للجولة التالية */
  nextRound() {
    if (this.gamePhase === 'MATCH_END') return;
    this.gamePhase = 'LOBBY';
    /* [V18] انتقال دور التوزيع للاعب النشط التالي (تخطي المُقصيين) */
    this.roundManager.dealerIndex = this.roundManager.firstActiveFrom(this.roundManager.dealerIndex + 1);
    this.startRound();
    this.gamePhase = 'PLAYING';
  }

  getMatchResult() {
    /* [V18] الفائز الواحد: من بقي مجموعُه دون سقف الجولة؛ إن تجاوز الجميع فالأقل مجموعاً.
       المَقصيون = من تجاوزوا السقف. */
    const over = this.players.filter(p => p.totalScore > this.targetScore);
    const alive = this.players.filter(p => p.totalScore <= this.targetScore);
    let winner = null;
    if (alive.length === 1) {
      winner = alive[0];
    } else if (alive.length === 0) {
      winner = this.players.slice().sort((a, b) => a.totalScore - b.totalScore)[0];
    } else {
      winner = alive.slice().sort((a, b) => a.totalScore - b.totalScore)[0];
    }
    const losers = this.players.filter(p => p.id !== (winner ? winner.id : -1));
    return {
      winners: winner ? [winner] : [],
      losers: losers,
      eliminated: over,
      rankings: this.players.slice().sort((a, b) => a.totalScore - b.totalScore)
    };
  }

  /* إعادة تشغيل اللعبة بالكامل */
  reset() {
    this.seed = Math.floor(Math.random() * 0xFFFFFFFF);
    this.rng = new DeterministicRng(this.seed);
    this.players = [];
    this.gamePhase = 'LOBBY';
    this.roundManager = new RoundManager(this.rules, this.rng);
    this.roundManager.initPlayers(this.playerCount, this.botCount);
    this.players = this.roundManager.players;
  }
}

/* ═══════════════════════════════════════════════════════════
   Digital Moroccan Casino — Rami UI Adapter & Interactive Controls
   طاولة كازينو دائرية مقسمة بقطاعات متساوية وخانات تفاعلية
   ═══════════════════════════════════════════════════════════ */

var RAMI_STATE = null;
var RAMI_BET = 50;
var RAMI_BUSY = false;
var _lastBusyTime = 0;
var _draggedCardId = null;

function setRamiBusy(val) {
  RAMI_BUSY = !!val;
  if (val) _lastBusyTime = Date.now();
}

function checkRamiBusy() {
  if (RAMI_BUSY && Date.now() - _lastBusyTime > 1200) {
    RAMI_BUSY = false;
  }
  return RAMI_BUSY;
}

function eRami(g) {
  return '<div class="rami-stage" id="ramiContainer"></div>';
}

function initRami() {
  if (typeof window !== 'undefined' && window.RamiAdapter && typeof window.RamiAdapter.destroy === 'function') {
    try { window.RamiAdapter.destroy(); } catch (e) {}
  }
  const adapter = new RamiUIAdapter();
  if (typeof window !== 'undefined') {
    window.RamiAdapter = adapter;
    window.RAMI_ADAPTER = adapter;
  }
  adapter.start('ramiContainer');
  /* ربط معالجات الغرفة للمزامنة الجماعية */
  ramiRegisterRooms();
}

/* ── محرك واجهة المستخدم التفاعلي ── */
class RamiUIAdapter {
  constructor() {
    this.game = null;
    this.container = null;
    this.timerId = null;
    this.selectedCards = new Set();
    this.handSlots = [[], [], [], [], []];
    this._driverGrace = null;       /* [Resilience] مهلة السائق الاحتياطية */
    this._driverGraceMs = 4000;     /* [Resilience] مهلة الانتظار قبل نيابة السائق */
    /* ── ورقة معزولة (للفتح/الإنهاء الصحيح): تُخرج من المجموعات الخمس ── */
    this.isolateCardId = null;
    /* ── وضع الغرفة (متعدد اللاعبين) ── */
    this.multiplayer = false;   // true داخل غرفة جماعية
    this.myPlayerId = 0;        // مؤشر لاعبي داخل المحرك (0 في اللعب الفردي)
    this.room = null;           // { id, code, isOwner, order, players, mode, target, bet, seed, seq }
    this._netSeq = 0;           // عدّاد تسلسل حركاتي المُصدَرة
    this._netApplied = 0;       // آخر تسلسل طُبّق (إزالة التكرار)
  }

  start(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;
    ramiBindPointerEvents();
    this._bindLayoutResize();
    this._renderSetup();
  }

  /* نظام القياس السائل: متغير --card-w واحد مشتق من أبعاد الحاوية الفعلية،
     وكل الأبعاد الأخرى تتبعه. كما يملأ ارتفاع الطاولة كل المساحة المتاحة
     بين الشريط العلوي وقسم سجل الجولات. */
  _measureAndSetScale() {
    const stage = this.container;
    if (!stage || typeof window === 'undefined') return;

    /* تثبيت إزاحة صفحة اللعبة عن أعلى الـ viewport حتى تمتد بدقة حتى الأسفل */
    const pg = document.getElementById('pg-game');
    if (pg) {
      const pgTop = pg.getBoundingClientRect().top;
      document.documentElement.style.setProperty('--pg-top', Math.max(0, Math.round(pgTop)) + 'px');
    }

    /* الارتفاع المتاح = الارتفاع الفعلي لحاوية اللعب (flex) — وليس حسابات يدوية */
    const bodyEl = document.getElementById('gamePageBody');
    let availH = bodyEl ? bodyEl.clientHeight : 0;
    if (availH < 120) {
      const vv = window.visualViewport;
      availH = (vv ? vv.height : window.innerHeight) - 120;
    }
    availH = Math.max(260, availH);

    const availW = stage.clientWidth || (window.innerWidth - 24);
    /* [V18] سقف أعلى (60px) لتكون الأوراق أكبر وأوضح على الشاشات الواسعة؛
       الشاشات القصيرة تبقى محدودة بمصطلح الارتفاع availH/12 فلا تُكسَر. */
    const cardW = Math.max(24, Math.min(60, Math.floor(Math.min(availW / 10, availH / 12))));
    stage.style.setProperty('--card-w', cardW + 'px');

    /* ضبط تداخل أوراق اليد لكل خانة على حدة */
    if (typeof this._fitSlotOverlaps === 'function') this._fitSlotOverlaps(document.getElementById('rami5SlotsContainer'));
  }

  /* تداخل/تصغير محسوب لكل خانة: صف واحد بتراكب معتدل، وإن لم يكف تصغير تدريجي،
     وإن طال التسلسل كثيراً التفاف لصفين. يضمن احتواء كل الأوراق داخل الفتحة بلا قصّ. */
  _fitSlotOverlaps(container) {
    if (!container) return;
    const cw = this._cardWpx();
    const FMAX = 0.5; // أقصى نسبة تداخل قبل التصغير
    const boxes = container.querySelectorAll('.rami-slot-box');
    const setVars = (box, sc, ov, wrap) => {
      box.style.setProperty('--sc', String(sc));
      box.style.setProperty('--ov', ov + 'px');
      box.style.setProperty('--wrap', wrap);
    };
    for (let s = 0; s < boxes.length; s++) {
      const n = (this.handSlots && this.handSlots[s]) ? this.handSlots[s].length : 0;
      const box = boxes[s];
      const avail = Math.max(24, (box.clientWidth || 60) - 2);
      if (n <= 1) { setVars(box, 1, 0, 'nowrap'); continue; }
      const need = (k, sc) => cw * sc * (k - FMAX * (k - 1));
      if (need(n, 1) <= avail) {
        // صف واحد بحجم كامل: تراكب يتراوح بين 15% و 50%
        let ov = (avail - n * cw) / (n - 1);
        ov = Math.max(-FMAX * cw, Math.min(-0.15 * cw, ov));
        setVars(box, 1, ov, 'nowrap');
      } else {
        const sc1 = avail / (cw * (n - FMAX * (n - 1)));
        if (sc1 >= 0.42) {
          setVars(box, sc1, -FMAX * cw * sc1, 'nowrap');
        } else {
          const k2 = Math.ceil(n / 2);
          const sc2 = Math.max(0.5, avail / (cw * (k2 - FMAX * (k2 - 1))));
          setVars(box, sc2, -FMAX * cw * sc2, 'wrap');
        }
      }
    }
  }

  _cardWpx() {
    if (!this.container || typeof window === 'undefined') return 40;
    const v = getComputedStyle(this.container).getPropertyValue('--card-w');
    const px = parseFloat(v);
    return px || 40;
  }

  /* إعادة حساب التخطيط عند تغيير حجم النافذة أو اتجاه الشاشة */
  _bindLayoutResize() {
    if (this._onResize || typeof window === 'undefined') return;
    this._lastVw = window.innerWidth;
    this._onResize = function () {
      clearTimeout(this._resizeT);
      this._resizeT = setTimeout(function () {
        if (typeof _ramiDrag !== 'undefined' && _ramiDrag) return; // لا نزعج السحب الجاري
        /* الكيبورد: فتح لوحة الإيموجي/الكتابة يغيّر ارتفاع الـ viewport فقط —
           لا نعيد التخطيط إلا عند تغيّر العرض (دوران/تغيير مقاس حقيقي) */
        const vw = window.innerWidth;
        const widthChanged = vw !== this._lastVw;
        this._lastVw = vw;
        const ae = document.activeElement;
        const typing = !!(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'));
        if (!widthChanged && typing) return;
        if (this.container) {
          this._measureAndSetScale();
          if (this.game && this.game.gamePhase === 'PLAYING') this._updateUI();
        }
      }.bind(this), 120);
    }.bind(this);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this._onResize);
    }
  }

  destroy() {
    if (this.timerId) clearInterval(this.timerId);
    if (this.watchdogId) clearInterval(this.watchdogId);
    if (this._resizeT) clearTimeout(this._resizeT);
    if (this._onResize && typeof window !== 'undefined') {
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('orientationchange', this._onResize);
    }
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this._onResize);
    }
    this._onResize = null;
    this.game = null;
    this.container = null;
    this.selectedCards.clear();
    this.handSlots = [[], [], [], [], []];
    this._driverGrace = null;       /* [Resilience] مهلة السائق الاحتياطية */
    this._driverGraceMs = 4000;     /* [Resilience] مهلة الانتظار قبل نيابة السائق */
  }

  _renderSetup() {
    if (!this.container) return;
    const bal = (typeof ST !== 'undefined' && typeof ST.gold === 'number') ? ST.gold : 1000;
    const balTxt = (typeof fmt === 'function') ? fmt(bal) : String(bal);
    const mode = window.RAMI_SETUP_MODE || 'talaj';
    const curBet = window.RAMI_BET || 50;

    this.container.innerHTML =
      '<div class="rami-setup-modal card">' +
        '<div class="rami-setup-header">' +
          '<div class="rami-setup-emblem">🃏</div>' +
          '<div class="rami-setup-title">' + (_ramiT('rami.title') || 'الرامي المغربي') + '</div>' +
        '</div>' +

        /* النوع: طالاج / سامبل — عنوانان فقط لاختيار صنف الجولة */
        '<div class="rami-field">' +
          '<label class="rami-field-label">' + (_ramiT('rami.type') || 'النوع') + '</label>' +
          '<div class="rami-seg" id="ramiModeSeg">' +
            '<button type="button" class="rami-seg-btn' + (mode === 'talaj' ? ' on' : '') + '" data-mode="talaj" onclick="ramiSetMode(\'talaj\')">' + _ramiT('rami.talaj', 'طالاج') + '</button>' +
            '<button type="button" class="rami-seg-btn' + (mode === 'simple' ? ' on' : '') + '" data-mode="simple" onclick="ramiSetMode(\'simple\')">' + _ramiT('rami.simple', 'سامبل') + '</button>' +
          '</div>' +
        '</div>' +

        /* الهدف: أول اختيار = رهان على شوط واحد، والباقي أرقام فقط */
        '<div class="rami-field">' +
          '<label class="rami-field-label">' + (_ramiT('rami.target') || 'الهدف') + '</label>' +
          '<select id="ramiTarget" class="rami-custom-select">' + this._targetOptions(mode) + '</select>' +
        '</div>' +

        /* اللاعبون + مؤقت الدور في صف واحد */
        '<div class="rami-field-row">' +
          '<div class="rami-field">' +
            '<label class="rami-field-label">' + (_ramiT('rami.players') || 'اللاعبون') + '</label>' +
            '<select id="ramiPlayers" class="rami-custom-select">' +
              [2, 3, 4, 5].map(function (n) { return '<option value="' + n + '"' + (n === 4 ? ' selected' : '') + '>' + n + '</option>'; }).join('') +
            '</select>' +
          '</div>' +
          '<div class="rami-field">' +
            '<label class="rami-field-label">' + (_ramiT('rami.timerSelect') || 'مؤقت الدور') + '</label>' +
            '<select id="ramiTimerSelect" class="rami-custom-select">' +
              [30, 45, 60, 90, 120, 180, 300, 450, 600].map(function (s) { return '<option value="' + s + '"' + (s === 90 ? ' selected' : '') + '>' + s + 's</option>'; }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +

        /* الرهان: إدخال رقم يدوي ضمن الرصيد المتاح */
        '<div class="rami-field">' +
          '<label class="rami-field-label">🪙 ' + (_ramiT('g.bet') || 'الرهان') + ' <span class="rami-bal-hint">(' + balTxt + ')</span></label>' +
          '<div class="rami-bet-row">' +
            '<button type="button" class="bbtn" onclick="ramiChangeBet(-10)" aria-label="تقليل">−</button>' +
            '<input type="number" id="ramiBetInput" class="rami-bet-input" min="10" max="' + bal + '" value="' + curBet + '" inputmode="numeric" aria-label="قيمة الرهان">' +
            '<button type="button" class="bbtn" onclick="ramiChangeBet(10)" aria-label="زيادة">+</button>' +
            '<button type="button" class="bbtn small" onclick="ramiSetMaxBet()" title="' + T('g.max') + '">' + T('g.max') + '</button>' +
          '</div>' +
        '</div>' +

        '<button class="big rami-start-btn" onclick="ramiStartGame()">🚀 ' + (_ramiT('g.start') || 'ابدأ اللعب') + '</button>' +
      '</div>';
  }

  /* قائمة خيارات الهدف حسب النوع: «رهان على شوط واحد» ثم أرقام فقط */
  _targetOptions(mode) {
    var singleLabel = _ramiT('rami.singleRound') || 'رهان على شوط واحد';
    var nums = (mode === 'simple') ? [201, 301, 401, 501, 701, 801] : [301, 401, 501, 701, 801, 901, 1001];
    var opts = '<option value="single">' + singleLabel + '</option>';
    nums.forEach(function (n) { opts += '<option value="' + n + '">' + n + '</option>'; });
    return opts;
  }

  playIntroAndStart() {
    const table = document.getElementById('ramiRoundTable');
    if (!table || !this.game) { this._processTurn(); return; }

    setRamiBusy(true);
    const players = this.game.players;
    const mode = this.game.mode;

    // اختيار الموزع بأصغر ورقة يحدث في الشوط الأول فقط؛
    // في باقي الأشواط ينتقل دور التوزيع للاعب التالي تلقائياً (nextRound)
    const isFirstRound = (this.game.roundManager.roundNumber === 0);

    const overlay = document.createElement('div');
    overlay.className = 'rami-intro-overlay';
    overlay.id = 'ramiIntroOverlay';
    overlay.innerHTML =
      '<div class="rami-shuffling-deck">' +
        '<div class="rcard-vector rcard-back rami-shuffle-card"><div class="rcard-back-pattern"></div></div>' +
        '<div class="rcard-vector rcard-back rami-shuffle-card"><div class="rcard-back-pattern"></div></div>' +
        '<div class="rcard-vector rcard-back rami-shuffle-card"><div class="rcard-back-pattern"></div></div>' +
      '</div>' +
      '<div class="rami-intro-title">🔄 ' + _ramiT('rami.shuffling', 'خلط الأوراق') + '...</div>';
    table.appendChild(overlay);

    if (typeof SND !== 'undefined' && SND.shuffle) SND.shuffle();

    const finishIntro = () => {
      if (!this.game) { setRamiBusy(false); return; }
      overlay.innerHTML = '<div class="rami-intro-title">🃏 ' + (_ramiT('rami.dealing') || 'توزيع الأوراق في الطاولة...') + '</div>';
      if (typeof SND !== 'undefined' && SND.deal) SND.deal();
      setTimeout(() => {
        setRamiBusy(false);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        this._renderGame();
        this._processTurn();
      }, 900);
    };

    setTimeout(() => {
      if (!this.game) { setRamiBusy(false); return; }

      // الأشواط اللاحقة: التوزيع تم مسبقاً في nextRound — لا إعادة اختيار للموزع
      if (!isFirstRound) {
        finishIntro();
        return;
      }

      // الشوط الأول فقط: انتقاء الموزع بأصغر ورقة
      const cutCards = [];
      for (let i = 0; i < players.length; i++) {
        const c = this.game.roundManager.drawPile.pop() || new RamiCard(100 + i, Math.floor(Math.random() * 10) + 1, 'heart');
        cutCards.push({ player: players[i], card: c });
      }

      let minCardIdx = 0;
      for (let i = 1; i < cutCards.length; i++) {
        if (cutCards[i].card.rank < cutCards[minCardIdx].card.rank) {
          minCardIdx = i;
        }
      }

      this.game.roundManager.dealerIndex = minCardIdx;

      let cutHtml = '<div class="rami-intro-title">👑 ' + (_ramiT('rami.cuttingDealer') || 'انتقاء الموزع — أصغر ورقة هي الموزع الأول') + '</div>' +
        '<div class="rami-intro-cards-row">';

      for (let i = 0; i < cutCards.length; i++) {
        const item = cutCards[i];
        const isWinner = (i === minCardIdx);
        cutHtml += '<div class="rami-cut-card-box' + (isWinner ? ' dealer-winner' : '') + '">' +
          getRamiCardHTML(item.card, false) +
          '<span class="rami-cut-pname">' + item.player.name + (isWinner ? ' ♛' : '') + '</span>' +
        '</div>';
      }
      cutHtml += '</div>';

      overlay.innerHTML = cutHtml;

      setTimeout(() => {
        if (!this.game) { setRamiBusy(false); return; }
        // إعادة التوزيع وفق الموزع المختار
        this.game.startRound();
        finishIntro();
      }, 1500);
    }, 1100);
  }

  _renderGame() {
    if (!this.container || !this.game) return;
    const modeTxt = _ramiT(this.game.mode === 'talaj' ? 'rami.talaj' : 'rami.simple', this.game.mode === 'talaj' ? 'طالاج' : 'سامبل');
    const target = (this.game.displayTarget !== undefined && this.game.displayTarget !== null) ? this.game.displayTarget : this.game.targetScore;
    /* [V20] رقم مجموع الرهان فقط (بدون نص وبدون رمز كوينز) — يُعرض ذهبياً أسفل العنوان */
    const betTotal = (window.RAMI_BET || 50) * this.game.playerCount;

    this.container.innerHTML =
      '<div class="rami-game">' +
        '<div class="rami-round-table" id="ramiRoundTable">' +
          '<div class="rami-seats-container rami-seats-above" id="ramiSeatsAbove"></div>' +
          '<div class="rami-center-zone">' +
            /* اليسار: الهدف (أعلى) + مجموع الرهان (أسفل) */
            '<div class="rami-rim-header">' +
              '<span class="rami-rim-title">' + target + '</span>' +
              '<span class="rami-rim-bet">' + betTotal + '</span>' +
            '</div>' +
            '<div class="rami-table-center" id="ramiTableCenter"></div>' +
            /* اليمين: نوع الرامي (طالاج/سامبل) */
            '<div class="rami-side-type"><span class="rami-side-type-txt">' + modeTxt + '</span></div>' +
            '<div class="rami-discard-dropzone" id="ramiDiscardDropZone"><span class="dz-label">🗑 أفلت الورقة هنا لرميها</span></div>' +
          '</div>' +
          '<div class="rami-seats-container rami-seats-below" id="ramiSeatsBelow"></div>' +
          '<div class="rami-player-bottom-wrap" id="ramiPlayerBottomWrap">' +
            '<div class="rami-human-melds-area" id="ramiHumanMeldsArea"></div>' +
            '<div class="rami-action-dock" id="ramiActionDock"></div>' +
            '<div class="rami-hint-line" id="ramiHintLine" hidden></div>' +
            '<div class="rami-5slots-container" id="rami5SlotsContainer"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    this._measureAndSetScale();
    this._updateUI();
    this._startTimer();
  }

  _startTimer() {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      if (!this.game || this.game.gamePhase !== 'PLAYING') {
        clearInterval(this.timerId);
        return;
      }
      try { this._tick(); } catch (e) { console.error('[Rami] tick error:', e && e.message, e); }
    }, 1000);

    /* Watchdog مستقل يكتشف التجمد ويستعيد الحالة */
    if (this.watchdogId) clearInterval(this.watchdogId);
    this.watchdogId = setInterval(() => {
      try { this._watchdog(); } catch (e) { console.error('[Rami] watchdog error:', e && e.message); }
    }, 2000);
  }

  /* كشف التجمد: قفل انشغال عالق، عداد توقف، أو دور بوت بلا حركة */
  _watchdog() {
    if (!this.game) return;
    if (this.game.gamePhase !== 'PLAYING') return;

    // 1) قفل انشغال عالق لأكثر من 5 ثوانٍ → تحريره
    if (RAMI_BUSY && Date.now() - (_lastBusyTime || 0) > 5000) {
      console.warn('[Rami] watchdog: clearing stuck RAMI_BUSY');
      setRamiBusy(false);
    }

    // 2) دور بوت عالق بلا حركة لأكثر من 6 ثوانٍ → إجباره على اللعب
    const rm = this.game.roundManager;
    if (!rm) return;
    const curP = rm.getCurrentPlayer();
    const started = rm._turnStartedAt || Date.now();
    if (curP && curP.isBot && !RAMI_BUSY && (Date.now() - started) > 6000) {
      console.warn('[Rami] watchdog: forcing stuck bot turn for', curP.name);
      rm._turnStartedAt = Date.now();
      this._runBotTurn(curP);
    }
  }

  _tick() {
    if (!this.game || this.game.gamePhase !== 'PLAYING') return;
    const rm = this.game.roundManager;
    rm.turnSecondsRemaining--;
    const secStr = Math.max(0, rm.turnSecondsRemaining) + 's';
    const timerEls = document.querySelectorAll('.rami-avatar-timer');
    timerEls.forEach(el => {
      el.textContent = secStr;
    });

    // Bot Watchdog: إذا كان دور البوت ولم يقم بحركة خلال ثانيتين، استدعاء حركته فوراً
    const curP = rm.getCurrentPlayer();
    if (curP && curP.isBot && !RAMI_BUSY && rm.turnSecondsRemaining < (this.game.rules.turnSeconds - 2)) {
      this._runBotTurn(curP);
    }

    if (rm.turnSecondsRemaining <= 0) {
      this._handleTurnTimeout();
    }
  }

  /* [Resilience] السائق الحالي: من يقود المؤقّتات والتقدّم الآلي (افتراضياً المُنشئ،
     يُعاد تعيينه خادمياً عند انقطاعه). في اللعب الفردي دائماً true. */
  _isDriver() {
    if (!this.multiplayer) return true;
    var room = (typeof Rooms !== 'undefined' && Rooms.state) ? Rooms.state : (this.room || null);
    if (!room) return !!(this.room && this.room.isOwner);
    var driverId = (room.driverId != null) ? room.driverId : room.owner_id;
    return String(driverId) === String(ramiMyUserId());
  }

  /* [Resilience] بثّ الحركة الدقيقة لانتهاء المؤقّت (يتطابق الجميع عند تطبيقها) */
  _emitAutoTimeout(curP, rm, drew, discardCardId) {
    if (!this.multiplayer) return;
    this._netEmit('autoTimeout', { playerId: curP.id, drew: drew, discardCardId: discardCardId, dedup: 'auto-' + (rm.roundNumber||0) + '-' + curP.id + '-' + (rm._turnStartedAt||0) });
  }

  /* [Resilience] تنفيذ اللعب الآلي (سحب إن لزم + رمي ورقة لا منتمية) مع بثّ اختياري */
  _doAutoPlay(curP, rm, broadcast) {
    setRamiBusy(true);
    var drew = false, discardCardId = null;
    try {
      if (rm.turnPhase === 'WAITING_DRAW' && curP.hand.length < this.game.rules.playHandSize) {
        const r = this.game.executeMove({ type: 'draw_deck', playerId: curP.id });
        if (r && r.success) drew = true;
        else {
          rm.nextPlayer(); setRamiBusy(false);
          if (broadcast) this._emitAutoTimeout(curP, rm, false, null);
          if (this.game.gamePhase === 'PLAYING') this._processTurn(); else this._endRoundUI();
          return;
        }
      }
      if (rm.turnPhase === 'WAITING_DISCARD') {
        const hand = curP.hand.slice();
        let card = hand.find(c => !this.game.doesCardFitAnyTableMeld(c));
        if (!card) card = hand[hand.length - 1];
        if (card) {
          const res = this.game.executeMove({ type: 'discard', playerId: curP.id, cardId: card.id });
          if (res && (res.success || res.penaltyApplied)) { this.selectedCards.clear(); discardCardId = card.id; }
        }
      }
      setRamiBusy(false);
      this.selectedCards.clear();
      if (broadcast) this._emitAutoTimeout(curP, rm, drew, discardCardId);
      _ramiToast('\u{1F916} ' + (_ramiT('rami.autoEnabled') || 'انتهى الوقت — تم رمي ورقة تلقائياً'), 'warn');
      if (this.game.gamePhase === 'PLAYING') this._processTurn(); else this._endRoundUI();
    } catch (e) {
      console.error('[Rami] auto-discard error:', e && e.message, e);
      setRamiBusy(false);
      try { rm.nextPlayer(); if (broadcast) this._emitAutoTimeout(curP, rm, false, null); this._processTurn(); } catch (e2) { /* تجاهل */ }
    }
  }

  _handleTurnTimeout() {
    if (!this.game || this.game.gamePhase !== 'PLAYING') return;
    if (checkRamiBusy()) return;
    const rm = this.game.roundManager;
    const curP = rm.getCurrentPlayer();
    if (!curP || curP.isBot) return;

    const isMyTurn = (curP.id === (this.myPlayerId || 0));

    /* اللاعب الحالي المتصل: يلعب آلياً لنفسه فوراً (يحافظ على ترتيب يده المحلي ويمنع حركة متأخرة) */
    if (this.multiplayer && isMyTurn) {
      rm.turnSecondsRemaining = this.game.rules.turnSeconds;
      this._doAutoPlay(curP, rm, true);
      return;
    }

    /* [Resilience] السائق احتياطياً: يمنح مهلة قصيرة (4ث) قبل أن ينوب عن لاعب متجمّد/منقطع.
       إن كان دور اللاعب قد انتهى فعلاً (وصلت حركته) يتغير curP فيلغي المفتاح المطابقة. */
    if (this.multiplayer && this._isDriver()) {
      const key = (rm.roundNumber||0) + ':' + curP.id + ':' + (rm.turnPhase||'');
      if (!this._driverGrace || this._driverGrace.key !== key) {
        this._driverGrace = { key: key, deadline: Date.now() + (this._driverGraceMs||4000) };
      }
      if (Date.now() >= this._driverGrace.deadline) {
        this._driverGrace = null;
        rm.turnSecondsRemaining = this.game.rules.turnSeconds;
        this._doAutoPlay(curP, rm, true);
      }
      return;
    }
    /* غير السائق وغير صاحب الدور: لا شيء (ينتظر بثّ الحركة) */
  }
  _processTurn() {
    if (!this.game || this.game.gamePhase !== 'PLAYING') return;
    /* [Spectator] عرض فقط — لا مؤقّتات ولا أفعال */
    if (this.isSpectator) { this._updateUI(); return; }
    setRamiBusy(false);
    const curP = this.game.roundManager.getCurrentPlayer();
    this.game.roundManager.turnSecondsRemaining = this.game.rules.turnSeconds || 90;
    this.game.roundManager._turnStartedAt = Date.now();
    this._updateUI();

    const isMyTurn = !!(curP && curP.id === (this.myPlayerId || 0));
    if (curP && curP.isBot) {
      this._runBotTurn(curP);
    } else if (this.multiplayer && !isMyTurn) {
      /* وضع الغرفة: ليس دوري — عرض فقط (صامت، يدير صاحب الدور مؤقته) */
      return;
    } else {
      if (typeof SND !== 'undefined' && SND.notify) SND.notify();
      if (!this._uxHinted) {
        this._uxHinted = true;
        const hl = document.getElementById('ramiHintLine');
        if (hl) {
          hl.innerHTML = '💡 ' + (_ramiT('rami.uxHint') || 'انقر ورقة لتحديدها · اسحبها وأفلتها في وسط الطاولة للرمي · انقر مرتين على المجرف/المرموق للسحب');
          hl.hidden = false;
          clearTimeout(this._hintT);
          this._hintT = setTimeout(function () {
            const h2 = document.getElementById('ramiHintLine');
            if (h2) h2.hidden = true;
          }, 12000);
        }
      }
    }
  }

  /* [Spectator] شريط المراقبة: بانر + زر طلب الانضمام (بدل أزرار اللعب واليد) */
  _renderSpectatorBar() {
    if (typeof document === 'undefined') return;
    /* تفريغ خانات اليد البشرية (لا يد للمتفرج) */
    for (let s = 0; s < 5; s++) {
      const slot = document.getElementById('ramiHandSlot' + s);
      if (slot) slot.innerHTML = '';
    }
    const humanMeldsEl = document.getElementById('ramiHumanMeldsArea');
    if (humanMeldsEl) humanMeldsEl.innerHTML = '';
    const dock = document.getElementById('ramiActionDock');
    if (!dock) return;
    const seats = (this.room && this.room.seats) ? this.room.seats : null;
    const free = seats ? seats.free : 0;
    const max = seats ? seats.max : 0;
    const players_n = seats ? seats.players : 0;
    const pending = (typeof Rooms !== 'undefined' && typeof Rooms.myJoinPending === 'function') ? Rooms.myJoinPending() : false;
    let btnHtml = '';
    if (pending) {
      btnHtml = '<div class="rami-spec-pending">' + _ramiF('rami.specJoinQueued', '⏳ طلبك في الطابور — بانتظار تفرّغ مقعد ({n}/{max})', { n: players_n, max: max }) + '</div>';
    } else if (free > 0) {
      btnHtml = '<button class="big rami-start-btn" onclick="Rooms.requestJoin()">🎮 ' + _ramiT('rami.specJoinBtn', 'اطلب الانضمام كمشغل') + '</button>';
    } else {
      btnHtml = '<div class="rami-spec-full" style="opacity:.7;font-size:.78rem;">' + (max ? (players_n + '/' + max + ' — ') : '') + _ramiT('rami.specFull', 'لا توجد مقاعد شاغرة حالياً') + '</div>';
    }
    dock.innerHTML = '<div class="rami-spectator-bar" style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:10px 12px;">' +
      '<div class="rami-spec-banner" style="font-size:.78rem;color:rgba(255,255,255,.75);text-align:center;max-width:520px;">' + _ramiT('rami.specBanner', '👁️ وضع المتفرج — تشاهد الأفعال العامة وعدد أوراق كل لاعب دون كشف الوجوه') + '</div>' +
      btnHtml +
    '</div>';
  }

  /* [Spectator] شاشة انتظار بدء المباراة */
  _renderSpectatorWait() {
    if (!this.container) return;
    this.container.innerHTML =
      '<div class="rami-setup-modal card" style="text-align:center;padding:28px 16px;">' +
        '<div class="rami-setup-emblem">👁️</div>' +
        '<div class="rami-setup-title">' + _ramiT('rami.specWait', 'متفرّج — في انتظار بدء المالك للمباراة…') + '</div>' +
      '</div>';
  }

  _autoPlayTurn() {
    /* اللعب الأوتوماتيكي (عند انتهاء الوقت) يعيد استخدام منطق الذكاء الاصطناعي الذكي:
       سحب، افتتاح، تركيب، وإنهاء — بدل الرمي العشوائي الذي كان يعجز عن الافتتاح */
    if (!this.game || checkRamiBusy()) return;
    const curP = this.game.roundManager.getCurrentPlayer();
    if (!curP) return;
    this._runBotTurn(curP);
  }

  /* [MP-AI] بثّ حركة البوت للغرفة (السائق وحده يشغّل البوت في الوضع الجماعي) */
  _botEmit(action, data) { if (this.multiplayer) this._netEmit(action, data); }

  _runBotTurn(bot) {
    if (!this.game || this.game.gamePhase !== 'PLAYING') return;
    if (checkRamiBusy()) return; // منع الاستدعاء المزدوج من الـ watchdog
    /* [MP-AI] في الوضع الجماعي السائق وحده يُشغّل البوت ويبثّه؛ البقية يطبّقون عبر room:move */
    if (this.multiplayer && !this._isDriver()) return;
    const curP = this.game.roundManager.getCurrentPlayer();
    if (!curP || curP.id !== bot.id) return;

    setRamiBusy(true);
    const rm = this.game.roundManager;

    setTimeout(() => {
      try {
      if (!this.game || this.game.gamePhase !== 'PLAYING') { setRamiBusy(false); return; }

      if (rm.turnPhase === 'WAITING_DRAW') {
        /* [EXPERT-AI] قرار السحب الخبير: لا يأخذ المرموق إلا إذا كان سيُنزّل
           هذا الدور فعلاً (إنهاء/افتتاح/إدراج محلي/مجموعة جديدة) */
        let drawType = RamiExpertAI.chooseDraw(this.game, bot, !this.multiplayer);

        /* [V24] فحص نتيجة السحب: إن فشل (نفاد الأوراق) تُجرَّب البديل ثم يمرر الدور لتجنب التجمد */
        let usedDraw = null;
        let drawRes = this.game.executeMove({ type: drawType, playerId: bot.id });
        if (drawRes && drawRes.success) usedDraw = drawType;
        else if (drawRes && drawRes.penaltyApplied) usedDraw = drawType;
        else {
          const alt = drawType === 'draw_deck' ? 'draw_discard' : 'draw_deck';
          const altRes = this.game.executeMove({ type: alt, playerId: bot.id });
          if (altRes && (altRes.success || altRes.penaltyApplied)) usedDraw = alt;
        }
        if (!usedDraw) {
          /* لا يمكن السحب إطلاقاً: تمرير الدور قسرياً */
          setRamiBusy(false);
          rm.nextPlayer();
          this._processTurn();
          return;
        }
        this._botEmit('draw', { drawType: usedDraw, playerId: bot.id });
        if (typeof SND !== 'undefined' && SND.card) SND.card();
        this._updateUI();
      }

      setTimeout(() => {
        try {
        if (!this.game || this.game.gamePhase !== 'PLAYING') { setRamiBusy(false); return; }

        const legalMoves = this.game.getLegalMoves(bot.id);
        /* [EXPERT-AI] افتتاح خبير يتجنّب حصار الورقتين */
        const openMove = (!bot.hasOpened) ? RamiExpertAI.expertOpening(this.game, bot) : null;
        if (openMove && !bot.hasOpened) {
          const or = this.game.executeMove(openMove);
          if (or && (or.success || or.penaltyApplied)) this._botEmit('open', { playerId: bot.id, cardIds: openMove.cardIds });
          if (typeof SND !== 'undefined' && SND.card) SND.card();
          this._updateUI();
          // إذا أنهى الافتتاح الشوط مباشرة (نزول كامل اليد) نتوقف فوراً لتجنب إنهاء مزدوج
          if (this.game.gamePhase !== 'PLAYING') {
            setRamiBusy(false);
            this._endRoundUI();
            return;
          }
        }

        /* [EXPERT-AI] بعد الافتتاح: إنزال كل مجموعة مكتمّلة في اليد فوراً —
           أسرع طريق لتفريغ اليد والفوز، ويحمي ورقة المرموق من الجزاء.
           حركة حتمية بمعرّفات صريحة: تعمل محلياً وجماعياً بنفس النتيجة. */
        if (bot.hasOpened && rm.turnPhase !== 'WAITING_DRAW') {
          const handMelds = partitionSelectedCards(bot.hand.slice(), this.game.rules);
          if (handMelds && handMelds.length > 0) {
            const dumpIds = handMelds.flatMap(m => m.cards.map(c => c.id));
            /* [EXPERT-AI] حارس الحصار: بعد الإنزال تتبقى 0/1 = فوز فوري،
               3+ = آمن، أما ورقتان فقط فتعني حصاراً دائماً (يد من ورقة
               لا يمكنها الفوز) — نؤجّل الإنزال دوراً آخر */
            const leftovers = bot.hand.length - dumpIds.length;
            if (dumpIds.length >= 3 && leftovers !== 2) {
              const dres = this.game.executeMove({ type: 'open', playerId: bot.id, cardIds: dumpIds });
              if (dres && (dres.success || dres.penaltyApplied)) {
                this._botEmit('open', { playerId: bot.id, cardIds: dumpIds });
                if (typeof SND !== 'undefined' && SND.card) SND.card();
                this._updateUI();
                /* إن أفرد هذا الإنزال إنهاء الشوط (يد فارغة/ورقة واحدة) نتوقف فوراً */
                if (this.game.gamePhase !== 'PLAYING') {
                  setRamiBusy(false);
                  this._endRoundUI();
                  return;
                }
              }
            }
          }
        }

        /* توسيع المجموعات: في اللعب الفردي فقط (محلي بلا بثّ)؛ في الجماعي يُتخطّى
           لضمان تطابق تامّ بين الأطراف (ترتيب المجموعات قد يتباين عبر البثّ). */
        if (!this.multiplayer && bot.hasOpened && rm.tableMelds.length > 0) {
          const fitsMeld = (card) => {
            for (let mIdx = 0; mIdx < rm.tableMelds.length; mIdx++) {
              const meld = rm.tableMelds[mIdx];
              const temp = meld.cards.concat([card]);
              if (meld.type === MELD_TYPE.SET && this.game.rules.isValidSet(temp, true)) return meld;
              if (meld.type === MELD_TYPE.SEQUENCE && this.game.rules.isValidSequence(temp, true)) return meld;
            }
            return null;
          };
          /* [EXPERT-AI] أولاً — إلزامي بأي حجم يد: ورقة المرموق/لا تور المسحوبة
             إن كانت تطابق الطاولة تُنزَّل فوراً (وإلا ارتدّت بجزاء 71) */
          const drawnCard = bot.drawnDiscardCard || bot.drawnLaTourCard;
          if (drawnCard) {
            const meld = fitsMeld(drawnCard);
            if (meld) {
              bot.removeCard(drawnCard.id);
              meld.cards.push(drawnCard);
            }
          }
          /* [EXPERT-AI] ثم بقية الأوراق فوق 3 فقط (منع الحصار بعد الرمي) */
          const botCards = bot.hand.slice();
          for (const card of botCards) {
            if (bot.hand.length <= 3) break;
            const meld = fitsMeld(card);
            if (meld) {
              bot.removeCard(card.id);
              meld.cards.push(card);
            }
          }
          /* [EXPERT-AI] إنقاذ من ورقتين: إدراج إحداهما في الطاولة ثم رمي
             الأخيرة = فوز فوري (الأولى ثم الثانية) */
          if (bot.hand.length === 2) {
            for (let ci = 0; ci < 2 && bot.hand.length === 2; ci++) {
              const card = bot.hand[ci];
              if (!card) break;
              for (let mIdx = 0; mIdx < rm.tableMelds.length; mIdx++) {
                const meld = rm.tableMelds[mIdx];
                const temp = meld.cards.concat([card]);
                let canAdd = false;
                if (meld.type === MELD_TYPE.SET && this.game.rules.isValidSet(temp, true)) canAdd = true;
                if (meld.type === MELD_TYPE.SEQUENCE && this.game.rules.isValidSequence(temp, true)) canAdd = true;
                if (canAdd) { bot.removeCard(card.id); meld.cards.push(card); break; }
              }
            }
          }
        }

        if (bot.hasOpened && this.game.canFinish(bot)) {
          const finishRes = this.game.executeMove({ type: 'finish', playerId: bot.id });
          if (finishRes && (finishRes.success || finishRes.penaltyApplied)) {
            this._botEmit('finish', { playerId: bot.id, isolateCardId: null });
            setRamiBusy(false);
            if (this.game.gamePhase === 'ROUND_END') {
              this._endRoundUI();
            } else {
              this._processTurn();
            }
            return;
          }
        }

        /* [V29] رمي البوت مع فحص النتيجة: إن فشل الرمي تُرمى ورقة قسرياً (منع بقاء 15 ورقة) */
        let discarded = false, discardedCardId = null;
        const discardMoves = this.game.getLegalMoves(bot.id).filter(m => m.type === 'discard');
        if (discardMoves.length > 0) {
          /* [EXPERT-AI] ورقة الرمي المثلى بدل العشوائية */
          const expertId = RamiExpertAI.chooseDiscard(this.game, bot);
          const discardMove = discardMoves.find(m => m.cardId === expertId) || discardMoves[0];
          const dr = this.game.executeMove(discardMove);
          if (dr && dr.success) { discarded = true; discardedCardId = discardMove.cardId; }
          else if (dr && dr.penaltyApplied) { discarded = true; discardedCardId = discardMove.cardId; } /* جزاء المرموق مرّر الدور داخلياً */
          if (typeof SND !== 'undefined' && SND.card) SND.card();
        }
        if (!discarded && this.game.gamePhase === 'PLAYING' && bot.hand.length > 0) {
          /* محاولة قسرية أخيرة: إزالة ورقة زائدة إذا بقي فوق الحد */
          const maxHand = this.game.rules.playHandSize;
          if (bot.hand.length > maxHand - 1 && rm.turnPhase === 'WAITING_DISCARD') {
            const forced = bot.hand[bot.hand.length - 1];
            const fr = this.game.executeMove({ type: 'discard', playerId: bot.id, cardId: forced.id });
            if (fr && fr.success) { discarded = true; discardedCardId = forced.id; }
          }
        }
        if (discarded && discardedCardId != null) this._botEmit('discard', { playerId: bot.id, cardId: discardedCardId });

        setRamiBusy(false);
        if (this.game.gamePhase === 'ROUND_END') {
          this._endRoundUI();
        } else {
          this._processTurn();
        }
        } catch (e) {
          console.error('[Rami] bot turn error:', e && e.message, e);
          setRamiBusy(false);
          if (this.game && this.game.gamePhase === 'PLAYING') this._processTurn();
        }
      }, 450);
      } catch (e) {
        console.error('[Rami] bot draw error:', e && e.message, e);
        setRamiBusy(false);
        if (this.game && this.game.gamePhase === 'PLAYING') this._processTurn();
      }
    }, 350);
  }

  toggleHumanAutoPlay() {
    const player = this.players()[0];
    if (!player) return;
    player.isAutoPlay = !player.isAutoPlay;
    if (!player.isAutoPlay) {
      player.consecutiveAutoTurns = 0;
      _ramiToast('✅ ' + (_ramiT('rami.autoDisabled') || 'تم إلغاء اللعب الأوتوماتيكي واستعادة التحكم اليدوي'), 'ok');
    } else {
      _ramiToast('🤖 ' + (_ramiT('rami.autoEnabled') || 'تم تفعيل اللعب الأوتوماتيكي'), 'info');
    }
    this._updateControls();
  }

  _distributeCardsToSlots(cards) {
    const slots = [[], [], [], [], []];
    if (!cards || cards.length === 0) return slots;

    const rules = this.game ? this.game.rules : new RamiRules('talaj');
    const melds = partitionSelectedCards(cards, rules);

    const placedIds = new Set();
    let slotIdx = 0;

    if (melds && melds.length > 0) {
      for (const m of melds) {
        if (slotIdx < 4) {
          /* [V16] كل مجموعة في خانة مستقلة ومرتبة: المتتاليات تصاعدياً (الجوكر في فجوة/طرفه) */
          const ordered = (m.type === MELD_TYPE.SEQUENCE)
            ? ramiOrderSequenceCards(m.cards.slice(), c => rules.isWildCard(c))
            : m.cards.slice();
          slots[slotIdx] = ordered;
          m.cards.forEach(c => placedIds.add(c.id));
          slotIdx++;
        }
      }
    }

    const remaining = cards.filter(c => !placedIds.has(c.id));
    if (slotIdx === 0) {
      for (let i = 0; i < remaining.length; i++) {
        const s = Math.min(Math.floor(i / 3), 4);
        slots[s].push(remaining[i]);
      }
    } else {
      for (let i = 0; i < remaining.length; i++) {
        const s = Math.min(slotIdx + Math.floor(i / 3), 4);
        slots[s].push(remaining[i]);
      }
    }
    return slots;
  }

  _updateUI() {
    if (!this.game) return;

    const rm = this.game.roundManager;
    const curIdx = this.game.currentPlayerIndex;
    const players = this.game.players;
    const isSpec = !!this.isSpectator;
    const myId = isSpec ? -1 : (this.myPlayerId || 0);
    /* [Spectator] المتفرج يرى كل اللاعبين كمقاعد (يد كل لاعب = عددها فقط) */
    const otherPlayers = isSpec ? players.slice() : players.filter((p, i) => i !== myId);
    const humanPlayer = isSpec ? null : players[myId];

    /* 1. مقاعد الخصوم مكدّسة عمودياً فوق اللاعب الرئيسي (لا مقاعد جانبية):
          الأعلى: AI4 ثم AI3 … الأسفل (الأقرب للاعب): AI2 ثم AI1.
          كل مقعد = صف أفقي: أوراق على اليسار + HUD (أيقونة/اسم/نقاط/مؤقت) على اليمين.
          مركز الطاولة (المجرف/المرموق) يفصل بين المجموعة العلوية والسفلية. */
    const seatsAboveEl = document.getElementById('ramiSeatsAbove');
    const seatsBelowEl = document.getElementById('ramiSeatsBelow');
    const oppCount = otherPlayers.length;
    const aboveCount = Math.floor(oppCount / 2);
    const isLandscape = (typeof window !== 'undefined') ? (window.innerWidth > window.innerHeight) : false;
    let abovePlayers, belowPlayers;
    if (oppCount === 4 && isLandscape) {
      /* [V28] لاندسكيب: AI2 يمين أعلى، AI3 يسار أعلى؛ AI1 يمين أسفل، AI4 يسار أسفل */
      abovePlayers = [otherPlayers[1], otherPlayers[2]]; // AI2, AI3
      belowPlayers = [otherPlayers[0], otherPlayers[3]]; // AI1, AI4
    } else {
      abovePlayers = otherPlayers.slice(oppCount - aboveCount, oppCount).reverse();
      belowPlayers = otherPlayers.slice(0, oppCount - aboveCount).reverse();
    }

    const gameRules = this.game.rules;

    const renderSeat = function (p, countMode) {
      const isCurrent = (p.id === players[curIdx].id);
      const isDealer = (p.id === rm.dealerIndex);
      const dealerIcon = isDealer ? ' ♛' : '';
      const activeCls = isCurrent ? ' active' : '';
      const activeHalo = isCurrent ? ' active-turn-halo' : '';
      const initials = getPlayerInitials(p.name, p.id);
      const timerHtml = '<span class="rami-avatar-timer">' + rm.turnSecondsRemaining + 's</span>';

      /* [V19] خمس خانات ثابتة (مثل اللاعب الرئيسي): المجموعات المنزلة أولاً وجوهاً،
         ثم أوراق اليد المتبقية ظهوراً موزعة على باقي الخانات. */
      const slots = [[], [], [], [], []];
      const slotMeld = [-1, -1, -1, -1, -1];
      let si = 0;
      if (p.melds && p.melds.length) {
        for (let mi = 0; mi < p.melds.length && si < 5; mi++) {
          if (!p.melds[mi].cards || !p.melds[mi].cards.length) continue;
          /* [V28] المتتاليات تُعرض مرتبة من الأصغر للأكبر (يمين←يسار) حتى لو لم تكن مرتّبة في الخانة */
          if (p.melds[mi].type === MELD_TYPE.SEQUENCE) {
            slots[si] = ramiOrderSequenceCards(p.melds[mi].cards.slice(), c => gameRules.isWildCard(c));
          } else {
            slots[si] = p.melds[mi].cards.slice();
          }
          slotMeld[si] = mi;
          si++;
        }
      }
      if (!countMode) {
        for (let c = 0; c < p.hand.length; c++) {
          const s = Math.min(si + Math.floor(c / 3), 4);
          slots[s].push(null); /* null = ظهر ورقة */
        }
      }
      let lineHtml = '<div class="rami-seat-line line-h line-slots" title="يد ' + p.name + ' — ' + p.hand.length + ' ورقة">';
      for (let s = 0; s < 5; s++) {
        const isEmpty = slots[s].length === 0;
        lineHtml += '<span class="rami-opp-slot' + (isEmpty ? ' empty' : '') + '" data-slot="' + s + '">';
        for (let ci = 0; ci < slots[s].length; ci++) {
          const card = slots[s][ci];
          if (card === null) {
            lineHtml += getRamiCardHTML(null, true, 'mini-back');
          } else {
            const mIdx = slotMeld[s];
            /* [V28] تمرير فهرس الورقة لتمييز الورقة الصغيرة عن الكبيرة عند إدراج الجوكر */
            lineHtml += '<span class="mini-meld-wrap" onclick="ramiAddCardToTableMeld(' + p.id + ',' + mIdx + ',' + ci + ')" title="إضافة ورقة أو استبدال الجوكر">' +
              getRamiCardHTML(card, false, 'mini-meld') +
            '</span>';
          }
        }
        lineHtml += '</span>';
      }
      lineHtml += '</div>';
      /* [Spectator] شارة عدد الأوراق المخفية بدل إظهار الوجوه */
      if (countMode) {
        lineHtml += '<span class="rami-spec-count">' + _ramiF('rami.specHandCount', '🂠 {n} ورقة', { n: p.hand.length }) + '</span>';
      }

      return '<div class="rami-seat-node seat-row' + activeCls + activeHalo + '">' +
        '<div class="rami-seat-hud">' +
          '<div class="rami-avatar-wrap">' +
            '<div class="rami-avatar-circle' + (isCurrent ? ' active' : '') + '">' + initials + '</div>' +
          '</div>' +
          '<span class="rami-node-score">' + p.totalScore + (p.isEliminated ? ' 🚫' : '') + '</span>' +
          '<span class="rami-dealer-crown">' + (isDealer ? '♛' : '') + '</span>' +
          timerHtml +
        '</div>' +
        lineHtml +
      '</div>';
    };

    if (seatsAboveEl) {
      let html = '';
      for (let i = 0; i < abovePlayers.length; i++) html += renderSeat(abovePlayers[i], isSpec);
      seatsAboveEl.innerHTML = html;
    }
    if (seatsBelowEl) {
      let html = '';
      for (let i = 0; i < belowPlayers.length; i++) html += renderSeat(belowPlayers[i], isSpec);
      seatsBelowEl.innerHTML = html;
    }

    /* 2. مركز الطاولة: أوراق التوزيع (المجرف) + أوراق المرموق (المهملة) — فيكتور نقي 100% في المركز الهندسي بدون عدادات أو أيقونات إضافية */
    const centerEl = document.getElementById('ramiTableCenter');
    if (centerEl) {
      let centerHtml = '<div class="rami-piles-row">';

      /* الأوراق المتخلص منها (المرموق) أولاً على اليسار، ثم المجرف (المقلوب) على اليمين */
      if (rm.discardPile.length > 0) {
        const topDiscard = rm.discardPile[rm.discardPile.length - 1];
        const isLaTour = (rm.laTourCard && topDiscard.id === rm.laTourCard.id);
        const laTourBadge = (isLaTour && rm.isFirstTourCycle) ? '<span class="rami-pile-label" style="background:#10B981;color:#fff">👑 لا تور</span>' : '';
        
        centerHtml += '<div class="rami-discard-box" data-ramidraw="discard" title="' + (isLaTour ? 'اضغط مرتين لأخذ ورقة لا تور' : 'اضغط مرتين لأخذ المرموق') + '">' +
          getRamiCardHTML(topDiscard, false) +
          laTourBadge +
        '</div>';
      }

      // أوراق التوزيع (المجرف) — مقلوبة، على يمين المرموق
      centerHtml += '<div class="rami-deck-box" data-ramidraw="deck" title="اضغط مرتين لسحب ورقة من المجرف">' +
        getRamiCardHTML(null, true) +
      '</div>';

      // مؤشر الجوكر في السامبل
      if (rm.jokerIndicator) {
        centerHtml += '<div class="rami-indicator-box" title="جوكر الجولة">' +
          getRamiCardHTML(rm.jokerIndicator, false) +
        '</div>';
      }

      centerHtml += '</div>';
      centerEl.innerHTML = centerHtml;
    }

    /* 3. أوراق اللاعب المنزلة تعرض داخل خانات يده بحلقة ذهبية (لا فوق شريط التحكم) */
    const humanMeldsEl = document.getElementById('ramiHumanMeldsArea');
    if (humanMeldsEl) humanMeldsEl.innerHTML = '';

    /* 4 + 5. [Spectator] المتفرج: شريط مراقبة + زر طلب الانضمام بدل أزرار اللعب واليد */
    if (this.isSpectator) {
      this._renderSpectatorBar();
    } else {
      /* شريط أزرار اللعب والتحكم الموحد والأنيق بخلفية شفافة بدون آلة حاسبة */
      this._updateControls();
      /* يد اللاعب البشري في الخانات الخمس التفاعلية */
      this._updateHand();
    }

    /* 6. [V18] الفرد الهندسي لأوراق الخصوم: ملء كامل المساحة بلا إخفاء */
    this._fitSeatLines();
  }

  /* [V18] فرد هندسي: كل صف خصوم يملأ عرضه بتراكب موحّد، وكل ورقة يبقى منها ≥ 30% ظاهراً.
     وتُكبَّر الأوراق حسب ارتفاع الصف المتاح (حسب مساحة الشاشة). */
  _fitSeatLines() {
    if (typeof document === 'undefined') return;
    const cardW = this._cardWpx();
    const seats = document.querySelectorAll('.rami-seat-node.seat-row');
    for (const seat of seats) {
      const line = seat.querySelector('.rami-seat-line.line-slots');
      if (!line) continue;
      /* 1) القياس العمودي: كبّر الورقة لملء ارتفاع الخانات (بعد خصم ارتفاع شريط HUD) */
      const hud = seat.querySelector('.rami-seat-hud');
      const seatH = seat.clientHeight;
      const hudH = hud ? hud.clientHeight : 0;
      const lineH = Math.max(4, seatH - hudH);
      const baseH = cardW * 1.48;
      let sc = (lineH > 4) ? Math.min(1.35, lineH / baseH) : 1;
      sc = Math.max(0.5, sc);
      line.style.setProperty('--seat-sc', sc.toFixed(3));
      /* 2) تراكب داخل كل خانة: يملأ عرض الخانة، بحد أدنى 25% وحد أقصى 70% تغطية */
      const slots = line.querySelectorAll('.rami-opp-slot');
      for (const slot of slots) {
        const cards = slot.querySelectorAll('.mini-back, .mini-meld-wrap');
        const N = cards.length;
        if (N <= 1) { slot.style.setProperty('--slot-ov', '0px'); continue; }
        const sample = cards[0].querySelector('.mini-back, .mini-meld') || cards[0];
        const w = sample.getBoundingClientRect().width || cardW;
        const avail = slot.clientWidth;
        let ov = (w * N - avail) / (N - 1);
        const maxOv = w * 0.7;
        if (ov > maxOv) ov = maxOv;
        if (ov < w * 0.25) ov = w * 0.25;
        if (ov < 0) ov = 0;
        slot.style.setProperty('--slot-ov', (-ov).toFixed(1) + 'px');
      }
    }
  }

    _updateControls() {
    const controls = document.getElementById('ramiActionDock');
    if (!controls || !this.game) return;

    const rm = this.game.roundManager;
    const curIdx = this.game.roundManager.currentPlayerIndex;
    const players = this.game.players;
    const humanPlayer = players[this.myPlayerId || 0];
    const isCurrent = (humanPlayer && humanPlayer.id === players[curIdx].id);
    const isDealer = (humanPlayer && humanPlayer.id === rm.dealerIndex);
    const dealerIcon = isDealer ? ' ♛' : '';
    const initials = (typeof ST !== 'undefined' && ST.user && ST.user.username) ? ST.user.username.slice(0, 2).toUpperCase() : '👤';

    const threshold = this.game.rules.openingThreshold;

    let html = '';

    // [V25] أقصى اليسار: زر افتتاح / إنزال الأوراق (أصفر)
    const isReady = (humanPlayer && humanPlayer.hasOpened);
    const openCls = isReady ? 'rbtn rbtn-open ready' : 'rbtn rbtn-open';
    const modeName = _ramiT(this.game.mode === 'talaj' ? 'rami.talaj' : 'rami.simple', this.game.mode === 'talaj' ? 'طالاج' : 'سامبل');
    const openTitle = isReady ? 'إنزال مجموعات جديدة' : ('إظهار الأوراق (' + modeName + ' ≥ ' + threshold + ')');
    html += '<button class="' + openCls + '" onclick="ramiOpenMelds()" title="' + openTitle + '">' +
      '<i class="fa-solid fa-lock-open"></i> ' + (_ramiT('rami.open') || 'افتتاح') +
    '</button>';

    // [V25] الوسط: المؤقت ثم الأيقونة ثم النقاط
    const activeHalo = isCurrent ? ' active-turn-halo' : '';
    const timerDigits = '<span class="rami-avatar-timer" id="ramiTimerDisplay">' + rm.turnSecondsRemaining + 's</span>';
    html += '<div class="rami-dock-center' + activeHalo + '">' +
      timerDigits +
      '<div class="rami-avatar-wrap" style="background:transparent;border:none;box-shadow:none;padding:0;">' +
        '<div class="rami-avatar-circle' + (isCurrent ? ' active' : '') + '">' + initials + '</div>' +
      '</div>' +
      '<span class="rami-node-score">' + (humanPlayer ? humanPlayer.totalScore : 0) + dealerIcon + '</span>' +
      this._isolateSlotHtml() +
    '</div>';

    // [V25] أقصى اليمين: زر إنهاء الشوط
    html += '<button class="rbtn rbtn-finish" onclick="ramiAction(\'finish\')" title="إنهاء الشوط">' +
      '<i class="fa-solid fa-trophy"></i> ' + (_ramiT('rami.finish') || 'إنهاء') +
    '</button>';

    // زر إلغاء التحديد إن وُجدت أوراق محددة
    if (this.selectedCards.size > 0) {
      html += '<button class="rbtn rbtn-clear" onclick="ramiClearSelection()" title="إلغاء التحديد"><i class="fa-solid fa-xmark"></i></button>';
    }

    // زر إلغاء اللعب التلقائي إن كان مفعلاً
    if (humanPlayer && humanPlayer.isAutoPlay) {
      html += '<button class="rbtn btn-cancel-auto" onclick="ramiToggleAutoPlay()"><i class="fa-solid fa-hand"></i> ' + (_ramiT('rami.cancelAuto') || 'إلغاء التلقائي') + '</button>';
    }

    controls.innerHTML = html;
  }

  /* خانة العزل (بجنب تاج التوزيع): تعرض الورقة المعزولة إن وُجدت، وإلا مكاناً فارغاً.
     تُقبل السحب والإفلات والنقر (تحديد ورقة مسبقاً ثم نقرها). الورقة المعزولة تُستثنى من
     المجموعات الخمس عند الافتتاح/الإنهاء وتُقلب كالورقة الأخيرة قانوناً. */
  _isolateSlotHtml() {
    const p = this.players()[0];
    if (!p || !p.hand) return '';
    const isoId = this.isolateCardId;
    if (isoId) {
      const card = p.hand.find(c => c.id === isoId);
      if (card) {
        return '<div class="rami-isolate-slot filled" id="ramiIsolateSlot" onclick="ramiClickIsolateSlot(event)" title="' + (_ramiT('rami.isolateClear', 'إرجاع الورقة المعزولة لليد')) + '">' +
          '<div class="rami-isolate-card">' + getRamiCardHTML(card, false) + '</div>' +
        '</div>';
      }
      this.isolateCardId = null;
    }
    return '<div class="rami-isolate-slot" id="ramiIsolateSlot" onclick="ramiClickIsolateSlot(event)" title="' + (_ramiT('rami.isolateSlot', 'ضع هنا الورقة المعزولة')) + '">' +
      '<span class="rami-isolate-ph">♛</span>' +
    '</div>';
  }

    /* معرفات الأوراق المنزلة (في مجموعات اللاعب أو مجموعات الطاولة) — تعرض بحلقة ذهبية */
  _meldedCardIds() {
    const ids = new Set();
    const p = this.players()[0];
    if (p && p.melds) {
      for (const m of p.melds) for (const c of m.cards) ids.add(c.id);
    }
    const rm = this.game && this.game.roundManager;
    if (rm && rm.tableMelds) {
      for (const m of rm.tableMelds) for (const c of m.cards) ids.add(c.id);
    }
    return ids;
  }

  /* الخانات اليدوية فقط (دون الأوراق المنزلة) — للمنطق الذي يحتاج يد اللاعب الحرة */
  _activeHandSlots() {
    const melded = this._meldedCardIds();
    return this.handSlots.map(s => s.filter(c => !melded.has(c.id)));
  }

  /* صاحب المجموعة المنزلة وفهرسها وفهرس الورقة داخلها (للتركيب/استبدال الجوكر مع موضع النقر) */
  _meldOwnerIndex(cardId) {
    const g = this.game;
    if (!g) return null;
    for (const p of g.players) {
      if (!p.melds) continue;
      for (let m = 0; m < p.melds.length; m++) {
        const ci = p.melds[m].cards.findIndex(c => c.id === cardId);
        if (ci !== -1) return { owner: p.id, idx: m, cardIdx: ci };
      }
    }
    return null;
  }

  _updateHand() {
    const slotsContainer = document.getElementById('rami5SlotsContainer');
    if (!slotsContainer || !this.game) return;

    const player = this.players()[0];
    if (!player || !player.hand) { slotsContainer.innerHTML = ''; return; }

    /* حراسة: الورقة المعزولة تبقى خارج الخانات الخمس؛ إن لم تعد في اليد يُلغى العزل */
    if (this.isolateCardId && !player.hand.find(c => c.id === this.isolateCardId)) {
      this.isolateCardId = null;
    }

    if (!this.handSlots || this.handSlots.length !== 5 || (this.handSlots.every(s => s.length === 0) && player.hand.length > 0)) {
      const handForSlots = this.isolateCardId ? player.hand.filter(c => c.id !== this.isolateCardId) : player.hand;
      this.handSlots = this._distributeCardsToSlots(handForSlots);
    } else {
      /* نحافظ على أوراق اليد والأوراق المنزلة معاً في الخانات؛
         الورقة المرمية تُحذف لأنها ليست في اليد ولا في المنزلات */
      const meldedIds = this._meldedCardIds();
      const keepIds = new Set(player.hand.map(c => c.id));
      meldedIds.forEach(id => keepIds.add(id));
      const placedIds = new Set();
      for (let s = 0; s < 5; s++) {
        this.handSlots[s] = this.handSlots[s].filter(c => keepIds.has(c.id));
        this.handSlots[s].forEach(c => placedIds.add(c.id));
      }
      for (const card of player.hand) {
        if (this.isolateCardId && card.id === this.isolateCardId) continue; /* المعزولة تبقى بخارج الخانات */
        if (!placedIds.has(card.id)) {
          // وضع الورقة الجديدة في الخانة ذات الأقل أوراقاً
          let minSlot = 0;
          for (let s = 1; s < 5; s++) {
            if (this.handSlots[s].length < this.handSlots[minSlot].length) minSlot = s;
          }
          this.handSlots[minSlot].push(card);
          placedIds.add(card.id);
        }
      }
    }

    const meldedIds = this._meldedCardIds();
    let slotsHtml = '';
    for (let s = 0; s < 5; s++) {
      const slotCards = this.handSlots[s];
      let cardsHtml = '';
      
      for (let i = 0; i < slotCards.length; i++) {
        const card = slotCards[i];
        const isMelded = meldedIds.has(card.id);
        const selected = !isMelded && this.selectedCards.has(card.id);
        const cls = (isMelded ? ' melded' : '') + (selected ? ' selected' : '');
        const selBadge = selected ? '<span class="card-sel-badge">✓</span>' : '';
        /* [V15/V28] الورقة المنزلة (حلقة ذهبية) قابلة للنقر كهدف للتركيب/الاستبدال، مع فهرسها
           لتمييز الورقة الصغيرة (يمين) عن الكبيرة (يسار) عند إدراج الجوكر */
        let meldOnClick = '';
        if (isMelded) {
          const mi = this._meldOwnerIndex(card.id);
          if (mi) meldOnClick = ' onclick="ramiAddCardToTableMeld(' + mi.owner + ',' + mi.idx + ',' + mi.cardIdx + ')" ';
        }

        cardsHtml += '<div class="rami-card-wrap' + cls + '" ' +
          'data-id="' + card.id + '" data-slot="' + s + '" ' +
          (isMelded ? 'data-melded="1" ' : '') +
          meldOnClick +
          'title="' + card.displayName + '" role="button" aria-label="' + card.displayName + '">' +
          getRamiCardHTML(card, false) +
          selBadge +
        '</div>';
      }

      slotsHtml += '<div class="rami-slot-box" ' +
        'data-slot="' + s + '" ' +
        'onclick="ramiClickSlot(' + s + ', event)" title="نقل الأوراق المحددة إلى هذه الخانة">' +
        '<div class="rami-slot-cards">' + cardsHtml + '</div>' +
      '</div>';
    }

    slotsContainer.innerHTML = slotsHtml;
    this._fitSlotOverlaps(slotsContainer);
  }

  players() {
    if (!this.game) return [];
    /* وضع الغرفة: لاعبي هو players[myPlayerId]؛ اللعب الفردي: 0 (الإنسان) */
    return [this.game.players[this.myPlayerId || 0]];
  }

  _cardImage(card) {
    if (!card) return 'assets/cards/back.webp';
    if (card.isJoker) return 'assets/cards/joker1.webp';
    const rankStr = RAMI_RANK_NAMES[card.rank - 1] || 'A';
    const suitKey = RAMI_SUIT_ASSET[card.suit] || 'spades';
    return 'assets/cards/' + rankStr + '-' + suitKey + '.webp';
  }

  _endRoundUI() {
    if (!this.game) return;

    for (const p of this.game.players) {
      if (p.isDisqualified) {
        p.totalScore = Math.max(p.totalScore, this.game.targetScore + 100);
        this.game.gamePhase = 'MATCH_END';
      }
    }

    /* [V18] نهاية الجولة تُحسم بالفائز الواحد فقط (منطق الإقصاء في _endRound) — لا بمجرد تجاوز لاعب للسقف */
    const isMatchOver = (this.game.gamePhase === 'MATCH_END');

    /* [Req6/Req3] عند انتهاء المباراة: المُنشئ يبدأ تصويت المباراة الجديدة (ويُعلن انتهاء الرهان) */
    /* [Resilience] أي مشارك يبدأ تصويت المباراة الجديدة (الخادم ينشئ مرة واحدة؛ يتحمّل غياب المُنشئ) */
    if (isMatchOver && this.multiplayer && typeof Rooms !== 'undefined' && Rooms.state && typeof AUTH !== 'undefined' && AUTH.user && Rooms.state.players.some(function (p) { return String(p.id) === String(AUTH.user.id) && !p.spectate; })) {
      try { Rooms.startRematch(); } catch (e) {}
    }

    const result = this.game.getMatchResult();

    /* [V29] تحويل أرباح الجولة إلى حساب الفائز (مرة واحدة فقط عند نهاية الجولة) */
    if (isMatchOver && !this.game._payoutDone) {
      this.game._payoutDone = true;
      const bet = window.RAMI_BET || 50;
      const pot = bet * this.game.playerCount;
      const winner = result.winners && result.winners.length ? result.winners[0] : null;
      if (winner && !winner.isBot) {
        if (typeof ST !== 'undefined' && typeof ST.gold === 'number') {
          ST.gold += pot;
          if (typeof wallet === 'function') { try { wallet(); } catch (e) {} }
          if (typeof save === 'function') { try { save(); } catch (e) {} }
        }
        _ramiToast('🏆 ربحت الجولة — تم إضافة ' + pot + ' 🪙 إلى حسابك!', 'ok');
      }
    }

    /* [V30] تسجيل الجولة المنتهية بشكل دائم في سجل رهانات اللعبة + سجل الحساب.
       نهاية الجولة قانوناً = نهاية المباراة (MATCH_END). عندئذٍ تُسجَّل مرة واحدة:
       - استدعاء SessionResume.onResolve() ينهي حالة «الجولة قيد التقدم».
       - recordRound يكتبها في السجل المحلي + يرسلها للخادم. */
    if (isMatchOver && !this.game._roundRecorded) {
      this.game._roundRecorded = true;
      const winner = result.winners && result.winners.length ? result.winners[0] : null;
      const humanWon = !!(winner && !winner.isBot);
      const bet = window.RAMI_BET || 50;
      const pot = bet * this.game.playerCount;
      try {
        window.GB = bet; /* ضبط قيمة الرهان لتُسجَّل بدقة في السجل */
        if (typeof recordRound === 'function') {
          recordRound(humanWon, humanWon ? pot : 0, 'رامي');
        }
      } catch (e) { /* تجاهل */ }
    }
    const titleText = isMatchOver ? ('🏆 ' + _ramiT('rami.matchEnd', 'نهاية الجولة (انتهت المباراة)')) : ('🏆 ' + _ramiT('rami.roundEnd', 'نهاية الشوط'));
    const subText = isMatchOver
      ? _ramiT('rami.res.overall', 'النتيجة الإجمالية للمباراة')
      : _ramiF('rami.res.roundOf', 'الشوط رقم {n} من الجولة', { n: this.game.roundManager.roundNumber });

    /* صيغة جمع سليمة لعدد الأوراق (مترجَمة لكل لغة) */
    const cardsPhrase = (n) => {
      if (n === 0) return _ramiT('rami.cards.0', 'بدون أوراق متبقية');
      if (n === 1) return _ramiT('rami.cards.1', 'ورقة واحدة متبقية');
      if (n === 2) return _ramiT('rami.cards.2', 'ورقتان متبقيتان');
      if (n >= 3 && n <= 10) return _ramiF('rami.cards.few', '{n} أوراق متبقية', { n: n });
      return _ramiF('rami.cards.many', '{n} ورقة متبقية', { n: n });
    };

    /* سطر تفصيلي موحّد لكل لاعب (عدد الأوراق × قيمتها + جزاءات = المجموع) */
    const detailLine = (p) => {
      const d = p.lastRoundDetail;
      if (!d) return '';
      const penTxt = (d.penalty > 0) ? _ramiF('rami.res.penSuffix', ' + جزاءات {n}', { n: d.penalty }) : '';
      if (d.kind === 'winner') {
        return d.penalty > 0
          ? _ramiF('rami.res.winPen', 'فاز بالشوط — 0 نقطة أوراق + جزاءات {pen} = {tot} نقطة', { pen: d.penalty, tot: d.total })
          : _ramiT('rami.res.winNoPen', 'فاز بالشوط — 0 نقطة (بدون أي جزاء)');
      }
      if (d.kind === 'unopened') {
        const base = this.game.rules.fullHandPenalty;
        if (d.doubled) return _ramiF('rami.res.unopenDouble', 'يد كاملة دون افتتاح — عقوبة {base}×2 = {val}{pen} = {tot} نقطة', { base: base, val: base * 2, pen: penTxt, tot: d.total });
        return _ramiF('rami.res.unopenSingle', 'يد كاملة دون افتتاح — عقوبة {base}{pen} = {tot} نقطة', { base: base, pen: penTxt, tot: d.total });
      }
      if (d.doubled) return _ramiF('rami.res.openDouble', '{cards} بقيمة {val}×2{pen} = {tot} نقطة', { cards: cardsPhrase(d.cardsCount), val: d.cardsValue, pen: penTxt, tot: d.total });
      return _ramiF('rami.res.openSingle', '{cards} بقيمة {val}{pen} = {tot} نقطة', { cards: cardsPhrase(d.cardsCount), val: d.cardsValue, pen: penTxt, tot: d.total });
    };

    const lastRec = (this.game.roundManager.roundHistory && this.game.roundManager.roundHistory.length)
      ? this.game.roundManager.roundHistory[this.game.roundManager.roundHistory.length - 1] : null;
    const doubledBadge = (lastRec && lastRec.doubled)
      ? ('<div class="spill ok" style="display:inline-block;margin-top:4px;">' + _ramiT('rami.res.doubled', '⚡ شوط مضاعف — إنهاء بجوكر حر معزول') + '</div>') : '';

    let html = '<div class="rami-round-end card" style="max-width:560px;margin:16px auto;padding:18px 14px;text-align:center;">' +
      '<div class="ctitle" style="font-size:1.2rem;color:var(--gold,#FFD23F);margin-bottom:4px;">' + titleText + '</div>' +
      '<div class="ctext" style="font-size:0.78rem;color:rgba(255,255,255,0.65);margin-bottom:14px;">' + subText + doubledBadge + '</div>';

    /* بطاقات اللاعبين: الرقم = نقاط الشوط (نفس رقم السجل) + سطر تفصيلي */
    html += '<div class="rami-scores-final" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">';
    for (const p of this.game.players) {
      const disqBadge = p.isDisqualified ? (' <span class="spill bad">' + _ramiT('rami.res.dq', 'خاسر (3 أدوار أوتوماتيكية)') + '</span>') : '';
      /* [V18] شارة الإقصاء لمن تجاوز سقف الجولة */
      const elimBadge = (p.isEliminated && !isMatchOver) ? (' <span class="spill bad">' + _ramiT('rami.res.eliminated', '🚫 مُقصى') + '</span>') : '';
      let marker = '';
      if (isMatchOver) {
        if (result.winners && result.winners.length > 0 && result.winners.some(w => w.id === p.id) && !p.isDisqualified) {
          marker = ' <span class="spill ok">' + _ramiT('rami.res.winner', '🏆 الفائز') + '</span>';
        }
      } else {
        const lastWinner = this.game.roundManager.lastWinner;
        if (lastWinner && p.id === lastWinner.id) marker = ' <span class="spill ok">' + _ramiT('rami.res.roundWinner', '🏆 فائز الشوط') + '</span>';
      }
      const roundVal = p.lastRoundTotal || 0;
      const detail = detailLine(p);
      const totalPart = isMatchOver ? (' · ' + _ramiF('rami.res.totalLbl', 'الإجمالي: {n} pts', { n: p.totalScore })) : '';
      html += '<div class="rami-player-score" style="display:flex;flex-direction:column;gap:4px;padding:10px 14px;background:rgba(255,255,255,0.04);border-radius:10px;border:1px solid rgba(255,255,255,0.08);text-align:start;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span><b>' + p.name + '</b>' + marker + disqBadge + elimBadge + '</span>' +
          '<span class="gold-text" style="font-family:Orbitron,monospace;font-weight:800;font-size:0.95rem;">pts ' + roundVal + '</span>' +
        '</div>' +
        '<div style="font-size:0.7rem;color:rgba(255,255,255,0.72);">' + detail + totalPart + '</div>' +
      '</div>';
    }
    html += '</div>';

    /* سجل النقاط والمخالفات: جدول منظّم باتجاه RTL + زر نسخ */
    if (this.game.roundManager.roundHistory && this.game.roundManager.roundHistory.length >= 1) {
      html += '<div class="rami-history-box" dir="rtl" style="margin-top:12px;padding:12px;background:rgba(0,0,0,0.35);border-radius:10px;border:1px solid rgba(245,197,24,0.25);text-align:start;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
          '<div style="font-size:0.76rem;font-weight:800;color:var(--gold,#FFD23F);">' + _ramiT('rami.res.historyTitle', '📊 سجل نقاط الأشواط والمخالفات:') + '</div>' +
          '<button class="rbtn" style="font-size:0.68rem;padding:3px 10px;" onclick="ramiCopyHistory()" title="' + _ramiT('rami.res.copyHistory', '📋 نسخ السجل') + '">' + _ramiT('rami.res.copyHistory', '📋 نسخ السجل') + '</button>' +
        '</div>' +
        '<div class="rami-hist-scroll">' +
          '<div class="rami-hist-table" dir="rtl" style="font-size:0.7rem;color:rgba(255,255,255,0.88);">' +
            '<div class="rami-hist-row rami-hist-head">' +
              '<span class="rami-hist-c-name">' + _ramiT('rami.res.hPlayer', 'اللاعب') + '</span>' +
              '<span class="rami-hist-c-pts">' + _ramiT('rami.res.hPts', 'نقاط الشوط') + '</span>' +
              '<span class="rami-hist-c-pen">' + _ramiT('rami.res.hPen', 'الجزاءات (السبب)') + '</span>' +
              '<span class="rami-hist-c-tot">' + _ramiT('rami.res.hTotal', 'الإجمالي') + '</span>' +
            '</div>';
      for (const rec of this.game.roundManager.roundHistory) {
        html += '<div class="rami-hist-round">' + _ramiF('rami.res.roundLine', 'شوط {n} — فاز {w}', { n: rec.roundNumber, w: rec.winnerName }) + '</div>';
        for (const ps of rec.playerScores) {
          let penTxt = '—';
          if (ps.pen > 0) {
            const agg = (typeof aggregatePenaltyText === 'function') ? aggregatePenaltyText(ps.penReasons) : ((ps.penReasons && ps.penReasons.length) ? ps.penReasons.join('؛ ') : '');
            penTxt = '+' + ps.pen + (agg ? (' — ' + agg) : '');
          }
          html += '<div class="rami-hist-row">' +
            '<span class="rami-hist-c-name">' + ps.name + '</span>' +
            '<span class="rami-hist-c-pts">' + ps.pts + ' pts</span>' +
            '<span class="rami-hist-c-pen">' + penTxt + '</span>' +
            '<span class="rami-hist-c-tot">' + (ps.total || 0) + '</span>' +
          '</div>';
        }
      }
      html += '</div></div></div>';
    }

    html += '<div class="rami-next-btn-zone">';
    if (isMatchOver) {
      if (this.multiplayer) {
        /* [Req3] لوحة تصويت المباراة الجديدة بدل الزر المباشر */
        html += this._rematchVoteHtml();
      } else {
        html += '<button class="big rami-start-btn" onclick="ramiReset()">🔄 ' + _ramiT('rami.playAgain', 'مباراة جديدة') + '</button>';
      }
    } else {
      /* [60ث] عدّاد تنازلي: يبدأ الشوط التالي تلقائياً عند بلوغ الصفر؛
         النقر اليدوي يلغي العدّاد. المالك وحده يُفعّل التقدم في الوضع الجماعي. */
      const clearAuto = "try{if(window._ramiAutoAdvTimer){clearInterval(window._ramiAutoAdvTimer);window._ramiAutoAdvTimer=null;}}catch(e){}";
      html += '<div id="ramiAutoAdvWrap" style="font-size:0.72rem;color:rgba(255,255,255,0.7);margin-bottom:8px;">' + _ramiF('rami.res.autoSoon', 'يلعب التالي تلقائياً بعد {n} ث', { n: '<span id="ramiAutoAdv">60</span>' }) + '</div>';
      html += '<button class="big rami-start-btn" onclick="' + clearAuto + 'ramiNextRound()">➡ ' + _ramiT('rami.nextRound', 'الشوط التالي') + '</button>';
    }
    html += '</div>';

    html += '</div>';
    if (this.container) this.container.innerHTML = html;

    /* تشغيل العدّاد التنازلي للشوط غير المنتهي للمباراة */
    if (!isMatchOver) this._startAutoAdvance();
  }

  /* [60ث] مؤقّت التقدم التلقائي بين الأشواط */
  _startAutoAdvance() {
    try { if (window._ramiAutoAdvTimer) { clearInterval(window._ramiAutoAdvTimer); window._ramiAutoAdvTimer = null; } } catch (e) {}
    let remaining = 60;
    const el = this.container ? this.container.querySelector('#ramiAutoAdv') : null;
    window._ramiAutoAdvTimer = setInterval(() => {
      remaining--;
      if (el) el.textContent = String(Math.max(0, remaining));
      if (remaining <= 0) {
        try { clearInterval(window._ramiAutoAdvTimer); } catch (e) {}
        window._ramiAutoAdvTimer = null;
        if (typeof ramiNextRound === 'function') ramiNextRound();
      }
    }, 1000);
  }

  /* [Req3] لوحة تصويت المباراة الجديدة (وضع جماعي، عند نهاية المباراة) */
  _rematchVoteHtml() {
    const rm = (typeof Rooms !== 'undefined' && Rooms.state) ? Rooms.state.rematch : null;
    const me = ramiMyUserId();
    if (!rm) {
      return '<div class="rami-rematch-box"><div class="rami-rematch-title">' + _ramiT('rami.rematchTitle', '🔁 مباراة جديدة؟') + '</div><div class="rami-rematch-voted">' + _ramiT('rami.rematchVoted', 'بانتظار بدء التصويت…') + '</div></div>';
    }
    if (rm.resolved && !rm.rematch) {
      return '<div class="rami-rematch-box"><div class="rami-rematch-title">' + _ramiT('rami.rematchNo', 'لا توجد موافقة كافية على مباراة جديدة') + '</div></div>';
    }
    if (rm.resolved && rm.rematch) {
      return '<div class="rami-rematch-box"><div class="rami-rematch-title">' + _ramiT('rami.rematchStarted', 'بدأت مباراة جديدة بالموافقين') + '</div></div>';
    }
    /* تصويت نشط: سرد المشاركين وحالاتهم */
    let rows = '';
    const parts = rm.participants || [];
    for (const pid of parts) {
      const v = rm.votes ? rm.votes[pid] : null;
      const name = (rm.names && rm.names[pid]) ? rm.names[pid] : ('#' + pid);
      const mark = (v === 'agree') ? '✅' : (v === 'refuse') ? '❌' : '⏳';
      rows += '<div class="rami-rematch-row"><span>' + name + '</span><span>' + mark + '</span></div>';
    }
    const myVote = rm.votes ? rm.votes[me] : null;
    const isParticipant = (parts.indexOf(me) !== -1);
    let actions = '';
    if (isParticipant && !myVote) {
      actions = '<button class="big rami-start-btn" onclick="Rooms.voteRematch(\'agree\')">✅ ' + _ramiT('rami.rematchAgree', 'موافقة') + '</button>'
              + '<button class="big rami-start-btn rami-ghost-btn" onclick="Rooms.voteRematch(\'refuse\')">❌ ' + _ramiT('rami.rematchRefuse', 'رفض') + '</button>';
    } else if (isParticipant && myVote) {
      actions = '<div class="rami-rematch-voted">' + _ramiT('rami.rematchVoted', 'تم تسجيل صوتك — بانتظار البقية') + '</div>';
    } else {
      actions = '<div class="rami-rematch-voted">' + _ramiT('rami.rematchSpectator', 'بانتظار تصويت اللاعبين') + '</div>';
    }
    const remain = rm.ts ? Math.max(0, 60 - Math.floor((Date.now() - rm.ts) / 1000)) : 60;
    this._startRematchTicker(rm.ts);
    return '<div class="rami-rematch-box">'
      + '<div class="rami-rematch-title">' + _ramiT('rami.rematchTitle', '🔁 مباراة جديدة؟') + '</div>'
      + '<div class="rami-rematch-tally">' + rows + '</div>'
      + '<div class="rami-rematch-actions">' + actions + '</div>'
      + '<div class="rami-rematch-timer">' + _ramiF('rami.rematchTimer', '⏱ {n}ث للقرار', { n: '<span id="ramiRematchTimerN">' + remain + '</span>' }) + '</div>'
      + '</div>';
  }

  /* [Req3] عدّاد تنازلي لصلاحية التصويت */
  _startRematchTicker(ts) {
    try { if (window._ramiRematchTi) { clearInterval(window._ramiRematchTi); window._ramiRematchTi = null; } } catch (e) {}
    if (!ts) return;
    const el = this.container ? this.container.querySelector('#ramiRematchTimerN') : null;
    window._ramiRematchTi = setInterval(() => {
      const remain = Math.max(0, 60 - Math.floor((Date.now() - ts) / 1000));
      if (el) el.textContent = String(remain);
      if (remain <= 0) { try { clearInterval(window._ramiRematchTi); } catch (e) {} window._ramiRematchTi = null; }
    }, 1000);
  }
}

/* تجميع نصوص الجزاء المتطابقة: «السبب ×4» بدل تكراره 4 مرات */
function aggregatePenaltyText(labels) {
  if (!labels || !labels.length) return '';
  const counts = {};
  const order = [];
  for (const l of labels) {
    const key = (l == null) ? '' : String(l);
    if (!(key in counts)) { counts[key] = 0; order.push(key); }
    counts[key]++;
  }
  return order.map(function (l) {
    return counts[l] > 1 ? (l + ' ×' + counts[l]) : l;
  }).join('؛ ');
}

/* ═══ [V16] ترتيب أوراق المتتالية تصاعدياً مع وضع الجوكرات في فجواتها/أطرافها ═══
   يستخدم عند العرض وعند الإدراج: الأوراق الطبيعية مرتبة، والجوكر يوضع في الفجوة
   الوحيدة أو الطرف الصحيح — لضمان «ترتيب صحيح بالنسبة للمتتاليات». */
function ramiOrderSequenceCards(cards, isWild) {
  if (!cards || !cards.length) return cards || [];
  const nats = cards.filter(c => !isWild(c));
  const jokers = cards.filter(c => isWild(c));
  if (!nats.length) return jokers.slice();
  /* الآس عالٍ (14) إذا وُجدت صورة K/Q في نفس المتتالية حتى يُقرأ Q-K-A صحيحاً */
  const aceHigh = nats.some(c => c.rank >= 12);
  const rankOf = c => (c.rank === 1 ? (aceHigh ? 14 : 1) : c.rank);
  /* [V21] ترتيب تصاعدي: الأصغر يميناً ثم الأكبر شمالاً */
  const sorted = nats.slice().sort((a, b) => rankOf(a) - rankOf(b));
  if (!jokers.length) return sorted;
  /* [V23] موضع كل جوكر يُحدَّد حسب موضعه الأصلي الذي وضعه اللاعب:
     - وسط الترتيب (طبيعية قبله وطبيعية بعده) → الرقم الناقص في الفجوة
     - ثالثاً بعد رقمين متتاليين (طرفه الكبير) → الورقة التالية الأكبر
     - في البداية (قبل كل الطبيعيات) → الورقة السابقة الأصغر */
  const items = nats.map(c => ({ card: c, val: rankOf(c) }));
  for (const jk of jokers) {
    const idx = cards.indexOf(jk);
    const before = cards.slice(0, idx).filter(c => !isWild(c));
    const after = cards.slice(idx + 1).filter(c => !isWild(c));
    let val;
    if (before.length && after.length) {
      /* وسط الترتيب: الرقم الناقص بين آخر طبيعية قبله وأول طبيعية بعده */
      val = rankOf(before[before.length - 1]) + 1;
    } else if (before.length) {
      /* طرف كبير: الورقة التالية الأكبر بعد آخر طبيعية */
      val = rankOf(before[before.length - 1]) + 1;
    } else {
      /* طرف صغير: الورقة السابقة الأصغر قبل أول طبيعية */
      val = rankOf(after[0]) - 1;
    }
    items.push({ card: jk, val: val });
  }
  /* ترتيب تصاعدي (الأصغر يميناً)؛ عند التساوي تُوضع الطبيعية قبل الجوكر */
  items.sort((a, b) => (a.val - b.val) || ((isWild(a.card) ? 1 : 0) - (isWild(b.card) ? 1 : 0)));
  return items.map(it => it.card);
}

/* تحديد المواضع الممكنة لجوكر في متتالية (لإبلاغ اللاعب بالمكان) */
function ramiJokerSlotDescription(meld, rules) {
  const isWild = c => rules.isWildCard(c);
  const nats = meld.cards.filter(c => !isWild(c));
  const aceHigh = nats.some(c => c.rank >= 12);
  const rankOf = c => (c.rank === 1 ? (aceHigh ? 14 : 1) : c.rank);
  const sorted = nats.slice().sort((a, b) => rankOf(a) - rankOf(b));
  for (let i = 1; i < sorted.length; i++) {
    if (rankOf(sorted[i]) - rankOf(sorted[i - 1]) === 2) {
      return 'يسدّ الفجوة بين ' + sorted[i - 1].displayName + ' و' + sorted[i].displayName;
    }
  }
  const low = sorted[0], high = sorted[sorted.length - 1];
  return 'يمدّد المتتالية (بعد ' + high.displayName + ' أو قبل ' + low.displayName + ')';
}

/* ═══ آلة رسائل الحالة: حدث واحد = رسالة واحدة صحيحة حسب مرحلة الدور ═══
   الترتيب: سحب ← تنظيم/إنزال ← رمي؛ تمنع تكديس الرسائل المكررة أو المتناقضة */
function ramiStateInstruction(game) {
  if (!game) return '';
  const rm = game.roundManager;
  if (!rm) return '';
  if (game.gamePhase !== 'PLAYING') {
    return game.gamePhase === 'ROUND_END' ? 'انتهى الشوط — اضغط «الشوط التالي»' : 'انتهت المباراة';
  }
  const p = rm.getCurrentPlayer();
  if (!p) return '';
  if (p.isBot) return 'دور الخصم — انتظر';
  if (rm.turnPhase === 'WAITING_DRAW') {
    return 'اسحب ورقة واحدة: من المجرف أو خذ ورقة المرموق (انقر مرتين)';
  }
  if (p.drawnDiscardCard || p.tookLaTour) {
    return 'أنزِل ورقة المرموق المسحوبة في مجموعة أو افتتح بها، وإلا فتُسترجع مع جزاء';
  }
  return 'نظّم أوراقك ثم ارمِ ورقة واحدة للتخلص';
}

/* هل تناسب الورقة هذه المجموعة للتركيب (Lay-off)؟
   متتالية: نفس الرمز وامتداد تسلسلي (±1 مع دعم الآس 1/14).
   متماثلة: نفس القيمة برمز غير مكرر وقبل امتلاء المجموعة (< 4).
   لا جوكر ولا ورقة مرموق مسحوبة تُستخدم كتطابق وهمي. */
function cardFitsMeld(card, meld, rules) {
  if (!card || !meld || !meld.cards || !meld.cards.length) return false;
  if (!rules || typeof rules.isValidSet !== 'function') return false;
  /* بعد الافتتاح يُعفى اللاعب من شروطه ويصبح حراً في إدراج أي ورقة (جوكر/مرموق/توزيع/من يده)
     في أي مجموعة منزلة ظاهرة، متى أبقت المجموعة صالحة قانوناً.
     الجوكر يأخذ محلّ الورقة المعنية (مثال Q في 9-10-J-JOKER) فيمكن إضافة K بعده. */
  var temp = meld.cards.concat([card]);
  if (meld.type === MELD_TYPE.SET) return rules.isValidSet(temp, true);
  if (meld.type === MELD_TYPE.SEQUENCE) return rules.isValidSequence(temp, true);
  return rules.isValidMeld(temp, true);
}

/* نسخ سجل الأشواط والمخالفات إلى الحافظة */
function ramiCopyHistory() {
  const game = RAMI_STATE || (typeof window !== 'undefined' ? window.RAMI_STATE : null);
  if (!game || !game.roundManager || !game.roundManager.roundHistory) return;
  const lines = [];
  lines.push('سجل أشواط الرامي المغربي');
  for (const rec of game.roundManager.roundHistory) {
    lines.push('شوط ' + rec.roundNumber + ' — فاز ' + rec.winnerName);
    for (const ps of rec.playerScores) {
      let pen = '—';
      if (ps.pen > 0) {
        const agg = (typeof aggregatePenaltyText === 'function') ? aggregatePenaltyText(ps.penReasons) : ((ps.penReasons && ps.penReasons.length) ? ps.penReasons.join('؛ ') : '');
        pen = '+' + ps.pen + (agg ? (' (' + agg + ')') : '');
      }
      lines.push('  ' + ps.name + ': ' + ps.pts + ' pts' + (ps.pen > 0 ? ' · جزاءات ' + pen : '') + ' · الإجمالي ' + (ps.total || 0));
    }
  }
  const text = lines.join('\n');
  const done = () => { if (typeof toast === 'function') toast('📋 تم نسخ السجل', 'ok'); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text); done(); });
  } else {
    fallbackCopy(text);
    done();
  }
}

function fallbackCopy(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch (e) {}
}

/* ═══════════ Actions and Event Handlers ═══════════ */
function ramiStartGame() {
  const playersEl = document.getElementById('ramiPlayers');
  const targetEl = document.getElementById('ramiTarget');
  const timerEl = document.getElementById('ramiTimerSelect');
  const betInp = document.getElementById('ramiBetInput');

  const mode = window.RAMI_SETUP_MODE || 'talaj';
  const players = playersEl ? parseInt(playersEl.value, 10) : 4;
  const targetVal = targetEl ? targetEl.value : '501';
  const isSingle = (targetVal === 'single');
  const target = isSingle ? 999999 : (parseInt(targetVal, 10) || (mode === 'talaj' ? 501 : 301));
  const timerSec = timerEl ? (parseInt(timerEl.value, 10) || 90) : 90;

  /* الرهان من خانة الإدخال اليدوي (ضمن الرصيد المتاح) */
  let currentBet = 50;
  if (betInp) {
    let v = parseInt(betInp.value, 10);
    if (isNaN(v) || v < 10) v = 10;
    const maxGold = (typeof ST !== 'undefined' && typeof ST.gold === 'number') ? ST.gold : v;
    currentBet = Math.min(v, maxGold);
    betInp.value = currentBet;
  } else {
    currentBet = window.RAMI_BET || 50;
  }
  RAMI_BET = currentBet;
  window.RAMI_BET = currentBet;

  if (typeof ST !== 'undefined' && typeof ST.gold === 'number') {
    if (ST.gold < currentBet) {
      _ramiToast((_ramiT('ts.noc') || 'رصيدك غير كافٍ للرهان') + ' (' + (typeof fmt === 'function' ? fmt(currentBet) : currentBet) + ' 🪙)', 'err');
      if (typeof SND !== 'undefined' && SND.lose) SND.lose();
      return;
    }
    ST.gold -= currentBet;
    if (typeof wallet === 'function') wallet();
    if (typeof save === 'function') save();
  }

  const seed = Math.floor(Math.random() * 0xFFFFFFFF);
  RAMI_STATE = new RamiGame(mode, players, players - 1, seed, timerSec);
  RAMI_STATE.rules.turnSeconds = timerSec;
  RAMI_STATE.roundManager.turnSecondsRemaining = timerSec;
  RAMI_STATE.isSingleRound = isSingle;
  RAMI_STATE.displayTarget = isSingle ? _ramiT('rami.singleShort', 'ش و') : target;
  RAMI_STATE.startMatch(target);
  window.RAMI_STATE = RAMI_STATE;

  if (window.RamiAdapter) {
    window.RamiAdapter.game = RAMI_STATE;
    window.RamiAdapter.selectedCards.clear();
    window.RamiAdapter.handSlots = [[], [], [], [], []];
    window.RamiAdapter._renderGame();
    window.RamiAdapter.playIntroAndStart();
  }
}

function ramiAction(type, cardId) {
  if (ramiIsSpectator()) return;
  const game = RAMI_STATE || (typeof window !== 'undefined' ? window.RAMI_STATE : null);
  if (!game || checkRamiBusy()) return;
  const player = game.roundManager.getCurrentPlayer();
  if (!player || player.isBot) return;

  const adapter = (typeof window !== 'undefined' && (window.RamiAdapter || window.RAMI_ADAPTER)) ? (window.RamiAdapter || window.RAMI_ADAPTER) : null;
  if (typeof game.normalizeTurnPhase === 'function') game.normalizeTurnPhase();
  let move;
  if (type === 'discard') {
    if (game.roundManager.turnPhase === 'WAITING_DRAW' && player.hand.length < game.rules.playHandSize) {
      _ramiToast('يجب سحب ورقة أولاً من المجرف أو المرموق قبل رمي ورقة التخلص', 'warn');
      return;
    }
    let targetId = (cardId !== undefined && cardId !== null) ? cardId : null;
    if (targetId === null && adapter && adapter.selectedCards && adapter.selectedCards.size > 0) {
      targetId = Array.from(adapter.selectedCards)[0];
    }
    if (targetId === null && player.hand.length > 0) {
      _ramiToast(_ramiT('rami.chooseDiscard') || 'حدد الورقة التي تريد رميها أولاً بالنقر عليها', 'warn');
      return;
    }
    move = { type: 'discard', playerId: player.id, cardId: targetId };
  } else {
    move = { type: type, playerId: player.id };
    if (type === 'finish' && adapter && adapter.isolateCardId) move.isolateCardId = adapter.isolateCardId;
  }

  if (type === 'draw_deck') {
    if (typeof SND !== 'undefined' && SND.spin) SND.spin();
  } else if (type === 'draw_discard') {
    if (typeof SND !== 'undefined' && SND.card) SND.card();
  }

  setRamiBusy(true);
  setTimeout(() => {
    const activeGame = RAMI_STATE || (typeof window !== 'undefined' ? window.RAMI_STATE : null);
    if (!activeGame) { setRamiBusy(false); return; }
    const result = activeGame.executeMove(move);
    setRamiBusy(false);

    /* بثّ الحركة في وضع الغرفة (النجاح أو الجزاء الحتمي يتطابق عند الجميع) */
    if (adapter && adapter.multiplayer && (result.success || result.penaltyApplied)) {
      if (type === 'discard') adapter._netEmit('discard', { playerId: player.id, cardId: move.cardId });
      else if (type === 'draw_deck') adapter._netEmit('draw', { drawType: 'draw_deck', playerId: player.id });
      else if (type === 'draw_discard') adapter._netEmit('draw', { drawType: 'draw_discard', playerId: player.id });
      else if (type === 'finish') adapter._netEmit('finish', { playerId: player.id, isolateCardId: (move.isolateCardId || null) });
    }

    if (!result.success) {
      _ramiToast(result.error || 'خطأ في الحركة', 'err');
      if (result.penaltyApplied) {
        if (adapter) {
          adapter.selectedCards.clear();
          adapter._processTurn();
        }
      }
      return;
    }

    if (type === 'finish' || result.finished || activeGame.gamePhase === 'ROUND_END' || player.hand.length === 0) {
      if (adapter) adapter._endRoundUI();
      return;
    }

    if (type === 'discard') {
      if (adapter) adapter.selectedCards.clear();
      if (typeof SND !== 'undefined' && SND.card) SND.card();
      if (activeGame.gamePhase === 'ROUND_END' || player.hand.length === 0) {
        if (adapter) adapter._endRoundUI();
      } else {
        if (adapter) adapter._processTurn();
      }
    } else {
      if (activeGame.gamePhase === 'ROUND_END' || player.hand.length === 0) {
        if (adapter) adapter._endRoundUI();
      } else {
        if (adapter) adapter._updateUI();
      }
    }
  }, 180);
}

function ramiOpenMelds() {
  if (ramiIsSpectator()) return;
  const game = RAMI_STATE || (typeof window !== 'undefined' ? window.RAMI_STATE : null);
  if (!game || checkRamiBusy()) return;
  const player = game.roundManager.getCurrentPlayer();
  if (!player || player.isBot) return;

  const adapter = (typeof window !== 'undefined' && (window.RamiAdapter || window.RAMI_ADAPTER)) ? (window.RamiAdapter || window.RAMI_ADAPTER) : null;
  if (!adapter) return;

  let cardIds = [];
  if (adapter.selectedCards.size >= 3) {
    cardIds = Array.from(adapter.selectedCards);
  } else if (adapter.handSlots) {
    /* الخانات اليدوية فقط (باستثناء الأوراق المنزلة) */
    const activeSlots = (typeof adapter._activeHandSlots === 'function') ? adapter._activeHandSlots() : adapter.handSlots;
    for (let s = 0; s < 5; s++) {
      const sc = activeSlots[s];
      if (sc && sc.length >= 3) {
        if (game.rules.isValidSet(sc, true) || game.rules.isValidSequence(sc, true)) {
          sc.forEach(c => cardIds.push(c.id));
        } else {
          /* [V29] إن لم تكن الخانة كلها مجموعة صالحة، ابحث عن مجموعة صالحة ضمنها */
          const found = partitionSelectedCards(sc, game.rules);
          for (const fm of found) fm.cards.forEach(c => cardIds.push(c.id));
        }
      }
    }
    /* [V29] التقسيم التلقائي لكامل اليد للافتتاح الأولي فقط — لا للاعب المفتوح */
    if (cardIds.length === 0 && !player.hasOpened) {
      cardIds = player.hand.map(c => c.id);
    }
  }

  setRamiBusy(true);
  setTimeout(() => {
    const activeGame = RAMI_STATE || (typeof window !== 'undefined' ? window.RAMI_STATE : null);
    if (!activeGame) { setRamiBusy(false); return; }
    const move = { type: 'open', playerId: player.id, cardIds: cardIds };
    const result = activeGame.executeMove(move);
    setRamiBusy(false);
    if (result.success) {
      adapter.selectedCards.clear();
      if (adapter.multiplayer) adapter._netEmit('open', { playerId: player.id, cardIds: cardIds });
      if (typeof SND !== 'undefined' && SND.win) SND.win();
      _ramiToast('🎉 ' + (_ramiT('rami.openedSuccess') || 'تم إنزال الأوراق والافتتاح بنجاح في الطاولة!'), 'ok');
      if (activeGame.gamePhase === 'ROUND_END') {
        adapter._endRoundUI();
      } else {
        adapter._updateUI();
      }
    } else {
      if (result.penaltyApplied) {
        adapter.selectedCards.clear();
        if (typeof SND !== 'undefined' && SND.lose) SND.lose();
        _ramiToast('⚠️ ' + result.error, 'err');
        adapter._processTurn();
      } else {
        _ramiToast(result.error || 'لا يمكن الافتتاح بهذه الأوراق', 'warn');
      }
    }
  }, 180);
}

function ramiNextRound() {
  /* إيقاف عدّاد التقدم التلقائي فور المحاولة اليدوية/التلقائية للانتقال */
  try { if (window._ramiAutoAdvTimer) { clearInterval(window._ramiAutoAdvTimer); window._ramiAutoAdvTimer = null; } } catch (e) {}
  var ad = window.RamiAdapter || window.RAMI_ADAPTER;
  var mp = !!(ad && ad.multiplayer);
  if (!RAMI_STATE) return;

  /* [Resilience] تقدّم ديمقراطي: أي لاعب يبني الشوط التالي محلياً ويبثّ fromRound.
     الخادم يُلغّم التكرار، والآخرون يطبّقونه مع حارس fromRound (يتجاوزون إن سبقهم غيرهم). */
  var fromRound = (RAMI_STATE.roundManager) ? RAMI_STATE.roundManager.roundNumber : 0;
  RAMI_STATE._payoutDone = false;
  RAMI_STATE._roundRecorded = false;
  RAMI_STATE.nextRound();
  if (mp) {
    ad._netEmit('nextRound', { fromRound: fromRound, dedup: 'nextround-' + fromRound });
    ad._renderGame();
    ad._processTurn();
  } else if (ad) {
    ad._renderGame();
    ad.playIntroAndStart();
  }
}

function ramiReset() {
  if (window.RamiAdapter) {
    window.RamiAdapter._renderSetup();
  }
}

function ramiSelectCard(cardId) {
  if (ramiIsSpectator()) return;
  const adapter = window.RamiAdapter || window.RAMI_ADAPTER;
  if (!adapter) return;
  /* الأوراق المنزلة (بحلقة ذهبية) لا تُحدَّد ولا تُحرَّك */
  if (adapter._meldedCardIds && adapter._meldedCardIds().has(cardId)) return;
  
  if (adapter.selectedCards.has(cardId)) {
    adapter.selectedCards.delete(cardId);
  } else {
    adapter.selectedCards.add(cardId);
  }
  if (typeof SND !== 'undefined' && SND.click) SND.click();
  adapter._updateHand();
  adapter._updateControls();
}

function ramiClearSelection() {
  const adapter = window.RamiAdapter || window.RAMI_ADAPTER;
  if (!adapter) return;
  adapter.selectedCards.clear();
  adapter._updateHand();
  adapter._updateControls();
  if (typeof SND !== 'undefined' && SND.click) SND.click();
}

/* ═══════════ سحب وإفلات الأوراق (Pointer Events) — يعمل باللمس والفأرة بسلاسة ═══════════ */
var _ramiDrag = null;
var _lastPileTap = null;
var _justDragged = false;

function ramiBindPointerEvents() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || window.__ramiPointerBound) return;
  window.__ramiPointerBound = true;

  document.addEventListener('pointerdown', ramiHandPointerDown, { passive: true });
  document.addEventListener('pointerdown', ramiPilePointerDown, { passive: true });

  document.addEventListener('pointermove', function (e) {
    if (!_ramiDrag) return;
    const d = _ramiDrag;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && (dx * dx + dy * dy) < 64) return; // عتبة 8px لتفريق النقرة عن السحب

    if (!d.moved) {
      d.moved = true;
      const adapter = window.RamiAdapter || window.RAMI_ADAPTER;
      let cardObj = null;
      if (adapter && adapter.handSlots) {
        for (let s = 0; s < 5; s++) {
          const found = adapter.handSlots[s].find(c => c.id === d.cardId);
          if (found) { cardObj = found; break; }
        }
      }
      if (!cardObj) { _ramiDrag = null; return; }

      const ghost = document.createElement('div');
      ghost.className = 'rami-drag-ghost';
      ghost.innerHTML = getRamiCardHTML(cardObj, false);
      document.body.appendChild(ghost);
      d.ghost = ghost;
      document.body.classList.add('rami-dragging');

      const dz = document.getElementById('ramiDiscardDropZone');
      if (dz) dz.classList.add('active');
    }

    if (d.ghost) {
      d.ghost.style.left = e.clientX + 'px';
      d.ghost.style.top = e.clientY + 'px';
    }

    const slot = ramiSlotAtPoint(e.clientX, e.clientY);
    document.querySelectorAll('.rami-slot-box').forEach(function (el, idx) {
      el.classList.toggle('drag-hover', idx === slot);
    });
    var _isoHover = document.getElementById('ramiIsolateSlot');
    if (_isoHover) _isoHover.classList.toggle('drag-hover', ramiPointInIsolateZone(e.clientX, e.clientY));
    if (e.cancelable) e.preventDefault();
  }, { passive: false });

  document.addEventListener('pointerup', function (e) {
    if (!_ramiDrag) return;
    const d = _ramiDrag;
    const adapter = window.RamiAdapter || window.RAMI_ADAPTER;

    if (d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
    document.body.classList.remove('rami-dragging');
    const dz = document.getElementById('ramiDiscardDropZone');
    if (dz) dz.classList.remove('active');
    document.querySelectorAll('.rami-slot-box').forEach(function (el) { el.classList.remove('drag-hover'); });
    var _isoCl = document.getElementById('ramiIsolateSlot'); if (_isoCl) _isoCl.classList.remove('drag-hover');
    _ramiDrag = null;

    if (!d.moved) {
      // نقرة بسيطة → تحديد / إلغاء تحديد الورقة
      ramiSelectCard(d.cardId);
      return;
    }

    _justDragged = true;
    setTimeout(function () { _justDragged = false; }, 160);

    if (!adapter || !adapter.game) return;

    // الإفلات في الثلث الأوسط للطاولة → رمي الورقة
    if (ramiPointInDiscardZone(e.clientX, e.clientY)) {
      if (typeof adapter.game.normalizeTurnPhase === 'function') adapter.game.normalizeTurnPhase();
      if (adapter.game.roundManager.turnPhase === 'WAITING_DISCARD') {
        ramiAction('discard', d.cardId);
      } else {
        _ramiToast(_ramiT('rami.mustDrawFirst') || 'اسحب ورقة أولاً من المجرف أو المرموق قبل الرمي', 'warn');
        adapter._updateHand();
      }
      return;
    }

    // الإفلات في خانة العزل ♛ → عزل الورقة الـ15 خارج المجموعات
    if (ramiPointInIsolateZone(e.clientX, e.clientY)) {
      ramiIsolateCard(d.cardId);
      return;
    }

    const slot = ramiSlotAtPoint(e.clientX, e.clientY);
    if (slot >= 0) {
      ramiMoveCardToSlot(d.cardId, slot);
    } else {
      adapter._updateHand(); // إرجاع الورقة لمكانها
    }
  }, { passive: false });

  document.addEventListener('pointercancel', function () {
    if (!_ramiDrag) return;
    const d = _ramiDrag;
    if (d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
    document.body.classList.remove('rami-dragging');
    const dz = document.getElementById('ramiDiscardDropZone');
    if (dz) dz.classList.remove('active');
    document.querySelectorAll('.rami-slot-box').forEach(function (el) { el.classList.remove('drag-hover'); });
    var _isoCl = document.getElementById('ramiIsolateSlot'); if (_isoCl) _isoCl.classList.remove('drag-hover');
    _ramiDrag = null;
    const adapter = window.RamiAdapter || window.RAMI_ADAPTER;
    if (adapter) adapter._updateHand();
  });
}

function ramiHandPointerDown(e) {
  if (ramiIsSpectator()) return;
  const adapter = window.RamiAdapter || window.RAMI_ADAPTER;
  if (!adapter || !adapter.game) return;
  if (checkRamiBusy()) return;
  const curP = adapter.game.roundManager.getCurrentPlayer();
  if (!curP || curP.isBot) return;
  const wrap = (e.target && e.target.closest) ? e.target.closest('.rami-card-wrap[data-id]') : null;
  if (!wrap) return;
  if (wrap.hasAttribute('data-melded')) return; /* الأوراق المنزلة غير قابلة للسحب/التحديد */
  const cardId = parseInt(wrap.getAttribute('data-id'), 10);
  if (isNaN(cardId)) return;
  /* setPointerCapture: يضمن استمرار تدفق أحداث المؤشر (ماوس/لمس) للعنصر حتى خارج حدوده */
  try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
  _ramiDrag = { cardId: cardId, startX: e.clientX, startY: e.clientY, moved: false, ghost: null, el: wrap, pointerId: e.pointerId };
}

function ramiPilePointerDown(e) {
  if (ramiIsSpectator()) return;
  const adapter = window.RamiAdapter || window.RAMI_ADAPTER;
  if (!adapter || !adapter.game) return;
  if (checkRamiBusy()) return;
  const curP = adapter.game.roundManager.getCurrentPlayer();
  if (!curP || curP.isBot) return;
  const el = (e.target && e.target.closest) ? e.target.closest('[data-ramidraw]') : null;
  if (!el) return;
  const kind = el.getAttribute('data-ramidraw');
  const now = Date.now();
  if (_lastPileTap && _lastPileTap.el === el && (now - _lastPileTap.t) < 420) {
    _lastPileTap = null;
    ramiAction(kind === 'deck' ? 'draw_deck' : 'draw_discard');
    return;
  }
  _lastPileTap = { el: el, t: now };
  /* رسالة توجيه واحدة فقط في اللحظة نفسها: إن كان سطر الإرشاد ظاهراً لا نعرض توستاً إضافياً */
  const hintEl = document.getElementById('ramiHintLine');
  const hintVisible = hintEl && !hintEl.hidden;
  if (!hintVisible) {
    if (adapter.game.roundManager.turnPhase === 'WAITING_DRAW') {
      _ramiToast((kind === 'deck' ? '🂠 اضغط مرة ثانية للسحب من المجرف' : '🃏 اضغط مرة ثانية لأخذ ' + (adapter.game.roundManager.laTourCard ? 'ورقة لا تور' : 'المرموق')), 'info');
    } else {
      _ramiToast(_ramiT('rami.mustDrawFirst') || 'يجب السحب أولاً قبل الرمي', 'info');
    }
  }
}

/* ═══ خانة العزل ♛ (بجنب تاج التوزيع): عزل ورقة واحدة (الورقة الـ15) خارج المجموعات
   الخمس لتفعيل الافتتاح/الإنهاء الصحيح. تُقبل بالسحب والإفلات فيها أو بتحديد ورقة بالنقر
   ثم النقر على الخانة. النقر على الخانة المعبأة يُرجع الورقة لليد. ═══ */
function ramiPointInIsolateZone(x, y) {
  var el = document.getElementById('ramiIsolateSlot');
  if (!el) return false;
  var r = el.getBoundingClientRect();
  return (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
}

function ramiIsolateCard(cardId) {
  if (ramiIsSpectator()) return;
  var adapter = window.RamiAdapter || window.RAMI_ADAPTER;
  if (!adapter || !adapter.game) return;
  /* الورقة المنزلة (بحلقة ذهبية) لا تُعزل */
  if (adapter._meldedCardIds && adapter._meldedCardIds().has(cardId)) {
    adapter._updateHand();
    _ramiToast('لا يمكن عزل ورقة منزلة في المجموعات', 'warn');
    return;
  }
  /* يمكن عزل ورقة واحدة فقط في آنٍ واحد */
  if (adapter.isolateCardId && adapter.isolateCardId !== cardId) {
    _ramiToast('يمكن عزل ورقة واحدة فقط — أعد الورقة المعزولة الحالية لليد أولاً بالنقر على الخانة', 'warn');
    adapter._updateHand();
    return;
  }
  adapter.isolateCardId = cardId;
  /* إخراج الورقة من الخانات الخمس حتى لا تظهر مكررة (تُعرض في خانة العزل فقط) */
  if (adapter.handSlots) {
    for (var s = 0; s < 5; s++) {
      adapter.handSlots[s] = adapter.handSlots[s].filter(function (c) { return c.id !== cardId; });
    }
  }
  adapter.selectedCards.clear();
  adapter._updateHand();
  adapter._updateControls();
  if (typeof SND !== 'undefined' && SND.card) SND.card();
  _ramiToast(_ramiT('rami.isolateDone', 'تم عزل الورقة — ستُقلب كالورقة الأخيرة عند الإنهاء'), 'ok');
}

function ramiClickIsolateSlot(event) {
  if (event) { try { event.stopPropagation(); } catch (e) {} }
  var adapter = window.RamiAdapter || window.RAMI_ADAPTER;
  if (!adapter) return;
  /* نقر مع ورقة محددة مسبقاً ⇒ عزلها */
  if (adapter.selectedCards && adapter.selectedCards.size > 0) {
    var id = Array.from(adapter.selectedCards)[0];
    ramiIsolateCard(id);
    return;
  }
  /* الخانة معبأة ⇒ إرجاع الورقة المعزولة لليد */
  if (adapter.isolateCardId) {
    adapter.isolateCardId = null;
    adapter._updateHand();
    adapter._updateControls();
    if (typeof SND !== 'undefined' && SND.click) SND.click();
  } else {
    _ramiToast(_ramiT('rami.isolateSlot', 'اسحب ورقة وأفلتها هنا لعزلها، أو حدّد ورقة بالنقر ثم انقر هنا'), 'info');
  }
}

function ramiPointInDiscardZone(x, y) {
  const dz = document.getElementById('ramiDiscardDropZone');
  if (!dz) return false;
  const r = dz.getBoundingClientRect();
  return (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
}

function ramiSlotAtPoint(x, y) {
  const slots = document.querySelectorAll('.rami-slot-box');
  for (let i = 0; i < slots.length; i++) {
    const r = slots[i].getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
  }
  return -1;
}

/* [V28] ترتيب تلقائي للمتتالية في خانة: بمجرد وضع الأوراق (سحب/إفلات) تُرتَّب
   الأرقام من الأصغر للأكبر (يمين←يسار) والجوكر يوضع في موضع الرقم الناقص أو طرفه. */
function ramiAutoSortSlot(adapter, slotIdx) {
  if (!adapter || !adapter.handSlots || !adapter.game) return;
  const cards = adapter.handSlots[slotIdx];
  if (!cards || cards.length < 3) return;
  const rules = adapter.game.rules;
  if (rules.isValidSequence(cards, true)) {
    adapter.handSlots[slotIdx] = ramiOrderSequenceCards(cards.slice(), c => rules.isWildCard(c));
  }
}

function ramiMoveCardToSlot(cardId, targetSlotIdx) {
  const adapter = window.RamiAdapter || window.RAMI_ADAPTER;
  if (!adapter || !adapter.handSlots) return;
  let cardObj = null;
  for (let s = 0; s < 5; s++) {
    const idx = adapter.handSlots[s].findIndex(c => c.id === cardId);
    if (idx !== -1) {
      cardObj = adapter.handSlots[s].splice(idx, 1)[0];
      break;
    }
  }
  if (cardObj && targetSlotIdx >= 0 && targetSlotIdx < 5) {
    adapter.handSlots[targetSlotIdx].push(cardObj);
    ramiAutoSortSlot(adapter, targetSlotIdx);
    adapter._updateHand();
    if (typeof SND !== 'undefined' && SND.card) SND.card();
  }
}

function ramiClickSlot(slotIdx, event) {
  if (ramiIsSpectator()) return;
  if (_justDragged) return;
  if (event && event.target && event.target.closest && event.target.closest('.rami-card-wrap')) return;
  const adapter = window.RamiAdapter || window.RAMI_ADAPTER;
  if (!adapter || !adapter.selectedCards || adapter.selectedCards.size === 0) return;

  const selectedIds = Array.from(adapter.selectedCards);
  for (const cardId of selectedIds) {
    let cardObj = null;
    for (let s = 0; s < 5; s++) {
      const idx = adapter.handSlots[s].findIndex(c => c.id === cardId);
      if (idx !== -1) {
        cardObj = adapter.handSlots[s].splice(idx, 1)[0];
        break;
      }
    }
    if (cardObj && slotIdx >= 0 && slotIdx < 5) {
      adapter.handSlots[slotIdx].push(cardObj);
    }
  }

  ramiAutoSortSlot(adapter, slotIdx);
  adapter.selectedCards.clear();
  adapter._updateHand();
  adapter._updateControls();
  if (typeof SND !== 'undefined' && SND.card) SND.card();
}

function ramiToggleAutoPlay() {
  if (window.RamiAdapter || window.RAMI_ADAPTER) {
    const ad = window.RamiAdapter || window.RAMI_ADAPTER;
    if (typeof ad.toggleHumanAutoPlay === 'function') ad.toggleHumanAutoPlay();
  }
}

function ramiAddCardToTableMeld(targetPlayerId, meldIndex, cardIdx) {
  if (ramiIsSpectator()) return;
  const game = RAMI_STATE || (typeof window !== 'undefined' ? window.RAMI_STATE : null);
  if (!game) return;
  const player = game.roundManager.getCurrentPlayer();
  if (!player) return;

  /* [V15] استجابة واضحة لكل حالة: لا صمت أبداً */
  if (player.isBot) {
    _ramiToast('⏳ دور الخصم الآن — انتظر حتى يحين دورك', 'warn');
    return;
  }
  if (game.gamePhase !== 'PLAYING') {
    _ramiToast('انتهى الشوط — لا يمكن إضافة أوراق الآن', 'warn');
    return;
  }
  if (checkRamiBusy()) {
    _ramiToast('⏳ انتظر لحظة — يتم الآن تنفيذ الحركة السابقة', 'warn');
    return;
  }
  if (game.roundManager.turnPhase === 'WAITING_DRAW') {
    _ramiToast('اسحب ورقة أولاً من المجرف أو المرموق قبل إضافة الأوراق', 'warn');
    return;
  }
  if (!player.hasOpened) {
    _ramiToast(_ramiT('rami.mustOpenFirst') || 'يجب أن تفتتح مجموعاتك أولاً قبل إضافة أوراق للمجموعات المنزلة', 'warn');
    return;
  }

  const adapter = (typeof window !== 'undefined' && (window.RamiAdapter || window.RAMI_ADAPTER)) ? (window.RamiAdapter || window.RAMI_ADAPTER) : null;
  if (!adapter) return;

  let cardId = null;
  if (adapter.selectedCards && adapter.selectedCards.size === 1) {
    cardId = Array.from(adapter.selectedCards)[0];
  } else if (player.hand.length > 0) {
    const targetPlayer = game.players.find(p => p.id === targetPlayerId);
    if (targetPlayer && targetPlayer.melds && targetPlayer.melds[meldIndex]) {
      const tm = targetPlayer.melds[meldIndex];
      const fitting = player.hand.find(c => {
        if (cardFitsMeld(c, tm, game.rules)) return true;
        if (typeof tm.findJokerSwapIndex === 'function' && tm.findJokerSwapIndex(c, game.rules) !== -1) return true;
        return false;
      });
      if (fitting) cardId = fitting.id;
    }
  }

  if (cardId === null || cardId === undefined) {
    _ramiToast(_ramiT('rami.selectOneToAdd') || 'حدد ورقة واحدة من يدك أولاً (بالنقر عليها) ثم انقر على المجموعة المنزلة', 'info');
    return;
  }

  const card = player.getCard(cardId);
  if (!card) {
    _ramiToast('الورقة المحددة لم تعد في يدك', 'err');
    adapter.selectedCards.clear();
    adapter._updateUI();
    return;
  }

  const targetPlayer = game.players.find(p => p.id === targetPlayerId);
  if (!targetPlayer || !targetPlayer.melds || !targetPlayer.melds[meldIndex]) {
    _ramiToast('المجموعة المحددة لم تعد موجودة على الطاولة', 'err');
    return;
  }

  const targetMeld = targetPlayer.melds[meldIndex];

  // 1. فحص إمكانية استبدال الجوكر بالورقة الحقيقية التي يعوضها
  const jokerSwapIdx = (typeof targetMeld.findJokerSwapIndex === 'function') ? targetMeld.findJokerSwapIndex(card, game.rules) : -1;
  if (jokerSwapIdx !== -1) {
    const jokerCard = targetMeld.cards[jokerSwapIdx];
    player.removeCard(cardId);
    targetMeld.cards[jokerSwapIdx] = card;
    player.hand.push(jokerCard); // استعادة الجوكر ليد اللاعب
    
    if (player.drawnDiscardCard && player.drawnDiscardCard.id === cardId) player.drawnDiscardCard = null;
    if (player.drawnLaTourCard && player.drawnLaTourCard.id === cardId) player.drawnLaTourCard = null;
    player.tookLaTour = false;

    /* الورقة الحقيقية تبقى ظاهرة في خانتها بحلقة ذهبية، والجوكر يُضاف لليد تلقائياً عبر _updateHand */
    adapter.selectedCards.clear();
    if (adapter.multiplayer) adapter._netEmit('addToMeld', { playerId: player.id, targetPlayerId: targetPlayerId, meldIndex: meldIndex, cardIdx: jokerSwapIdx, cardId: cardId });
    if (typeof SND !== 'undefined' && SND.win) SND.win();
    _ramiToast('🃏 تم استبدال الجوكر بنجاح وأخذه إلى يدك!', 'ok');
    adapter._updateUI();
    return;
  }

  // 2. فحص إضافة الورقة لتوسيع المجموعة (تطابق دقيق: نفس الرمز تسلسلي / نفس القيمة برمز مختلف / جوكر بري)
  const isValid = (typeof cardFitsMeld === 'function') ? cardFitsMeld(card, targetMeld, game.rules) : false;

    if (isValid) {
    player.removeCard(cardId);
    /* [V28] إدراج مرتب: المتتالية تُرتَّب تصاعدياً.
       الجوكر: إن نُقر على الورقة الصغيرة (يمين) يوضع قبلها (مكان الورقة الأصغر)،
       وإن نُقر على الورقة الكبيرة (يسار) يوضع بعدها (مكان الورقة الأكبر). */
    if (targetMeld.type === MELD_TYPE.SEQUENCE) {
      if (game.rules.isWildCard(card)) {
        const naturals = targetMeld.cards.filter(c => !game.rules.isWildCard(c));
        let combined;
        if (naturals.length && cardIdx !== undefined && cardIdx !== null && cardIdx >= 0) {
          const aceHigh = naturals.some(c => c.rank >= 12);
          const rankOf = c => (c.rank === 1 ? (aceHigh ? 14 : 1) : c.rank);
          const clickedCard = targetMeld.cards[cardIdx];
          const clickedVal = clickedCard ? rankOf(clickedCard) : null;
          const minVal = Math.min.apply(null, naturals.map(rankOf));
          if (clickedVal === minVal) {
            /* الورقة الصغيرة → الجوكر قبلها (الأصغر) */
            combined = [card].concat(targetMeld.cards);
          } else {
            /* الورقة الكبيرة أو غيرها → الجوكر بعدها (الأكبر) */
            combined = targetMeld.cards.concat([card]);
          }
        } else {
          combined = targetMeld.cards.concat([card]);
        }
        targetMeld.cards = ramiOrderSequenceCards(combined, c => game.rules.isWildCard(c));
      } else {
        targetMeld.cards = ramiOrderSequenceCards(targetMeld.cards.concat([card]), c => game.rules.isWildCard(c));
      }
    } else {
      targetMeld.cards.push(card);
    }

    if (player.drawnDiscardCard && player.drawnDiscardCard.id === cardId) player.drawnDiscardCard = null;
    if (player.drawnLaTourCard && player.drawnLaTourCard.id === cardId) player.drawnLaTourCard = null;
    player.tookLaTour = false;
    /* الورقة المضافة تبقى ظاهرة في خانتها بحلقة ذهبية */

    adapter.selectedCards.clear();
    if (adapter.multiplayer) adapter._netEmit('addToMeld', { playerId: player.id, targetPlayerId: targetPlayerId, meldIndex: meldIndex, cardIdx: cardIdx, cardId: cardId });
    if (typeof SND !== 'undefined' && SND.card) SND.card();
    if (game.rules.isWildCard(card) && targetMeld.type === MELD_TYPE.SEQUENCE) {
      _ramiToast('🃏 تم إدراج الجوكر في المتتالية — ' + ramiJokerSlotDescription(targetMeld, game.rules), 'ok');
    } else {
      _ramiToast('✨ تمت إضافة الورقة إلى المجموعة في الطاولة بنجاح!', 'ok');
    }
    
    if (player.hand.length === 0) {
      adapter._endRoundUI();
    } else {
      adapter._updateUI();
    }
  } else {
    /* رسالة رفض دقيقة تميّز حالات الجوكر غير القانونية */
    const isWild = game.rules.isWildCard(card);
    if (isWild) {
      const hasWildInMeld = targetMeld.cards.some(c => game.rules.isWildCard(c));
      const naturals = targetMeld.cards.filter(c => !game.rules.isWildCard(c));
      if (hasWildInMeld) {
        _ramiToast('❌ لا يمكن إضافة جوكر ثانٍ إلى مجموعة تحتوي جوكراً أصلاً', 'err');
      } else if (naturals.length >= 4) {
        _ramiToast('❌ لا يمكن إضافة جوكر إلى مجموعة مكتملة من 4 أوراق طبيعية', 'err');
      } else {
        _ramiToast('❌ لا يمكن إضافة هذا الجوكر إلى المجموعة المحددة', 'err');
      }
    } else {
      _ramiToast('❌ هذه الورقة لا تتطابق مع نمط المجموعة المحددة', 'err');
    }
  }
}

function ramiChangeBet(delta) {
  const maxGold = (typeof ST !== 'undefined' && ST.gold) ? ST.gold : 10000;
  RAMI_BET = Math.max(10, Math.min((RAMI_BET || 50) + delta, maxGold));
  window.RAMI_BET = RAMI_BET;
  const el = document.getElementById('ramiBetInput');
  if (el) el.value = RAMI_BET;
  if (typeof SND !== 'undefined' && SND.click) SND.click();
}

function ramiSetMaxBet() {
  const maxGold = (typeof ST !== 'undefined' && ST.gold) ? ST.gold : 1000;
  RAMI_BET = Math.max(10, maxGold);
  window.RAMI_BET = RAMI_BET;
  const el = document.getElementById('ramiBetInput');
  if (el) el.value = RAMI_BET;
  if (typeof SND !== 'undefined' && SND.coin) SND.coin();
}

/* تبديل نوع الجولة (طالاج/سامبل) وتحديث قائمة خيارات الهدف ديناميكياً */
function ramiSetMode(m) {
  window.RAMI_SETUP_MODE = m;
  const btns = document.querySelectorAll('#ramiModeSeg .rami-seg-btn');
  btns.forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-mode') === m); });
  const sel = document.getElementById('ramiTarget');
  if (sel && window.RamiAdapter && typeof window.RamiAdapter._targetOptions === 'function') {
    const prev = sel.value;
    sel.innerHTML = window.RamiAdapter._targetOptions(m);
    if ([].some.call(sel.options, function (o) { return o.value === prev; })) sel.value = prev;
  }
  if (typeof SND !== 'undefined' && SND.click) SND.click();
}

/* ═══════════════════════════════════════════════════════════
   وضع الغرفة: مزامنة لعب الرامي الجماعي بين بشر حقيقيين
   نمط البذرة المشتركة + إعادة تشغيل الحركات الحتمية (مثل رامي/رندا):
   - بذرة واحدة مشتركة للجولة كلها ⇒ نفس التوزيع على كل الأجهزة.
   - كل حركة تُبَثّ وتُطبَّق حتمياً محلياً ⇒ انسجام كامل دون خادم منطقي.
   - من يملك الدور يدير مؤقته ويبث حركته فقط؛ الآخرون يطبقون ويعرضون.
   ═══════════════════════════════════════════════════════════ */

/* معرف اللاعب (0 في اللعب الفردي) */
/* [Spectator] هل المستخدم الحالي متفرج؟ (يحظر الأفعال) */
function ramiIsSpectator() {
  var ad = (typeof window !== 'undefined') ? (window.RamiAdapter || window.RAMI_ADAPTER) : null;
  return !!(ad && ad.isSpectator);
}

function ramiMyPlayerId() {
  var ad = (typeof window !== 'undefined') ? (window.RamiAdapter || window.RAMI_ADAPTER) : null;
  return ad ? (ad.myPlayerId || 0) : 0;
}
/* معرّف المستخدم الحالي للمقارنة مع مصدر الحركة (تجاهل صدى حركاتي) */
function ramiMyUserId() {
  if (typeof AUTH !== 'undefined' && AUTH.user) return AUTH.user.id != null ? AUTH.user.id : AUTH.user.username;
  if (typeof ST !== 'undefined' && ST.user && ST.user.id) return ST.user.id;
  if (typeof ST !== 'undefined' && ST.user && ST.user.username) return ST.user.username;
  return (typeof Session !== 'undefined' && Session.user) ? (Session.user.id || Session.user.username) : 'me';
}

/* بدء اللعب الجماعي: يستدعيه الخادم عند تغيّر حالة الغرفة إلى «playing» */
function RM_roomStart(room) {
  var ad = (typeof window !== 'undefined') ? (window.RamiAdapter || window.RAMI_ADAPTER) : null;
  if (ad && typeof ad.enterRoom === 'function') ad.enterRoom(room);
}
/* استقبال حركة من غرفة عبر SSE room:move */
function RM_roomMove(d) {
  try {
    /* الغلاف: sendMove('rmove', payload) ⇒ يصل d={action:'rmove', data:payload} — نفكّ الحزمة */
    if (d && d.action === 'rmove' && d.data) d = d.data;
    var ad = (typeof window !== 'undefined') ? (window.RamiAdapter || window.RAMI_ADAPTER) : null;
    if (ad && typeof ad._netApplyMove === 'function') ad._netApplyMove(d);
  } catch (e) { if (typeof console !== 'undefined') console.error('[Rami MP] applyMove', e && e.message, e); }
}

/* [Req3] تحديث حالة الغرفة: إعادة رسم واجهة التصويت عند نهاية المباراة */
function RM_roomUpdate(room) {
  try {
    var ad = (typeof window !== 'undefined') ? (window.RamiAdapter || window.RAMI_ADAPTER) : null;
    if (ad && ad.multiplayer && ad.game && ad.game.gamePhase === 'MATCH_END' && typeof ad._endRoundUI === 'function') ad._endRoundUI();
  } catch (e) {}
}

/* ربط معالجات الغرفة عند فتح صفحة الرامي */
function ramiRegisterRooms() {
  if (typeof Rooms === 'undefined' || !Rooms || typeof Rooms.setGameHandler !== 'function') return;
  Rooms.setGameHandler(RM_roomMove);
  Rooms.setStartHandler(RM_roomStart);
  Rooms.setUpdateHandler(RM_roomUpdate);   /* [Req3] تحديث واجهة التصويت */
  /* [Resilience] استهلاك إعادة بناء الحالة عند العودة (انقطاع/إغلاق) إن وصلت قبل التسجيل */
  if (typeof Rooms.hasPendingReplay === 'function' && Rooms.hasPendingReplay()) {
    var rp = Rooms.consumePendingReplay();
    if (rp && rp.history && rp.history.length) { RM_applyReplay(rp); return; }
  }
  /* إن كانت غرفة رامي نشطة فعلاً ندخلها فوراً (استئناف) */
  if (Rooms.state && Rooms.state.game_id === 'rm' && Rooms.state.status === 'playing') {
    var ad2 = (typeof window !== 'undefined') ? (window.RamiAdapter || window.RAMI_ADAPTER) : null;
    if (ad2 && typeof ad2.enterRoom === 'function') ad2.enterRoom(Rooms.state);
  }
}

/* [Resilience] تطبيق إعادة بناء الحالة (تصل عبر SSE room:replay بعد التسجيل) */
function RM_applyReplay(d) {
  try {
    var ad = (typeof window !== 'undefined') ? (window.RamiAdapter || window.RAMI_ADAPTER) : null;
    if (ad && typeof ad._netApplyReplay === 'function') ad._netApplyReplay((d && d.history) || [], (d && d.room_id) || null);
  } catch (e) { console.error('[Rami MP] applyReplay', e && e.message, e); }
}

/* ═══ امتداد النموذج الأولي لطبقة الشبكة ═══ */
/* الدخول في غرفة جماعية: المالك يبثّ التهيئة والبذرة، والضيوف ينتظرونها ثم يطبقونها */
RamiUIAdapter.prototype.enterRoom = function (room) {
  this.multiplayer = true;
  this.room = room || null;

  /* اشتقاق ترتيب المقاعد ومعرف لاعبي */
  var order = (room && room.order) ? room.order.slice() : [];
  var me = ramiMyUserId();
  /* [Spectator] كشف وضع المتفرج: المستخدم في players لكنه spectate */
  var myEntry = null;
  if (room && room.players) {
    for (var pi = 0; pi < room.players.length; pi++) {
      if (String(room.players[pi].id) === String(me)) { myEntry = room.players[pi]; break; }
    }
  }
  this.isSpectator = !!(myEntry && myEntry.spectate);

  var mySeat = order.indexOf(me);
  if (mySeat === -1) {
    for (var i = 0; i < order.length; i++) { if (String(order[i]) === String(me)) { mySeat = i; break; } }
  }
  if (mySeat === -1) mySeat = 0;
  this.myPlayerId = this.isSpectator ? -1 : mySeat;

  var isOwner = !!(room && room.owner_id != null && me != null && String(room.owner_id) === String(me))
             || !!(room && room.isOwner)
             || !!(typeof Rooms !== 'undefined' && Rooms.state && Rooms.state.isOwner);

  /* [Spectator] المتفرج: لا يستضيف ولا يلعب — ينتظر التهيئة ثم يبني الجولة محلياً لمراقبة الأفعال العامة */
  if (this.isSpectator) {
    this._renderSpectatorWait();
    return;
  }

  /* [Resilience] المالك يستضيف عند البدء الأولي/المباراة الجديدة (!hasHistory) حتى لو
     بقيت لعبة قديمة. عند العودة (hasHistory) ينتظر إعادة البناء من السجل — لكن لا يمسح
     لعبة بُنيت فعلاً (إعادة بناء من السجل عبر room:replay). */
  if (isOwner && !(room && room.hasHistory)) {
    if (!this._netHostInit) return;
    this._netHostInit(room);
  } else if (!this.game) {
    /* الضيف/العائد: انتظر استلام التهيئة أو إعادة البناء — فقط إن لم تُبنَ لعبة بعد */
    if (this.container) {
      this.container.innerHTML =
        '<div class="rami-setup-modal card" style="text-align:center;padding:28px 16px;">' +
          '<div class="rami-setup-emblem">\u{1F0CF}</div>' +
          '<div class="rami-setup-title">في انتظار بدء المالك للجولة…</div>' +
          '<div style="margin-top:12px;font-size:0.8rem;opacity:0.7;">' + (mySeat + 1) + ' / ' + (order.length || 1) + ' · ' + (me || '') + '</div>' +
        '</div>';
    }
  }
};

/* قراءة تهيئة الإعداد الحالية (المالك فقط) */
RamiUIAdapter.prototype._netConfig = function () {
  var mode = (typeof window !== 'undefined' && window.RAMI_SETUP_MODE) ? window.RAMI_SETUP_MODE : 'talaj';
  var targetVal = 'single', target = 999999, isSingle = true;
  var sel = document.getElementById('ramiTarget');
  if (sel && sel.value) {
    targetVal = sel.value;
    isSingle = (targetVal === 'single');
    target = isSingle ? 999999 : (parseInt(targetVal, 10) || (mode === 'talaj' ? 501 : 301));
  }
  var bet = (typeof window !== 'undefined' && window.RAMI_BET) ? window.RAMI_BET : 50;
  var timerSec = 90;
  var tSel = document.getElementById('ramiTimerSelect');
  if (tSel) timerSec = parseInt(tSel.value, 10) || 90;
  return { mode: mode, target: target, isSingle: isSingle, targetVal: targetVal, bet: bet, timer: timerSec };
};

/* [MP-AI] مقاعد الآلي من ترتيب الغرفة (المعرّفات التي تبدأ بـ bot) */
RamiUIAdapter.prototype._netBotSeats = function (order) {
  if (!order || !order.length) return [];
  var seats = [];
  for (var i = 0; i < order.length; i++) { if (String(order[i]).indexOf('bot') === 0) seats.push(i); }
  return seats;
};

/* المالك يبدأ الجولة ويبثّ البذرة الموحّدة */
RamiUIAdapter.prototype._netHostInit = function (room) {
  var cfg = this._netConfig();
  var order = (room && room.order) ? room.order.slice() : [];
  var playerCount = Math.max(2, order.length || 2);
  var seed = Math.floor(Math.random() * 0xFFFFFFFF);
  var botSeats = this._netBotSeats(order);   /* [MP-AI] مقاعد الآلي */

  /* بناء الجولة محلياً عند المالك */
  this._netBuildGame(cfg, seed, playerCount, botSeats);

  /* بثّ التهيئة للجميع (تُحفظ في room_state عبر Rooms.sendMove) */
  this._netEmit('init', { mode: cfg.mode, target: cfg.target, targetVal: cfg.targetVal, isSingle: cfg.isSingle, bet: cfg.bet, timer: cfg.timer, seed: seed, playerCount: playerCount, botSeats: botSeats, order: order });
};

/* بناء الجولة بالبذرة والتهيئة المعطاة (نفسها عند المالك والضيوف) */
RamiUIAdapter.prototype._netBuildGame = function (cfg, seed, playerCount, botSeats) {
  RAMI_STATE = new RamiGame(cfg.mode, playerCount, 0, seed, cfg.timer, botSeats);
  RAMI_STATE.rules.turnSeconds = cfg.timer;
  RAMI_STATE.roundManager.turnSecondsRemaining = cfg.timer;
  RAMI_STATE.isSingleRound = !!cfg.isSingle;
  RAMI_STATE.displayTarget = cfg.isSingle ? _ramiT('rami.singleShort', 'ش و') : cfg.target;
  RAMI_STATE.startMatch(cfg.target);
  window.RAMI_STATE = RAMI_STATE;
  if (typeof window !== 'undefined') window.RAMI_BET = cfg.bet;

  this.game = RAMI_STATE;
  this.selectedCards.clear();
  this.handSlots = [[], [], [], [], []];
  this._renderGame();
  /* مزامنة الدور الأول: عرض فقط (بدون إقحام بوت) — كل اللاعبين بشر */
  this._processTurn();
};

/* بثّ حركة للغرفة (تجاهلها اللاعب نفسه عند صدى العودة) */
RamiUIAdapter.prototype._netEmit = function (action, data) {
  if (!this.multiplayer) return;
  if (typeof Rooms === 'undefined' || !Rooms || typeof Rooms.sendMove !== 'function') return;
  this._netSeq = (this._netSeq || 0) + 1;
  var payload = { action: action, data: data, by: ramiMyUserId(), seq: this._netSeq, ts: Date.now() };
  try {
    Rooms.sendMove('rmove', payload, { game_id: 'rm', status: 'playing' });
  } catch (e) { if (typeof console !== 'undefined') console.error('[Rami MP] emit', e && e.message, e); }
};

/* تطبيق حركة وردت من لاعب آخر (أو التهيئة الأولية) */
RamiUIAdapter.prototype._netApplyMove = function (d) {
  if (!d || !this.multiplayer) return;
  /* تجاهل صدى حركاتي */
  if (d.by && String(d.by) === String(ramiMyUserId())) return;
  var action = d.action;
  if (action === 'init') {
    var data = d.data || {};
    this.myPlayerId = this._netResolveSeat(data.order);
    /* [Spectator] تحديث الوضع عند بدء كل مباراة: من رُقّي يصبح لاعباً */
    this.isSpectator = (this.myPlayerId === -1);
    this._netBuildGame(data, data.seed, data.playerCount || 2, data.botSeats || this._netBotSeats(data.order));
    return;
  }
  if (!this.game) return; /* لم تصل التهيئة بعد */

  var g = this.game;
  var data = d.data || {};
  if (typeof g.normalizeTurnPhase === 'function') g.normalizeTurnPhase();

  switch (action) {
    case 'draw':
      g.executeMove({ type: data.drawType, playerId: data.playerId });
      break;
    case 'discard':
      g.executeMove({ type: 'discard', playerId: data.playerId, cardId: data.cardId });
      break;
    case 'open':
      g.executeMove({ type: 'open', playerId: data.playerId, cardIds: data.cardIds || [] });
      break;
    case 'finish':
      {
        var finMove = { type: 'finish', playerId: data.playerId };
        if (data.isolateCardId != null) finMove.isolateCardId = data.isolateCardId;
        g.executeMove(finMove);
      }
      break;
    case 'addToMeld':
      _ramiNetApplyAddToMeld(g, data);
      break;
    case 'nextRound':
      /* [Resilience] حارس fromRound: لا تُطبّق إن انتقلتُ محلياً (تقدّم ديمقراطي مكرَّر) */
      if (g.roundManager && data.fromRound != null && g.roundManager.roundNumber !== data.fromRound) return;
      try { if (window._ramiAutoAdvTimer) { clearInterval(window._ramiAutoAdvTimer); window._ramiAutoAdvTimer = null; } } catch (e2) {}
      g.nextRound();
      this.game._payoutDone = false;
      this.game._roundRecorded = false;
      this._renderGame();
      this._processTurn();
      return;
    case 'autoTimeout':
      /* [Resilience] تطبيق الحركة الدقيقة التي اختارها السائق (لا منطق محلي → لا تباين) */
      {
        var ap = data.playerId;
        if (data.drew) g.executeMove({ type: 'draw_deck', playerId: ap });
        if (data.discardCardId != null) g.executeMove({ type: 'discard', playerId: ap, cardId: data.discardCardId });
      }
      break;
    default:
      return;
  }

  /* بعد أي حركة: إدارة الدور — يُنبّه صاحب الدور الجديد ويشغّل مؤقته، صامت لغيره */
  var ended = (g.gamePhase === 'ROUND_END' || g.gamePhase === 'MATCH_END');
  if (ended) {
    this._endRoundUI();
  } else {
    this._processTurn();
  }
};

/* [Resilience] إعادة بناء الحالة الجارية من تاريخ الحركات عند العودة للاعب المنقطع.
   يطبّق الحركات مباشرةً (دلال by) صمتاً، ثم يعرض الحالة النهائية مرة واحدة. */
RamiUIAdapter.prototype._netApplyReplay = function (history, roomId) {
  if (!history || !history.length) return;
  /* [Resilience] لا تُعد بناء لعبة قائمة فعلًا (تظل متزامنة عبر room:move الحيّ)؛
     الإعادة تهمّ فقط العائد بعد إغلاق/إعادة تحميل (المحوّل جديد بلا لعبة) */
  if (this.game) return;
  try {
    this.multiplayer = true;
    if (!this.room && typeof Rooms !== 'undefined' && Rooms.state) this.room = Rooms.state;
    this._replaying = true;
    for (var i = 0; i < history.length; i++) {
      var m = history[i], md = m.data || {};
      try {
        if (this.game && typeof this.game.normalizeTurnPhase === 'function') this.game.normalizeTurnPhase();
        if (m.action === 'init') {
          this.myPlayerId = this._netResolveSeat(md.order);
          this.isSpectator = (this.myPlayerId === -1);
          this._netBuildGame(md, md.seed, md.playerCount || 2, md.botSeats || this._netBotSeats(md.order));
        } else if (!this.game) {
          continue;
        } else if (m.action === 'draw') {
          this.game.executeMove({ type: md.drawType, playerId: md.playerId });
        } else if (m.action === 'discard') {
          this.game.executeMove({ type: 'discard', playerId: md.playerId, cardId: md.cardId });
        } else if (m.action === 'open') {
          this.game.executeMove({ type: 'open', playerId: md.playerId, cardIds: md.cardIds || [] });
        } else if (m.action === 'finish') {
          var fm = { type: 'finish', playerId: md.playerId };
          if (md.isolateCardId != null) fm.isolateCardId = md.isolateCardId;
          this.game.executeMove(fm);
        } else if (m.action === 'addToMeld') {
          _ramiNetApplyAddToMeld(this.game, md);
        } else if (m.action === 'autoTimeout') {
          if (md.drew) this.game.executeMove({ type: 'draw_deck', playerId: md.playerId });
          if (md.discardCardId != null) this.game.executeMove({ type: 'discard', playerId: md.playerId, cardId: md.discardCardId });
        } else if (m.action === 'nextRound') {
          var rrm = this.game.roundManager;
          if (!(rrm && md.fromRound != null && rrm.roundNumber !== md.fromRound)) {
            this.game.nextRound();
            this.game._payoutDone = false;
            this.game._roundRecorded = false;
          }
        }
      } catch (e2) { console.error('[Rami] replay move', m && m.action, e2 && e2.message); }
    }
    this._replaying = false;
    var g = this.game;
    if (!g) return;
    if (this.isSpectator) { this._renderGame(); return; }
    var ended = (g.gamePhase === 'ROUND_END' || g.gamePhase === 'MATCH_END');
    this._renderGame();
    if (ended) this._endRoundUI(); else this._processTurn();
    _ramiToast('\u{1F501} ' + (_ramiT('rami.rejoined') || 'تمت استعادة الجولة الحالية'), 'ok');
  } catch (e) {
    this._replaying = false;
    console.error('[Rami] replay', e && e.message, e);
  }
};

/* حلّ مقعدي من ترتيب الغرفة */
RamiUIAdapter.prototype._netResolveSeat = function (order) {
  if (!order || !order.length) return 0;
  var me = ramiMyUserId();
  for (var i = 0; i < order.length; i++) { if (String(order[i]) === String(me)) return i; }
  return -1; /* [Spectator] ليس في الترتيب ⇒ متفرج */
};

/* تطبيق إدراج/استبدال الجوكر في مجموعة (نسخة نقية من ramiAddCardToTableMeld) */
function _ramiNetApplyAddToMeld(g, data) {
  var player = g.players.find(function (p) { return p.id === data.playerId; });
  if (!player) return;
  var targetPlayer = g.players.find(function (p) { return p.id === data.targetPlayerId; });
  if (!targetPlayer || !targetPlayer.melds || !targetPlayer.melds[data.meldIndex]) return;
  var targetMeld = targetPlayer.melds[data.meldIndex];
  var card = player.getCard(data.cardId);
  if (!card) return;

  var rules = g.rules;
  /* 1) استبدال جوكر */
  var jokerSwapIdx = (typeof targetMeld.findJokerSwapIndex === 'function') ? targetMeld.findJokerSwapIndex(card, rules) : -1;
  if (jokerSwapIdx !== -1) {
    var jokerCard = targetMeld.cards[jokerSwapIdx];
    player.removeCard(data.cardId);
    targetMeld.cards[jokerSwapIdx] = card;
    player.hand.push(jokerCard);
    if (player.drawnDiscardCard && player.drawnDiscardCard.id === data.cardId) player.drawnDiscardCard = null;
    if (player.drawnLaTourCard && player.drawnLaTourCard.id === data.cardId) player.drawnLaTourCard = null;
    player.tookLaTour = false;
    return;
  }
  /* 2) إضافة لتوسيع المجموعة */
  player.removeCard(data.cardId);
  if (targetMeld.type === MELD_TYPE.SEQUENCE) {
    var combined = targetMeld.cards.concat([card]);
    if (rules.isWildCard(card) && data.cardIdx !== undefined && data.cardIdx !== null) {
      var naturals = targetMeld.cards.filter(function (c) { return !rules.isWildCard(c); });
      if (naturals.length) {
        var aceHigh = naturals.some(function (c) { return c.rank >= 12; });
        var rankOf = function (c) { return c.rank === 1 ? (aceHigh ? 14 : 1) : c.rank; };
        var clickedCard = targetMeld.cards[data.cardIdx];
        var clickedVal = clickedCard ? rankOf(clickedCard) : null;
        var minVal = Math.min.apply(null, naturals.map(rankOf));
        combined = (clickedVal === minVal) ? [card].concat(targetMeld.cards) : targetMeld.cards.concat([card]);
      }
    }
    targetMeld.cards = ramiOrderSequenceCards(combined, function (c) { return rules.isWildCard(c); });
  } else {
    targetMeld.cards.push(card);
  }
  if (player.drawnDiscardCard && player.drawnDiscardCard.id === data.cardId) player.drawnDiscardCard = null;
  if (player.drawnLaTourCard && player.drawnLaTourCard.id === data.cardId) player.drawnLaTourCard = null;
  player.tookLaTour = false;
}

/* ── Global Window Exports ── */
window.RAMI_STATE = RAMI_STATE;
window.RAMI_BET = RAMI_BET;
window.ramiAction = ramiAction;
window.ramiOpenMelds = ramiOpenMelds;
window.ramiStartGame = ramiStartGame;
window.ramiNextRound = ramiNextRound;
window.ramiReset = ramiReset;
window.initRami = initRami;
window.eRami = eRami;
window.RamiCard = RamiCard;
window.RamiDeck = RamiDeck;
window.RamiGame = RamiGame;
window.RAMI_SUIT_GLYPH = RAMI_SUIT_GLYPH;
window.getRamiCardHTML = getRamiCardHTML;
window.ramiSelectCard = ramiSelectCard;
window.ramiClearSelection = ramiClearSelection;
window.ramiMoveCardToSlot = ramiMoveCardToSlot;
window.ramiSlotAtPoint = ramiSlotAtPoint;
window.ramiPointInDiscardZone = ramiPointInDiscardZone;
window.ramiPointInIsolateZone = ramiPointInIsolateZone;
window.ramiIsolateCard = ramiIsolateCard;
window.ramiClickIsolateSlot = ramiClickIsolateSlot;
window.ramiClickSlot = ramiClickSlot;
window.ramiAutoSortSlot = ramiAutoSortSlot;
window.ramiBindPointerEvents = ramiBindPointerEvents;
window.ramiHandPointerDown = ramiHandPointerDown;
window.ramiPilePointerDown = ramiPilePointerDown;
window.RamiUIAdapter = RamiUIAdapter;
window.ramiToggleAutoPlay = ramiToggleAutoPlay;
window.ramiAddCardToTableMeld = ramiAddCardToTableMeld;
window.ramiChangeBet = ramiChangeBet;
window.ramiSetMaxBet = ramiSetMaxBet;
window.ramiSetMode = ramiSetMode;
window.ramiCopyHistory = ramiCopyHistory;
window.fallbackCopy = fallbackCopy;
window.aggregatePenaltyText = aggregatePenaltyText;
window.cardFitsMeld = cardFitsMeld;
window.ramiStateInstruction = ramiStateInstruction;
window.ramiOrderSequenceCards = ramiOrderSequenceCards;
window.ramiJokerSlotDescription = ramiJokerSlotDescription;

/* وضع الغرفة الجماعي */
window.RM_roomStart = RM_roomStart;
window.RM_roomMove = RM_roomMove;
window.ramiRegisterRooms = ramiRegisterRooms;
window.ramiMyPlayerId = ramiMyPlayerId;
window.ramiIsSpectator = ramiIsSpectator;
window._ramiNetApplyAddToMeld = _ramiNetApplyAddToMeld;

window.RamiMeld = RamiMeld;
window.MELD_TYPE = MELD_TYPE;
window.RamiRules = RamiRules;
window.MeldValidator = MeldValidator;
window.partitionSelectedCards = partitionSelectedCards;
window.verifyRamiDeckIntegrity = verifyRamiDeckIntegrity;
window.ramiDeckAccounting = ramiDeckAccounting;

/* [V14] محاسبة دقيقة للأوراق: المتاحة + الموزعة + الباقية — كل ورقة فريدة ومحصاة مرة واحدة */
function ramiDeckAccounting(game) {
  const rm = game && game.roundManager;
  if (!rm) return null;
  const total = rm.rules.hasPhysicalJokers ? 108 : 104;
  const seen = new Set();
  let inDrawPile = 0, inDiscard = 0, inHands = 0, inMelds = 0;
  const count = (c, slot) => { if (!c || seen.has(c.id)) return; seen.add(c.id); if (slot === 'draw') inDrawPile++; else if (slot === 'discard') inDiscard++; else if (slot === 'hand') inHands++; else if (slot === 'meld') inMelds++; };
  for (const c of rm.drawPile) count(c, 'draw');
  for (const c of rm.discardPile) count(c, 'discard');
  if (rm.jokerIndicator) count(rm.jokerIndicator, 'discard');
  for (const p of game.players) {
    for (const c of p.hand) count(c, 'hand');
    for (const m of p.melds) for (const c of m.cards) count(c, 'meld');
  }
  return { total, inDrawPile, inDiscard, inHands, inMelds, remaining: total - seen.size };
}

/* فحص حي لسلامة الرزمة الحالية (أيدي + منزلات + مجرف + مرموق) */
function verifyRamiDeckIntegrity(game) {
  const rm = game && game.roundManager;
  if (!rm) return { ok: false, problem: 'no round manager' };
  const seenIds = new Set();
  const dupIds = [];
  const track = (c, loc) => { if (!c) return; if (seenIds.has(c.id)) dupIds.push(c.id); else seenIds.add(c.id); };
  for (const c of rm.drawPile) track(c, 'draw');
  for (const c of rm.discardPile) track(c, 'discard');
  if (rm.jokerIndicator) track(rm.jokerIndicator, 'ind');
  for (const p of game.players) {
    for (const c of p.hand) track(c, 'hand');
    for (const m of p.melds) for (const c of m.cards) track(c, 'meld');
  }
  if (dupIds.length) return { ok: false, problem: 'أوراق مكررة في مكانين: ' + dupIds.join(',') };
  return { ok: true, problem: null };
}
