#!/bin/bash

echo "⏳ 배포 완료 대기 중..."
echo "================================"
echo ""
echo "GitHub Actions: https://github.com/tobe2111/ur-live/actions"
echo ""

MAX_ATTEMPTS=30
ATTEMPT=0
WAIT_TIME=20

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  
  echo "[$ATTEMPT/$MAX_ATTEMPTS] API 확인 중..."
  
  response=$(curl -s "https://live.ur-team.com/api/products?limit=1")
  success=$(echo "$response" | jq -r '.success' 2>/dev/null)
  
  if [ "$success" = "true" ]; then
    echo ""
    echo "✅ 배포 완료!"
    echo "================================"
    
    # 전체 API 테스트
    ./check-deploy.sh
    
    echo ""
    echo "🎉 프로덕션 사이트 확인:"
    echo "   - 홈: https://live.ur-team.com"
    echo "   - 로그인: https://live.ur-team.com/login"
    exit 0
  fi
  
  if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
    echo "   ⏳ 아직 배포 중... ${WAIT_TIME}초 후 재시도"
    sleep $WAIT_TIME
  fi
done

echo ""
echo "⚠️  배포 완료 확인 실패"
echo "   GitHub Actions 페이지에서 수동 확인 필요"
echo "   https://github.com/tobe2111/ur-live/actions"
