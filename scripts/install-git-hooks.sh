#!/bin/bash
# install-git-hooks.sh — Install git pre-commit hook
#
# 2026-04-22 강화: webhook.routes.ts 파일 중간 import로 인한 worker 전체 500 사고 후
# Runtime 에러를 catch하기 위해 worker 번들 빌드 + 파일 중간 import 검출 추가.

set -e

HOOK_DIR="$(git rev-parse --git-dir)/hooks"
HOOK_FILE="$HOOK_DIR/pre-commit"

cat > "$HOOK_FILE" << 'EOF'
#!/bin/bash
# Pre-commit hook — schema + auth + runtime build integrity
set -e

staged_ts=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' | grep -v 'node_modules/\|dist/' || true)

if [ -z "$staged_ts" ]; then
  exit 0
fi

echo "==> Pre-commit: schema references..."
bash scripts/check-schema-refs.sh || {
  echo "❌ Commit blocked. Fix schema reference issues."
  exit 1
}

# 🛡️ 2026-05-03: 대시보드 dark: variants 절대 금지 (사용자 요구).
echo "==> Pre-commit: 대시보드 테마 정책 검증..."
bash scripts/check-dashboard-theme.sh || {
  echo "❌ Commit blocked. 셀러/어드민/에이전시 대시보드는 dark: variant 사용 절대 금지."
  exit 1
}

# 🚨 2026-04-27 (PWA 사고 재발 방지): Service Worker 등록 코드 차단
echo "==> Pre-commit: Service Worker 등록 코드 검사..."
bash scripts/check-no-sw-register.sh || {
  echo "❌ Commit blocked. PWA SW 재도입 시도 발견 — 2026-04-27 사고 재발 위험!"
  exit 1
}

# 🚨 2026-05-12/13 (405 사고 재발 방지): Hono v4 wildcard cors 안티패턴 차단
echo "==> Pre-commit: Hono v4 라우터 안티패턴 검사..."
if ! echo "$(git log -1 --pretty=%B 2>/dev/null)" | grep -q "\[SKIP_ROUTER_CHECK\]"; then
  bash scripts/check-router-patterns.sh || {
    echo "❌ Commit blocked. Wildcard cors 안티패턴 — 405 사고 재발 위험."
    exit 1
  }
fi

# 🚨 2026-05-21 (CSP style-src nonce 사고 방지): 화면 깨짐 재발 차단
echo "==> Pre-commit: CSP style-src nonce 검사..."
if ! echo "$(git log -1 --pretty=%B 2>/dev/null)" | grep -q "\[SKIP_CSP_CHECK\]"; then
  bash scripts/check-csp-style-nonce.sh || {
    echo "❌ Commit blocked. style-src nonce 추가 — 화면 깨짐 사고 재발 위험."
    exit 1
  }
fi

# 🚨 2026-05-21 Phase D-5 (seller_type 직접 비교 금지 — single source 깨짐 방지)
echo "==> Pre-commit: 셀러 role helper 사용 검증..."
if ! echo "$(git log -1 --pretty=%B 2>/dev/null)" | grep -q "\[SKIP_ROLE_CHECK\]"; then
  bash scripts/check-seller-role-helper.sh || {
    echo "❌ Commit blocked. seller_type 직접 비교 — helper 사용 필수."
    exit 1
  }
fi

# 🚨 2026-05-12 (vite build 단독 사고 방지): build:worker 누락 차단
echo "==> Pre-commit: 빌드 명령 검사..."
if ! echo "$(git log -1 --pretty=%B 2>/dev/null)" | grep -q "\[SKIP_BUILD_CHECK\]"; then
  bash scripts/check-build-command.sh || {
    echo "❌ Commit blocked. 'vite build' 단독 사용 — _worker.js 미갱신 사고 재발 위험."
    exit 1
  }
fi

# 🚨 Secret 누출 차단 (public repo 영구 노출 방지)
echo "==> Pre-commit: hardcoded secret 검사..."
bash scripts/check-no-secrets.sh || {
  echo "❌ Commit blocked. Secret 누출 위험 — public repo 에 영구 노출됨."
  exit 1
}

# ⚠️ Silent error swallowing 검출 (warn-only)
echo "==> Pre-commit: silent error 패턴 검사 (warn-only)..."
bash scripts/check-silent-errors.sh || true

# 💸 2026-06-11: 머니/정합성 버그 클래스 검사 (warn-only, 차단: STRICT_MONEY=1).
#   감사에서 반복 발견된 패턴 — per-request DDL / 무환불 CANCELLED 플립.
echo "==> Pre-commit: 머니 패턴 검사 (warn-only)..."
bash scripts/check-money-patterns.sh || true

