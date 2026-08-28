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
  var _updateHandler = null; // [Req3] معالج تحديث حالة الغرفة (لتحديث واجهة التصويت)
  var _messages = [];        // رسائل الغرفة (جماعية + فردية مستلمة)
  var _pendingReplay = null;  // [Resilience] تاريخ الحركات لإعادة بناء الحالة عند العودة
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
    roomGameIds: { rp: 2, pn: 2, pr: 4, rn: 4, rm: 4, dm: 2, ch: 2 },

    isGameSupported: function (id) { return !!Rooms.roomGameIds[id]; },
    isActive: function () { return !!(Rooms.state && Rooms.state.status === 'playing'); },
    maxFor: function (id) { return Rooms.roomGameIds[id] || 2; },
    /* إظهار/إخفاء زر «العب مع صديق» حسب اللعبة المفتوحة */
    syncBtn: function () {
      var show = Rooms.isGameSupported(window._currentGameId);
      var b = document.getElementById('roomBtn');
      if (b) b.style.display = show ? '' : 'none';
      var ab = document.getElementById('aiBtn');
      if (ab) ab.style.display = show ? '' : 'none';
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
      /* [Req7] رمز تعبيري/تفاعل وارد من عضو في الغرفة */
      _source.addEventListener('room:react', function (e) {
        try { Rooms._onReact(JSON.parse(e.data)); } catch (err) { console.error('[rooms] react', err); }
      });
      /* [Req8] رسالة صوتية واردة (≤10ث) */
      _source.addEventListener('room:voice', function (e) {
        try { Rooms._onVoice(JSON.parse(e.data)); } catch (err) { console.error('[rooms] voice', err); }
      });
      /* [Resilience] إعادة بناء حالة الجولة للاعب العائد (بعد انقطاع/إغلاق) */
      _source.addEventListener('room:replay', function (e) {
        try {
          var d = JSON.parse(e.data);
          _pendingReplay = d;   /* يستهلكها محوّل اللعبة عند فتحها */
          /* [Resilience] إن كانت اللعبة مسجَّلة بالفعل، طبّق الإعادة فوراً */
          try {
            if (typeof window !== 'undefined' && typeof window.applyRoomReplay === 'function') window.applyRoomReplay(d);
            else if (typeof window !== 'undefined' && typeof window.RM_applyReplay === 'function') window.RM_applyReplay(d);
          } catch (er) {}
        } catch (err) { console.error('[rooms] replay', err); }
      });
    },

    _onUpdate: function (room) {
      var prev = Rooms.state;
      var prevStatus = prev ? prev.status : null;
      Rooms.state = room;
      /* بدأت اللعبة للتو → إبلاغ اللعبة (تغلق المودال وتبدأ محلياً) */
      if (room && room.status === 'playing' && prevStatus !== 'playing') {
        Rooms.closeModal();
        if (_startHandler) _startHandler(room);   /* [Req3] يُبقى المعالج لإعادة إطلاقه عند المباراة الجديدة */
      }
      /* غادرت الغرفة (حُذفت أو طردت) */
      if (!room) { Rooms.reset(); Rooms.render(); return; }
      Rooms.render();
      if (_updateHandler) { try { _updateHandler(room); } catch (e) {} }   /* [Req3] تحديث واجهة التصويت */
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
      } else if (msg.to_id == null && msg.from_id !== (u && u.id)) {
        /* [Req7] الرسائل الجماعية تظهر أثناء اللعب (دون فتح المودال) */
        toast('💬 ' + esc(msg.from_name) + ': ' + esc(msg.text), 'ok');
        if (typeof SND !== 'undefined' && SND.notify) SND.notify();
      }
    },
    /* [Req7] تفاعل وارد: رمز يطفو على شاشة الجميع (لاعبين + متفرجين) */
    _onReact: function (d) {
      if (!d || !d.emoji) return;
      Rooms._spawnReact(d.emoji, d.from_name || '');
      if (typeof SND !== 'undefined' && SND.notify) SND.notify();
    },
    /* رسم رمز طافٍ متحرك يختفي تلقائياً */
    _spawnReact: function (emoji, name) {
      var host = document.getElementById('roomReactStage') || Rooms._ensureReactStage();
      if (!host) return;
      var el = document.createElement('div');
      el.className = 'room-react-burst';
      var left = 18 + Math.random() * 60;
      el.style.left = left + '%';
      el.innerHTML = '<span class="rrb-emoji">' + esc(emoji) + '</span>' + (name ? '<span class="rrb-name">' + esc(name) + '</span>' : '');
      host.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2600);
    },
    _ensureReactStage: function () {
      var st = document.createElement('div');
      st.id = 'roomReactStage';
      st.className = 'room-react-stage';
      document.body.appendChild(st);
      return st;
    },
    /* [Req7] إرسال رمز تفاعل للجميع */
    sendReact: function (emoji) {
      if (!Rooms.state) return;
      API.post('/api/rooms/react', { room_id: Rooms.state.id, emoji: String(emoji || '') }).catch(function () {});
      /* أظهره محلياً فوراً */
      var u = me();
      Rooms._spawnReact(emoji, u ? u.username : '');
      Rooms._toggleReactPanel(false);
    },
    /* [Req7] الرسالة السريعة داخل اللعبة (للجميع) */
    sendQuickMsg: function () {
      var inp = document.getElementById('roomReactInput');
      if (!inp || !Rooms.state) return;
      var text = inp.value.trim();
      if (!text) return;
      inp.value = '';
      API.post('/api/rooms/chat', { room_id: Rooms.state.id, text: text, to: null }).then(function (r) {
        if (r && r.ok && r.data && r.data.msg) Rooms._onChat(r.data.msg);
      });
      Rooms._toggleReactPanel(false);
    },
    /* [Req8] تسجيل/إيقاف رسالة صوتية ≤10ث وبثّها للجميع */
    toggleVoice: function () {
      if (Rooms._mr) { Rooms.stopVoice(); return; }
      if (!Rooms.state) return;
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
        toast('🎤 المتصفح لا يدعم تسجيل الصوت', 'err'); return;
      }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        var rec;
        try { rec = new MediaRecorder(stream); } catch (e) { toast('🎤 فشل بدء التسجيل', 'err'); return; }
        Rooms._mr = { rec: rec, chunks: [], stream: stream, start: Date.now() };
        rec.ondataavailable = function (e) { if (e.data && e.data.size) Rooms._mr.chunks.push(e.data); };
        rec.onstop = function () {
          var mr = Rooms._mr; Rooms._mr = null; Rooms._renderVoiceRec(false);
          if (Rooms._voiceTi) { clearInterval(Rooms._voiceTi); Rooms._voiceTi = null; }
          try { mr.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
          var blob = new Blob(mr.chunks, { type: mr.rec.mimeType || 'audio/webm' });
          var dur = Math.max(1, Math.min(10, Math.round((Date.now() - mr.start) / 1000)));
          if (!blob.size) { toast('🎤 تسجيل فارغ', 'warn'); return; }
          var fr = new FileReader();
          fr.onload = function () {
            API.post('/api/rooms/voice', { room_id: Rooms.state.id, audio: fr.result, dur: dur }).catch(function () {});
            toast('🎤 تم إرسال الرسالة الصوتية', 'ok');
          };
          fr.readAsDataURL(blob);
        };
        rec.start();
        Rooms._renderVoiceRec(true);
        Rooms._voiceTi = setInterval(function () {
          var el = document.getElementById('roomVoiceTimer');
          var s = Math.min(10, Math.round((Date.now() - Rooms._mr.start) / 1000));
          if (el) el.textContent = String(s);
        }, 250);
        Rooms._voiceTimer = setTimeout(function () { Rooms.stopVoice(); }, 10000);
      }).catch(function (e) {
        toast('🎤 لا يمكن الوصول للميكروفون: ' + (e && e.message ? e.message : 'مرفوض'), 'err');
      });
    },
    stopVoice: function () {
      if (Rooms._voiceTimer) { clearTimeout(Rooms._voiceTimer); Rooms._voiceTimer = null; }
      if (Rooms._mr && Rooms._mr.rec && Rooms._mr.rec.state !== 'inactive') {
        try { Rooms._mr.rec.stop(); } catch (e) {}
      }
    },
    _renderVoiceRec: function (on) {
      var box = document.getElementById('roomVoiceRec');
      var mic = document.getElementById('roomMicBtn');
      if (box) box.style.display = on ? 'flex' : 'none';
      if (mic) { mic.classList.toggle('rec', !!on); mic.textContent = on ? '⏹' : '🎤'; }
    },
    /* [Req8] رسالة صوتية واردة: تشغيل تلقائي + فقاعة قابلة لإعادة التشغيل */
    _onVoice: function (d) {
      if (!d || !d.audio) return;
      Rooms._spawnVoiceBubble(d.audio, d.from_name || '', d.dur || 0);
      if (typeof SND !== 'undefined' && SND.notify) SND.notify();
    },
    _spawnVoiceBubble: function (dataUrl, name, dur) {
      var host = document.getElementById('roomReactStage') || Rooms._ensureReactStage();
      if (!host) return;
      var el = document.createElement('div');
      el.className = 'room-voice-bubble';
      el.innerHTML = '<span class="rvb-icon">🔊</span>' +
        '<span class="rvb-name">' + esc(name || '') + (dur ? (' · ' + dur + 's') : '') + '</span>';
      el.onclick = function () { try { new Audio(dataUrl).play(); } catch (e) {} };
      host.appendChild(el);
      /* تشغيل تلقائي (قد يُحجب دون تفاعل — تظل الفقاعة قابلة للنقر) */
      try { var a = new Audio(dataUrl); a.play().catch(function () {}); } catch (e) {}
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 6000);
    },
    /* [Req7] إظهار/إخفاء لوحة الرموز والرسائل */
    _toggleReactPanel: function (force) {
      var p = document.getElementById('roomReactPanel');
      if (!p) return;
      var show = (force === undefined) ? (p.style.display === 'none' || !p.style.display) : !!force;
      p.style.display = show ? 'flex' : 'none';
    },
    /* [Req7] الأيقونة الطافية + لوحة الرموز/الرسائل (تظهر داخل غرفة نشطة) */
    _REACT_SET: ['👍', '❤️', '😂', '🔥', '🎉', '😮', '👏', '🤔'],
    _syncReactWidget: function () {
      if (typeof document === 'undefined') return;
      var btn = document.getElementById('roomReactBtn');
      var active = !!(Rooms.state && (Rooms.state.status === 'playing' || Rooms.state.status === 'waiting'));
      if (!btn) {
        if (!active) return;
        btn = document.createElement('button');
        btn.id = 'roomReactBtn';
        btn.className = 'room-react-btn';
        btn.setAttribute('aria-label', 'رموز ورسائل');
        btn.title = 'رموز ورسائل';
        btn.innerHTML = '😊';
        btn.onclick = function (e) { if (e) e.stopPropagation(); Rooms._toggleReactPanel(); };
        var panel = document.createElement('div');
        panel.id = 'roomReactPanel';
        panel.className = 'room-react-panel';
        panel.style.display = 'none';
        var emojis = Rooms._REACT_SET.map(function (em) {
          return '<span class="rrp-emoji" onclick="Rooms.sendReact(\'' + em + '\')">' + em + '</span>';
        }).join('');
        panel.innerHTML =
          '<div class="rrp-head">' + (typeof T === 'function' ? T('ui.reactTitle') || 'تفاعل سريع' : 'تفاعل سريع') + '</div>' +
          '<div class="rrp-emojis">' + emojis + '</div>' +
          '<div class="rrp-msg">' +
            '<button id="roomMicBtn" class="rrp-mic" onclick="Rooms.toggleVoice()" title="' + (typeof T === 'function' ? T('ui.voiceRec') || 'رسالة صوتية ≤10ث' : 'رسالة صوتية ≤10ث') + '" aria-label="رسالة صوتية">🎤</button>' +
            '<input id="roomReactInput" type="text" maxlength="120" placeholder="' + (typeof T === 'function' ? T('ui.reactMsgPh') || 'رسالة للجميع…' : 'رسالة للجميع…') + '" onkeydown="if(event.key===\'Enter\'){Rooms.sendQuickMsg();}">' +
            '<button class="rrp-send" onclick="Rooms.sendQuickMsg()" aria-label="إرسال">➤</button>' +
          '</div>' +
          '<div id="roomVoiceRec" class="rrp-voicerec" style="display:none"><span class="rvr-dot"></span><span id="roomVoiceTimer">0</span>s · ' + (typeof T === 'function' ? T('ui.voiceRecStop') || 'انقر للإيقاف والإرسال' : 'انقر للإيقاف والإرسال') + '</div>';
        document.body.appendChild(btn);
        document.body.appendChild(panel);
        document.addEventListener('click', function (ev) {
          if (!btn.contains(ev.target) && !panel.contains(ev.target)) Rooms._toggleReactPanel(false);
        });
      }
      btn.style.display = active ? 'flex' : 'none';
      if (!active) Rooms._toggleReactPanel(false);
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
    setUpdateHandler: function (fn) { _updateHandler = fn; },   /* [Req3] */
    /* [Resilience] استهلاك تاريخ الحركات المعلّق لإعادة بناء الحالة */
    consumePendingReplay: function () { var h = _pendingReplay; _pendingReplay = null; return h; },
    hasPendingReplay: function () { return !!_pendingReplay; },

    /* ═══════ API ═══════ */
    createRoom: function (gameId, bet) {
      var u = me();
      if (!u) { toast(T('ui.roomNeedLogin'), 'warn'); if (typeof openAuthModal === 'function') openAuthModal(); return; }
      var max = Rooms.maxFor(gameId);
      /* [B10] غرفات الرهان: مبلغ اختياري (شطرنج) */
      var payload = { game_id: gameId, max_players: max };
      if (typeof bet === 'number' && bet > 0) payload.bet = bet;
      return API.post('/api/rooms', payload).then(function (r) {
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
    /* [MP-AI] المضيف يضيف لاعباً آلياً لملء مقعد */
    addBot: function () {
      if (!Rooms.state) return;
      API.post('/api/rooms/addBot', { room_id: Rooms.state.id }).then(function (r) {
        if (r && r.ok && r.data && r.data.room) Rooms._onUpdate(r.data.room);
      });
    },
    /* [MP-AI] المضيف يحذف لاعباً آلياً */
    removeBot: function (botId) {
      if (!Rooms.state) return;
      API.post('/api/rooms/removeBot', { room_id: Rooms.state.id, botId: botId }).then(function (r) {
        if (r && r.ok && r.data && r.data.room) Rooms._onUpdate(r.data.room);
      });
    },
    leaveRoom: function () {
      if (!Rooms.state) return;
      /* [Req6] المُنشئ لا يغلق الغرفة حتى ينتهي الرهان الجاري */
      var u = me();
      var isOwner = Rooms.state.owner_id === (u && u.id);
      if (isOwner && Rooms.state.status === 'playing') {
        toast('لا يمكن إغلاق الغرفة حتى انتهاء الرهان الجاري — انتظر نهاية المباراة', 'warn');
        return;
      }
      var id = Rooms.state.id;
      Rooms.state = null;
      return API.post('/api/rooms/leave', { room_id: id }).then(function () {
        Rooms.reset();
        Rooms.render();
        Rooms.closeModal();
        if (typeof closeGamePage === 'function' && window._currentGameId) closeGamePage();
      });
    },
    /* [Req6] إعلان انتهاء الرهان (المُنشئ فقط) → تعود الغرفة للانتظار ويُسمح بالإغلاق */
    endBet: function () {
      if (!Rooms.state) return;
      var u = me();
      if (Rooms.state.owner_id !== (u && u.id)) return;
      API.post('/api/rooms/endBet', { room_id: Rooms.state.id }).then(function (r) {
        if (r && r.ok && r.data && r.data.room) Rooms._onUpdate(r.data.room);
      });
    },
    /* [Req3] بدء تصويت المباراة الجديدة (المُنشئ، عند نهاية المباراة) */
    startRematch: function () {
      if (!Rooms.state) return;
      API.post('/api/rooms/rematch/start', { room_id: Rooms.state.id }).then(function (r) {
        if (r && r.ok && r.data && r.data.room) Rooms._onUpdate(r.data.room);
      });
    },
    /* [Req3] تصويت مشارك: agree/refuse */
    voteRematch: function (vote) {
      if (!Rooms.state) return;
      API.post('/api/rooms/rematch/vote', { room_id: Rooms.state.id, vote: vote }).then(function (r) {
        if (r && r.ok && r.data && r.data.room) Rooms._onUpdate(r.data.room);
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
        /* مزامنة room_state فقط من استجابة الحركة (الحقل الذي تغيّره فعلاً)؛
           لا نطمس joinQueue/players المتغيّرة عبر بثّ SSE الحيّ بلقطة قديمة */
        if (r.data && r.data.room && Rooms.state && Rooms.state.id === r.data.room.id) {
          Rooms.state.room_state = r.data.room.room_state;
        }
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
    /* [Spectator] طلب الانضمام كمشغل عند تفرّغ مقعد */
    requestJoin: function () {
      if (!Rooms.state) return;
      var u = me();
      if (!u) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
      API.post('/api/rooms/joinRequest', { room_id: Rooms.state.id }).then(function (r) {
        if (!r.ok) toast((r.data && r.data.message) || T('ui.roomError'), 'err');
        else toast(T('rami.specJoinSent') || '✅ تم تسجيل طلب الانضمام — ستنضمّ عند تفرّغ مقعد', 'ok');
      });
    },
    /* هل طلبتي الحالي في طابور الانضمام؟ */
    myJoinPending: function () {
      var u = me();
      if (!Rooms.state || !Rooms.state.joinQueue || !u) return false;
      return Rooms.state.joinQueue.some(function (r) { return r.id === u.id; });
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
        /* [B10] الشطرنج: أنشئ غرفة برهان اللاعب المختار في الإعدادات */
        if (gid === 'ch' && typeof CHESS !== 'undefined' && CHESS && CHESS.bet > 0) {
          Rooms.createRoom(gid, CHESS.bet);
          return;
        }
        Rooms.createRoom(gid);
        return;
      }
      Rooms.openModal();
    },
    /* [MP-AI] غرفة تدريب ضد الآلي: إنشاء غرفة + ملؤها بلاعبين آليين + بدء فوري */
    practiceVsAi: function (gameId) {
      var u = me();
      if (!u) { toast(T('ui.roomNeedLogin'), 'warn'); if (typeof openAuthModal === 'function') openAuthModal(); return; }
      if (!Rooms.isGameSupported(gameId)) return;
      Rooms.createRoom(gameId).then(function () {
        if (!Rooms.state) return;
        var rid = Rooms.state.id;
        var max = Rooms.maxFor(gameId) || 4;
        var n = Math.max(1, max - 1);   /* لاعب بشري واحد + بقية المقاعد آليون */
        function addNext(k) {
          if (k <= 0) {
            Rooms.setReady(true);
            setTimeout(function () { Rooms.startGame(); }, 500);
            return;
          }
          API.post('/api/rooms/addBot', { room_id: rid }).then(function (r) {
            if (r && r.ok && r.data && r.data.room) Rooms._onUpdate(r.data.room);
            setTimeout(function () { addNext(k - 1); }, 180);
          });
        }
        addNext(n);
      });
    },

    render: function () {
      Rooms._syncReactWidget();
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
        var botTag = p.isBot ? ' 🤖' : '';
        /* [MP-AI] زر حذف البوت (للمضيف فقط) */
        var rmBot = (isOwner && p.isBot && st.status === 'waiting')
          ? '<button class="rchat-pm" onclick="Rooms.removeBot(\'' + p.id + '\')" title="إزالة الآلي" aria-label="إزالة الآلي">✖</button>'
          : '';
        /* زر مراسلة فردية لكل لاعب (عدا نفسي) */
        var pm = p.id !== (u && u.id)
          ? '<button class="rchat-pm" onclick="Rooms.setRecipient(' + p.id + ',\'' + esc(p.username).replace(/'/g, "\\'") + '\')" title="مراسلة ' + esc(p.username) + '" aria-label="مراسلة فردية">💬</button>'
          : '';
        return '<div class="cmsg" style="margin-bottom:6px;align-items:center">' +
          '<div class="cav" style="background:var(--accent)">' + esc(p.username.slice(-1)) + '</div>' +
          '<div style="flex:1"><div class="cname">' + esc(p.username) + crown + you + mode + botTag + '</div>' +
          '<div class="ctext2">' + rd + (p.isBot ? ' ' + T('ui.roomBot') : (p.spectate ? ' ' + T('ui.roomSpectator') : (p.ready ? ' ' + T('ui.roomReady') : ' ' + T('ui.roomNotReady')))) + '</div></div>' +
          pm + rmBot +
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
          /* [MP-AI] ملء مقعد بلاعب آلي إن بقيت مقاعد شاغرة */
          var freeSeats = (st.max_players || 4) - st.players.filter(function (p) { return !p.spectate; }).length;
          if (freeSeats > 0) {
            btns += '<button class="btn half" onclick="Rooms.addBot()">🤖 ' + T('ui.roomAddBot') + '</button>';
          }
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

    /* انضمام تلقائي من الرابط ?room=CODE (مع دعم الدخول التلقائي بعد المصادقة) */
    tryAutoJoin: function () {
      var m = /[?&]room=([A-Za-z0-9]+)/.exec(location.search);
      if (!m) return;
      var code = m[1].toUpperCase();
      if (!AUTH || !AUTH.user) {
        try { sessionStorage.setItem('rc_pending_room', code); } catch (e) {}
        toast(T('ui.chatLogin') || 'يرجى تسجيل الدخول للانضمام للغرفة', 'warn');
        if (typeof openAuthModal === 'function') openAuthModal();
        return;
      }
      Rooms.joinRoom(code);
    },
    checkPendingRoom: function () {
      try {
        var code = sessionStorage.getItem('rc_pending_room');
        if (code && AUTH && AUTH.user) {
          sessionStorage.removeItem('rc_pending_room');
          setTimeout(function () {
            Rooms.joinRoom(code);
          }, 300);
        }
      } catch (e) {}
    },

    reset: function () {
      _gameHandler = null;
      _startHandler = null;
      Rooms.state = null;
      _messages = [];
      _recipient = null;
      /* [Req7] إزالة ودجت الرموز/الرسائل عند مغادرة الغرفة */
      var btn = document.getElementById('roomReactBtn');
      var panel = document.getElementById('roomReactPanel');
      if (btn) btn.parentNode && btn.parentNode.removeChild(btn);
      if (panel) panel.parentNode && panel.parentNode.removeChild(panel);
    }
  };

  window.Rooms = Rooms;
})();
