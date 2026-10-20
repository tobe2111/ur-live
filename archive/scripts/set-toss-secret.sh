#!/bin/bash

# 토스페이먼츠 테스트 시크릿 키
# 공식 문서: https://docs.tosspayments.com/reference/using-api/api-keys

# 결제위젯(Payment Widget) 테스트 시크릿 키
TOSS_SECRET_KEY="test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R"

echo "토스페이먼츠 테스트 시크릿 키를 Cloudflare Pages에 추가합니다..."
echo ""
echo "프로젝트: ur-live"
echo "키: TOSS_SECRET_KEY"
echo "값: $TOSS_SECRET_KEY"
echo ""
echo "다음 명령어를 실행하세요:"
echo ""
echo "echo '$TOSS_SECRET_KEY' | npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live"
