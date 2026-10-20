#!/bin/bash

# ===================================
# ur-live 프로젝트 설정 검증 스크립트
# ===================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 체크 카운터
PASSED=0
FAILED=0
WARNINGS=0

# 로그 함수
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED++))
}

# 타이틀 출력
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════╗"
echo "║   ur-live 프로젝트 설정 검증               ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

# 1. 기본 파일 확인
log_info "1. 필수 파일 확인 중..."

if [ -f ".dev.vars" ]; then
    log_success ".dev.vars 파일 존재"
else
    log_error ".dev.vars 파일 없음"
fi

if [ -f ".env" ]; then
    log_success ".env 파일 존재"
else
    log_error ".env 파일 없음"
fi

if [ -f "package.json" ]; then
    log_success "package.json 파일 존재"
else
    log_error "package.json 파일 없음"
fi

if [ -f "wrangler.toml" ]; then
    log_success "wrangler.toml 파일 존재"
else
    log_error "wrangler.toml 파일 없음"
fi

# 2. .dev.vars 환경 변수 확인
log_info ""
log_info "2. .dev.vars 환경 변수 확인 중..."

required_vars=(
    "FIREBASE_DATABASE_URL"
    "FIREBASE_API_KEY"
    "FIREBASE_PROJECT_ID"
    "JWT_SECRET"
    "REFRESH_TOKEN_SECRET"
)

for var in "${required_vars[@]}"; do
    if grep -q "^${var}=" .dev.vars 2>/dev/null && ! grep -q "^${var}=$" .dev.vars; then
        log_success "${var} 설정됨"
    else
        log_error "${var} 설정 안됨 또는 비어있음"
    fi
done

# 3. .env 프론트엔드 변수 확인
log_info ""
log_info "3. .env 프론트엔드 변수 확인 중..."

if grep -q "VITE_TOSS_CLIENT_KEY=test_gck" .env 2>/dev/null; then
    log_success "VITE_TOSS_CLIENT_KEY 설정됨"
else
    log_error "VITE_TOSS_CLIENT_KEY 설정 안됨"
fi

# 백엔드 변수가 .env에 없는지 확인 (있으면 안됨)
if grep -q "^TOSS_SECRET_KEY=" .env 2>/dev/null; then
    log_warning "TOSS_SECRET_KEY가 .env에 있음 (보안 위험, .dev.vars로 이동 필요)"
else
    log_success ".env에 백엔드 변수 없음 (올바름)"
fi

# 4. Node modules 확인
log_info ""
log_info "4. Node modules 확인 중..."

if [ -d "node_modules" ]; then
    log_success "node_modules 설치됨"
    
    # React 버전 확인
    if [ -f "node_modules/react/package.json" ]; then
        REACT_VERSION=$(node -p "require('./node_modules/react/package.json').version" 2>/dev/null)
        if [ "$REACT_VERSION" = "18.3.1" ]; then
            log_success "React 18.3.1 설치됨"
        else
            log_warning "React 버전: $REACT_VERSION (권장: 18.3.1)"
        fi
    fi
else
    log_error "node_modules 없음 (npm install 필요)"
fi

# 5. 빌드 확인
log_info ""
log_info "5. 빌드 출력 확인 중..."

if [ -d "dist" ]; then
    log_success "dist 디렉토리 존재"
    
    if [ -f "dist/_worker.js" ]; then
        SIZE=$(du -h dist/_worker.js | cut -f1)
        log_success "dist/_worker.js 존재 (크기: $SIZE)"
    else
        log_warning "dist/_worker.js 없음 (npm run build 필요)"
    fi
else
    log_warning "dist 디렉토리 없음 (npm run build 필요)"
fi

# 6. D1 로컬 데이터베이스 확인
log_info ""
log_info "6. D1 로컬 데이터베이스 확인 중..."

if [ -d ".wrangler/state/v3/d1" ]; then
    log_success "D1 로컬 데이터베이스 초기화됨"
else
    log_warning "D1 로컬 데이터베이스 없음 (npm run db:migrate:local 필요)"
fi

# 7. Git 상태 확인
log_info ""
log_info "7. Git 저장소 확인 중..."

if [ -d ".git" ]; then
    log_success "Git 저장소 초기화됨"
    
    # 원격 저장소 확인
    if git remote -v | grep -q "ur-live"; then
        log_success "Git 원격 저장소 연결됨"
    else
        log_warning "Git 원격 저장소 미연결"
    fi
    
    # 커밋되지 않은 변경사항 확인
    if [ -z "$(git status --porcelain)" ]; then
        log_success "모든 변경사항 커밋됨"
    else
        log_warning "커밋되지 않은 변경사항 있음"
    fi
else
    log_error "Git 저장소 없음"
fi

# 8. TypeScript 설정 확인
log_info ""
log_info "8. TypeScript 설정 확인 중..."

if [ -f "tsconfig.json" ]; then
    if grep -q '"jsx": "react-jsx"' tsconfig.json; then
        log_success "tsconfig.json jsx 설정 올바름"
    else
        log_warning "tsconfig.json jsx 설정 확인 필요"
    fi
    
    if grep -q '"@/\*": \["./src/\*"\]' tsconfig.json; then
        log_success "tsconfig.json path 설정 올바름"
    else
        log_warning "tsconfig.json path 설정 확인 필요"
    fi
fi

# 결과 요약
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ 통과: $PASSED${NC}"
echo -e "${YELLOW}⚠️  경고: $WARNINGS${NC}"
echo -e "${RED}❌ 실패: $FAILED${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 모든 필수 검증 통과! 개발 시작 가능합니다.${NC}"
    echo ""
    echo "다음 명령어로 개발 서버를 시작하세요:"
    echo -e "${BLUE}  npm run dev:wrangler${NC}"
    echo ""
    exit 0
else
    echo ""
    echo -e "${RED}⚠️  일부 검증 실패. 위의 오류를 수정하세요.${NC}"
    echo ""
    exit 1
fi
