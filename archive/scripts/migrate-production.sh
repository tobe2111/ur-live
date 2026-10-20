#!/bin/bash
# Production Database Migration Script
# Run this to apply migrations to Cloudflare D1 database

set -e

echo "🔍 Checking Cloudflare D1 database..."

# Get D1 database name from wrangler.toml
DB_NAME="toss-live-commerce-db"

echo "📦 Applying migration: add-ended-at-to-live-streams.sql"
wrangler d1 execute $DB_NAME --file=./migrations/add-ended-at-to-live-streams.sql --remote

echo "✅ Migration completed successfully!"
echo ""
echo "🧪 Verifying migration..."
wrangler d1 execute $DB_NAME --command="SELECT COUNT(*) as total FROM live_streams;" --remote

echo ""
echo "🎉 All done! Please test the seller dashboard now."
