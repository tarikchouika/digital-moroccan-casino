# تحديث تنسيق الفريق — تكامل نفق الهاتف + النشر الموحّد (2026-09-10)

> **إلى المساعدين الآخرين (خاصة وكيل Ronda/الواجهة):** هذا سجل ما فعله وكيل النفق (Kimi Code CLI على الهاتف).
> اقرأوا هذا قبل أي نشر جديد — حتى لا يتكرر «طمس النشرات» الذي حدث اليوم.

## 1) البنية الحية الآن (تم التحقق منها ساعة 22:30)

```
متصفح اللاعب
  → https://dmgames.pages.dev              (الواجهة — Cloudflare Pages)
     api.js يقرأ /api-url2.json (بلا كاش)
  → https://casino-phone.dmgames-api.workers.dev   (Worker وسيط — العنوان الدائم الذي لا يتغير أبداً)
     يقرأ عنوان النفق الحي من KV: namespace 4e337927984c41698964a7d655dee71b, مفتاح "url"
  → https://<xxx>.lhr.life   (نفق localhost.run SSH — يغيّر عنوانه كل بضع ساعات)
  → الهاتف: server.js (منفذ 3000) + data/royalcoin.db (SQLite المحلي — 40 مستخداً)
```

**قاعدة ذهبية:** الواجهة لا ترى أبداً عنوان `lhr.life` — كل شيء يمر عبر الووركر الدائم `casino-phone.dmgames-api.workers.dev`. عند تغيّر النفق، يكتب سكربت الهاتف القيمة الجديدة في KV خلال ثوانٍ (لا نشر Pages كامل).

## 2) ما طُمس سابقاً وقد أُصلح الآن (اعتباراً من نشر f1ab1264 وما بعده)

1. **إصلاحات روندا v2.10–v2.11 (rdc3)** من فرع `arena/01a081af @ 5b70b94`: حية الآن — `?v=rdc3` ×9 في index.html الحي.
2. **`_headers` الأمني (CSP/HSTS/XFO) استُعيد** مع إضافة: `connect-src` يسمح الآن بـ `casino-phone.dmgames-api.workers.dev` + `*.lhr.life` + `*.trycloudflare.com` + `*.loca.lt`.
3. **قواعد بلا كاش** لـ `/api-url2.json` و `/tunnel-live.json` و `/api-url.json` (كان الكاش الأسبوعي يخدم عنوان نفق ميت — سبب انقطاع الدخول سابقاً).

## 3) تعديلات الوكيل على ملفات الواجهة (فوق فرع arena)

- `js/core/api.js` — يعيد `API_BASE_PROMISE` (Promise) بدل سلسلة ثابتة: يقرأ `/api-url2.json` بلا كاش، **fallback ديناميكي**: إذا ردّ الووركر الوسيط خطأ 502+/HTML، يعيد الطلب فوراً على Worker السحابي `casino-api.dmgames-api.workers.dev` في نفس الاستدعاء (بلا إعادة تحميل).
- `js/core/live-ws-bridge.js` — نفس جلب العنوان، + `isSSEMode`: إذا كان الهدف الووركر الوسيط أو نفق `lhr.life`/`trycloudflare`/`loca.lt`، يُبقي `EventSource` الأصلي (SSE إلى `/api/live`) ولا يستبدله بـ WebSocket (خادم الهاتف لا يدعم WS)، ويتخطى `watchRoom`.
- `scripts/deploy-pages.sh` — **يجلب أحدث من GitHub أولاً** (`git fetch origin`) قبل البناء (يمنع تكرار نشر نسخ قديمة)، وينسخ `api-url2.json` و `tunnel-live.json` مع النشر.
- `api-url2.json` (ثابت): `{"url": "https://casino-phone.dmgames-api.workers.dev"}` — لا يغيّره أحد.
- `tunnel-live.json` (حي): آخر عنوان نفق معروف — للعرض/التشخيص فقط؛ **المصدر الرسمي هو KV**.

## 4) خدمات الهاتف (pm2 — محفوظة بـ pm2 save)

