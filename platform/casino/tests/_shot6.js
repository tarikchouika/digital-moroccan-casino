/* لقطات v10: ملء الشاشة (قرص الدوران فوق الضلع + خلفية ماهوغني)، سنوكر بحفر أصغر، ووضع مصغّر */
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:3000/';
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const jobs = [
    ['bl-v10-fs-8ball.png', { width: 1280, height: 800 }, 'bl8', true],
    ['bl-v10-fs-snooker.png', { width: 1280, height: 800 }, 'blsn', true],
    ['bl-v10-min.png', { width: 390, height: 844 }, 'bl8', false]
  ];
  for (const [name, vp, game, fs] of jobs) {
    const p = await (await b.newContext({ viewport: vp, hasTouch: true, deviceScaleFactor: 2 })).newPage();
    await p.goto(BASE, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH !== null, null, { timeout: 15000 });
    await p.waitForTimeout(400);
    await p.evaluate((g) => openGame(g), game);
    await p.waitForFunction(() => !!BILLIARDS, null, { timeout: 10000 });
    await p.evaluate(() => billiardsStartLocal());
    await p.waitForFunction(() => !!(BILLIARDS.G && BILLIARDS.VT), null, { timeout: 10000 });
    if (fs) { await p.evaluate(() => enterAppFullscreen()); await p.waitForTimeout(400); }
    await p.evaluate(() => { if (BILLIARDS.G.S.phase === 'AIM') BILLIARDS.aim = -0.6; });
    await p.waitForTimeout(700);
    await p.screenshot({ path: '/home/user/screenshots/' + name });
    await p.close();
    console.log('shot ' + name);
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
