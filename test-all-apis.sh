#!/bin/bash
# 백엔드 API 전체 테스트 스크립트
# 사용법: bash test-all-apis.sh

BASE_URL="https://live.ur-team.com"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================="
echo "  백엔드 API 전체 테스트"
echo "  Base URL: $BASE_URL"
echo "=================================="
echo ""

# 테스트 결과 저장
PASS=0
FAIL=0

# 테스트 함수
test_api() {
  local name=$1
  local method=$2
  local endpoint=$3
  local expected_field=$4
  
  echo -n "Testing: $name ... "
  
  if [ "$method" == "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" == "200" ] || [ "$http_code" == "201" ]; then
    if echo "$body" | jq -e "$expected_field" > /dev/null 2>&1; then
      echo -e "${GREEN}✅ PASS${NC} (HTTP $http_code)"
      ((PASS++))
    else
      echo -e "${YELLOW}⚠️  WARN${NC} (HTTP $http_code, field check failed)"
      echo "   Response: $(echo "$body" | jq -c '.' 2>/dev/null || echo "$body")"
      ((FAIL++))
    fi
  else
    echo -e "${RED}❌ FAIL${NC} (HTTP $http_code)"
    echo "   Response: $(echo "$body" | jq -c '.' 2>/dev/null || echo "$body")"
    ((FAIL++))
  fi
}

echo "🔍 1. Health Checks"
echo "-----------------------------------"
test_api "Health Check (Root)" "GET" "/health" ".status"
test_api "Health Check (API)" "GET" "/api/health" ".status"
test_api "Debug Bindings" "GET" "/api/debug/bindings" ".hasDB"
echo ""

echo "📦 2. Products API"
echo "-----------------------------------"
test_api "Products List" "GET" "/api/products" ".success"
test_api "Product Detail (ID: 1)" "GET" "/api/products/1" ".data.id"
test_api "Product Detail (ID: 2)" "GET" "/api/products/2" ".data.id"
test_api "Product Detail (ID: 3)" "GET" "/api/products/3" ".data.id"
echo ""

echo "📺 3. Streams API"
echo "-----------------------------------"
test_api "Streams List" "GET" "/api/streams" ".success"
test_api "Stream Detail (ID: 20)" "GET" "/api/streams/20" ".data"
echo ""

echo "🛍️ 4. Sellers API"
echo "-----------------------------------"
test_api "Sellers List" "GET" "/api/sellers" ".success"
echo ""

echo "🎯 5. Banners API"
echo "-----------------------------------"
test_api "Banners List" "GET" "/api/banners" ".success"
echo ""

echo "🔍 6. Search API"
echo "-----------------------------------"
test_api "Popular Search" "GET" "/api/search/popular" ".success"
echo ""

echo ""
echo "=================================="
echo "  테스트 결과 요약"
echo "=================================="
echo -e "✅ ${GREEN}PASS: $PASS${NC}"
echo -e "❌ ${RED}FAIL: $FAIL${NC}"
echo ""

TOTAL=$((PASS + FAIL))
SUCCESS_RATE=$((PASS * 100 / TOTAL))

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 모든 테스트 통과! (100%)${NC}"
  exit 0
elif [ $SUCCESS_RATE -ge 80 ]; then
  echo -e "${YELLOW}⚠️  일부 테스트 실패 ($SUCCESS_RATE%)${NC}"
  exit 1
else
  echo -e "${RED}❌ 많은 테스트 실패 ($SUCCESS_RATE%)${NC}"
  exit 1
fi
