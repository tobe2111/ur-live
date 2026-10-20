#!/bin/bash
# ============================================================
# API 엔드포인트 인증 누락 검출 스크립트
# POST/PATCH/DELETE 라우트에 인증 미들웨어가 빠진 것을 찾아냅니다.
# 사용법: bash scripts/check-api-auth.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

# 검사 대상 디렉토리
SEARCH_PATHS=""
for p in worker/ src/worker/ src/api/ functions/; do
  if [ -d "$p" ]; then
    SEARCH_PATHS="$SEARCH_PATHS $p"
  fi
done

if [ -z "$SEARCH_PATHS" ]; then
  echo "No API source directories to scan"
  exit 0
fi

EXCLUDE_GLOBS=(
  "--exclude-dir=node_modules"
  "--exclude-dir=dist"
  "--exclude-dir=.wrangler"
)

# 인증 함수/미들웨어 키워드
AUTH_KEYWORDS='requireAuth|requireSeller|requireAdmin|requireAgency|authMiddleware|verifyToken|authenticate|verifySession|requireUser'

echo "🔍 API 엔드포인트 인증 검사"
echo "================================="

# 1) POST/PATCH/PUT/DELETE 핸들러에서 인증 미들웨어 미참조 경고
echo ""
echo "1️⃣  변경성(POST/PATCH/PUT/DELETE) 핸들러 인증 미들웨어 확인..."

# 파일 단위로 훑으며 변경성 라우트가 있지만 인증 키워드를 사용하지 않는 경우 경고
SUSPECT_FILES=()
while IFS= read -r -d '' f; do
  # 라우트 메서드 사용 여부
  if grep -qE "\.(post|patch|put|delete)\s*\(" "$f" 2>/dev/null; then
    # 인증 키워드 사용 여부
    if ! grep -qE "$AUTH_KEYWORDS" "$f" 2>/dev/null; then
      # public/webhook 등 허용 파일은 기본 패턴으로 제외
      basename_f=$(basename "$f")
      if echo "$basename_f" | grep -qiE "webhook|public|callback|healthcheck|toss|stripe|debug-schema"; then
        continue
      fi
      SUSPECT_FILES+=("$f")
    fi
  fi
done < <(find $SEARCH_PATHS -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" ! -path "*/dist/*" -print0)

if [ ${#SUSPECT_FILES[@]} -gt 0 ]; then
  echo -e "   ${YELLOW}⚠️  인증 미들웨어가 참조되지 않는 변경성 라우트 파일 ${#SUSPECT_FILES[@]}개${NC}"
  for f in "${SUSPECT_FILES[@]}"; do
    echo "      - $f"
  done
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ 모든 변경성 라우트가 인증 미들웨어를 참조${NC}"
fi

# 2) debug-* 엔드포인트 프로덕션 포함 검사
echo ""
echo "2️⃣  debug-* 엔드포인트 검사..."
# 실제 라우트 등록 패턴만 매칭: .get('/debug-...'), .post('/debug-...') 등 또는 path: '/debug-...'
DEBUG_HITS=$(grep -rnE "\.(get|post|put|patch|delete)\s*\(\s*['\"]/?(debug|debug-[a-z-]+)" $SEARCH_PATHS "${EXCLUDE_GLOBS[@]}" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -vE "DEV|import\.meta|env\.DEV|NODE_ENV" || true)
if [ -n "$DEBUG_HITS" ]; then
  DEBUG_COUNT=$(echo "$DEBUG_HITS" | wc -l)
  echo -e "   ${RED}❌ DEV 가드 없는 debug 엔드포인트 ${DEBUG_COUNT}개${NC}"
  echo "$DEBUG_HITS" | head -5 | sed 's/^/      /'
  ERRORS=$((ERRORS + 1))
else
  echo -e "   ${GREEN}✅ DEV 가드 없는 debug 엔드포인트 없음${NC}"
fi

# 3) .catch(() => {}) 완전 무시 패턴
echo ""
echo "3️⃣  에러 삼키기(.catch(() => {})) 검사..."
SWALLOW_HITS=$(grep -rnE "\.catch\(\(\s*[a-zA-Z_]*\s*\)\s*=>\s*\{\s*\}\)|\.catch\(\(\)\s*=>\s*\{\s*\}\)" $SEARCH_PATHS "${EXCLUDE_GLOBS[@]}" --include="*.ts" --include="*.tsx" 2>/dev/null || true)
if [ -n "$SWALLOW_HITS" ]; then
  SWALLOW_COUNT=$(echo "$SWALLOW_HITS" | wc -l)
  echo -e "   ${YELLOW}⚠️  에러 삼키기 패턴 ${SWALLOW_COUNT}개${NC}"
  echo "$SWALLOW_HITS" | head -5 | sed 's/^/      /'
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ 에러 삼키기 패턴 없음${NC}"
fi

# 4) Idempotency-Key 누락 검사 (Toss API 호출 시)
echo ""
echo "4️⃣  Toss API 호출 Idempotency-Key 검사..."
# v36 (2026-04-27): 정밀도 개선 — 변경성(POST/PATCH/PUT) 토스 fetch 만 검출.
# - GET 호출은 idempotent (자체적으로) — 제외.
# - type 정의 파일 또는 단순 환경변수 체크는 제외 (실제 fetch 코드만).
# - utils/toss-payments.ts 같은 helper 함수는 내부에 Idempotency-Key 있어서 자동 적용됨.
TOSS_FILES=$(grep -rlE "fetch\(.*TOSS_PAYMENT_URL.*payments|fetch\(.*api\.tosspayments\.com.*v1/payments" $SEARCH_PATHS "${EXCLUDE_GLOBS[@]}" --include="*.ts" --include="*.tsx" 2>/dev/null || true)
MISSING_IDEMP=()
if [ -n "$TOSS_FILES" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    # POST/PATCH/PUT 메소드 호출이 있는데 Idempotency-Key 없으면 경고
    if grep -qE "method:\s*['\"](POST|PATCH|PUT)['\"]" "$f" 2>/dev/null; then
      if ! grep -qi "Idempotency-Key" "$f" 2>/dev/null; then
        MISSING_IDEMP+=("$f")
      fi
    fi
  done <<< "$TOSS_FILES"
fi
if [ ${#MISSING_IDEMP[@]} -gt 0 ]; then
  echo -e "   ${YELLOW}⚠️  Idempotency-Key 미사용 Toss 호출 파일 ${#MISSING_IDEMP[@]}개${NC}"
  for f in "${MISSING_IDEMP[@]}"; do
    echo "      - $f"
  done
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ Toss API 호출 모두 Idempotency-Key 사용 (또는 해당 없음)${NC}"
fi

echo ""
echo "================================="
if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}❌ 치명적 문제 ${ERRORS}개 (경고 ${WARNINGS}개)${NC}"
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  경고 ${WARNINGS}개 — 확인 필요${NC}"
  exit 0
else
  echo -e "${GREEN}✅ API 인증/보안 문제 없음${NC}"
  exit 0
fi
