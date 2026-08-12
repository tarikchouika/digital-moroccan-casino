/* ═══════════════════════════════════════════
   Digital Moroccan casino — Rooms (multiplayer)
   فتح غرفة + دعوة صديق بكود + لعب وجهاً لوجه
   يعتمد على السيرفر: /api/rooms/* + أحداث SSE room:*
   ═══════════════════════════════════════════ */
(function () {
  "use strict";

  var _source = null;
  var _started = false;
  var _gameHandler = null;   // معالج room:move للعبة النشطة
  var _startHandler = null;  // معالج بدء اللعب (status=playing)
  var _messages = [];        // رسائل الغرفة (جماعية + فردية مستلمة)
  var _recipient = null;     // { id, name } — المستلم الفردي الحالي (null = الجميع)

  /* ── أدوات ── */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function me() {
    return (typeof AUTH !== 'undefined' && AUTH.user) ? AUTH.user : null;
  }

  var Rooms = {
    state: null,
    /* الألعاب المدعومة للغرف: id -> أقصى عدد لاعبين */
    roomGameIds: { rp: 2, pn: 2, pr: 4, rn: 4 },

    isGameSupported: function (id) { return !!Rooms.roomGameIds[id]; },
    isActive: function () { return !!(Rooms.state && Rooms.state.status === 'playing'); },
    maxFor: function (id) { return Rooms.roomGameIds[id] || 2; },
    /* إظهار/إخفاء زر «العب مع صديق» حسب اللعبة المفتوحة */
    syncBtn: function () {
      var b = document.getElementById('roomBtn');
      if (!b) return;
      b.style.display = Rooms.isGameSupported(window._currentGameId) ? '' : 'none';
    },

    /* ═══════ SSE (أحداث الغرف فقط — نفس /api/live) ═══════ */
    joinSse: function () {
      if (_started || typeof EventSource === 'undefined') return;
      _started = true;
      _source = new EventSource('/api/live');
      _source.addEventListener('room:update', function (e) {
        try { Rooms._onUpdate(JSON.parse(e.data)); } catch (err) { console.error('[rooms] update', err); }
      });
      _source.addEventListener('room:move', function (e) {
        try { Rooms._onMove(JSON.parse(e.data)); } catch (err) { console.error('[rooms] move', err); }
      });
      _source.addEventListener('room:chat', function (e) {
        try { Rooms._onChat(JSON.parse(e.data)); } catch (err) { console.error('[rooms] chat', err); }
      });
    },

    _onUpdate: function (room) {
      var prev = Rooms.state;
      var prevStatus = prev ? prev.status : null;
      Rooms.state = room;
      /* بدأت اللعبة للتو → إبلاغ اللعبة (تغلق المودال وتبدأ محلياً) */
      if (room && room.status === 'playing' && prevStatus !== 'playing') {
        Rooms.closeModal();
        if (_startHandler) { var fn = _startHandler; _startHandler = null; fn(room); }
      }
      /* غادرت الغرفة (حُذفت أو طردت) */
      if (!room) { Rooms.reset(); Rooms.render(); return; }
      Rooms.render();
    },
    _onMove: function (d) {
      if (_gameHandler) _gameHandler(d);
    },
    /* رسالة غرفة جديدة (جماعية أو فردية واردة) */
    _onChat: function (msg) {
      if (!msg || !msg.text) return;
      _messages.push(msg);
      if (_messages.length > 100) _messages.splice(0, _messages.length - 100);
      /* إشعار للمراسلة الفردية الواردة */
      var u = me();
      if (msg.to_id != null && msg.to_id !== (u && u.id) && msg.from_id !== (u && u.id)) return; /* ليست لي */
      Rooms.renderChat();
      if (msg.to_id != null && msg.from_id !== (u && u.id)) {
        toast('💬 ' + esc(msg.from_name) + ': ' + esc(msg.text), 'ok');
        if (typeof SND !== 'undefined' && SND.notify) SND.notify();
      }
    },
    /* إرسال رسالة: جماعية (إلى الجميع) أو فردية (إلى _recipient) */
    sendChat: function () {
      var inp = document.getElementById('roomChatInput');
      if (!inp || !Rooms.state) return;
      var text = inp.value.trim();
      if (!text) return;
      inp.value = '';
      var to = _recipient ? _recipient.id : null;
      API.post('/api/rooms/chat', { room_id: Rooms.state.id, text: text, to: to }).then(function (r) {
        if (!r.ok) {
          toast((r.data && r.data.message) || T('ui.roomError'), 'err');
          return;
        }
        if (r.data && r.data.msg) Rooms._onChat(r.data.msg);
      });
    },
    /* اختيار مستلم فردي (null = الجميع) */
    setRecipient: function (id, name) {
      _recipient = (id == null || id === 'all') ? null : { id: Number(id), name: String(name || '') };
      Rooms.renderChat();
      var inp = document.getElementById('roomChatInput');
      if (inp) inp.focus();
    },

    /* تسجيل معالجات اللعبة النشطة (تستدعيها اللعبة عند فتحها) */
    setGameHandler: function (fn) { _gameHandler = fn; },
    setStartHandler: function (fn) { _startHandler = fn; },

    /* ═══════ API ═══════ */
    createRoom: function (gameId) {
      var u = me();
      if (!u) { toast(T('ui.roomNeedLogin'), 'warn'); if (typeof openAuthModal === 'function') openAuthModal(); return; }
      var max = Rooms.maxFor(gameId);
      return API.post('/api/rooms', { game_id: gameId, max_players: max }).then(function (r) {
        if (!r.ok) { toast((r.data && r.data.message) || T('ui.roomError'), 'err'); return; }
        Rooms.state = r.data.room;
        Rooms.render();
        Rooms.openModal();
      });
    },
    joinRoom: function (code) {
      var u = me();
      if (!u) { toast(T('ui.roomNeedLogin'), 'warn'); if (typeof openAuthModal === 'function') openAuthModal(); return; }
      code = String(code || '').trim().toUpperCase();
      if (!code) return;
      return API.post('/api/rooms/join', { code: code }).then(function (r) {
        if (!r.ok) {
          toast((r.data && r.data.message) || T('ui.roomError'), 'err');
          Rooms.render();
          return;
        }
        Rooms.state = r.data.room;
        /* فتح اللعبة إن لم تكن مفتوحة */
        var gid = r.data.room.game_id;
        if (typeof openGame === 'function' && window._currentGameId !== gid) openGame(gid);
        Rooms.render();
        Rooms.openModal();
      });
    },
    leaveRoom: function () {
      if (!Rooms.state) return;
      var id = Rooms.state.id;
      Rooms.state = null;
      return API.post('/api/rooms/leave', { room_id: id }).then(function () {
        Rooms.reset();
        Rooms.render();
        Rooms.closeModal();
        if (typeof closeGamePage === 'function' && window._currentGameId) closeGamePage();
      });
    },
    /* مغادرة صامتة عند الخروج من صفحة اللعبة */
    leaveQuiet: function () {
      if (!Rooms.state) return;
      var id = Rooms.state.id;
      Rooms.state = null;
      _gameHandler = null;
      _startHandler = null;
      API.post('/api/rooms/leave', { room_id: id }).catch(function () {});
    },
    setReady: function (ready) {
      if (!Rooms.state) return;
      API.post('/api/rooms/ready', { room_id: Rooms.state.id, ready: !!ready }).then(function () {});
    },
    startGame: function () {
      if (!Rooms.state) return;
      API.post('/api/rooms/start', { room_id: Rooms.state.id }).then(function (r) {
        if (!r.ok) toast((r.data && r.data.message) || T('ui.roomError'), 'err');
      });
    },
    sendMove: function (action, data, state) {
      if (!Rooms.state) return false;
      var payload = { room_id: Rooms.state.id, action: action, data: data || {} };
      if (state !== undefined && state !== null) payload.state = state;
      API.post('/api/rooms/move', payload).then(function (r) {
        if (!r.ok) {
          toast((r.data && r.data.message) || T('ui.roomError'), 'err');
          return;
        }
        /* تزامن حالة الغرفة الرسمية (room_state) مع استجابة السيرفر */
        if (r.data && r.data.room) Rooms._onUpdate(r.data.room);
      });
      return true;
    },
    /* اختيار أعمى (ألعاب زوجية): القيمة تصل للخادم فقط — لا تُبث للخصم حتى يكتمل زوج الاختيارين
       (الخادم يبث blindResult بالزوج معاً — عدالة وجهاً لوجه) */
    sendBlind: function (data) {
      if (!Rooms.state) return false;
      API.post('/api/rooms/move', { room_id: Rooms.state.id, action: 'blind', data: data || {} }).then(function (r) {
        if (!r.ok) toast((r.data && r.data.message) || T('ui.roomError'), 'err');
      });
      return true;
    },
    toggleSpectate: function () {
      if (!Rooms.state) return;
      var u = me();
      var mine = null;
      Rooms.state.players.forEach(function (p) { if (p.id === (u && u.id)) mine = p; });
      var target = !(mine && mine.spectate);
      API.post('/api/rooms/spectate', { room_id: Rooms.state.id, spectate: target }).then(function (r) {
        if (!r.ok) toast((r.data && r.data.message) || T('ui.roomError'), 'err');
      });
    },

    /* ═══════ مودال الغرفة ═══════ */
    /* كانت اللعبة في ملء الشاشة قبل فتح المودال؟ (لإعادتها عند الإغلاق) */
    _fsBefore: false,
    openModal: function () {
      var m = document.getElementById('roomModal');
      if (!m) return;
      /* المودال خارج #pg-game — في ملء الشاشة لا يُعرض ولا يُتفاعل معه:
         نخرج مؤقتاً من ملء الشاشة (وإعادة عند الإغلاق) */
      var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fsEl) {
        Rooms._fsBefore = true;
        var exit = (document.exitFullscreen && document.exitFullscreen.call(document)) ||
                   (document.webkitExitFullscreen && document.webkitExitFullscreen.call(document));
        if (exit && exit.catch) exit.catch(function () {});
      }
      m.classList.add('show');
      /* جلب سجل رسائل الغرفة (آخر 50) */
      if (Rooms.state) {
        _recipient = null;
        API.get('/api/rooms/' + Rooms.state.id + '/chat').then(function (r) {
          if (r.ok && r.data && r.data.messages) {
            _messages = r.data.messages.slice(-100);
            Rooms.renderChat();
          }
        });
      }
      Rooms.render();
    },
    closeModal: function () {
      var m = document.getElementById('roomModal');
      if (m) m.classList.remove('show');
      /* إعادة ملء الشاشة إذا كانت اللعبة ممتلئة قبل فتح المودال */
      if (Rooms._fsBefore) {
        Rooms._fsBefore = false;
        var g = document.getElementById('pg-game');
        if (g) {
          var rq = g.requestFullscreen || g.webkitRequestFullscreen;
          if (rq) { try { var p = rq.call(g); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
        }
      }
    },
    toggleFromGame: function () {
      if (!Rooms.state) {
        var gid = window._currentGameId;
        if (!Rooms.isGameSupported(gid)) return;
        Rooms.createRoom(gid);
        return;
      }
      Rooms.openModal();
    },

    render: function () {
      var body = document.getElementById('roomBody');
      if (!body) return;
      var st = Rooms.state;
      if (!st) {
        body.innerHTML = '<div class="ctext" style="padding:12px;text-align:center">' + T('ui.roomEmpty') + '</div>';
        return;
      }
      var u = me();
      var isOwner = st.owner_id === (u && u.id);
      var allReady = st.players.length >= 2 && st.players.every(function (p) { return p.ready; });
      var link = location.origin + '/?room=' + st.code;

      var rows = st.players.map(function (p) {
        var crown = p.id === st.owner_id ? ' 👑' : '';
        var rd = p.ready ? '✅' : '⏳';
        var you = p.id === (u && u.id) ? ' (' + T('ui.roomYou') + ')' : '';
        var mode = p.spectate ? ' 👁️' : '';
        /* زر مراسلة فردية لكل لاعب (عدا نفسي) */
        var pm = p.id !== (u && u.id)
          ? '<button class="rchat-pm" onclick="Rooms.setRecipient(' + p.id + ',\'' + esc(p.username).replace(/'/g, "\\'") + '\')" title="مراسلة ' + esc(p.username) + '" aria-label="مراسلة فردية">💬</button>'
          : '';
        return '<div class="cmsg" style="margin-bottom:6px;align-items:center">' +
          '<div class="cav" style="background:var(--accent)">' + esc(p.username.slice(-1)) + '</div>' +
          '<div style="flex:1"><div class="cname">' + esc(p.username) + crown + you + mode + '</div>' +
          '<div class="ctext2">' + rd + (p.spectate ? ' ' + T('ui.roomSpectator') : (p.ready ? ' ' + T('ui.roomReady') : ' ' + T('ui.roomNotReady'))) + '</div></div>' +
          pm +
        '</div>';
      }).join('');

      var myReady = st.players.some(function (p) { return p.id === (u && u.id) && p.ready; });
      var mySpect = st.players.some(function (p) { return p.id === (u && u.id) && p.spectate; });
      var btns = '';
      if (st.status === 'waiting') {
        if (!mySpect) {
          btns += '<button class="btn half" onclick="Rooms.setReady(' + !myReady + ')">' +
            (myReady ? T('ui.roomNotReady') : T('ui.roomReady')) + '</button>';
        }
        /* الضيف: يلعب أو يكتفي بالفرجة (صاحب الغرفة هو الموزع دائماً) */
        if (!isOwner) {
          btns += '<button class="btn half" onclick="Rooms.toggleSpectate()">' +
            (mySpect ? '🎮 ' + T('ui.roomPlay') : '👁️ ' + T('ui.roomSpectate')) + '</button>';
        }
        if (isOwner) {
          btns += '<button class="btn half gold" onclick="Rooms.startGame()" ' +
            (allReady ? '' : 'disabled') + '>' + T('ui.roomStart') + '</button>';
        }
      } else {
        btns += '<div class="ctext" style="padding:8px 0;text-align:center">▶ ' + T('ui.roomPlaying') + '</div>';
      }
      btns += '<button class="btn ghost full" onclick="Rooms.leaveRoom()">' + T('ui.roomLeave') + '</button>';

      /* الحفاظ على نص الإدخال أثناء إعادة الرسم (تحديثات room:update) */
      var prevInput = '';
      var prevInp = document.getElementById('roomChatInput');
      if (prevInp) prevInput = prevInp.value;

      body.innerHTML =
        '<div class="ctitle" style="text-align:center">🛡️ ' + T('ui.roomTitle') + '</div>' +
        '<div style="text-align:center;font-size:2.2rem;font-weight:800;letter-spacing:6px;color:var(--gold,#F5C518);padding:8px 0" dir="ltr">' + esc(st.code) + '</div>' +
        '<div style="text-align:center;margin-bottom:10px">' +
          '<button class="btn ghost small" onclick="Rooms.copyCode()" style="margin-left:6px">📋 ' + T('ui.roomCopy') + '</button>' +
          '<button class="btn ghost small" onclick="Rooms.copyLink()">🔗 ' + T('ui.roomInviteLink') + '</button>' +
        '</div>' +
        '<div class="ctext" style="padding:4px 0">' + T('ui.roomPlayers') + ' (' + st.players.length + '/' + st.max_players + ')</div>' +
        '<div style="max-height:150px;overflow-y:auto;margin-bottom:10px">' + rows + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' + btns + '</div>' +
        /* ── محادثة الغرفة (جماعية + فردية) ── */
        '<div class="rchat">' +
          '<div class="rchat-head">💬 ' + T('ui.roomChatTitle') + '</div>' +
          '<div class="rchat-recipient" id="roomChatRecipient"></div>' +
          '<div class="rchat-msgs" id="roomChatMsgs"></div>' +
          '<div class="rchat-send">' +
            '<input class="cin" id="roomChatInput" maxlength="300" placeholder="' + T('ui.roomChatPlaceholder') + '"' +
            ' onkeydown="if(event.key===\'Enter\') Rooms.sendChat()" aria-label="الرسالة">' +
            '<button class="btn small gold" onclick="Rooms.sendChat()" aria-label="إرسال">➤ ' + T('ui.roomChatSend') + '</button>' +
          '</div>' +
        '</div>';

      var newInp = document.getElementById('roomChatInput');
      if (newInp) newInp.value = prevInput;
      Rooms.renderChat();
    },

    /* رسم منطقة المحادثة فقط (بلا إعادة بناء بقية المودال) */
    renderChat: function () {
      var box = document.getElementById('roomChatMsgs');
      var rec = document.getElementById('roomChatRecipient');
      if (!box) return;
      var u = me();
      /* شريط المستلم */
      if (rec) {
        if (_recipient) {
          rec.innerHTML = '<span>' + T('ui.roomChatTo') + ' <b>' + esc(_recipient.name) + '</b> 🔒</span>' +
            '<button class="rchat-clear" onclick="Rooms.setRecipient(null)" aria-label="إلغاء">✕</button>';
        } else {
          rec.innerHTML = '<span>👥 ' + T('ui.roomChatAll') + '</span>';
        }
      }
      /* الرسائل المرئية لي: الجماعية + الفردية التي أنا طرف فيها */
      var mineId = u ? u.id : null;
      var html = '';
      var empty = true;
      _messages.forEach(function (m) {
        var isMine = m.from_id === mineId;
        var involved = m.to_id == null || m.to_id === mineId || isMine;
        if (!involved) return;
        empty = false;
        var who = isMine ? T('ui.roomChatYou') : esc(m.from_name);
        var cls = isMine ? 'mine' : (m.to_id != null ? 'pm' : '');
        var tag = m.to_id != null
          ? '<span class="rchat-tag">🔒</span> ' + esc(m.from_name) + (isMine ? '' : ' → ' + esc(m.to_name || ''))
          : esc(m.from_name);
        html += '<div class="rchat-msg ' + cls + '">' +
          '<span class="rchat-name">' + tag + '</span>' +
          '<span class="rchat-text">' + esc(m.text) + '</span>' +
        '</div>';
      });
      box.innerHTML = empty
        ? '<div class="rchat-empty">' + T('ui.roomChatEmpty') + '</div>'
        : html;
      box.scrollTop = box.scrollHeight;
    },

    copyCode: function () {
      if (!Rooms.state) return;
      var code = Rooms.state.code;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function () { toast(T('ui.roomCopied'), 'ok'); },
          function () { window.prompt(T('ui.roomCopy'), code); });
      } else {
        window.prompt(T('ui.roomCopy'), code);
      }
    },
    copyLink: function () {
      if (!Rooms.state) return;
      var link = location.origin + '/?room=' + Rooms.state.code;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(function () { toast(T('ui.roomCopied'), 'ok'); },
          function () { window.prompt(T('ui.roomInviteLink'), link); });
      } else {
        window.prompt(T('ui.roomInviteLink'), link);
      }
    },

    /* انضمام تلقائي من الرابط ?room=CODE (بعد استعادة الجلسة) */
    tryAutoJoin: function () {
      var m = /[?&]room=([A-Za-z0-9]+)/.exec(location.search);
      if (!m) return;
      var code = m[1].toUpperCase();
      Rooms.joinRoom(code);
    },

    reset: function () {
      _gameHandler = null;
      _startHandler = null;
      Rooms.state = null;
      _messages = [];
      _recipient = null;
    }
  };

  window.Rooms = Rooms;
})();
