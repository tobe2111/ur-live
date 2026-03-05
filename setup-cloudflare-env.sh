#!/bin/bash

# Cloudflare Pages 환경 변수 자동 설정 스크립트
# 용도: ur-live-kr 프로젝트에 필요한 모든 환경 변수를 Cloudflare Pages에 설정

set -e

PROJECT_NAME="${1:-ur-live-kr}"
echo "🚀 Cloudflare Pages 환경 변수 설정 시작"
echo "📦 프로젝트: $PROJECT_NAME"
echo ""

# 환경 변수 목록 (키=값 형태)
declare -A ENV_VARS=(
    # Firebase (8개)
    ["VITE_FIREBASE_API_KEY"]="AIzaSyCxmgG3NEXsWtHKbE425dvq5EWs3WHXOh8"
    ["VITE_FIREBASE_AUTH_DOMAIN"]="urteam-live-commerce-5b284.firebaseapp.com"
    ["VITE_FIREBASE_PROJECT_ID"]="urteam-live-commerce-5b284"
    ["VITE_FIREBASE_STORAGE_BUCKET"]="urteam-live-commerce-5b284.firebasestorage.app"
    ["VITE_FIREBASE_MESSAGING_SENDER_ID"]="352937066044"
    ["VITE_FIREBASE_APP_ID"]="1:352937066044:web:e5bfd5e1d8f61688e30d39"
    ["VITE_FIREBASE_MEASUREMENT_ID"]="G-TEST123456"
    ["VITE_FIREBASE_DATABASE_URL"]="https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app"
    
    # Kakao (3개)
    ["VITE_KAKAO_REST_API_KEY"]="5dd74bccb797640b0efd070467f3bafd"
    ["VITE_KAKAO_JAVASCRIPT_KEY"]="975a2e7f97254b08f15dba4d177a2865"
    ["VITE_KAKAO_AUTH_URL"]="https://kauth.kakao.com"
    
    # Toss Payments (1개)
    ["VITE_TOSS_CLIENT_KEY"]="test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN"
    
    # Other (3개)
    ["VITE_REGION"]="KR"
    ["VITE_DEFAULT_LANGUAGE"]="ko"
    ["VITE_API_BASE_URL"]="https://live.ur-team.com"
    
    # Backend Secrets (5개) - Cloudflare Workers용
    ["KAKAO_REST_API_KEY"]="5dd74bccb797640b0efd070467f3bafd"
    ["JWT_SECRET"]="CHANGE_ME_TO_RANDOM_STRING"
    ["EMAIL_FROM"]="UR Live <noreply@ur-team.com>"
    ["RESEND_API_KEY"]="CHANGE_ME"
    ["TOSS_SECRET_KEY"]="CHANGE_ME"
)

echo "📊 총 ${#ENV_VARS[@]}개의 환경 변수를 설정합니다."
echo ""

# Wrangler 설치 확인
if ! command -v wrangler &> /dev/null; then
    echo "⚠️  Wrangler가 설치되지 않았습니다."
    echo "설치 중..."
    npm install -g wrangler
fi

# Wrangler 로그인 확인
echo "🔐 Wrangler 로그인 확인 중..."
if ! wrangler whoami &> /dev/null; then
    echo "⚠️  Wrangler 로그인이 필요합니다."
    wrangler login
fi

echo "✅ Wrangler 로그인 완료"
echo ""

# 환경 변수 설정 (비대화형)
echo "🔧 환경 변수 설정 중..."
for KEY in "${!ENV_VARS[@]}"; do
    VALUE="${ENV_VARS[$KEY]}"
    echo "  설정: $KEY"
    
    # echo로 값을 전달하여 비대화형으로 실행
    echo "$VALUE" | wrangler pages secret put "$KEY" --project="$PROJECT_NAME" 2>&1 | grep -v "Enter a secret value" || true
done

echo ""
echo "✅ 환경 변수 설정 완료!"
echo ""
echo "📋 다음 단계:"
echo "  1. Cloudflare Dashboard에서 환경 변수 확인"
echo "     https://dash.cloudflare.com"
echo ""
echo "  2. 배포 실행:"
echo "     npm run build:kr"
echo "     npx wrangler pages deploy dist --project-name=$PROJECT_NAME"
echo ""
echo "  3. 사이트 접속:"
echo "     https://live.ur-team.com"
echo ""
echo "⚠️  주의:"
echo "  - JWT_SECRET, RESEND_API_KEY, TOSS_SECRET_KEY는 실제 값으로 교체 필요"
echo "  - Toss Client Key는 테스트 키입니다 (프로덕션에서는 실제 키 사용)"
echo ""
