const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto('http://localhost:3000/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH !== null, null, { timeout: 15000 });
  await p.evaluate(() => openGame('bl8'));
  await p.waitForFunction(() => !!BILLIARDS, null, { timeout: 8000 });
  await p.evaluate(() => billiardsStartLocal());
  await p.waitForFunction(() => !!(BILLIARDS.G && BILLIARDS.VT), null, { timeout: 8000 });
  await p.evaluate(() => enterAppFullscreen());
  await p.waitForTimeout(400);
  const m = await p.evaluate(() => {
    const pg = document.getElementById('pg-game');
    const c = getComputedStyle(pg);
    const body = getComputedStyle(document.body);
    const stage = getComputedStyle(document.getElementById('billiardsStage'));
    return { pgBg: c.backgroundColor, pgImg: c.backgroundImage.slice(0, 60), bodyBg: body.backgroundColor, stageBg: stage.backgroundColor, matches: pg.matches(':has(#billiardsStage)') };
  });
  console.log(JSON.stringify(m, null, 1));
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
