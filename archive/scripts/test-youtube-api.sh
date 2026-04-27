#!/bin/bash
# YouTube API 테스트 스크립트

echo "🧪 Testing YouTube API endpoints..."
echo ""

# Seller token (예시 - 실제 토큰으로 교체 필요)
SELLER_TOKEN="eyJhbGciOiJIUzI1NiIs..."

echo "1️⃣ Testing /api/youtube/auth-url (public endpoint)"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  "https://live.ur-team.com/api/youtube/auth-url" \
  -H "Content-Type: application/json"

echo ""
echo "2️⃣ Testing /api/youtube/channels (requires auth)"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  "https://live.ur-team.com/api/youtube/channels" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SELLER_TOKEN"

echo ""
echo "✅ Test complete"
