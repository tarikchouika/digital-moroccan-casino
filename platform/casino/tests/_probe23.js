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
  await p.waitForTimeout(300);
  const m = await p.evaluate(() => {
    const e = document.getElementById('gameFsExit');
    e.style.display = 'none'; void e.offsetHeight; e.style.display = 'inline-flex';
    const r = e.getBoundingClientRect();
    return { at: (document.elementFromPoint(r.left + 15, r.top + 15) || {}).id || (document.elementFromPoint(r.left + 15, r.top + 15) || {}).className };
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: '/home/user/screenshots/_corner3.png', clip: { x: 330, y: 0, width: 70, height: 70 } });
  console.log(JSON.stringify(m));
  await b.close();
})();
