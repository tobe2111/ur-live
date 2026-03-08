#!/bin/bash

#################################################################################
# UR Live 듀얼 사이트 자동 배포 스크립트
#################################################################################
# 목적: KR + GLOBAL 사이트 빌드 및 환경 변수 템플릿 생성
# 사용법: ./scripts/deploy-dual-sites.sh
#################################################################################

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       UR Live 듀얼 사이트 자동 배포 스크립트              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 작업 디렉토리 확인
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Run this script from project root.${NC}"
    exit 1
fi

#################################################################################
# Phase 1: KR 사이트 빌드
#################################################################################

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Phase 1: KR 사이트 빌드 (live.ur-team.com)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}🔨 Building KR version...${NC}"
npm run build:kr

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ KR build completed successfully${NC}"
    echo -e "${GREEN}   Output: dist/${NC}"
    echo -e "${GREEN}   Size: $(du -sh dist | cut -f1)${NC}"
else
    echo -e "${RED}❌ KR build failed${NC}"
    exit 1
fi

echo ""

#################################################################################
# Phase 2: GLOBAL 사이트 빌드
#################################################################################

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Phase 2: GLOBAL 사이트 빌드 (world.ur-team.com)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}🔨 Building GLOBAL version...${NC}"
npm run build:global

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ GLOBAL build completed successfully${NC}"
    echo -e "${GREEN}   Output: dist-global/${NC}"
    echo -e "${GREEN}   Size: $(du -sh dist-global | cut -f1)${NC}"
else
    echo -e "${RED}❌ GLOBAL build failed${NC}"
    exit 1
fi

echo ""

#################################################################################
# Phase 3: 환경 변수 템플릿 생성
#################################################################################

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Phase 3: 환경 변수 템플릿 생성${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# KR 환경 변수 템플릿
cat > .env.kr.template << 'EOF'
# UR Live KR 환경 변수 템플릿 (live.ur-team.com)
# 생성일: $(date '+%Y-%m-%d')

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Firebase 설정 (8개) - 필수
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_REGION=KR

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Kakao OAuth (3개) - 필수
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VITE_KAKAO_REST_API_KEY=
VITE_KAKAO_JAVASCRIPT_KEY=
VITE_KAKAO_AUTH_URL=https://kauth.kakao.com

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TossPayments (1개) - 필수
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VITE_TOSS_CLIENT_KEY=

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 선택 사항
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VITE_API_BASE_URL=
VITE_SENTRY_DSN=
VITE_DAUM_POSTCODE_KEY=
EOF

echo -e "${GREEN}✅ Created: .env.kr.template${NC}"

# GLOBAL 환경 변수 템플릿
cat > .env.global.template << 'EOF'
# UR Live GLOBAL 환경 변수 템플릿 (world.ur-team.com)
# 생성일: $(date '+%Y-%m-%d')

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Firebase 설정 (8개) - 필수
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_REGION=GLOBAL

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Google OAuth (1개) - 필수
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VITE_GOOGLE_CLIENT_ID=

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Stripe (1개) - 필수
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VITE_STRIPE_PUBLISHABLE_KEY=

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 선택 사항
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VITE_API_BASE_URL=
VITE_SENTRY_DSN=
EOF

echo -e "${GREEN}✅ Created: .env.global.template${NC}"

# Worker Secrets 템플릿
cat > .worker-secrets.template << 'EOF'
# UR Live Worker Secrets 템플릿
# Cloudflare Pages Secret 설정용
# 생성일: $(date '+%Y-%m-%d')

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Firebase Admin SDK (모든 버전 공통)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
FIREBASE_DATABASE_URL=

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# KR 전용 Secrets (ur-live-kr 프로젝트)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KAKAO_CLIENT_SECRET=
TOSS_SECRET_KEY=

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GLOBAL 전용 Secrets (ur-live-global 프로젝트)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GOOGLE_CLIENT_SECRET=
STRIPE_SECRET_KEY=

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 공통 Secrets (모든 프로젝트)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JWT_SECRET=
RESEND_API_KEY=
EMAIL_FROM=

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 선택 사항
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISCORD_WEBHOOK_URL=

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 설정 방법:
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# KR 프로젝트에 설정:
# npx wrangler pages secret put FIREBASE_PROJECT_ID --project-name ur-live-kr
# npx wrangler pages secret put KAKAO_CLIENT_SECRET --project-name ur-live-kr
# npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live-kr
# npx wrangler pages secret put JWT_SECRET --project-name ur-live-kr
# npx wrangler pages secret put RESEND_API_KEY --project-name ur-live-kr
# npx wrangler pages secret put EMAIL_FROM --project-name ur-live-kr

# GLOBAL 프로젝트에 설정:
# npx wrangler pages secret put FIREBASE_PROJECT_ID --project-name ur-live-global
# npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name ur-live-global
# npx wrangler pages secret put STRIPE_SECRET_KEY --project-name ur-live-global
# npx wrangler pages secret put JWT_SECRET --project-name ur-live-global
# npx wrangler pages secret put RESEND_API_KEY --project-name ur-live-global
# npx wrangler pages secret put EMAIL_FROM --project-name ur-live-global
EOF

echo -e "${GREEN}✅ Created: .worker-secrets.template${NC}"

echo ""

#################################################################################
# Phase 4: 배포 정보 요약
#################################################################################

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Phase 4: 빌드 완료 및 다음 단계${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${GREEN}✅ 빌드 완료!${NC}"
echo ""

echo -e "${YELLOW}📦 빌드 산출물:${NC}"
echo -e "   KR:     dist/ ($(du -sh dist 2>/dev/null | cut -f1 || echo 'N/A'))"
echo -e "   GLOBAL: dist-global/ ($(du -sh dist-global 2>/dev/null | cut -f1 || echo 'N/A'))"
echo ""

echo -e "${YELLOW}📄 생성된 템플릿:${NC}"
echo -e "   .env.kr.template"
echo -e "   .env.global.template"
echo -e "   .worker-secrets.template"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}다음 단계 (수동 작업 필요):${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${CYAN}1️⃣  Cloudflare Dashboard 설정${NC}"
echo -e "    https://dash.cloudflare.com/"
echo ""

echo -e "${CYAN}2️⃣  KR 사이트 (live.ur-team.com)${NC}"
echo -e "    • 프로젝트명: ur-live-kr"
echo -e "    • Build command: npm run build:kr"
echo -e "    • Output: /dist"
echo -e "    • 환경 변수: .env.kr.template 참고 (12개)"
echo ""

echo -e "${CYAN}3️⃣  GLOBAL 사이트 (world.ur-team.com)${NC}"
echo -e "    • 프로젝트명: ur-live-global"
echo -e "    • Build command: npm run build:global"
echo -e "    • Output: /dist-global"
echo -e "    • 환경 변수: .env.global.template 참고 (10개)"
echo ""

echo -e "${CYAN}4️⃣  Worker Secrets 설정${NC}"
echo -e "    .worker-secrets.template 파일 참고"
echo ""

echo -e "${CYAN}5️⃣  자세한 가이드:${NC}"
echo -e "    cat DUAL_SITE_EXECUTION_GUIDE.md"
echo ""

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}스크립트 완료! 🎉${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
