# 🚀 배포 문제 해결 가이드

## 📋 현재 상황
- **문제**: GitHub Actions 배포가 1시간 전부터 실패
- **영향**: live.ur-team.com에 최신 업데이트 미반영
- **마지막 성공 커밋**: `acc73cf1`
- **배포 대기 중**: `ee1bffe0` (Admin Products Management)

---

## 🔍 배포 실패 원인 분석

### 1️⃣ **GitHub Actions 권한 문제**
```
❌ refusing to allow a GitHub App to create or update workflow `.github/workflows/main.yml` without `workflows` permission
```
- GitHub App이 워크플로우 파일 수정 권한 없음
- 해결: 수동으로 워크플로우 수정 필요 (웹 UI 사용)

### 2️⃣ **가능한 원인들**
- ❌ CLOUDFLARE_API_TOKEN 만료 또는 잘못된 값
- ❌ CLOUDFLARE_ACCOUNT_ID 누락 또는 잘못된 값
- ❌ 빌드 중 메모리 부족 (OOM)
- ❌ Wrangler CLI 버전 문제
- ❌ Cloudflare Pages 서비스 일시적 장애

---

## ✅ 해결 방법

### **방법 1: GitHub Secrets 확인 및 갱신**

#### 1️⃣ GitHub 저장소 설정 확인
```
1. GitHub 저장소 → Settings → Secrets and variables → Actions
2. CLOUDFLARE_API_TOKEN 확인:
   - 존재하는지 확인
   - 만료되지 않았는지 확인
3. CLOUDFLARE_ACCOUNT_ID 확인:
   - 존재하는지 확인
   - 올바른 Account ID인지 확인
```

#### 2️⃣ Cloudflare API Token 재생성
```
1. https://dash.cloudflare.com 접속
2. My Profile → API Tokens
3. "Create Token" → "Edit Cloudflare Workers" 템플릿 선택
4. Permissions:
   - Account > Cloudflare Pages > Edit
   - User > User Details > Read
5. Account Resources: Include > <Your Account>
6. "Continue to summary" → "Create Token"
7. 토큰 복사 (한 번만 표시됨!)
```

#### 3️⃣ GitHub Secrets 업데이트
```
1. GitHub 저장소 → Settings → Secrets and variables → Actions
2. CLOUDFLARE_API_TOKEN:
   - "Update" 클릭
   - 새 토큰 붙여넣기
3. CLOUDFLARE_ACCOUNT_ID:
   - Cloudflare 대시보드 우측 사이드바에서 확인
   - 형식: 32자 hex 문자열 (예: 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p)
```

---

### **방법 2: Cloudflare Pages Git 통합 사용** (권장)

#### 1️⃣ GitHub Actions 비활성화
```bash
# .github/workflows/main.yml 파일명 변경
git mv .github/workflows/main.yml .github/workflows/main.yml.disabled
git commit -m "chore: Temporarily disable GitHub Actions"
git push origin main
```

#### 2️⃣ Cloudflare Pages Git 통합 활성화
```
1. https://dash.cloudflare.com → Workers & Pages → ur-live
2. Settings → Builds & deployments
3. "Connect to Git" 또는 "Configure" 클릭
4. 설정:
   - Production branch: main
   - Build command: npm run build
   - Build output directory: dist
   - Root directory: (공백)
   - Node.js version: 20
5. Environment variables 추가 (Production):
   - VITE_REGION=KR
   - VITE_DEFAULT_LANGUAGE=ko
   - VITE_API_BASE_URL=https://live.ur-team.com
   - [... Firebase, Kakao, Toss, Sentry 환경변수들 ...]
6. "Save and Deploy" 클릭
```

#### 3️⃣ 자동 배포 확인
```
1. main 브랜치에 푸시하면 자동으로 배포 시작
2. Cloudflare Pages → ur-live → Deployments에서 진행 상황 확인
3. 약 2-5분 후 live.ur-team.com 업데이트 확인
```

---

### **방법 3: 수동 배포** (긴급 시)

#### 1️⃣ 로컬에서 빌드
```bash
cd /home/user/webapp
npm run build
```

#### 2️⃣ Wrangler로 배포
```bash
# CLOUDFLARE_API_TOKEN 환경변수 설정 필요
export CLOUDFLARE_API_TOKEN="your-token-here"
export CLOUDFLARE_ACCOUNT_ID="your-account-id-here"

npx wrangler pages deploy dist --project-name=ur-live --branch=main
```

---

## 🔧 배포 후 검증

### 1️⃣ 배포 상태 확인
```
1. Cloudflare Pages → ur-live → Deployments
2. 최신 배포 상태: Success (초록색)
3. Production URL: https://live.ur-team.com
4. Commit: ee1bffe0 (Admin Products Management)
```

### 2️⃣ 기능 테스트
```
1. 어드민 로그인: https://live.ur-team.com/admin/login
2. 어드민 대시보드에서 "📦 상품 관리" 버튼 확인
3. /admin/products 페이지 접근 성공
4. 상품 등록/수정/삭제 기능 테스트
```

### 3️⃣ 버전 확인
```bash
# 브라우저 콘솔에서:
fetch('https://live.ur-team.com/version.json')
  .then(r => r.json())
  .then(d => console.log('Build:', d.buildId, 'Time:', d.buildTime))

# 예상 출력:
# Build: d451eee8 Time: 2026-03-11T...
```

---

## 📊 배포 히스토리

| 커밋 | 설명 | 배포 상태 |
|------|------|----------|
| `ee1bffe0` | Trigger deployment | ⏳ 대기 중 |
| `acc73cf1` | Admin products - build | ✅ 성공 |
| `4ed82d0b` | Admin product management | ✅ 성공 |
| `d8ae40e6` | Restrict product types | ✅ 성공 |
| `6cd6615c` | R2 configuration | ✅ 성공 |

---

## 🆘 추가 지원

### Cloudflare 지원팀 연락
```
1. https://dash.cloudflare.com → Support → Contact Support
2. 문제 설명:
   - GitHub Actions 배포 실패
   - 에러 메시지 첨부
   - 프로젝트: ur-live
   - Account ID: [확인 필요]
```

### 로그 확인
```
1. Cloudflare Pages → ur-live → Deployments → [실패한 배포]
2. "View build log" 클릭
3. 에러 메시지 확인 (빨간색 텍스트)
4. 일반적인 에러:
   - "Authentication failed" → API Token 문제
   - "Out of memory" → 빌드 메모리 부족
   - "Command failed" → 빌드 스크립트 오류
```

---

## 🎯 권장 조치

**즉시 실행**:
1. ✅ GitHub Secrets (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID) 확인
2. ✅ Cloudflare Pages Git 통합 활성화 (방법 2)
3. ✅ main 브랜치에 빈 커밋 푸시로 배포 재시도

**장기 개선**:
1. 🔄 GitHub Actions 워크플로우 개선 (메모리 제한, 재시도 로직)
2. 📊 배포 실패 알림 설정 (이메일, Slack)
3. 🔐 API Token 정기 갱신 (90일마다)
4. 📝 배포 로그 정기 검토

---

**작성일**: 2026-03-11  
**상태**: 🔄 배포 진행 중  
**다음 단계**: GitHub Secrets 확인 후 재배포
