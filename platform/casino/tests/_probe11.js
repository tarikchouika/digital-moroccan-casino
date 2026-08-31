const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 400, height: 712 }, hasTouch: true, deviceScaleFactor: 2 })).newPage();
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH !== null, null, { timeout: 15000 });
  await p.evaluate(() => openGame('bl8'));
  await p.waitForFunction(() => !!BILLIARDS, null, { timeout: 10000 });
  await p.evaluate(() => billiardsStartLocal());
  await p.waitForFunction(() => !!(BILLIARDS.G && BILLIARDS.VT), null, { timeout: 10000 });
  await p.waitForTimeout(600);
  const m = await p.evaluate(() => {
    const r = s => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return { t: Math.round(q.top), b: Math.round(q.bottom), l: Math.round(q.left), r: Math.round(q.right), h: Math.round(q.height), w: Math.round(q.width) }; };
    const tray = document.querySelector('.bl-tray');
    return {
      inner: [innerWidth, innerHeight],
      frame: r('.bl-frame'), stage: r('.bl-stage'), topbar: r('.bl-topbar'), rail: r('.bl-rail'),
      tray: r('.bl-tray'), trayDisp: tray ? getComputedStyle(tray).display : 'none',
      trayKids: tray ? tray.children.length : 0,
      body: r('body'), gameArea: r('#gameArea') || r('.game-area') || r('#gameRoot'),
      gridRows: document.querySelector('.bl-frame').style.gridTemplateRows,
      gridCols: document.querySelector('.bl-frame').style.gridTemplateColumns
    };
  });
  console.log(JSON.stringify(m, null, 1));
  await b.close();
})();
