const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:3000/';
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  for (const [name, vp, game] of [['bl-ui-device.png', { width: 400, height: 712 }, 'bl8'], ['bl-ui-device-flip.png', { width: 400, height: 712 }, 'bl8'], ['bl-ui-device-snooker.png', { width: 412, height: 846 }, 'blsn']]) {
    const p = await (await b.newContext({ viewport: vp, hasTouch: true, deviceScaleFactor: 2 })).newPage();
    await p.goto(BASE, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH !== null, null, { timeout: 15000 });
    await p.waitForTimeout(400);
    await p.evaluate((g) => openGame(g), game);
    await p.waitForFunction(() => !!BILLIARDS, null, { timeout: 10000 });
    await p.evaluate(() => billiardsStartLocal());
    if (game === 'blsn') { // ضع الكرة أولاً
      await p.waitForFunction(() => BILLIARDS.G && BILLIARDS.G.S.phase === 'PLACE', null, { timeout: 8000 });
      const placed = await p.evaluate(() => { for (let x = 20; x < 380; x += 4) for (let y = 600; y < 1000; y += 4) { if (typeof G !== 'undefined') {} ; } return false; });
      await p.evaluate(() => { const G = BILLIARDS.G; for (let y = 900; y < 1040; y += 3) for (let x = 30; x < 370; x += 3) { try { G.place(x, y); if (G.S.phase !== 'PLACE') return; } catch (e) {} } });
    }
    await p.waitForFunction(() => !!(BILLIARDS.G && BILLIARDS.VT), null, { timeout: 10000 });
    await p.evaluate(() => enterAppFullscreen());
    await p.waitForTimeout(300);
    await p.evaluate(() => { BILLIARDS.aim = -0.6; });
    if (name.includes('flip')) { await p.evaluate(() => billiardsFlipView()); }
    await p.waitForTimeout(700);
    await p.screenshot({ path: '/home/user/screenshots/' + name });
    await p.close();
    console.log('shot ' + name);
  }
  await b.close();
})();
