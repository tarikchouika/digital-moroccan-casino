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
  const pre = await p.evaluate(() => ({ pg: document.getElementById('pg-game').className, gp: document.getElementById('gamePageBody').className, stParent: document.getElementById('billiardsStage').parentElement.id || document.getElementById('billiardsStage').parentElement.className }));
  await p.evaluate(() => enterAppFullscreen());
  await p.waitForTimeout(300);
  const post = await p.evaluate(() => ({ pg: document.getElementById('pg-game').className, gp: document.getElementById('gamePageBody') ? document.getElementById('gamePageBody').className : 'MISSING', st: !!document.getElementById('billiardsStage') }));
  console.log('pre ', JSON.stringify(pre));
  console.log('post', JSON.stringify(post));
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
