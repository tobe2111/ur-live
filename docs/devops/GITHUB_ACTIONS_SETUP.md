# 🚀 GitHub Actions 자동 배포 설정 가이드

## 📝 설정 단계

### Step A: GitHub에서 워크플로우 생성

1. **https://github.com/tobe2111/ur-live** 접속
2. **Actions** 탭 클릭
3. **"New workflow"** 버튼 클릭
4. **"set up a workflow yourself"** 선택
5. 파일명 확인: `.github/workflows/deploy.yml`
6. 아래 코드를 복사하여 붙여넣기
7. **"Commit changes"** 클릭

**워크플로우 코드 (복사해서 붙여넣으세요):**

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy to Cloudflare Pages
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build
        env:
          NODE_VERSION: 18
          VITE_REGION: KR
          VITE_DEFAULT_LANGUAGE: ko
          VITE_API_BASE_URL: https://live.ur-team.com
          VITE_FIREBASE_API_KEY: AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM
          VITE_FIREBASE_AUTH_DOMAIN: toss-live-commerce.firebaseapp.com
          VITE_FIREBASE_PROJECT_ID: toss-live-commerce
          VITE_FIREBASE_STORAGE_BUCKET: toss-live-commerce.firebasestorage.app
          VITE_FIREBASE_MESSAGING_SENDER_ID: 408717649003
          VITE_FIREBASE_APP_ID: 1:408717649003:web:29aa3cb5f92056dd1ec4f4
          VITE_FIREBASE_MEASUREMENT_ID: G-78M73BGT77
          VITE_KAKAO_APP_KEY: 975a2e7f97254b08f15dba4d177a2865
          VITE_KAKAO_JAVASCRIPT_KEY: 975a2e7f97254b08f15dba4d177a2865
          VITE_KAKAO_REST_API_KEY: 5dd74bccb797640b0efd070467f3bafd
          VITE_TOSS_CLIENT_KEY: test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
          VITE_SENTRY_DSN: https://08caf64e8e7955f09acc2b0551fdb049@o4510992097935360.ingest.us.sentry.io/4510992127295488
          VITE_SENTRY_ENVIRONMENT: production

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=ur-live --branch=main
```

---

## 📋 Step B: GitHub Secrets 설정

GitHub Actions가 Cloudflare에 배포하려면 아래 Secrets을 설정해야 합니다.

### Step 1: GitHub Repository Settings 접속
1. https://github.com/tobe2111/ur-live 접속
2. **Settings** 탭 클릭
3. 왼쪽 사이드바에서 **Secrets and variables** → **Actions** 클릭

### Step 2: Repository Secrets 추가

**"New repository secret"** 버튼을 클릭하고 아래 2개의 Secret을 추가:

#### Secret 1: CLOUDFLARE_API_TOKEN
```
Name: CLOUDFLARE_API_TOKEN
Value: _3Q3YUJWmK_0D-6r65jdqXaOKwgnSj7oqlq2-t_P
```

#### Secret 2: CLOUDFLARE_ACCOUNT_ID
```
Name: CLOUDFLARE_ACCOUNT_ID
Value: 1a2c006f0fb54894f81283a5ea787b83
```

### Step 3: 설정 완료 확인
- ✅ CLOUDFLARE_API_TOKEN 추가됨
- ✅ CLOUDFLARE_ACCOUNT_ID 추가됨

---

## 🎯 자동 배포 작동 방식

### 트리거 조건
- **자동**: `main` 브랜치에 `git push` 할 때
- **수동**: GitHub Actions 탭에서 "Run workflow" 클릭

### 배포 프로세스
1. 코드 체크아웃
2. Node.js 18 설치
3. npm 의존성 설치 (`npm ci`)
4. 프로젝트 빌드 (`npm run build`)
5. Cloudflare Pages에 배포 (`wrangler pages deploy`)

### 예상 시간
- 전체 프로세스: 약 3~5분
- 빌드: 약 2분
- 배포: 약 1분

---

## 🧪 테스트 방법

### 1. GitHub Secrets 설정 완료 후

```bash
# 테스트 커밋 생성
git commit --allow-empty -m "test: Trigger GitHub Actions auto-deploy"
git push origin main
```

### 2. GitHub Actions 확인
1. https://github.com/tobe2111/ur-live/actions
2. 최신 워크플로우 실행 확인
3. 로그에서 배포 성공 확인

### 3. 사이트 확인
- 배포 완료 후 https://live.ur-team.com 접속
- 하드 새로고침 (Ctrl + Shift + R)

---

## 📊 워크플로우 구조

```yaml
on:
  push:
    branches:
      - main           # main 브랜치 푸시 시 자동 실행
  workflow_dispatch:   # 수동 실행 가능

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - Checkout code          # 코드 가져오기
      - Setup Node.js 18       # Node 환경 설정
      - Install dependencies   # npm ci
      - Build project         # npm run build (환경변수 포함)
      - Deploy to Cloudflare  # wrangler pages deploy
```

---

## ✅ 장점

### 자동화
- ✅ `git push` → 자동 빌드 → 자동 배포
- ✅ 수동 개입 불필요
- ✅ 일관된 빌드 환경

### 안전성
- ✅ 빌드 실패 시 배포 중단
- ✅ 환경 변수 GitHub Secrets로 관리
- ✅ 배포 로그 기록

### 편리성
- ✅ 로컬에서 `wrangler login` 불필요
- ✅ 여러 개발자 협업 가능
- ✅ 배포 히스토리 추적 가능

---

## 🚨 주의사항

### API Token 권한
현재 토큰에 다음 권한 필요:
- ✅ Account → Cloudflare Pages → Edit
- ✅ Account → Account Settings → Read

권한 부족 시:
1. https://dash.cloudflare.com/profile/api-tokens
2. 토큰 편집 또는 새로 생성
3. GitHub Secrets 업데이트

---

## 🔄 다음 단계

1. **즉시**: GitHub Secrets 2개 설정
2. **테스트**: 테스트 커밋으로 자동 배포 확인
3. **확인**: https://live.ur-team.com 정상 작동 확인

---

**작성 일시**: 2026-03-09 00:56  
**우선순위**: 🟢 High  
**예상 소요 시간**: 5분
