#!/bin/bash

# UR-Live Quick Deploy Script
# This script automates the deployment process

set -e  # Exit on error

echo "🚀 UR-Live Quick Deployment Script"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

echo "📋 Pre-deployment Checklist"
echo "----------------------------"

# 1. Check Git status
echo -n "Checking Git status... "
if [ -z "$(git status --porcelain)" ]; then 
    echo -e "${GREEN}✓ No uncommitted changes${NC}"
else
    echo -e "${YELLOW}⚠ You have uncommitted changes${NC}"
    git status --short
    read -p "Do you want to commit these changes? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter commit message: " commit_msg
        git add .
        git commit -m "$commit_msg"
        echo -e "${GREEN}✓ Changes committed${NC}"
    fi
fi

# 2. Run tests
echo ""
echo "🧪 Running tests..."
if npm run test:unit > /dev/null 2>&1; then
    echo -e "${GREEN}✓ All tests passed${NC}"
else
    echo -e "${RED}❌ Tests failed. Please fix issues before deploying.${NC}"
    read -p "Do you want to continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 3. Build project
echo ""
echo "🔨 Building project..."
if npm run build; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# 4. Check build size
echo ""
echo "📦 Build size:"
du -sh dist/
du -sh dist/assets/ 2>/dev/null || true

# 5. Push to GitHub
echo ""
echo "📤 Pushing to GitHub..."
current_branch=$(git branch --show-current)
if git push origin "$current_branch"; then
    echo -e "${GREEN}✓ Pushed to GitHub${NC}"
else
    echo -e "${RED}❌ Failed to push to GitHub${NC}"
    echo "Please check your Git credentials and try again."
    exit 1
fi

# 6. Deploy options
echo ""
echo "☁️ Deployment Options"
echo "----------------------------"
echo "1. Deploy with Wrangler CLI (requires authentication)"
echo "2. Open Cloudflare Dashboard (manual deployment)"
echo "3. Skip deployment (GitHub Actions will deploy automatically)"
echo ""
read -p "Choose an option (1-3): " deploy_option

case $deploy_option in
    1)
        echo ""
        echo "Deploying with Wrangler..."
        if wrangler whoami > /dev/null 2>&1; then
            wrangler pages deploy dist --project-name ur-live --branch main
            echo -e "${GREEN}✓ Deployment initiated${NC}"
        else
            echo -e "${YELLOW}⚠ Not authenticated with Cloudflare${NC}"
            echo "Please run: wrangler login"
            echo "Then try deploying manually with:"
            echo "  npm run deploy"
        fi
        ;;
    2)
        echo ""
        echo "Opening Cloudflare Dashboard..."
        echo "URL: https://dash.cloudflare.com/pages"
        if command -v xdg-open > /dev/null; then
            xdg-open "https://dash.cloudflare.com/pages" 2>/dev/null
        elif command -v open > /dev/null; then
            open "https://dash.cloudflare.com/pages" 2>/dev/null
        else
            echo "Please open the URL manually in your browser."
        fi
        ;;
    3)
        echo ""
        echo -e "${GREEN}✓ Changes pushed to GitHub${NC}"
        echo "GitHub Actions will automatically deploy when you merge to main."
        echo ""
        echo "Monitor deployment at:"
        echo "  https://github.com/tobe2111/ur-live/actions"
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo ""
echo "════════════════════════════════════"
echo -e "${GREEN}🎉 Deployment process completed!${NC}"
echo "════════════════════════════════════"
echo ""
echo "🔗 Important Links:"
echo "  Production:  https://live.ur-team.com"
echo "  Preview:     https://ur-live.pages.dev"
echo "  GitHub:      https://github.com/tobe2111/ur-live"
echo "  Actions:     https://github.com/tobe2111/ur-live/actions"
echo "  Dashboard:   https://dash.cloudflare.com/pages"
echo ""
echo "📊 Next Steps:"
echo "  1. Verify deployment at production URL"
echo "  2. Check Cloudflare Analytics"
echo "  3. Monitor error logs in Sentry"
echo "  4. Run post-deployment tests"
echo ""
echo "Need help? Check DEPLOYMENT_GUIDE.md"
