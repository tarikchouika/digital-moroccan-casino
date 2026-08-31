const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 400, height: 712 }, hasTouch: true, deviceScaleFactor: 2 })).newPage();
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH !== null, null, { timeout: 15000 });
  await p.waitForTimeout(400);
  await p.evaluate(() => openGame('bl8'));
  await p.waitForFunction(() => !!BILLIARDS, null, { timeout: 10000 });
  await p.evaluate(() => billiardsStartLocal());
  await p.waitForFunction(() => !!(BILLIARDS.G && BILLIARDS.VT), null, { timeout: 10000 });
  await p.evaluate(() => enterAppFullscreen());
  await p.waitForTimeout(400);
  const m = await p.evaluate(() => {
    const e = document.getElementById('gameFsExit');
    const c = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { disp: c.display, bg: c.backgroundImage.slice(0, 40), z: c.zIndex, rect: [r.left, r.top, r.width, r.height], at: at ? (at.id || at.className) : null, bodyCls: document.body.className, pgCls: document.getElementById('pg-game').className };
  });
  console.log(JSON.stringify(m));
  await b.close();
})();
