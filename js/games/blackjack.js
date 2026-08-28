/* ═══════════════════════════════════════════
   Digital Moroccan casino — Blackjack Engine
   ═══════════════════════════════════════════ */
"use strict";
/* ── حالة Blackjack ── */
let bDeck = [];
let bP = [];
let bD = [];
let bOn = false;
let bSplit = false;
let bSplitHand = [];
let bSplitActive = 0;
let bDbl = [false, false]; /* مضاعفة لكل يد: [اليد الأصلية, اليد الثانية بعد التقسيم] */
let bSeq = 0; /* عدّاد الجولات — لإبطال الأنيميشن القديم عند توزيع جولة جديدة */
/* ── نبض عدّاد الرهان عند تغيّر قيمته ── */
function bindBetPulse() {
  if (typeof MutationObserver !== 'function') return;
  setTimeout(function () {
    const el = document.getElementById('GBd');
    if (!el) return;
    const obs = new MutationObserver(function () {
      const b = el.closest('.bamt');
      if (!b) return;
      b.classList.remove('pulse');
      void b.offsetWidth;
      b.classList.add('pulse');
    });
    obs.observe(el, { childList: true, characterData: true, subtree: true });
  }, 0);
}
/* ── بناء الواجهة ── */
function eBj(g) {
  bindBetPulse();
  return gFrame(
    betRow() +
    '<div class="bjt">' +
      '<div class="bja">' +
        '<div class="bjal">' + T('bj.dealer') + '</div>' +
        '<div class="bjcs" id="bDc"></div>' +
        '<div class="bjs" id="bDs">?</div>' +
      '</div>' +
      '<div class="bja" id="bAreaP">' +
        '<div class="bjal">' + T('bj.you') + '</div>' +
        '<div class="bjcs" id="bPc"></div>' +
        '<div class="bjs" id="bPs">0</div>' +
      '</div>' +
      '<div class="bja" id="bAreaS" style="display:none">' +
        '<div class="bjal"> Split</div>' +
        '<div class="bjcs" id="bSc"></div>' +
        '<div class="bjs" id="bSs">0</div>' +
      '</div>' +
    '</div>' +
    '<div class="bets">' +
      '<button class="big" id="bDeal" onclick="dealB()"><i class="fa-solid fa-hand" aria-hidden="true"></i> ' + T('g.deal') + '</button>' +
      '<button class="big" id="bHit" onclick="hitB()" disabled style="background:var(--gb);color:#fff"><i class="fa-solid fa-plus" aria-hidden="true"></i> ' + T('g.hit') + '</button>' +
      '<button class="big" id="bStand" onclick="standB()" disabled style="background:linear-gradient(135deg,#10B981,#34D399);color:#fff"><i class="fa-solid fa-stop" aria-hidden="true"></i> ' + T('g.stand') + '</button>' +
      '<button class="big" id="bDouble" onclick="doubleB()" disabled style="background:linear-gradient(135deg,#7C3AED,#A78BFA);color:#fff"><i class="fa-solid fa-angles-up" aria-hidden="true"></i> ' + T('g.double') + '</button>' +
      '<button class="big" id="bSplit" onclick="splitB()" disabled style="background:linear-gradient(135deg,#F5C518,#FF8C00);color:#0A0E1A"><i class="fa-solid fa-shuffle" aria-hidden="true"></i> ' + T('g.split') + '</button>' +
    '</div>',
    g
  );
}
/* ── إنشاء مجموعة ورق ── */
function mkDeck() {
  bDeck = [];
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  for (let s = 0; s < 4; s++) {
    for (let r = 0; r < 13; r++) {
      bDeck.push({ s: suits[s], r: ranks[r] });
    }
  }
  /* خلط Fisher-Yates */
  for (let i = bDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = bDeck[i];
    bDeck[i] = bDeck[j];
    bDeck[j] = t;
  }
}
/* ── قيمة الورقة ── */
function cv2(c) {
  if (c.r === 'A') return 11;
  if (c.r === 'J' || c.r === 'Q' || c.r === 'K') return 10;
  return parseInt(c.r, 10);
}
/* ── قيمة اليد ── */
function hv(h) {
  let v = 0;
  let a = 0;
  for (let i = 0; i < h.length; i++) {
    v += cv2(h[i]);
    if (h[i].r === 'A') a++;
  }
  while (v > 21 && a > 0) {
    v -= 10;
    a--;
  }
  return v;
}
/* ── عرض الأوراق (limit يحدّ عدد الأوراق الظاهرة أثناء التوزيع المتدرج) ── */
function renderB(hide, limit) {
  const pEl = document.getElementById('bPc');
  const dEl = document.getElementById('bDc');
  const psEl = document.getElementById('bPs');
  const dsEl = document.getElementById('bDs');
  const pn = (limit && limit.p != null) ? limit.p : bP.length;
  const dn = (limit && limit.d != null) ? limit.d : bD.length;
  if (pEl) pEl.innerHTML = bP.slice(0, pn).map(c => cardHTML(c, false)).join('');
  if (dEl) {
    dEl.innerHTML = bD.slice(0, dn).map((c, i) => {
      return (hide && i === 1) ? cardHTML(c, true) : cardHTML(c, false);
    }).join('');
  }
  if (psEl) psEl.textContent = hv(bP.slice(0, pn));
  if (dsEl) dsEl.textContent = (hide && bOn) ? '?' : hv(bD.slice(0, dn));
  if (bSplit) {
    const scEl = document.getElementById('bSc');
    const ssEl = document.getElementById('bSs');
    const areaS = document.getElementById('bAreaS');
    if (areaS) areaS.style.display = 'block';
    if (scEl) scEl.innerHTML = bSplitHand.map(c => cardHTML(c, false)).join('');
    if (ssEl) ssEl.textContent = hv(bSplitHand);
  }
}
/* ── التوزيع (متدرج: ورقة كل 280ms مع صوت) ── */
function dealB() {
  if (!take()) return;
  bSeq++;
  mkDeck();
  bP = [bDeck.pop(), bDeck.pop()];
  bD = [bDeck.pop(), bDeck.pop()];
  bOn = true;
  bSplit = false;
  bSplitHand = [];
  bSplitActive = 0;
  bDbl = [false, false];
  /* بداية جولة بلاك جاك — قابلة للاستئناف عند العودة */
  if (typeof window.SessionResume !== 'undefined') {
    try { window.SessionResume.markRoundStart({ gameId: 'bj' }); } catch (e) {}
  }
  const seq = bSeq;
  /* تعطيل كل الأزرار حتى اكتمال التوزيع */
  document.getElementById('bDeal').disabled = true;
  document.getElementById('bHit').disabled = true;
  document.getElementById('bStand').disabled = true;
  document.getElementById('bDouble').disabled = true;
  document.getElementById('bSplit').disabled = true;
  gres('', 0);
  /* توزيع الورق ورقةً ورقة مع صوت حفيف */
  const steps = [
    { t: 0,   f: () => { SND.deal(); renderB(true, { p: 1, d: 0 }); } },
    { t: 280, f: () => { SND.deal(); renderB(true, { p: 2, d: 0 }); } },
    { t: 560, f: () => { SND.deal(); renderB(true, { p: 2, d: 1 }); } },
    { t: 840, f: () => { SND.deal(); renderB(true, { p: 2, d: 2 }); } }
  ];
  steps.forEach(s => setTimeout(function () {
    if (seq !== bSeq) return;
    s.f();
  }, s.t));
  const areaP = document.getElementById('bAreaP');
  if (areaP) areaP.classList.add('bj-live');
  const areaS = document.getElementById('bAreaS');
  if (areaS) areaS.style.display = 'none';
  /* تفعيل الأزرار بعد اكتمال التوزيع + فحص Blackjack الطبيعي */
  setTimeout(function () {
    if (seq !== bSeq) return;
    document.getElementById('bHit').disabled = false;
    document.getElementById('bStand').disabled = false;
    document.getElementById('bDouble').disabled = false;
    document.getElementById('bSplit').disabled = (cv2(bP[0]) === cv2(bP[1]) && ST.gold >= GB) ? false : true;
    if (hv(bP) === 21) {
      if (hv(bD) === 21) {
        /* تعادل Blackjack متبادل — استرداد الرهان */
        give(GB);
        gres(T('bj.bjpush') + ' +' + fmt(GB) + ' 🪙', GB);
        toast('<i class="fa-solid fa-handshake"></i> 21/21 — ' + T('bj.bjpush') + ' +' + fmt(GB) + ' 🪙', 'warn');
      } else {
        const w = Math.floor(GB * 2.5);
        give(w);
        gres(T('ts.blackjack') + ' +' + fmt(w) + ' 🪙', w);
        celebrate(true);
        toast('<i class="fa-solid fa-trophy"></i> ' + T('ts.blackjack') + ' +' + fmt(w) + ' 🪙', 'ok');
      }
      endB();
    }
  }, 920);
}
/* ── التقسيم ── */
function splitB() {
  if (!bOn || cv2(bP[0]) !== cv2(bP[1]) || ST.gold < GB) return;
  ST.gold -= GB;
  save();
  wallet();
  bSplit = true;
  bSplitHand = [bP.pop()];
  bP.push(bDeck.pop());
  bSplitHand.push(bDeck.pop());
  bDbl = [false, false];
  SND.deal();
  renderB(true);
  document.getElementById('bSplit').disabled = true;
}
/* ── المضاعفة ── */
function doubleB() {
  if (!bOn || ST.gold < GB) return;
  ST.gold -= GB;
  save();
  wallet();
  bDbl[bSplitActive] = true;
  bP.push(bDeck.pop());
  SND.deal();
  renderB(true);
  if (hv(bP) > 21) {
    if (bSplit && bSplitActive === 0) {
      /* اليد الأولى تجاوزت 21 بعد المضاعفة → الانتقال لليد الثانية بدلاً من إنهاء اللعبة */
      bSplitActive = 1;
      const done = bP;
      bP = bSplitHand;
      bSplitHand = done;
      gres(T('bj.hand1bust'), false);
      renderB(true);
      document.getElementById('bDouble').disabled = (ST.gold >= GB) ? false : true;
      return;
    }
    if (bSplit && bSplitActive === 1) {
      /* اليد الثانية تجاوزت 21 → الموزع يلعب ويحسم اليدين معاً */
      SND.lose();
      standB();
      return;
    }
    gres(' ' + T('ts.lose'), false);
    SND.lose();
    bjEncourage('lose', 0);
    endB();
  } else {
    standB();
  }
}
/* ── سحب ورقة ── */
function hitB() {
  if (!bOn) return;
  bP.push(bDeck.pop());
  SND.deal();
  document.getElementById('bDouble').disabled = true;
  document.getElementById('bSplit').disabled = true;
  const seq = bSeq;
  /* تأخير قصير لرؤية الورقة قبل الحسم */
  setTimeout(function () {
    if (seq !== bSeq) return;
    renderB(true);
    if (hv(bP) > 21) {
      if (bSplit && bSplitActive === 0) {
        /* اليد الأولى تجاوزت 21 → الانتقال لليد الثانية (تبادل الأدوار) */
        bSplitActive = 1;
        const done = bP;
        bP = bSplitHand;
        bSplitHand = done;
        gres(T('bj.hand1bust'), false);
        renderB(true);
        document.getElementById('bDouble').disabled = (ST.gold >= GB) ? false : true;
        return;
      }
      if (bSplit && bSplitActive === 1) {
        /* اليد الثانية تجاوزت 21 → الموزع يلعب ويحسم اليدين معاً
           (اليد التي bust تخسر، والأولى قد تكون stand رابحة) */
        SND.lose();
        standB();
        return;
      }
      gres(' ' + T('ts.lose'), false);
      SND.lose();
      bjEncourage('lose', 0);
      endB();
    }
  }, 180);
}
/* ── رسالة تشجيعية بعد نتيجة الجولة ── */
function bjEncourage(kind, w) {
  if (kind === 'win') {
    toast('<i class="fa-solid fa-trophy"></i> ' + (w >= GB * 2 ? 'ربح رائع!' : 'فوز!') + ' +' + fmt(w) + ' 🪙', 'ok');
  } else if (kind === 'lose') {
    toast('<i class="fa-solid fa-heart"></i> لا بأس — الحظ في الجولة القادمة!', 'warn');
  }
}
/* ── الوقوف ── */
function standB() {
  if (!bOn) return;
  if (bSplit && bSplitActive === 0) {
    /* اليد الأولى وقفت → الانتقال لليد الثانية (تبادل الأدوار) بلا لعب الموزع */
    bSplitActive = 1;
    const done = bP;
    bP = bSplitHand;
    bSplitHand = done;
    gres(T('bj.hand1done'), false);
    renderB(true);
    document.getElementById('bDouble').disabled = (ST.gold >= GB) ? false : true;
    return;
  }
  bOn = false;
  const btnDeal = document.getElementById('bDeal');
  const btnHit = document.getElementById('bHit');
  const btnStand = document.getElementById('bStand');
  const btnDouble = document.getElementById('bDouble');
  const btnSplit = document.getElementById('bSplit');
  if (btnDeal) btnDeal.disabled = true;
  if (btnHit) btnHit.disabled = true;
  if (btnStand) btnStand.disabled = true;
  if (btnDouble) btnDouble.disabled = true;
  if (btnSplit) btnSplit.disabled = true;
  /* مؤشر تفكير الموزع ثم سحب الورق ورقةً ورقة مع صوت */
  const dsEl = document.getElementById('bDs');
  if (dsEl) {
    dsEl.textContent = '…';
    dsEl.classList.add('thinking');
  }
  const seq = bSeq;
  const toDraw = [];
  /* محاكاة يد الموزع في نسخة مؤقتة حتى تُحسم القيمة قبل الأنيميشن
     (كانت الحلقة تنفجر حتى يفرغ السطح لأنها لم تحدّث bD داخلها) */
  const sim = bD.slice();
  while (hv(sim) < 17) {
    const c = bDeck.pop();
    if (!c) break;
    sim.push(c);
    toDraw.push(c);
  }
  toDraw.forEach(function (c, i) {
    setTimeout(function () {
      if (seq !== bSeq) return;
      bD.push(c);
      SND.deal();
      renderB(false);
    }, 420 + i * 320);
  });
  setTimeout(function () {
    if (seq !== bSeq) return;
    if (dsEl) dsEl.classList.remove('thinking');
    finishStandB();
  }, 420 + toDraw.length * 320 + 350);
}
function finishStandB() {
  renderB(false);
  const d = hv(bD);
  /* اليدان بالترتيب الأصلي: الأولى في bSplitHand (منتهية)، الثانية في bP (نشطة) */
  const hands = bSplit ? [bSplitHand, bP] : [bP];
  let totalW = 0;
  let sumBets = 0;
  let wHands = 0, lHands = 0;
  hands.forEach(function (hand, i) {
    const bet = GB * (bDbl[i] ? 2 : 1);
    sumBets += bet;
    const p = hv(hand);
    if (p > 21) {
      lHands++;
    } else if (d > 21 || p > d) {
      totalW += bet * 2;
      wHands++;
    } else if (p === d) {
      totalW += bet;
    } else {
      lHands++;
    }
  });

  let m = '';
  let kind = 'lose';
  if (totalW > sumBets) {
    kind = 'win';
    m = ' +' + fmt(totalW) + ' 🪙';
  } else if (totalW > 0) {
    kind = 'push';
    m = ' Push +' + fmt(totalW) + ' 🪙';
  } else {
    m = ' ' + T('ts.lose');
  }

  give(totalW);
  gres(m, totalW);
  if (kind === 'win' && typeof burst === 'function') {
    const area = document.getElementById('bAreaP');
    if (area) {
      const r = area.getBoundingClientRect();
      if (r.width) burst(r.left + r.width / 2, r.top + r.height / 2, ['#F5C518', '#FFD93D', '#34D399'], 20, 5);
    }
  }
  if (totalW >= GB * 2) celebrate(true);
  bjEncourage(kind, totalW);
  fairTick();
  endB();
}
/* ── إنهاء الجولة ── */
function endB() {
  bOn = false;
  const d = document.getElementById('bDeal');
  const h = document.getElementById('bHit');
  const s = document.getElementById('bStand');
  const dd = document.getElementById('bDouble');
  const sp = document.getElementById('bSplit');
  if (d) d.disabled = false;
  if (h) h.disabled = true;
  if (s) s.disabled = true;
  if (dd) dd.disabled = true;
  if (sp) sp.disabled = true;
  const areaP = document.getElementById('bAreaP');
  if (areaP) areaP.classList.remove('bj-live');
  const areaS = document.getElementById('bAreaS');
  if (areaS) areaS.style.display = 'none';
  renderB(false);
}

/* ── Export to window ── */
window.eBj = eBj;
