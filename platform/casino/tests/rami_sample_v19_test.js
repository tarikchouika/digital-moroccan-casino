/* ═══ اختبار قوانين رامي سامبل v19 ═══
   - اللاعب التالي للموزع يبدأ
   - الفوجوك: قلب أول ورقة، سحب في الدورة الأولى فقط، خلط عند نفاد التوزيع
   - المرموق: سحب حر بلا جزاء، غير حر في نفس الدور، حر في الأدوار الموالية
   - الافتتاح: متتالية حرة + متماثلة حرة + مجموع حر ≥ 51
   - الإنهاء: متتالية حرة + متماثلة حرة + 13 ورقة بمجموعات + ورقة إنهاء 14
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'games', 'rami.js'), 'utf8');
const ctx = {
  console, Date, Math, JSON, Set, Map, Array, Object, Number, String,
  setTimeout: (fn) => fn(), window: {},
  _ramiToast: () => {}, SND: {}
};
vm.createContext(ctx);
vm.runInContext(code + '\n;globalThis.__X = { RamiGame, RamiRules, RamiCard: (typeof RamiCard!=="undefined"?RamiCard:null), MELD_TYPE, verifyRamiDeckIntegrity, ramiDeckAccounting, RamiExpertAI, cardFitsMeld: (typeof cardFitsMeld!=="undefined"?cardFitsMeld:null) };', ctx);
const { RamiGame, RamiRules, MELD_TYPE, verifyRamiDeckIntegrity, ramiDeckAccounting, RamiExpertAI, cardFitsMeld } = ctx.__X;

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log(' ✓ ' + name); }
  else { fail++; console.log(' ✗ ' + name); }
}

/* ── مساعد: ورقة اصطناعية ── */
let _cid = 9000;
function C(rank, suit) {
  suit = suit || 'heart';
  const baseValue = rank === 1 ? 10 : (rank > 10 ? 10 : rank);
  return { id: 'T' + (_cid++), rank, suit, baseValue, isJoker: false,
    displayName: rank + suit };
}

console.log('── 1) البادئ والبنية الأساسية ──');
{
  const g = new RamiGame('simple', 3, 2, 42, 90);
  g.startMatch(3, 2);
  const rm = g.roundManager;
  ok(rm.currentPlayerIndex === (rm.dealerIndex + 1) % 3, 'اللاعب التالي للموزع صاحب أول دور');
  ok(g.players.every(p => p.hand.length === 13), 'كل لاعب 13 ورقة (الموزع أيضاً)');
  ok(!!rm.jokerIndicator, 'الفوجوك مقلوبة بعد التوزيع');
  ok(rm.discardPile.length === 0, 'لا ورقة مرموق أولى في السامبل — المرموق يبدأ فارغاً');
  ok(g.rules.jokerIndicator && g.rules.jokerIndicator.rank === rm.jokerIndicator.rank, 'تعريف الجوكر (رتبة/لون معاكس) محفوظ مستقلاً');
}

