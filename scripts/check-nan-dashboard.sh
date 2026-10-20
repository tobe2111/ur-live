#!/usr/bin/env bash
# 🛡️ 2026-05-17: 대시보드 NaN/undefined 노출 방지 검증.
#
# 배경: SellerGroupBuyPage 에서 신규 등록 직후 group_buy_target/current 가 null →
#   (p.price * p.group_buy_current).toLocaleString() = "NaN" 노출.
#   사용자 신고: "₩NaN", "총 NaN원" → 이런 글자가 대시보드에 절대 보이면 안 됨.
#
# 정책:
#   1) (a * b).toLocaleString()   — null * x = NaN → 위험. safeNum() 으로 감싸야 함.
#   2) thing?.toLocaleString()    — undefined?.toLocaleString() = undefined → 화면에 "undefined"
#       formatNumber(thing) 으로 대체.
#   3) value.toLocaleString() (no `?.`) — null/undefined 면 throw → 페이지 crash.
#
# 권장: import { formatNumber, formatWon, safeNum } from '@/utils/format'
#       <p>{formatWon(value)}</p>  or  formatNumber(a * b)
#
# 검사 범위: src/pages/Seller*.tsx, Admin*.tsx, Agency*.tsx, src/components/{seller,admin,agency}/
#
# 기본 warn-only (CI 차단 X). STRICT_NAN_GUARD=1 일 때 exit 1.

set -e

PATTERNS=(
  "src/pages/Seller"
  "src/pages/Admin"
  "src/pages/Agency"
  "src/components/seller/"
  "src/components/admin/"
  "src/components/agency/"
)

echo "🔍 대시보드 NaN-위험 패턴 검사"

VIOLATIONS=0
TOTAL=0

# 검사 1: (a * b).toLocaleString — 명백히 위험 (NaN 노출)
echo ""
echo "▶ (a * b).toLocaleString 패턴 (NaN 발생 가능)"
hits=$(grep -rEn '\([^()]+\*[^()]+\)\.toLocaleString' src/pages src/components 2>/dev/null \
  | grep -E "(Seller|Admin|Agency|seller/|admin/|agency/)" \
  || true)
if [ -n "$hits" ]; then
  echo "$hits" | head -10 | sed 's/^/   ⚠️  /'
  count=$(echo "$hits" | wc -l)
  TOTAL=$((TOTAL + count))
  VIOLATIONS=$((VIOLATIONS + count))
fi

# 검사 2: ?.toLocaleString — undefined 노출 가능 (null fallback 없음)
echo ""
echo "▶ ?.toLocaleString 패턴 (undefined 노출 가능)"
hits=$(grep -rEn '\?\.toLocaleString' src/pages src/components 2>/dev/null \
  | grep -E "(Seller|Admin|Agency|seller/|admin/|agency/)" \
  | grep -v "new Date\|getDate\|toLocaleDate\|toLocaleTime" \
  || true)
if [ -n "$hits" ]; then
  count=$(echo "$hits" | wc -l)
  echo "$hits" | head -10 | sed 's/^/   ⚠️  /'
  [ $count -gt 10 ] && echo "   ... ($((count - 10))건 더)"
  TOTAL=$((TOTAL + count))
fi

echo ""
if [ $TOTAL -eq 0 ]; then
  echo "✅ 대시보드 NaN/undefined 위험 패턴 없음"
  exit 0
fi

echo "⚠️  대시보드에서 NaN/undefined 노출 위험 패턴 ${TOTAL}건"
echo ""
echo "권장 수정:"
echo "  ❌ (a * b).toLocaleString('ko-KR')"
echo "  ✅ formatNumber(safeNum(a) * safeNum(b))"
echo ""
echo "  ❌ value?.toLocaleString()"
echo "  ✅ formatNumber(value)"
echo ""
echo "  import { formatNumber, formatWon, safeNum } from '@/utils/format'"

# 명백히 NaN 발생하는 케이스 (검사 1) 만 차단 — STRICT 일 때
if [ "${STRICT_NAN_GUARD:-0}" = "1" ] && [ $VIOLATIONS -gt 0 ]; then
  echo ""
  echo "❌ STRICT_NAN_GUARD=1 → 빌드 차단 (검사 1: ${VIOLATIONS}건)"
  exit 1
fi

exit 0
