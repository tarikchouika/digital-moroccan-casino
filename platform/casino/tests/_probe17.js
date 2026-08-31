const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH !== null, null, { timeout: 15000 });
  await p.evaluate(() => openGame('bl8'));
  await p.waitForFunction(() => !!BILLIARDS, null, { timeout: 10000 });
  await p.evaluate(() => billiardsStartLocal());
  await p.waitForFunction(() => !!(BILLIARDS.G && BILLIARDS.VT), null, { timeout: 10000 });
  await p.waitForTimeout(500);
  const m = await p.evaluate(() => {
    const fr = document.querySelector('.bl-frame').getBoundingClientRect();
    const st = document.querySelector('.bl-stage').getBoundingClientRect();
    const tb = document.querySelector('.bl-topbar').getBoundingClientRect();
    const rl = document.querySelector('.bl-rail').getBoundingClientRect();
    return { share: st.width / fr.width, flushL: st.left - fr.left, flushB: st.bottom - fr.bottom, topA: tb.bottom - st.top, rightA: rl.left - st.right };
  });
  console.log(JSON.stringify(m));
  await b.close();
})();
