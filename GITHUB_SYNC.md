# GitHub Sync — v2.14 (هاتف الكات = مسؤول DB والإصلاحات والرفع؛ سام = مسؤول النشر الحي)

**تحديث 2026-09-12 (cat):** الفرع `arena/samsung-fixes-20260911` **مدفوع إلى GitHub** — commits: `a3aef4a` (frontend-tx) + `2087a2c` (v2.14 server). **اعتمادات مهيأة (token للمستخدم tarikchouika) — push يعمل من هذا الهاتف** مباشرة عبر HTTPS (`/root/.git-credentials`)، لم يعد هناك حاجة للـ patch/bundle اليدوي.

**أنا cat** (هاتف Samsung): قاعدة البيانات SQLite + الإصلاحات + `git push` إلى GitHub. **سام هو مسؤول النشر الحي** (Pages + خادم الإنتاج) — cat لا ينشر إطلاقاً.

## ماذا يجب أن يفعل sam لتفعيل v2.14 (خطوات ملزمة):

1. **جلب الفرع:** `git fetch origin && git checkout arena/samsung-fixes-20260911` (أو دمج/cherry-pick فوق فرعه العام). رأس الفرع الآن `2087a2c`.
2. **إعادة تشغيل خادمه** (pm2 casino-server أو ما يعادله لديه): الجداول الجديدة `transactions` و `bet_tickets` **تُخلق تلقائياً عند الإقلاع** بـ `CREATE TABLE IF NOT EXISTS` داخل `db.exec` في server.js — لا ترحيل يدوي ولا سكربت SQL مطلوب.
3. **نشر Pages من الشجرة المدمجة** (deploy-pages.sh أو ما يعادله): نقاط الواجهة الجديدة (شارات أنواع المعاملات، بحث التذاكر، تبويب «السجلات» للأدمن السوبر) **تعمل فقط بعد نشر sam** — قبل النشر ستواجه الواجهة الحية نقاط نهاية لا يفهمها الخادم القديم أو العكس، لكن لا شيء يتعطل: الواجهة تتسامح مع الغياب.
4. **التحقق بعد النشر:** دخول super → تبويب «السجلات» يعرض جدول المعاملات؛ لعبة أي لعبة → سجل التذاكر يعرض صفوفاً محفوظة بعد إعادة التحميل.

## محتوى v2.14 المدفوع (عقد الواجهة/الخادم):

- **جداول DB:** `transactions` (سجل معاملات دائم: user_id, type, amount, balance_after, counterparty_id/name, actor_id/name, game_id, note, created_at + فهارس) و `bet_tickets` (تذاكر رهانات دائمة: user_id, game_id, bet, won, payout, result_txt, created_at + فهرس).
- **POST /api/transfer:** يخصم من المرسل ويقيّد فعلياً للمستلم (UPDATE gold في DB للطرفين) ويسجل `transfer_out`/`transfer_in` عبر `logTx` — كانت الرصيد السابق لا يصل للمستلم إلا في الذاكرة أو لا يصل.
- **GET /api/transfers:** من جدول `transactions` — أنواع: transfer_out/in, charge, deduct, set_balance, referral_bonus, claim (limit 100 تنازلياً).
- **POST /api/rounds:** يسجل تذكرة في `bet_tickets`؛ **GET /api/rounds:** آخر 100 تذكرة للمستخدم من كل الألعاب؛ **GET /api/games/:gid/history:** تذاكر المستخدم للعبة (limit 25).
- **GET /api/admin/transactions** (سوبر فقط — أدمن عادي 403): فلاتر user_id/type/limit/offset، LEFT JOIN على users لجلب username (صفوف المستخدمين المحذوفين تبقى ظاهرة بـ username فارغ).
- **مسار الغرف (settle):** حُذف `transfersList` الذاكرية نهائياً واستُبدلت بـ `logTx` دائم: `win` للفائز و `bet` للخاسر مع game_id و balance_after.
- **الواجهة (commit a3aef4a):** renderTransactions متعدد الأنواع بشارات، دمج تذاكر الخادم/المحلي بلا تكرار + بحث، تبويب «السجلات» للسوبر + زر «سجل» لكل مستخدم في جدول الأدمن، مفاتيح ترجمة جديدة (ar/fr/en/دارجة).

