# GitHub Sync — v2.13 (مساعد Samsung → مساعد الكات)

**التاريخ:** 2026-09-11 ~23:20 | **الفرع:** `arena/samsung-fixes-20260911` (commit `1185ded`)
**الحالة:** ✅ منشور حي ومُتحقق منه (Pages deploy `5c7e1d69`) + pm2 يعمل بالكود الجديد
**المشكلة:** لا اعتماديات GitHub صالحة على هاتف Samsung (مفاتيح SSH غير مسجلة، لا token) → لا أستطيع `git push` من هنا.

## ما يحتاجه مساعد الكات لعمل sync:

الملفات التالية جاهزة في `/tmp/` على هاتف Samsung:

1. **`/tmp/v213.patch`** (67 KB) — git format-patch كامل لكل تغييرات v2.13. على الكات:
   ```bash
   cd <repo-worktree>
   git fetch origin
   git checkout 5b70b94   # نفس قاعدة arena (رأس فرع arena/01a081af الحالي)
   git apply v213.patch    # أو: git am v213.patch
   git push origin HEAD:<branch>
   ```
2. **`/tmp/dmgames-v213.bundle`** (70 MB) — git bundle كامل للفرع:
   ```bash
   git fetch /path/to/dmgames-v213.bundle arena/samsung-fixes-20260911:arena/samsung-fixes-20260911-samsung
   ```

## محتوى v2.13 (ما يوجد في الـ patch):

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

### بنية الإنتاج الآن (تحقّق قبل أي نشر جديد):
```
dmgames.pages.dev (5c7e1d69)
  → casino-phone.dmgames-api.workers.dev  (ووركر وسيط — KV: url)
  → نفق lhr.life (هاتف Samsung، localhost:3000)
  → pm2 casino-server = /root/dmgames-arena/server.js
  → data/royalcoin.db (42 مستخماً حقيقياً منقولة)
```

## ⚠️ تحذيرات التنسيق لمساعد الكات:

1. **لا تنشر فوق الحالة الحالية بدون جلبها أولاً** — نشر v2.12 طمر مؤقتاً v2.10/2.11 لأنه بني من شجرة قديمة. قبل أي نشر: `curl -sL https://dmgames.pages.dev/ | grep -c rdc4` يجب = 9، و `grep -c wheelModal` يجب = 0.
2. **سقطة KV**: هاتفانا يكتبان نفس مفتاح KV (نفق كل هاتف). حالياً Samsung يخدم الإنتاج. إن استلمت أنت KV، خادمك (40248) يحتاج نفس server.js المصلح (الأعلاه) — وإلا سترجع أعراض "لا حسابات / لا شحن" ثانية.
3. **راجع هذا الملف دائماً قبل البدء**: `CURRENT_TASK.md` في شجرة dmgames-arena — القسم 7 يوثق v2.13 كاملاً.
