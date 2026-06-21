#!/usr/bin/env bash
# 🛡️ 2026-06-20: 카카오 OAuth iOS 쿠키 미영속 사고 재발 방지 (pre-commit warn / CI 차단: STRICT_AUTH_COOKIE=1).
#
# 배경(사고): iOS Safari/WebKit 은 **cross-site OAuth 콜백 302 응답의 Set-Cookie 를 미영속** 처리한다.
#   (Chrome=Blink 은 정상 → 개발자 테스트에선 안 보이고 iOS 에서만 조용히 깨짐 = 고약한 회귀.)
#   그래서 역할 토큰을 transfer 쿠키(ur_pending_*)로 넘기면 iOS 대시보드 로그인 실패,
#   세션 쿠키를 콜백 302 에 의존하면 iOS 소비자 로그인 실패.
#
# 규칙(CLAUDE.md '🍎 iOS 쿠키 영속 룰'):
#   - 역할 토큰 → fragment(#auth=) + worker/utils/pending-auth.ts encodePendingAuth()
#   - 세션     → POST /api/auth/session/establish (same-origin 200, httpOnly)
#   - XHR(JSON 응답) 로그인은 same-origin 이라 iOS-safe (공급자/유통 become 흐름).
#
# 우회: 커밋 메시지 [SKIP_AUTH_COOKIE_CHECK].

set -uo pipefail
cd "$(dirname "$0")/.."

# ── 우회 (pre-commit: COMMIT_EDITMSG / CI: 마지막 커밋 메시지) ──
SKIP=0
[ -f ".git/COMMIT_EDITMSG" ] && grep -q "\[SKIP_AUTH_COOKIE_CHECK\]" ".git/COMMIT_EDITMSG" 2>/dev/null && SKIP=1
git log -1 --format=%B 2>/dev/null | grep -q "\[SKIP_AUTH_COOKIE_CHECK\]" && SKIP=1
[ "$SKIP" = "1" ] && exit 0

WARN=0

# ── Check 1: ur_pending_* transfer 쿠키 안티패턴 부활 (현재 0건 — 어디든 나오면 회귀) ──
#   실제 쿠키 사용(ur_pending_<영문>...)만 매칭 — 문서/주석의 `ur_pending_*`(별표)는 제외.
#   tests / SSOT 설명 파일(pending-auth.ts) / 가드 자신 제외. 코드(src)만 스캔.
HITS=$(grep -rnE "ur_pending_[a-z]" src/ 2>/dev/null \
  | grep -vE "(\.test\.|/tests?/|check-auth-cookie-pattern|worker/utils/pending-auth\.ts)" || true)
if [ -n "$HITS" ]; then
  echo "⚠️  [auth-cookie] 'ur_pending_' transfer 쿠키 패턴 발견 — iOS 미영속 안티패턴:"
  echo "$HITS" | sed 's/^/      /'
  echo "    → 역할 토큰은 fragment(#auth=) + worker/utils/pending-auth.ts encodePendingAuth() 로 전달."
  echo "    → 세션은 POST /api/auth/session/establish (same-origin httpOnly). CLAUDE.md '카카오 OAuth 룰' 참조."
  WARN=1
fi

# ── Check 2: 카카오 OAuth 콜백 파일에 역할 토큰 Set-Cookie 신규 추가 (휴리스틱, staged diff) ──
#   허용: ud_*(SSR GET 읽기) / ur_*_session / *oauth_state / *consent_state / ur_kakao_stepup / csrf_token.
STAGED=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -E 'kakao.*\.routes\.ts$' || true)
for f in $STAGED; do
  [ -f "$f" ] || continue
  ADDED=$(git diff --cached -U0 -- "$f" 2>/dev/null | grep -E '^\+' | grep -vE '^\+\+\+' || true)
  SUSPECT=$(echo "$ADDED" | grep -iE "Set-Cookie" | grep -E "_token=" \
    | grep -vE "ud_(seller|agency|admin|supplier)_token|ur_(session|seller_session|admin_session|agency_session)|oauth_state|consent_state|ur_kakao_stepup|csrf_token" || true)
  if [ -n "$SUSPECT" ]; then
    echo "⚠️  [auth-cookie] $f: OAuth 콜백에서 역할 토큰을 Set-Cookie 로 전달하는 신규 라인:"
    echo "$SUSPECT" | sed 's/^/      /'
    echo "    → iOS 미영속 위험. fragment(#auth=, pending-auth.ts) 사용. SSR ud_* 쿠키면 무시 가능."
    WARN=1
  fi
done

if [ "$WARN" = "1" ]; then
  echo ""
  echo "   카카오 OAuth iOS 쿠키 룰 — CLAUDE.md '🍎 iOS 쿠키 영속 룰' 확인. 우회: 커밋 메시지 [SKIP_AUTH_COOKIE_CHECK]."
  if [ "${STRICT_AUTH_COOKIE:-0}" = "1" ]; then exit 1; fi
fi
exit 0
