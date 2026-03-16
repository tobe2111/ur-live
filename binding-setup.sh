#!/bin/bash

# Cloudflare Pages 바인딩 설정 스크립트
# API를 사용하여 D1 바인딩 추가

echo "🔧 Cloudflare Pages 바인딩 설정 중..."

# Project ID 가져오기
PROJECT_NAME="ur-live"
ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID"
API_TOKEN="$CLOUDFLARE_API_TOKEN"

echo "📦 Project: $PROJECT_NAME"
echo "🏢 Account: $ACCOUNT_ID"

# Cloudflare API를 통한 바인딩 설정은
# 현재 Pages API가 제한적이므로
# wrangler pages deployment create 명령 사용 필요

echo "⚠️  Cloudflare Pages 바인딩은 대시보드에서 설정해야 합니다."
echo ""
echo "대시보드 URL:"
echo "https://dash.cloudflare.com/$ACCOUNT_ID/pages/view/$PROJECT_NAME/settings/functions"
echo ""
echo "또는 'Learn more' 링크에서 wrangler.toml 모드를 해제하세요."

