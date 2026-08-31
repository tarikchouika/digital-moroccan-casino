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
  await p.waitForTimeout(500);
  const m = await p.evaluate(() => {
    const f = document.getElementById('gameFsExit').getBoundingClientRect();
    const st = document.querySelector('.bl-stage').getBoundingClientRect();
    const fr = document.querySelector('.bl-frame').getBoundingClientRect();
    const rl = document.querySelector('.bl-rail').getBoundingClientRect();
    return { btn: [f.left, f.top, f.right, f.bottom], stage: [st.left, st.top, st.right, st.bottom], frame: [fr.left, fr.top, fr.right, fr.bottom], rail: [rl.left, rl.right], inner: [innerWidth, innerHeight], topAnchor: BILLIARDS._blTopAnchor };
  });
  console.log(JSON.stringify(m));
  await b.close();
})();