# 🍎 2026-06-20: 카카오 OAuth iOS 쿠키 미영속 안티패턴 검사 (warn-only, CI 차단: STRICT_AUTH_COOKIE=1).
#   ur_pending_* transfer 쿠키 / 콜백 302 Set-Cookie 역할토큰 → iOS 대시보드 로그인 조용히 깨짐.
echo "==> Pre-commit: 카카오 OAuth iOS 쿠키 패턴 검사 (warn-only)..."
bash scripts/check-auth-cookie-pattern.sh || true

# 🛡️ 2026-05-17: CHECK 제약 위반 자동 탐지 (warn-only).
#   admin live-monitor delete 사고 재발 방지 — 'status=\"deleted\"' 가 CHECK IN (...) 위반 → 500.
echo "==> Pre-commit: CHECK 제약 위반 검사 (warn-only)..."
node scripts/check-status-constraints.mjs || true

# 🛡️ 2026-05-17: SQL prepare(?) vs bind(args) 개수 mismatch 검사 (warn-only).
#   'wrong number of bindings' SqlError → 500 방지.
echo "==> Pre-commit: SQL bind param 개수 검사 (warn-only)..."
node scripts/check-sql-bind-params.mjs || true

# 🛡️ 2026-05-17: NOT NULL 컬럼 미포함 INSERT 검사 (warn-only).
#   'NOT NULL constraint failed' SqlError → silent .catch fail → 알림 누락 사고 방지.
echo "==> Pre-commit: NOT NULL INSERT 검사 (warn-only)..."
node scripts/check-sql-not-null-insert.mjs || true

# 🛡️ 2026-05-23: 존재하지 않는 컬럼 참조 검사 (strict — 차단).
#   23건 일괄 fix 완료 (commit bcdd8990) 후 strict 활성. 새 mismatch commit 차단.
#   'no such column' SqlError → silent .catch → 기능 동작 안 함 사고 영구 차단.
echo "==> Pre-commit: 존재 없는 컬럼 참조 검사 (strict)..."
node scripts/check-sql-column-exists.mjs -s || {
  echo "❌ Commit blocked. SQL 컬럼 mismatch 발견 — production-schema.ts 와 정합 필요."
  exit 1
}

# 🛡️ 2026-05-17: 대시보드 NaN/undefined 노출 위험 검사 (warn-only)
echo "==> Pre-commit: 대시보드 NaN 위험 패턴 검사 (warn-only)..."
bash scripts/check-nan-dashboard.sh || true

# 🛡️ 2026-05-19: 변경성 엔드포인트 인증·rate-limit 커버리지 검사 (warn-only).
#   src/features/*\/api/*.routes.ts + src/worker/routes 의 POST/PATCH/PUT/DELETE 가
#   인증 미들웨어 / rate-limit / ownership 체크 없이 commit 되는 것 차단.
echo "==> Pre-commit: 변경성 엔드포인트 커버리지 검사 (warn-only)..."
node scripts/check-mutation-coverage.mjs || true

# 🛡️ 2026-05-19: PII (개인정보) production 로그 노출 검사 (warn-only).
#   maskEmail/maskPhone 누락 + DEV 게이트 없이 raw 이메일/전화 출력 차단.
echo "==> Pre-commit: PII 로그 redaction 검사 (warn-only)..."
node scripts/check-pii-logs.mjs || true

# 🛡️ 2026-05-19: 다크 모드 보더 누락 검사 (warn-only).
#   border-gray-50/100/200 에 dark:border-[#1A1A1A] 매핑 누락 시 다크 모드 흰 선 노출.
echo "==> Pre-commit: 다크 모드 보더 매핑 검사 (warn-only)..."
node scripts/check-dark-border.mjs || true

# 🛡️ 2026-05-31: 다크/라이트 테마 일관성 검사 (staged 파일만, warn-only).
#   유저 대면 화이트-토글 페이지에서 bg-white/text-gray-900 등 라이트 색상에 dark: variant
#   누락 시 다크 모드에서 흰 박스/검은 텍스트 노출. variant-aware (hover:/focus: 등 대응).
#   대시보드(seller/admin/agency) + 순수 다크 페이지는 자동 제외. 차단: STRICT_THEME=1.
echo "==> Pre-commit: 다크/라이트 테마 일관성 검사 (warn-only)..."
if echo "$(git log -1 --pretty=%B 2>/dev/null)" | grep -q "\[SKIP_THEME_CHECK\]"; then
  echo "   [SKIP_THEME_CHECK] — 건너뜀"
