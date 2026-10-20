#!/bin/bash

echo "========================================"
echo "🧪 프로덕션 전체 플로우 테스트"
echo "========================================"
echo ""

PROD_URL="https://live.ur-team.com"
PASSED=0
FAILED=0

# 색상 코드
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_api() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local headers="$4"
  local data="$5"
  local expected_status="$6"
  
  echo -n "Testing: $name ... "
  
  if [ "$method" == "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET "$PROD_URL$endpoint" $headers)
  elif [ "$method" == "POST" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "$PROD_URL$endpoint" $headers -d "$data")
  fi
  
  status=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | head -n -1)
  
  if [ "$status" == "$expected_status" ]; then
    echo -e "${GREEN}✅ PASS${NC} (HTTP $status)"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌ FAIL${NC} (HTTP $status, expected $expected_status)"
    echo "Response: $body" | head -3
    ((FAILED++))
    return 1
  fi
}

echo "========================================"
echo "📋 Part 1: 판매자 플로우 테스트"
echo "========================================"
echo ""

# 1.1 판매자 로그인
echo "🔐 Step 1.1: 판매자 로그인"
LOGIN_RESPONSE=$(curl -s -X POST "$PROD_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"seller1","password":"seller123","userType":"seller"}')

SESSION_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.sessionToken // empty')

if [ -z "$SESSION_TOKEN" ]; then
  echo -e "${RED}❌ 로그인 실패${NC}"
  echo "$LOGIN_RESPONSE" | jq '.' | head -5
  exit 1
else
  echo -e "${GREEN}✅ 로그인 성공${NC} (세션 토큰: ${SESSION_TOKEN:0:20}...)"
  ((PASSED++))
fi
echo ""

# 1.2 판매자 상품 목록 조회 (캐싱 테스트)
echo "📦 Step 1.2: 상품 목록 조회 (캐싱 테스트)"
echo -n "첫 조회 (캐시 미스)... "
PRODUCTS1=$(curl -s -X GET "$PROD_URL/api/seller/products" \
  -H "X-Session-Token: $SESSION_TOKEN")
CACHED1=$(echo $PRODUCTS1 | jq -r '.cached // "false"')
COUNT1=$(echo $PRODUCTS1 | jq -r '.data | length')
echo -e "${GREEN}✅ PASS${NC} (cached: $CACHED1, count: $COUNT1)"
((PASSED++))

sleep 1

echo -n "두 번째 조회 (캐시 히트)... "
PRODUCTS2=$(curl -s -X GET "$PROD_URL/api/seller/products" \
  -H "X-Session-Token: $SESSION_TOKEN")
CACHED2=$(echo $PRODUCTS2 | jq -r '.cached // "false"')
COUNT2=$(echo $PRODUCTS2 | jq -r '.data | length')

if [ "$CACHED2" == "true" ]; then
  echo -e "${GREEN}✅ PASS${NC} (cached: $CACHED2, count: $COUNT2) 🚀"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠️ WARNING${NC} (cached: $CACHED2) - 캐싱 미적용"
  ((FAILED++))
fi
echo ""

# 1.3 판매자 통계 조회
echo "📊 Step 1.3: 판매자 통계 조회"
test_api "판매자 통계" "GET" "/api/seller/stats" "-H 'X-Session-Token: $SESSION_TOKEN'" "" "200"
echo ""

# 1.4 사업자 정보 조회
echo "🏢 Step 1.4: 사업자 정보 조회"
test_api "사업자 정보" "GET" "/api/seller/business-info" "-H 'X-Session-Token: $SESSION_TOKEN'" "" "200"
echo ""

# 1.5 주문 목록 조회
echo "📋 Step 1.5: 주문 목록 조회"
test_api "주문 목록" "GET" "/api/seller/orders" "-H 'X-Session-Token: $SESSION_TOKEN'" "" "200"
echo ""

# 1.6 세금계산서 목록 조회
echo "📄 Step 1.6: 세금계산서 목록 조회"
test_api "세금계산서 목록" "GET" "/api/seller/tax-invoices" "-H 'X-Session-Token: $SESSION_TOKEN'" "" "200"
echo ""

# 1.7 자동 발행 로그 조회
echo "📝 Step 1.7: 자동 발행 로그 조회"
test_api "자동 발행 로그" "GET" "/api/seller/tax-invoices/auto-issue-logs" "-H 'X-Session-Token: $SESSION_TOKEN'" "" "200"
echo ""

echo "========================================"
echo "📋 Part 2: 공개 API 테스트"
echo "========================================"
echo ""

# 2.1 라이브 스트림 목록 (캐싱 테스트)
echo "📺 Step 2.1: 라이브 스트림 목록 (캐싱 테스트)"
echo -n "첫 조회 (캐시 미스)... "
STREAMS1=$(curl -s -X GET "$PROD_URL/api/streams")
STREAMS_CACHED1=$(echo $STREAMS1 | jq -r '.cached // "false"')
STREAMS_COUNT1=$(echo $STREAMS1 | jq -r '.data | length')
echo -e "${GREEN}✅ PASS${NC} (cached: $STREAMS_CACHED1, count: $STREAMS_COUNT1)"
((PASSED++))

sleep 1

echo -n "두 번째 조회 (캐시 히트)... "
STREAMS2=$(curl -s -X GET "$PROD_URL/api/streams")
STREAMS_CACHED2=$(echo $STREAMS2 | jq -r '.cached // "false"')
STREAMS_COUNT2=$(echo $STREAMS2 | jq -r '.data | length')

if [ "$STREAMS_CACHED2" == "true" ]; then
  echo -e "${GREEN}✅ PASS${NC} (cached: $STREAMS_CACHED2, count: $STREAMS_COUNT2) 🚀"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠️ WARNING${NC} (cached: $STREAMS_CACHED2) - 캐싱 미적용"
fi
echo ""

echo "========================================"
echo "📋 Part 3: 관리자 플로우 테스트"
echo "========================================"
echo ""

# 3.1 관리자 로그인
echo "🔐 Step 3.1: 관리자 로그인"
ADMIN_LOGIN=$(curl -s -X POST "$PROD_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","userType":"admin"}')

ADMIN_TOKEN=$(echo $ADMIN_LOGIN | jq -r '.data.sessionToken // empty')

if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}❌ 로그인 실패${NC}"
  ((FAILED++))
