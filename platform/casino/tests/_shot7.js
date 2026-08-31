const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:3000/';
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const jobs = [
    ['bl-v11-min.png', false],
    ['bl-v11-fs.png', true]
  ];
  for (const [name, fs] of jobs) {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 })).newPage();
    await p.goto(BASE, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH !== null, null, { timeout: 15000 });
    await p.waitForTimeout(400);
    await p.evaluate(() => openGame('bl8'));
    await p.waitForFunction(() => !!BILLIARDS, null, { timeout: 10000 });
    await p.evaluate(() => billiardsStartLocal());
    await p.waitForFunction(() => !!(BILLIARDS.G && BILLIARDS.VT), null, { timeout: 10000 });
    if (fs) { await p.evaluate(() => enterAppFullscreen()); await p.waitForTimeout(400); }
    else { await p.evaluate(() => exitAppFullscreen()); await p.waitForTimeout(500); }
    await p.waitForTimeout(600);
    await p.screenshot({ path: '/home/user/screenshots/' + name });
    await p.close();
    console.log('shot ' + name);
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
