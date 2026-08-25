#!/usr/bin/env bash
# 🚨 **주입 검증이 도는 중에는 커밋하지 마라** (2026-08-25 실사고로 신설)
#
# `check-guard-mutations.mjs` 는 소스에 결함을 **일부러 주입했다가 되돌린다.** 그 사이
# `git status` 는 "수정됨"으로 보이고 `git add -A` 는 그 결함을 그대로 담는다.
#
# 실사고: 커밋 `721edf1` 이 백업의 읽기-실패 처리를 되돌린 채 올라갔다.
#   - readFail = `${t} rowid>${last}: …`   ← 실패를 실패로 다루는 코드
#   + void e; rows = []                     ← 실패를 삼키고 남은 행을 건너뜀
# 그날 오전에 고친 것을 정확히 되돌리는 주입이었고, **커밋한 뒤에야** 알았다.
# (CI 유닛테스트가 잡았다 — 그 주입이 겨냥한 바로 그 테스트다. 안 잡혔으면 머지됐다.)
#
# 이 검사는 pre-commit 에서 돌며, 주입기가 실행 중이면 **커밋을 막는다.**
# 우회: 정말 필요하면 프로세스를 먼저 끝내라. 커밋 메시지 우회는 두지 않는다 —
#       "지금은 괜찮겠지"가 이 사고의 원인이었다.

# ⚠️ **자기 자신을 세지 않도록** 패턴을 좁힌다. 넓게 잡으면 이 검사를 실행하는 셸의 argv
#    (스크립트 본문·커밋 메시지 등)에 그 문자열이 있을 때 자기 자신에 걸린다 — 실제로 걸렸다.
#    `node …/check-guard-mutations.mjs` 형태의 **실행**만 센다.
running=$(ps -eo args 2>/dev/null | awk '/[n]ode .*check-guard-mutations\.mjs/ && !/awk/' | wc -l)
if [ "${running:-0}" -gt 0 ]; then
  echo "❌ check-guard-mutations 가 실행 중이다 — 지금 커밋하면 **주입된 결함**이 담긴다."
  echo "   그 도구는 소스를 일부러 망가뜨렸다가 되돌린다. 지금 트리는 그 중간 상태일 수 있다."
  echo ""
  echo "   고치는 법: 주입기가 끝날 때까지 기다리거나, 끝낸 뒤 트리를 복원할 것:"
  echo "     pkill -f check-guard-mutations && git checkout -- src/"
  echo "   그리고 커밋 전에 확인:  git diff --stat   (의도한 변경만 있어야 한다)"
  exit 1
fi
exit 0
