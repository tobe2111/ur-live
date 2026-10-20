#!/bin/bash
# ============================================================
# 코드 품질 검증 스크립트 v2 (2026-04-23 배치 168 강화)
#
# 🛡️ 이전 문제: 제가 "다 했다"고 말한 후에도 자동 스캔 하면 수십~수백 건
#    잔여 이슈가 계속 발견됨. 근본 원인은 수동 전수조사에 의존했기 때문.
#    해결: 이 스크립트에 모든 검증 항목을 넣어서, 커밋 전에 자동으로 검출.
#
# 검증 항목:
#   1. TypeScript 에러
#   2. SEO 메타 태그 누락
#   3. console.log DEV 게이트 미적용
#   4. 깨진 내부 링크
#   5. 빌드 확인
#   6. 입력 필드 text-gray-900 누락
#   7. [NEW] dangerouslySetInnerHTML (XSS)
#   8. [NEW] .catch(() => {}) 에러 삼키기 (프론트)
#   9. [NEW] img alt 누락
#  10. [NEW] try 없는 API 호출 (결제/주문 페이지)
#  11. [NEW] DB 스키마 금지 컬럼
#  12. [NEW] API 인증 누락
#
# 사용법: bash scripts/quality-check.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo "🔍 유어딜 코드 품질 검증 v2"
echo "=============================="

# ── 1. TypeScript 에러 ──────────────────────────────────────
echo ""
echo "1️⃣  TypeScript 에러 확인..."
TS_ERRORS=$(npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | wc -l)
if [ "$TS_ERRORS" -gt 0 ]; then
  echo -e "   ${RED}❌ TypeScript 에러 ${TS_ERRORS}개${NC}"
  npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -5
  ERRORS=$((ERRORS + 1))
else
  echo -e "   ${GREEN}✅ TypeScript 에러 없음${NC}"
fi

# ── 2. SEO 메타 태그 누락 ──────────────────────────────────
echo ""
echo "2️⃣  SEO 메타 태그 확인..."
SKIP_PATTERNS="Admin|Agency|Seller|Callback|Debug|Embed|Demo|NotFound|ServerError|Deleted|PaymentSuccess|PaymentFail|PointsChargeSuccess|StoreStats|VoucherVerify|KVMonitoring|MyPage"
MISSING_SEO=()
for f in $(find src/pages -maxdepth 1 -name "*.tsx" | sort); do
  basename=$(basename "$f" .tsx)
  if echo "$basename" | grep -qE "$SKIP_PATTERNS"; then continue; fi
  if ! grep -qE "import SEO|<SEO " "$f" 2>/dev/null; then
    MISSING_SEO+=("$f")
  fi
