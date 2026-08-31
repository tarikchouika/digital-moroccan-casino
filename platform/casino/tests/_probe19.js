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
    const e = document.getElementById('gameFsExit');
    const out = { parent: e.parentElement.id || e.parentElement.tagName, vis: getComputedStyle(e).visibility, op: getComputedStyle(e).opacity };
    const r = e.getBoundingClientRect();
    out.before = (document.elementFromPoint(r.left + 15, r.top + 15) || {}).id;
    e.style.zIndex = '99999';
    out.after = (document.elementFromPoint(r.left + 15, r.top + 15) || {}).id;
    // أسلاف بـ transform/filter
    let a = e.parentElement, chain = [];
    while (a && a !== document.documentElement) { const c = getComputedStyle(a); if (c.transform !== 'none' || c.filter !== 'none' || c.backdropFilter !== 'none' || c.contain !== 'none' || c.zIndex !== 'auto') chain.push((a.id || a.className) + ':' + c.zIndex + '/' + c.transform + '/' + c.contain); a = a.parentElement; }
    out.chain = chain;
    return out;
  });
  console.log(JSON.stringify(m, null, 1));
  await b.close();
})();
