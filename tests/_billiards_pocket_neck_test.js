global.window={}; require(__dirname+'/../js/games/billiards-physics.js');
const P=global.window.BilliardsPhysics;
const t=P.TABLES.eightball;
const side=t.pockets.find(p=>p.y<0);
function mk(x,y,vx,vy){return{id:1,type:'SOLID',x,y,vx,vy,r:t.R,status:'ON_TABLE',phase:0};}
function run(b,steps){const rec=P.newRec();for(let i=0;i<steps;i++){P.step(t,[b],1,rec);if(b.status!=='ON_TABLE')return{sank:b.status==='POCKETED',rec};if(b.vx===0&&b.vy===0&&i>3)break;}return{sank:false,rec};}
let pass=0,fail=0;
function T(name,cond){cond?pass++:fail++;console.log((cond?'✓':'✗ FAILED')+' '+name);}
// 1) كرة ساكنة في عنق الحفرة الجانبية (مركزها عند 0.99r من مركز الحفرة) لا تسقط
const nb=mk(side.x, t.R*0.6, 0, 0);
T('كرة مستقرة في العنق لا تُبتلع (d=0.99r)', !run(nb,10).sank);
// 2) كرة سريعة نحو مركز الحفرة تسقط
const fb=mk(side.x, t.R*3, 0, -6);
T('كرة مندفعة عبر الفم تسقط', run(fb,200).sank);
// 3) كرة بطيئة تتوقف في العنق ولا تسقط
const sb=mk(side.x, t.R*2.4, 0, -0.4);
const r3=run(sb,900);
T('كرة بطيئة تستقر في العنق ولا تسقط (y='+sb.y.toFixed(1)+')', !r3.sank);
// 4) قرب الركن خارج الشفة: لا سقوط
const c=t.pockets[0];
const cb=mk(c.x+c.r*0.75, c.y+c.r*0.75, 0, 0); // d=1.06r > 0.95r
T('كرة على شفة الركن (d=1.06r) لا تسقط', !run(cb,10).sank);
// 5) داخل الشفة الفعلية: تسقط فوراً
const ib=mk(side.x, -1, 0, 0); // قرب مركز الحفرة
T('كرة مركزها داخل الحفرة (d<0.95r) تسقط', run(ib,3).sank);
console.log('═══ neck: '+pass+'/'+(pass+fail)+' passed ═══');
process.exit(fail?1:0);
