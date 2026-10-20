#!/bin/bash

# D1 Migration Runner Script
# This script runs the firebase_uid migration on the production D1 database

echo "🚀 Starting D1 Migration: Add firebase_uid column"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: wrangler is not installed"
    echo "Install it with: npm install -g wrangler"
    exit 1
fi

# Check for required environment variables
if [ -z "$CLOUDFLARE_API_TOKEN" ] || [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
    echo "❌ Error: Required environment variables not set"
    echo ""
    echo "Please set:"
    echo "  export CLOUDFLARE_API_TOKEN=your_token_here"
    echo "  export CLOUDFLARE_ACCOUNT_ID=your_account_id_here"
    echo ""
    echo "You can find these in:"
    echo "  - GitHub repo Settings → Secrets and variables → Actions"
    echo "  - Or Cloudflare Dashboard → Profile → API Tokens"
    exit 1
fi

echo "✅ Environment variables found"
echo "📦 Database: toss-live-commerce-db"
echo ""

# Run the migration
echo "🔄 Executing SQL migration..."
echo ""

wrangler d1 execute toss-live-commerce-db \
    --remote \
    --file=./migrations/0030_add_firebase_uid.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "🔍 Verifying schema..."
    echo ""
    
    # Verify the migration
    wrangler d1 execute toss-live-commerce-db \
        --remote \
        --command="PRAGMA table_info(users);" | grep firebase_uid
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 SUCCESS! firebase_uid column has been added!"
        echo ""
        echo "Next steps:"
        echo "1. Test Kakao login: https://live.ur-team.com/login"
        echo "2. Check console logs for '[Firebase Sync] ✅ Firebase Custom Token 발급 완료'"
    else
        echo ""
        echo "⚠️  Warning: Could not verify column creation"
        echo "Please check manually in Cloudflare Dashboard"
    fi
else
    echo ""
    echo "❌ Migration failed!"
    echo "Please check the error message above"
    exit 1
fi
