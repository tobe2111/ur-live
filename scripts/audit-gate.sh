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
  run "대시보드 라우팅(겸업 lock-out)"     env STRICT_SELLER_WHS_REDIRECT=1 node scripts/check-seller-wholesale-redirect.mjs
fi

if domain auth; then
  echo "🔐 인증 · 세션 · RBAC"
  run "듀얼로그인 read-guard"            env STRICT_DUAL_LOGIN=1       node scripts/check-dual-login-guard.mjs
  run "로그인 세션 공존 write-guard"      env STRICT_LOGIN_COEXIST=1    node scripts/check-dashboard-login-session-coexist.mjs
  run "OAuth 쿠키 iOS 영속 패턴"         bash scripts/check-auth-cookie-pattern.sh
  run "라이트 입력 가시성"               env STRICT_LIGHT_INPUT=1      node scripts/check-light-input-guard.mjs
  run "내부 링크 dead-link"             env STRICT_LINKS=1            node scripts/check-internal-links.mjs
  run "라우트 경로 중복(조용히 죽는 페이지)" env STRICT_DUP_ROUTES=1       node scripts/check-duplicate-routes.mjs
  run "도달 불가 라우트(누를 데 없는 페이지)" env STRICT_ORPHAN_ROUTES=1   node scripts/check-orphan-routes.mjs
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
  run "폐기 가격함수 직접호출"           node scripts/check-deprecated-pricing.mjs -s
  run "잔액 절대값 write(비원자)"        node scripts/check-balance-absolute-write.mjs -s
  run "잔액↑ 원장기록 삼킴"            node scripts/check-balance-without-ledger.mjs
  run "커미션 예산 아비터 우회(INV-CB)"  node scripts/check-commission-budget.mjs
  run "서브리퀘스트 상한 키 레인공유"     node scripts/check-subreq-cap-lane.mjs -s
  run "서브리퀘스트 플랫폼 천장 우회"     node scripts/check-subreq-platform-cap.mjs -s
  run "부기 비용 예산 미차감"            node scripts/check-schema-cost-counted.mjs -s
  run "크롤 재시도 쿨다운"                node scripts/check-crawl-cooldown.mjs -s
  run "접힌 리드(중복병합) 누수"          node scripts/check-merged-lead-filter.mjs
  run "수집 러너 스케줄 누락"            node scripts/check-collector-cron.mjs
  run "블로그 시드 최신성"               node scripts/check-blog-seed-currency.mjs
  run "블로그 fact 동기화"               bash scripts/check-blog-fact-sync.sh
  run "플랫폼 모델 문서 동기화"          node scripts/check-platform-model-sync.mjs
  run "인계 문서 동기화"                 node scripts/check-current-work-sync.mjs
  run "동시 세션 겹침"                   node scripts/check-branch-overlap.mjs
fi

if domain schema; then
  echo "🗄️  DB · 스키마"
  run "스키마 참조 정합"                 bash scripts/check-schema-refs.sh
  run "WeakSet primitive 키(per-request DDL)" node scripts/check-weakset-primitive.mjs
  run "SQL bind param mismatch"        node scripts/check-sql-bind-params.mjs
  run "존재하지 않는 컬럼 참조"          node scripts/check-sql-column-exists.mjs
  run "NOT NULL INSERT 누락"           node scripts/check-sql-not-null-insert.mjs
  run "products SELECT * 금지"          bash scripts/check-no-select-star-products.sh
  run "products/sellers 컬럼 예산"       node scripts/check-products-column-budget.mjs
  run "PRODUCT_DETAIL_FIELDS 복구가능"   node scripts/check-product-detail-fields-repairable.mjs
  run "pagination NaN 크래시(page=abc)"  node scripts/check-pagination-nan.mjs -s
fi

if domain classify; then
  echo "🏷️  상품 종류 판별 · 라우팅"
  run "group_buy_status 종류판별 금지"   node scripts/check-groupbuy-status-classify.mjs
  run "동네딜↔쇼핑 완전분리(general)"    node scripts/check-dongnedeal-separation.mjs
  run "도매주문 상태 무결성"             env STRICT_WHS_STATUS=1       node scripts/check-wholesale-order-status.mjs
fi

if domain ui; then
  echo "🎨 UI · 테마 · 첫페인트"
  run "테마 일관성(dark variant)"        node scripts/check-theme-consistency.mjs
  run "RQ initialData 신선도"           node scripts/check-query-initialdata.mjs
  run "모바일 뷰포트(하단 잘림)"          node scripts/check-mobile-viewport.mjs
  run "링크샵 소유권 단일화"              node scripts/check-linkshop-ownership.mjs -s
  run "결제수단 판정 SSOT"                node scripts/check-payment-flow-ssot.mjs -s
  run "기능 현황판 동기(꺼진 기능)"        node scripts/generate-feature-status.mjs --check
  run "소비자 이미지 cfImage 경유"        env STRICT_RAW_IMG=1 node scripts/check-consumer-img-cfimage.mjs
  run "KST 타임스탬프 파싱(9시간 어긋남)"  env STRICT_UTC_DATE=1 node scripts/check-utc-date-parse.mjs
  run "커서 저장이 무한 루프 뒤(전진 0)"    node scripts/check-cursor-after-loop.mjs --strict
  # 2026-07-29 신규 등록 — 셋 다 파일은 예전부터 있었는데 어디에서도 실행되지 않고 있었다.
  run "input 라이트 가시성(흰글자)"       env STRICT_INPUT_TEXT=1       node scripts/check-input-text-color.mjs
  run "i18n 6개 언어 동기화"             node scripts/check-i18n-sync.mjs
fi

