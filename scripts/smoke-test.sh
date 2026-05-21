#!/bin/bash
# 🛡️ 2026-05-21: Production smoke test — 핵심 endpoint 응답 검증.
#
# 사용:
#   ./scripts/smoke-test.sh                       # default prod
#   ./scripts/smoke-test.sh staging               # ur-live.pages.dev
#   ADMIN_TOKEN=xxx ./scripts/smoke-test.sh prod  # admin endpoint 도 검증
#
# 응답 코드:
#   200 ✅ — 정상
#   401/403 ✅ — endpoint 존재, 인증 미통과 (정상)
#   404 ❌ — endpoint 부재 (라우트 미배포)
#   5xx ❌ — 서버 crash
#
# 종료 코드: 실패 1개라도 있으면 1.

set -u
TARGET="${1:-prod}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
if [ "$TARGET" = "prod" ]; then BASE="https://live.ur-team.com"
else BASE="https://ur-live.pages.dev"; fi

PASS=0
FAIL=0

check() {
  local method="$1" path="$2" expected="$3" desc="${4:-}"
  local code
  if [ -n "$ADMIN_TOKEN" ]; then
    code=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE$path" 2>/dev/null || echo "000")
  else
    code=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" "$BASE$path" 2>/dev/null || echo "000")
  fi
  local ok="❌"
  if [[ " $expected " == *" $code "* ]]; then
    ok="✅"
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
  fi
  printf '%s %-6s %-65s expected:%s got:%s  %s\n' "$ok" "$method" "$path" "$expected" "$code" "$desc"
}

echo "=== 유어딜 Production Smoke Test ($TARGET → $BASE) ==="
[ -n "$ADMIN_TOKEN" ] && echo "ADMIN_TOKEN: (set, admin endpoints 200 기대)"
echo ""

echo "--- Public (200 기대) ---"
check GET /api/version "200"
check GET /api/vouchers/categories "200"
check GET /api/group-buy/products "200"
check GET /sitemap.xml "200"

echo ""
echo "--- 인증 필요 (없으면 401/403 기대) ---"
check GET  /api/referral-tree/my-commissions                    "401 403"
check POST /api/referral-tree/withdrawals                       "401 403"
check GET  /api/ledger/my                                       "401 403"
check POST /api/appointments/book                               "401 403"
check GET  /api/seller/products                                 "401 403"

echo ""
echo "--- Admin endpoints (인증 없으면 401/403, 토큰 있으면 200) ---"
check GET  /api/_internal/repair-schema                         "200 401 403"
check GET  /api/referral-tree/admin/withdrawals?status=pending  "200 401 403"
check GET  /api/admin/payouts/pending                           "200 401 403"
check GET  /api/admin/payouts                                   "200 401 403"
check GET  /api/admin/payouts/commission-rates                  "200 401 403"
check GET  /api/admin/tax/annual-report?year=2024               "200 401 403"

echo ""
echo "=== 결과: PASS=$PASS, FAIL=$FAIL ==="
if [ "$FAIL" -gt 0 ]; then
  echo "❌ 일부 endpoint 실패 — production 배포 / 라우트 등록 점검 필요"
  exit 1
fi
echo "✅ 전체 정상"
