#!/bin/bash
# check-guide-sync.sh — 코드 변경 시 운영 가이드(guide-seed.ts) 업데이트 강제
#
# 어드민/셀러/에이전시 가이드는 src/features/guides/api/guide-seed.ts 에 시드됨.
# 다음 파일들이 변경되면 guide-seed.ts 도 함께 변경되어야 한다:
#  - src/pages/Seller*.tsx               → 셀러 가이드 영향
#  - src/pages/Admin*.tsx                → 어드민 가이드 영향
#  - src/pages/Agency*.tsx               → 에이전시 가이드 영향
#  - src/features/seller/api/*.ts        → 셀러 가이드 (API endpoint 추가/변경)
#  - src/features/youtube/api/*.ts       → 셀러 가이드 (라이브 방송 관련)
#  - src/features/donations/api/*.ts     → 셀러/어드민 가이드 (정산/후원)
#  - src/features/agency/api/*.ts        → 에이전시 가이드
#  - src/features/auth/api/*.ts          → 모든 가이드 (로그인 변경)
#  - src/worker/routes/*.ts              → 라우트 변경 → 가이드 영향
#
# 단, 변경이 너무 사소(린트/포맷/주석)할 수 있으므로 BLOCK 대신 WARN.
# 환경변수 STRICT_GUIDE_SYNC=1 이면 BLOCK.
#
# 사용:
#   bash scripts/check-guide-sync.sh           # warn-only (기본)
#   STRICT_GUIDE_SYNC=1 bash scripts/check-guide-sync.sh  # block

set -e

GUIDE_FILE="src/features/guides/api/guide-seed.ts"

# Get staged changes (or HEAD diff if not in pre-commit context)
if git diff --cached --quiet 2>/dev/null; then
  # Nothing staged — fall back to last commit
  staged=$(git diff --name-only HEAD~1..HEAD 2>/dev/null || true)
else
  staged=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true)
fi

if [ -z "$staged" ]; then
  exit 0
fi

# Patterns that should trigger guide sync
guide_relevant=$(echo "$staged" | grep -E '^(src/pages/(Seller|Admin|Agency)|src/features/(seller|youtube|donations|agency|auth)/api/|src/worker/routes/)' || true)

if [ -z "$guide_relevant" ]; then
  exit 0
fi

# Check if guide-seed.ts is in the staged changes
guide_changed=$(echo "$staged" | grep "^${GUIDE_FILE}$" || true)

if [ -n "$guide_changed" ]; then
  echo "✅ 가이드 동기화 OK (${GUIDE_FILE} 함께 변경됨)"
  exit 0
fi

# Build affected guide buckets
buckets=""
echo "$guide_relevant" | grep -qE '^src/pages/Seller|src/features/(seller|youtube)/api/' && buckets="$buckets seller"
echo "$guide_relevant" | grep -qE '^src/pages/Admin|src/worker/routes/' && buckets="$buckets admin"
echo "$guide_relevant" | grep -qE '^src/pages/Agency|src/features/agency/api/' && buckets="$buckets agency"
echo "$guide_relevant" | grep -qE '^src/features/auth/api/' && buckets="$buckets seller admin agency"
buckets=$(echo "$buckets" | tr ' ' '\n' | sort -u | tr '\n' ' ')

echo ""
echo "⚠️  가이드 업데이트 누락 의심"
echo "================================="
echo "변경된 파일들이 운영 가이드에 영향을 줄 수 있습니다:"
echo ""
echo "$guide_relevant" | sed 's/^/  - /'
echo ""
echo "영향받는 가이드:"
for b in $buckets; do
  echo "  📘 $b 가이드 (${GUIDE_FILE} 의 '${b^^}_SEED' 섹션)"
done
echo ""
echo "다음 중 하나로 처리하세요:"
echo "  1. ${GUIDE_FILE} 의 해당 섹션 업데이트 후 다시 커밋"
echo "  2. 사소한 변경(린트/리팩토링 등)이라 가이드 영향 없으면 그대로 진행"
echo "  3. 별도 PR로 가이드 업데이트 예정이면 커밋 메시지에 'guide-update-pending' 추가"
echo ""

if [ "$STRICT_GUIDE_SYNC" = "1" ]; then
  echo "❌ STRICT_GUIDE_SYNC=1 — 커밋 차단"
  exit 1
fi

# Warn-only mode (default): allow commit but flag prominently
echo "💡 경고만 표시함 (커밋 진행). STRICT_GUIDE_SYNC=1 로 차단 모드 활성화 가능."
exit 0
