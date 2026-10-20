# 🚀 자동 듀얼 배포 설정 가이드 (단계별)

## 📅 2026-03-05

---

## 🎯 **목표**

GitHub에 push하면 KR과 GLOBAL 사이트가 자동으로 배포되도록 설정하기

---

## 📋 **전체 단계 개요**

```
1단계: Cloudflare API 토큰 발급 (5분)
2단계: GitHub Secrets 설정 (2분)
3단계: Cloudflare Pages 프로젝트 생성 - KR (10분)
4단계: Cloudflare Pages 프로젝트 생성 - GLOBAL (10분)
5단계: GitHub Actions 워크플로우 추가 (3분)
6단계: 첫 배포 테스트 (6분)

총 소요 시간: 약 36분
```

---

## 1️⃣ **Cloudflare API 토큰 발급** (5분)

### 1-1. Cloudflare Dashboard 접속
```
https://dash.cloudflare.com/
```

### 1-2. API 토큰 페이지 이동
```
우측 상단 프로필 아이콘 클릭
→ "My Profile"
→ 왼쪽 메뉴에서 "API Tokens"
→ "Create Token" 버튼 클릭
```

### 1-3. 커스텀 토큰 생성
```
"Create Custom Token" 선택

Token name: GitHub Actions Deployment

Permissions (권한 설정):
┌─────────────────────────────────────────┐
│ Account → Cloudflare Pages → Edit      │
│ Zone → Workers Scripts → Edit          │
└─────────────────────────────────────────┘

Account Resources:
→ "Include" → "All accounts" 선택

Zone Resources:
→ "Include" → "All zones" 선택

IP Address Filtering:
→ (비워두기)

TTL:
→ (비워두기 - 만료 없음)
```

### 1-4. 토큰 생성 및 복사
```
"Continue to summary" 클릭
→ "Create Token" 클릭
→ ⚠️ 토큰이 표시됨 (한 번만 표시!)
→ 토큰 복사 (Copy 버튼)
→ 안전한 곳에 임시 저장 (메모장 등)
```

**예시:**
```
토큰 형식: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 1-5. Account ID 확인
```
Cloudflare Dashboard 메인 페이지
→ 우측 사이드바에서 "Account ID" 확인
→ 복사 버튼 클릭
→ 안전한 곳에 임시 저장
```

**예시:**
```
Account ID: 1234567890abcdef1234567890abcdef
```

---

## 2️⃣ **GitHub Secrets 설정** (2분)

### 2-1. GitHub Repository 접속
```
https://github.com/tobe2111/ur-live
```

### 2-2. Settings → Secrets 이동
```
Repository 페이지
→ 상단 탭에서 "Settings" 클릭
→ 왼쪽 메뉴에서 "Secrets and variables" 클릭
→ "Actions" 클릭
```

### 2-3. CLOUDFLARE_API_TOKEN 추가
```
"New repository secret" 버튼 클릭

Name: CLOUDFLARE_API_TOKEN
Secret: [1-4에서 복사한 Cloudflare API 토큰 붙여넣기]

→ "Add secret" 클릭
```

### 2-4. CLOUDFLARE_ACCOUNT_ID 추가
```
"New repository secret" 버튼 클릭 (다시)

Name: CLOUDFLARE_ACCOUNT_ID
Secret: [1-5에서 복사한 Account ID 붙여넣기]

→ "Add secret" 클릭
```

### 2-5. (선택) Discord 알림 설정
```
Discord Webhook URL이 있는 경우:

"New repository secret" 버튼 클릭

Name: DISCORD_WEBHOOK_URL
Secret: [Discord Webhook URL 붙여넣기]

