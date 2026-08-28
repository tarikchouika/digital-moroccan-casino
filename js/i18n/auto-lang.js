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
})();
