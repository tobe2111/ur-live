#!/bin/bash

# 웹 환경에서만 실행
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# 🛡️ 2026-11-01: **git 검사(pre-commit · pre-push)를 매 세션 자동 설치한다.**
#   컨테이너는 매번 새로 만들어지고 `.git/hooks/` 는 클론에 안 딸려 온다. 종전엔 CLAUDE.md 와
#   `.claude/agents/dev.md` 에 "세션마다 직접 돌려라" 라고만 적혀 있었고, 잊은 세션은 로컬 검사 없이
#   커밋해 **오류를 CI 에서야(최소 26분 뒤) 처음 봤다** — 규칙만 있고 강제가 없던 자리다.
#   ⚠️ **반드시 이 자리(맨 앞)에 둔다** — 아래는 스크래퍼가 이미 돌거나 설치가 실패하면 중간에
#   `exit 0` 한다. 끝에 두면 그 경우 조용히 안 깔린다.
if [ -f "$CLAUDE_PROJECT_DIR/scripts/install-git-hooks.sh" ]; then
  if (cd "$CLAUDE_PROJECT_DIR" && bash scripts/install-git-hooks.sh >/dev/null 2>&1); then
    echo "==> git 검사(pre-commit·pre-push) 설치 완료"
  else
    echo "==> ⚠️ git 검사 설치 실패 — 커밋 전에 직접: bash scripts/install-git-hooks.sh"
  fi
fi

echo "==> naver-ad-scraper 의존성 설치 중..."
cd "$CLAUDE_PROJECT_DIR/naver-ad-scraper"
npm install --silent || true

# 🛡️ 2026-07-05: npm 레지스트리 정책(403 등)으로 설치가 실패하면 서버 기동을 건너뜀 —
#   의존성 없이 node 를 띄우면 ERR_MODULE_NOT_FOUND 크래시가 매 세션 노이즈로 남음.
if [ ! -d node_modules/p-queue ]; then
  echo "==> 경고: 의존성 설치 실패(레지스트리 정책 403 가능) — 스크래퍼 서버 기동 스킵 (세션 작업엔 영향 없음)"
  exit 0
fi

echo "==> 스크래퍼 서버 확인 중 (포트 3456)..."

# 이미 실행 중이면 스킵
if curl -sf http://localhost:3456/api/status > /dev/null 2>&1; then
  echo "==> 스크래퍼 서버 이미 실행 중"
  exit 0
fi

# 시스템 Chromium 경로 탐색 (set -e 없이 안전하게)
CHROMIUM_PATH=""
for candidate in \
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" \
  "/opt/pw-browsers/chromium/chrome-linux/chrome"; do
  if [ -x "$candidate" ]; then
    CHROMIUM_PATH="$candidate"
    break
  fi
done

# 위 경로에 없으면 find로 탐색
if [ -z "$CHROMIUM_PATH" ]; then
  CHROMIUM_PATH=$(find /opt/pw-browsers -name "chrome" -type f -executable 2>/dev/null | head -1 || true)
fi

echo "==> Chromium: ${CHROMIUM_PATH:-시스템 기본값 사용}"

# 환경변수 세션에 내보내기
if [ -n "${CLAUDE_ENV_FILE:-}" ] && [ -n "$CHROMIUM_PATH" ]; then
  echo "export CHROMIUM_PATH=\"$CHROMIUM_PATH\"" >> "$CLAUDE_ENV_FILE"
fi

# 백그라운드 서버 시작
CHROMIUM_PATH="$CHROMIUM_PATH" PORT=3456 \
  nohup node "$CLAUDE_PROJECT_DIR/naver-ad-scraper/src/server.js" \
  > /tmp/scraper-server.log 2>&1 &

echo $! > /tmp/scraper-server.pid
echo "==> 서버 시작 대기 중..."

# 최대 10초 대기
for i in $(seq 1 10); do
  sleep 1
  if curl -sf http://localhost:3456/api/status > /dev/null 2>&1; then
    echo "==> 스크래퍼 서버 시작 완료 (http://localhost:3456)"
    exit 0
  fi
done

echo "==> 경고: 서버 응답 없음. 로그: /tmp/scraper-server.log"
cat /tmp/scraper-server.log || true
exit 0
