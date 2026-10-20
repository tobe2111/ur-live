# 🔧 GitHub Actions 배포 실패 해결 방법

## 🚨 현재 문제

**에러 메시지**:
```
Deploy to Cloudflare Pages
Process completed with exit code 1.
```

**원인**:
- CLOUDFLARE_API_TOKEN 또는 CLOUDFLARE_ACCOUNT_ID가 잘못되었거나 만료됨
- Wrangler CLI 인증 실패
- 프로젝트 이름 불일치

---

## ✅ 해결 방법 (GitHub 웹에서 수행)

### 1️⃣ GitHub Secrets 확인 및 재설정

#### **Step 1: Cloudflare에서 새 API Token 생성**
```
1. https://dash.cloudflare.com 접속
2. 우측 상단 프로필 → "API Tokens" 클릭
3. "Create Token" 버튼 클릭
4. "Edit Cloudflare Workers" 템플릿 선택
5. 또는 "Custom token"으로 아래 권한 설정:
   
   Permissions:
   ✅ Account → Cloudflare Pages → Edit
   ✅ User → User Details → Read
   
6. Account Resources:
   ✅ Include → [Your Account] 선택
   
7. Continue to summary → Create Token
8. ⚠️ 토큰 복사 (한 번만 표시됨!)
   예: y_QpkL... (40자 정도)
```

#### **Step 2: Account ID 확인**
```
1. https://dash.cloudflare.com 접속
2. 우측 사이드바에서 "Account ID" 확인
3. 또는 Workers & Pages → ur-live → 우측 사이드바
4. 형식: 32자 hex 문자열
   예: 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d
```

#### **Step 3: GitHub Secrets 업데이트**
```
1. https://github.com/tobe2111/ur-live 접속
2. Settings 탭 클릭
3. 좌측 메뉴 → Secrets and variables → Actions
4. Repository secrets에서:

   CLOUDFLARE_API_TOKEN:
   - 우측 "Update" 버튼 클릭
   - 새로 생성한 토큰 붙여넣기
   - "Update secret" 클릭
   
   CLOUDFLARE_ACCOUNT_ID:
   - 우측 "Update" 버튼 클릭
   - Account ID 붙여넣기
   - "Update secret" 클릭
```

---

### 2️⃣ 워크플로우 파일 개선 (GitHub 웹에서)

#### **Step 1: 워크플로우 파일 수정**
```
1. https://github.com/tobe2111/ur-live 접속
2. .github/workflows/main.yml 파일 열기
3. 우측 상단 연필 아이콘 (Edit this file) 클릭
4. 아래 내용으로 전체 교체:
```

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
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci
        env:
          NODE_OPTIONS: "--max-old-space-size=4096"

      - name: Build project
        run: npm run build
        env:
          NODE_VERSION: 20
          NODE_OPTIONS: "--max-old-space-size=4096"
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

```
5. 하단 "Commit changes..." 버튼 클릭
6. Commit message: "fix(ci): Improve deployment workflow with wrangler-action@v3"
7. "Commit directly to the main branch" 선택
8. "Commit changes" 확인
```

**개선 사항**:
- ✅ `cloudflare/wrangler-action@v3` 사용 (공식 액션)
- ✅ NODE_OPTIONS로 메모리 제한 설정
- ✅ 더 명확한 에러 메시지

---

### 3️⃣ 수동으로 워크플로우 재실행

#### **방법 1: Re-run failed jobs**
```
1. https://github.com/tobe2111/ur-live/actions 접속
2. 실패한 워크플로우 클릭
3. 우측 상단 "Re-run all jobs" 버튼 클릭
4. 확인 후 실행
```

#### **방법 2: Run workflow 수동 트리거**
```
1. https://github.com/tobe2111/ur-live/actions 접속
2. 좌측 "Deploy to Cloudflare Pages" 워크플로우 선택
3. 우측 "Run workflow" 버튼 클릭
4. Branch: main 선택
5. "Run workflow" 초록색 버튼 클릭
```

---

## 🔍 배포 성공 확인

### **GitHub Actions 로그**
```
성공 시 출력:
✅ Checkout code
✅ Setup Node.js
✅ Install dependencies
✅ Build project
✅ Deploy to Cloudflare Pages
   ✨ Uploading... (X files)
   ✨ Success! Uploaded X files
   ✨ Deployment complete!
   ✨ https://live.ur-team.com
```

