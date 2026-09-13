/* ═══════════════════════════════════════════════════════════════════
   RD v2.5 — مشترك لاختبارات المتصفح (Playwright)
   يوفر: إطلاق Chromium (ثنائي @sparticuz/chromium) + صفحة بها التقاط
   الأخطاء + انتظار مسحي + لقطات الحالة العامة للغرف.
   الاستعمال:  node tests/_rd_classic_browser_test.js
   (يتطلب الخادم شغالاً بـ DM_TEST_MODE=1 على المنفذ 4173)
   ═══════════════════════════════════════════════════════════════════ */
'use strict';
const { chromium } = require('playwright');
const BASE = 'http://localhost:4173/';

async function launchBrowser() {
  let execPath = null;
  try {
    execPath = await (await import('@sparticuz/chromium')).default.executablePath();
  } catch (e) { /* ننزل للافتراضي */ }
  const args = ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'];
  if (execPath) return chromium.launch({ executablePath: execPath, args: args });
  return chromium.launch({ args: args });
}

async function newPage(browser, viewport) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page._errs = errs;
  page.on('pageerror', e => errs.push(String(e.message)));
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource|404|net::ERR|favicon/i.test(m.text())) errs.push(m.text());
  });
  page.on('dialog', d => d.accept().catch(() => {}));
  return { page: page, ctx: ctx };
}

async function gotoGamePage(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await wait(page, () => !!(typeof AUTH !== 'undefined' && typeof Rooms !== 'undefined' &&
                            typeof RondaApp !== 'undefined' && typeof RondaCore !== 'undefined'), 20000);
  await page.waitForTimeout(700);   /* SSE + welcome */
}

async function wait(page, fn, timeout, arg) {
  timeout = timeout || 15000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { const r = await page.evaluate(fn, arg); if (r) return r; } catch (e) { /* poll */ }
    await page.waitForTimeout(170);
  }
  return null;
}

/* لقطة الحالة العامة للمحرك (كل ما يجب تطابقه بين العملاء — بلا ما يخص طرفاً) */
const pubState = () => {
  const app = window.RondaApp;
  if (!app || !app.game) return null;
  const st = app.game.state;
  return {
    mode: st.mode,
    round: st.roundNumber, deal: st.dealNumber,
    currentSeat: st.currentSeat,
    deck: st.deck.length, table: st.table.cards.length,
    scores: st.teams.map(t => t.score),
    phase: st.phase,
    handCounts: st.players.map(p => p.hand.length),
    teamCounts: st.teams.map(t => t.playerIds.length)
  };
};

module.exports = { BASE: BASE, launchBrowser: launchBrowser, newPage: newPage, gotoGamePage: gotoGamePage, wait: wait, pubState: pubState };
