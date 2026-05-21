#!/bin/bash
# 🛡️ 2026-05-21: CSP style-src 에 nonce 추가 시도 자동 차단.
#
# 사고 경위: src/worker/index.ts 에 `style-src 'nonce-${nonce}'` 추가 →
#   CSP3 가 'unsafe-inline' 무력화 → Tailwind/React inline style 전부 차단 → 화면 깨짐.
#
# 룰: style-src directive 에 'nonce-' 토큰 포함 금지.
#     script-src 의 nonce 는 OK (HTMLRewriter 자동 부여).

set -e

staged=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null \
  | grep -E '\.(ts|tsx|js|mjs)$' \
  | grep -v 'node_modules/\|dist/' \
  || true)

if [ -z "$staged" ]; then
  exit 0
fi

violations=""

for f in $staged; do
  [ -f "$f" ] || continue
  # 같은 라인에 style-src 와 'nonce-' 가 같이 있으면 위반.
  matches=$(grep -nE "style-src[^;]*'nonce-" "$f" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    violations="$violations\n[$f]\n$matches"
  fi
done

if [ -n "$violations" ]; then
  echo ""
  echo "❌ CSP style-src 에 nonce 추가 발견 — 2026-05-21 사고 재발 위험:"
  echo -e "$violations"
  echo ""
  echo "  🔧 해결: 'nonce-XXX' 제거. style-src 'self' 'unsafe-inline' 만 유지."
  echo "  이유: CSP3 가 nonce 발견 시 unsafe-inline 무력화 → Tailwind/React inline style 전부 차단."
  echo "  자세한 경위: docs/INCIDENTS.md 2026-05-21"
  echo ""
  exit 1
fi

exit 0
