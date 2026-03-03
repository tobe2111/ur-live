#!/bin/bash

# 🌍 UR-Live Global Version Deployment Script
# This script creates and deploys the global version to Cloudflare Pages

set -e

echo "🚀 UR-Live Global Deployment Script"
echo "===================================="
echo ""

# Step 1: Build global version
echo "📦 Step 1: Building global version..."
npm run build:global

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build completed!"
echo ""

# Step 2: Deploy to Cloudflare Pages
echo "🚀 Step 2: Deploying to Cloudflare Pages..."
echo ""
echo "Project name: ur-live-global"
echo "Domain: world.ur-team.com"
echo ""

wrangler pages deploy dist \
  --project-name=ur-live-global \
  --branch=main

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed!"
    echo ""
    echo "💡 If this is your first deployment, you may need to:"
    echo "   1. Create the project in Cloudflare Dashboard first"
    echo "   2. Or use: wrangler pages project create ur-live-global"
    exit 1
fi

echo ""
echo "✅ Deployment successful!"
echo ""
echo "📋 Next steps:"
echo "1. Go to Cloudflare Dashboard"
echo "2. Workers & Pages → ur-live-global → Settings"
echo "3. Add environment variables:"
echo "   - VITE_REGION=GLOBAL"
echo "   - VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID"
echo "   - VITE_STRIPE_PUBLISHABLE_KEY=pk_test_..."
echo "   - STRIPE_SECRET_KEY=sk_test_..."
echo "   - VITE_DEFAULT_LANGUAGE=en"
echo "   - VITE_API_BASE_URL=https://world.ur-team.com"
echo "4. Click 'Redeploy'"
echo ""
echo "🌍 Your global version will be live at:"
echo "   https://world.ur-team.com"
echo ""
