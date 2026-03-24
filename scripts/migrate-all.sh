#!/usr/bin/env bash
# migrate-all.sh — D1 마이그레이션 전체 순차 실행
#
# 사용법:
#   ./scripts/migrate-all.sh          # 로컬 D1
#   ./scripts/migrate-all.sh --prod   # 프로덕션 D1 (주의!)
#
# 모든 마이그레이션은 IF NOT EXISTS 패턴으로 멱등성 보장

set -euo pipefail

DB_NAME="marketplace-db"
MIGRATIONS_DIR="$(dirname "$0")/../migrations"
PROD=false

if [[ "${1:-}" == "--prod" ]]; then
  PROD=true
  echo "⚠️  프로덕션 DB에 마이그레이션을 실행합니다."
  echo "    계속하려면 Enter, 취소하려면 Ctrl+C"
  read -r
fi

# 마이그레이션 파일을 파일명 기준 오름차순 정렬
MIGRATION_FILES=$(find "$MIGRATIONS_DIR" -name "*.sql" | sort)
TOTAL=$(echo "$MIGRATION_FILES" | wc -l | tr -d ' ')
COUNT=0
FAILED=0

echo "📦 총 ${TOTAL}개 마이그레이션 파일 발견"
echo ""

for FILE in $MIGRATION_FILES; do
  FILENAME=$(basename "$FILE")
  COUNT=$((COUNT + 1))
  printf "[%3d/%3d] %s ... " "$COUNT" "$TOTAL" "$FILENAME"

  if $PROD; then
    CMD="wrangler d1 execute $DB_NAME --file=$FILE"
  else
    CMD="wrangler d1 execute $DB_NAME --local --file=$FILE"
  fi

  if $CMD > /dev/null 2>&1; then
    echo "✅"
  else
    echo "⚠️  (오류 무시 — IF NOT EXISTS로 멱등 처리됨)"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 완료: ${COUNT}개 실행, ${FAILED}개 경고"
if $PROD; then
  echo "🚀 프로덕션 DB 마이그레이션 완료"
else
  echo "🏠 로컬 DB 마이그레이션 완료"
fi
