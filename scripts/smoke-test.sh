#!/bin/bash
#
# Smoke Tests for Post-Deployment Verification
# 
# Purpose: Quickly verify critical endpoints are working after deployment
# Usage: bash scripts/smoke-test.sh https://ur-team.com
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${1:-https://ur-team.com}"
TIMEOUT=10
FAILED_TESTS=0
TOTAL_TESTS=0

echo "🔍 Starting smoke tests for: $BASE_URL"
echo "=================================================="

# Function to test endpoint
test_endpoint() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"
  local method="${4:-GET}"
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  echo -n "Testing $name... "
  
  local response_code
  response_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X "$method" \
    -m "$TIMEOUT" \
    --fail-with-body \
    "$BASE_URL$url" 2>/dev/null || echo "000")
  
  if [ "$response_code" -eq "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $response_code)"
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (Expected $expected_status, got $response_code)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    return 1
  fi
}

# Function to test endpoint with JSON response
test_json_endpoint() {
  local name="$1"
  local url="$2"
  local json_key="$3"
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  echo -n "Testing $name... "
  
  local response
  response=$(curl -s -m "$TIMEOUT" "$BASE_URL$url" 2>/dev/null)
  local status=$?
  
  if [ $status -ne 0 ]; then
    echo -e "${RED}✗ FAIL${NC} (Connection failed)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    return 1
  fi
  
  if echo "$response" | grep -q "\"$json_key\""; then
    echo -e "${GREEN}✓ PASS${NC} (Found key: $json_key)"
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (Missing key: $json_key)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    return 1
  fi
}

# Test: Health Check
echo ""
echo "📊 Testing Core Endpoints"
echo "--------------------------------------------------"
test_json_endpoint "Health check" "/health" "status"
test_json_endpoint "Health check (worker version)" "/health" "worker"

# Test: Static Assets
echo ""
echo "📦 Testing Static Assets"
echo "--------------------------------------------------"
test_endpoint "Homepage (index.html)" "/" 200
test_endpoint "Live page" "/live" 200 || true
test_endpoint "Cart page" "/cart" 200 || true

# Test: API Endpoints
echo ""
echo "🔌 Testing API Endpoints"
echo "--------------------------------------------------"
test_endpoint "Products API" "/api/products" 200
test_endpoint "Products API (with ID)" "/api/products/1" 200 || echo -e "${YELLOW}⚠ Warning: Product ID 1 may not exist${NC}"

# Test: Authentication Endpoints
echo ""
echo "🔐 Testing Authentication"
echo "--------------------------------------------------"
test_endpoint "Auth callback (Kakao)" "/auth/kakao/callback" 400 || test_endpoint "Auth callback redirects" "/auth/kakao/callback" 302

# Test: Rate Limiting
echo ""
echo "🚦 Testing Rate Limiting"
echo "--------------------------------------------------"
echo -n "Testing rate limiter (50 requests)... "
RATE_LIMITED=0
for i in {1..50}; do
  response_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -m "$TIMEOUT" \
    "$BASE_URL/api/products" 2>/dev/null || echo "000")
  
  if [ "$response_code" -eq 429 ]; then
    RATE_LIMITED=1
    echo -e "${GREEN}✓ PASS${NC} (Rate limited after $i requests)"
    break
  fi
  
  # Small delay to avoid overwhelming the server
  sleep 0.02
done

if [ $RATE_LIMITED -eq 0 ]; then
  echo -e "${YELLOW}⚠ WARNING${NC} (Rate limiter may not be working, no 429 received)"
fi

# Test: Error Handling
echo ""
echo "🛡️ Testing Error Handling"
echo "--------------------------------------------------"
test_endpoint "404 Not Found" "/nonexistent-page" 404
test_endpoint "API 404" "/api/nonexistent" 404

# Test: Performance
echo ""
echo "⚡ Testing Performance"
echo "--------------------------------------------------"
echo -n "Testing response time... "
START_TIME=$(date +%s%3N)
curl -s -o /dev/null "$BASE_URL/health" 2>/dev/null
END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))

if [ $DURATION -lt 1000 ]; then
  echo -e "${GREEN}✓ PASS${NC} (${DURATION}ms)"
elif [ $DURATION -lt 2000 ]; then
  echo -e "${YELLOW}⚠ ACCEPTABLE${NC} (${DURATION}ms)"
else
  echo -e "${RED}✗ SLOW${NC} (${DURATION}ms)"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test: Worker Bundle
echo ""
echo "🔧 Testing Worker"
echo "--------------------------------------------------"
echo -n "Testing worker health... "
WORKER_RESPONSE=$(curl -s "$BASE_URL/health" 2>/dev/null)
WORKER_VERSION=$(echo "$WORKER_RESPONSE" | grep -o '"worker":"[^"]*"' | cut -d'"' -f4)

if [ -n "$WORKER_VERSION" ]; then
  echo -e "${GREEN}✓ PASS${NC} (Version: $WORKER_VERSION)"
else
  echo -e "${YELLOW}⚠ WARNING${NC} (Worker version not found)"
fi

# Test: Monitoring Integration
echo ""
echo "📡 Testing Monitoring"
echo "--------------------------------------------------"
MONITORING_STATUS=$(echo "$WORKER_RESPONSE" | grep -o '"monitoring":{[^}]*}' || echo "")
if [ -n "$MONITORING_STATUS" ]; then
  echo -e "${GREEN}✓ PASS${NC} Monitoring configured"
  echo "$MONITORING_STATUS" | grep -o '"[^"]*":[^,}]*' | while read -r line; do
    echo "  - $line"
  done
else
  echo -e "${YELLOW}⚠ WARNING${NC} Monitoring status not found"
fi

# Summary
echo ""
echo "=================================================="
echo "📊 Smoke Test Summary"
echo "=================================================="
echo "Total tests: $TOTAL_TESTS"
echo "Passed: $((TOTAL_TESTS - FAILED_TESTS))"
echo "Failed: $FAILED_TESTS"

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}✅ All smoke tests passed!${NC}"
  exit 0
elif [ $FAILED_TESTS -le 2 ]; then
  echo -e "${YELLOW}⚠️ Some tests failed, but deployment may be acceptable${NC}"
  exit 0
else
  echo -e "${RED}❌ Multiple tests failed, consider rollback${NC}"
  exit 1
fi
