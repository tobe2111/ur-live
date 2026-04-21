#!/bin/bash
# auto-merge-main.sh — feature 브랜치 push 후 자동으로 main에 머지 & 배포
# Claude Code hook으로 사용됨

set -e

CURRENT_BRANCH=$(git branch --show-current)

# main 브랜치가 아닌 경우에만 실행
if [ "$CURRENT_BRANCH" = "main" ]; then
  exit 0
fi

# main으로 체크아웃 → 머지 → 푸시 → 원래 브랜치로 복귀
git checkout main 2>/dev/null
git pull origin main --no-rebase --no-edit 2>/dev/null || true
git merge "$CURRENT_BRANCH" --no-edit 2>/dev/null

if git push origin main 2>/dev/null; then
  echo "==> main에 자동 머지 & 배포 완료"
else
  # 네트워크 에러 시 재시도
  sleep 2
  git push origin main 2>/dev/null || echo "==> main 푸시 실패 (수동 확인 필요)"
fi

git checkout "$CURRENT_BRANCH" 2>/dev/null
