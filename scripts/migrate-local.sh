#!/bin/bash
set -e

echo "🔄 Starting local database migration..."

DB_NAME="toss-live-commerce-db"

# Core migrations only (exclude .skip files)
MIGRATIONS=(
  "0001_initial_schema.sql"
  "0003_add_admin_seller.sql"
  "0003_add_performance_indexes.sql"
  "0004_add_product_detail_images.sql"
)

for migration in "${MIGRATIONS[@]}"; do
  if [ -f "migrations/$migration" ]; then
    echo "📝 Running migration: $migration"
    npx wrangler d1 execute $DB_NAME --local --file="migrations/$migration" || {
      echo "⚠️  Warning: Failed to run $migration (might already be applied)"
    }
  else
    echo "⚠️  Migration file not found: $migration"
  fi
done

echo "✅ Local database migration completed!"
