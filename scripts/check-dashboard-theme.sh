#!/usr/bin/env bash
# 🛡️ 2026-05-03: 대시보드 테마 절대 변경 금지 검증.
#
# 사용자 요구: 셀러/어드민/에이전시 대시보드는 항상 라이트 테마 (#F4F5F7) 고정.
# `dark:` variants 추가 시 다크 모드 토글 (만약 재활성화되면) 영향 받을 수 있음 → 차단.
#
# Pre-commit hook 에서 호출. 위반 시 exit 1.

set -e

VIOLATIONS=0

# 검사 대상 디렉토리/파일 패턴
PATTERNS=(
  "src/pages/Seller*.tsx"
  "src/pages/Admin*.tsx"
  "src/pages/Agency*.tsx"
  "src/components/seller/"
  "src/components/admin/"
  "src/components/agency/"
)

echo "🔍 대시보드 dark: variants 검사 (셀러/어드민/에이전시)"

for pattern in "${PATTERNS[@]}"; do
  if [ -d "$pattern" ]; then
    matches=$(grep -rln "dark:" "$pattern" 2>/dev/null || true)
  else
    matches=$(ls $pattern 2>/dev/null | xargs grep -ln "dark:" 2>/dev/null || true)
  fi

  if [ -n "$matches" ]; then
    echo "❌ dark: variant 발견:"
    echo "$matches" | sed 's/^/   - /'
    VIOLATIONS=$((VIOLATIONS + $(echo "$matches" | wc -l)))
  fi
done

if [ $VIOLATIONS -gt 0 ]; then
  echo ""
  echo "❌ 대시보드 (셀러/어드민/에이전시) 에 dark: variant ${VIOLATIONS}건 발견."
  echo ""
  echo "정책: 대시보드는 항상 화이트 (#F4F5F7) 고정. 다크 모드 토글 영향 절대 받지 않아야 함."
  echo "조치: 해당 파일에서 dark: prefix 제거. 라이트 색상만 사용."
  exit 1
fi

echo "✅ 대시보드 dark: variants 0건 — 정책 준수"
exit 0
