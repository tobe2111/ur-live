#!/usr/bin/env bash
# 🛡️ 2026-06-10: products `SELECT *` / `p.*` 영구 차단 (교환권 상세 500 사고 재발 방지).
#
# 사고: products 컬럼 누적이 D1 결과셋 한도(100)를 초과 → `SELECT p.*` 가 조인 시 전부 실패
#       → 교환권/공구 상세 전체 500 (2026-06-10). 컬럼은 계속 늘어나므로 star-select 는 시한폭탄.
# 룰: worker 측 코드에서 products 의 star-select 금지 — `productDetailCols()`
#     (src/shared/db/product-columns.ts) 명시 목록 사용. 새 노출 컬럼은 그 목록에 추가.
# Bypass: commit 메시지 [SKIP_SELECT_STAR_CHECK] (정당 사유 필수).

set -e

TARGETS=(src/features src/worker)
VIOLATIONS=$(grep -rn --include='*.ts' -E "SELECT \* FROM products|SELECT p\.\*|SELECT products\.\*" "${TARGETS[@]}" 2>/dev/null \
  | grep -v -E ':[0-9]+:[[:space:]]*(//|\*)' \
  | grep -v "check-no-select-star" || true)

if [ -n "$VIOLATIONS" ]; then
  echo "❌ products star-select 발견 — D1 컬럼 한도(100) 초과로 런타임 전부 실패합니다:"
  echo "$VIOLATIONS"
  echo ""
  echo "→ productDetailCols('p') (src/shared/db/product-columns.ts) 명시 목록을 사용하세요."
  exit 1
fi

echo "✅ products star-select 없음"
