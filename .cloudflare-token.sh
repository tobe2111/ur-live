#!/bin/bash
# Cloudflare API Token 설정 스크립트
# 사용법: source .cloudflare-token.sh

echo "🔐 Cloudflare API 토큰을 입력해주세요:"
read -s CLOUDFLARE_API_TOKEN
export CLOUDFLARE_API_TOKEN

echo ""
echo "✅ CLOUDFLARE_API_TOKEN이 설정되었습니다!"
echo "📝 토큰 길이: ${#CLOUDFLARE_API_TOKEN} 글자"
echo ""
echo "이제 다음 명령어로 배포할 수 있습니다:"
echo "  npm run deploy:global"