### **Cloudflare Pages 대시보드**
```
1. https://dash.cloudflare.com
2. Workers & Pages → ur-live
3. Deployments 탭
4. 최신 배포: 🟢 Success
5. Source: GitHub (main branch)
```

---

## 🚨 여전히 실패하는 경우

### **에러 1: Authentication failed**
```
Error: Authentication error [code: 10000]

해결:
- CLOUDFLARE_API_TOKEN 다시 확인
- 토큰 권한 확인 (Cloudflare Pages Edit 권한 필요)
- 토큰 만료 여부 확인
- 새 토큰 생성 후 GitHub Secrets 업데이트
```

### **에러 2: Project not found**
```
Error: Could not find project with name 'ur-live'

해결:
1. https://dash.cloudflare.com → Workers & Pages
2. ur-live 프로젝트 존재 확인
3. 프로젝트 이름이 정확히 "ur-live"인지 확인
4. 다르다면 워크플로우 파일의 --project-name 수정
```

### **에러 3: Account ID mismatch**
```
Error: Unknown account

해결:
- CLOUDFLARE_ACCOUNT_ID 다시 확인
- Cloudflare 대시보드에서 정확한 Account ID 복사
- GitHub Secrets 업데이트
```

### **에러 4: Build failed**
```
Error: npm ERR! errno 137

해결:
- 메모리 부족 문제
- NODE_OPTIONS="--max-old-space-size=4096" 확인
- 워크플로우 파일에 이미 추가되어 있음
```

---

## 🎯 권장 대안: Cloudflare Pages Git 통합

GitHub Actions가 계속 실패한다면, Cloudflare의 네이티브 Git 통합을 사용하는 것이 더 안정적입니다:

### **Cloudflare Pages 직접 Git 연결**
```
1. https://dash.cloudflare.com → Workers & Pages → ur-live
2. Settings → Builds & deployments
3. "Configure" 또는 "Connect to Git" 클릭
4. GitHub 저장소: tobe2111/ur-live 선택
5. Production branch: main
6. Build command: npm run build
7. Build output directory: dist
8. Environment variables 추가 (모든 VITE_* 변수들)
9. "Save and Deploy"
```

**장점**:
- ✅ GitHub Actions Secret 불필요
- ✅ 더 빠른 배포
- ✅ 자동 미리보기 배포 (PR마다)
- ✅ Cloudflare 네이티브 통합

---

## 📊 체크리스트

### **즉시 실행**:
- [ ] Cloudflare API Token 재생성
- [ ] Cloudflare Account ID 확인
- [ ] GitHub Secrets 업데이트 (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID)
- [ ] 워크플로우 파일 개선 (wrangler-action@v3 사용)
- [ ] 워크플로우 수동 재실행

### **성공 확인**:
- [ ] GitHub Actions 로그에서 "Success!" 메시지 확인
- [ ] Cloudflare Pages 대시보드에서 🟢 Success 상태 확인
- [ ] https://live.ur-team.com 업데이트 확인
- [ ] 어드민 상품 관리 기능 테스트

### **대안 (권장)**:
- [ ] Cloudflare Pages Git 통합 활성화
- [ ] GitHub Actions 비활성화 (선택사항)

---

## 🔗 바로가기 링크

- **GitHub Secrets 설정**: https://github.com/tobe2111/ur-live/settings/secrets/actions
- **GitHub Actions 로그**: https://github.com/tobe2111/ur-live/actions
- **워크플로우 파일 수정**: https://github.com/tobe2111/ur-live/edit/main/.github/workflows/main.yml
- **Cloudflare 대시보드**: https://dash.cloudflare.com
- **Cloudflare API Tokens**: https://dash.cloudflare.com/profile/api-tokens
- **Cloudflare Pages 설정**: https://dash.cloudflare.com (→ Workers & Pages → ur-live → Settings)

---

**중요**: GitHub 웹 UI에서 직접 수정해야 합니다. 자동화 도구로는 workflow 파일을 수정할 권한이 없습니다.

**권장 순서**:
1. 🔐 Secrets 업데이트 (5분)
2. 📝 워크플로우 파일 개선 (3분)
3. 🔄 워크플로우 재실행 (즉시)
4. ✅ 배포 성공 확인 (3-5분)
