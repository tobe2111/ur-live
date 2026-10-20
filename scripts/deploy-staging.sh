#!/bin/bash
# deploy-staging.sh — 스테이징 배포
# 프로젝트: ur-live-staging (별도 CF Pages 프로젝트, 프로덕션과 독립)
#
# 사용법: bash scripts/deploy-staging.sh
# 전제: CLOUDFLARE_API_TOKEN 환경변수 설정됨
#       (또는 wrangler login 으로 인증된 상태)
#
# 스테이징 URL: https://ur-live-staging.pages.dev
# 프로덕션 URL: https://live.ur-team.com (ur-live 프로젝트)
set -euo pipefail

echo "==> 스테이징 배포 시작..."

# 프로젝트 루트 확인
if [ ! -f "package.json" ]; then
  echo "❌ package.json 없음. 프로젝트 루트에서 실행하세요."
  exit 1
fi

# 1. 빌드
echo "==> npm run build..."
npm run build

# 2. TypeScript 체크 (스테이징도 타입 에러 없어야 함)
echo "==> TypeScript 검사..."
npx tsc --noEmit --skipLibCheck

# 3. 스테이징 배포
echo "==> Cloudflare Pages 스테이징 배포 중..."
npx wrangler@3 pages deploy dist/client \
  --project-name=ur-live-staging \
  --branch=main \
  --commit-dirty=true

echo ""
echo "✅ 스테이징 배포 완료"
echo "   URL: https://ur-live-staging.pages.dev"
echo ""
echo "   스테이징 검증 항목:"
echo "   - 로그인/인증 흐름"
echo "   - 결제 플로우 (Toss sandbox)"
echo "   - 라이브 스트리밍 WebSocket"
echo "   - 에러율 < 0.1%, p95 latency < 2s"
echo ""
echo "   검증 완료 후 프로덕션 배포:"
echo "   bash scripts/deploy-production.sh"
