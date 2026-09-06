/* ═════════════════════════════════════════════════════════
   Live WS Bridge — يحوّل EventSource('/api/live') إلى WebSocket
   عبر Durable Objects (نفس أسماء الأحداث: room:update, room:move...)
   الشبكة: wss://casino-api.../api/rooms/<roomId>/ws?uid=<uid>
   غرفة الدردشة العامة: roomId = 'global'
   ═════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var API_BASE = (typeof window !== 'undefined' && window.API_BASE_URL) || 'https://casino-api.tarikc.workers.dev';
  function getUid() {
    try { return String((window.AUTH && window.AUTH.user && window.AUTH.user.id) || (window.RC_user && window.RC_user.id) || (window.ST && window.ST.user && window.ST.user.id) || '0'); }
    catch (e) { return '0'; }
  }
  function getCurrentRoomId() {
    try { if (window.Rooms && window.Rooms.state && window.Rooms.state.id) return window.Rooms.state.id; } catch (e) { }
    return window.RC_currentRoomId || 'global';
  }

  function LiveWS(roomId) {
    var self = this;
    self._listeners = {};
    self.readyState = 0;
    self._connect(roomId || currentRoomId);
  }
  /* سجل مستمعين موحّد: كل اتصالات الجسر توزع عليه */
  var globalListeners = {};
  LiveWS.prototype = {
    _connect: function (rid) {
      var self = this;
      var target = (typeof rid === 'string' && rid) ? rid : getCurrentRoomId();
      self._ws = new WebSocket(API_BASE + '/api/rooms/' + encodeURIComponent(target) + '/ws?uid=' + encodeURIComponent(getUid()));
      self._ws.onopen = function () { self.readyState = 1; self._emitOpen(); };
      self._ws.onclose = function () { self.readyState = 3; setTimeout(function () { self.readyState = 0; self._connect(getCurrentRoomId()); }, 3000); };
      self._ws.onerror = function () { };
      self._ws.onmessage = function (ev) {
        try {
          var m = JSON.parse(ev.data);
          self._dispatch(m.event, m.data);
        } catch (e) { }
      };
    },
    _emitOpen: function () { if (this.onopen) try { this.onopen(); } catch (e) { } },
    addEventListener: function (type, fn) {
      (this._listeners[type] = this._listeners[type] || []).push(fn);
      (globalListeners[type] = globalListeners[type] || []).push(fn);
    },
    _dispatch: function (type, data) {
      var ls = this._listeners[type] && this._listeners[type].length ? this._listeners[type] : globalListeners[type];
      if (!ls || !ls.length) return;
      var ev = { data: JSON.stringify(data) };
      for (var i = 0; i < ls.length; i++) try { ls[i](ev); } catch (e) { }
    },
    send: function (o) { try { this._ws.send(JSON.stringify(o)); } catch (e) { } },
    close: function () { try { this._ws.close(); } catch (e) { } }
  };

  /* polyfill: استبدال EventSource للـ '/api/live' فقط */
  var OrigES = window.EventSource;
  window.EventSource = function (url) {
    if (url === '/api/live' || url === (API_BASE + '/api/live')) {
      return new LiveWS('global');
    }
    return new OrigES(url);
  };
  window.EventSource.prototype = OrigES ? OrigES.prototype : {};
  window.LiveWS = LiveWS;

  /* مراقبة الغرفة الحالية: عند فتح غرفة لعب → اتصال إضافي بها */
  var gameConn = null;
  function watchRoom() {
    var rid = getCurrentRoomId();
    if (rid && rid !== 'global' && (!gameConn || gameConn._rid !== rid)) {
      if (gameConn) { try { gameConn.close(); } catch (e) { } }
      gameConn = new LiveWS(rid);
      gameConn._rid = rid;
    } else if ((!rid || rid === 'global') && gameConn) {
      try { gameConn.close(); } catch (e) { }
      gameConn = null;
    }
  }
  /* هوك على تحديث Rooms.state */
  setInterval(function () {
    try {
      var st = window.Rooms && window.Rooms.state;
      if (st && st.id && st.id !== window.__liveLastRoom) { window.__liveLastRoom = st.id; watchRoom(); }
      else if (!st && window.__liveLastRoom) { window.__liveLastRoom = null; watchRoom(); }
    } catch (e) { }
  }, 800);
  window.__liveWatchRoom = watchRoom;
})();
