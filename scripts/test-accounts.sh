#!/bin/bash

# 🧪 계정 로그인 자동 테스트 스크립트
# DB 마이그레이션 후 계정 생성 확인

echo "🔐 계정 로그인 테스트 시작..."
echo "================================"
echo ""

BASE_URL="https://live.ur-team.com"

# 색상 코드
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 테스트 결과 저장
PASS_COUNT=0
FAIL_COUNT=0

# 테스트 함수
test_login() {
  local NAME=$1
  local URL=$2
  local EMAIL=$3
  local PASSWORD=$4
  
  echo "📋 테스트: $NAME"
  echo "   URL: $URL"
  echo "   Email: $EMAIL"
  
  RESPONSE=$(curl -s -X POST "$URL" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
  
  # JSON 파싱 (jq 없이)
  if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "   ${GREEN}✅ 로그인 성공!${NC}"
    echo "   Response: $RESPONSE" | head -c 200
    echo ""
    ((PASS_COUNT++))
    return 0
  else
    echo -e "   ${RED}❌ 로그인 실패${NC}"
    echo "   Response: $RESPONSE"
    echo ""
    ((FAIL_COUNT++))
    return 1
  fi
}

echo "================================"
echo "1️⃣  판매자 계정 테스트"
echo "================================"
test_login \
  "판매자 로그인 (tobe2111)" \
  "$BASE_URL/api/seller/login" \
  "tobe2111@naver.com" \
  "358533aa!!"

echo ""
echo "================================"
echo "2️⃣  관리자 계정 테스트"
echo "================================"
test_login \
  "관리자 로그인 (admin)" \
  "$BASE_URL/api/admin/login" \
  "admin@ur-team.com" \
  "admin123"

echo ""
echo "================================"
echo "📊 테스트 결과 요약"
echo "================================"
echo -e "${GREEN}✅ 성공: $PASS_COUNT${NC}"
echo -e "${RED}❌ 실패: $FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "${GREEN}🎉 모든 테스트 통과!${NC}"
  echo "   DB 마이그레이션이 정상적으로 완료되었습니다."
  exit 0
else
  echo -e "${RED}⚠️  일부 테스트 실패${NC}"
  echo "   DB 마이그레이션을 다시 확인해주세요."
  echo ""
  echo "📝 Cloudflare D1 Console에서 다음 SQL을 실행하세요:"
  echo "   SELECT * FROM sellers WHERE email = 'tobe2111@naver.com';"
  echo "   SELECT * FROM admins WHERE email = 'admin@ur-team.com';"
  exit 1
fi
