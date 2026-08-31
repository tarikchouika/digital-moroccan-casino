const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto('http://localhost:3000/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH !== null, null, { timeout: 15000 });
  await p.waitForTimeout(400);
  await p.evaluate(() => openGame('bl8'));
  await p.waitForFunction(() => !!BILLIARDS, null, { timeout: 8000 });
  await p.evaluate(() => billiardsStartLocal());
  await p.waitForFunction(() => !!(BILLIARDS.G && BILLIARDS.VT), null, { timeout: 8000 });
  await p.evaluate(() => enterAppFullscreen());
  await p.waitForTimeout(500);
  const m = await p.evaluate(() => {
    const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: +b.left.toFixed(1), r: +b.right.toFixed(1), t: +b.top.toFixed(1), b: +b.bottom.toFixed(1), w: +b.width.toFixed(1) }; };
    return {
      body: document.body.className,
      stage: r('#billiardsStage'), stage2: r('.bl-stage'), rail: r('.bl-rail'), spin: r('#blSpin'),
      spinW: getComputedStyle(document.querySelector('#blSpin')).width,
      gpb: r('#gamePageBody'), pg: r('#pg-game')
    };
  });
  console.log(JSON.stringify(m, null, 1));
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
