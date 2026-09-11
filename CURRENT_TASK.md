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
