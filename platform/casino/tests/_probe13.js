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
  await p.waitForTimeout(300);
  const m = await p.evaluate(() => {
    const st = document.getElementById('billiardsStage');
    const gpb = document.getElementById('gamePageBody');
    const pg = document.getElementById('pg-game');
    const cs = getComputedStyle(st);
    const head = document.querySelector('#pg-game .gp-head');
    return {
      stageH: cs.height, stageDisp: cs.display, stageFlex: cs.flex,
      gpbChildren: [...gpb.children].map(c => (c.id || c.className) + ':' + Math.round(c.getBoundingClientRect().height)),
      pgChildren: [...pg.children].map(c => (c.id || c.className) + ':' + Math.round(c.getBoundingClientRect().height)),
      headRect: head ? Math.round(head.getBoundingClientRect().height) : null,
      vars: { vvh: getComputedStyle(pg).getPropertyValue('--vvh'), pgtop: getComputedStyle(pg).getPropertyValue('--pg-top'), headh: getComputedStyle(pg).getPropertyValue('--gp-head-h') },
      gpbCS: (() => { const g = getComputedStyle(gpb); return { flex: g.flex, h: g.height, disp: g.display }; })()
    };
  });
  console.log(JSON.stringify(m, null, 1));
  await b.close();
})();
