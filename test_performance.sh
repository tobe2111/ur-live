#!/bin/bash

echo "========================================="
echo "🚀 성능 테스트 시작"
echo "========================================="
echo ""

PROD_URL="https://live.ur-team.com"

echo "✅ Step 1: 판매자 로그인 (세션 KV 저장)"
LOGIN_RESPONSE=$(curl -s -X POST "$PROD_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"seller1","password":"seller123","userType":"seller"}')

SESSION_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.sessionToken')

if [ "$SESSION_TOKEN" == "null" ] || [ -z "$SESSION_TOKEN" ]; then
  echo "❌ 로그인 실패"
  echo "$LOGIN_RESPONSE" | jq '.'
  exit 1
fi

echo "✅ 세션 토큰: ${SESSION_TOKEN:0:20}..."
echo ""

echo "========================================="
echo "📊 Step 2: 상품 목록 조회 (캐싱 테스트)"
echo "========================================="

echo "🔵 첫 번째 조회 (캐시 미스 - D1에서 조회)"
TIME1_START=$(date +%s%N)
RESPONSE1=$(curl -s -X GET "$PROD_URL/api/seller/products" \
  -H "X-Session-Token: $SESSION_TOKEN")
TIME1_END=$(date +%s%N)
TIME1=$((($TIME1_END - $TIME1_START) / 1000000))

CACHED1=$(echo $RESPONSE1 | jq -r '.cached // "false"')
COUNT1=$(echo $RESPONSE1 | jq -r '.data | length')

echo "   응답 시간: ${TIME1}ms"
echo "   캐시 여부: $CACHED1"
echo "   상품 수: $COUNT1"
echo ""

sleep 1

echo "🟢 두 번째 조회 (캐시 히트 - KV에서 조회)"
TIME2_START=$(date +%s%N)
RESPONSE2=$(curl -s -X GET "$PROD_URL/api/seller/products" \
  -H "X-Session-Token: $SESSION_TOKEN")
TIME2_END=$(date +%s%N)
TIME2=$((($TIME2_END - $TIME2_START) / 1000000))

CACHED2=$(echo $RESPONSE2 | jq -r '.cached // "false"')
COUNT2=$(echo $RESPONSE2 | jq -r '.data | length')

echo "   응답 시간: ${TIME2}ms"
echo "   캐시 여부: $CACHED2"
echo "   상품 수: $COUNT2"
echo ""

if [ "$CACHED2" == "true" ]; then
  IMPROVEMENT=$(echo "scale=2; ($TIME1 - $TIME2) / $TIME1 * 100" | bc)
  echo "✅ 캐싱 성공! 응답 시간 ${IMPROVEMENT}% 개선"
else
  echo "⚠️ 캐싱 미적용 (예상: cached=true, 실제: $CACHED2)"
fi

echo ""
echo "========================================="
echo "📊 Step 3: 판매자 통계 조회 (캐싱 테스트)"
echo "========================================="

echo "🔵 첫 번째 조회 (캐시 미스)"
TIME3_START=$(date +%s%N)
RESPONSE3=$(curl -s -X GET "$PROD_URL/api/seller/stats" \
  -H "X-Session-Token: $SESSION_TOKEN")
TIME3_END=$(date +%s%N)
TIME3=$((($TIME3_END - $TIME3_START) / 1000000))

CACHED3=$(echo $RESPONSE3 | jq -r '.cached // "false"')
REVENUE=$(echo $RESPONSE3 | jq -r '.data.totalRevenue // 0')

echo "   응답 시간: ${TIME3}ms"
echo "   캐시 여부: $CACHED3"
echo "   총 매출: ${REVENUE}원"
echo ""

sleep 1

echo "🟢 두 번째 조회 (캐시 히트)"
TIME4_START=$(date +%s%N)
RESPONSE4=$(curl -s -X GET "$PROD_URL/api/seller/stats" \
  -H "X-Session-Token: $SESSION_TOKEN")
TIME4_END=$(date +%s%N)
TIME4=$((($TIME4_END - $TIME4_START) / 1000000))

CACHED4=$(echo $RESPONSE4 | jq -r '.cached // "false"')
REVENUE2=$(echo $RESPONSE4 | jq -r '.data.totalRevenue // 0')

echo "   응답 시간: ${TIME4}ms"
echo "   캐시 여부: $CACHED4"
echo "   총 매출: ${REVENUE2}원"
echo ""

if [ "$CACHED4" == "true" ]; then
  IMPROVEMENT2=$(echo "scale=2; ($TIME3 - $TIME4) / $TIME3 * 100" | bc)
  echo "✅ 캐싱 성공! 응답 시간 ${IMPROVEMENT2}% 개선"
else
  echo "⚠️ 캐싱 미적용 (예상: cached=true, 실제: $CACHED4)"
fi

echo ""
echo "========================================="
echo "📝 최종 결과 요약"
echo "========================================="
echo "✅ 세션 관리: KV 저장 성공"
echo "✅ 상품 목록 캐싱: $CACHED2"
echo "✅ 통계 캐싱: $CACHED4"
echo ""
echo "📊 성능 개선:"
if [ "$CACHED2" == "true" ]; then
  echo "   - 상품 목록: ${TIME1}ms → ${TIME2}ms (${IMPROVEMENT}% 개선)"
fi
if [ "$CACHED4" == "true" ]; then
  echo "   - 판매자 통계: ${TIME3}ms → ${TIME4}ms (${IMPROVEMENT2}% 개선)"
fi
echo ""
echo "🎉 성능 테스트 완료!"
echo "========================================="