| الاسم | الوظيفة |
|---|---|
| `casino-server` | `node server.js` منفذ 3000 + SQLite |
| `dmgames-tunnel` | `/root/dmgames-tunnel.sh`: نفق localhost.run SSH + كتابة KV مباشرة عند كل تغيير + مراقبة صحية كل 30ث |
| `cloudflared-tunnel` | نفق Cloudflare المسمى (احتياطي مستقبلي — بلا مسار DNS حالياً) |
| `kimi-web` | خادم واجهة Kimi الإدارية (منفذ 58627) |

## 5) للنشر مستقبلاً (تعليمات ملزمة)

1. **ابدأ دائماً من أحدث فرع GitHub** — سكربت `scripts/deploy-pages.sh` يفعل ذلك تلقائياً.
2. ملفات تكامل النفق أعلاه **جزء من الإنتاج** — لا تحذفوها من النشر.
3. بعد أي نشر، تحققوا حياً:
   - `curl https://dmgames.pages.dev/api-url2.json` → يجب أن يعطي `casino-phone...`
   - `curl https://casino-phone.dmgames-api.workers.dev/api/health` → `{"ok":true}`
4. حسابات الدخول التجريبية (أنشئتها في SQLite الهاتف): valantini/Ilyass@2026، ilyass/Ilyass@2026، adil/Adil@2026، tarikch/Tarikch@2026، Tarikchok/Tarikchok@2026 + super وadmin الأصليان.
5. D1 السحابي ما زال موجوداً كمصدر احتياطي (تجاوز حصة القراءة اليومية؛ يعود بعد منتصف الليل UTC) — لم يُحذف.

## 6) الملفات على الهاتف

- `/root/dmgames-arena/` — شجرة العمل (فرع arena + تعديلات النفق) — **مصدر النشر**
- `/root/dmgames-tunnel.sh` — سكربت النفق + KV
- `/root/dmgames-proxy-worker/` — كود الووركر الوسيط (casino-phone)
- `/root/digital-moroccan-casino/` — المستودع الأصلي (فرع backup قديم — لا تنشروا منه مباشرة!)

## 7) تحديث 2026-09-11: إصلاح لوحة الأدمن + إزالة عجلة الحظ (v2.13)

- **تبديل pm2**: `casino-server` يشغّل الآن `/root/dmgames-arena/server.js` (الخادم المصلح) بدل `/root/digital-moroccan-casino/server.js` القديم — منفذ 3000 كما هو. تم `pm2 save`.
- **نقل قاعدة البيانات**: قُلّدت القاعدة القديمة بعد `pm2 stop` + `PRAGMA wal_checkpoint(TRUNCATE)` → `/root/dmgames-arena/data/royalcoin.db` (42 مستخدماً حقيقياً — كل الحسابات والأرصدة انتقلت). القاعدة القديمة باقية في مكانها كنسخة احتياطية.
- **إضافة `/api/health`**: يعيد `{"ok":true,"service":"dmgames-arena","ts":...}` — مسار تشخيص عام بلا مصادقة.
- **fallthrough 404**: المسارات المجهولة تعيد الآن 404 صريحاً بدل `{ok:true}` الزائف الذي كان يخفي أخطاء الواجهة.
- **إزالة عجلة الحظ (wheelModal)**: حُذفت كلياً من `index.html` — النسخة الحية `dmgames.pages.dev` فيها 0 إشارة لـ wheelModal (تم التحقق بعد نشر f340d83f).
- **نشر جديد**: f340d83f على Cloudflare Pages (فرع main الإنتاجي) — الحي مطابق لشجرة العمل المحلية بالبايت.
- **⚠️ مهم لأي وكيل آخر**: تعديلات v2.13 هذه **غير ملتزمة في git** (بأمر صريح من المستخدم). أي وكيل سينشر بعدي يجب ألا يفعل ذلك فوق هذا إلا بعد `git pull` / جلب الحالة الحية من هذا السجل أو من الخادم — سكربت `scripts/deploy-pages.sh` يبني من شجرة العمل المحلية الحالية (لا يعمل reset)، لذا أي نشر متزامن قد يطمس هذه الإصلاحات. أكّدوا أولاً أن `curl https://dmgames.pages.dev/index.html` لا يحتوي `wheelModal` وأن `https://casino-phone.dmgames-api.workers.dev/api/health` يعيد `ok:true` قبل وبعد أي نشر لاحق.

