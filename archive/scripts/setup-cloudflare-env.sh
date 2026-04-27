#!/bin/bash

# Cloudflare Pages 환경 변수 설정 헬퍼 스크립트
# 주의: Wrangler Pages는 환경 변수를 CLI로 설정할 수 없습니다.
# 이 스크립트는 안내만 제공합니다.

echo "================================================"
echo "🚨 중요: Cloudflare Pages 환경 변수 설정 필요"
echo "================================================"
echo ""
echo "Cloudflare Pages는 CLI로 환경 변수를 설정할 수 없습니다."
echo "반드시 웹 대시보드를 통해 설정해야 합니다."
echo ""
echo "📋 설정할 환경 변수:"
echo ""
echo "1. VITE_SENTRY_DSN"
echo "   값: https://08caf64e8e7955f09acc2b0551fdb049@o4510992097935360.ingest.us.sentry.io/4510992127295488"
echo ""
echo "2. VITE_SENTRY_ENVIRONMENT"
echo "   값: production"
echo ""
echo "🔗 설정 방법:"
echo "1. https://dash.cloudflare.com 접속"
echo "2. Pages → ur-live → Settings → Environment variables"
echo "3. 'Add variable' 버튼으로 위 2개 변수 추가"
echo "4. Deployments → Retry deployment"
echo ""
echo "📖 자세한 가이드: CLOUDFLARE_ENV_MANUAL_SETUP.md"
echo ""
echo "✅ 완료 확인:"
echo "   https://live.ur-team.com 접속 → F12 → Console"
echo "   '[Sentry] Initialized' 로그 확인"
echo ""
echo "================================================"

# .env.kr 확인
echo ""
echo "🔍 로컬 .env.kr 파일 확인:"
if [ -f .env.kr ]; then
    echo "✅ .env.kr 파일 존재"
    if grep -q "VITE_SENTRY_DSN" .env.kr; then
        echo "✅ VITE_SENTRY_DSN 설정됨"
        grep "VITE_SENTRY_DSN" .env.kr | head -1
    else
        echo "❌ VITE_SENTRY_DSN 없음"
    fi
    
    if grep -q "VITE_SENTRY_ENVIRONMENT" .env.kr; then
        echo "✅ VITE_SENTRY_ENVIRONMENT 설정됨"
        grep "VITE_SENTRY_ENVIRONMENT" .env.kr | head -1
    else
        echo "❌ VITE_SENTRY_ENVIRONMENT 없음"
    fi
else
    echo "❌ .env.kr 파일 없음"
fi

echo ""
echo "================================================"
