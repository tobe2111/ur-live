#!/bin/bash

echo "🔍 누락된 Worker 환경변수 체크"
echo "======================================"
echo ""

echo "📋 필수 Worker 환경변수 (Cloudflare Dashboard에 추가 필요):"
echo ""

echo "1️⃣ Firebase Admin SDK (로그인용)"
echo "   ❌ FIREBASE_PROJECT_ID          (toss-live-commerce)"
echo "   ❌ FIREBASE_PRIVATE_KEY          (Firebase Console에서 다운로드)"
echo "   ❌ FIREBASE_CLIENT_EMAIL         (firebase-adminsdk-xxxxx@...)"
echo "   ❌ FIREBASE_DATABASE_URL         (https://urteam-live-commerce-5b284-default-rtdb...)"
echo ""

echo "2️⃣ Kakao OAuth (로그인용)"
echo "   ❌ KAKAO_REST_API_KEY            (5dd74bccb797640b0efd070467f3bafd)"
echo ""

echo "3️⃣ 프론트엔드 환경변수 (Build settings에 추가)"
echo "   ⏳ VITE_FIREBASE_DATABASE_URL    (채팅용)"
echo ""

echo "======================================"
echo "🎯 현재 에러:"
echo "   ❌ Kakao 로그인: 500 error (Firebase credentials missing)"
echo "   ❌ 라이브 채팅: WebSocket blocked (VITE_ env var missing)"
echo ""

echo "📝 해결 순서:"
echo "   1. Firebase Console → Service accounts → Generate private key (JSON 다운로드)"
echo "   2. Cloudflare Dashboard → ur-live → Settings → Environment variables"
echo "   3. 5개 환경변수 추가 (FIREBASE_*, KAKAO_REST_API_KEY)"
echo "   4. Save → Retry deployment"
echo "   5. 3분 후 Kakao 로그인 테스트"
echo ""

echo "📖 상세 가이드: CLOUDFLARE_WORKER_ENV_SETUP.md"
