#!/bin/bash
# 🛡️ 2026-04-28: 신규 비즈니스 기능 + 분할 라우트 smoke test
#
# 사용: bash scripts/smoke-test-business.sh [staging|prod]
#
# 각 endpoint 가 살아 있는지 (404 가 아닌지) 만 검증. 인증 endpoint 는 401 expected.

set -e
TARGET="${1:-staging}"
BASE=""
if [ "$TARGET" = "prod" ]; then BASE="https://live.ur-team.com"; else BASE="https://ur-live.pages.dev"; fi
echo "==> Business smoke test: $BASE"

PASS=0
FAIL=0

check() {
  local path="$1"
  local expected="$2"  # 기대 status code (또는 'alive' = 404 만 아니면 OK)
  local desc="$3"

  local status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path" 2>/dev/null || echo "FAIL")

  if [ "$expected" = "alive" ]; then
    if [ "$status" = "404" ] || [ "$status" = "FAIL" ]; then
      echo "  ❌ $path → $status ($desc)"
      FAIL=$((FAIL+1))
    else
      echo "  ✅ $path → $status ($desc)"
      PASS=$((PASS+1))
    fi
  else
    if [ "$status" = "$expected" ]; then
      echo "  ✅ $path → $status ($desc)"
      PASS=$((PASS+1))
    else
      echo "  ❌ $path → $status (expected $expected, $desc)"
      FAIL=$((FAIL+1))
    fi
  fi
}

echo ""
echo "── Public endpoints ──"
check "/api/group-buy/products?status=active" "200" "group-buy 목록 (3종 카테고리 통합)"
check "/api/group-buy/products?category=meal_voucher" "200" "식사 공구권"
check "/api/group-buy/products?category=beauty_voucher" "200" "뷰티 공구권"
check "/api/group-buy/products?category=health_voucher" "200" "헬스 공구권"

echo ""
echo "── Auth-required endpoints (401 expected) ──"
check "/api/seller/consignment" "alive" "MD 위탁 목록 (auth)"
check "/api/seller/consignment/settlements" "alive" "위탁 정산 (auth)"
check "/api/gifts/sent" "alive" "선물 보낸 목록 (auth)"
check "/api/admin/business-monitoring/gift-stats" "alive" "gift 모니터링 (admin)"
check "/api/admin/business-monitoring/consignment-stats" "alive" "consignment 모니터링 (admin)"

echo ""
echo "── Public claim (404 if invalid) ──"
check "/api/gifts/claim/short-token" "alive" "claim API 살아있음 (token 형식만)"

echo ""
echo "── 분할된 라우트 (각 sub-router 마운트 검증) ──"
check "/api/seller/profile" "alive" "seller-profile router"
check "/api/seller/business-info" "alive" "seller-profile router (business-info)"
check "/api/seller/personal-info" "alive" "seller-account router"
check "/api/seller/settlements" "alive" "seller-settlements router"
check "/api/seller/dashboard/stats" "alive" "seller-settlements router (dashboard)"
check "/api/seller/alimtalk" "alive" "seller-alimtalk-mgmt router"
check "/api/seller/kakao-link-status" "alive" "seller-kakao-link router"
check "/api/seller/my-seller-status" "alive" "seller-registration router"

check "/api/agency/profile" "alive" "agency router"
check "/api/agency/stats" "alive" "agency-stats router"
check "/api/agency/settlements" "alive" "agency-settlements router"
check "/api/agency/notices" "alive" "agency-ops router"
check "/api/agency/sellers" "alive" "agency-sellers router"
check "/api/agency/kakao-link-status" "alive" "agency-kakao-link router"

echo ""
echo "── Result ──"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
if [ $FAIL -gt 0 ]; then exit 1; fi
echo "  ✅ All passed"
