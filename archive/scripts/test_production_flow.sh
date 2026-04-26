#!/bin/bash

# 🧪 프로덕션 API 테스트 스크립트
# 판매자 대시보드 전체 플로우 테스트

set -e

BASE_URL="http://localhost:3000"
# BASE_URL="https://live.ur-team.com"

echo "🧪 유어 라이브 - 판매자 대시보드 API 테스트"
echo "========================================"
echo ""

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 테스트 결과 추적
PASSED=0
FAILED=0

# 헬퍼 함수
function test_api() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    local headers=$6
    
    echo "📝 테스트: $name"
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" $headers)
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            $headers \
            -d "$data")
    fi
    
    body=$(echo "$response" | head -n -1)
    status=$(echo "$response" | tail -n 1)
    
    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✅ 성공${NC} (HTTP $status)"
        PASSED=$((PASSED + 1))
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}❌ 실패${NC} (예상: $expected_status, 실제: $status)"
        FAILED=$((FAILED + 1))
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    fi
    echo ""
}

echo "1️⃣  판매자 로그인 테스트"
echo "----------------------------------------"

# 판매자 로그인
login_response=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "seller1",
        "password": "seller123",
        "userType": "seller"
    }')

echo "$login_response" | jq '.'

# 세션 토큰 추출
SESSION_TOKEN=$(echo "$login_response" | jq -r '.data.token // empty')

if [ -z "$SESSION_TOKEN" ]; then
    echo -e "${RED}❌ 로그인 실패: 세션 토큰을 가져올 수 없습니다${NC}"
    echo "판매자 계정을 확인해주세요: seller1 / seller123"
    exit 1
fi

echo -e "${GREEN}✅ 로그인 성공${NC}"
echo "세션 토큰: $SESSION_TOKEN"
echo ""

# 헤더 설정
AUTH_HEADER="-H \"X-Session-Token: $SESSION_TOKEN\""

echo "2️⃣  판매자 통계 API 테스트"
echo "----------------------------------------"
test_api "판매자 통계 조회" "GET" "/api/seller/stats" "" "200" "$AUTH_HEADER"

echo "3️⃣  사업자 정보 API 테스트"
echo "----------------------------------------"
test_api "사업자 정보 조회" "GET" "/api/seller/business-info" "" "200" "$AUTH_HEADER"

echo "4️⃣  주문 관리 API 테스트"
echo "----------------------------------------"
test_api "주문 목록 조회" "GET" "/api/seller/orders" "" "200" "$AUTH_HEADER"

echo "5️⃣  상품 관리 API 테스트"
echo "----------------------------------------"
test_api "상품 목록 조회" "GET" "/api/seller/products" "" "200" "$AUTH_HEADER"

echo "6️⃣  세금계산서 API 테스트"
echo "----------------------------------------"
test_api "세금계산서 목록 조회" "GET" "/api/seller/tax-invoices" "" "200" "$AUTH_HEADER"
test_api "자동 발행 로그 조회" "GET" "/api/seller/tax-invoices/auto-issue-logs" "" "200" "$AUTH_HEADER"

echo ""
echo "========================================"
echo "📊 테스트 결과 요약"
echo "========================================"
echo -e "${GREEN}✅ 성공: $PASSED${NC}"
echo -e "${RED}❌ 실패: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 모든 테스트를 통과했습니다!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  일부 테스트가 실패했습니다.${NC}"
    exit 1
fi
