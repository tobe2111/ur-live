#!/bin/bash
# deploy-production.sh — 프로덕션 배포 체크리스트 강제 실행
# 프로젝트: ur-live (live.ur-team.com)
#
# 사용법: bash scripts/deploy-production.sh
# 전제: CLOUDFLARE_API_TOKEN 환경변수 설정됨
#       스테이징(ur-live-staging.pages.dev)에서 검증 완료
#
# ⚠️ 배포 후 새 테이블이 있다면:
#    POST /api/_internal/repair-new-tables 호출 필요
set -euo pipefail

echo "==> 프로덕션 배포 시작 (live.ur-team.com)..."

# 프로젝트 루트 확인
if [ ! -f "package.json" ]; then
  echo "❌ package.json 없음. 프로젝트 루트에서 실행하세요."
  exit 1
fi

# 1. 빌드
echo "==> [1/5] npm run build..."
npm run build

# 2. TypeScript 검사
echo "==> [2/5] TypeScript 검사..."
npx tsc --noEmit --skipLibCheck

# 3. 스키마 레퍼런스 검사
echo "==> [3/5] 스키마 레퍼런스 검사..."
bash scripts/check-schema-refs.sh

# 4. API 인증 검사
echo "==> [4/5] API 인증 검사..."
bash scripts/check-api-auth.sh

# 5. npm audit (high/critical)
echo "==> [5/5] 의존성 취약점 검사..."
bash scripts/check-npm-audit.sh

# 6. 프로덕션 배포
echo "==> Cloudflare Pages 프로덕션 배포 중..."
npx wrangler@3 pages deploy dist/client \
  --project-name=ur-live \
  --branch=main \
  --commit-dirty=true

echo ""
echo "✅ 프로덕션 배포 완료"
echo "   URL: https://live.ur-team.com"
echo ""
echo "   배포 후 체크리스트:"
echo "   - Cloudflare Dashboard → Actions 탭 녹색 확인"
echo "   - curl -I https://live.ur-team.com/api/products | grep X-RateLimit"
echo "   - 새 테이블 있을 때: POST /api/_internal/repair-new-tables"
echo "   - 스모크 테스트: bash scripts/smoke-test.sh"
