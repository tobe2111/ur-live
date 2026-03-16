#!/bin/bash
set -e

echo "🚀 Manual Production Deploy"
echo "================================"

# 1. 빌드 확인
if [ ! -d "dist/client" ]; then
  echo "❌ dist/client not found. Run 'npm run build' first."
  exit 1
fi

# 2. _worker.js 확인
if [ ! -f "dist/client/_worker.js" ]; then
  echo "❌ _worker.js not found in dist/client/"
  exit 1
fi

echo "✅ Build files verified"
echo ""
echo "📦 Files to deploy:"
ls -lh dist/client/_worker.js
ls -lh dist/client/_routes.json
echo ""

# 3. 배포
echo "🚀 Deploying to Cloudflare Pages..."
npx wrangler pages deploy dist/client --project-name=ur-live --branch=main

echo ""
echo "✅ Deploy completed!"