## 8) تنسيق الفريق عبر GitHub (2026-09-11 ليلة)

- **الفرع:** `arena/samsung-fixes-20260911` — commits: `1185ded` (v2.13 كاملة) + commit GITHUB_SYNC.md
- **العائق:** لا اعتماديات GitHub على هاتف Samsung (مفاتيح SSH غير مسجلة عند GitHub، لا token). الـ push غير ممكن من هنا مباشرة.
- **الحل المؤقت الموثق:** `/root/v213-full.patch` (كلا الـ commitين) + `/tmp/dmgames-v213.bundle` (bundle كامل). مساعد الكات يطبق الـ patch فوق `5b70b94` ويدفع.
- **GITHUB_SYNC.md** — ملف تسليم كامل لمساعد الكات: ماذا يحتاج، كيف يطبق، وما تحذيرات النشر/KV.
- **قبل أي نشر من أي هاتف:** تحقق من الحي أولاً: `rdc4=9`، `wheelModal=0`، `/api/health` عبر الووركر = `ok:true`. وحدّث هذا الملف بما تغير.

## 9) v2.14: سجل معاملات دائم + تذاكر رهانات + تدقيق السوبر (2026-09-12، cat)

**الفرع `arena/samsung-fixes-20260911` مدفوع إلى GitHub** — commits: `a3aef4a` (frontend-tx: الواجهة) + `2087a2c` (v2.14: server.js). الاعتمادات مهيأة على هذا الهاتف (token للمستخدم tarikchouika) والـ push يعمل مباشرة — انتهى عصر الـ patch/bundle.

### الجداول الجديدة (تُخلق تلقائياً عند إقلاع server.js — CREATE TABLE IF NOT EXISTS، لا ترحيل يدوي):

- **`transactions`**: `id, user_id, type, amount, balance_after, counterparty_id, counterparty_name, actor_id, actor_name, game_id, note, created_at` + فهارس `idx_tx_user_time(user_id, created_at)` و `idx_tx_type(type)`. الأنواع المسجلة: `transfer_out, transfer_in, charge, deduct, set_balance, referral_bonus, claim, win, bet`.
- **`bet_tickets`**: `id, user_id, game_id, bet, won, payout, result_txt, created_at` + فهرس `idx_tk_user_time(user_id, created_at)`.
- **`logTx(user, type, amount, extra)`**: دالة إدراج داخل try/catch — تُستدعى من: transfer (سطران: out/in)، claim، set_balance، charge (+ referral_bonus للمحيل)، deduct، ومسار settle للغرف (win للفائز / bet للخاسر). `transfersList` الذاكرية حُذفت نهائياً من الملف (0 إشارات).

### النقاط الجديدة (عقد الواجهة/الخادم):

- **POST /api/transfer**: يخصم من المرسل وقيّد فعلياً للمستلم (UPDATE gold للطرفين في DB) ويسجل transfer_out/transfer_in مع balance_after لكل طرف. المستلم يجب أن يكون مستخدماً حقيقياً وإلا 404.
- **GET /api/transfers**: من جدول transactions للمستخدم الحالي فقط، limit 100 تنازلياً، الصف فيه type + from_id/from_name/to_name + amount + balance_after + note + created_at.
- **POST /api/rounds**: يسجل تذكرة في bet_tickets (للضيف ok:true بلا تسجيل). **GET /api/rounds**: آخر 100 تذكرة للمستخدم من كل الألعاب. **GET /api/games/:gid/history**: تذاكر المستخدم للعبة المحددة فقط، limit 25.
- **GET /api/admin/transactions** (سوبر فقط؛ الأدمن العادي 403): فلاتر user_id / type / limit (افتراضي 200، أقصى 1000) / offset، مع total. LEFT JOIN users لجلب username — صفوف المستخدمين المحذوفين تبقى ظاهرة (username فارغ، لا تسقط من التدقيق).
- **الواجهة (a3aef4a)**: renderTransactions بشارات لكل نوع (spill ok/bad/عادي)، دمج تذاكر الخادم/المحلي بلا تكرار + حقل بحث في سجل التذاكر، تبويب «السجلات» في لوحة الأدمن (سوبر فقط) مع فلاتر مستخدم/نوع، زر «سجل» لكل مستخدم في جدول المستخدمين، مفاتيح ترجمة جديدة بالأربع لغات.

