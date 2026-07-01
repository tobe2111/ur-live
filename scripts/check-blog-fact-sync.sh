#!/bin/bash
# check-blog-fact-sync.sh — 핵심 "사실(fact)" 수치가 바뀌면 블로그 시드도 함께 고치라고 경고.
#
# 배경 (2026-07-01): 블로그 재유입 가드(check-blog-seed-currency)는 폐기 "용어"만 잡는다.
#   그러나 블로그 글은 수수료 5% · 원천징수 3.3% · 딜포인트(1원=1딜) · 최소후원 500딜 같은
#   "수치 사실"도 서술한다. 이 SSOT 가 코드에서 바뀌었는데 블로그 시드를 안 고치면
#   라이브 블로그가 틀린 숫자를 계속 노출한다(denylist 로는 못 잡음).
#
# 룰: 아래 fact SSOT 파일이 (수치 관련 라인에서) 변경됐는데
#   src/features/blog/api/blog.routes.ts 가 같은 커밋에 없으면 경고.
#
# 기본 warn-only. STRICT_BLOG_FACT=1 이면 차단. 사소 변경이면 커밋 메시지에 'blog-fact-ok'.

set -e

BLOG_FILE="src/features/blog/api/blog.routes.ts"

# fact SSOT 파일 (블로그가 서술하는 수치의 출처)
FACT_FILES=(
  "src/worker/utils/tax-withholding.ts"   # 원천징수율 (3.3% 등)
  "src/worker/utils/fee-resolver.ts"      # 플랫폼 수수료 (commission_rate_default 5%)
  "src/features/points/api/points.routes.ts"  # 딜포인트 / 최소후원(500딜)
)
# 수치 관련 신호 (노이즈 축소용 — 이 키워드가 변경 라인에 있어야 트리거)
KEYWORDS='commission|withhold|원천징수|수수료|rate|pct|percent|deal|딜|point|포인트|500|3\.3|8\.8|min'

# staged (pre-commit) 우선, 없으면 마지막 커밋
if git diff --cached --quiet 2>/dev/null; then
  staged=$(git diff --name-only HEAD~1..HEAD 2>/dev/null || true)
  DIFF_REF="HEAD~1..HEAD"
else
  staged=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true)
  DIFF_REF="--cached"
fi

[ -z "$staged" ] && exit 0

# 블로그 시드가 이미 같이 변경됐으면 OK
if echo "$staged" | grep -q "^${BLOG_FILE}$"; then
  echo "✅ 블로그 fact 동기화 OK (${BLOG_FILE} 함께 변경됨)"
  exit 0
fi

hits=""
for f in "${FACT_FILES[@]}"; do
  echo "$staged" | grep -q "^${f}$" || continue
  # 변경된 라인(+/-)에 수치 키워드가 있는지 확인 → 순수 리팩토링/포맷 노이즈 제외
  changed=$(git diff $DIFF_REF -- "$f" 2>/dev/null | grep -E '^[+-]' | grep -vE '^[+-]{3}' | grep -iE "$KEYWORDS" || true)
  [ -n "$changed" ] && hits="$hits $f"
done

hits=$(echo "$hits" | tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' ')
[ -z "$hits" ] && exit 0

echo ""
echo "⚠️  블로그 시드 fact 업데이트 누락 의심"
echo "================================="
echo "핵심 수치 SSOT 가 변경됐는데 블로그 시드(${BLOG_FILE})는 안 바뀌었습니다:"
for f in $hits; do echo "  - $f"; done
echo ""
echo "블로그 글에 수수료율/원천징수/딜포인트/최소후원 등이 서술돼 있으면 시드도 고치고"
echo "  BLOG_SEED_VERSION 을 +1 하세요(안 올리면 라이브 블로그가 옛 숫자를 계속 노출)."
echo "사소 변경이라 블로그 영향 없으면 커밋 메시지에 'blog-fact-ok' 추가."
echo ""

if [ "$STRICT_BLOG_FACT" = "1" ]; then
  echo "❌ STRICT_BLOG_FACT=1 — 커밋 차단"
  exit 1
fi
echo "💡 경고만 표시함 (커밋 진행)."
exit 0
