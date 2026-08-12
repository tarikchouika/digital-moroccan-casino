/* ═══════════════════════════════════════════
   Digital Moroccan casino — API Client
   Thin fetch wrapper (same-origin, cookies included)
   ═══════════════════════════════════════════ */
"use strict";
const API = {
  request(method, url, body) {
    const opts = {
      method: method,
      credentials: 'same-origin',
      headers: {}
    };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts).then(function (res) {
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
