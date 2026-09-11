#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  DMG → Cloudflare Pages  (dmgames.pages.dev)
#  ينشر الملفات الثابتة فقط (html/css/js/assets) — واجهة المنصة تتصل تلقائياً
#  بالـ Worker (casino-api.dmgames-api.workers.dev) عند استضافة dmgames.pages.dev
#
#  المتطلبات:
#    * Node ≥ 18 (يستعمل npx لتحميل wrangler مؤقتاً)
#    * متغيرات البيئة:
#        CLOUDFLARE_ACCOUNT_ID=<Account ID>
#        CLOUDFLARE_API_TOKEN=<API Token>     # يكفي Token من نوع
#                                             # "Cloudflare Pages:Edit" إن وُجد
#    (مفاتيح R2/S3 ليست ضرورية لنشر Pages — هي فقط لحاوية R2 إن استُعملت)
#
#  الاستعمال:
#    export CLOUDFLARE_ACCOUNT_ID=758fcc827f3338772847c28391b6c6c3
#    export CLOUDFLARE_API_TOKEN=cfat_...
#    bash scripts/deploy-pages.sh
#
#  اختياري: DMG_STAGE_ONLY=1 لبناء مجلد النشر فقط بدون رفع.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${DMG_DEPLOY_DIR:-/tmp/dmc-deploy}"
PROJECT="dmgames"                 # يعطي النطاق https://dmgames.pages.dev
BRANCH="main"                     # فرع الإنتاج في Pages (تعديل لإنتاج مباشر)

echo "── تجهيز مجلد النشر من $REPO → $OUT"
rm -rf "$OUT"
mkdir -p "$OUT"
cd "$REPO"

# الملفات والمجلدات العامة فقط (نفس قاعدة deploy-clean.sh المعتمدة)
# ronda-game: محرك روندا الكلاسيكية (index.html يحمل سكربتاته من ronda-game/js/*)
cp -r js css assets ronda-game "$OUT/"

for f in index.html admins.html about.html contact.html 2fa.html \
         provably-fair.html fairness.html privacy.html terms.html \
         api-url2.json _headers _redirects; do
  [ -e "$f" ] && cp "$f" "$OUT/"
done

# أيقونات وصور جذرية إن وُجدت
for g in favicon*.png *.webp favicon.ico manifest.json robots.txt sitemap.xml; do
  for f in $g; do
    [ -e "$f" ] && cp "$f" "$OUT/"
  done
done

# لا اختبارات ولا وثائق ولا قواعد بيانات ولا configs في النشر
rm -rf "$OUT"/data 2>/dev/null || true
rm -rf "$OUT"/ronda-game/tests "$OUT"/ronda-game/README.md 2>/dev/null || true
find "$OUT" -name "*.db*" -delete 2>/dev/null || true

N_FILES="$(find "$OUT" -type f | wc -l)"
SIZE="$(du -sh "$OUT" | cut -f1)"
echo "✔ مجلد النشر جاهز: $N_FILES ملفاً ($SIZE) → $OUT"

if [ "${DMG_STAGE_ONLY:-0}" = "1" ]; then
  echo "── DMG_STAGE_ONLY=1 : تم التوقف قبل الرفع."
  exit 0
fi

: "${CLOUDFLARE_ACCOUNT_ID:?لم يُضبط CLOUDFLARE_ACCOUNT_ID}"
: "${CLOUDFLARE_API_TOKEN:?لم يُضبط CLOUDFLARE_API_TOKEN}"
export CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN

echo "── التأكد من وجود مشروع Pages «$PROJECT»"
if ! npx -y wrangler@4 pages project list 2>/dev/null | grep -q "$PROJECT"; then
  echo "── إنشاء المشروع $PROJECT (فرع الإنتاج: $BRANCH)"
  npx -y wrangler@4 pages project create "$PROJECT" --production-branch "$BRANCH"
fi

echo "── رفع إلى Cloudflare Pages ($PROJECT / $BRANCH)"
npx -y wrangler@4 pages deploy "$OUT" --project-name "$PROJECT" --branch "$BRANCH"

echo "✔ تم النشر → https://$PROJECT.pages.dev"
