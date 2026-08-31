const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 400, height: 712 }, hasTouch: true })).newPage();
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH !== null, null, { timeout: 15000 });
  await p.evaluate(() => openGame('bl8'));
  await p.waitForFunction(() => !!BILLIARDS, null, { timeout: 10000 });
  await p.evaluate(() => billiardsStartLocal());
  await p.waitForFunction(() => !!(BILLIARDS.G && BILLIARDS.VT), null, { timeout: 10000 });
  await p.evaluate(() => enterAppFullscreen());
  await p.waitForTimeout(300);
  const m = await p.evaluate(() => {
    const out = [];
    let a = document.getElementById('pg-game');
    while (a && a !== document.documentElement) { const c = getComputedStyle(a); out.push((a.id || a.tagName) + ' z=' + c.zIndex + ' pos=' + c.position + ' tf=' + (c.transform !== 'none') + ' bf=' + (c.backdropFilter !== 'none')); a = a.parentElement; }
    return out;
  });
  console.log(JSON.stringify(m, null, 1));
  await b.close();
})();