console.log('── 2) الفوجوك: الدور الأول فقط ثم الخلط ──');
{
  const g = new RamiGame('simple', 2, 1, 7, 90);
  g.startMatch(2, 1);
  const rm = g.roundManager;
  const p1 = rm.getCurrentPlayer();
  const moves1 = g.getLegalMoves(p1.id).map(m => m.type);
  ok(moves1.indexOf('draw_fojok') !== -1, 'سحب الفوجوك متاح في الدور الأول');
  /* اللاعب الأول يسحب من المجرف ويرمي — الفوجوك تبقى */
  g.executeMove({ type: 'draw_deck', playerId: p1.id });
  g.executeMove({ type: 'discard', playerId: p1.id, cardId: p1.hand[0].id });
  const p2 = rm.getCurrentPlayer();
  const r2 = g.executeMove({ type: 'draw_fojok', playerId: p2.id });
  ok(r2.success && rm.jokerIndicator === null, 'اللاعب الثاني سحب الفوجوك في دوره الأول');
  ok(p2.hand.some(c => c.id === r2.card.id), 'الفوجوك في يد الساحب');
  ok(g.rules.jokerIndicator !== null, 'تعريف الجوكر باقٍ بعد سحب الفوجوك');
  const rDup = g.executeMove({ type: 'draw_fojok', playerId: p2.id });
  ok(!rDup.success, 'لا سحب فوجوك ثانٍ');
}
{
  /* عدم السحب في الدورة الأولى → يحرم الجميع + تُخلط عند نفاد التوزيع */
  const g = new RamiGame('simple', 2, 1, 11, 90);
  g.startMatch(2, 1);
  const rm = g.roundManager;
  const fojokId = rm.jokerIndicator.id;
  /* دورة كاملة بلا سحب الفوجوك */
  for (let t = 0; t < 2; t++) {
    const p = rm.getCurrentPlayer();
    g.executeMove({ type: 'draw_deck', playerId: p.id });
    g.executeMove({ type: 'discard', playerId: p.id, cardId: p.hand[0].id });
  }
  ok(!rm.isFirstTourCycle, 'انتهت الدورة الأولى');
  const p = rm.getCurrentPlayer();
  const rLate = g.executeMove({ type: 'draw_fojok', playerId: p.id });
  ok(!rLate.success, 'سحب الفوجوك بعد الدورة الأولى مرفوض');
  ok(g.getLegalMoves(p.id).every(m => m.type !== 'draw_fojok'), 'draw_fojok ليست ضمن الحركات القانونية بعد الدورة الأولى');
  /* نفاد ورق التوزيع → الفوجوك تُخلط مع المرموق */
  rm.drawPile = [];
  const rDraw = g.executeMove({ type: 'draw_deck', playerId: p.id });
  const fojokBack = rm.drawPile.some(c => c.id === fojokId) || p.hand.some(c => c.id === fojokId);
  ok(rDraw.success && fojokBack && rm.jokerIndicator === null, 'الفوجوك خُلطت مع المرموق عند نفاد ورق التوزيع');
  ok(g.rules.jokerIndicator !== null, 'تعريف الجوكر باقٍ بعد الخلط');
  ok(verifyRamiDeckIntegrity(g).ok, 'سلامة الرزمة بعد الخلط');
}

console.log('── 3) المرموق: سحب حر بلا جزاء + «ورقة أخرى» ──');
{
  const g = new RamiGame('simple', 2, 1, 21, 90);
  g.startMatch(2, 1);
  const rm = g.roundManager;
  const p1 = rm.getCurrentPlayer();
  g.executeMove({ type: 'draw_deck', playerId: p1.id });
  g.executeMove({ type: 'discard', playerId: p1.id, cardId: p1.hand[0].id });
  const p2 = rm.getCurrentPlayer();
  const moves = g.getLegalMoves(p2.id).map(m => m.type);
  ok(moves.indexOf('draw_discard') !== -1, 'سحب المرموق متاح بلا شروط');
  const rr = g.executeMove({ type: 'draw_discard', playerId: p2.id });
  ok(rr.success, 'سحب المرموق نجح');
  const marmId = rr.card.id;
  /* [V19.2] إرجاع نفس ورقة المرموق فوراً: مسموح لكن بجزاء +51 */
  const other = p2.hand.find(c => c.id !== marmId);
  const rOther = g.executeMove({ type: 'discard', playerId: p2.id, cardId: other.id });
  ok(rOther.success && !rOther.penaltyApplied && (p2.penaltyScore || 0) === 0, 'الاحتفاظ بالمرموق بلا افتتاح/إنهاء = بلا جزاء');
  const kept = p2.hand.find(c => c.id === marmId);
  ok(kept && !kept.fromDiscard && !kept.fromLaTour, 'المرموق يصبح حراً بعد نهاية الدور');
}

