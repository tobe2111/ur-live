#!/bin/bash
# 심층 헬스 체크 - 숨겨진 문제 발견

echo "🔍 심층 분석 시작..."
echo ""

# 1. 환경변수 누락 체크
echo "1️⃣ 환경변수 체크"
echo "-------------------"
REQUIRED_VARS=(
  "VITE_FIREBASE_API_KEY"
  "VITE_KAKAO_REST_API_KEY"
  "VITE_TOSS_CLIENT_KEY"
  "VITE_REGION"
)

for var in "${REQUIRED_VARS[@]}"; do
  if grep -q "$var" .env.kr 2>/dev/null; then
    echo "✅ $var found in .env.kr"
  else
    echo "⚠️  $var missing in .env.kr"
  fi
done
echo ""

# 2. 빌드 산출물 체크
echo "2️⃣ 빌드 산출물"
echo "-------------------"
if [ -f "dist/_worker.js" ]; then
  SIZE=$(du -h dist/_worker.js | cut -f1)
  echo "✅ Worker bundle: $SIZE"
else
  echo "❌ Worker bundle missing!"
fi

if [ -f "dist/index.html" ]; then
  echo "✅ index.html exists"
else
  echo "❌ index.html missing!"
fi
echo ""

# 3. 데이터베이스 바인딩 체크
echo "3️⃣ Cloudflare 바인딩"
echo "-------------------"
grep -E "DB|KV|CACHE" wrangler.toml | head -10
echo ""

# 4. API 응답 시간 체크
echo "4️⃣ API 응답 시간"
echo "-------------------"
for endpoint in "/api/streams?status=live" "/api/products?limit=6" "/health"; do
  TIME=$(curl -o /dev/null -s -w "%{time_total}" "https://live.ur-team.com${endpoint}")
  if (( $(echo "$TIME < 1.0" | bc -l) )); then
    echo "✅ $endpoint → ${TIME}s"
  else
    echo "⚠️  $endpoint → ${TIME}s (slow)"
  fi
done
echo ""

# 5. JavaScript 에러 체크 (브라우저 콘솔)
echo "5️⃣ 프론트엔드 이슈"
echo "-------------------"
# React Router 경고 확인
if grep -q "v7_startTransition" src/App.tsx 2>/dev/null; then
  echo "✅ React Router future flags handled"
else
  echo "⚠️  React Router future flags warnings present"
fi
echo ""

# 6. 중복/충돌 파일 체크
echo "6️⃣ 잠재적 충돌"
echo "-------------------"
# AuthContext 사용처 확인
AUTH_CONTEXT_COUNT=$(grep -r "from '@/contexts/AuthContext'" src/ 2>/dev/null | wc -l)
echo "📝 AuthContext imports: $AUTH_CONTEXT_COUNT"
if [ "$AUTH_CONTEXT_COUNT" -gt 0 ]; then
  echo "⚠️  Warning: AuthContext still used in $AUTH_CONTEXT_COUNT files"
  echo "   (Should be migrated to Zustand)"
fi
echo ""

echo "✅ 심층 분석 완료"