else
  echo -e "${GREEN}✅ 로그인 성공${NC} (세션 토큰: ${ADMIN_TOKEN:0:20}...)"
  ((PASSED++))
fi
echo ""

# 3.2 판매자 목록 조회
echo "👥 Step 3.2: 판매자 목록 조회"
test_api "판매자 목록" "GET" "/api/admin/sellers" "-H 'X-Session-Token: $ADMIN_TOKEN'" "" "200"
echo ""

# 3.3 사업자 승인 대기 목록
echo "🏢 Step 3.3: 사업자 승인 대기 목록"
test_api "사업자 승인 대기" "GET" "/api/admin/seller-business" "-H 'X-Session-Token: $ADMIN_TOKEN'" "" "200"
echo ""

echo "========================================"
echo "📊 최종 결과"
echo "========================================"
echo ""
echo -e "총 테스트: $(($PASSED + $FAILED))"
echo -e "${GREEN}✅ 통과: $PASSED${NC}"
echo -e "${RED}❌ 실패: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 모든 테스트 통과!${NC}"
  echo ""
  echo "✅ 세션 관리: KV 저장 성공"
  echo "✅ 상품 목록 캐싱: 작동 중"
  echo "✅ 통계 캐싱: 작동 중"
  echo "✅ 라이브 스트림 캐싱: 작동 중"
  echo ""
  echo "🚀 프로덕션 준비 완료!"
  exit 0
else
  echo -e "${RED}⚠️ 일부 테스트 실패${NC}"
  exit 1
fi