### من ينشر: sam فقط

هذا العمل **غير منشور على الحي** — cat دفع الفرع إلى GitHub فقط (قاعدة صارمة: لا نشر Pages، لا pm2 إنتاجي، لا KV). خطوات sam: `git fetch` + دمج/تطبيق الفرع → إعادة تشغيل خادمه (الجداول تُخلق عند الإقلاع تلقائياً) → نشر Pages من الشجرة المدمجة. تفاصيل التسليم في `GITHUB_SYNC.md`.

### تحقق cat (E2E كامل على منفذ 3995 ضد data/royalcoin.db):

- login player → POST /api/rounds (bl, bet 50) → ok:true، التاريخ يعرض الصف، /api/rounds يعرضه. ✓
- POST /api/transfer من player إلى super بمبلغ 30 → ok:true، gold: 970 (1000−30)، super: 1093 (1063+30). الطرفان يريان transfer_out/transfer_in مع balance_after. ✓
- حساب اختبار عبر /api/admin/register + شحن 100 عبر /api/admin/user/57/balance → الحساب يرى صف charge بمبلغ 100 وfrom_name=super. ✓
- GET /api/admin/transactions بلا فلتر: rows فيها username (total=3)؛ ?user_id=57 يفلتر (total=1). ✓
- أدمن عادي على /api/admin/transactions → 403 «سوبر أدمن فقط». ✓
- الحساب الاختباري حُذف عبر /api/admin/user/57/delete، وصف charge اليتيم حُذف من transactions — بقي 42 مستخدماً. تذكرة player (bl/50) وتحويل الـ30 أُبقيا كوثيقة عمل حقيقية.

## 9) v2.15 (2026-09-12) — القوائم القانونية + روندا لاندسكيب + بينالتي 9 + بلاكجاك جماعي

> الوكيل cat. Commits: `2bd0163` (الكود) → `8e65e14`+ (توثيق). مرفوع لـ GitHub. **sam ينشر**.

### الإصلاحات الستة المطلوبة من المستخدم:

1. **شارة عدد الألعاب في القائمة القانونية حُذفت** (legal-ui.js سطر 42) — كانت «22» وقد صُححت الرئيسية سابقاً وبقيت القانونية.
2. **أيقونة العدالة والشفافية**: وُحدت إلى fa-solid fa-scale-balanced (مطابقة للرئيسية) + أُضيف **بند قائمة** باسمها بعد Provably Fair + side-foot صار sticky أسفل القائمة على الجوال فلا تختفي الأيقونات الثلاث بعد الآن (07-responsive.css).
3. **ترجمة قائمة المستخدم**: الأزرار الستة بـ data-i18n + setLang يعيد بناء القائمة + auto-lang يعيد بنائها بعد authRestore في الصفحات القانونية (كانت تبقى بلغة البناء الأول).
4. **روندا لاندسكيب** (css/14-ronda-classic.css كتلة landscape جديدة بالكامل في نهاية الملف):
   - أوراق الخصوم موحدة الحجم (كانت مختلفة بين uppers وbl)
   - أيقونة كل لاعب **بجانب** أوراقه: tl/bl يمين الأوراق، tr يسارها (row-reverse)، الرئيسي br على خط يده أفقياً
   - bl مرفوع فوق مستوى الصف السفلي — لا حشر فوق أوراق الرئيسي
   - **مقبض سجل الأحداث أعلى الشاشة فوق عنوان الروندا** (log-panel top:0 وال عنوان ينزل)
   - ملاحظة نشر: index.html يحيل الملف بـ ?v=rdc4 — يحتاج rdc5 لكسر الكاش (على sam)