## سجل v2.13 السابق (للمرجع فقط — كل هذا داخل الفرع المدفوع):

**التاريخ:** 2026-09-11 ~23:20 | **الفرع:** `arena/samsung-fixes-20260911` (كان commit `1185ded`)
**الحالة:** ✅ كان منشوراً حياً ومُتحققاً منه (Pages deploy `5c7e1d69`) + pm2 يعمل بالكود الجديد

## محتوى v2.13 (كلها أصلاً داخل الفرع المدفوع — للمرجع فقط):

### server.js (مهم — انسخها لخادم الكات إن كان هو الإنتاجي):
- `/api/health` صريح: `{"ok":true,"service":"dmgames-arena"}` — **مطلوب لسكربت النفق** (`/root/dmgames-tunnel.sh` يفحصه كل 30ث!)
- **fallthrough 404**: المسارات المجهولة تعيد 404 بدل `{ok:true}` الزائف
- **كوكي `SameSite=None; Secure`** في login/logout (وإلا يرفض المتصفح الجلسة عبر الووركر)
- جدول `settings` + `GET/POST /api/admin/rewards` (كانت تختفي — الآن تُحفظ في القاعدة)
- `GET /api/admin/stats/games` (تبويب المالية)

### الواجهة:
- **عجلة الحظ محذوفة كلياً** (طلب المستخدم): modal في index.html + engine في main.js + state.js claimDaily + i18n keys + CSS. زر الرصيد أصبح عرضاً فقط.
- **v2.12 لِمساعد الكات محفوظة بالكامل**: rdc4 ×9، الغرف الموحدة (5% / 1vs2 / 1vs3 / mode4)، rd-app، rd-renderer، rooms.js
- `live-ws-bridge.js`: **نسخة النفق** (isSSEMode — لا تستبدلها بنسخة الووركر السحابي!)

### بنية الإنتاج الآن (تحقّق قبل أي نشر جديد — النشر مسؤولية sam):
```
dmgames.pages.dev (5c7e1d69)
  → casino-phone.dmgames-api.workers.dev  (ووركر وسيط — KV: url)
  → نفق lhr.life (هاتف Samsung، localhost:3000)
  → pm2 casino-server = /root/dmgames-arena/server.js
  → data/royalcoin.db (42 مستخماً حقيقياً منقولة)
```

## ⚠️ تحذيرات التنسيق (لأي وكيل — والنشر الحي حكر على sam):

1. **لا تنشر فوق الحالة الحالية بدون جلبها أولاً** — نشر v2.12 طمر مؤقتاً v2.10/2.11 لأنه بني من شجرة قديمة. قبل أي نشر: `curl -sL https://dmgames.pages.dev/ | grep -c rdc4` يجب = 9، و `grep -c wheelModal` يجب = 0.
2. **سقطة KV**: هاتفانا يكتبان نفس مفتاح KV (نفق كل هاتف). حالياً Samsung يخدم الإنتاج. إن استلمت أنت KV، خادمك (40248) يحتاج نفس server.js المصلح (الأعلاه) — وإلا سترجع أعراض "لا حسابات / لا شحن" ثانية.
3. **راجع هذا الملف دائماً قبل البدء**: `CURRENT_TASK.md` في شجرة dmgames-arena — القسم 7 يوثق v2.13 كاملاً.

## v2.15 (cat — 2026-09-12) — إصلاحات القوائم + روندا لاندسكيب + بينالتي 9 جهات + بلاكجاك جماعي

**Commit:** `2bd0163` على `arena/samsung-fixes-20260911` (بعد `1d89380`)

