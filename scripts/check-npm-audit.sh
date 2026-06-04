#!/bin/bash
# check-npm-audit.sh — npm audit high/critical severity 취약점 차단
#
# pre-commit hook 및 deploy-production.sh 에서 호출됨.
# high/critical 취약점 발견 시 exit 1 (커밋/배포 차단).
#
# 우회 (긴급 핫픽스 전용):
#   커밋 메시지에 [SKIP_AUDIT] 포함 시 audit 건너뜀
#   환경변수: SKIP_NPM_AUDIT=1

set -euo pipefail

# 긴급 우회 — 환경변수
if [ "${SKIP_NPM_AUDIT:-0}" = "1" ]; then
  echo "⚠️  npm audit 건너뜀 (SKIP_NPM_AUDIT=1)"
  exit 0
fi

# 긴급 우회 — 커밋 메시지 (pre-commit hook 에서만 유효)
if [ -f ".git/COMMIT_EDITMSG" ]; then
  if grep -q '\[SKIP_AUDIT\]' .git/COMMIT_EDITMSG 2>/dev/null; then
    echo "⚠️  npm audit 건너뜀 ([SKIP_AUDIT] 커밋 메시지 감지)"
    exit 0
  fi
fi

echo "==> 의존성 취약점 검사 중..."

# npm audit --json 으로 파싱, high/critical advisory(GHSA) 단위로 추출.
# .audit-allowlist.json 에 등재된 GHSA 는 차단에서 제외(도달불가/오탐만 — 사유/승인자/날짜 명시).
# 그 외 새 high/critical advisory 는 그대로 차단.
AUDIT_JSON=$(npm audit --audit-level=high --json 2>/dev/null || true)

# python3 로 (전체 high/critical GHSA 집합) - (allowlist GHSA) = 잔여 차단 대상 계산.
BLOCKING=$(echo "$AUDIT_JSON" | python3 -c "
import sys, json, os

try:
    d = json.load(sys.stdin)
except Exception:
    print('')  # 파싱 실패 시 빈 출력 = 통과 (audit 자체 미동작)
    sys.exit(0)

# allowlist 로드
allow = set()
try:
    with open('.audit-allowlist.json') as f:
        al = json.load(f)
    for e in al.get('allow', []):
        if e.get('ghsa'):
            allow.add(e['ghsa'].strip())
except FileNotFoundError:
    pass
except Exception:
    pass  # allowlist 깨졌으면 무시(= 아무것도 허용 안 함 → 안전쪽)

# high/critical advisory GHSA 수집 (via 객체의 url 에서 GHSA-xxxx 추출)
blocking = {}  # ghsa -> (pkg, severity, title)
for pkg, v in d.get('vulnerabilities', {}).items():
    for via in v.get('via', []):
        if not isinstance(via, dict):
            continue
        sev = via.get('severity')
        if sev not in ('high', 'critical'):
            continue
        url = via.get('url', '') or ''
        ghsa = url.rstrip('/').split('/')[-1] if 'GHSA' in url else ''
        if not ghsa:
            ghsa = 'src-' + str(via.get('source', 'unknown'))
        if ghsa in allow:
            continue
        blocking[ghsa] = (pkg, sev, via.get('title', ''))

for ghsa, (pkg, sev, title) in blocking.items():
    print(f'{sev}\t{pkg}\t{ghsa}\t{title}')
" 2>/dev/null || echo "")

if [ -n "$BLOCKING" ]; then
  COUNT=$(echo "$BLOCKING" | grep -c '' || echo "0")
  echo "❌ npm audit: 허용목록에 없는 high/critical 취약점 ${COUNT}건 발견"
  echo ""
  echo "$BLOCKING" | while IFS=$'\t' read -r sev pkg ghsa title; do
    echo "  [$sev] $pkg ($ghsa) — $title"
  done
  echo ""
  echo "해결 방법:"
  echo "  1. npm audit fix          — 자동 수정 (semver 호환 범위)"
  echo "  2. npm install <패키지>@<안전버전>  — 수동 업그레이드 (권장)"
  echo "  3. npm overrides (package.json) — transitive 의존성 강제 패치"
  echo ""
  echo "도달 불가/오탐이라 판단되면 .audit-allowlist.json 에 GHSA 등재 (사유/승인자/날짜 필수)."
  echo "긴급 우회 (배포 블로커 시에만): 커밋 메시지 [SKIP_AUDIT]  또는  SKIP_NPM_AUDIT=1"
  exit 1
fi

echo "✅ npm audit: 차단 대상 high/critical 없음 (allowlist 적용)"