else
  node scripts/check-theme-consistency.mjs || true
fi

# 🛡️ 2026-06-17: React Query "stale initialData" 버그 클래스 (잔액 '딜 부족' 오표시 사고).
#   initialData 가 initialDataUpdatedAt/refetchOnMount:'always' 없이 fresh 로 간주돼 cold mount
#   refetch 누락. warn-only (차단은 verify.yml CI strict).
echo "==> Pre-commit: React Query initialData 신선도 검사 (warn-only)..."
node scripts/check-query-initialdata.mjs || true

# 🛡️ 2026-06-17: 듀얼 로그인(소비자↔대시보드) 재발 방지 (warn-only).
#   localStorage user_type === 'user' 로 로그인 판단하는 안티패턴 신규 추가 감지 → 세션 풀림 사고 재발 차단.
echo "==> Pre-commit: 듀얼 로그인 가드 (warn-only)..."
node scripts/check-dual-login-guard.mjs || true

# 🔐 2026-06-26: 유저↔어드민/셀러 상호 로그아웃 재발 방지 (warn-only).
#   대시보드 로그인이 무조건 clearAuthData('user') 하면 KR httpOnly ur_session 쿠키까지 날아가
#   소비자 강제 로그아웃. user 정리는 !isKorea() 게이트 안에서만. 차단은 verify.yml CI strict.
echo "==> Pre-commit: 로그인 세션 공존 가드 (warn-only)..."
node scripts/check-dashboard-login-session-coexist.mjs || true

# 🧱 2026-06-26: 서비스 분리 — 소비자 단건 상품 조회의 도매 원본 격리 회귀 잠금 (warn-only).
#   누수 닫은 사이트(상세/카트/공구확정)가 필터를 잃으면 도매 B2B 원본이 소비자에 노출. 차단은 verify.yml CI strict.
echo "==> Pre-commit: 소비자 상품 도매 격리 가드 (warn-only)..."
node scripts/check-consumer-product-supply-isolation.mjs || true

# 🛡️ 2026-06-18: group_buy_status 로 상품 종류(교환권/공구 vs 쇼핑) 판별·라우팅 금지 (warn-only).
#   group_buy_status 는 모든 상품 DEFAULT 'active' → 종류 판별에 쓰면 쇼핑 상품이 교환권으로 오분류
#   (핀 /group-buy 오라우팅 사고). 종류는 deal_only + isVoucherCategory SSOT 만. 차단은 verify.yml CI strict.
echo "==> Pre-commit: group_buy_status 종류판별 가드 (warn-only)..."
node scripts/check-groupbuy-status-classify.mjs || true

# 🛡️ 2026-06-20: 라이트 고정 로그인/가입 페이지 입력 글자 흰색 재발 방지 (warn-only).
#   standalone 라이트 auth 페이지가 force-light-theme(또는 *-light-theme/레이아웃) 없이 input 렌더 시
#   다크모드에서 글자 안 보임 사고. 차단은 verify.yml CI strict (STRICT_LIGHT_INPUT=1).
echo "==> Pre-commit: 로그인 입력 글자 가드 (warn-only)..."
node scripts/check-light-input-guard.mjs || true

# 🛡️ 2026-06-22: 모바일 뷰포트/스크롤 함정 래칫 — 신규 라인의 h-screen(100vh)/min-h-0 누락 차단.
#   동네딜 지도 하단 잘림 사건 재발 방지. staged diff 추가라인만 검사(레거시 무시). warn-only.
echo "==> Pre-commit: 모바일 뷰포트 함정 가드 (warn-only)..."
node scripts/check-mobile-viewport.mjs || true

# 🛡️ 2026-06-26: CSV 수식 인젝션 가드 (warn-only) — csvEscape 류 함수에 = + - @ 탭/CR 선행 가드 강제.
echo "==> Pre-commit: CSV 수식 인젝션 가드 (warn-only)..."
node scripts/check-csv-injection.mjs || true

# 🛡️ 2026-06-26: 쿼리 isError 소비 가드 (warn-only) — 도매/제조사 surface 의 data 페이지가 isError 분기
#   없이 렌더하면 fetch 실패가 빈화면/₩0 으로 위장됨. 신규 추가 차단.
echo "==> Pre-commit: 쿼리 isError 소비 가드 (warn-only)..."
node scripts/check-query-iserror.mjs || true

