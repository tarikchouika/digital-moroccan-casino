const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 400, height: 712 }, hasTouch: true, deviceScaleFactor: 2 })).newPage();
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH !== null, null, { timeout: 15000 });
  await p.evaluate(() => openGame('bl8'));
  await p.waitForFunction(() => !!BILLIARDS, null, { timeout: 10000 });
  await p.evaluate(() => billiardsStartLocal());
  await p.waitForFunction(() => !!(BILLIARDS.G && BILLIARDS.VT), null, { timeout: 10000 });
  await p.evaluate(() => enterAppFullscreen());
  await p.waitForTimeout(400);
  const m = await p.evaluate(() => {
    const e = document.getElementById('gameFsExit');
    return { pe: getComputedStyle(e).pointerEvents, disabled: e.disabled, cls: e.className };
  });
  console.log(JSON.stringify(m));
  await p.screenshot({ path: '/home/user/screenshots/_corner.png', clip: { x: 330, y: 0, width: 70, height: 70 } });
  await b.close();
})();
