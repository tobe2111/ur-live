#!/bin/bash
# PostToolUse hook — Bash tool 실행 후 git push 였다면 main 에 자동 머지.
#
# Claude Code 의 hook 표준 (현재): JSON payload 를 stdin 으로 전달.
#   {
#     "session_id": "...",
#     "tool_name": "Bash",
#     "tool_input": { "command": "git push origin foo", ... },
#     "tool_response": { ... }
#   }
#
# 🛡️ 2026-05-01: 이전 hook 은 $CLAUDE_TOOL_INPUT 환경변수를 사용했는데
#   현재 버전 Claude Code 가 그 변수를 안 세팅해서 hook 이 silent fail.
#   stdin JSON 파싱으로 안정화.

set -e

LOG_FILE="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/auto-merge.log"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [hook] $*" >> "$LOG_FILE"
}

# stdin JSON 읽기 (없으면 빈 문자열)
PAYLOAD=$(cat 2>/dev/null || echo "")

# tool_input.command 추출 — jq 있으면 사용, 없으면 grep fallback
COMMAND=""
if command -v jq >/dev/null 2>&1; then
  COMMAND=$(echo "$PAYLOAD" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")
fi
# fallback: grep raw JSON
if [ -z "$COMMAND" ] && [ -n "$PAYLOAD" ]; then
  COMMAND=$(echo "$PAYLOAD" | grep -oE '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//; s/"$//')
fi

# legacy env var fallback (구버전 Claude Code 호환)
if [ -z "$COMMAND" ] && [ -n "${CLAUDE_TOOL_INPUT:-}" ]; then
  COMMAND="$CLAUDE_TOOL_INPUT"
fi

if [ -z "$COMMAND" ]; then
  log "skip: no command in payload"
  exit 0
fi

# git push 였는지 판정 (origin main 직접 push 는 제외)
if ! echo "$COMMAND" | grep -qE 'git push.*origin'; then
  exit 0
fi
if echo "$COMMAND" | grep -qE 'git push (-[a-z]+ )*origin main'; then
  log "skip: pushing main directly"
  exit 0
fi

log "trigger: detected feature push — running auto-merge"
bash "${CLAUDE_PROJECT_DIR:-$(pwd)}/scripts/auto-merge-main.sh"
