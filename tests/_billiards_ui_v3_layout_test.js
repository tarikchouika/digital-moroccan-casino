/* اختبار jsdom لتخطيط UI-v3 — يتطلب jsdom (npm i jsdom في /tmp/domtest) */
let JSDOM;
try { JSDOM = require('/tmp/domtest/node_modules/jsdom').JSDOM; }
catch (e) { try { JSDOM = require('jsdom').JSDOM; } catch (e2) { console.log('SKIP: jsdom غير مثبت'); process.exit(0); } }
const fs = require('fs');
const dom = new JSDOM('<!doctype html><body><div id="pg-game"><div id="gamePageBody"></div></div><button id="gameFsExit" style="display:none"></button></body>', { pretendToBeVisual: true, runScripts: 'outside-only' });
const W = dom.window, document = W.document;
W.T = k=>k; W.gFrame = i=>'<div class="stage">'+i+'</div>'; W.RULES={}; W.langIndex=()=>0; W.SND={}; W.toast=()=>{};
W.requestAnimationFrame = f=>setTimeout(f,0); W.cancelAnimationFrame = clearTimeout;
W.ResizeObserver = class { observe(){} disconnect(){} };
const load = p=>W.eval(fs.readFileSync(p,'utf8').replace('"use strict";',''));
const R = __dirname + '/../js/games/';
load(R+'billiards-physics.js'); load(R+'billiards-rules.js'); load(R+'billiards.js');
let pass=0, fail=0;
const ok=(c,n)=>{ c?pass++:fail++; console.log((c?'✓ ':'✗ FAILED ')+n); };

W._currentGameId = 'bl8';
document.getElementById('gamePageBody').innerHTML = W.eBilliards({ id:'bl8', rtp: 97 });
ok(!document.getElementById('blVariants'), 'شاشة الإعداد بلا اختيار صنف');
W.initBilliards();
ok(W.BILLIARDS.variant === 'eightball', 'bl8 → eightball');
W._currentGameId = 'blsn'; W.initBilliards();
ok(W.BILLIARDS.variant === 'snooker', 'blsn → snooker');

W._currentGameId = 'bl8';
document.getElementById('gamePageBody').innerHTML = W.eBilliards({ id:'bl8', rtp: 97 });
W.initBilliards();
W.BILLIARDS.G = W.BilliardsRules.eightball({});
const frame = document.getElementById('blFrame');
const size = (w,h)=>{ Object.defineProperty(frame,'clientWidth',{value:w,configurable:true}); Object.defineProperty(frame,'clientHeight',{value:h,configurable:true}); frame._blOriented=false; };
size(800,360); W.blOrientLayout();
const lr=document.getElementById('blLRail'), rail=document.getElementById('blRail'), ltop=document.getElementById('blLTop');
ok(rail && rail.classList.contains('bl-rail'), 'blRail هو عمود الأدوات (bl-rail) لا select الحواف');
ok(frame.classList.contains('bl-land'), 'لاندسكيب: bl-land');
ok(ltop.contains(document.getElementById('blRotBtn')) && ltop.contains(document.getElementById('blAv1')), 'لاندسكيب: تدوير+أفاتار الخصم أعلى يسار');
ok(lr.contains(document.getElementById('blSpin')) && lr.contains(document.getElementById('blTrayL')), 'لاندسكيب: دوران+صينية الخصم يساراً');
['blAv0','blCell0','blTrayR','blPower','blShoot'].forEach(id=>ok(rail.contains(document.getElementById(id)), 'لاندسكيب يمين: '+id));
size(360,800); W.blOrientLayout();
ok(!frame.classList.contains('bl-land'), 'بورتريه: bl-land أزيل');
ok(document.getElementById('blTopbar').contains(document.getElementById('blRotBtn')), 'بورتريه: التدوير بالشريط العلوي');
['blAv1','blCell1','blShoot','blSpin','blPower','blTrayR','blCell0','blAv0'].forEach(id=>ok(rail.contains(document.getElementById(id)), 'بورتريه يمين: '+id));
size(800,360); W.blOrientLayout();
['blRotBtn','blAv1','blCell1','blTrayL','blSpin','blAv0','blCell0','blTrayR','blPower','blShoot'].forEach(id=>ok(!!document.getElementById(id), 'ذهاب-إياب: '+id));
console.log('═══ UI-v3 layout: '+pass+'/'+(pass+fail)+' passed ═══');
process.exit(fail?1:0);