# 🛡️ 2026-04-26 (N4): migrations 변경 시 schema drift 자동 검증
staged_migrations=$(git diff --cached --name-only --diff-filter=ACM | grep -E '^migrations/.*\.sql$|src/shared/db/production-schema.ts' || true)
if [ -n "$staged_migrations" ]; then
  echo "==> Pre-commit: schema drift 검증 (migrations ↔ production-schema.ts)..."
  if ! node scripts/verify-schema.mjs --json > /tmp/schema-drift.json 2>&1; then
    drift_count=$(jq '.summary.drift // 0' /tmp/schema-drift.json 2>/dev/null || echo 0)
    if [ "$drift_count" != "0" ]; then
      echo "⚠️  schema drift $drift_count 건 — 정보 용도, 차단 안 함"
      echo "    상세: node scripts/verify-schema.mjs"
    fi
  fi
fi

echo "==> Pre-commit: 운영 가이드 동기화 (warn-only)..."
bash scripts/check-guide-sync.sh || true

# 🛡️ 마이그레이션 ↔ repair-schema drift (warn-only) — prod D1 은 .sql 자동적용 X, repair-schema 가 SSOT.
echo "==> Pre-commit: 마이그레이션/repair-schema drift (warn-only)..."
node scripts/check-migration-repair-drift.mjs || true

# 📑 소개서(docs/proposals/) 동기화 권고 (warn-only — 절대 차단 X).
echo "==> Pre-commit: 소개서 동기화 권고 (warn-only)..."
bash scripts/check-proposal-sync.sh || true

# 🛡️ npm audit — high/critical 취약점 차단 ([SKIP_AUDIT] 커밋 메시지로 우회 가능)
echo "==> Pre-commit: npm audit (high/critical)..."
bash scripts/check-npm-audit.sh || {
  echo "❌ Commit blocked. npm audit high/critical 취약점 발견."
  echo "   긴급 우회: 커밋 메시지에 [SKIP_AUDIT] 포함"
  exit 1
}

# 자동 참조 섹션 (페이지/엔드포인트 목록) 재생성 + staged 면 추가
auto_ref_relevant=$(echo "$staged_ts" | grep -E '^(src/App\.tsx|src/(features|worker)/(.*?\.routes)?|src/worker/index\.ts)' || true)
if [ -n "$auto_ref_relevant" ]; then
  echo "==> Pre-commit: 가이드 자동 참조 재생성..."
  node scripts/generate-guide-references.mjs > /dev/null 2>&1 || true
  if ! git diff --quiet src/features/guides/api/auto-reference.ts 2>/dev/null; then
    git add src/features/guides/api/auto-reference.ts
    echo "   ✓ auto-reference.ts 재생성 + staged"
  fi
fi

