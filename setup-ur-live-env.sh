#!/bin/bash
# ur-live 프로젝트 환경변수 설정 스크립트
# 이 파일은 참고용입니다. Cloudflare Dashboard에서 수동으로 추가하세요.

# ==========================================
# FRONTEND 환경변수 (17개 - Plaintext)
# ==========================================

echo "=== Frontend Variables (Type: Plaintext) ==="

# Firebase (8개)
echo "VITE_FIREBASE_API_KEY=AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s"
echo "VITE_FIREBASE_AUTH_DOMAIN=urteam-live-commerce.firebaseapp.com"
echo "VITE_FIREBASE_DATABASE_URL=https://urteam-live-commerce-default-rtdb.asia-southeast1.firebasedatabase.app"
echo "VITE_FIREBASE_PROJECT_ID=urteam-live-commerce"
echo "VITE_FIREBASE_STORAGE_BUCKET=urteam-live-commerce.firebasestorage.app"
echo "VITE_FIREBASE_MESSAGING_SENDER_ID=1098157020294"
echo "VITE_FIREBASE_APP_ID=1:1098157020294:web:5f527d8e3e9f941cedad07"
echo "VITE_FIREBASE_MEASUREMENT_ID=G-B1ST2L37CM"

# Kakao (4개)
echo "VITE_KAKAO_APP_KEY=975a2e7f97254b08f15dba4d177a2865"
echo "VITE_KAKAO_JAVASCRIPT_KEY=975a2e7f97254b08f15dba4d177a2865"
echo "VITE_KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd"
echo "VITE_KAKAO_AUTH_URL=https://kauth.kakao.com/oauth/authorize"

# Toss (1개)
echo "VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN"

# 기타 (4개)
echo "VITE_REGION=KR"
echo "VITE_DEFAULT_LANGUAGE=ko"
echo "VITE_API_BASE_URL=https://live.ur-team.com"
echo "VITE_SENTRY_DSN=https://08caf64e8e7955f09acc2b0551fdb049@o4510992097935360.ingest.us.sentry.io/4510992127295488"
echo "VITE_SENTRY_ENVIRONMENT=production"

echo ""
echo "=== Backend Variables (Type: Secret) ==="

# Firebase Admin (3개)
echo "FIREBASE_API_KEY=AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s"
echo "FIREBASE_PROJECT_ID=urteam-live-commerce"
echo "FIREBASE_DATABASE_URL=https://urteam-live-commerce-default-rtdb.asia-southeast1.firebasedatabase.app"

# JWT (2개)
echo "JWT_SECRET=3Y4MyekQ4D+GFVY6p6bJEScOMSyFFkbtSX76YyT9uk4="
echo "REFRESH_TOKEN_SECRET=zetvg/v05J+O6M99ndq4UFliUwvw2Gvvi8dPXXZ3+z0="

# 기타 (6개)
echo "ENVIRONMENT=production"
echo "FRONTEND_URL=https://live.ur-team.com"
echo "REGION=KR"
echo "KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd"
echo "TOSS_SECRET_KEY=test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY"

echo ""
echo "=== Service Account Variables (Firebase Console에서 생성 필요) ==="
echo "FIREBASE_PRIVATE_KEY=(JSON의 private_key)"
echo "FIREBASE_CLIENT_EMAIL=(JSON의 client_email)"
echo "FIREBASE_SERVICE_ACCOUNT_KEY=(JSON 전체를 한 줄로)"

echo ""
echo "총 31개 환경변수"
echo "- Frontend (Plaintext): 17개"
echo "- Backend (Secret): 14개"
