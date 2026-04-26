#!/bin/bash

echo "🔍 Cloudflare Pages 프로젝트 확인"
echo "======================================"
echo ""

echo "1️⃣ Git Repository 확인"
GIT_REMOTE=$(git remote get-url origin 2>/dev/null)
if [[ $GIT_REMOTE == *"ur-live"* ]]; then
  echo "   ✅ Git: tobe2111/ur-live (올바름)"
else
  echo "   ❌ Git: $GIT_REMOTE (확인 필요)"
fi
echo ""

echo "2️⃣ 배포된 사이트 확인"
echo "   URL: https://live.ur-team.com/"
echo ""

RESPONSE=$(curl -sI https://live.ur-team.com/ 2>&1)
if echo "$RESPONSE" | grep -q "cf-ray"; then
  CF_RAY=$(echo "$RESPONSE" | grep -i "cf-ray" | cut -d: -f2 | xargs)
  echo "   ✅ Cloudflare 배포 중: $CF_RAY"
else
  echo "   ⚠️ Cloudflare 헤더 확인 안 됨"
fi
echo ""

echo "3️⃣ 최근 커밋"
LAST_COMMIT=$(git log -1 --oneline 2>/dev/null)
echo "   $LAST_COMMIT"
echo ""

echo "======================================"
echo "📝 다음 단계:"
echo ""
echo "Cloudflare Dashboard에서 확인:"
echo "1. https://dash.cloudflare.com/ 로그인"
echo "2. Workers & Pages 메뉴"
echo "3. 프로젝트 2개 확인:"
echo "   - ur-live (기존, 환경변수 설정됨) ✅"
echo "   - ur-live-working (새로 만든 것, 삭제 필요) ❌"
echo ""
echo "4. ur-live-working 삭제:"
echo "   Settings → Delete project"
echo ""
echo "5. ur-live 재배포:"
echo "   Deployments → Retry deployment"
echo "   또는:"
echo "   git commit --allow-empty -m 'chore: Deploy to ur-live'"
echo "   git push origin main"
echo ""
echo "📖 상세 가이드: CLOUDFLARE_PROJECT_SWITCH.md"
