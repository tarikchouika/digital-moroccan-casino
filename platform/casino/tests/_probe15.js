const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH !== null, null, { timeout: 15000 });
  await p.evaluate(() => openGame('blbb'));
  await p.waitForFunction(() => !!BILLIARDS, null, { timeout: 10000 });
  await p.evaluate(() => billiardsStartLocal());
  await p.waitForFunction(() => !!(BILLIARDS.G && BILLIARDS.VT), null, { timeout: 10000 });
  await p.waitForTimeout(400);
  const m = await p.evaluate(() => {
    const out = [];
    let e = document.getElementById('gameFsBtn');
    while (e && e !== document.body) { const c = getComputedStyle(e); out.push((e.id || e.className) + '|' + c.display + '|' + c.visibility + '|' + c.opacity); e = e.parentElement; }
    return out;
  });
  console.log(JSON.stringify(m, null, 1));
  await b.close();
})();
