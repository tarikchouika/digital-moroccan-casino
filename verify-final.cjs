const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8011';
const results = [];
let errors = [];

async function pageChecks(browser, page, url, label) {
  const out = { page: label, url };
  const consoleMsgs = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleMsgs.push(msg.text());
  });
  page.on('pageerror', (e) => consoleMsgs.push('PAGEERROR: ' + e.message));
  const resp = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  out.status = resp ? resp.status() : 'none';
  await page.waitForTimeout(1200);

  // أخطاء مسموحة فقط: 401 من طلبات auth بلا جلسة
  out.consoleErrors = consoleMsgs.filter((m) => !/401|Failed to load resource/i.test(m));

  // العنوان
  out.title = await page.title();

  // تغيير اللغة عبر أزرار .lang-switch (الصفحات القانونية) أو .lang-opt (الرئيسية)
  const hasLangSwitch = await page.locator('.lang-switch button').count();
  if (hasLangSwitch > 0) {
    const dirs = {};
    for (const l of ['fr', 'en', 'ar']) {
      await page.locator('.lang-switch button[data-lang-btn="' + l + '"]').click();
      await page.waitForTimeout(350);
      dirs[l] = await page.evaluate(() => ({
        lang: document.documentElement.getAttribute('lang'),
        dir: document.documentElement.getAttribute('dir'),
        h1: (document.querySelector('[data-k]') || {}).textContent || ''
      }));
    }
    out.langSwitches = dirs;
  } else {
    // الصفحة الرئيسية: زر اللغة ع/FR/EN
    await page.locator('#langBtn').click();
    const abbrAr = await page.locator('#langAbbr').textContent();
    await page.locator('.lang-opt[data-lang="fr"]').click();
    await page.waitForTimeout(350);
    const dirFr = await page.evaluate(() => document.documentElement.getAttribute('dir'));
    const abbrFr = await page.locator('#langAbbr').textContent();
    await page.locator('#langBtn').click();
    await page.locator('.lang-opt[data-lang="en"]').click();
    await page.waitForTimeout(350);
    const dirEn = await page.evaluate(() => document.documentElement.getAttribute('dir'));
    const abbrEn = await page.locator('#langAbbr').textContent();
    await page.locator('#langBtn').click();
    await page.locator('.lang-opt[data-lang="ar"]').click();
    await page.waitForTimeout(350);
    out.langSwitches = { ar: abbrAr, fr: abbrFr + ':' + dirFr, en: abbrEn + ':' + dirEn };
  }
  return out;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  /* 1) الصفحات الخمس + اللغة */
  const pages = [
    { url: '/', label: 'index' },
    { url: '/about.html', label: 'about' },
    { url: '/contact.html', label: 'contact' },
    { url: '/privacy.html', label: 'privacy' },
    { url: '/terms.html', label: 'terms' }
  ];
  for (const p of pages) {
    const r = await pageChecks(browser, page, BASE + p.url, p.label);
    results.push(r);
  }

  /* 2) هيدر/فوتر/شريط جانبي على الرئيسية (desktop) */
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  results.push({
    page: 'index-ui',
    sidebarBrand: (await page.locator('.brand-name').textContent()).replace(/\s+/g, ' ').trim(),
    navItems: await page.locator('.sidebar .nav-item span[data-i18n]').allTextContents(),
    footerName: (await page.locator('.foot-name').textContent()).trim(),
    footLinks: await page.locator('.foot-legal a').evaluateAll((as) => as.map((a) => a.getAttribute('href'))),
    headerHasGem: (await page.locator('.topbar .fa-gem').count()) > 0,
    balanceChipIcon: await page.locator('.chip i').getAttribute('class'),
    logoCount: await page.locator('.brand-logo img, .foot-logo img').count(),
    logoAlt: await page.locator('.brand-logo img').getAttribute('alt'),
    langAbbrDefault: await page.locator('#langAbbr').textContent()
  });

  /* 3) لقطات للفيزيون (desktop) */
  await page.screenshot({ path: '/tmp/verify_final_home.png' });
  const footerEl = await page.locator('.footer');
  if (await footerEl.count()) await footerEl.first().screenshot({ path: '/tmp/verify_final_footer.png' });
  await page.goto(BASE + '/privacy.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/verify_final_privacy.png' });

  /* 4) موبايل 390×844 */
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  const mErrs = [];
  mp.on('pageerror', (e) => mErrs.push(e.message));
  await mp.goto(BASE + '/', { waitUntil: 'load' });
  await mp.waitForTimeout(1200);
  const ovf = await mp.evaluate(() => ({
    scrollW: document.scrollingElement.scrollWidth,
    innerW: window.innerWidth
  }));
  await mp.screenshot({ path: '/tmp/verify_final_mobile_top.png' });
  const mf = await mp.locator('.footer');
  if (await mf.count()) await mf.first().screenshot({ path: '/tmp/verify_final_mobile_footer.png' });
  results.push({
    page: 'mobile-390',
    overflow: ovf.scrollW <= ovf.innerW ? 'ok' : 'OVERFLOW ' + ovf.scrollW + '>' + ovf.innerW,
    pageErrors: mErrs
  });

  await browser.close();

  console.log(JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error('SCRIPT_FAIL', e);
  process.exit(1);
});
