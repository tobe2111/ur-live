#!/bin/bash

echo "🔍 Worker 환경변수만 체크 (VITE_ 제외)"
echo "======================================"
echo ""

echo "❌ 누락된 Worker 환경변수 (Cloudflare Dashboard 확인 필요):"
echo ""
echo "1. FIREBASE_PROJECT_ID"
echo "2. FIREBASE_PRIVATE_KEY"
echo "3. FIREBASE_CLIENT_EMAIL"
echo "4. FIREBASE_DATABASE_URL"
echo "5. KAKAO_REST_API_KEY"
echo ""

echo "💡 VITE_ 환경변수는 이미 설정되어 있음 (확인됨)"
echo ""

echo "🧪 테스트: Worker API 호출해서 환경변수 확인"
echo ""

# Test if worker env vars are set
echo "Testing /api/auth/kakao/callback..."
RESPONSE=$(curl -s "https://live.ur-team.com/api/auth/kakao/callback?code=test&state=test" 2>&1)

if echo "$RESPONSE" | grep -q "FIREBASE_PROJECT_ID"; then
  echo "❌ FIREBASE_PROJECT_ID: 누락됨"
elif echo "$RESPONSE" | grep -q "FIREBASE_PRIVATE_KEY"; then
  echo "❌ FIREBASE_PRIVATE_KEY: 누락됨"
elif echo "$RESPONSE" | grep -q "FIREBASE_CLIENT_EMAIL"; then
  echo "❌ FIREBASE_CLIENT_EMAIL: 누락됨"
elif echo "$RESPONSE" | grep -q "Failed to create Firebase custom token"; then
  echo "❌ Worker 환경변수 누락 확인됨"
  echo "   에러: Failed to create Firebase custom token"
else
  echo "✅ Worker 환경변수가 설정되어 있을 가능성 있음"
  echo "   (또는 다른 에러)"
fi

echo ""
echo "======================================"
echo "📝 다음 단계:"
echo ""
echo "Cloudflare Dashboard에서 확인:"
echo "1. https://dash.cloudflare.com/"
echo "2. Workers & Pages → ur-live → Settings"
echo "3. Environment variables 탭"
echo "4. 다음 변수들이 있는지 확인:"
echo "   - FIREBASE_PROJECT_ID"
echo "   - FIREBASE_PRIVATE_KEY"
echo "   - FIREBASE_CLIENT_EMAIL"  
echo "   - FIREBASE_DATABASE_URL"
echo "   - KAKAO_REST_API_KEY"
echo ""
echo "없으면: CLOUDFLARE_WORKER_ENV_SETUP.md 참고"
