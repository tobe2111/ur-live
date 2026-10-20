#!/bin/bash
# check-router-patterns.sh — Hono v4 라우팅 안티패턴 검출
#
# 2026-05-12 / 2026-05-13 사고 후 추가:
#   sub-router 에 app.use('*', cors()) 또는 app.use('*', middleware) 같은
#   wildcard middleware 가 있으면, Hono v4 라우터 트리에서 같은 mount prefix
#   의 다른 sub-router 경로까지 가로채는 버그 발생.
#
# 결과적으로 발생한 사고:
#   - POST /api/seller/youtube/live/create 가 ad-slots / kakao-link 등의
#     wildcard cors 에 가로채여 405 Method Not Allowed 반환
#   - 카카오 셀러 연동, 정산, 주문 등 random endpoint 들이 의도치 않은 응답
#
# 영구 fix:
#   sub-router 들의 wildcard cors() 모두 제거 → worker/index.ts 의 글로벌
#   cors 가 처리. 이 hook 은 같은 패턴이 다시 추가되는 것을 차단.

set -e

# staged 된 .ts 파일에서 features/ 내부의 routes 파일만
staged=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null \
  | grep -E '^src/features/.*\.routes\.ts$' \
  | grep -v 'node_modules/' \
  || true)

if [ -z "$staged" ]; then
  exit 0
fi

violations=""

for f in $staged; do
  [ -f "$f" ] || continue

  # 패턴 1: app.use('*', cors(...))  또는  routerVar.use('*', cors(...))
  cors_wildcard=$(grep -nE "\.use\s*\(\s*['\"]\*['\"][^)]*cors\s*\(" "$f" 2>/dev/null || true)
  if [ -n "$cors_wildcard" ]; then
    violations="$violations\n[$f] wildcard cors() 미들웨어:\n$cors_wildcard"
  fi

  # 패턴 2: app.use('*', requireXxx()) — auth 미들웨어 wildcard
  #   주의: legitimate 사용 (단일 prefix 마운트 시) 도 있으니 WARN 만, 차단 안 함
  # auth_wildcard=$(grep -nE "\.use\s*\(\s*['\"]\*['\"][^)]*(require[A-Z]\w*|verifyJWT)" "$f" 2>/dev/null || true)

done

if [ -n "$violations" ]; then
  echo ""
  echo "❌ Sub-router 안티패턴 발견 — Hono v4 라우팅 트리 오염 가능:"
  echo -e "$violations"
  echo ""
  echo "  📚 배경: 2026-05-12/13 405 사고. docs/INCIDENTS.md 참조."
  echo ""
  echo "  🔧 해결:"
  echo "    1) cors(): 제거 — worker/index.ts:244 의 글로벌 cors 가 처리"
  echo "    2) auth: 각 route 에 inline 적용:"
  echo "         app.get('/foo', requireSeller(), handler)"
  echo "       또는 specific path pattern 사용:"
  echo "         app.use('/foo/*', requireSeller())"
  echo ""
  echo "  ⚡ Bypass (테스트 등 정당한 사유): commit message 에 [SKIP_ROUTER_CHECK]"
  echo ""
  exit 1
fi

exit 0
