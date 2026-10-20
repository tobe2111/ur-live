#!/bin/bash

# 🌍 Complete Cloudflare Pages Setup Script
# Run this on your LOCAL machine, not in sandbox

set -e

echo "🚀 UR-Live Global Setup & Deployment"
echo "====================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if wrangler is logged in
echo "🔐 Checking Wrangler authentication..."
if ! wrangler whoami &>/dev/null; then
    echo -e "${RED}❌ Not logged in to Cloudflare${NC}"
    echo "Please run: wrangler login"
    exit 1
fi

echo -e "${GREEN}✅ Authenticated${NC}"
echo ""

# Step 1: Create project (if not exists)
echo "📦 Step 1: Creating Cloudflare Pages project..."
wrangler pages project create ur-live-global --production-branch=main 2>/dev/null || echo "Project may already exist, continuing..."

echo ""

# Step 2: Build
echo "🔨 Step 2: Building global version..."
npm run build:global

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# Step 3: Deploy
echo "🚀 Step 3: Deploying to Cloudflare Pages..."
wrangler pages deploy dist --project-name=ur-live-global --branch=main

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Deployment successful!${NC}"
echo ""

# Step 4: Set environment variables
echo "⚙️  Step 4: Setting environment variables..."
echo ""
echo -e "${YELLOW}Please provide the following values:${NC}"
echo ""

# Prompt for environment variables
read -p "Enter VITE_GOOGLE_CLIENT_ID: " GOOGLE_CLIENT_ID
read -p "Enter VITE_STRIPE_PUBLISHABLE_KEY (pk_test_...): " STRIPE_PUB_KEY
read -sp "Enter STRIPE_SECRET_KEY (sk_test_...): " STRIPE_SECRET_KEY
echo ""

# Set environment variables
echo ""
echo "Setting environment variables..."

wrangler pages secret put VITE_REGION --project-name=ur-live-global <<< "GLOBAL"
wrangler pages secret put VITE_GOOGLE_CLIENT_ID --project-name=ur-live-global <<< "$GOOGLE_CLIENT_ID"
wrangler pages secret put VITE_STRIPE_PUBLISHABLE_KEY --project-name=ur-live-global <<< "$STRIPE_PUB_KEY"
wrangler pages secret put STRIPE_SECRET_KEY --project-name=ur-live-global <<< "$STRIPE_SECRET_KEY"
wrangler pages secret put VITE_DEFAULT_LANGUAGE --project-name=ur-live-global <<< "en"
wrangler pages secret put VITE_API_BASE_URL --project-name=ur-live-global <<< "https://world.ur-team.com"

echo ""
echo -e "${GREEN}✅ Environment variables set${NC}"
echo ""

# Step 5: Trigger redeploy
echo "🔄 Step 5: Triggering redeploy with new environment variables..."
wrangler pages deploy dist --project-name=ur-live-global --branch=main

echo ""
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo "📋 Next steps:"
echo "1. Add custom domain in Cloudflare Dashboard:"
echo "   Workers & Pages → ur-live-global → Custom domains"
echo "   Domain: world.ur-team.com"
echo ""
echo "2. Add to Firebase authorized domains:"
echo "   Firebase Console → Authentication → Settings"
echo "   Add: world.ur-team.com"
echo ""
echo "3. Test your deployment:"
echo "   https://ur-live-global.pages.dev (temporary)"
echo "   https://world.ur-team.com (after custom domain setup)"
echo ""
