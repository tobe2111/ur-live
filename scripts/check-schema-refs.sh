#!/bin/bash
# ============================================================
# DB 스키마 금지 컬럼 참조 검출 스크립트
# 프로덕션 DB에 존재하지 않는 컬럼을 참조하는 코드를 찾아냅니다.
# 사용법: bash scripts/check-schema-refs.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
# production-schema.ts는 SSOT이므로 검사 제외. 또한 docs / migrations / node_modules 등 제외.
SEARCH_PATHS="src/ worker/"
EXCLUDE_GLOBS=(
  "--exclude-dir=node_modules"
  "--exclude-dir=dist"
  "--exclude-dir=.wrangler"
  "--exclude-dir=migrations"
  "--exclude-dir=tests"
  "--exclude=production-schema.ts"
  "--exclude=schema.ts"
  "--exclude=*.test.ts"
  "--exclude=*.test.tsx"
)

# 검색 대상 경로 중 존재하는 것만 사용
EXISTING_PATHS=""
for p in $SEARCH_PATHS; do
  if [ -d "$p" ]; then
    EXISTING_PATHS="$EXISTING_PATHS $p"
  fi
done

if [ -z "$EXISTING_PATHS" ]; then
  echo "No source directories to scan"
  exit 0
fi

# check_col <pattern> <human description> <should_flag_as_error=1|warn=0>
check_col() {
  local pattern="$1"
  local desc="$2"
  local level="${3:-error}"

  # SQL 컬럼 참조만 검출하기 위해 문자열 리터럴 내부 또는 . 접근자 주변에서 매칭
  # 주석 라인(//, *) 및 legacy fallback 코멘트(Best-effort, legacy, deprecated)는 제외
  local matches
  matches=$(grep -rnE "$pattern" $EXISTING_PATHS "${EXCLUDE_GLOBS[@]}" --include="*.ts" --include="*.tsx" --include="*.sql" 2>/dev/null | \
    grep -vE "^[^:]+:[0-9]+:\s*(//|\*|/\*)" | \
    grep -viE "Best-effort|legacy|deprecated|may not exist|doesn't exist|존재하지 않음|호환.*fallback|seller\.slug \|\| " || true)

  if [ -n "$matches" ]; then
    if [ "$level" = "error" ]; then
      echo -e "   ${RED}❌ $desc${NC}"
      ERRORS=$((ERRORS + 1))
    else
      echo -e "   ${YELLOW}⚠️  $desc${NC}"
    fi
    echo "$matches" | head -5 | sed 's/^/      /'
    if [ "$(echo "$matches" | wc -l)" -gt 5 ]; then
      echo "      ... ($(echo "$matches" | wc -l) 건 중 5건 표시)"
    fi
  fi
}

echo "🔍 DB 스키마 금지 컬럼 참조 검사"
echo "================================="

echo ""
echo "📋 sellers 테이블"
check_col "\bsellers?\.(user_id|firebase_uid)\b|'(user_id|firebase_uid)'\s*:" "sellers.user_id / firebase_uid — 존재하지 않음 (id 사용)" error
check_col "\bsellers?\.slug\b|sellers\s*\([^)]*\bslug\b" "sellers.slug — 존재하지 않음 (username 사용)" error
check_col "\bsellers?\.logo_url\b" "sellers.logo_url — 존재하지 않음 (profile_image 사용)" error
check_col "\bsellers?\.description\b" "sellers.description — 존재하지 않음 (bio 사용)" error

echo ""
echo "📋 users 테이블"
check_col "\busers?\.deal_balance\b|users\s*\([^)]*deal_balance" "users.deal_balance — 존재하지 않음 (user_points 테이블 사용)" error
check_col "\busers?\.avatar_url\b" "users.avatar_url — 존재하지 않음" error
check_col "\busers?\.display_name\b" "users.display_name — 존재하지 않음 (name 사용)" error
check_col "\busers?\.referred_by\b|\busers?\.affiliate_ref\b" "users.referred_by / affiliate_ref — 존재하지 않음" error

echo ""
echo "📋 products 테이블"
check_col "\bproducts?\.category_id\b" "products.category_id — 존재하지 않음 (category TEXT 사용)" error

echo ""
echo "📋 orders 테이블"
check_col "\borders?\.total_price\b" "orders.total_price — 존재하지 않음 (total_amount 사용)" error
check_col "\borders?\.webhook_processed_at\b|\borders?\.webhook_event_id\b" "orders.webhook_processed_at / webhook_event_id — 존재하지 않음" error
check_col "\borders?\.cancel_fail_reason\b" "orders.cancel_fail_reason — 존재하지 않음 (cancel_reason 사용)" error

echo ""
echo "📋 order_items 테이블"
check_col "\border_items?\.price_snapshot\b" "order_items.price_snapshot — 존재하지 않음 (price 사용)" error
# NOTE: product_thumbnail, product_sku는 migration 0118에서 추가되어 사용 가능 (검사 제외)

echo ""
echo "📋 live_streams 테이블"
check_col "\blive_streams?\.viewer_count\b" "live_streams.viewer_count — 존재하지 않음 (current_viewers 사용)" error

echo ""
echo "📋 donations 테이블"
# donations.status는 금지, payment_status 사용
check_col "\bdonations?\.status\b" "donations.status — 존재하지 않음 (payment_status 사용)" error

# NOTE: payment_status = 'approved'는 CHECK 제약에 포함되어 있으므로 사용 가능 (검사 제외)

echo ""
echo "================================="
if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}❌ ${ERRORS}개 스키마 참조 오류 발견${NC}"
  echo ""
  echo "가이드:"
  echo "  - src/shared/db/production-schema.ts 참조"
  echo "  - CLAUDE.md의 'DB 스키마 규칙' 섹션 참조"
  exit 1
else
  echo -e "${GREEN}✅ 스키마 참조 문제 없음${NC}"
  exit 0
fi
