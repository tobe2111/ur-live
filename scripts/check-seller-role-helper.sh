#!/bin/bash
# 🛡️ 2026-05-21 Phase D-5: 셀러 role 직접 비교 자동 차단.
#
# 룰: seller_type === 'influencer' / 'store_owner' / 'both' 직접 비교 금지.
#     항상 isInfluencer() / isStoreOwner() helper 사용.
#
# Bypass: 커밋 메시지에 [SKIP_ROLE_CHECK]

set -e

staged=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null \
  | grep -E '\.(ts|tsx)$' \
  | grep -v 'node_modules/\|dist/\|\.test\.' \
  || true)

if [ -z "$staged" ]; then exit 0; fi

# 마스터 파일 자체 + 테스트는 제외
EXCLUDE="src/shared/seller-roles\.ts|scripts/|src/worker/routes/repair-schema\.routes\.ts|src/features/seller/api/seller-registration\.routes\.ts"

violations=""
for f in $staged; do
  [ -f "$f" ] || continue
  if echo "$f" | grep -qE "$EXCLUDE"; then continue; fi

  # `seller_type === 'xxx'` / `sellerType === 'xxx'` / `type === 'influencer'` 패턴
  matches=$(grep -nE "(seller_type|sellerType)\s*={2,3}\s*['\"](influencer|store_owner|both)['\"]" "$f" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    violations="$violations\n[$f]\n$matches"
  fi
done

if [ -n "$violations" ]; then
  echo ""
  echo "❌ seller_type 직접 비교 발견 — 영구 helper 사용 필수:"
  echo -e "$violations"
  echo ""
  echo "  🔧 해결:"
  echo "     import { isInfluencer, isStoreOwner } from '@/shared/seller-roles'"
  echo "     if (isInfluencer(sellerType)) { ... }"
  echo ""
  echo "  ⚡ Bypass (정당 사유): commit message 에 [SKIP_ROLE_CHECK]"
  echo ""
  exit 1
fi

exit 0
