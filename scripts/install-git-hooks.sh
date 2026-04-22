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

if [ -n "$worker_changed" ]; then
  echo "==> Pre-commit: Worker 경로 파일의 @/ dynamic import 검출..."
  dyn_viol=""
  for f in $worker_changed; do
    [ -f "$f" ] || continue
    # 프론트 전용 파일 (stores/useAuthKR 등) 은 제외
    case "$f" in
      src/shared/stores/*|src/lib/firebase-auth*|src/lib/api.ts|src/lib/sentry.ts|src/lib/kakao-sdk*|src/lib/native.ts|src/client/*)
        continue ;;
    esac
    # await import('@/...') 또는 import('@/...') 패턴
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
echo "  2. TypeScript (npx tsc)"
echo "  3. 파일 중간 import 검출"
echo "  4. Worker 번들 빌드 (런타임 crash catch)"
