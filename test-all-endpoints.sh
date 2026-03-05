#!/bin/bash
# 주요 API 엔드포인트 헬스 체크

BASE_URL="https://live.ur-team.com"
FAILED=0
PASSED=0

echo "🏥 시스템 헬스 체크 시작..."
echo "================================"

test_endpoint() {
  local method=$1
  local endpoint=$2
  local expected=$3
  
  if [ "$method" = "GET" ]; then
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${endpoint}")
  fi
  
  if [ "$STATUS" = "$expected" ]; then
    echo "✅ $method $endpoint → $STATUS"
    ((PASSED++))
  else
    echo "❌ $method $endpoint → $STATUS (expected: $expected)"
    ((FAILED++))
  fi
}

# 홈 & 페이지
test_endpoint GET "/" 200
test_endpoint GET "/live/1" 200
test_endpoint GET "/product/1" 200

# Auth API
test_endpoint GET "/api/users/role" 200

# Streams API
test_endpoint GET "/api/streams?status=live" 200
test_endpoint GET "/api/live-streams" 200

# Products API
test_endpoint GET "/api/products?limit=6" 200
test_endpoint GET "/api/products/popular" 200
test_endpoint GET "/api/products/search?q=test" 200

# Health checks
test_endpoint GET "/health" 200

echo "================================"
echo "📊 결과: ✅ $PASSED passed, ❌ $FAILED failed"
exit $FAILED
