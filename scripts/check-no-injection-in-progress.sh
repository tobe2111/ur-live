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
#    (스크립트 본문·커밋 메시지 등)에 그 문자열이 있을 때 자기 자신에 걸린다.
#
# 🩸 **좁혔는데도 또 걸렸다** (2026-08-31 — 멀쩡한 커밋이 막혔다).
#    `/[n]ode .*check-guard-mutations\.mjs/` 는 argv **어디에든** 그 문자열이 있으면 잡는데,
#    `bash -c '... node --check scripts/check-guard-mutations.mjs && git commit ...'` 같은
#    **셸 래퍼의 argv 안에도** 있다. 즉 한 명령줄에 그 파일 이름을 언급만 해도 커밋이 막혔다.
#    (이 레포가 반복해 만난 "검사가 자기 자신을 잡는" 클래스 — 하필 그 검사기가 그러고 있었다.)
#
# ⇒ **argv 가 node 로 시작하는 프로세스만** 센다. 셸 래퍼는 `/bin/bash -c …` 로 시작해 안 걸린다.
#   그리고 소스를 **건드리지 않는 모드**(`--check` 구문검사 · `--map-only` 지도점검 ·
#   `--verify-clean` 잔재확인)는 제외한다 — 그것들이 도는 중엔 커밋해도 안전하다.
#
# 🧪 테스트 이음매: `--stdin` 이면 ps 를 부르지 않고 표준입력을 프로세스 목록으로 읽는다.
#    (실제 프로세스를 띄우지 않고 이 **판정**만 검증하기 위한 것 — `injection-guard.test.ts`)
if [ "${1:-}" = "--stdin" ]; then ps_out=$(cat); else ps_out=$(ps -eo args 2>/dev/null); fi
running=$(printf '%s\n' "$ps_out" \
  | awk '/^[^ ]*node( |$)/ && /check-guard-mutations\.mjs/ && !/--check/ && !/--map-only/ && !/--verify-clean/' \
  | wc -l)
if [ "${running:-0}" -gt 0 ]; then
  echo "❌ check-guard-mutations 가 실행 중이다 — 지금 커밋하면 **주입된 결함**이 담긴다."
  echo "   그 도구는 소스를 일부러 망가뜨렸다가 되돌린다. 지금 트리는 그 중간 상태일 수 있다."
  echo ""
  echo "   고치는 법: 주입기가 끝날 때까지 기다리거나, 끝낸 뒤 트리를 복원할 것:"
  echo "     pkill -f check-guard-mutations && git checkout -- src/"
  echo "   그리고 커밋 전에 확인:  git diff --stat   (의도한 변경만 있어야 한다)"
  exit 1
fi

# 🕳️ **이 검사에 구멍이 있었다 (2026-09-30 — 또 밟았다)**
#
# 위 판정은 *"주입기가 **지금 돌고 있나**"* 만 본다. 그런데 러너를 **강제 종료**하면(pkill·타임아웃·
# 크래시·OOM) 주입이 **소스에 남고** 프로세스는 없으니 이 검사가 **초록**을 낸다.
# 실제로 그랬다: `--changed` 전수를 pkill 한 뒤 `GroupBuyFeed.tsx` 에 주입이 남아 있었는데
# (선택 칩이 브랜드 블루 → 잉크로 되돌려진 상태) 이 검사는 rc=0 이었다.
# **커밋 직전 `git diff` 를 눈으로 봐서** 잡았다 — 눈에 의존하는 방어는 다음에 놓친다.
#
# 🔑 그런데 탐지기는 **이미 있었다**: `check-guard-mutations.mjs --verify-clean`
#    (주입 없이 문자열만 훑어 "지금 트리에 주입이 남아 있나" 를 본다 — 실측 **0.5초**, 2,248건).
#    만들어 두고 **어디에도 배선하지 않아서** 사람이 기억해야만 도는 도구였다
#    (이 레포가 반복해 당한 "가드가 있는데 안 돎" 클래스 — `check-guard-registry` 는
#     스크립트 단위로만 보므로 *모드* 가 유휴인 것은 못 잡는다).
#
# ⚠️ 이 검사가 **여전히 못 잡는 것**: 주입 목록에 없는 손상(직접 편집 실수) · `replace` 가 없는 주입.
#    그건 `git diff --stat` 을 눈으로 보는 일이 계속 맡는다.
if [ "${1:-}" != "--stdin" ] && [ -f scripts/check-guard-mutations.mjs ]; then
  if ! node scripts/check-guard-mutations.mjs --verify-clean; then
    echo ""
    echo "❌ 주입 **잔재**가 작업트리에 남아 있다 — 강제 종료된 러너가 되돌리지 못한 것이다."
    echo "   지금 커밋하면 그 결함이 그대로 담긴다(2026-08-25 실사고와 같은 클래스)."
    echo "   고치는 법:  git checkout -- src/   (그 뒤 git diff --stat 으로 의도한 변경만 남았는지 확인)"
    exit 1
  fi
fi
exit 0
