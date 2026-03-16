#!/usr/bin/env bash
# ============================================================
# validate-routes.sh — Route 자동 검증 스크립트 (Shell 버전)
# ============================================================
# 실행: npm run validate:routes
#        또는 bash scripts/validate-routes.sh
#
# CI에서는 .github/workflows/main.yml 의 validate-routes job이 동일한 검사를 수행함
# ============================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

error()   { echo -e "${RED}✖ ERROR${NC} $*"; ((ERRORS++)) || true; }
warn()    { echo -e "${YELLOW}⚠ WARN${NC}  $*"; ((WARNINGS++)) || true; }
ok()      { echo -e "${GREEN}✔ OK${NC}    $*"; }
info()    { echo -e "${CYAN}ℹ${NC}       $*"; }

echo -e "${BOLD}${CYAN}"
echo "╔══════════════════════════════════════════════╗"
echo "║   ur-live Route Validation Script v1.0       ║"
echo "╚══════════════════════════════════════════════╝${NC}"

# ── Check 1: Fullpath Hardcoding ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}[Check 1] Fullpath Hardcoding in routes files${NC}"

VIOLATIONS=$(grep -rn "\.\(get\|post\|put\|patch\|delete\|all\)('/api/" \
  src/features/ src/worker/routes/ \
  --include="*.ts" \
  2>/dev/null \
  | grep -v "push\.routes" \
  | grep -v "^\s*//" \
  || true)

if [ -n "$VIOLATIONS" ]; then
  error "Fullpath hardcoding detected:"
  echo "$VIOLATIONS" | while IFS= read -r line; do
    info "  $line"
  done
  info "  Fix: routes 파일 내부에서 '/api/xxx' 대신 상대경로 '/'를 사용하세요"
else
  ok "No fullpath hardcoding"
fi

# ── Check 2: Duplicate Route Registrations ────────────────────────────────────
echo ""
echo -e "${BOLD}[Check 2] Duplicate app.route() registrations${NC}"

ALLOWED_DUPS="^(/api/orders|/api/payments|/api/seller|/api/admin|/api/auth/kakao|/api/products)$"
DUPS=$(grep "app\.route(" src/worker/index.ts \
  | grep -oP "'\K[^']+" \
  | grep "^/api" \
  | sort | uniq -d \
  | grep -Evx "$ALLOWED_DUPS" \
  || true)

if [ -n "$DUPS" ]; then
  error "Unexpected duplicate route registration:"
  echo "$DUPS" | while IFS= read -r dup; do
    info "  '$dup' — 동일 prefix 이중 등록 금지"
  done
else
  ok "No unexpected duplicate registrations"
fi

# ── Check 3: Frontend-Backend mismatch ────────────────────────────────────────
echo ""
echo -e "${BOLD}[Check 3] Frontend ↔ Backend path mismatch${NC}"

BACKEND=$(grep "app\.route(" src/worker/index.ts \
  | grep -oP "'\K[^']+" \
  | grep "^/api" \
  | sort -u)

FRONTEND=$(grep -rh \
  "api\.\(get\|post\|put\|patch\|delete\)\|axios\.\(get\|post\|put\|patch\|delete\)" \
  src/pages/ src/components/ src/hooks/ src/shared/ \
  --include="*.ts" --include="*.tsx" \
  2>/dev/null \
  | grep -oP "'/api/[a-zA-Z0-9_\-/]+" \
  | tr -d "'" \
  | sort -u \
  || true)

MISSING=""
while IFS= read -r fpath; do
  [ -z "$fpath" ] && continue
  [[ "$fpath" == /api/debug* ]] && continue  # intentional skip

  COVERED=false
  while IFS= read -r prefix; do
    [ -z "$prefix" ] && continue
    if [[ "$fpath" == "$prefix"* ]]; then
      COVERED=true
      break
    fi
  done <<< "$BACKEND"

  if [ "$COVERED" = false ]; then
    MISSING="${MISSING}\n  $fpath"
  fi
done <<< "$FRONTEND"

if [ -n "$MISSING" ]; then
  warn "Frontend paths with no matching backend prefix:"
  echo -e "$MISSING"
  info "  These paths will return 404 — register in src/worker/index.ts"
else
  ok "All frontend paths have matching backend prefixes"
fi

# ── Check 4: Legacy .js route files ──────────────────────────────────────────
echo ""
echo -e "${BOLD}[Check 4] Legacy .js route files${NC}"

JSFILES=$(find src/worker/ src/features/ \
  -name "*.routes.js" -o -name "index.js" \
  2>/dev/null \
  | grep -v node_modules \
  | grep -v dist \
  || true)

if [ -n "$JSFILES" ]; then
  warn "Legacy .js files found (Wrangler uses index.ts, these cause confusion):"
  echo "$JSFILES" | while IFS= read -r f; do
    info "  $f"
  done
  info "  Fix: src/worker/index.js 및 routes/*.js 파일 삭제를 권장합니다"
else
  ok "No legacy .js route files"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}── Summary ──────────────────────────────────────${NC}"

if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}${BOLD}✖ $ERRORS error(s) — 배포 전 반드시 수정하세요${NC}"
  exit 1
else
  echo -e "${GREEN}${BOLD}✔ No errors${NC}"
fi

if [ "$WARNINGS" -gt 0 ]; then
  echo -e "${YELLOW}⚠ $WARNINGS warning(s) — 검토를 권장합니다${NC}"
fi

exit 0