console.log('── 4) الافتتاح: متتالية حرة + متماثلة حرة + ≥51 ──');
{
  const rules = new RamiRules('simple', 90);
  const seq = (cards) => ({ type: MELD_TYPE.SEQUENCE, cards });
  const set = (cards) => ({ type: MELD_TYPE.SET, cards });
  /* متتالية فقط ≥51 → مرفوض */
  let r = rules.validateOpening([seq([C(10,'sword'), C(11,'sword'), C(12,'sword')]), seq([C(10,'heart'), C(11,'heart'), C(12,'heart')])], null, null, 0, false);
  ok(!r.valid, 'متتاليتان بلا متماثلة حرة → مرفوض');
  /* متتالية + متماثلة = 57 ≥ 51 → مقبول */
  r = rules.validateOpening([seq([C(10,'sword'), C(11,'sword'), C(12,'sword')]), set([C(9,'heart'), C(9,'diamond'), C(9,'sword')])], null, null, 0, false);
  ok(r.valid && r.freeScore === 57, 'متتالية(30) + متماثلة(27) = 57 → مقبول');
  /* أقل من 51 → مرفوض */
  r = rules.validateOpening([seq([C(2,'sword'), C(3,'sword'), C(4,'sword')]), set([C(5,'heart'), C(5,'diamond'), C(5,'sword')])], null, null, 0, false);
  ok(!r.valid, 'مجموع حر 24 < 51 → مرفوض');
  /* مجموعة تحوي ورقة المرموق المسحوبة لا تدخل العتبة */
  const marm = C(10, 'grape');
  r = rules.validateOpening([seq([C(10,'sword'), C(11,'sword'), C(12,'sword')]), set([C(9,'heart'), C(9,'diamond'), C(9,'sword')]), set([marm, C(10,'heart'), C(10,'diamond')])], marm, null, 0, false);
  ok(r.valid && r.freeScore === 57 && r.score === 87, 'مجموعة المرموق تُضاف للمجموع الكلي لا للعتبة');
  /* المتماثلة الوحيدة تحوي المرموق المسحوب → غير حرة → مرفوض */
  const marm2 = C(9, 'heart');
  r = rules.validateOpening([seq([C(10,'sword'), C(11,'sword'), C(12,'sword')]), set([marm2, C(9,'diamond'), C(9,'sword')])], marm2, null, 0, false);
  ok(!r.valid, 'المتماثلة الوحيدة بورقة المرموق (غير حرة هذا الدور) → مرفوض');
}

console.log('── 5) الإنهاء: 13 بمجموعات + ورقة الإنهاء الـ14 ──');
{
  const g = new RamiGame('simple', 2, 1, 33, 90);
  g.startMatch(2, 1);
  const rm = g.roundManager;
  /* تحييد الجوكر كي لا يتداخل مع اليد الاصطناعية */
  rm.jokerIndicator = null;
  g.rules.jokerIndicator = null;
  const p = rm.getCurrentPlayer();
  /* يد اصطناعية: 13 ورقة = 4 مجموعات (3+3+3+4) + سحب ورقة 14 للرمي */
  p.hand = [
    C(3,'sword'), C(4,'sword'), C(5,'sword'),            /* متتالية حرة */
    C(9,'heart'), C(9,'diamond'), C(9,'sword'),           /* متماثلة حرة */
    C(10,'heart'), C(11,'heart'), C(12,'heart'),          /* متتالية */
    C(2,'grape'), C(2,'heart'), C(2,'diamond'), C(2,'sword') /* متماثلة رباعية */
  ];
  p.displayCards = p.hand.slice();
  /* سحب من المجرف = الورقة الـ14 */
  const rd = g.executeMove({ type: 'draw_deck', playerId: p.id });
  ok(rd.success && p.hand.length === 14, 'سحب ورقة الإنهاء الـ14');
  ok(g.canFinish(p), 'canFinish: 13 بمجموعات صالحة + ورقة معزولة');
  const moves = g.getLegalMoves(p.id).map(m => m.type);
  ok(moves.indexOf('finish') !== -1, 'finish ضمن الحركات القانونية من اليد الكاملة (سامبل)');
  const rf = g.executeMove({ type: 'finish', playerId: p.id });
  ok(rf.success && rf.finished, 'الإنهاء نجح');
  ok(g.gamePhase === 'ROUND_END' || g.gamePhase === 'MATCH_END', 'الشوط انتهى');
}
{
  /* بلا متماثلة حرة → لا إنهاء */
  const g = new RamiGame('simple', 2, 1, 34, 90);
  g.startMatch(2, 1);
  const rm = g.roundManager;
  rm.jokerIndicator = null;
  g.rules.jokerIndicator = null;
  const p = rm.getCurrentPlayer();
  p.hand = [
    C(3,'sword'), C(4,'sword'), C(5,'sword'),
    C(6,'heart'), C(7,'heart'), C(8,'heart'),
    C(10,'heart'), C(11,'heart'), C(12,'heart'),
    C(2,'grape'), C(3,'grape'), C(4,'grape'), C(5,'grape')
  ];
  p.displayCards = p.hand.slice();
  g.executeMove({ type: 'draw_deck', playerId: p.id });
  ok(!g.canFinish(p), 'بلا متماثلة حرة → canFinish=false');
}

