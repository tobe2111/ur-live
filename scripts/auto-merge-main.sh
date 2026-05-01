#!/bin/bash
# auto-merge-main.sh — feature 브랜치 push 후 자동으로 main 에 머지 & 배포.
#
# Claude Code PostToolUse hook 으로 호출됨.
# 매 git push origin <feature-branch> 직후 실행.
#
# 🛡️ 2026-05-01: 이전 버전은 모든 에러를 silent (2>/dev/null) 처리해서
#   실패해도 알 수 없었음. 사용자 신고: "fix 했는데 production 에 반영 안 됨".
#   재작성 — 명시적 에러 로깅 + verification.

LOG_FILE="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/auto-merge.log"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
  echo "[auto-merge] $*"
}

CURRENT_BRANCH=$(git branch --show-current)

# main 브랜치 자체에서 호출된 경우 → 자기 자신 merge 불필요
if [ "$CURRENT_BRANCH" = "main" ] || [ -z "$CURRENT_BRANCH" ]; then
  log "skip: already on main or detached HEAD"
  exit 0
fi

# 머지 대상이 추적 브랜치인지 확인
if ! git rev-parse --verify "origin/$CURRENT_BRANCH" >/dev/null 2>&1; then
  log "skip: $CURRENT_BRANCH not yet on origin (push 안 됨?)"
  exit 0
fi

log "start merging $CURRENT_BRANCH → main"

# uncommitted changes 가드 — 있으면 stash
HAS_STASH=0
if ! git diff --quiet HEAD || ! git diff --cached --quiet; then
  log "warn: uncommitted changes detected — stashing"
  if git stash push -u -m "auto-merge-main temp stash" 2>&1 | tee -a "$LOG_FILE"; then
    HAS_STASH=1
  else
    log "error: stash 실패 — abort merge (사용자가 직접 처리 필요)"
    exit 1
  fi
fi

# main 으로 이동
if ! git checkout main 2>&1 | tee -a "$LOG_FILE"; then
  log "error: checkout main 실패"
  [ "$HAS_STASH" = "1" ] && git stash pop 2>&1 | tee -a "$LOG_FILE"
  exit 1
fi

# main 최신화
if ! git pull origin main --no-rebase --no-edit 2>&1 | tee -a "$LOG_FILE"; then
  log "warn: pull 실패 (네트워크 또는 conflict) — 진행 시도"
fi

# 머지 시도
if ! git merge "$CURRENT_BRANCH" --no-edit 2>&1 | tee -a "$LOG_FILE"; then
  log "error: merge conflict — abort 후 원래 브랜치 복귀"
  git merge --abort 2>&1 | tee -a "$LOG_FILE" || true
  git checkout "$CURRENT_BRANCH" 2>&1 | tee -a "$LOG_FILE"
  [ "$HAS_STASH" = "1" ] && git stash pop 2>&1 | tee -a "$LOG_FILE"
  exit 1
fi

# push (network 재시도 1회)
if git push origin main 2>&1 | tee -a "$LOG_FILE"; then
  log "✅ main push 완료"
else
  log "warn: 1차 push 실패 — 2초 후 재시도"
  sleep 2
  if git push origin main 2>&1 | tee -a "$LOG_FILE"; then
    log "✅ main push 완료 (재시도)"
  else
    log "❌ main push 실패 — 수동 확인 필요"
    git checkout "$CURRENT_BRANCH" 2>&1 | tee -a "$LOG_FILE"
    [ "$HAS_STASH" = "1" ] && git stash pop 2>&1 | tee -a "$LOG_FILE"
    exit 1
  fi
fi

# 원래 브랜치로 복귀
git checkout "$CURRENT_BRANCH" 2>&1 | tee -a "$LOG_FILE"
[ "$HAS_STASH" = "1" ] && git stash pop 2>&1 | tee -a "$LOG_FILE"

# Verification — main 최상위에 내 마지막 commit 이 있는지 확인
LAST_FEATURE_COMMIT=$(git rev-parse "$CURRENT_BRANCH")
if git merge-base --is-ancestor "$LAST_FEATURE_COMMIT" origin/main 2>/dev/null; then
  log "✅ verified: $LAST_FEATURE_COMMIT 가 origin/main 에 포함됨"
else
  log "❌ verification 실패: $LAST_FEATURE_COMMIT 가 origin/main 에 없음"
  exit 1
fi

log "==> main 자동 머지 & 배포 완료"
