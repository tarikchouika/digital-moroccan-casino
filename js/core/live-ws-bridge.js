/* ═════════════════════════════════════════════════════════
   Live WS Bridge — يحوّل EventSource('/api/live') إلى WebSocket
   عبر Durable Objects (نفس أسماء الأحداث: room:update, room:move...)
   الشبكة: wss://casino-api.../api/rooms/<roomId>/ws?uid=<uid>
   غرفة الدردشة العامة: roomId = 'global'
   [إصلاح التكرار] اتصال WS واحد مشترك لغرفة global مهما تعددت
   نداءات EventSource — كل رسالة تُوزَّع على كل مستمع مرة واحدة فقط.
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

  /* ── قناة مشتركة: WS واحد لكل roomId، وواجهات (facades) متعددة فوقه ── */
  function Channel(rid) {
    var self = this;
    self.rid = rid;
    self.facades = [];
    self.closed = false;
    self._connect();
  }
  Channel.prototype = {
    _connect: function () {
      var self = this;
      if (self.closed) return;
      self._ws = new WebSocket(API_BASE + '/api/rooms/' + encodeURIComponent(self.rid) + '/ws?uid=' + encodeURIComponent(getUid()));
      self._ws.onopen = function () {
        for (var i = 0; i < self.facades.length; i++) {
          var f = self.facades[i];
          f.readyState = 1;
          if (f.onopen) try { f.onopen(); } catch (e) { }
        }
      };
      self._ws.onclose = function () {
        if (self.closed) return;
        for (var i = 0; i < self.facades.length; i++) self.facades[i].readyState = 0;
        setTimeout(function () { self._connect(); }, 3000);
      };
      self._ws.onerror = function () { };
      self._ws.onmessage = function (ev) {
        var m;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        var evObj = { data: JSON.stringify(m.data) };
        /* توزيع واحد: كل مستمع مسجَّل على أي واجهة يُستدعى مرة واحدة فقط */
        for (var i = 0; i < self.facades.length; i++) {
          var ls = self.facades[i]._listeners[m.event];
          if (!ls) continue;
          for (var j = 0; j < ls.length; j++) try { ls[j](evObj); } catch (e) { }
        }
      };
    },
    send: function (o) { try { this._ws.send(JSON.stringify(o)); } catch (e) { } },
    close: function () { this.closed = true; try { this._ws.close(); } catch (e) { } }
  };

  var globalChannel = null;
  function getGlobalChannel() {
    if (!globalChannel || globalChannel.closed) globalChannel = new Channel('global');
    return globalChannel;
  }

  /* واجهة بمظهر EventSource فوق القناة المشتركة */
  function LiveWS(roomId) {
    var self = this;
    self._listeners = {};
    var rid = (typeof roomId === 'string' && roomId) ? roomId : getCurrentRoomId();
    if (rid === 'global') {
      self._ch = getGlobalChannel();
    } else {
      self._ch = new Channel(rid);
      self._own = true; /* قناة خاصة بغرفة لعب — تُغلق مع الواجهة */
    }
    self._ch.facades.push(self);
    self.readyState = (self._ch._ws && self._ch._ws.readyState === 1) ? 1 : 0;
    if (self.readyState === 1 && self.onopen) { setTimeout(function () { try { self.onopen(); } catch (e) { } }, 0); }
  }
  LiveWS.prototype = {
    addEventListener: function (type, fn) {
      (this._listeners[type] = this._listeners[type] || []).push(fn);
    },
    send: function (o) { this._ch.send(o); },
    close: function () {
      var idx = this._ch.facades.indexOf(this);
      if (idx !== -1) this._ch.facades.splice(idx, 1);
      /* قناة غرفة لعب خاصة: أغلق WS؛ قناة global تبقى حية للواجهات الأخرى */
      if (this._own && !this._ch.facades.length) this._ch.close();
      this.readyState = 3;
    }
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
  function watchRoom(force) {
    var rid = getCurrentRoomId();
    if (rid && rid !== 'global' && (force || !gameConn || gameConn._rid !== rid)) {
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
