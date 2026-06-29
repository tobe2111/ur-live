#!/usr/bin/env bash
# 🛡️ AUDIT GATE (2026-06-26) — 감사 불변식(invariant) 한 방 점검.
#
#   목적(대표 지시 "이상적이면 이후 감사에선 보지 않고 넘어갈 수 있도록 환경 설정"):
#   한 번 깨끗하다고 확인된 영역의 불변식을 결정론적 가드로 박아 **기계가 지키게** 한다.
#   미래 세션은 수동 전수감사 대신 이 게이트를 돌려, GREEN 영역은 가드를 신뢰하고 재감사를 *건너뛴다*.
#   레지스트리/스킵 규칙: docs/AUDIT_INVARIANTS.md.
#
#   사용:  bash scripts/audit-gate.sh          # 전체 도메인
#          bash scripts/audit-gate.sh money     # 특정 도메인만
#   종료코드: 하나라도 RED 면 1 (CI/스킵 판단용).
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

ONLY="${1:-all}"
PASS=0; FAIL=0; FAILED_LIST=()

run() { # run <label> <command...>
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf '   \033[0;32m✓\033[0m %s\n' "$label"; PASS=$((PASS+1))
  else
    printf '   \033[0;31m✗\033[0m %s\n' "$label"; FAIL=$((FAIL+1)); FAILED_LIST+=("$label")
  fi
}

domain() { [ "$ONLY" = "all" ] || [ "$ONLY" = "$1" ]; }

echo "🛡️  AUDIT GATE — 불변식 점검 (GREEN = 재감사 스킵 가능)"
echo "────────────────────────────────────────────────────"

if domain separation; then
  echo "🧱 서비스 분리 (도매몰 ↔ 유어딜 공구)"
  run "대시보드 교차역할 API 격리"        env STRICT_CROSSROLE=1        node scripts/check-dashboard-api-crossrole.mjs
  run "도매 어드민 API 스코프"            env STRICT_API_SCOPE=1        node scripts/check-wholesale-admin-api-scope.mjs
  run "도매 어드민 nav 도달성"           env STRICT_NAV_REACH=1        node scripts/check-wholesale-admin-nav-reachability.mjs
  run "소비자 상품 도매 원본 격리"        env STRICT_SUPPLY_ISOLATION=1 node scripts/check-consumer-product-supply-isolation.mjs
fi

if domain auth; then
  echo "🔐 인증 · 세션 · RBAC"
  run "듀얼로그인 read-guard"            env STRICT_DUAL_LOGIN=1       node scripts/check-dual-login-guard.mjs
  run "로그인 세션 공존 write-guard"      env STRICT_LOGIN_COEXIST=1    node scripts/check-dashboard-login-session-coexist.mjs
  run "OAuth 쿠키 iOS 영속 패턴"         bash scripts/check-auth-cookie-pattern.sh
  run "라이트 입력 가시성"               env STRICT_LIGHT_INPUT=1      node scripts/check-light-input-guard.mjs
  run "내부 링크 dead-link"             env STRICT_LINKS=1            node scripts/check-internal-links.mjs
  run "API 인증 누락"                   bash scripts/check-api-auth.sh
  run "가격기반 로그인 유도 금지"         env STRICT_LOGIN_GATE=1       node scripts/check-login-gate-by-price.mjs
  run "도매 자동재로그인 억제(로그아웃)"   env STRICT_WHS_AUTOLOGIN=1    node scripts/check-wholesale-autologin-guarded.mjs
  run "도매 로그인 SPA 이동(속도)"        env STRICT_LOGIN_SPA=1        node scripts/check-wholesale-login-spa-navigate.mjs
  run "도매 엣지캐시 인증 누수"            env STRICT_CACHE_AUTH=1       node scripts/check-wholesale-cache-auth-leak.mjs
fi

if domain money; then
  echo "💸 머니 · 정합성"
  run "머니 패턴(CAS/무환불)"            bash scripts/check-money-patterns.sh
  run "CHECK 제약 위반"                 node scripts/check-status-constraints.mjs
  run "쿼리 isError(빈화면 위장)"        node scripts/check-query-iserror.mjs
  run "CSV 수식 인젝션"                 node scripts/check-csv-injection.mjs
fi

if domain schema; then
  echo "🗄️  DB · 스키마"
  run "스키마 참조 정합"                 bash scripts/check-schema-refs.sh
  run "SQL bind param mismatch"        node scripts/check-sql-bind-params.mjs
  run "존재하지 않는 컬럼 참조"          node scripts/check-sql-column-exists.mjs
  run "NOT NULL INSERT 누락"           node scripts/check-sql-not-null-insert.mjs
  run "products SELECT * 금지"          bash scripts/check-no-select-star-products.sh
  run "products/sellers 컬럼 예산"       node scripts/check-products-column-budget.mjs
  run "PRODUCT_DETAIL_FIELDS 복구가능"   node scripts/check-product-detail-fields-repairable.mjs
fi

if domain classify; then
  echo "🏷️  상품 종류 판별 · 라우팅"
  run "group_buy_status 종류판별 금지"   node scripts/check-groupbuy-status-classify.mjs
  run "도매주문 상태 무결성"             env STRICT_WHS_STATUS=1       node scripts/check-wholesale-order-status.mjs
fi

if domain ui; then
  echo "🎨 UI · 테마 · 첫페인트"
  run "테마 일관성(dark variant)"        node scripts/check-theme-consistency.mjs
  run "RQ initialData 신선도"           node scripts/check-query-initialdata.mjs
  run "모바일 뷰포트(하단 잘림)"          node scripts/check-mobile-viewport.mjs
fi

if domain deploy; then
  echo "🚀 빌드 · 배포 안전"
  run "build 명령(vite 단독 금지)"        bash scripts/check-build-command.sh
  run "Hono 라우터 패턴(405)"            bash scripts/check-router-patterns.sh
  run "Service Worker 등록 금지"         bash scripts/check-no-sw-register.sh
  run "하드코딩 시크릿"                  bash scripts/check-no-secrets.sh
fi

echo "────────────────────────────────────────────────────"
if [ "$FAIL" -eq 0 ]; then
  printf '\033[0;32m✅ ALL GREEN\033[0m — %d개 불변식 통과. 위 도메인은 가드가 보장 → 수동 재감사 스킵 가능.\n' "$PASS"
  exit 0
fi
printf '\033[0;31m❌ %d RED\033[0m / %d GREEN — 아래는 가드 신뢰 불가, 재감사/수정 필요:\n' "$FAIL" "$PASS"
for f in "${FAILED_LIST[@]}"; do echo "   • $f"; done
exit 1