if domain structure; then
  echo "🧹 코드 구조 (god 파일 방지)"
  # 의도적으로 전수(-a) 유지 — 게이트는 repo 전체 건강 뷰. PR CI(verify.yml)만 --changed-only
  # (main 드리프트가 무관한 PR 을 실패시키던 문제, 2026-07-11). 드리프트는 --rebaseline 으로 정렬.
  run "파일 크기 래칫(god 파일)"          env STRICT_FILE_SIZE=1        node scripts/check-file-size.mjs -a
fi

if domain deploy; then
  echo "🚀 빌드 · 배포 안전"
  run "build 명령(vite 단독 금지)"        bash scripts/check-build-command.sh
  run "Hono 라우터 패턴(405)"            bash scripts/check-router-patterns.sh
  run "Service Worker 등록 금지"         bash scripts/check-no-sw-register.sh
  run "하드코딩 시크릿"                  bash scripts/check-no-secrets.sh
  run "KV delete 무료한도(fan-out)"      node scripts/check-kv-delete-budget.mjs -s
  run "시크릿 자재 전수(추적 파일)"       node scripts/check-secret-material.mjs
  run "Firebase 인증 수용 금지"          node scripts/check-no-firebase-auth.mjs
  run "cron 하트비트 커버리지"           node scripts/check-cron-heartbeat.mjs
  run "cron 슬롯 등록(안 도는 cron)"     node scripts/check-cron-slot-registered.mjs -s
  run "머지 충돌 마커"                  node scripts/check-conflict-markers.mjs -s
  run "처리량 노브 요금제 커버리지"    env X=1                       node scripts/check-plan-knob-coverage.mjs -s
  run "cron 표현식 문법(CF)"           env STRICT_CRON_SYNTAX=1      node scripts/check-cron-syntax.mjs
  run "유어애즈 예산 우회(부모 CPU)"    node scripts/check-ads-dispatch-bypass.mjs -s
  run "유어애즈 레인 격리"              node scripts/check-ads-lane-isolation.mjs
  run "예산 루프 부기 몫(자기 기록)"     env STRICT_BUDGET_BOOKKEEPING=1 node scripts/check-budget-bookkeeping.mjs
  run "공공데이터 자리표시자(N/A) 판정"  env STRICT_PUBLIC_DATA_SENTINEL=1 node scripts/check-public-data-sentinel.mjs
  run "시드 버전 단조증가"              env STRICT_SEED_VERSION=1     node scripts/check-seed-version-monotonic.mjs
  run "규칙 버전 bump"                  env STRICT_RULES_VERSION=1    node scripts/check-rules-version-bump.mjs
  # 가드를 지키는 가드 — "만들어만 두고 안 켠 검사" / "경로가 낡아 비어버린 검사" 차단.
  run "가드 레지스트리(안 도는 가드)"     env STRICT_GUARD_REGISTRY=1   node scripts/check-guard-registry.mjs
  run "잠금표 심볼 실재(낡은 지도)"      env STRICT_LOCK_TABLE=1       node scripts/check-lock-table-symbols.mjs
  run "sitemap 죽은 URL 제출"            env STRICT_SITEMAP=1          node scripts/check-sitemap-routes.mjs
  run "비공개 라우트 크롤 노출"          env STRICT_ROBOTS=1           node scripts/check-robots-private-routes.mjs
  run "tsconfig 타입체크 무력화 설정"    env STRICT_TSCONFIG=1         node scripts/check-tsconfig-resolution.mjs
  run "구 도메인 사용자 노출"            env STRICT_LEGACY_DOMAIN=1    node scripts/check-legacy-domain.mjs
  # 빌드 산출물이 있을 때만 실측(없으면 스크립트가 명시적 SKIP 출력 후 exit 0).
  #   상주 실행 지점은 verify.yml 의 build 직후 — 거기선 항상 실측된다.
  run "크리티컬 청크 구성 동결"          node scripts/check-critical-chunks.mjs
  run "감사 레지스트리 동기화"          env STRICT_AUDIT_REGISTRY=1   node scripts/check-audit-registry-sync.mjs
  run "가드 자기검증(측정0=실패)"       env STRICT_GUARD_SELFCHECK=1  node scripts/check-guard-selfcheck.mjs
  # 🧪 2026-08-04 신설 — **이 게이트에 가드 주입 검증이 통째로 빠져 있었다.**
  #   실제 사고: 이 세션이 티스토리 코드를 옮기고 `audit-gate.sh` 로 "ALL GREEN 87" 을 확인한 뒤 커밋했는데,
  #   CI 는 낡은 지도 2건으로 빨간불이었다. 게이트가 안 보는 검사를 근거로 "전부 통과"라고 보고한 것이다.
  #   ⚠️ `-s` 가 없으면 실패해도 exit 0(warn)이라 여기서도 반드시 붙인다 — 그게 없어서 못 봤다.
  #   ⏱️ 느리다(주입마다 vitest 1회, 수 분). 그래도 게이트의 값은 **"안 보는 곳이 없다"** 는 것이다.
  run "가드 주입 검증(헛도는 가드)"      node scripts/check-guard-mutations.mjs -s
fi

echo "────────────────────────────────────────────────────"
if [ "$FAIL" -eq 0 ]; then
  printf '\033[0;32m✅ ALL GREEN\033[0m — %d개 불변식 통과. 위 도메인은 가드가 보장 → 수동 재감사 스킵 가능.\n' "$PASS"
  exit 0
fi
printf '\033[0;31m❌ %d RED\033[0m / %d GREEN — 아래는 가드 신뢰 불가, 재감사/수정 필요:\n' "$FAIL" "$PASS"
for f in "${FAILED_LIST[@]}"; do echo "   • $f"; done
exit 1
