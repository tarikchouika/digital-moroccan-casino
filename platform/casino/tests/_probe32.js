const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
  await p.goto('http://localhost:3000/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH !== null, null, { timeout: 15000 });
  await p.waitForTimeout(300);
  await p.evaluate(() => openGame('bl8'));
  await p.waitForFunction(() => !!BILLIARDS, null, { timeout: 8000 });
  await p.evaluate(() => billiardsStartLocal());
  await p.waitForTimeout(600);
  const m = await p.evaluate(() => {
    const back = document.querySelector('.gp-head-left > .btn.icon-btn');
    const c = getComputedStyle(back);
    const head = getComputedStyle(document.querySelector('.gp-head'));
    return { back: { disp: c.display, pos: c.position, r: back.getBoundingClientRect() }, headDisp: head.display,
      fsBtn: getComputedStyle(document.getElementById('gameFsBtn')).display };
  });
  console.log(JSON.stringify(m));
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
