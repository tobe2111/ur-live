#!/bin/bash

# 🔧 Set Environment Variables for ur-live-global
# Run this AFTER creating the project in Cloudflare Dashboard

set -e

echo "🔧 Setting Environment Variables for ur-live-global"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check authentication
if ! wrangler whoami &>/dev/null; then
    echo "❌ Not logged in. Run: wrangler login"
    exit 1
fi

echo -e "${YELLOW}Please provide the following API keys:${NC}"
echo ""

# Collect keys
read -p "Enter VITE_GOOGLE_CLIENT_ID: " GOOGLE_CLIENT_ID
echo ""
read -p "Enter VITE_STRIPE_PUBLISHABLE_KEY (pk_test_...): " STRIPE_PUB_KEY
echo ""
read -sp "Enter STRIPE_SECRET_KEY (sk_test_...): " STRIPE_SECRET_KEY
echo ""
echo ""

# Confirm
echo ""
echo "📋 Will set these variables:"
echo "  - VITE_REGION=GLOBAL"
echo "  - VITE_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID"
echo "  - VITE_STRIPE_PUBLISHABLE_KEY=$STRIPE_PUB_KEY"
echo "  - STRIPE_SECRET_KEY=sk_test_***"
echo "  - VITE_DEFAULT_LANGUAGE=en"
echo "  - VITE_API_BASE_URL=https://world.ur-team.com"
echo ""
read -p "Continue? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Setting variables..."

# Set each variable
echo "GLOBAL" | wrangler pages secret put VITE_REGION --project-name=ur-live-global
echo "$GOOGLE_CLIENT_ID" | wrangler pages secret put VITE_GOOGLE_CLIENT_ID --project-name=ur-live-global
echo "$STRIPE_PUB_KEY" | wrangler pages secret put VITE_STRIPE_PUBLISHABLE_KEY --project-name=ur-live-global
echo "$STRIPE_SECRET_KEY" | wrangler pages secret put STRIPE_SECRET_KEY --project-name=ur-live-global
echo "en" | wrangler pages secret put VITE_DEFAULT_LANGUAGE --project-name=ur-live-global
echo "https://world.ur-team.com" | wrangler pages secret put VITE_API_BASE_URL --project-name=ur-live-global

echo ""
echo -e "${GREEN}✅ All environment variables set!${NC}"
echo ""
echo "📋 Next step:"
echo "Go to Cloudflare Dashboard and click 'Redeploy' button"
echo ""