console.log('── 8) [v19.2] الحرة تبقى حرة في دور الافتتاح فقط ──');
{
  /* افتتاح بمجموعتي جوكر بلا متتالية حرة (سيناريو السكرين شوت) يجب رفضه */
  const rules = new RamiRules('simple', 90);
  rules.jokerIndicator = { id: 'IND', rank: 6, suit: 'sword', isJoker: false }; /* المؤشر 6 أسود → الجوكر 6 أحمر */
  ok(rules.isWildCard(C(6, 'heart')), 'الـ 6 الأحمر ورقة برية (جوكر الجولة)');
  const m1 = { type: MELD_TYPE.SEQUENCE, cards: [C(6, 'heart'), C(7, 'heart'), C(8, 'heart'), C(9, 'heart')] };
  const m2 = { type: MELD_TYPE.SEQUENCE, cards: [C(6, 'diamond'), C(7, 'grape'), C(8, 'grape')] };
  const m3 = { type: MELD_TYPE.SET, cards: [C(12, 'diamond'), C(12, 'grape'), C(12, 'sword')] };
  const r = rules.validateOpening([m1, m2, m3], null, null, 0, false);
  ok(!r.valid, 'افتتاح بمتتاليتين بجوكر + متماثلة حرة فقط → مرفوض (لا متتالية حرة)');
}
{
  /* الإدراج: جوكر لا يدخل مجموعة حرة أُنزلت هذا الدور — ويدخلها في الأدوار الموالية */
  const g = new RamiGame('simple', 2, 1, 77, 90);
  g.startMatch(2, 1);
  const rm = g.roundManager;
  rm.jokerIndicator = { id: 'IND2', rank: 6, suit: 'sword', isJoker: false };
  g.rules.jokerIndicator = rm.jokerIndicator;
  const joker = C(6, 'heart');            /* برية */
  const freeMeld = { type: MELD_TYPE.SEQUENCE, cards: [C(9, 'sword'), C(10, 'sword'), C(11, 'sword')], _justOpened: true };
  const wildMeld = { type: MELD_TYPE.SEQUENCE, cards: [C(9, 'grape'), C(10, 'grape'), C(6, 'heart')], _justOpened: true }; /* فيها برية */
  rm.tableMelds = [freeMeld];
  ok(!RamiExpertAI.canLayOff(g.rules, freeMeld, joker), 'canLayOff: جوكر في متتالية حرة أُنزلت هذا الدور → مرفوض');
  ok(cardFitsMeld ? !cardFitsMeld(joker, freeMeld, g.rules) : true, 'cardFitsMeld: جوكر في متتالية حرة أُنزلت هذا الدور → مرفوض');
  ok(!g.doesCardFitAnyTableMeld(joker), 'doesCardFitAnyTableMeld: حرة نفس الدور → false للجوكر');
  /* ورقة المرموق المسحوبة نفس الدور محظورة كذلك في الحرة نفس الدور */
  const drawn = C(12, 'sword'); drawn.fromDiscard = true;
  ok(!RamiExpertAI.canLayOff(g.rules, freeMeld, drawn, drawn), 'canLayOff: مرموق نفس الدور في حرة نفس الدور → مرفوض');
  rm.tableMelds = [freeMeld, wildMeld];
  ok(RamiExpertAI.canLayOff(g.rules, wildMeld, C(8, 'grape')), 'canLayOff: ورقة عادية في مجموعة بجوكر → مقبول');
  ok(RamiExpertAI.canLayOff(g.rules, freeMeld, C(12, 'sword')), 'canLayOff: ورقة عادية في متتالية حرة → مقبول');
  /* بانتهاء الدور تسقط الحماية: nextPlayer يمسح _justOpened ويصبح الجوكر مقبولاً */
  rm.nextPlayer();
  ok(!freeMeld._justOpened, 'nextPlayer يمسح وسم _justOpened');
  ok(RamiExpertAI.canLayOff(g.rules, freeMeld, joker), 'canLayOff: جوكر في متتالية حرة في دور موالٍ → مقبول');
  ok(g.doesCardFitAnyTableMeld(joker), 'doesCardFitAnyTableMeld: دور موالٍ → true للجوكر');
  ok(cardFitsMeld ? cardFitsMeld(joker, freeMeld, g.rules) : true, 'cardFitsMeld: جوكر في حرة دور موالٍ → مقبول');
}

