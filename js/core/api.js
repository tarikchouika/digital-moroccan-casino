/* ═══════════════════════════════════════════
   Digital Moroccan casino — API Client
   Thin fetch wrapper — يستهدف Worker API على Cloudflare
   (cookies عبر credentials: include لأن الباك على نطاق workers.dev)
   ═══════════════════════════════════════════ */
"use strict";
/* [Replica] اختيار خادم الـAPI حسب نطاق الاستضافة — dmgames لها Worker/D1 مستقلان.
   التطوير المحلي: عند فتح الواجهة من localhost/127.0.0.1 فإن server.js المحلي يخدم
   الواجهة وواجهة الـAPI معاً على نفس المنفذ، لذا نتجه لنفس الأصل (Same-Origin، بلا CORS)
   حتى تعمل اختبارات المتصفح (E2E) محلياً دون الحاجة لـ Worker خارجي.
   الإنتاج (dmgames.pages.dev أو أي نطاق آخر): يبقى التوجيه للـ Worker كما كان. */
const API_BASE = (typeof window !== 'undefined' && window.API_BASE_URL) ||
  ((typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(location.hostname))
    ? location.origin
    : ((typeof location !== 'undefined' && /(^|\.)dmgames\.pages\.dev$/.test(location.hostname))
      ? 'https://casino-api.dmgames-api.workers.dev'
      : 'https://casino-api.tarikc.workers.dev'));
if (typeof window !== 'undefined' && !window.API_BASE_URL) window.API_BASE_URL = API_BASE;
const API = {
  request(method, url, body) {
    const full = url.startsWith('/api/') ? (API_BASE + url) : url;
    const opts = {
      method: method,
      credentials: 'include',
      headers: {}
    };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(full, opts).then(function (res) {
      return res.json().then(function (data) {
        if (res.status === 401 && typeof authHandle401 === 'function') {
          authHandle401();
        }
        return { status: res.status, ok: res.ok, data: data };
      }).catch(function () {
        return { status: res.status, ok: res.ok, data: null };
      });
    });
  },
  get(url) {
    return this.request('GET', url);
  },
  post(url, body) {
    return this.request('POST', url, body);
  }
};
