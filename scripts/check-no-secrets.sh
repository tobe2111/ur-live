#!/bin/bash
# check-no-secrets.sh — 하드코딩 secret commit 차단
#
# 검출 패턴:
#   - Cloudflare API Token (40+ char alphanumeric)
#   - Stripe / Toss / Kakao secret keys
#   - JWT signed tokens (eyJ... pattern)
#   - Generic API_KEY / SECRET / PASSWORD = "value" patterns
#   - Private key PEM blocks
#
# 예외 허용:
#   - "test-*" / "dummy-*" / "example-*" prefix
#   - test/spec 파일
#   - commit message 에 [SKIP_SECRET_CHECK]

set -e

# commit message bypass 확인
if echo "$(git log -1 --pretty=%B 2>/dev/null)" | grep -q "\[SKIP_SECRET_CHECK\]"; then
  exit 0
fi

staged=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null \
  | grep -vE 'node_modules/|dist/|\.lock$|package-lock\.json' \
  || true)

if [ -z "$staged" ]; then
  exit 0
fi

violations=""

for f in $staged; do
  [ -f "$f" ] || continue

  # 테스트 파일은 더미 secret 허용
  if echo "$f" | grep -qE '\.test\.|\.spec\.|/tests/|/__tests__/|/fixtures/'; then
    continue
  fi
  # 이 스크립트 자신은 제외 — 탐지 패턴 문자열("BEGIN PRIVATE KEY" 등)을 담고 있어 자기 자신을 잡는다(오탐).
  case "$f" in scripts/check-no-secrets.sh) continue ;; esac

  # 패턴 1: Stripe live key
  m=$(grep -nE "sk_live_[A-Za-z0-9]{20,}" "$f" 2>/dev/null || true)
  [ -n "$m" ] && violations="$violations\n[$f] Stripe live secret:\n$m"

  # 패턴 2: Toss live secret key (test_sk / live_sk 로 시작)
  m=$(grep -nE "['\"](live|test)_sk_[A-Za-z0-9]{20,}['\"]" "$f" 2>/dev/null || true)
  [ -n "$m" ] && violations="$violations\n[$f] Toss secret key:\n$m"

  # 패턴 0: dotenv 파일 자체를 커밋 — 🚨 2026-07-28 실사고. `.env.deploy` 가 살아있는 CLOUDFLARE_API_TOKEN
  #   을 담은 채 **public 레포**에 커밋돼 있었다(#737). 아래 값 패턴들은 전부 따옴표를 요구해서
  #   dotenv 형식(`KEY=value`, 따옴표 없음)을 통째로 놓쳤다 — 형식이 아니라 **파일 자체**를 막는다.
  #   예외: *.example / *.template(자리표시자) · .env.production(VITE_* 공개 클라이언트 값만).
  #   🚨 2026-07-28 보강: `.dev.vars`(Cloudflare 로컬 시크릿 파일)도 포함 — **실제로 유출된 적 있는데**
  #     (commit 96f502d, `1665681ae` 에서 untrack) 위 `.env` 정규식엔 안 걸려 재커밋을 못 막고 있었다.
  #     `.dev.vars.production` 같은 변종도 같이 막는다.
  if echo "$f" | grep -qE '(^|/)(\.env|\.dev\.vars)($|\.)' \
    && ! echo "$f" | grep -qE '\.(example|template)$|(^|/)\.env\.production$'; then
    violations="$violations\n[$f] dotenv 파일이 커밋됨 — 실제 자격증명 유출 위험(.gitignore 로 제외하고 값은 대시보드/Secret 으로):\n$(grep -nE '^[A-Z0-9_]+=.+' "$f" 2>/dev/null | sed -E 's/=.*/=<redacted>/' | head -5)"
  fi

  # 패턴 3: Cloudflare API Token (40 char alphanumeric + - + _) — 단, env var 참조 X
  #   ⚠️ 따옴표는 **선택**(dotenv 는 안 씀 — 위 실사고의 직접 원인).
  m=$(grep -nE "(CLOUDFLARE_API_TOKEN|CF_API_TOKEN)\s*[:=]\s*['\"]?[A-Za-z0-9_-]{30,}['\"]?" "$f" 2>/dev/null \
    | grep -vE "your-api-token|YOUR_TOKEN|[$][{]" || true)
  [ -n "$m" ] && violations="$violations\n[$f] Cloudflare API Token:\n$m"

  # 패턴 4: JWT_SECRET 에 실제 값 (32+ char) — env / template 제외. 따옴표 선택(패턴 3 과 동일 사유).
  m=$(grep -nE "JWT_SECRET\s*[:=]\s*['\"]?[A-Za-z0-9+/=_-]{32,}['\"]?" "$f" 2>/dev/null \
    | grep -vE "test-|dummy-|example-|<.*>|[$][{]|랜덤하고|YOUR_|REPLACE_" || true)
  [ -n "$m" ] && violations="$violations\n[$f] JWT_SECRET hardcoded:\n$m"

  # 패턴 5: Firebase service account private key
  m=$(grep -nE "BEGIN RSA PRIVATE KEY|BEGIN PRIVATE KEY" "$f" 2>/dev/null || true)
  [ -n "$m" ] && violations="$violations\n[$f] Private key PEM:\n$m"

  # 패턴 6: AWS access key
  m=$(grep -nE "AKIA[0-9A-Z]{16}" "$f" 2>/dev/null || true)
  [ -n "$m" ] && violations="$violations\n[$f] AWS access key:\n$m"

  # 패턴 7: Google API key
  m=$(grep -nE "['\"](AIza[A-Za-z0-9_-]{35})['\"]" "$f" 2>/dev/null \
    | grep -v "AIzaSyCxmgG3NEXsWtHKbE425dvq5EWs3WHXOh8" \
    || true)
  # AIza... 패턴은 Firebase Web API key 라서 클라이언트 노출 OK (브라우저 번들에 있음).
  # 다만 새로 추가되는 키는 의심 대상.
  [ -n "$m" ] && violations="$violations\n[$f] Possible Google API key (verify):\n$m"
done

if [ -n "$violations" ]; then
  echo ""
  echo "❌ Secret 누출 의심 — public repo 에 commit 시 영구 노출:"
  echo -e "$violations"
  echo ""
  echo "  🔧 해결:"
  echo "    1) Secret 을 환경변수로 옮기기 (wrangler secret put / CF Dashboard Variables)"
  echo "    2) 코드는 process.env / c.env 로 참조"
  echo "    3) 이미 commit 됐으면 즉시 secret 회전 + git history 정리 검토"
  echo ""
  echo "  ⚡ 정당한 사유 (예: 클라이언트 노출 OK 한 Firebase Web API key):"
  echo "     commit message 에 [SKIP_SECRET_CHECK] 추가"
  echo ""
  exit 1
fi

exit 0
