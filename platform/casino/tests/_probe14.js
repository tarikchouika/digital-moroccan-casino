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
  await p.waitForTimeout(500);
  const m = await p.evaluate(() => {
    const e = document.getElementById('gameFsBtn');
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    const st = document.querySelector('.bl-stage').getBoundingClientRect();
    return { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
      pos: cs.position, left: cs.left, top: cs.top, disp: cs.display, w: cs.width,
      vars: [getComputedStyle(document.documentElement).getPropertyValue('--bl-fs-x'), getComputedStyle(document.documentElement).getPropertyValue('--bl-fs-y')],
      stage: [Math.round(st.right), Math.round(st.top)] };
  });
  console.log(JSON.stringify(m));
  await b.close();
})();
