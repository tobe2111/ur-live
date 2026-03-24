# 🔧 Cloudflare Pages GitHub 연결 가이드

**문제**: ur-live Pages 프로젝트에 "No Git connection" 상태  
**해결**: GitHub 저장소를 Cloudflare Pages에 연결하여 자동 배포 설정

---

## 📊 현재 상황

### Cloudflare 프로젝트 목록
```
1. ur-live (Pages) - ur-live.pages.dev
   Status: ⚠️ No Git connection
   → 수동 배포만 가능, 자동 배포 안됨

2. ur-live (Worker) - No active routes
   Status: ⚠️ No active routes
   → 사용하지 않는 Worker

3. ur-live-global (Pages) - ur-live-global.pages.dev
   Status: ⚠️ No Git connection

4. ur-live-global (Worker) - world.ur-team.com
   Status: ❌ Latest build failed

5. toss-live-commerce (Pages)
   Status: ⚠️ No Git connection
```

---

## ✅ 해결 방법

### Option 1: 기존 ur-live Pages에 Git 연결 (권장)

#### Step 1: Cloudflare Dashboard 접속
1. https://dash.cloudflare.com 로그인
2. **Workers & Pages** 클릭
3. **ur-live** (Pages, 9h ago) 프로젝트 클릭

#### Step 2: Git 연결 설정
1. **Settings** 탭 클릭
2. **Builds & deployments** 섹션 찾기
3. **Connect to Git** 버튼 클릭
4. **GitHub** 선택
5. 저장소 선택: **tobe2111/ur-live**
6. 브랜치 선택: **main**

#### Step 3: 빌드 설정 확인
```bash
# Build command
npm run build

# Build output directory
dist

# Root directory (optional)
/

# Environment variables
NODE_VERSION=18
```

#### Step 4: 환경 변수 설정
**Production 환경 변수 추가**:
```bash
# Firebase
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=urteam-live-commerce-5b284
VITE_FIREBASE_DATABASE_URL=your_firebase_database_url

# Kakao
VITE_KAKAO_APP_KEY=975a2e7f97254b08f15dba4d177a2865
VITE_KAKAO_REST_API_KEY=your_kakao_rest_api_key

# TossPayments
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN

# Region
VITE_REGION=KR
VITE_DEFAULT_LANGUAGE=ko
VITE_API_BASE_URL=https://live.ur-team.com

# Backend (Worker 환경 변수)
RESEND_API_KEY=your_resend_api_key
JWT_SECRET=your_jwt_secret
TOSS_SECRET_KEY=your_toss_secret_key
EMAIL_FROM=noreply@live.ur-team.com
FIREBASE_PROJECT_ID=urteam-live-commerce-5b284
FIREBASE_DATABASE_URL=your_firebase_database_url
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
```

#### Step 5: 즉시 재배포
1. **Deployments** 탭 클릭
2. **Retry deployment** 버튼 클릭
3. 또는 **Create deployment** → **Production branch** 선택

---

### Option 2: 새 Cloudflare Pages 프로젝트 생성 (깨끗한 시작)

#### Step 1: 기존 프로젝트 정리 (선택)
```bash
# 사용하지 않는 Worker 삭제
# Cloudflare Dashboard → Workers & Pages
# → ur-live (Worker, "No active routes") → Settings → Delete
```

#### Step 2: 새 Pages 프로젝트 생성
1. https://dash.cloudflare.com 로그인
2. **Workers & Pages** → **Create application**
3. **Pages** 탭 선택
4. **Connect to Git** 클릭

#### Step 3: GitHub 저장소 연결
1. **GitHub** 선택
2. 저장소: **tobe2111/ur-live**
3. **Begin setup** 클릭

#### Step 4: 빌드 설정
```bash
Project name: ur-live-kr (또는 ur-live)
Production branch: main
Build command: npm run build
Build output directory: dist
```

#### Step 5: 환경 변수 설정 (위의 환경 변수 동일)

#### Step 6: 커스텀 도메인 설정
1. 프로젝트 생성 완료 후
2. **Custom domains** 탭
3. **Set up a custom domain** 클릭
4. 도메인 입력: **live.ur-team.com**
5. DNS 레코드 자동 생성 확인

---

## 🚀 빠른 임시 해결 방법 (Wrangler CLI)

### 즉시 수동 배포
```bash
# 1. Cloudflare API 토큰 설정 (필요한 경우)
export CLOUDFLARE_API_TOKEN="your_cloudflare_api_token"

# 2. 빌드
cd /home/user/webapp
npm run build

# 3. 배포
wrangler pages deploy dist --project-name ur-live --branch main
```

### 배포 스크립트 사용
```bash
cd /home/user/webapp

# deploy.sh가 있는 경우
./deploy.sh

# 또는 npm 스크립트
npm run deploy:prod
```

---

## 📝 배포 후 확인 사항

### 1. 배포 상태 확인
```bash
# Cloudflare Dashboard
# → Workers & Pages → ur-live → Deployments
# → 최신 배포 상태: Success ✅
```

### 2. 사이트 접속 테스트
```bash
# Pages 도메인
curl https://ur-live.pages.dev | grep "<!doctype html>"

# 커스텀 도메인
curl https://live.ur-team.com | grep "<!doctype html>"
```

### 3. 브라우저 테스트
1. https://live.ur-team.com 접속
2. 하드 새로고침 (Ctrl+Shift+R)
3. 정상 화면 확인

---

## 🔍 문제 진단

### 현재 문제
- ✅ Git 커밋 완료 (803844e5, 4651e7d0)
- ✅ GitHub 푸시 완료
- ❌ Cloudflare Pages에 Git 연결 없음 → **자동 배포 안됨**

### 해결책
1. **즉시**: Wrangler CLI로 수동 배포
2. **영구**: Cloudflare Pages에 GitHub 연결

---

## 💡 권장 사항

### 즉시 조치 (5분)
```bash
# Wrangler로 즉시 배포
cd /home/user/webapp
npm run build
wrangler pages deploy dist --project-name ur-live
```

### 영구 해결 (10분)
1. Cloudflare Dashboard에서 ur-live Pages에 Git 연결
2. 환경 변수 모두 설정
3. 자동 배포 테스트 (Git push → 자동 배포)

---

## 📊 예상 결과

### Git 연결 완료 후
```
GitHub (tobe2111/ur-live)
  ↓ Push to main
Cloudflare Pages (ur-live)
  ↓ Auto build & deploy
https://live.ur-team.com ✅
```

### 자동 배포 설정 후
- ✅ Git push → 자동 빌드
- ✅ 빌드 성공 → 자동 배포
- ✅ 배포 완료 → 즉시 반영 (1~3분)

---

**작성 일시**: 2026-03-08 23:35  
**우선순위**: 🚨 Critical  
**예상 소요 시간**: 5~10분
