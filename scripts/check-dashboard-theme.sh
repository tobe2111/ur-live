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

# 🛡️ 2026-07-04 오탐 수정: ① 주석 속 "dark:" 언급(라이트 고정 룰을 적어둔 주석 자체)이 걸리던 것 제외 —
#   실제 코드는 className 문자열 안 `dark:` 만 위반. ② SellerPublicPage 는 대시보드가 아니라 소비자
#   공개 링크샵(/profile/*·/s/* — CLAUDE.md 다크 테마 대상)이라 제외. ③ 파일별 grep 로 실코드 검사.
EXCLUDE_FILES=("src/pages/SellerPublicPage.tsx")

is_excluded() {
  local f="$1"
  for ex in "${EXCLUDE_FILES[@]}"; do
    [ "$f" = "$ex" ] && return 0
  done
  return 1
}

# 실코드 위반 = 주석(//, /*, *) 제거 후 dark: 잔존 라인
has_code_dark() {
  grep -n "dark:" "$1" 2>/dev/null | grep -vE '^\s*[0-9]+:\s*(//|/\*|\*)' | grep -q "dark:"
}

for pattern in "${PATTERNS[@]}"; do
  if [ -d "$pattern" ]; then
    candidates=$(grep -rln "dark:" "$pattern" 2>/dev/null || true)
  else
    candidates=$(ls $pattern 2>/dev/null | xargs grep -ln "dark:" 2>/dev/null || true)
  fi

  matches=""
  for f in $candidates; do
    is_excluded "$f" && continue
    if has_code_dark "$f"; then
      matches="$matches$f\n"
    fi
  done
  matches=$(printf "$matches" | sed '/^$/d')

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
