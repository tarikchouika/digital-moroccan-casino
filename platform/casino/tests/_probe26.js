const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
  await p.goto('http://localhost:3000/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH !== null, null, { timeout: 15000 });
  await p.waitForTimeout(600);
  await p.evaluate(() => openGame('blbb'));
  await p.waitForFunction(() => !!BILLIARDS, null, { timeout: 8000 });
  await p.evaluate(() => billiardsStartLocal());
  await p.waitForTimeout(800);
  await p.evaluate(() => enterAppFullscreen());
  await p.waitForTimeout(500);
  const m = await p.evaluate(() => {
    const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: +b.left.toFixed(1), r: +b.right.toFixed(1), w: +b.width.toFixed(1) }; };
    const stage = r('.bl-stage'), rail = r('.bl-rail'), spin = r('.bl-spin'), fs = r('#gameFsExit');
    return { stage, rail, spin, fs,
      rightTouchesRail: Math.abs(rail.l - stage.r) <= 3,
      spinTouchesTable: Math.abs(spin.l - stage.r) <= 8 };
  });
  console.log(JSON.stringify(m));
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
