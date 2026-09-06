/* ═══════════════════════════════════════════
   Digital Moroccan casino — API Client
   Thin fetch wrapper — يستهدف Worker API على Cloudflare
   (cookies عبر credentials: include لأن الباك على نطاق workers.dev)
   ═══════════════════════════════════════════ */
"use strict";
const API_BASE = (typeof window !== 'undefined' && window.API_BASE_URL) || 'https://casino-api.tarikc.workers.dev';
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
