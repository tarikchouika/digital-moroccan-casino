const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => console.log('PAGEERR:', e.message));
  await p.goto('http://localhost:3000/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH !== null, null, { timeout: 15000 });
  await p.waitForTimeout(500);
  await p.evaluate(() => openGame('bl8'));
  await p.waitForFunction(() => !!BILLIARDS, null, { timeout: 8000 });
  await p.evaluate(() => billiardsStartAI());
  await p.waitForFunction(() => !!(BILLIARDS.G && BILLIARDS.G.S.phase), null, { timeout: 8000 });
  await p.evaluate(() => { BILLIARDS.aim = 0; BILLIARDS.power = 95; billiardsShoot(); });
  for (let i = 0; i < 30; i++) {
    await p.waitForTimeout(500);
    const st = await p.evaluate(() => BILLIARDS.G.S.phase + ':' + BILLIARDS.G.S.active);
    if (st.startsWith('AIM:1') || st.startsWith('PLACE:1') || st.startsWith('SHOT:1')) break;
    if (st.startsWith('PLACE:0')) await p.evaluate(() => { for (let x = 60; x < 940; x += 25) for (let y = 40; y < 470; y += 25) if (BILLIARDS.G.validPlace(x, y)) { BILLIARDS.G.place(x, y); return; } });
    else if (st.startsWith('AIM:0')) await p.evaluate(() => { BILLIARDS.aim = -Math.PI / 2; BILLIARDS.power = 12; billiardsShoot(); });
  }
  console.log('state:', await p.evaluate(() => JSON.stringify({ ph: BILLIARDS.G.S.phase, act: BILLIARDS.G.S.active, mode: BILLIARDS.mode, hasPlan: typeof BILLIARDS.G.aiPlan, pend: !!BILLIARDS._aiPending, aiAim: !!BILLIARDS._aiAim })));
  await p.evaluate(() => { window.__tr = []; const G = BILLIARDS.G; G.on(ev => window.__tr.push(ev && ev.type)); setInterval(() => window.__tr.push('S:' + BILLIARDS.G.S.phase + ':' + BILLIARDS.G.S.active + (BILLIARDS._aiAim ? ':AI' : '')), 400); });
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(2000);
    console.log('t+' + (i * 2 + 2) + 's', await p.evaluate(() => JSON.stringify({ ph: BILLIARDS.G.S.phase, act: BILLIARDS.G.S.active, aiAim: !!BILLIARDS._aiAim, pend: !!BILLIARDS._aiPending, hist: BILLIARDS.G.S.history.length })));
  }
  console.log('trace:', (await p.evaluate(() => window.__tr)).filter((v, i, a) => v !== a[i - 1]).slice(0, 30).join(' '));
  const seen = null;
  console.log('AI aiming visible:', JSON.stringify(seen));
  const a1 = await p.evaluate(() => BILLIARDS.aim);
  await p.waitForTimeout(500);
  const a2 = await p.evaluate(() => BILLIARDS.aim);
  console.log('aim moving:', a1.toFixed(3), '->', a2.toFixed(3), a1 !== a2);
  await p.waitForFunction(() => BILLIARDS.G.S.history.some(e => e.player_id === 1), null, { timeout: 30000 });
  console.log('AI shot recorded: true');
  await b.close();
})().catch(async e => { console.error('ERR', e.message); try { console.log('final:', await p.evaluate(() => JSON.stringify({ ph: BILLIARDS.G.S.phase, act: BILLIARDS.G.S.active, hist: BILLIARDS.G.S.history.length, aiAim: !!BILLIARDS._aiAim, pend: !!BILLIARDS._aiPending }))); } catch (e2) {} process.exit(1); });
