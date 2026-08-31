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
  await p.waitForTimeout(400);
  const m = await p.evaluate(() => {
    const f = document.querySelector('.bl-frame');
    const chain = [];
    let e = f;
    while (e && e !== document.body) {
      const cs = getComputedStyle(e);
      const q = e.getBoundingClientRect();
      chain.push({ id: e.id || e.className, pos: cs.position, margin: cs.margin, padding: cs.padding, rect: [Math.round(q.left), Math.round(q.top), Math.round(q.right), Math.round(q.bottom)] });
      e = e.parentElement;
    }
    const cs = getComputedStyle(f);
    return { frameCss: { pos: cs.position, inset: cs.inset, margin: cs.margin, width: cs.width, height: cs.height, top: cs.top, left: cs.left, bottom: cs.bottom, right: cs.right }, chain };
  });
  console.log(JSON.stringify(m, null, 1));
  await b.close();
})();
