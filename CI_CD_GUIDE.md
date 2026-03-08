# 🚀 CI/CD Pipeline Guide

> **UR Live CI/CD 자동화 가이드**  
> **작성일**: 2026-03-06  
> **플랫폼**: GitHub Actions + Cloudflare Pages

---

## 📋 목차

1. [개요](#개요)
2. [워크플로우 구성](#워크플로우-구성)
3. [GitHub Secrets 설정](#github-secrets-설정)
4. [워크플로우 상세](#워크플로우-상세)
5. [배포 프로세스](#배포-프로세스)
6. [트러블슈팅](#트러블슈팅)

---

## 개요

### CI/CD 파이프라인 구조

```
┌─────────────────────────────────────────────────────────────┐
│  1. PR 생성/업데이트                                         │
│     ├─ Unit Tests (Vitest)                                  │
│     ├─ E2E Tests (Cypress)                                  │
│     ├─ Type Check (TypeScript)                             │
│     ├─ Build Check                                          │
│     ├─ Code Quality (ESLint, etc.)                         │
│     └─ Bundle Size Analysis                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  2. main 브랜치 머지                                         │
│     ├─ Pre-deployment Tests                                 │
│     ├─ Build for Production                                 │
│     ├─ Deploy to Cloudflare Pages                          │
│     ├─ Post-deployment Smoke Tests                         │
│     └─ Sentry Release Tracking                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 워크플로우 구성

### 1. Test Suite Workflow (`.github/workflows/test.yml`)

**트리거**:
- `push`: main, develop, genspark_ai_developer 브랜치
- `pull_request`: main, develop 브랜치

**Jobs**:
1. ✅ **unit-tests**: Vitest 단위 테스트 (56 tests)
2. ✅ **e2e-tests**: Cypress E2E 테스트 (17 tests)
3. ✅ **type-check**: TypeScript 타입 체크
4. ✅ **build-check**: 프로덕션 빌드 검증
5. ✅ **test-summary**: 전체 테스트 결과 요약

### 2. PR Checks Workflow (`.github/workflows/pr-checks.yml`)

**트리거**:
- `pull_request`: main 브랜치 (opened, synchronize, reopened)

**Jobs**:
1. **pr-checks**: 코드 품질 검사
   - ESLint 검사
   - 네이밍 충돌 검사
   - CSS 유효성 검사
   - 커버리지 임계값 체크 (70%+)
   - PR 자동 코멘트

2. **security-audit**: 보안 취약점 검사
   - npm audit
   - Snyk 스캔 (optional)

3. **bundle-size**: 번들 크기 분석

### 3. Deploy Workflow (`.github/workflows/deploy.yml`)

**트리거**:
- `push`: main 브랜치
- `workflow_dispatch`: 수동 트리거

**Jobs**:
1. **pre-deploy-tests**: 배포 전 테스트
2. **deploy**: Cloudflare Pages 배포
3. **smoke-tests**: 배포 후 스모크 테스트
4. **sentry-release**: Sentry 릴리스 추적

---

## GitHub Secrets 설정

### 필수 Secrets

GitHub Repository → Settings → Secrets and variables → Actions

#### Firebase
```
VITE_FIREBASE_API_KEY=AIzaSyC...
VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_DATABASE_URL=https://your-app.firebaseio.com
VITE_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

#### Kakao
```
VITE_KAKAO_REST_API_KEY=your-kakao-rest-key
VITE_KAKAO_JAVASCRIPT_KEY=your-kakao-js-key
```

#### Payment
```
VITE_TOSS_CLIENT_KEY=test_ck_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

#### Sentry
```
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=sntrys_xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

#### Cloudflare
```
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_ACCOUNT_ID=your-account-id
```

### Optional Secrets
```
SNYK_TOKEN=your-snyk-token  # 보안 스캔용
CODECOV_TOKEN=your-codecov-token  # 커버리지 업로드용
```

---

## 워크플로우 상세

### Unit Tests Job

```yaml
unit-tests:
  steps:
    - Checkout code
    - Setup Node.js 18
    - npm ci
    - npm run test:unit:coverage
    - Upload coverage to Codecov
    - Comment coverage on PR
```

**출력**:
- Coverage Report (HTML)
- Codecov Badge
- PR Comment with coverage %

### E2E Tests Job

```yaml
e2e-tests:
  steps:
    - Checkout code
    - Setup Node.js 18
    - npm ci
    - npm run test:e2e:ci
    - Upload screenshots (on failure)
    - Upload videos (on failure)
```

**특징**:
- `start-server-and-test`로 dev 서버 자동 시작
- 실패 시 스크린샷/비디오 자동 업로드
- Headless 모드 실행

### Deploy Job

```yaml
deploy:
  needs: [pre-deploy-tests]
  steps:
    - Checkout code
    - Setup Node.js 18
    - npm ci
    - npm run build (with env vars)
    - wrangler pages deploy
    - Comment deployment URL
```

**배포 프로세스**:
1. 전체 테스트 통과 확인
2. 프로덕션 빌드 생성
3. Cloudflare Pages에 배포
4. 배포 URL 커밋 코멘트
5. Sentry 릴리스 생성

---

## 배포 프로세스

### 자동 배포 (Continuous Deployment)

```bash
# 1. main 브랜치에 머지
git checkout main
git merge feature/new-feature
git push origin main

# 2. GitHub Actions 자동 실행
# - Pre-deployment tests
# - Build
# - Deploy to Cloudflare
# - Smoke tests

# 3. 배포 완료 알림
# - Commit comment with URL
# - Sentry release created
```

### 수동 배포 (Manual Deployment)

```bash
# GitHub Actions 탭에서 "Deploy to Production" 실행
# - "Run workflow" 버튼 클릭
# - Branch 선택 (main)
# - "Run workflow" 확인
```

### 로컬 배포 (Development)

```bash
# 빌드
npm run build

# Cloudflare Pages 배포
npm run deploy

# 또는 Wrangler 직접 사용
wrangler pages deploy dist --project-name ur-live
```

---

## PR Workflow

### 1. PR 생성

```bash
git checkout -b feature/new-feature
# ... 작업 ...
git add .
git commit -m "feat: Add new feature"
git push origin feature/new-feature

# GitHub에서 PR 생성
```

### 2. 자동 체크 실행

PR 생성 시 자동으로 실행:
- ✅ Unit Tests
- ✅ E2E Tests
- ✅ Type Check
- ✅ Build Check
- ✅ Code Quality
- ✅ Security Audit
- ✅ Bundle Size

### 3. PR 코멘트 자동 생성

```markdown
## 🧪 PR Test Results

### Test Coverage
**Coverage**: 73.18% (Target: 70%+)

### Checks
- ✅ Unit Tests (56 passed)
- ✅ E2E Tests (17 passed)
- ✅ Type Check
- ✅ Build Verification
- ✅ Code Quality

### Bundle Size
📦 Bundle Size: 2.3 MB

### Next Steps
1. Review the test results above
2. Ensure all checks pass
3. Request review from team members
```

### 4. 머지 및 배포

모든 체크 통과 후:
1. PR 승인 및 머지
2. 자동 배포 시작
3. 프로덕션 반영

---

## 테스트 통과 기준

### ✅ 필수 통과 조건

1. **Unit Tests**: 모든 56개 테스트 통과
2. **E2E Tests**: 모든 17개 테스트 통과
3. **Type Check**: TypeScript 에러 0개
4. **Build**: 프로덕션 빌드 성공
5. **Coverage**: 70% 이상 (현재: 73.18%)

### ⚠️ 경고 조건 (Optional)

1. **ESLint**: 경고 10개 이하
2. **Bundle Size**: 3MB 이하
3. **Security Audit**: 중대한 취약점 없음

---

## 모니터링 및 알림

### Sentry Integration

배포 후 자동으로:
- Release 생성
- Source Map 업로드
- 이전 버전과 비교

### GitHub Notifications

- ✅ 테스트 성공: GitHub 체크 표시
- ❌ 테스트 실패: PR 코멘트 + 이메일 알림
- 🚀 배포 완료: Commit 코멘트

---

## 트러블슈팅

### Q1: E2E 테스트가 CI에서 실패함

**원인**: 브라우저 환경 차이

**해결**:
```yaml
# .github/workflows/test.yml
- name: Install Cypress dependencies
  run: |
    sudo apt-get install -y libgtk2.0-0 libgtk-3-0 libgbm-dev \
    libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6 xauth xvfb
```

### Q2: Cloudflare 배포 실패

**원인**: API Token 권한 부족

**해결**:
1. Cloudflare Dashboard → API Tokens
2. "Edit Cloudflare Workers" 권한 확인
3. "Cloudflare Pages" 권한 추가

### Q3: Secrets가 인식되지 않음

**확인사항**:
```bash
# GitHub Repository Settings
→ Secrets and variables → Actions
→ Repository secrets

# Secret 이름 확인 (대소문자 구분)
VITE_FIREBASE_API_KEY ✅
vite_firebase_api_key ❌
```

### Q4: 커버리지가 70% 미만

**해결**:
```bash
# 로컬에서 확인
npm run test:unit:coverage

# 커버리지 리포트 확인
open coverage/index.html

# 테스트 추가 후 재실행
```

---

## 참고 문서

- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [Cloudflare Pages 문서](https://developers.cloudflare.com/pages/)
- [Cypress CI 문서](https://docs.cypress.io/guides/continuous-integration/introduction)
- [CYPRESS_E2E_GUIDE.md](./CYPRESS_E2E_GUIDE.md)
- [REMAINING_ISSUES_AND_SOLUTIONS.md](./REMAINING_ISSUES_AND_SOLUTIONS.md)

---

**작성자**: Claude (GenSpark AI Developer)  
**최종 업데이트**: 2026-03-06  
**문서 버전**: 1.0.0
