const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH !== null, null, { timeout: 15000 });
  await p.evaluate(() => openGame('bl8'));
  await p.waitForFunction(() => !!BILLIARDS, null, { timeout: 10000 });
  await p.evaluate(() => billiardsStartAI());
  await p.waitForFunction(() => BILLIARDS.G && BILLIARDS.G.S.phase === 'AIM', null, { timeout: 10000 });
  await p.evaluate(() => { BILLIARDS.aim = 0; BILLIARDS.power = 95; billiardsShoot(); });
  await p.waitForTimeout(6000);
  const m = await p.evaluate(() => ({ h: BILLIARDS.G.S.history.length, phase: BILLIARDS.G.S.phase, active: BILLIARDS.G.S.active, mode: BILLIARDS.mode, over: BILLIARDS.G.S.frameOver }));
  console.log('after break', JSON.stringify(m));
  await p.waitForTimeout(12000);
  const m2 = await p.evaluate(() => ({ h: BILLIARDS.G.S.history.length, phase: BILLIARDS.G.S.phase, active: BILLIARDS.G.S.active, players: BILLIARDS.G.S.history.map(e => e.player_id) }));
  console.log('later', JSON.stringify(m2));
  await b.close();
})();
