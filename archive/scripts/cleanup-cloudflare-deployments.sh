#!/bin/bash

set -e

echo "🗑️  Cloudflare Pages 배포 히스토리 정리 시작"
echo ""
echo "⚠️  주의: 이 스크립트는 아래 프로젝트의 모든 배포를 삭제합니다:"
echo "  - ur-live (No Git connection)"
echo "  - ur-live-global (No Git connection)"
echo "  - toss-live-commerce"
echo ""
read -p "계속하시겠습니까? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 취소됨"
    exit 1
fi
echo ""

# Wrangler 로그인 확인
echo "🔐 Wrangler 로그인 확인 중..."
if ! npx wrangler whoami &> /dev/null; then
    echo "⚠️  로그인이 필요합니다"
    npx wrangler login
fi
echo "✅ 로그인 완료"
echo ""

# 삭제할 프로젝트 목록
PROJECTS=(
  "ur-live"
  "ur-live-global"
  "toss-live-commerce"
)

TOTAL_DELETED=0

for PROJECT_NAME in "${PROJECTS[@]}"; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📦 프로젝트: $PROJECT_NAME"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # 배포 목록 조회
  echo "📋 배포 목록 조회 중..."
  
  # JSON 형식으로 배포 목록 가져오기
  DEPLOYMENTS_JSON=$(npx wrangler pages deployment list --project-name="$PROJECT_NAME" 2>&1 || true)
  
  # 에러 체크
  if echo "$DEPLOYMENTS_JSON" | grep -q "not found\|No deployments found"; then
    echo "⚠️  프로젝트를 찾을 수 없거나 배포가 없음 - 건너뛰기"
    echo ""
    continue
  fi
  
  # 배포 ID 추출 (텍스트 파싱)
  # 출력 형식: ID                      Created             Environment
  DEPLOYMENT_IDS=$(echo "$DEPLOYMENTS_JSON" | grep -v "ID\|Created\|Environment\|^$\|^─" | awk '{print $1}' | grep -v "^$" || echo "")
  
  if [ -z "$DEPLOYMENT_IDS" ]; then
    echo "✅ 삭제할 배포가 없음"
    echo ""
    continue
  fi
  
  # 배포 삭제
  COUNT=0
  echo "$DEPLOYMENT_IDS" | while read -r deployment_id; do
    if [ ! -z "$deployment_id" ]; then
      COUNT=$((COUNT + 1))
      echo "  🗑️  Deleting deployment: $deployment_id"
      
      # 배포 삭제 (에러 무시)
      npx wrangler pages deployment delete "$deployment_id" --project-name="$PROJECT_NAME" 2>&1 | grep -v "Deleting deployment" || true
      
      # 진행률 표시
      if [ $((COUNT % 10)) -eq 0 ]; then
        echo "     ... $COUNT개 삭제됨"
      fi
    fi
  done
  
  # 삭제된 개수 계산
  DELETED_COUNT=$(echo "$DEPLOYMENT_IDS" | wc -l | tr -d ' ')
  TOTAL_DELETED=$((TOTAL_DELETED + DELETED_COUNT))
  
  echo "✅ $PROJECT_NAME: $DELETED_COUNT개 배포 삭제 완료"
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 배포 히스토리 정리 완료!"
echo "   총 $TOTAL_DELETED개 배포 삭제됨"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 다음 단계:"
echo "  1. Cloudflare Dashboard 접속"
echo "     https://dash.cloudflare.com/"
echo ""
echo "  2. Workers & Pages → 각 프로젝트 선택"
echo ""
echo "  3. Settings → Delete project"
echo "     - ur-live (No Git connection)"
echo "     - ur-live-global (No Git connection)"
echo "     - toss-live-commerce"
echo ""
echo "⚠️  주의: GitHub 연결된 ur-live, ur-live-global은 삭제하지 마세요!"
echo ""
