#!/bin/bash

set -e  # 에러 발생 시 즉시 중단

echo "🚀 Starting global deployment..."

# Step 1: 환경 확인
echo "📋 Step 1/7: Checking environment..."
if [ ! -f ".env.production" ]; then
  echo "⚠️  Warning: .env.production file not found (optional for Cloudflare env vars)"
fi

node --version
npm --version
echo "✅ Environment OK"

# Step 2: 의존성 설치
echo "📦 Step 2/7: Installing dependencies..."
npm ci
echo "✅ Dependencies installed"

# Step 3: 타입 체크
echo "🔍 Step 3/7: Running type check..."
npm run type-check
echo "✅ Type check passed"

# Step 4: 단위 테스트
echo "🧪 Step 4/7: Running unit tests..."
npm run test:unit
echo "✅ Unit tests passed"

# Step 5: 빌드
echo "🏗️  Step 5/7: Building production bundle..."
NODE_ENV=production npm run build
echo "✅ Build completed"

# Step 6: 배포
echo "🌍 Step 6/7: Deploying to Cloudflare Pages..."
npx wrangler pages deploy dist --project-name ur-live-global
echo "✅ Deployment completed"

# Step 7: 헬스 체크
echo "💚 Step 7/7: Running health check..."
sleep 10  # 배포 완료 대기
HEALTH_URL="https://live-global.ur-team.com/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ "$RESPONSE" -eq 200 ]; then
  echo "✅ Health check passed: $HEALTH_URL"
else
  echo "⚠️  Health check warning: HTTP $RESPONSE (service may still be starting)"
fi

echo ""
echo "🎉 Global deployment completed successfully!"
echo "🌐 URL: https://live-global.ur-team.com"
echo ""
echo "📊 Next steps:"
echo "  1. Check Cloudflare Analytics: https://dash.cloudflare.com/"
echo "  2. Monitor Sentry: https://sentry.io/"
echo "  3. Run E2E tests: npm run test:e2e"
echo "  4. Verify user flows manually"
