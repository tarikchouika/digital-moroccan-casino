/* ═══════════════════════════════════════════
   Digital Moroccan casino — API Client
   Thin fetch wrapper — يستهدف Worker API على Cloudflare
   (cookies عبر credentials: include لأن الباك على نطاق workers.dev)
   ═══════════════════════════════════════════ */
"use strict";
/* [Replica] اختيار خادم الـAPI حسب نطاق الاستضافة — dmgames لها Worker/D1 مستقلان */
const API_BASE = (typeof window !== 'undefined' && window.API_BASE_URL) ||
  ((typeof location !== 'undefined' && /(^|\.)dmgames\.pages\.dev$/.test(location.hostname))
    ? 'https://casino-api.dmgames-api.workers.dev'
    : 'https://casino-api.tarikc.workers.dev');
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
