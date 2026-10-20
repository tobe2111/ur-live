#!/bin/bash
# ============================================================
# Service Worker 등록 코드 검출 — 2026-04-27 사고 재발 방지
# ============================================================
# 배경: vite-plugin-pwa 의 navigateFallback 이 OAuth redirect 차단 →
#       사이트 ERR_FAILED 사고 (2026-04-27).
# 본 스크립트는 다음 패턴이 코드에 다시 들어왔을 때 차단:
#   - vite-plugin-pwa import
#   - workbox-window import
#   - new Workbox(...)
#   - navigator.serviceWorker.register(...)
#
# 예외:
#   - public/sw.js (killer SW — 자기 자신 unregister)
#   - main.tsx 의 unregister 코드
#   - 본 스크립트 자체
# ============================================================

set -e

ERRORS=0

echo "🔍 Service Worker 등록 코드 검사 (2026-04-27 PWA 사고 재발 방지)..."

# 1. vite-plugin-pwa / workbox-window import 검출
PATTERN_IMPORT=$(grep -rEn "from ['\"](vite-plugin-pwa|workbox-window)['\"]" src/ vite.config.ts 2>/dev/null || true)
if [ -n "$PATTERN_IMPORT" ]; then
  echo "❌ vite-plugin-pwa / workbox-window import 발견 — 2026-04-27 사고 재발 위험!"
  echo "$PATTERN_IMPORT"
  ERRORS=$((ERRORS + 1))
fi

# 2. new Workbox(...) 호출 검출
PATTERN_WB=$(grep -rEn "new Workbox\(" src/ 2>/dev/null || true)
if [ -n "$PATTERN_WB" ]; then
  echo "❌ new Workbox() 호출 발견 — SW 등록 시도 금지"
  echo "$PATTERN_WB"
  ERRORS=$((ERRORS + 1))
fi

# 3. navigator.serviceWorker.register 검출
#    예외 (allowlist): 의도적으로 제한된 SW
#      - PushNotificationSetup.tsx (/push-sw.js — Web Push 알림 전용)
#      - main.tsx (/pwa-sw.js — 캐싱만, navigateFallback 없음 ✓ OAuth 안전)
PATTERN_REG=$(grep -rEn "navigator\.serviceWorker\.register\(" src/ 2>/dev/null \
  | grep -v "scripts/check-no-sw-register.sh" \
  | grep -v "PushNotificationSetup\.tsx" \
  | grep -v "main\.tsx" \
  || true)
if [ -n "$PATTERN_REG" ]; then
  echo "❌ navigator.serviceWorker.register() 호출 발견 (허용 리스트 외부)"
  echo "$PATTERN_REG"
  ERRORS=$((ERRORS + 1))
fi

# 4. package.json 에 vite-plugin-pwa / workbox 의존성 검출
PATTERN_PKG=$(grep -E '"(vite-plugin-pwa|workbox-window|workbox-build)"' package.json 2>/dev/null || true)
if [ -n "$PATTERN_PKG" ]; then
  echo "❌ package.json 에 PWA 의존성 발견"
  echo "$PATTERN_PKG"
  ERRORS=$((ERRORS + 1))
fi

if [ $ERRORS -eq 0 ]; then
  echo "✅ Service Worker 등록 코드 없음 (안전)"
  exit 0
else
  echo ""
  echo "🚨 $ERRORS 건 검출 — 2026-04-27 사고 재발 위험!"
  echo ""
  echo "PWA 재도입은 다음 조건 후 별도 PR 로:"
  echo "  1) redirect: 'follow' 명시 (OAuth 호환)"
  echo "  2) /auth/*, /oauth/*, /api/* denylist 추가"
  echo "  3) e2e 테스트로 카카오 로그인 흐름 사전 검증"
  echo "  4) 1주 prod 안정 확인"
  exit 1
fi
