#!/bin/bash
# verify-deploy.sh — 현재 live.ur-team.com 배포 상태 진단
#
# 사용법:
#   bash scripts/verify-deploy.sh
#   bash scripts/verify-deploy.sh --admin-token <JWT>  # admin endpoint 추가 검증
#
# 2026-04-22 사고 이후 추가. 로그인 500 같은 문제 발생 시
# "코드 문제인가, 배포 문제인가?"를 30초 안에 구분.
#
# 2026-04-27 보강: TD-006 분리된 라우터 / 신규 endpoint 검증 추가.

set -e
PROD="https://live.ur-team.com"
ADMIN_TOKEN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --admin-token) ADMIN_TOKEN="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo "===================================================="
echo "  Cloudflare Pages 배포 상태 진단"
echo "===================================================="
echo ""

echo "[1/4] 프로덕션 응답 체크..."
homepage_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$PROD/" || echo "timeout")
health_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$PROD/api/health" || echo "timeout")
version_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$PROD/api/version" || echo "timeout")
echo "  / → $homepage_status"
echo "  /api/health → $health_status"
echo "  /api/version → $version_status"

echo ""
echo "[2/4] 자가 진단 엔드포인트 확인 (커밋 8b82323 이후)..."
whoami_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$PROD/api/debug/whoami" || echo "timeout")
build_info_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$PROD/api/debug/build-info" || echo "timeout")
# admin-gated 이므로 401(존재함, 인증 필요)도 "최신 코드 반영" 시그널.
# 404만 "엔드포인트 없음 = 구 배포" 로 판정.
whoami_exists="❌ 최신 배포 미반영"
if [ "$whoami_status" = "401" ] || [ "$whoami_status" = "200" ]; then
  whoami_exists="✅ 최신 코드 반영 (admin gated)"
fi
build_info_exists="❌ 최신 배포 미반영"
if [ "$build_info_status" = "401" ] || [ "$build_info_status" = "200" ]; then
  build_info_exists="✅ 최신 코드 반영 (admin gated)"
fi
echo "  /api/debug/whoami → $whoami_status  $whoami_exists"
echo "  /api/debug/build-info → $build_info_status  $build_info_exists"

echo ""
echo "[3/4] 로그인 엔드포인트 상태..."
user_login=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$PROD/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"wrong"}' || echo "timeout")
seller_login=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$PROD/api/seller/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"wrong"}' || echo "timeout")
admin_login=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$PROD/api/admin/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"wrong"}' || echo "timeout")
echo "  유저 로그인: $user_login  $([ "$user_login" = "500" ] && echo "❌ 서버 에러 (JWT/DB 미설정 의심)" || [ "$user_login" = "401" ] && echo "✅ 정상 (인증 실패는 예상 응답)" || echo "상태: $user_login")"
echo "  셀러 로그인: $seller_login  $([ "$seller_login" = "500" ] && echo "❌ 서버 에러" || [ "$seller_login" = "401" ] && echo "✅ 정상" || echo "상태: $seller_login")"
echo "  어드민 로그인: $admin_login  $([ "$admin_login" = "500" ] && echo "❌ 서버 에러" || [ "$admin_login" = "401" ] && echo "✅ 정상" || echo "상태: $admin_login")"

echo ""
echo "[4/4] 진단 종합..."
all_login_500=false
if [ "$user_login" = "500" ] && [ "$seller_login" = "500" ] && [ "$admin_login" = "500" ]; then
  all_login_500=true
fi

if [ "$whoami_status" = "404" ] && [ "$build_info_status" = "404" ]; then
  echo "❌ 최신 코드가 프로덕션에 반영 안 됨"
  echo "   → GitHub Actions 최근 run 성공 여부 확인"
  echo "   → 또는 Cloudflare Pages Dashboard → Deployments 탭에서 최근 커밋 promote"
elif [ "$all_login_500" = true ]; then
  echo "❌ 모든 로그인 500 — secret 미설정 매우 유력"
  echo "   → Cloudflare Dashboard → ur-live (Pages) → Settings → Secrets"
  echo "   → JWT_SECRET, REFRESH_TOKEN_SECRET 등이 Pages 쪽에 있는지 확인"
  echo "   → 없으면 값 생성 후 추가 (openssl rand -base64 32)"
elif [ "$homepage_status" = "200" ] && ([ "$user_login" = "401" ] || [ "$seller_login" = "401" ]); then
  echo "✅ 프로덕션 정상 — 인증 플로우 작동 중"
else
  echo "⚠️  부분적 이슈 — 개별 엔드포인트 확인 필요"
fi

echo ""
echo "[5/5] TD-006 분할 라우터 + 신규 endpoint..."
sitemap_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$PROD/sitemap.xml" || echo "timeout")
docs_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$PROD/docs" || echo "timeout")
sw_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$PROD/sw.js" || echo "timeout")
echo "  /sitemap.xml → $sitemap_status  $([ "$sitemap_status" = "200" ] && echo "✅ TD-006 sitemap 분리 정상" || echo "⚠️ 확인 필요")"
echo "  /docs → $docs_status  $([ "$docs_status" = "200" ] && echo "✅ Swagger UI 정상" || echo "⚠️ 확인 필요")"
echo "  /sw.js (Killer SW) → $sw_status  $([ "$sw_status" = "200" ] && echo "✅ PWA 사고 방지 동작 중" || echo "⚠️ 확인 필요")"

if [ -n "$ADMIN_TOKEN" ]; then
  echo ""
  echo "[6/5] Admin 검증 (--admin-token 제공됨)..."
  mig_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$PROD/api/_internal/migration-status" || echo "timeout")
  health_dash=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$PROD/api/_internal/health-dashboard" || echo "timeout")
  echo "  /api/_internal/migration-status → $mig_status  $([ "$mig_status" = "200" ] && echo "✅" || echo "❌ admin token 만료/무효 의심")"
  echo "  /api/_internal/health-dashboard → $health_dash  $([ "$health_dash" = "200" ] && echo "✅" || echo "❌")"
  if [ "$mig_status" = "200" ]; then
    mig_body=$(curl -s --max-time 10 -H "Authorization: Bearer $ADMIN_TOKEN" "$PROD/api/_internal/migration-status")
    applied=$(echo "$mig_body" | grep -oE '"applied":[0-9]+' | head -1 | grep -oE '[0-9]+')
    total=$(echo "$mig_body" | grep -oE '"total":[0-9]+' | head -1 | grep -oE '[0-9]+')
    echo "  마이그레이션 적용: $applied / $total"
    if [ -n "$applied" ] && [ -n "$total" ] && [ "$applied" != "$total" ]; then
      echo "  ⚠️ 누락 migration 존재 — TD-001 진행 후 재실행"
    fi
  fi
fi

echo ""
echo "===================================================="