# 📑 소개서(docs/proposals/) 자동 동기화 블록 재생성 — 사용자 "무조건" 요구로 매 커밋 실행.
#   (anti-churn 으로 실질 변경 있을 때만 파일을 다시 쓰고 stage 함.) 절대 차단 X (|| true).
echo "==> Pre-commit: 소개서 자동 참조 재생성 (매 커밋)..."
node scripts/generate-proposal-refs.mjs > /dev/null 2>&1 || true
if ! git diff --quiet docs/proposals 2>/dev/null; then
  git add docs/proposals/*.md 2>/dev/null || true
  echo "   ✓ docs/proposals/*.md 재생성 + staged"
fi

echo "==> Pre-commit: TypeScript check..."
npx tsc --noEmit --skipLibCheck || {
  echo "❌ Commit blocked. Fix TypeScript errors."
  exit 1
}

# 🛡️ 2026-04-22: 파일 중간 import 경고 (staged 파일의 NEW 라인만 — 기존 코드는 skip)
# diff --cached 의 '+' 라인 중 import로 시작하는 것을 찾고,
# 그 import가 이미 다른 import 블록 뒤에 있는지 확인 (휴리스틱).
# 경고만 표시, 커밋은 허용. 빌드 검증이 실제 crash를 catch함.
echo "==> Pre-commit: 새로 추가된 파일 중간 import 경고..."
git diff --cached -U0 --no-color -- '*.ts' '*.tsx' 2>/dev/null | awk '
  /^\+\+\+ b\// { file = substr($0, 7); next }
  /^@@ / {
    match($0, /\+[0-9]+/);
    start = substr($0, RSTART + 1, RLENGTH - 1) + 0;
    ln = start - 1; next
  }
  /^\+[^+]/ {
    ln++;
    if ($0 ~ /^\+[ \t]*import /) print file ":" ln ":" substr($0, 2)
  }
  /^[ -]/ { ln++ }
' | head -5

# 🛡️ 2026-04-22: Worker 코드에서 @/ dynamic import 검출 (런타임 crash 영구 방지)
# TypeScript paths alias는 런타임엔 존재 안 하므로 dynamic import 문자열이 그대로 남아 crash.
# esbuild alias 설정도 추가했지만 Pre-commit에서 다시 한번 검증 (double defense).
worker_changed=$(echo "$staged_ts" | grep -E '^src/(worker|features|shared|lib)/' || true)

# Worker 전용 경로 (확실히 Cloudflare Workers 런타임)
worker_only_changed=$(echo "$staged_ts" | grep -E '^src/(worker/|features/[^/]+/api/)' || true)

if [ -n "$worker_changed" ]; then
  echo "==> Pre-commit: Worker 경로 파일의 @/ dynamic import 검출..."
  dyn_viol=""
  for f in $worker_changed; do
    [ -f "$f" ] || continue
    # 프론트 전용 파일은 제외
    case "$f" in
      src/shared/stores/*|src/lib/firebase-auth*|src/lib/api.ts|src/lib/sentry.ts|src/lib/kakao-sdk*|src/lib/native.ts|src/client/*)
        continue ;;
    esac
    matches=$(grep -nE "await[[:space:]]+import\(['\"]@/|=[[:space:]]*import\(['\"]@/" "$f" 2>/dev/null || true)
    if [ -n "$matches" ]; then
      dyn_viol="$dyn_viol\n$f:\n$matches"
    fi
  done
  if [ -n "$dyn_viol" ]; then
    echo "❌ Worker 코드에 @/ dynamic import 발견 — 런타임 crash 유발:"
    echo -e "$dyn_viol"
    echo ""
    echo "해결: 상대경로로 변경하세요. 예:"
    echo "  await import('@/foo/bar')  →  await import('../../foo/bar')"
    echo ""
    echo "이유: TypeScript paths alias는 런타임 존재 X. static import만 빌드 시 resolve됨."
    exit 1
  fi

  # 🛡️ 브라우저 전용 패키지 검출 (worker에서 import하면 런타임 crash)
  # @sentry/react, react, react-dom, react-router-dom 등 window/document 참조 패키지
  echo "==> Pre-commit: Worker 코드에서 브라우저 전용 패키지 import 검출..."
  browser_viol=""
  BROWSER_ONLY_PATTERN='@sentry/react|from ['"'"'"]react['"'"'"]|from ['"'"'"]react-dom['"'"'"]|from ['"'"'"]react-router-dom['"'"'"]|from ['"'"'"]react-helmet-async['"'"'"]|@tanstack/react-query'
  for f in $worker_only_changed; do
    [ -f "$f" ] || continue
    matches=$(grep -nE "import .* (from )?(['\"]?)(@sentry/react|react['\"]?$|react-dom|react-router-dom|react-helmet-async|@tanstack/react-query)" "$f" 2>/dev/null || true)
    if [ -n "$matches" ]; then
      browser_viol="$browser_viol\n$f:\n$matches"
    fi
  done
  if [ -n "$browser_viol" ]; then
    echo "❌ Worker 코드에 브라우저 전용 패키지 import 발견 — Cloudflare Workers에 window/document 없음:"
    echo -e "$browser_viol"
    echo ""
    echo "해결: 순수 로직은 lib/ 또는 shared/ 에 분리 후 import."
    echo "  예: '@/lib/sentry'의 maskEmail → '@/lib/mask'로 분리"
    exit 1
  fi

  echo "==> Pre-commit: Worker 번들 빌드 (런타임 검증)..."
  npm run build:worker > /tmp/worker-build.log 2>&1 || {
    echo "❌ Worker 빌드 실패 — 런타임 crash 유발. 커밋 차단."
    tail -20 /tmp/worker-build.log
    exit 1
  }
fi

echo "✅ Pre-commit checks passed"
EOF

chmod +x "$HOOK_FILE"
echo "✅ Git pre-commit hook installed at $HOOK_FILE"
echo ""
echo "검증 단계:"
echo "  1. 스키마 참조 (금지 컬럼)"
echo "  2. 대시보드 테마 정책 (dark: variant 금지)"
echo "  3. Service Worker 등록 코드 차단"
echo "  4. 운영 가이드 동기화 (warn-only, STRICT_GUIDE_SYNC=1로 차단)"
echo "  5. npm audit high/critical 취약점 ([SKIP_AUDIT]으로 우회)"
echo "  6. 소개서 동기화 권고 + 자동 참조 재생성 (warn-only, 매 커밋)"
echo "  7. TypeScript (npx tsc)"
echo "  8. 파일 중간 import 검출"
echo "  9. Worker 번들 빌드 (런타임 crash catch)"
