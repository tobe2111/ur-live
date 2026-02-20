#!/bin/bash

# Cloudflare Pages 배포 자동화 스크립트
# 사용법: ./deploy.sh [production|staging]

set -e  # 에러 발생 시 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 프로젝트 설정
PROJECT_NAME="ur-live"
REQUIRED_SECRETS=(
    "TOSS_SECRET_KEY"
    "TOSS_CLIENT_KEY"
)

# 로그 함수
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 1. 환경 변수 체크
log_info "1단계: 필수 환경 변수 체크 중..."

# Cloudflare Pages 시크릿 확인
log_info "Cloudflare Pages 시크릿 확인 중..."
SECRET_LIST=$(npx wrangler pages secret list --project-name "$PROJECT_NAME" 2>&1)

if [ $? -ne 0 ]; then
    log_error "Cloudflare 인증 실패. 'npx wrangler login' 실행 필요."
    exit 1
fi

MISSING_SECRETS=()
for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! echo "$SECRET_LIST" | grep -q "$secret"; then
        MISSING_SECRETS+=("$secret")
    fi
done

if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
    log_error "누락된 시크릿 발견:"
    for secret in "${MISSING_SECRETS[@]}"; do
        echo "  - $secret"
    done
    log_warning "다음 명령어로 시크릿을 추가하세요:"
    for secret in "${MISSING_SECRETS[@]}"; do
        echo "  npx wrangler pages secret put $secret --project-name $PROJECT_NAME"
    done
    exit 1
fi

log_success "모든 필수 시크릿 확인 완료"

# 2. 로컬 .dev.vars 확인
log_info "2단계: 로컬 환경 변수 파일 확인 중..."

if [ ! -f ".dev.vars" ]; then
    log_error ".dev.vars 파일이 없습니다."
    exit 1
fi

for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! grep -q "^$secret=" .dev.vars; then
        log_warning ".dev.vars에 $secret이 없습니다."
    fi
done

log_success "로컬 환경 변수 파일 확인 완료"

# 3. D1 마이그레이션 체크 (로컬)
log_info "3단계: D1 데이터베이스 마이그레이션 상태 확인 중..."

# 새 마이그레이션이 있는지 확인
MIGRATION_STATUS=$(npx wrangler d1 migrations list toss-live-commerce-db --local 2>&1 || echo "")

if echo "$MIGRATION_STATUS" | grep -q "Not applied"; then
    log_warning "미적용된 마이그레이션이 있습니다."
    read -p "로컬 D1에 마이그레이션을 적용하시겠습니까? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npx wrangler d1 migrations apply toss-live-commerce-db --local
        log_success "로컬 D1 마이그레이션 적용 완료"
    fi
fi

# 4. 빌드
log_info "4단계: 프로젝트 빌드 중..."

npm run build

if [ $? -ne 0 ]; then
    log_error "빌드 실패"
    exit 1
fi

log_success "빌드 완료"

# 5. 프로덕션 D1 마이그레이션 (선택)
ENV_TYPE=${1:-staging}

if [ "$ENV_TYPE" == "production" ]; then
    log_warning "프로덕션 환경으로 배포합니다!"
    read -p "프로덕션 D1에 마이그레이션을 적용하시겠습니까? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "프로덕션 D1 마이그레이션 적용 중..."
        npx wrangler d1 migrations apply toss-live-commerce-db
        log_success "프로덕션 D1 마이그레이션 적용 완료"
    fi
fi

# 6. 배포
log_info "5단계: Cloudflare Pages에 배포 중..."

npx wrangler pages deploy dist --project-name "$PROJECT_NAME"

if [ $? -ne 0 ]; then
    log_error "배포 실패"
    exit 1
fi

log_success "배포 완료"

# 7. 배포 검증
log_info "6단계: 배포 검증 중..."

PROD_URL="https://live.ur-team.com"
HEALTH_CHECK="${PROD_URL}/api/health"

log_info "헬스 체크: $HEALTH_CHECK"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_CHECK" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" == "200" ]; then
    log_success "헬스 체크 성공 (HTTP $HTTP_STATUS)"
else
    log_warning "헬스 체크 실패 또는 엔드포인트 없음 (HTTP $HTTP_STATUS)"
fi

# 프로덕션 URL 확인
log_info "프로덕션 URL 확인 중: $PROD_URL"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" == "200" ]; then
    log_success "프로덕션 사이트 접근 성공 (HTTP $HTTP_STATUS)"
else
    log_error "프로덕션 사이트 접근 실패 (HTTP $HTTP_STATUS)"
    exit 1
fi

# 8. 완료
echo ""
log_success "=========================================="
log_success "배포 완료!"
log_success "=========================================="
echo ""
log_info "프로덕션 URL: $PROD_URL"
log_info "배포 시각: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
log_info "다음 단계:"
echo "  1. $PROD_URL 에서 사이트 확인"
echo "  2. 주요 기능 테스트 (로그인, 결제 등)"
echo "  3. 브라우저 콘솔 에러 확인"
echo ""
