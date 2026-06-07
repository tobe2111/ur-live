#!/bin/bash
# check-proposal-sync.sh — 비즈니스 코드 변경 시 소개서(docs/proposals/) prose 업데이트 권고.
#
# docs/proposals/ 의 5개 소개서 + 마스터 커버리지 문서의 "자동 동기화" 블록은
# scripts/generate-proposal-refs.mjs 가 코드에서 수치/인벤토리를 자동 갱신한다(pre-commit 자동).
# 단, 소개서의 **설명 문장(prose)** 까지 자동 갱신되지는 않으므로, 해당 도메인의 비즈니스
# 로직이 바뀌면 사람이 prose 도 손봐야 할 수 있다. 이 스크립트는 어떤 소개서가 영향받는지 알린다.
#
# 도메인 → 코드 매핑:
#   도매몰          ← src/features/supply/api/** + admin-suppliers / admin-products(공급자 검수) bits
#   오프라인 공구    ← src/features/group-buy/** + community-group-buy + stays + appointments + hosting
#   온라인 입점     ← products / orders / youtube-live / multi-platform / cafe24 / shorts / streaming
#   링크샵          ← SellerPublicPage / curator / referral / affiliate / donations
#   에이전시        ← src/features/agency/** + casting + pk-battles
#   (전 도메인)     ← src/shared/constants/policy.ts + src/worker/utils/tax-withholding.ts
#
# WARN-ONLY — 절대 커밋을 차단하지 않음. (호출처에서 `|| true`.)
#
# 사용:
#   bash scripts/check-proposal-sync.sh

set -e

PROPOSAL_DIR="docs/proposals"

# Get staged changes (or HEAD diff if not in pre-commit context)
if git diff --cached --quiet 2>/dev/null; then
  staged=$(git diff --name-only HEAD~1..HEAD 2>/dev/null || true)
else
  staged=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true)
fi

if [ -z "$staged" ]; then
  exit 0
fi

briefs=""

# ── 도매몰 ──
if echo "$staged" | grep -qE '^src/features/supply/api/|^src/features/admin/api/admin-suppliers|^src/features/admin/api/admin-products|^src/lib/distributor-pricing\.ts|^src/pages/.*(Wholesale|Supplier|Distributor)'; then
  briefs="$briefs wholesale-mall-brief.md"
fi

# ── 오프라인 공구 / 동네딜 ──
if echo "$staged" | grep -qE '^src/features/(group-buy|community-group-buy|appointments|hosting|funding|restaurant-map|restaurant-suggestions)/|^src/features/seller/api/.*[Ss]tays'; then
  briefs="$briefs offline-groupbuy-brief.md"
fi

# ── 온라인 입점 / 라이브커머스 ──
if echo "$staged" | grep -qE '^src/features/(products|orders|cart|shipping|returns|shorts|streaming|timedeal|auction|multi-platform|cafe24|youtube|youtube-growth)/|^src/features/seller/api/.*[Yy]outube|youtube-live'; then
  briefs="$briefs online-listing-proposal-brief.md"
fi

# ── 링크샵 / 큐레이터 ──
if echo "$staged" | grep -qE '^src/features/(curator|seller-public|referral|affiliate|donations)/|SellerPublicPage|^src/pages/.*[Ll]inkshop'; then
  briefs="$briefs linkshop-brief.md"
fi

# ── 에이전시 ──
if echo "$staged" | grep -qE '^src/features/(agency|casting)/|pk-battles|^src/pages/Agency'; then
  briefs="$briefs agency-brief.md"
fi

# ── 정책 SSOT / 세금 — 전 소개서 영향 ──
if echo "$staged" | grep -qE '^src/shared/constants/policy\.ts$|^src/worker/utils/tax-withholding\.ts$'; then
  briefs="$briefs wholesale-mall-brief.md offline-groupbuy-brief.md online-listing-proposal-brief.md linkshop-brief.md agency-brief.md 00-service-overview-and-coverage.md"
fi

briefs=$(echo "$briefs" | tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' ')

if [ -z "$briefs" ]; then
  exit 0
fi

echo ""
echo "📑 소개서 동기화 점검 (warn-only)"
echo "================================="
echo "비즈니스 코드 변경이 다음 소개서의 설명(prose)에 영향을 줄 수 있습니다:"
echo ""
for b in $briefs; do
  echo "  📘 ${PROPOSAL_DIR}/${b}"
done
echo ""
echo "💡 수치/인벤토리 블록은 'npm run generate:proposal-refs' 로 자동 갱신됩니다(pre-commit 자동)."
echo "   설명 문장(가격 모델/플로우 서술 등)이 바뀌었다면 직접 prose 도 손봐주세요."
echo ""
echo "💡 경고만 표시함 (커밋 진행)."
exit 0
