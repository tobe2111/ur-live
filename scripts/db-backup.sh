#!/bin/bash
# D1 Database backup via Wrangler
# Usage: bash scripts/db-backup.sh
# Requires: wrangler CLI authenticated

set -e

DB_NAME="ur-live-db"
BACKUP_DIR="backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

echo "Backing up D1 database: $DB_NAME"

# Export tables
for table in users sellers orders order_items products vouchers referral_tree referral_commissions community_group_buys; do
  echo "  Exporting $table..."
  npx wrangler d1 execute $DB_NAME --command "SELECT * FROM $table" --json > "$BACKUP_DIR/${table}_${DATE}.json" 2>/dev/null || echo "  Warning: $table skipped (may not exist)"
done

echo "Backup completed: $BACKUP_DIR/*_${DATE}.json"
echo "Files:"
ls -lh $BACKUP_DIR/*_${DATE}.json 2>/dev/null
