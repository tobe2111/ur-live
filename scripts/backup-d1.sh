#!/bin/bash
# 🛡️ 2026-05-07: D1 정기 백업 스크립트
#
# 사용법:
#   ./scripts/backup-d1.sh                    # 로컬 백업 디렉터리에 SQL dump
#   ./scripts/backup-d1.sh --upload-r2        # R2 버킷에 업로드 (R2_BUCKET 환경변수 필요)
#
# crontab 예시 (매일 자정):
#   0 0 * * * cd /path/to/ur-live && ./scripts/backup-d1.sh
#
# Cloudflare 자동 백업 활성화 권장:
#   - Dashboard → Workers & Pages → D1 → ur-live-db → Backups → Enable scheduled backups
#   - 30일 보존 (free tier) / 90일 (paid)
# 이 스크립트는 보조 백업 — Cloudflare 자체 backup 우선.

set -euo pipefail

DB_NAME="${DB_NAME:-ur-live-db}"
BACKUP_DIR="${BACKUP_DIR:-./backups/d1}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}-${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo "🔄 D1 백업 시작: $DB_NAME → $BACKUP_FILE"

# 핵심 테이블만 export (전체 export 는 큰 DB 에서 시간 오래 걸림)
CRITICAL_TABLES=(
  "users"
  "sellers"
  "agencies"
  "admins"
  "products"
  "orders"
  "order_items"
  "live_streams"
  "settlements"
  "donations"
  "deal_charges"
  "deal_balance"
  "seller_status_history"
  "agency_status_history"
  "audit_logs"
)

# Wrangler D1 export
npx wrangler@3 d1 export "$DB_NAME" --remote --output "$BACKUP_FILE" \
  --table "${CRITICAL_TABLES[@]/#/--table=}" 2>&1 | tail -20 || {
  echo "⚠️ wrangler export 실패. 전체 schema dump 시도..."
  npx wrangler@3 d1 export "$DB_NAME" --remote --output "$BACKUP_FILE" 2>&1 | tail -20
}

if [ -f "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ 백업 완료: $BACKUP_FILE ($SIZE)"

  # 30일 이상 된 백업 자동 정리
  find "$BACKUP_DIR" -name "${DB_NAME}-*.sql" -mtime +30 -delete 2>/dev/null || true
  echo "🧹 30일 이상 된 백업 정리 완료"

  # R2 업로드 (옵션)
  if [ "${1:-}" = "--upload-r2" ] && [ -n "${R2_BUCKET:-}" ]; then
    echo "📤 R2 버킷에 업로드: $R2_BUCKET"
    npx wrangler@3 r2 object put "${R2_BUCKET}/d1-backups/${DB_NAME}-${TIMESTAMP}.sql" \
      --file "$BACKUP_FILE" --remote
  fi
else
  echo "❌ 백업 파일 생성 실패"
  exit 1
fi
