# 🗑️ Cloudflare Pages 프로젝트 삭제 - 배포 히스토리 정리 가이드

## ⚠️ 문제 상황

```
Your project has too many deployments to be deleted, 
follow this guide to delete them: https://cfl.re/3CXesln
```

**원인**: 프로젝트에 너무 많은 배포 히스토리가 쌓여있어서 프로젝트 삭제가 차단됨

---

## 🔧 해결 방법

### 방법 1: Wrangler CLI로 배포 히스토리 삭제 (권장, 5~10분)

#### Step 1: Wrangler 로그인
```bash
cd /home/user/webapp
npx wrangler login
```

#### Step 2: 삭제할 프로젝트의 배포 목록 확인
```bash
# ur-live (No Git connection) 프로젝트
npx wrangler pages deployment list --project-name=ur-live

# ur-live-global (No Git connection) 프로젝트  
npx wrangler pages deployment list --project-name=ur-live-global

# toss-live-commerce 프로젝트
npx wrangler pages deployment list --project-name=toss-live-commerce
```

#### Step 3: 모든 배포 삭제 (스크립트)
```bash
# ur-live 프로젝트의 모든 배포 삭제
PROJECT_NAME="ur-live"
npx wrangler pages deployment list --project-name=$PROJECT_NAME --format=json | \
  jq -r '.[].id' | \
  while read deployment_id; do
    echo "Deleting deployment: $deployment_id"
    npx wrangler pages deployment delete $deployment_id --project-name=$PROJECT_NAME
  done

# ur-live-global 프로젝트
PROJECT_NAME="ur-live-global"
npx wrangler pages deployment list --project-name=$PROJECT_NAME --format=json | \
  jq -r '.[].id' | \
  while read deployment_id; do
    echo "Deleting deployment: $deployment_id"
    npx wrangler pages deployment delete $deployment_id --project-name=$PROJECT_NAME
  done

# toss-live-commerce 프로젝트
PROJECT_NAME="toss-live-commerce"
npx wrangler pages deployment list --project-name=$PROJECT_NAME --format=json | \
  jq -r '.[].id' | \
  while read deployment_id; do
    echo "Deleting deployment: $deployment_id"
    npx wrangler pages deployment delete $deployment_id --project-name=$PROJECT_NAME
  done
```

#### Step 4: 프로젝트 삭제
배포 히스토리를 모두 삭제한 후:
1. https://dash.cloudflare.com/ 접속
2. Workers & Pages → 해당 프로젝트
3. Settings → Delete project

---

### 방법 2: Cloudflare Dashboard에서 수동 삭제 (느림, 30분~1시간)

#### Step 1: 프로젝트 접속
1. https://dash.cloudflare.com/
2. Workers & Pages
3. 삭제할 프로젝트 클릭 (예: ur-live No Git connection)

#### Step 2: 배포 삭제
1. **Deployments** 탭 클릭
2. 각 deployment의 **...** 메뉴 → **Delete**
3. 모든 배포를 하나씩 삭제 (시간 소요)

#### Step 3: 프로젝트 삭제
모든 배포 삭제 후:
- Settings → Delete project

---

## 🚀 자동화 스크립트 (추천)

아래 스크립트를 실행하면 3개 프로젝트의 배포를 모두 삭제합니다:

```bash
cd /home/user/webapp

# cleanup-cloudflare-deployments.sh 파일 생성
cat > cleanup-cloudflare-deployments.sh << 'SCRIPT_END'
#!/bin/bash

set -e

echo "🗑️  Cloudflare Pages 배포 히스토리 정리 시작"
echo ""

# 삭제할 프로젝트 목록
PROJECTS=(
  "ur-live"
  "ur-live-global"
  "toss-live-commerce"
)

for PROJECT_NAME in "${PROJECTS[@]}"; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📦 프로젝트: $PROJECT_NAME"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # 배포 목록 가져오기
  echo "📋 배포 목록 조회 중..."
  DEPLOYMENTS=$(npx wrangler pages deployment list --project-name=$PROJECT_NAME 2>&1 || true)
  
  if echo "$DEPLOYMENTS" | grep -q "No deployments found"; then
    echo "✅ 배포 없음 - 건너뛰기"
    echo ""
    continue
  fi
  
  if echo "$DEPLOYMENTS" | grep -q "not found"; then
    echo "⚠️  프로젝트를 찾을 수 없음 - 건너뛰기"
    echo ""
    continue
  fi
  
  # jq가 있으면 JSON 파싱, 없으면 수동 파싱
  if command -v jq &> /dev/null; then
    echo "🔍 배포 ID 추출 중 (jq 사용)..."
    DEPLOYMENT_IDS=$(npx wrangler pages deployment list --project-name=$PROJECT_NAME --format=json 2>/dev/null | jq -r '.[].id' || echo "")
  else
    echo "⚠️  jq가 없어서 수동 삭제가 필요합니다"
    echo "   설치: apt-get install jq (또는 brew install jq)"
    DEPLOYMENT_IDS=""
  fi
  
  if [ -z "$DEPLOYMENT_IDS" ]; then
    echo "⚠️  삭제할 배포가 없거나 조회 실패"
    echo ""
    continue
  fi
  
  # 배포 삭제
  COUNT=0
  while IFS= read -r deployment_id; do
    if [ ! -z "$deployment_id" ]; then
      COUNT=$((COUNT + 1))
      echo "  🗑️  Deleting deployment $COUNT: $deployment_id"
      npx wrangler pages deployment delete $deployment_id --project-name=$PROJECT_NAME 2>&1 || echo "    ⚠️  삭제 실패"
    fi
  done <<< "$DEPLOYMENT_IDS"
  
  echo "✅ $PROJECT_NAME 프로젝트 배포 $COUNT개 삭제 완료"
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 모든 배포 히스토리 정리 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 다음 단계:"
echo "  1. Cloudflare Dashboard 접속"
echo "     https://dash.cloudflare.com/"
echo ""
echo "  2. Workers & Pages → 각 프로젝트 선택"
echo ""
echo "  3. Settings → Delete project"
echo ""
SCRIPT_END

# 실행 권한 부여
chmod +x cleanup-cloudflare-deployments.sh

# 스크립트 실행
./cleanup-cloudflare-deployments.sh
```

