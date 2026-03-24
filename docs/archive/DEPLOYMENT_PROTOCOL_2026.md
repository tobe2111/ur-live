# UR Live Deployment Protocol - 2026 Edition

> **목적**: 2026년 기준 UR Live 프로젝트의 영구적이고 자동화된 배포 프로세스 정립

## 📋 목차

1. [배포 방식 비교](#배포-방식-비교)
2. [GitHub Integration 설정 (권장)](#github-integration-설정-권장)
3. [자동 배포 워크플로우](#자동-배포-워크플로우)
4. [환경 변수 관리](#환경-변수-관리)
5. [배포 검증](#배포-검증)
6. [트러블슈팅](#트러블슈팅)

## 🎯 배포 방식 비교

### ❌ 기존 방식: Direct Upload

**문제점**:
- ✗ Cloudflare Dashboard에 "Build configuration" 섹션 없음
- ✗ 매번 수동 배포 필요 (`wrangler pages deploy`)
- ✗ 빌드 설정 영구 저장 불가
- ✗ 배포 이력 관리 어려움
- ✗ 팀원 간 배포 설정 공유 불가

**배포 프로세스**:
```bash
# 개발자 로컬에서 매번 실행 필요
npm run build:kr
npx wrangler pages deploy dist --project-name ur-live
```

### ✅ 새로운 방식: GitHub Integration (2026)

**장점**:
- ✓ Dashboard에 "Build configuration" 섹션 제공
- ✓ 자동 배포 (코드 푸시 시 자동 빌드)
- ✓ 빌드 설정 영구 저장
- ✓ 배포 이력 자동 추적
- ✓ Rollback 기능 제공
- ✓ Preview 배포 자동 생성
- ✓ 팀 협업 용이

**배포 프로세스**:
```bash
# 개발자는 코드만 푸시
git push origin main

# Cloudflare가 자동으로:
# 1. 코드 pull
# 2. npm run build:kr 실행
# 3. dist 폴더 배포
# 4. live.ur-team.com 업데이트
```

## 🚀 GitHub Integration 설정 (권장)

### Step 1: Cloudflare Dashboard 접속

```
1. https://dash.cloudflare.com/ 로그인
2. Workers & Pages 메뉴 선택
3. 기존 ur-live 프로젝트 확인
```

### Step 2: 새 Pages 프로젝트 생성

⚠️ **중요**: 기존 Direct Upload 프로젝트는 Git 연동으로 전환 불가능합니다.

```
1. "Create application" 버튼 클릭
2. "Pages" 탭 선택
3. "Connect to Git" 선택
4. GitHub 계정 연결
5. 저장소 선택: tobe2111/ur-live
6. "Begin setup" 클릭
```

### Step 3: Build Configuration 설정

```yaml
프로젝트명: ur-live-github

Production branch: main

Build settings:
  Framework preset: None (또는 Custom)
  Build command: npm run build:kr
  Build output directory: dist
  Root directory: (비워두기)
```

### Step 4: Environment Variables 추가

**필수 환경 변수** (총 12개):

```bash
# Firebase (8개)
VITE_FIREBASE_API_KEY=실제값
VITE_FIREBASE_AUTH_DOMAIN=실제값
VITE_FIREBASE_PROJECT_ID=실제값
VITE_FIREBASE_STORAGE_BUCKET=실제값
VITE_FIREBASE_MESSAGING_SENDER_ID=실제값
VITE_FIREBASE_APP_ID=실제값
VITE_FIREBASE_MEASUREMENT_ID=실제값
VITE_REGION=KR

# Kakao (3개)
VITE_KAKAO_REST_API_KEY=실제값
VITE_KAKAO_JAVASCRIPT_KEY=실제값
VITE_KAKAO_AUTH_URL=https://kauth.kakao.com

# TossPayments (1개)
VITE_TOSS_CLIENT_KEY=실제값
```

**Worker Secrets** (별도 설정):

```bash
# wrangler CLI로 설정
npx wrangler pages secret put FIREBASE_PRIVATE_KEY --project-name ur-live-github
npx wrangler pages secret put KAKAO_CLIENT_SECRET --project-name ur-live-github
npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live-github
npx wrangler pages secret put JWT_SECRET --project-name ur-live-github
npx wrangler pages secret put RESEND_API_KEY --project-name ur-live-github
npx wrangler pages secret put EMAIL_FROM --project-name ur-live-github
```

자세한 환경 변수 목록은 [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) 참조.

### Step 5: Custom Domain 설정

```
1. 기존 ur-live 프로젝트에서 live.ur-team.com 제거
2. 새 ur-live-github 프로젝트 → Settings → Custom domains
3. "Set up a custom domain" 클릭
4. 도메인 입력: live.ur-team.com
5. "Activate domain" 클릭
```

### Step 6: 첫 배포 실행

```
1. "Save and Deploy" 클릭
2. 빌드 로그 모니터링 (3-5분 소요)
3. 배포 성공 확인
4. https://live.ur-team.com 접속 테스트
```

## 🔄 자동 배포 워크플로우

### 일반 개발 플로우

```bash
# 1. Feature 브랜치 생성 (선택사항)
git checkout -b feature/new-feature

# 2. 코드 수정
# ... 파일 수정 ...

# 3. 로컬 테스트 (권장)
npm run dev
npm run build:kr  # 빌드 에러 사전 확인

# 4. 커밋 및 푸시
git add .
git commit -m "feat: 새 기능 추가"
git push origin feature/new-feature

# 5. Cloudflare가 자동으로 Preview 배포 생성
# → https://[commit-hash].ur-live-github.pages.dev

# 6. PR 생성 및 리뷰
# GitHub에서 Pull Request 생성

# 7. main 브랜치 병합
git checkout main
git merge feature/new-feature
git push origin main

# 8. Cloudflare가 자동으로 Production 배포
# → https://live.ur-team.com 업데이트
```

### 긴급 핫픽스 플로우

```bash
# 1. 긴급 수정
git checkout -b hotfix/critical-bug
# ... 버그 수정 ...
git add .
git commit -m "fix: Critical bug fix"

# 2. 바로 main에 병합
git checkout main
git merge hotfix/critical-bug
git push origin main

# 3. 자동 배포 (약 3-5분)
# Cloudflare Dashboard에서 진행 상황 모니터링
```

### 롤백 플로우

```
# Option 1: Cloudflare Dashboard (권장)
1. Workers & Pages → ur-live-github → Deployments
2. 이전 성공한 배포 찾기
3. "..." 메뉴 → "Rollback to this deployment"
4. 즉시 이전 버전으로 복구

# Option 2: Git Revert
git revert <commit-hash>
git push origin main
# Cloudflare가 자동으로 이전 코드 배포
```

## 🔐 환경 변수 관리

### Build 환경 변수 (VITE_*)

**설정 위치**: Cloudflare Dashboard → Settings → Environment variables

**특징**:
- 빌드 시에 코드에 포함됨
- 클라이언트에 노출 가능
- 변경 시 재배포 필요

**설정 방법**:
```
1. Settings → Environment variables
2. "Add variable" 클릭
3. Name: VITE_FIREBASE_API_KEY
4. Value: 실제 API 키
5. Environment: Production (또는 Preview)
6. "Save" 클릭
```

### Worker Secrets

**설정 위치**: Wrangler CLI

**특징**:
- 런타임에만 사용 (Worker 코드에서 접근)
- 클라이언트에 절대 노출 안됨
- 변경 시 재배포 불필요 (즉시 반영)

**설정 방법**:
```bash
cd /home/user/webapp

# 대화형 입력
npx wrangler pages secret put SECRET_NAME --project-name ur-live-github

# 파이프 입력
echo "secret_value" | npx wrangler pages secret put SECRET_NAME --project-name ur-live-github

# 목록 확인
npx wrangler pages secret list --project-name ur-live-github
```

## ✅ 배포 검증

### 자동 검증 스크립트

```bash
cd /home/user/webapp

# 배포 후 자동 검증 실행
./scripts/verify-deployment.sh https://live.ur-team.com
```

**검증 항목** (10개):
1. ✅ Site Reachability (HTTP 200)
2. ✅ HTML Content Validity
3. ✅ JavaScript Asset Loading (404 체크)
4. ✅ Health Endpoint (`/api/health`)
5. ✅ Kakao SDK Loading
6. ✅ TossPayments Widget
7. ✅ Response Time (< 2초)
8. ✅ SSL Certificate
9. ✅ CORS Headers
10. ✅ Cache Headers

### 수동 검증

```bash
# 1. 사이트 접속
curl -I https://live.ur-team.com
# → HTTP/2 200 응답 확인

# 2. Health Check
curl https://live.ur-team.com/api/health
# → {"status":"ok",...} 응답 확인

# 3. JavaScript 파일 로드
# 브라우저에서 F12 → Console 탭
# → 404 에러 없는지 확인
```

## 🆘 트러블슈팅

### 문제 1: 빌드 실패 - "Missing environment variable"

**증상**:
```
Build failed: Missing required environment variable: VITE_KAKAO_REST_API_KEY
```

**원인**: 필수 환경 변수 누락

**해결**:
```
1. Settings → Environment variables
2. 누락된 변수 추가
3. "Retry deployment" 클릭
```

### 문제 2: JavaScript 404 에러 지속

**증상**: 브라우저 콘솔에 `/assets/index-xxx.js 404` 에러

**원인**: 
- 빌드 파일과 index.html 불일치
- Cloudflare 캐시 문제

**해결**:
```bash
# Option 1: 클린 빌드 후 재배포
cd /home/user/webapp
rm -rf dist dist-global node_modules/.vite
npm run build:kr
git add dist/
git commit -m "fix: Clean rebuild"
git push origin main

# Option 2: Cloudflare 캐시 퍼지
# Dashboard → Settings → Caching → "Purge everything"
```

### 문제 3: 환경 변수 업데이트 후에도 변경 안됨

**증상**: 환경 변수를 수정했지만 코드에서 이전 값이 계속 사용됨

**원인**: 빌드 환경 변수는 빌드 시에 코드에 포함되므로 재배포 필요

**해결**:
```
1. Settings → Environment variables에서 변수 값 변경
2. Deployments → "Retry deployment" 클릭
3. 빌드 완료 후 확인
```

### 문제 4: Worker Secret 오류

**증상**: Worker 코드에서 `env.KAKAO_CLIENT_SECRET`이 undefined

**원인**: Worker secret 미설정

**해결**:
```bash
# Secret 추가
echo "실제값" | npx wrangler pages secret put KAKAO_CLIENT_SECRET --project-name ur-live-github

# 확인
npx wrangler pages secret list --project-name ur-live-github
```

### 문제 5: 자동 배포가 트리거되지 않음

**증상**: main 브랜치에 푸시해도 배포가 시작되지 않음

**원인**: GitHub 연동 문제

**해결**:
```
1. Settings → Builds & deployments
2. GitHub 연동 상태 확인
3. 필요시 "Reconnect" 클릭
4. Production branch가 "main"인지 확인
```

## 📊 배포 성능 지표

### 배포 시간

| 단계 | 소요 시간 | 설명 |
|------|----------|------|
| Git Clone | ~10초 | GitHub에서 코드 pull |
| Dependencies Install | ~30초 | npm install |
| Build | ~25초 | npm run build:kr |
| Deploy | ~20초 | 파일 업로드 |
| **총 시간** | **~85초** | **약 1.5분** |

### 빌드 산출물 크기

| 파일 | 크기 (원본) | 크기 (gzip) |
|------|------------|------------|
| vendor-*.js | ~740 KB | ~232 KB |
| firebase-*.js | ~422 KB | ~90 KB |
| react-core-*.js | ~180 KB | ~60 KB |
| index-*.js | ~38 KB | ~12 KB |
| **총 번들** | **~1.4 MB** | **~400 KB** |

## 📚 관련 문서

- [CLOUDFLARE_PAGES_GITHUB_SETUP.md](./CLOUDFLARE_PAGES_GITHUB_SETUP.md) - GitHub Integration 상세 가이드
- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) - 환경 변수 레퍼런스
- [CI_CD_LOAD_TESTING_GUIDE.md](./CI_CD_LOAD_TESTING_GUIDE.md) - CI/CD 파이프라인 가이드
- [RATE_LIMITING_ERROR_HANDLING_GUIDE.md](./RATE_LIMITING_ERROR_HANDLING_GUIDE.md) - 에러 처리 가이드

## 🎯 체크리스트

### 초기 설정 (1회)

- [ ] Cloudflare Pages GitHub 연동 완료
- [ ] Build command 설정: `npm run build:kr`
- [ ] Build output directory 설정: `dist`
- [ ] 모든 환경 변수 추가 완료
- [ ] Worker secrets 추가 완료
- [ ] Custom domain 설정 완료
- [ ] 첫 배포 성공 확인

### 매 배포 시

- [ ] 로컬 빌드 테스트 성공 (`npm run build:kr`)
- [ ] Git 커밋 및 푸시
- [ ] Cloudflare Dashboard에서 배포 시작 확인
- [ ] 빌드 로그 모니터링
- [ ] 배포 성공 확인
- [ ] `./scripts/verify-deployment.sh` 실행
- [ ] Production 사이트 동작 확인

---

**생성일**: 2026-03-05
**프로젝트**: UR Live
**버전**: 2.0.0
**상태**: GitHub Integration 기반 자동 배포