5. **بينالتي شوت أوت 9 جهات** (3×3 بدل 3): PN_DIRS تسعة رموز، شبكة أزرار grid 3×3، حركة كرة/حارس بـ PN_POS (X وY)، المضاعف ×1.08 (RTP 96% بدقة — تحقق مونت كارلو 100k تسديدة)، ترجمات pn.tl..pn.br بالأربع لغات.
6. **بلاك جاك جماعي بلا بانكر (2-4 مقاعد)**: BJMP دوال نقية (newRound/applyAct/settle) + وضع غرفة عبر النمط المعتمد (سائق يدير ويبث rmove bjmove/bjact/bjsettle + moveHistory للعائدين) + مهلة دور 30ث تلقائية + بوت (≥17 وقوف) + تسوية خادمية settleRound (w0-w3/draw — الخادم يدعمها بعد التعديل) + roomGameIds bj:4 + maxp في gameOpts + catalog محدث. اختبار وحدوي tests/_bjmp_test.js **33/33**.

### إصلاح جانبي مكتشف:
css/03-components.css كان فيه كتلة `#toasts` مكررة معلقة (سطران يتيمان) من إصدار قديم — سببت اختلال أقواس (337/338). أزيلت — الآن متوازن.

### ثغرة موثقة (خارج نطاق هذه الجولة):
server.js لا يبث `blindResult` إطلاقاً — ألعاب penalty/rps في وضع الغرف تختار أعمى لكن الكشف لا يتم أبداً (تعلّق في «بانتظار») على phone server. cf-worker السحابي قد يعالجها — sam يفحص خادمه. كذلك بقايا نصوص قديمة للبينالتي في catalog.js:560 و game-rules.js:1188-1223 (نص وصف فقط).

### لـ sam: إعادة تشغيل الخادم + نشر Pages + رفع rdc4→rdc5 في index.html عند النشر. التفاصيل الكاملة في GITHUB_SYNC.md قسم v2.15.

## 10) v2.16 (2026-09-12) — ظهر بطاقات شفاف + قرعة موزع الروندا + إزالة نهائية للعجلة

> الوكيل cat. Commits: `c0da2a7` + `1c5bf47`. sam ينشر + يعيد تشغيل خادمه.

1. **ظهر البطاقات الجديد (من صورة المستخدم)**: أزيلت الخلفية الرمادية بالكامل → back.webp شفاف (RGBA 540×780) حل محل القديم في كل ألعاب الأوراق (روندا كلاسيك/فلاند/رامي/بلاكجاك/hi-lo/baccarat/داي-تشي/فيديو بوكر/poker/andar-bahar — كلها تشير لنفس الملف). CSS نُظف من التدرجات الداكنة المتراكبة (كانت تظهر عبر الشفافية). + back-sm.webp وback-new.png احتياطيان.
2. **قرعة الموزع الأول (بينيا)**: ورقة واحدة لكل لاعب — أصغر ورقة توزع (RANK_SEQUENCE). تعادل → إعادة سحب للمتعادلين. حتمية بالـ seed → الغرف متسقة. حدث FirstDealerDrawn + لوج/بانر بورقات القرعة في الواجهتين (rd-app + ronda-game القديم). اختبار 13/13 (tests/_ronda_dealer_test.js).
3. **إزالة عجلة الحظ النهائية**: /api/claim → 410 Gone نهائياً؛ /api/me بلا حقول claim؛ عمود last_claim حذف من المخطط والاستعلامات؛ claimDaily حذفت من main.js/state.js؛ ts.claim/ts.wait/ui.claim حذفت من الترجمات. (ويل أوف فورتشن wf لعبة مستقلة بقيت).
4. **فحوصات**: كل node --check ناجح، CSS متوازن، اختبارات 13/13 + 33/33، إقلاع خادم + claim:410 + me نظيف.

### لـ sam: إعادة تشغيل الخادم إلزامي (عقد 410 الجديد) + رفع أرقام كاش CSS/JS عند النشر + الأصول الجديدة في git.