console.log('── 9) [v19.2] رمي المرموق/الفوجوك المسحوبة نفس الدور = جزاء 51 ──');
{
  /* رمي المرموق المسحوبة نفس الدور: مسموح + جزاء 51 */
  const g = new RamiGame('simple', 2, 1, 88, 90);
  g.startMatch(2, 1);
  const rm = g.roundManager;
  rm.jokerIndicator = null; g.rules.jokerIndicator = null;
  const p = rm.getCurrentPlayer();
  const marm = C(9, 'diamond');
  rm.discardPile.push(marm);
  const rd = g.executeMove({ type: 'draw_discard', playerId: p.id });
  ok(rd.success, 'سحب المرموق نجح');
  const before = p.penaltyScore || 0;
  const rdisc = g.executeMove({ type: 'discard', playerId: p.id, cardId: marm.id });
  ok(rdisc.success, 'رمي نفس ورقة المرموق في نفس الدور مسموح (ليس مرفوضاً)');
  ok((p.penaltyScore || 0) === before + 51, 'جزاء +51 قُيّد على الرامي (' + (p.penaltyScore || 0) + ')');
  ok(rm.discardPile[rm.discardPile.length - 1].id === marm.id, 'الورقة عادت لكومة المرموق');
}
{
  /* رمي الفوجوك المسحوبة نفس الدور: جزاء 51 + تتحول مرموقاً عادياً (لا فوجوك بعدها) */
  const g = new RamiGame('simple', 2, 1, 99, 90);
  g.startMatch(2, 1);
  const rm = g.roundManager;
  const p = rm.getCurrentPlayer();
  ok(!!rm.jokerIndicator, 'الفوجوك مقلوبة في بداية الشوط');
  const fojokId = rm.jokerIndicator.id;
  const rf = g.executeMove({ type: 'draw_fojok', playerId: p.id });
  ok(rf.success && rf.isFojok, 'سحب الفوجوك في الدور الأول نجح');
  ok(p.drawnFojokCard && p.drawnFojokCard.id === fojokId, 'drawnFojokCard مسجلة');
  const before = p.penaltyScore || 0;
  const rdisc = g.executeMove({ type: 'discard', playerId: p.id, cardId: fojokId });
  ok(rdisc.success, 'رمي الفوجوك في نفس الدور مسموح');
  ok((p.penaltyScore || 0) === before + 51, 'جزاء +51 على رامي الفوجوك');
  ok(rm.jokerIndicator === null, 'الفوجوك لم تعد معروضة كفوجوك (صارت مرموقاً عادياً)');
  ok(rm.discardPile[rm.discardPile.length - 1].id === fojokId, 'الفوجوك المرمية فوق كومة المرموق — لصاحب الدور التالي كمرموق عادي');
  /* اللاعب التالي يأخذها كمرموق عادي بلا جزاء */
  const p2 = rm.getCurrentPlayer();
  ok(p2.id !== p.id, 'الدور انتقل للاعب التالي');
  const rd2 = g.executeMove({ type: 'draw_discard', playerId: p2.id });
  ok(rd2.success && rd2.card.id === fojokId, 'اللاعب التالي سحبها كمرموق عادي');
  ok(!(rd2.isFojok), 'السحب ليس سحب فوجوك');
}
{
  /* الخبير لا يرمي المسحوبة نفس الدور أبداً */
  const g = new RamiGame('simple', 2, 1, 111, 90);
  g.startMatch(2, 1);
  const rm = g.roundManager;
  rm.jokerIndicator = null; g.rules.jokerIndicator = null;
  const p = rm.getCurrentPlayer();
  const marm = C(13, 'sword');
  rm.discardPile.push(marm);
  g.executeMove({ type: 'draw_discard', playerId: p.id });
  const did = RamiExpertAI.chooseDiscard(g, p);
  ok(did !== marm.id, 'الخبير لا يختار رمي المرموق المسحوبة نفس الدور');
}

console.log('\n═══ Rami Sample v19: ' + pass + '/' + (pass + fail) + ' passed ═══');
process.exit(fail ? 1 : 0);
