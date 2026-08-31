const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:3000/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH !== null, null, { timeout: 15000 });
  await p.waitForTimeout(400);
  await p.evaluate(() => openGame('bl8'));
  await p.waitForFunction(() => !!BILLIARDS, null, { timeout: 8000 });
  await p.evaluate(() => billiardsStartLocal());
  await p.waitForTimeout(1200);
  const m = await p.evaluate(() => {
    const cv = document.getElementById('blCv');
    const st = document.querySelector('.bl-stage');
    return { errs: window.__e, cv: cv ? { w: cv.width, h: cv.height, cw: cv.clientWidth, ch: cv.clientHeight } : null,
      st: st ? st.getBoundingClientRect() : null, raf: BILLIARDS ? !!BILLIARDS.raf : null,
      gpb: document.getElementById('gamePageBody').getBoundingClientRect(),
      pg: document.getElementById('pg-game').getBoundingClientRect() };
  });
  console.log(JSON.stringify({ m, errs }, null, 1));
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