---

## ⚠️ 주의사항

### 1. 올바른 프로젝트 확인
삭제 전 반드시 확인:
- ❌ 삭제: `ur-live` (No Git connection)
- ❌ 삭제: `ur-live-global` (No Git connection)  
- ❌ 삭제: `toss-live-commerce`
- ✅ 유지: `ur-live` (GitHub 연결) - live.ur-team.com
- ✅ 유지: `ur-live-global` (GitHub 연결) - world.ur-team.com

### 2. jq 설치 필요
배포 ID 추출을 위해 jq 필요:
```bash
# Ubuntu/Debian
sudo apt-get install jq

# macOS
brew install jq

# 또는 Node.js로 JSON 파싱
npx wrangler pages deployment list --project-name=ur-live --format=json | node -e "require('fs').readFileSync(0).toString().split('\\n').forEach(line => { try { const d = JSON.parse(line); console.log(d.id); } catch(e) {} })"
```

### 3. 시간 소요
- 배포 1개 삭제: ~2초
- 배포 100개: ~3~4분
- 배포 500개: ~15~20분

---

## 🔍 문제 해결

### "Project not found" 오류
프로젝트 이름이 정확하지 않은 경우:
```bash
# 모든 프로젝트 목록 확인
npx wrangler pages list
```

### "Unauthorized" 오류
다시 로그인:
```bash
npx wrangler logout
npx wrangler login
```

### 수동으로 배포 ID 확인
```bash
npx wrangler pages deployment list --project-name=ur-live
```

출력 예시:
```
ID                      Created             Environment
abc123def456           2026-03-05 07:00    Production
xyz789ghi012           2026-03-04 18:30    Production
...
```

수동 삭제:
```bash
npx wrangler pages deployment delete abc123def456 --project-name=ur-live
npx wrangler pages deployment delete xyz789ghi012 --project-name=ur-live
```

---

## 📋 체크리스트

### 배포 정리
- [ ] Wrangler 로그인 완료
- [ ] jq 설치 (선택)
- [ ] cleanup-cloudflare-deployments.sh 스크립트 실행
- [ ] ur-live (No Git connection) 배포 삭제
- [ ] ur-live-global (No Git connection) 배포 삭제
- [ ] toss-live-commerce 배포 삭제

### 프로젝트 삭제
- [ ] Cloudflare Dashboard 접속
- [ ] ur-live (No Git connection) 프로젝트 삭제
- [ ] ur-live-global (No Git connection) 프로젝트 삭제
- [ ] toss-live-commerce 프로젝트 삭제

### 확인
- [ ] 남은 프로젝트 2개만 있는지 확인
- [ ] ur-live (GitHub 연결) 유지
- [ ] ur-live-global (GitHub 연결) 유지

---

## ⏱️ 예상 소요 시간

| 작업 | 시간 |
|------|------|
| Wrangler 로그인 | 1분 |
| jq 설치 (필요시) | 1분 |
| 스크립트 실행 (배포 삭제) | 5~15분 |
| 프로젝트 삭제 (Dashboard) | 2~3분 |
| **합계** | **9~20분** |

---

## 🔗 참고 링크

- Cloudflare 가이드: https://cfl.re/3CXesln
- Wrangler Docs: https://developers.cloudflare.com/workers/wrangler/
- Pages Deployment API: https://developers.cloudflare.com/api/operations/pages-deployment-delete-deployment

---

**작성일**: 2026-03-05  
**목적**: 배포 히스토리가 많은 프로젝트 삭제 방법  
**상태**: ⏳ 스크립트 실행 필요
