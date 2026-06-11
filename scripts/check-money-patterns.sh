#!/usr/bin/env bash
# 🛡️ 2026-06-11 감사 후속: "후 감사 없이 처음부터 올바른 코드" — 이번 감사에서 반복 발견된
#   머니/정합성 버그 클래스를 커밋 시점에 자동 감지 (warn-only, 차단: STRICT_MONEY=1).
#
# 감지 패턴 (이번 감사에서 실제 돈이 새던 4가지 클래스):
#   1. 라우트 파일 inline DDL (ALTER/CREATE INDEX) 인데 파일에 WeakSet 메모이즈 없음
#      → per-request DDL (셀러 로그인 7 ALTER/요청 사고 패턴)
#   2. status = 'CANCELLED' 플립이 있는데 refund/환불 호출 없는 신규 코드 (휴리스틱)
#      → 무환불 취소 (고객 미환불 + 커미션 미역전 사고 패턴)
#
# CAS(claim-before-credit)/역전 대칭은 정적 감지가 불가 — CLAUDE.md "머니 코드 작성 룰" 참조.

set -uo pipefail
cd "$(dirname "$0")/.."

# staged 파일만 (pre-commit). 인자 없으면 라우트 전체.
if FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -E '\.(routes\.ts|ts)$' | grep -E 'src/(features|worker)/' || true); [ -z "$FILES" ]; then
  exit 0
fi

WARN=0

for f in $FILES; do
  [ -f "$f" ] || continue
  case "$f" in
    *repair-schema*|*migrations*|*test*) continue ;;
  esac

  # 1) inline DDL + 메모이즈 부재
  if grep -qE 'prepare\((`|")(\s)*(ALTER TABLE|CREATE INDEX)' "$f" 2>/dev/null; then
    if ! grep -q 'WeakSet' "$f" 2>/dev/null; then
      echo "⚠️  [money-patterns] $f: inline DDL(ALTER/CREATE INDEX) 발견 — WeakSet 메모이즈 없음."
      echo "    → 매 요청 DDL 실행 가능성. ensureXxx(DB) + WeakSet 패턴 사용 (예: seller.routes.ts ensureSellerColumns)."
      WARN=1
    fi
  fi

  # 2) 신규 추가 라인 중 무환불 CANCELLED 플립 (staged diff 의 + 라인만)
  ADDED=$(git diff --cached -U0 -- "$f" 2>/dev/null | grep -E '^\+' | grep -vE '^\+\+\+' || true)
  if echo "$ADDED" | grep -qE "status\s*=\s*'CANCELLED'" 2>/dev/null; then
    if ! echo "$ADDED" | grep -qiE "refund|환불|REFUND_REQUIRED|CAPTURED" 2>/dev/null; then
      echo "⚠️  [money-patterns] $f: status='CANCELLED' 추가됐는데 환불 경유 코드가 안 보임."
      echo "    → 결제 캡처된 주문의 취소는 refundOrderFully (Toss취소+전 커미션 역전) 경유 필수."
      echo "    → 미결제(PENDING) 취소만이면 무시 가능. CLAUDE.md '머니 코드 작성 룰' 참조."
      WARN=1
    fi
  fi
done

if [ "$WARN" = "1" ]; then
  echo ""
  echo "   머니 패턴 경고 — CLAUDE.md 의 '💸 머니/정합성 코드 작성 룰' 을 확인하세요."
  if [ "${STRICT_MONEY:-0}" = "1" ]; then exit 1; fi
fi
exit 0