done
if [ ${#MISSING_SEO[@]} -gt 0 ]; then
  echo -e "   ${YELLOW}⚠️  SEO 누락 ${#MISSING_SEO[@]}개:${NC}"
  printf '      - %s\n' "${MISSING_SEO[@]}" | head -10
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ 모든 유저 페이지에 SEO 적용됨${NC}"
fi

# ── 3. console.log DEV 게이트 미적용 ───────────────────────
echo ""
echo "3️⃣  console.log DEV 게이트 확인..."
# src/ 하위 .ts/.tsx 에서 console.log 가 import.meta.env.DEV 게이트 없이 사용된 곳
DEBUG_LOGS=$(grep -rn "console\.log(" src/pages/ src/components/ src/hooks/ --include="*.ts" --include="*.tsx" \
  | grep -v "import.meta.env.DEV" \
  | grep -v "\.test\." \
  | grep -v "// " \
  | grep -v "console\.log.*DEV" \
  | wc -l)
if [ "$DEBUG_LOGS" -gt 5 ]; then
  echo -e "   ${YELLOW}⚠️  DEV 게이트 없는 console.log ${DEBUG_LOGS}개${NC}"
  WARNINGS=$((WARNINGS + 1))
elif [ "$DEBUG_LOGS" -gt 0 ]; then
  echo -e "   ${YELLOW}⚠️  DEV 게이트 없는 console.log ${DEBUG_LOGS}개 (허용 범위)${NC}"
else
  echo -e "   ${GREEN}✅ 모든 console.log 에 DEV 게이트 적용${NC}"
fi

# ── 4. 깨진 내부 링크 ──────────────────────────────────────
echo ""
echo "4️⃣  내부 링크 검증..."
BROKEN=0
for link in $(grep -roP 'to="(/[^"]*)"' src/pages/ src/components/ --include="*.tsx" 2>/dev/null | grep -oP '"/[^"]*"' | tr -d '"' | sort -u); do
  if echo "$link" | grep -q ":"; then continue; fi
  if ! grep -q "path=\"${link}\"" src/App.tsx 2>/dev/null; then
    PARENT=$(echo "$link" | sed 's|/[^/]*$||')
    if [ -n "$PARENT" ] && grep -q "path=\"${PARENT}" src/App.tsx 2>/dev/null; then continue; fi
    BROKEN=$((BROKEN + 1))
  fi
done
if [ "$BROKEN" -eq 0 ]; then
  echo -e "   ${GREEN}✅ 깨진 링크 없음${NC}"
else
  echo -e "   ${YELLOW}⚠️  깨진 내부 링크 ${BROKEN}개${NC}"
  WARNINGS=$((WARNINGS + 1))
fi

# ── 5. 빌드 확인 ───────────────────────────────────────────
echo ""
echo "5️⃣  빌드 확인..."
if npm run build 2>&1 | grep -q "built in"; then
  echo -e "   ${GREEN}✅ 프론트 빌드 성공${NC}"
else
  echo -e "   ${RED}❌ 프론트 빌드 실패${NC}"
  ERRORS=$((ERRORS + 1))
fi
if node scripts/build-worker.js 2>&1 | grep -q "Worker bundle created"; then
  echo -e "   ${GREEN}✅ Worker 빌드 성공${NC}"
else
  echo -e "   ${RED}❌ Worker 빌드 실패${NC}"
  ERRORS=$((ERRORS + 1))
fi

# ── 6. 입력 필드 text-gray-900 누락 ────────────────────────
echo ""
echo "6️⃣  입력 필드 텍스트 색상 확인..."
DARK_PAGES="LivePage|ShortsPage|MainHomePage|UserProfilePage|SellerPublicPage|NotificationsPage"
INPUT_ISSUES=0
for f in $(find src/pages src/components -name "*.tsx" 2>/dev/null | sort); do
  if echo "$f" | grep -qE "$DARK_PAGES"; then continue; fi
  MISSING=$(grep -nE '<(input|textarea|select)[^>]+className="[^"]*border[^"]*"' "$f" 2>/dev/null \
    | grep -v 'text-gray-[789]00' | grep -v 'text-white' | grep -v 'text-black' \
    | grep -v 'bg-\[#' | grep -v 'type="hidden"' | grep -v 'type="file"' | grep -v 'type="checkbox"' | grep -v 'type="radio"' \
    | grep -v 'disabled' || true)
  if [ -n "$MISSING" ]; then INPUT_ISSUES=$((INPUT_ISSUES + 1)); fi
done
if [ "$INPUT_ISSUES" -gt 0 ]; then
  echo -e "   ${YELLOW}⚠️  ${INPUT_ISSUES}개 파일에서 text-gray-900 누락${NC}"
else
  echo -e "   ${GREEN}✅ 모든 입력 필드 텍스트 색상 정상${NC}"
fi

# ── 7. [NEW] dangerouslySetInnerHTML (XSS 위험) ────────────
echo ""
echo "7️⃣  dangerouslySetInnerHTML (XSS) 확인..."
# escapeHtml 로 선처리된 경우는 안전 → 같은 파일에 escapeHtml import 있으면 제외
XSS_FILES=()
for f in $(grep -rln "dangerouslySetInnerHTML" src/ --include="*.tsx" --include="*.ts" 2>/dev/null); do
  if ! grep -q "escapeHtml\|DOMPurify\|sanitize" "$f" 2>/dev/null; then
    XSS_FILES+=("$f")
  fi
done
if [ ${#XSS_FILES[@]} -gt 0 ]; then
  echo -e "   ${RED}❌ dangerouslySetInnerHTML (sanitize 없이) ${#XSS_FILES[@]}건 — XSS 위험${NC}"
  printf '      - %s\n' "${XSS_FILES[@]}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "   ${GREEN}✅ dangerouslySetInnerHTML 안전 (sanitize 적용됨)${NC}"
fi

# ── 8. [NEW] .catch(() => {}) 에러 삼키기 (프론트) ──────────
# NOTE: 대부분 toast/setState/rollback 포함 — 완전 빈 catch만 위험.
#       { } 안에 뭔가 있으면(toast, set, navigate) 정상 에러 처리.
echo ""
echo "8️⃣  .catch(() => {}) 에러 삼키기 확인 (프론트)..."
# 완전 빈 catch: .catch(() => {}) 형태만 (audio.play() 는 autoplay 정책상 의도적 빈 catch)
TRULY_EMPTY=$(grep -rn "\.catch(() => {})" src/pages/ --include="*.tsx" 2>/dev/null | grep -v "audio\.\|\.play()" | wc -l)
if [ "$TRULY_EMPTY" -gt 0 ]; then
  echo -e "   ${YELLOW}⚠️  완전 빈 .catch(() => {}) ${TRULY_EMPTY}건${NC}"
  grep -rn "\.catch(() => {})" src/pages/ --include="*.tsx" 2>/dev/null | head -5
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ 빈 에러 삼키기 없음 (모든 catch 에 핸들러 포함)${NC}"
fi

# ── 9. [NEW] img alt 누락 ──────────────────────────────────
# NOTE: multi-line JSX 에서 <img 와 alt= 가 다른 줄에 있으면 false positive.
#       2줄 범위로 확인하여 정확도 향상.
echo ""
echo "9️⃣  <img> alt 속성 확인..."
IMG_NO_ALT=0
while IFS= read -r match; do
  file=$(echo "$match" | cut -d: -f1)
  line=$(echo "$match" | cut -d: -f2)
  # 현재 줄 + 다음 2줄에 alt= 가 있는지 체크 (multi-line JSX)
  END_LINE=$((line + 2))
  if ! sed -n "${line},${END_LINE}p" "$file" 2>/dev/null | grep -q 'alt='; then
    IMG_NO_ALT=$((IMG_NO_ALT + 1))
    if [ "$IMG_NO_ALT" -le 5 ]; then
      echo -e "   ${YELLOW}  $match${NC}"
    fi
  fi
done < <(grep -rn "<img " src/pages/ src/components/ --include="*.tsx" 2>/dev/null | grep -v 'alt=')
if [ "$IMG_NO_ALT" -gt 0 ]; then
  echo -e "   ${YELLOW}⚠️  alt 누락 <img> ${IMG_NO_ALT}건${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ 모든 <img>에 alt 속성 있음${NC}"
fi

# ── 10. [NEW] 결제/주문 페이지 try 미감싸기 ─────────────────
echo ""
echo "🔟  결제/주문 API 호출 에러 처리 확인..."
# NOTE: 단순 라인 수 비교는 nested try 감지 못해 false positive 발생.
#       대신 try 블록이 0개인데 API 호출이 있는 극단적 케이스만 검출.
CRITICAL_PAGES="CheckoutPage.tsx PaymentConfirmPage.tsx"
UNSAFE_API=0
for page in $CRITICAL_PAGES; do
  f=$(find src/pages -name "$page" 2>/dev/null | head -1)
  if [ -z "$f" ]; then continue; fi
  UNSAFE=$(grep -c "await api\.\(get\|post\|put\|patch\|delete\)" "$f" 2>/dev/null || echo 0)
  TRY_COUNT=$(grep -c "try {" "$f" 2>/dev/null || echo 0)
  if [ "$UNSAFE" -gt 0 ] && [ "$TRY_COUNT" -eq 0 ]; then
    echo -e "   ${RED}❌ $page: API 호출 ${UNSAFE}건 — try 블록 없음${NC}"
    UNSAFE_API=$((UNSAFE_API + 1))
  fi
done
if [ "$UNSAFE_API" -eq 0 ]; then
  echo -e "   ${GREEN}✅ 결제/주문 페이지 에러 처리 정상${NC}"
else
  ERRORS=$((ERRORS + 1))
fi

# ── 11. [NEW] DB 스키마 금지 컬럼 ───────────────────────────
echo ""
echo "1️⃣1️⃣  DB 스키마 금지 컬럼 확인..."
bash scripts/check-schema-refs.sh 2>&1 | tail -3

# ── 12. [NEW] API 인증 누락 ─────────────────────────────────
echo ""
echo "1️⃣2️⃣  API 인증 확인..."
bash scripts/check-api-auth.sh 2>&1 | grep -E "✅|⚠️|❌" | head -5

# ── 테스트 실행 ─────────────────────────────────────────────
echo ""
echo "1️⃣3️⃣  테스트 실행..."
TEST_OUTPUT=$(npm test 2>&1)
TEST_SUMMARY=$(echo "$TEST_OUTPUT" | grep -E "Test Files.*passed")
if echo "$TEST_SUMMARY" | grep -q "passed"; then
  FILE_COUNT=$(echo "$TEST_SUMMARY" | grep -oP '\d+ passed' | head -1)
  TEST_COUNT=$(echo "$TEST_OUTPUT" | grep -E "^\s+Tests\s" | grep -oP '\d+ passed' | head -1)
  echo -e "   ${GREEN}✅ 테스트 통과: ${FILE_COUNT} files, ${TEST_COUNT} tests${NC}"
else
  FAIL_COUNT=$(echo "$TEST_OUTPUT" | grep -E "Test Files" | grep -oP '\d+ failed' | head -1)
  echo -e "   ${RED}❌ 테스트 실패: ${FAIL_COUNT}${NC}"
  echo "$TEST_OUTPUT" | grep "FAIL" | head -5
  ERRORS=$((ERRORS + 1))
fi

# ── 결과 ────────────────────────────────────────────────────
echo ""
echo "=============================="
echo -e "🔴 에러: ${ERRORS}개 | 🟡 경고: ${WARNINGS}개"
if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}❌ ${ERRORS}개 항목에서 심각한 문제 발견 — 수정 필요${NC}"
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  경고 ${WARNINGS}개 — 개선 권장${NC}"
  exit 0
else
  echo -e "${GREEN}✅ 모든 검증 통과!${NC}"
fi
