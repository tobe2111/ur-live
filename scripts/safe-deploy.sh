#!/bin/bash
# 안전한 배포 스크립트
# Usage: ./scripts/safe-deploy.sh [preview|production]

set -e  # 에러 발생 시 즉시 중단

DEPLOY_TYPE=${1:-preview}
PROJECT_DIR="/home/user/webapp"
cd "$PROJECT_DIR"

echo "🚀 Starting Safe Deployment Process..."
echo "📍 Deploy Type: $DEPLOY_TYPE"
echo ""

# ==========================================
# 1. Pre-flight Checks
# ==========================================
echo "✅ Step 1/6: Pre-flight Checks"

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo "⚠️  Warning: Uncommitted changes detected"
    git status -s
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📌 Current branch: $CURRENT_BRANCH"

# ==========================================
# 2. TypeScript Type Check
# ==========================================
echo ""
echo "✅ Step 2/6: TypeScript Type Check"
npx tsc --noEmit || {
    echo "❌ TypeScript errors detected!"
    exit 1
}
echo "✓ TypeScript check passed"

# ==========================================
# 3. Build Test
# ==========================================
echo ""
echo "✅ Step 3/6: Build Test"
npm run build || {
    echo "❌ Build failed!"
    exit 1
}
echo "✓ Build successful"

# Check build output
WORKER_SIZE=$(stat -f%z dist/_worker.js 2>/dev/null || stat -c%s dist/_worker.js)
WORKER_SIZE_MB=$((WORKER_SIZE / 1024 / 1024))
echo "📦 Worker size: ${WORKER_SIZE_MB}MB"

if [ $WORKER_SIZE_MB -gt 10 ]; then
    echo "⚠️  Warning: Worker size exceeds 10MB limit!"
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# ==========================================
# 4. API Tests
# ==========================================
echo ""
echo "✅ Step 4/6: API Endpoint Tests (Local)"

# Start local server
echo "🔄 Starting local server..."
fuser -k 3000/tcp 2>/dev/null || true
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.cjs
sleep 5

# Test main API endpoints
API_TESTS=(
    "http://localhost:3000/api/streams"
    "http://localhost:3000/"
)

ALL_TESTS_PASSED=true
for endpoint in "${API_TESTS[@]}"; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint")
    if [ "$HTTP_CODE" == "200" ]; then
        echo "✓ $endpoint - $HTTP_CODE"
    else
        echo "✗ $endpoint - $HTTP_CODE"
        ALL_TESTS_PASSED=false
    fi
done

pm2 delete all 2>/dev/null || true

if [ "$ALL_TESTS_PASSED" = false ]; then
    echo "❌ Some API tests failed!"
    exit 1
fi

# ==========================================
# 5. Deploy
# ==========================================
echo ""
echo "✅ Step 5/6: Deploying to Cloudflare Pages"

if [ "$DEPLOY_TYPE" == "production" ]; then
    echo "🌍 Deploying to PRODUCTION..."
    read -p "Are you sure? (yes/no) " -r
    if [[ ! $REPLY == "yes" ]]; then
        echo "Deployment cancelled"
        exit 0
    fi
    
    npx wrangler pages deploy dist --project-name toss-live-commerce --branch main
else
    echo "🔬 Deploying to PREVIEW..."
    npx wrangler pages deploy dist --project-name toss-live-commerce
fi

# ==========================================
# 6. Post-Deployment Checks
# ==========================================
echo ""
echo "✅ Step 6/6: Post-Deployment Checks"

if [ "$DEPLOY_TYPE" == "production" ]; then
    BASE_URL="https://live.ur-team.com"
else
    # Extract preview URL from deployment output
    BASE_URL="https://live.ur-team.com"  # Fallback
    echo "⚠️  Please test manually on the preview URL shown above"
fi

echo "🔍 Testing deployed endpoints..."
sleep 5

PROD_TESTS=(
    "$BASE_URL/"
    "$BASE_URL/api/streams"
)

for endpoint in "${PROD_TESTS[@]}"; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint")
    if [ "$HTTP_CODE" == "200" ]; then
        echo "✓ $endpoint - $HTTP_CODE"
    else
        echo "✗ $endpoint - $HTTP_CODE"
    fi
done

# ==========================================
# Summary
# ==========================================
echo ""
echo "=========================================="
echo "🎉 Deployment Complete!"
echo "=========================================="
echo "Type: $DEPLOY_TYPE"
echo "Branch: $CURRENT_BRANCH"
echo "Build Size: ${WORKER_SIZE_MB}MB"
echo ""
echo "📝 Next Steps:"
echo "1. Test all major pages manually"
echo "2. Check browser console for errors"
echo "3. Monitor for 5-10 minutes"
echo "4. If issues found, run: git revert HEAD && ./scripts/safe-deploy.sh"
echo ""