→ "Add secret" 클릭
```

✅ **확인**: Secrets 페이지에 2개(또는 3개) Secret이 표시되어야 함

---

## 3️⃣ **Cloudflare Pages 프로젝트 생성 - KR** (10분)

### 3-1. Workers & Pages 이동
```
Cloudflare Dashboard (https://dash.cloudflare.com/)
→ 왼쪽 메뉴에서 "Workers & Pages" 클릭
→ "Create application" 버튼 클릭
→ "Pages" 탭 선택
→ "Connect to Git" 클릭
```

### 3-2. GitHub 연동 (처음인 경우)
```
"Connect GitHub" 버튼 클릭
→ GitHub 계정 인증
→ Repository 접근 권한 허용
```

### 3-3. Repository 선택
```
Repository 목록에서 "tobe2111/ur-live" 선택
→ "Begin setup" 클릭
```

### 3-4. KR 프로젝트 설정
```
┌─────────────────────────────────────────────────────┐
│ Project name: ur-live-kr                            │
│                                                     │
│ Production branch: main                             │
│                                                     │
│ Build settings:                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Framework preset: None                          │ │
│ │ Build command: (비워두기)                        │ │
│ │ Build output directory: (비워두기)               │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Root directory: /                                   │
└─────────────────────────────────────────────────────┘

⚠️ 중요: Build command와 Output directory를 비워두세요!
         GitHub Actions가 빌드를 처리합니다.

→ "Save and Deploy" 클릭
```

### 3-5. 첫 배포 기다리기
```
배포가 진행됩니다 (약 3-5분)
→ 실패해도 괜찮습니다! (환경 변수가 없어서 실패 예상)
→ "Continue to project" 클릭
```

### 3-6. 환경 변수 설정
```
프로젝트 페이지에서:
→ 상단 탭 "Settings" 클릭
→ "Environment variables" 클릭
→ "Production" 탭 선택
→ "Add variables" 클릭
```

**추가할 환경 변수 (12개):**

```
1. VITE_FIREBASE_API_KEY = [Firebase API Key]
2. VITE_FIREBASE_AUTH_DOMAIN = [Firebase Auth Domain]
3. VITE_FIREBASE_PROJECT_ID = [Firebase Project ID]
4. VITE_FIREBASE_STORAGE_BUCKET = [Firebase Storage Bucket]
5. VITE_FIREBASE_MESSAGING_SENDER_ID = [Firebase Messaging Sender ID]
6. VITE_FIREBASE_APP_ID = [Firebase App ID]
7. VITE_FIREBASE_MEASUREMENT_ID = [Firebase Measurement ID]
8. VITE_FIREBASE_DATABASE_URL = [Firebase Database URL]

9. VITE_KAKAO_REST_API_KEY = [Kakao REST API Key]
10. VITE_KAKAO_JAVASCRIPT_KEY = [Kakao JavaScript Key]
11. VITE_KAKAO_AUTH_URL = [Kakao Auth URL]

12. VITE_TOSS_CLIENT_KEY = [Toss Payments Client Key]
```

**입력 방법:**
```
각 변수마다:
1. "Add variable" 클릭
2. Variable name: [위 변수명 입력]
3. Value: [실제 값 입력]
4. "Save" 클릭
```

### 3-7. 커스텀 도메인 연결
```
프로젝트 페이지에서:
→ 상단 탭 "Custom domains" 클릭
→ "Set up a custom domain" 버튼 클릭
→ "live.ur-team.com" 입력
→ "Continue" 클릭
→ DNS 설정 안내 따라하기
→ "Activate domain" 클릭
```

✅ **완료**: KR 프로젝트 설정 완료!

---

## 4️⃣ **Cloudflare Pages 프로젝트 생성 - GLOBAL** (10분)

### 4-1. 새 프로젝트 생성
```
Cloudflare Dashboard
→ Workers & Pages
→ "Create application" 버튼 클릭
→ "Pages" 탭 선택
→ "Connect to Git" 클릭
```

### 4-2. Repository 선택
```
"tobe2111/ur-live" 선택 (같은 Repository)
→ "Begin setup" 클릭
```

### 4-3. GLOBAL 프로젝트 설정
```
┌─────────────────────────────────────────────────────┐
│ Project name: ur-live-global                        │
│                                                     │
│ Production branch: main                             │
│                                                     │
│ Build settings:                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Framework preset: None                          │ │
│ │ Build command: (비워두기)                        │ │
│ │ Build output directory: (비워두기)               │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Root directory: /                                   │
└─────────────────────────────────────────────────────┘

→ "Save and Deploy" 클릭
```

### 4-4. 환경 변수 설정
```
프로젝트 페이지에서:
→ Settings → Environment variables → Production
→ "Add variables" 클릭
```

**추가할 환경 변수 (10개):**

```
1. VITE_FIREBASE_API_KEY = [Firebase API Key]
2. VITE_FIREBASE_AUTH_DOMAIN = [Firebase Auth Domain]
3. VITE_FIREBASE_PROJECT_ID = [Firebase Project ID]
4. VITE_FIREBASE_STORAGE_BUCKET = [Firebase Storage Bucket]
5. VITE_FIREBASE_MESSAGING_SENDER_ID = [Firebase Messaging Sender ID]
6. VITE_FIREBASE_APP_ID = [Firebase App ID]
7. VITE_FIREBASE_MEASUREMENT_ID = [Firebase Measurement ID]
8. VITE_FIREBASE_DATABASE_URL = [Firebase Database URL]

9. VITE_GOOGLE_CLIENT_ID = [Google OAuth Client ID]

10. VITE_STRIPE_PUBLISHABLE_KEY = [Stripe Publishable Key]
```

### 4-5. 커스텀 도메인 연결
```
프로젝트 페이지에서:
→ Custom domains
→ "Set up a custom domain"
→ "world.ur-team.com" 입력
→ DNS 설정 및 Activate
```

✅ **완료**: GLOBAL 프로젝트 설정 완료!

---

## 5️⃣ **GitHub Actions 워크플로우 추가** (3분)

### 5-1. GitHub Repository 접속
```
https://github.com/tobe2111/ur-live
```

### 5-2. 워크플로우 디렉토리 이동
```
Repository 메인 페이지
→ ".github" 폴더 클릭
→ "workflows" 폴더 클릭
```

### 5-3. 새 파일 생성
```
"Add file" 버튼 클릭
→ "Create new file" 선택

파일명: dual-deploy.yml
```

### 5-4. 워크플로우 내용 입력

**방법 1: 로컬 파일에서 복사**
```bash
# 로컬에서 파일 내용 확인
cat /home/user/webapp/.github/workflows/dual-deploy.yml

# 내용 복사 → GitHub 에디터에 붙여넣기
```

**방법 2: 아래 내용 복사**

<details>
<summary>워크플로우 파일 전체 내용 보기 (클릭)</summary>

```yaml
name: Dual-Site Deployment (KR + GLOBAL)

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20.x'
  DEPLOYMENT_ENVIRONMENT: 'production'

jobs:
  lint-and-typecheck:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run TypeScript type check
        run: npm run typecheck
        continue-on-error: true
      
      - name: Check naming conflicts
        run: npm run check:naming
        continue-on-error: true

  build-kr:
    name: Build KR Region
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build KR bundle
        run: npm run build:kr
        env:
          NODE_OPTIONS: '--max_old_space_size=4096'
      
      - name: Upload KR artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dist-kr
          path: dist/
          retention-days: 7

  build-global:
    name: Build GLOBAL Region
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build GLOBAL bundle
        run: npm run build:global
        env:
          NODE_OPTIONS: '--max_old_space_size=4096'
      
      - name: Upload GLOBAL artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dist-global
          path: dist-global/
          retention-days: 7

  deploy-kr:
    name: Deploy KR to Cloudflare Pages
    runs-on: ubuntu-latest
    needs: [build-kr]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    environment:
      name: production-kr
      url: https://live.ur-team.com
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Download KR artifacts
        uses: actions/download-artifact@v4
        with:
          name: dist-kr
          path: dist/
      
      - name: Install Wrangler
        run: npm install -g wrangler
      
      - name: Deploy to Cloudflare Pages (KR)
        run: |
          wrangler pages deploy dist \
            --project-name=ur-live-kr \
            --branch=main \
            --commit-hash=${{ github.sha }} \
            --commit-message="${{ github.event.head_commit.message }}"
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      
      - name: Verify KR deployment
        run: |
          echo "🔍 Verifying KR deployment..."
          sleep 10
          curl -s -o /dev/null -w "%{http_code}" https://live.ur-team.com | grep -q "200" && \
            echo "✅ KR site is live!" || \
            echo "⚠️ KR site verification failed"
        continue-on-error: true

  deploy-global:
    name: Deploy GLOBAL to Cloudflare Pages
    runs-on: ubuntu-latest
    needs: [build-global]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    environment:
      name: production-global
      url: https://world.ur-team.com
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Download GLOBAL artifacts
        uses: actions/download-artifact@v4
        with:
          name: dist-global
          path: dist-global/
      
      - name: Install Wrangler
        run: npm install -g wrangler
      
      - name: Deploy to Cloudflare Pages (GLOBAL)
        run: |
          wrangler pages deploy dist-global \
            --project-name=ur-live-global \
            --branch=main \
            --commit-hash=${{ github.sha }} \
            --commit-message="${{ github.event.head_commit.message }}"
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      
      - name: Verify GLOBAL deployment
        run: |
          echo "🔍 Verifying GLOBAL deployment..."
          sleep 10
          curl -s -o /dev/null -w "%{http_code}" https://world.ur-team.com | grep -q "200" && \
            echo "✅ GLOBAL site is live!" || \
            echo "⚠️ GLOBAL site verification failed"
        continue-on-error: true

  notify-deployment:
    name: Notify Deployment Status
    runs-on: ubuntu-latest
    needs: [deploy-kr, deploy-global]
    if: always() && github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
      - name: Determine deployment status
        id: status
        run: |
          if [[ "${{ needs.deploy-kr.result }}" == "success" ]] && [[ "${{ needs.deploy-global.result }}" == "success" ]]; then
            echo "status=success" >> $GITHUB_OUTPUT
            echo "color=65280" >> $GITHUB_OUTPUT
            echo "title=🚀 Dual Deployment Successful" >> $GITHUB_OUTPUT
            echo "message=Both KR and GLOBAL sites deployed successfully" >> $GITHUB_OUTPUT
          elif [[ "${{ needs.deploy-kr.result }}" == "success" ]] || [[ "${{ needs.deploy-global.result }}" == "success" ]]; then
            echo "status=partial" >> $GITHUB_OUTPUT
            echo "color=16744192" >> $GITHUB_OUTPUT
            echo "title=⚠️ Partial Deployment" >> $GITHUB_OUTPUT
            echo "message=One site deployed, one failed" >> $GITHUB_OUTPUT
          else
            echo "status=failure" >> $GITHUB_OUTPUT
            echo "color=16711680" >> $GITHUB_OUTPUT
            echo "title=🚨 Dual Deployment Failed" >> $GITHUB_OUTPUT
            echo "message=Both deployments failed" >> $GITHUB_OUTPUT
          fi
      
      - name: Create deployment summary
        run: |
          echo "## 🚀 Dual-Site Deployment Summary" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| Site | Status | URL |" >> $GITHUB_STEP_SUMMARY
          echo "|------|--------|-----|" >> $GITHUB_STEP_SUMMARY
          echo "| 🇰🇷 KR Site | ${{ needs.deploy-kr.result }} | https://live.ur-team.com |" >> $GITHUB_STEP_SUMMARY
          echo "| 🌍 GLOBAL Site | ${{ needs.deploy-global.result }} | https://world.ur-team.com |" >> $GITHUB_STEP_SUMMARY
```

</details>

### 5-5. 커밋
```
하단 "Commit new file" 섹션:

Commit message: Add dual-site deployment workflow

→ "Commit new file" 버튼 클릭
```

✅ **완료**: 워크플로우 추가 완료!

---

## 6️⃣ **첫 배포 테스트** (6분)

### 6-1. GitHub Actions 확인
```
Repository 메인 페이지
→ 상단 탭 "Actions" 클릭
→ 최신 workflow run 확인 (방금 커밋으로 자동 시작됨)
```

### 6-2. 배포 진행 모니터링
```
Workflow run 클릭
→ 각 Job 상태 확인:
  ✅ Lint & Type Check
  🔄 Build KR
  🔄 Build GLOBAL
  🔄 Deploy KR
  🔄 Deploy GLOBAL
  🔄 Notify
```

### 6-3. 배포 완료 확인 (약 6분 소요)
```
모든 Job이 초록색 체크마크로 변경되면 완료!

Summary 탭 확인:
┌─────────────────────────────────────────┐
│ 🚀 Dual-Site Deployment Summary        │
│                                         │
│ | Site | Status | URL |                │
│ | 🇰🇷 KR | success | live.ur-team.com | │
│ | 🌍 GLOBAL | success | world.ur-team.com | │
└─────────────────────────────────────────┘
```

### 6-4. 사이트 접속 확인
```
브라우저에서 확인:
- https://live.ur-team.com (KR 사이트)
- https://world.ur-team.com (GLOBAL 사이트)
```

✅ **완료**: 자동 배포 성공!

---

## 🎉 **설정 완료!**

이제부터 `git push origin main`하면 두 사이트가 자동으로 배포됩니다!

---

## 📊 **확인 체크리스트**

- [ ] 1️⃣ Cloudflare API 토큰 발급 완료
- [ ] 2️⃣ GitHub Secrets 2개 설정 완료
- [ ] 3️⃣ Cloudflare Pages 프로젝트 "ur-live-kr" 생성 완료
- [ ] 3️⃣ KR 프로젝트 환경 변수 12개 설정 완료
- [ ] 3️⃣ KR 프로젝트 도메인 "live.ur-team.com" 연결 완료
- [ ] 4️⃣ Cloudflare Pages 프로젝트 "ur-live-global" 생성 완료
- [ ] 4️⃣ GLOBAL 프로젝트 환경 변수 10개 설정 완료
- [ ] 4️⃣ GLOBAL 프로젝트 도메인 "world.ur-team.com" 연결 완료
- [ ] 5️⃣ GitHub Actions 워크플로우 파일 추가 완료
- [ ] 6️⃣ 첫 배포 테스트 성공 확인

---

## 🔄 **이제 사용법**

```bash
# 1. 코드 수정
vim src/pages/HomePage.tsx

# 2. 커밋
git add .
git commit -m "feat: Update homepage"

# 3. Push (자동 배포 시작!)
git push origin main

# 4. GitHub Actions에서 진행 상황 확인
# https://github.com/tobe2111/ur-live/actions

# 5. 6분 후 두 사이트 모두 배포 완료! ✅
```

---

## ❓ **문제 해결**

### Q1: API 토큰 발급 시 권한이 부족하다고 나옵니다
**A:** Cloudflare 계정이 Free 플랜이라면 일부 권한이 제한될 수 있습니다. 대신:
- Account → Cloudflare Pages → Edit
- Zone → Workers Scripts → Edit
이 두 권한만 있으면 됩니다.

### Q2: GitHub Actions에서 배포 실패
**A:** 다음을 확인하세요:
1. GitHub Secrets가 올바르게 설정되었는지
2. Cloudflare 프로젝트명이 정확한지 (ur-live-kr, ur-live-global)
3. 환경 변수가 모두 설정되었는지

### Q3: 환경 변수를 어디서 얻나요?
**A:** 
- Firebase: Firebase Console → 프로젝트 설정
- Kakao: Kakao Developers → 앱 설정
- Toss: TossPayments 관리자 페이지
- Google: Google Cloud Console → OAuth 2.0 클라이언트
- Stripe: Stripe Dashboard → API Keys

### Q4: 도메인 연결이 안 됩니다
**A:** 
1. Cloudflare Dashboard → DNS 설정 확인
2. CNAME 레코드가 올바른지 확인
3. Proxy 상태 (주황색 구름) 확인

---

## 📚 **추가 문서**

- `AUTOMATIC_DUAL_DEPLOYMENT_GUIDE.md` - 완전한 가이드
- `DUAL_DEPLOYMENT_COMPLETE.md` - 완료 보고서
- `CURRENT_ARCHITECTURE_ANALYSIS.md` - 아키텍처 분석

---

**📍 Status**: Ready to Deploy  
**📍 Estimated Time**: 36 minutes  
**📍 Difficulty**: ⭐⭐⭐ (Medium)

궁금한 점이 있으면 언제든 물어보세요! 🚀
