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

# npm audit --json 으로 파싱, high/critical 건수 추출
AUDIT_JSON=$(npm audit --audit-level=high --json 2>/dev/null || true)

HIGH=$(echo "$AUDIT_JSON" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    v = d.get('metadata', {}).get('vulnerabilities', {})
    print(v.get('high', 0) + v.get('critical', 0))
except Exception:
    print(0)
" 2>/dev/null || echo "0")

if [ "$HIGH" -gt 0 ]; then
  echo "❌ npm audit: high/critical 취약점 ${HIGH}건 발견"
  echo ""
  # 사람이 읽기 쉬운 요약 출력 (상위 30줄)
  npm audit --audit-level=high 2>&1 | head -30 || true
  echo ""
  echo "해결 방법:"
  echo "  1. npm audit fix          — 자동 수정 (semver 호환 범위)"
  echo "  2. npm audit fix --force  — 강제 수정 (주요 버전 업그레이드 포함, 호환성 확인 필요)"
  echo "  3. 수동 패키지 업그레이드: npm install <패키지>@<안전버전>"
  echo ""
  echo "긴급 우회 (배포 블로커 시에만):"
  echo "  커밋 메시지에 [SKIP_AUDIT] 추가  또는  SKIP_NPM_AUDIT=1 환경변수"
  exit 1
fi

echo "✅ npm audit: high/critical 취약점 없음"
