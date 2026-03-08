#!/bin/bash

# ===================================
# Cloudflare Secrets 자동 설정 스크립트
# ===================================

set -e

PROJECT_NAME="ur-live"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════╗"
echo "║   Cloudflare Secrets 자동 설정            ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

# .dev.vars 파일 확인
if [ ! -f ".dev.vars" ]; then
    echo -e "${YELLOW}⚠️  .dev.vars 파일을 찾을 수 없습니다.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ .dev.vars 파일 발견${NC}"
echo ""
echo -e "${YELLOW}⚠️  각 Secret을 설정할 때마다 값을 입력해야 합니다.${NC}"
echo -e "${YELLOW}   .dev.vars 파일에서 값을 복사하세요.${NC}"
echo ""
echo -e "${BLUE}📋 .dev.vars 파일 내용:${NC}"
echo ""
cat .dev.vars
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "계속하시겠습니까? (y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "취소되었습니다."
    exit 0
fi

# Secret 목록
secrets=(
    "FIREBASE_DATABASE_URL"
    "FIREBASE_API_KEY"
    "FIREBASE_PROJECT_ID"
    "FIREBASE_AUTH_DOMAIN"
    "FIREBASE_STORAGE_BUCKET"
    "FIREBASE_MESSAGING_SENDER_ID"
    "FIREBASE_APP_ID"
    "FIREBASE_PRIVATE_KEY"
    "FIREBASE_CLIENT_EMAIL"
    "JWT_SECRET"
    "REFRESH_TOKEN_SECRET"
    "TOSS_SECRET_KEY"
)

echo ""
echo -e "${BLUE}📝 Secret 설정을 시작합니다...${NC}"
echo ""

for secret in "${secrets[@]}"; do
    echo -e "${YELLOW}🔑 $secret 설정 중...${NC}"
    npx wrangler pages secret put "$secret" --project-name "$PROJECT_NAME"
    echo ""
done

echo ""
echo -e "${GREEN}✅ 모든 Secret 설정 완료!${NC}"
echo ""
echo -e "${BLUE}📋 설정된 Secret 확인:${NC}"
npx wrangler pages secret list --project-name "$PROJECT_NAME"

echo ""
echo -e "${YELLOW}⚠️  다음 단계: 배포 필요${NC}"
echo ""
echo "  npm run build"
echo "  npx wrangler pages deploy dist --project-name $PROJECT_NAME"
echo ""
