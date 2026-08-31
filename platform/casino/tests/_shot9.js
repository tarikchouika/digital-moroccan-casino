const { chromium, devices } = require('playwright');
const BASE = 'http://127.0.0.1:3000/';
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ ...devices['Galaxy S9+'], locale: 'ar-MA' });
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH !== null, null, { timeout: 15000 });
  await p.waitForTimeout(500);
  await p.evaluate(() => openGame('blsn'));
  await p.waitForFunction(() => !!BILLIARDS, null, { timeout: 10000 });
  await p.evaluate(() => billiardsStartLocal());
  await p.waitForFunction(() => !!(BILLIARDS.G && BILLIARDS.VT), null, { timeout: 10000 });
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/home/user/screenshots/bl-v11-phone-fs.png' });
  await p.evaluate(() => exitAppFullscreen());
  await p.waitForTimeout(700);
  await p.screenshot({ path: '/home/user/screenshots/bl-v11-phone-min.png' });
  const m = await p.evaluate(() => {
    const st = document.querySelector('.bl-stage').getBoundingClientRect();
    const pg = document.getElementById('pg-game').getBoundingClientRect();
    const head = getComputedStyle(document.querySelector('.gp-head'));
    return { stTop: st.top, stLeft: st.left, pgW: pg.width, innerW: innerWidth, innerH: innerHeight, pgH: pg.height, headDisp: head.display, body: document.body.className };
  });
  console.log(JSON.stringify(m));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
