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
    const head = document.querySelector('.gp-head');
    return { body: document.body.className,
      match: head.matches('body.bl-game-open:not(.app-fs-on) #pg-game .gp-head'),
      cssText: (() => { for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) { if (r.selectorText && r.selectorText.includes('bl-game-open') && r.selectorText.includes('gp-head') && !r.selectorText.includes('ptitle') && !r.selectorText.includes('gameFsBtn') && !r.selectorText.includes('head-left') && !r.selectorText.includes('head-right')) return r.cssText.slice(0, 220); } } catch (e) {} } return 'NOT FOUND'; })() };
  });
  console.log(JSON.stringify(m, null, 1));
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