### ما يجب أن يفعل sam:
1. `git fetch origin && git merge arena/samsung-fixes-20260911` (أو rebase فوق فرعه).
2. **إعادة تشغيل خادمه server.js** — تغييرات خادمية واحدة: `ROOM_GAMES_ALLOWED` يدعم bj الآن (سطر ~1699) + settleRound يقبل `w0-w3` (4 مقاعد) — لا ترحيل قاعدة بيانات (لا جداول جديدة هذه الجولة).
3. **نشر Pages** من الشجرة المدمجة. ملاحظة كاش: `css/14-ronda-classic.css` مذكور في index.html بـ `?v=rdc4` — **ارفع الرقم إلى rdc5** عند النشر لكسر كاش CSS (تغييرات لاندسكيب روندا كبيرة). كذلك يفضَّل رفع `?v=` لـ engines.js و blackjack.js و legal-ui.js و auth.js و utils.js (unified14 → unified15) — أو اعتماد كش Cloudflare تلقائي.
4. اختبار سريع بعد النشر: `curl -sL 'https://dmgames.pages.dev/' | grep -c 'wheelModal'` = 0، `grep -c 'badge" aria-label="22'` = 0، ولوحة roندا لاندسكيب: أيقونات اللاعبين بجانب أوراقهم والمقبض أعلى الوسط فوق العنوان.

### محتوى v2.15:
- **legal-ui.js**: حذف شارة «22» من بند الألعاب، توحيد أيقونة العدالة والشفافية (fa-solid fa-scale-balanced)، إضافة بند «العدالة والشفافية» للقائمة بعد Provably Fair، تثبيت side-foot أسفل القائمة على الجوال (07-responsive.css: sticky bottom).
- **auth.js/utils.js/auto-lang.js**: أزرار قائمة المستخدم بـ span data-i18n + إعادة بناء القائمة عند setLang + مراقب auto-lang يعيد بناءها بعد authRestore في الصفحات القانونية.
- **css/14-ronda-classic.css** (كتلة landscape جديدة في النهاية): توحيد حجم صفوف ظهر الخصوم (0.62/0.82 من chB)، مقاعد tl/tr/bl أفقية (أيقونة بجانب الأوراق: اليساريون أيقونتهم يمين الأوراق، tr أيقونته يسارها)، br الرئيسي على خط اليد أفقياً، رفع bl فوق مستوى الصف السفلي (فصل عن أوراق الرئيسي)، مقبض السجل أعلى الوسط فوق العنوان (rd-tophead ينزل clamp(16px,3.4vh,26px)).
- **engines.js Penalty**: 9 جهات (3×3: أعلى/وسط/أسفل × يسار/وسط/يمين) برموز أسهم، جدول PN_POS إحداثيات، مضاعف ×1.08 (RTP 96% — تصدي الحارس 1/9)، شبكة أزرار 3×3 (.pn-picks.nine)، مفاتيح ترجمة pn.tl..pn.br بالأربع لغات + pn.hint جديد.
- **blackjack.js BJMP**: بلاك جاك جماعي 2-4 لاعبين **بلا بانكر** — دوال نقية window.BJMP (newRound/applyAct/settle)، وضع الغرفة عبر rmove (سائق = driver) + bjmove/bjact/bjsettle، مهلة دور 30ث → stand تلقائي، بوت آلي (≥17 وقوف)، تسوية خادمية عبر settleRound بنفس مسار ضاما (w0-w3/draw — تعادل جماعي = استرجاع)، اختبار وحدوي tests/_bjmp_test.js (33/33).
- **server.js**: ROOM_GAMES_ALLOWED + bj، settleRound يقبل w0-w3.
- إصلاح جانبي: كتلة `#toasts` مكررة معلقة في css/03-components.css (من إصدار قديم) أزيلت — كانت تسبب اختلال أقواس.

### ملاحظات لـ sam (ثغرات موثقة — خارج نطاق cat هذه الجولة):
1. **blindResult لا يبثه server.js إطلاقاً**: وضع غرف penalty/rps على phone server معلق بعد اختيار الطرفين (اختيارات كشفها يصل مباشرة). يحتاج معالج action:'blind' يجمع الزوج ثم يبث blindResult — إن لم يكن خادمك السحابي (cf-worker) يعالجها فعلاً.
2. بقايا وصف قديم للبينالتي (×1.45/3 جهات) في catalog.js:560 و game-rules.js:1188-1223 — تحديث نصي فقط.
3. غرف البلاكجاك تعتمد rmove driver مثل روندا — الخادم يمررها كما هي (مدعوم أصلاً).
