#!/bin/bash

echo "🌐 Custom Domain 중복 문제 확인"
echo "======================================"
echo ""

echo "1️⃣ DNS 레코드 확인"
echo "   도메인: live.ur-team.com"
echo ""

DNS_RESULT=$(dig live.ur-team.com CNAME +short 2>/dev/null | head -1)
if [[ -n $DNS_RESULT ]]; then
  echo "   현재 DNS: $DNS_RESULT"
  
  if [[ $DNS_RESULT == *"ur-live.pages.dev"* ]]; then
    echo "   ✅ ur-live 프로젝트를 가리킴 (올바름)"
  elif [[ $DNS_RESULT == *"ur-live-working"* ]]; then
    echo "   ⚠️ ur-live-working을 가리킴 (변경 필요)"
  else
    echo "   ❓ 다른 프로젝트: $DNS_RESULT"
  fi
else
  echo "   ⚠️ DNS 레코드 확인 안 됨"
fi
echo ""

echo "2️⃣ 현재 접속 테스트"
RESPONSE=$(curl -sI https://live.ur-team.com/ 2>&1)
if echo "$RESPONSE" | grep -q "200\|301\|302"; then
  echo "   ✅ 사이트 접속 가능"
  CF_RAY=$(echo "$RESPONSE" | grep -i "cf-ray" | cut -d: -f2 | xargs)
  if [[ -n $CF_RAY ]]; then
    echo "   Cloudflare Ray ID: $CF_RAY"
  fi
else
  echo "   ❌ 사이트 접속 불가"
fi
echo ""

echo "======================================"
echo "📝 확인 필요 사항:"
echo ""
echo "Cloudflare Dashboard에서 확인:"
echo "1. Workers & Pages → ur-live → Custom domains"
echo "   □ live.ur-team.com이 목록에 있는가?"
echo ""
echo "2. Workers & Pages → ur-live-working → Custom domains (있다면)"
echo "   □ live.ur-team.com이 목록에 있는가?"
echo ""
echo "======================================"
echo "🎯 해결 방법:"
echo ""
echo "시나리오 A: ur-live에 도메인이 있으면"
echo "  → ✅ 정상, ur-live-working만 삭제"
echo ""
echo "시나리오 B: ur-live-working에 도메인이 있으면"
echo "  1. ur-live-working에서 도메인 제거"
echo "  2. ur-live에 도메인 추가"
echo "  3. ur-live-working 삭제"
echo ""
echo "📖 상세 가이드: CUSTOM_DOMAIN_CONFLICT.md"
