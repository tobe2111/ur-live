#!/bin/bash
# check-build-command.sh — 'vite build' 단독 사용 검출
#
# 2026-05-12 사고: 사용자가 PC PowerShell 에서 'npx vite build' 만 실행
#   → client 만 빌드, _worker.js 미갱신 → 모든 worker 코드 fix 가
#   production 에 반영 안 됨 → 405 에러 며칠 반복.
#
# 룰:
#   - 스크립트 / 문서에 'npx vite build' 또는 'vite build' 단독 사용 금지
#   - 반드시 'npm run build' (또는 build:worker + build:client 명시)
#
# 예외: package.json 의 "build:client" 정의 안에서는 OK.

set -e

staged=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null \
  | grep -E '\.(sh|ps1|md|mjs|cjs|js|ts|yml|yaml)$' \
  | grep -v 'node_modules/\|dist/' \
  || true)

if [ -z "$staged" ]; then
  exit 0
fi

violations=""

for f in $staged; do
  [ -f "$f" ] || continue
  # package.json 의 build:client 정의는 제외
  if [ "$f" = "package.json" ]; then
    continue
  fi

  # 'vite build' 단독 사용 검출 (npm run build 안에 포함된 건 OK)
  # 패턴: 'vite build' 또는 'npx vite build' 가 줄에 단독으로 있음
  matches=$(grep -nE "(^|[^a-zA-Z_:-])(npx +)?vite +build([^a-zA-Z_]|$)" "$f" 2>/dev/null \
    | grep -v "npm run build" \
    | grep -v "build:client" \
    | grep -v "^[^:]*:[0-9]*:[[:space:]]*[#/]" \
    || true)
  if [ -n "$matches" ]; then
    violations="$violations\n[$f]\n$matches"
  fi
done

if [ -n "$violations" ]; then
  echo ""
  echo "❌ 'vite build' 단독 사용 발견 — _worker.js 미갱신 사고 (2026-05-12) 재발 위험:"
  echo -e "$violations"
  echo ""
  echo "  🔧 해결: 'vite build' → 'npm run build' (client + worker + prepare 전체)"
  echo "  또는 별도 worker 빌드 필요: 'npm run build:client && npm run build:worker'"
  echo ""
  echo "  ⚡ Bypass (정당한 사유): commit message 에 [SKIP_BUILD_CHECK]"
  echo ""
  exit 1
fi

exit 0
