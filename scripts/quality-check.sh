#!/bin/bash
# ============================================================
# 코드 품질 검증 스크립트
# 새 페이지 생성/수정 후 실행하여 누락 확인
# 사용법: bash scripts/quality-check.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0

echo "🔍 유어딜 코드 품질 검증"
echo "========================="

# 1. TypeScript 에러
echo ""
echo "1️⃣  TypeScript 에러 확인..."
TS_ERRORS=$(npx tsc --noEmit 2>&1 | grep "error TS" | wc -l)
if [ "$TS_ERRORS" -gt 0 ]; then
  echo -e "   ${RED}❌ TypeScript 에러 ${TS_ERRORS}개${NC}"
  npx tsc --noEmit 2>&1 | grep "error TS" | head -5
  ERRORS=$((ERRORS + 1))
else
  echo -e "   ${GREEN}✅ TypeScript 에러 없음${NC}"
fi

# 2. SEO 메타 태그 누락
echo ""
echo "2️⃣  SEO 메타 태그 확인..."
SKIP_PATTERNS="Admin|Agency|Seller|Callback|Debug|Embed|Demo|NotFound|ServerError|Deleted"
MISSING_SEO=()
for f in $(find src/pages -name "*.tsx" | sort); do
  basename=$(basename "$f" .tsx)
  if echo "$basename" | grep -qE "$SKIP_PATTERNS"; then
    continue
  fi
  if ! grep -qE "import SEO|<SEO " "$f" 2>/dev/null; then
    MISSING_SEO+=("$f")
  fi
done

if [ ${#MISSING_SEO[@]} -gt 0 ]; then
  echo -e "   ${YELLOW}⚠️  SEO 누락 ${#MISSING_SEO[@]}개:${NC}"
  for f in "${MISSING_SEO[@]}"; do
    echo "      - $f"
  done
  ERRORS=$((ERRORS + 1))
else
  echo -e "   ${GREEN}✅ 모든 유저 페이지에 SEO 적용됨${NC}"
fi

# 3. 디버그 console.log
echo ""
echo "3️⃣  디버그 console.log 확인..."
DEBUG_LOGS=$(grep -rn "console\.log(" src/pages/ src/components/ --include="*.tsx" | grep -v "DEV\|import.meta\|DEBUG\|catch\|\.catch" | wc -l)
if [ "$DEBUG_LOGS" -gt 0 ]; then
  echo -e "   ${YELLOW}⚠️  프로덕션 console.log ${DEBUG_LOGS}개${NC}"
  grep -rn "console\.log(" src/pages/ src/components/ --include="*.tsx" | grep -v "DEV\|import.meta\|DEBUG\|catch\|\.catch" | head -5
  ERRORS=$((ERRORS + 1))
else
  echo -e "   ${GREEN}✅ 디버그 로그 없음${NC}"
fi

# 4. 깨진 내부 링크
echo ""
echo "4️⃣  내부 링크 검증..."
BROKEN=0
for link in $(grep -roP 'to="(/[^"]*)"' src/pages/ src/components/ --include="*.tsx" | grep -oP '"/[^"]*"' | tr -d '"' | sort -u); do
  # 동적 경로 (:id 등) 무시
  if echo "$link" | grep -q ":"; then continue; fi
  # App.tsx에 라우트 존재 확인
  if ! grep -q "path=\"${link}\"" src/App.tsx 2>/dev/null; then
    # 하위 경로 매칭 시도 (예: /seller/products → /seller 라우트 존재)
    PARENT=$(echo "$link" | grep -oP '^/[^/]+')
    if ! grep -q "path=\"${link}\"" src/App.tsx 2>/dev/null; then
      echo -e "   ${RED}❌ 깨진 링크: ${link}${NC}"
      BROKEN=$((BROKEN + 1))
    fi
  fi
done
if [ "$BROKEN" -eq 0 ]; then
  echo -e "   ${GREEN}✅ 깨진 링크 없음${NC}"
else
  ERRORS=$((ERRORS + 1))
fi

# 5. 빌드
echo ""
echo "5️⃣  빌드 확인..."
if npm run build 2>&1 | grep -q "✓ built"; then
  echo -e "   ${GREEN}✅ 빌드 성공${NC}"
else
  echo -e "   ${RED}❌ 빌드 실패${NC}"
  ERRORS=$((ERRORS + 1))
fi

# 결과
echo ""
echo "========================="
if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}❌ ${ERRORS}개 항목에서 문제 발견${NC}"
  exit 1
else
  echo -e "${GREEN}✅ 모든 검증 통과!${NC}"
fi
