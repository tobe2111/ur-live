#!/bin/bash

echo "🔍 프로덕션 API 상태 확인"
echo "================================"
echo ""

check_api() {
  local endpoint=$1
  local name=$2
  
  echo -n "[$name] "
  response=$(curl -s "$endpoint")
  success=$(echo "$response" | jq -r '.success' 2>/dev/null)
  
  if [ "$success" = "true" ]; then
    echo "✅ 정상"
    return 0
  else
    error=$(echo "$response" | jq -r '.error' 2>/dev/null)
    echo "❌ 실패: $error"
    return 1
  fi
}

# API 체크
check_api "https://live.ur-team.com/api/products?limit=1" "Products API"
check_api "https://live.ur-team.com/api/streams?status=live" "Streams API"

echo ""
echo "배포 상태 확인: https://github.com/tobe2111/ur-live/actions"
