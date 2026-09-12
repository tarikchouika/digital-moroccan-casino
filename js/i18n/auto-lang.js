/* Digital Moroccan Casino — auto language bootstrap
 * Provides window._origSetLang so the shared legal-page logic can chain the
 * platform-wide setLang() (defined later in js/core/utils.js). It is wrapped
 * lazily so it works regardless of script load order (this file loads before
 * utils.js in the legal pages' <head>).
 */
(function () {
  'use strict';

  window._origSetLang = function (l) {
    try {
      if (typeof window.setLang === 'function') window.setLang(l);
    } catch (e) { /* ignore chain errors on legal pages */ }
  };

  // Auto-detect an explicit ?lang= override from the URL on load.
  document.addEventListener('DOMContentLoaded', function () {
    try {
      var p = new URLSearchParams(location.search).get('lang');
      if (p === 'ar' || p === 'fr' || p === 'en' || p === 'da') {
        if (typeof window.setLang === 'function') window.setLang(p);
      }
    } catch (e) { /* ignore */ }
  });

  /* [i18n] الصفحات القانونية تستدعي applyLang المحلية (لا setLang) —
     نراقب جلوس authRestore: عند اكتمالها (renderAuthChip دالة + AUTH.user موجود)
     نعيد بناء القائمة مرة أخيرة باللغة الحالية ثم نوقف المراقبة. */
  document.addEventListener('DOMContentLoaded', function () {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (typeof window.renderAuthChip === 'function' && window.AUTH && window.AUTH.user) {
        try { window.renderAuthChip(); } catch (e) { /* ignore */ }
        clearInterval(timer);
        return;
      }
      if (tries >= 20) clearInterval(timer);   /* 10 ثوانٍ (20 × 500ms) ثم التوقف */
    }, 500);
  });
})();
