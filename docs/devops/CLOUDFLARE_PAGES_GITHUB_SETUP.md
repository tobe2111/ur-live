# Cloudflare Pages GitHub Integration Setup Guide

> **목적**: Direct Upload 모드에서 GitHub 자동 배포 모드로 전환하여 영구적인 Build Configuration 설정

## 📋 현재 상황

- **현재 배포 방식**: Direct Upload (wrangler pages deploy)
- **문제점**: Settings → Builds & deployments에 "Build configuration" 섹션이 없음
- **원인**: Direct Upload 프로젝트는 Git 연동이 없어 빌드 설정을 저장할 수 없음

## ✅ 해결 방법: GitHub Integration으로 전환

### Step 1: Cloudflare Dashboard 접속

1. https://dash.cloudflare.com/ 로그인
2. 왼쪽 메뉴에서 **Workers & Pages** 클릭
3. 기존 `ur-live` 프로젝트 확인

### Step 2: 새 Pages 프로젝트 생성 (GitHub 연동)

⚠️ **중요**: 기존 Direct Upload 프로젝트는 GitHub 모드로 전환 불가능합니다. 새 프로젝트를 만들어야 합니다.

#### 2.1 프로젝트 생성 시작

```
1. "Create application" 버튼 클릭
2. "Pages" 탭 선택
3. "Connect to Git" 선택
```

#### 2.2 GitHub 저장소 연결

```
1. "Connect GitHub" 클릭
2. GitHub 계정 승인
3. 저장소 선택: tobe2111/ur-live
4. "Begin setup" 클릭
```

#### 2.3 Build 설정 구성

```yaml
Project name: ur-live-github  # 또는 ur-live (기존 프로젝트명 재사용 시 삭제 필요)

Production branch: main

Build settings:
  Framework preset: None
  Build command: npm run build:kr
  Build output directory: dist
  Root directory: (leave empty)

Environment variables: (아래 Step 3 참조)
```

### Step 3: Environment Variables 설정

#### 3.1 필수 환경 변수 (KR 빌드용)

**Firebase 설정** (8개):
```bash
VITE_FIREBASE_API_KEY=실제_API_키
VITE_FIREBASE_AUTH_DOMAIN=프로젝트.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=프로젝트_ID
VITE_FIREBASE_STORAGE_BUCKET=프로젝트.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:실제앱ID
VITE_FIREBASE_MEASUREMENT_ID=G-실제측정ID
VITE_REGION=KR
```

**Kakao OAuth** (3개):
```bash
VITE_KAKAO_REST_API_KEY=실제_REST_키
VITE_KAKAO_JAVASCRIPT_KEY=실제_JS_키
VITE_KAKAO_AUTH_URL=https://kauth.kakao.com
```

**TossPayments** (1개):
```bash
VITE_TOSS_CLIENT_KEY=실제_클라이언트_키
```

**Worker Secrets** (Cloudflare Pages에서만 필요, 별도 설정):
```bash
# wrangler pages secret put 명령으로 설정
FIREBASE_PROJECT_ID=프로젝트_ID
FIREBASE_DATABASE_URL=https://프로젝트.firebaseio.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n실제키\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@프로젝트.iam.gserviceaccount.com
KAKAO_CLIENT_SECRET=실제_카카오_시크릿
TOSS_SECRET_KEY=실제_토스_시크릿
JWT_SECRET=실제_JWT_시크릿
RESEND_API_KEY=실제_Resend_키
EMAIL_FROM=noreply@ur-team.com
```

#### 3.2 환경 변수 추가 방법

**방법 A: Dashboard UI** (권장):
```
1. Settings → Environment variables
2. "Add variable" 클릭
3. 변수명과 값 입력 (Production/Preview 선택)
4. 모든 변수 추가 후 "Save" 클릭
```

**방법 B: Wrangler CLI**:
```bash
cd /home/user/webapp

# 각 변수마다 실행
echo "실제값" | npx wrangler pages secret put VARIABLE_NAME --project-name ur-live-github
```

### Step 4: 첫 배포 실행

```
1. "Save and Deploy" 클릭
2. 빌드 로그 확인 (약 3-5분 소요)
3. 배포 성공 확인: "View deployment" 클릭
```

### Step 5: Custom Domain 설정

#### 5.1 기존 도메인 제거 (기존 프로젝트에서)

```
1. 기존 ur-live 프로젝트 → Settings → Custom domains
2. live.ur-team.com 제거 ("Remove" 클릭)
```

#### 5.2 새 프로젝트에 도메인 추가

```
1. 새 ur-live-github 프로젝트 → Settings → Custom domains
2. "Set up a custom domain" 클릭
3. 도메인 입력: live.ur-team.com
4. DNS 레코드 자동 추가 확인 (Cloudflare가 자동 처리)
5. "Activate domain" 클릭
```

### Step 6: 자동 배포 검증

#### 6.1 테스트 커밋 푸시

```bash
cd /home/user/webapp

# 빈 커밋으로 배포 트리거
git commit --allow-empty -m "test: Verify auto-deployment"
git push origin main
```

#### 6.2 배포 확인

```
1. Cloudflare Dashboard → ur-live-github → Deployments
2. 새 배포가 "Building" 상태로 나타나는지 확인
3. 3-5분 후 "Success" 상태 확인
4. https://live.ur-team.com 접속하여 변경사항 반영 확인
```

## 🔧 Build Configuration 설정 확인

배포 완료 후 다음 경로에서 영구 설정 확인:

```
Cloudflare Dashboard
  → Workers & Pages
  → ur-live-github
  → Settings
  → Builds & deployments
```

✅ **확인 사항**:
```yaml
Framework preset: None (또는 Custom)
Build command: npm run build:kr
Build output directory: /dist
Root directory: /
Auto-deployment: Enabled
Production branch: main
```

## 📊 배포 프로세스 비교

### Before (Direct Upload)
```
개발자 로컬 빌드 → wrangler pages deploy → 수동 업로드
- 빌드 설정 저장 불가
- 매번 수동 배포 필요
- 환경 변수 로컬 관리
- 배포 이력 추적 어려움
```

### After (GitHub Integration)
```
코드 푸시 → Cloudflare 자동 빌드 → 자동 배포
✅ 빌드 설정 영구 저장
✅ 자동 배포
✅ 환경 변수 중앙 관리
✅ 배포 이력 자동 추적
✅ Rollback 기능
```

## 🚀 자동 배포 워크플로우 (설정 후)

### 일반 개발 흐름

```bash
# 1. 코드 수정
cd /home/user/webapp
# ... 파일 수정 ...

# 2. 로컬 빌드 테스트 (선택사항)
npm run build:kr

# 3. Git 커밋 및 푸시
git add .
git commit -m "feat: 새 기능 추가"
git push origin main

# 4. Cloudflare가 자동으로:
#    - 코드 pull
#    - npm run build:kr 실행
#    - dist 폴더 배포
#    - live.ur-team.com 업데이트
```

### 배포 실패 시 자동 Rollback

```
1. Cloudflare Dashboard → Deployments
2. 이전 성공한 배포 찾기
3. "..." 메뉴 → "Rollback to this deployment"
4. 즉시 이전 버전으로 복구
```

## 🔐 보안 고려사항

### Worker Secrets 별도 관리

Worker secrets는 빌드 환경 변수와 별도로 관리됩니다:

```bash
# 각 secret을 개별적으로 추가
npx wrangler pages secret put FIREBASE_PRIVATE_KEY --project-name ur-live-github
npx wrangler pages secret put KAKAO_CLIENT_SECRET --project-name ur-live-github
npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live-github
npx wrangler pages secret put JWT_SECRET --project-name ur-live-github

# 목록 확인
npx wrangler pages secret list --project-name ur-live-github
```

⚠️ **주의**: Worker secrets는 빌드 시가 아닌 런타임에 사용됩니다.

## 📝 체크리스트

### 초기 설정 완료 확인

- [ ] Cloudflare Pages 프로젝트 GitHub 연동 완료
- [ ] Build command: `npm run build:kr` 설정
- [ ] Build output directory: `dist` 설정
- [ ] 모든 `VITE_*` 환경 변수 추가 완료
- [ ] Worker secrets 추가 완료
- [ ] Custom domain (live.ur-team.com) 설정 완료
- [ ] 테스트 배포 성공 확인
- [ ] 자동 배포 동작 확인

### 배포 검증

- [ ] https://live.ur-team.com 정상 접속
- [ ] Console에 404 에러 없음
- [ ] Kakao SDK 정상 로드
- [ ] TossPayments 위젯 정상 로드
- [ ] 모든 페이지 정상 동작

## 🆘 트러블슈팅

### 문제 1: 빌드 실패 - "MODULE_NOT_FOUND"

**원인**: package.json의 의존성 누락
**해결**:
```bash
cd /home/user/webapp
npm install
git add package-lock.json
git commit -m "fix: Update dependencies"
git push origin main
```

### 문제 2: 환경 변수 인식 안됨

**원인**: 변수명 오타 또는 미설정
**해결**:
```
1. Settings → Environment variables
2. 모든 VITE_ 변수 확인
3. 변수 추가 후 "Redeploy" 클릭
```

### 문제 3: Worker 실행 오류

**원인**: Worker secrets 미설정
**해결**:
```bash
npx wrangler pages secret put SECRET_NAME --project-name ur-live-github
```

### 문제 4: 404 에러 지속

**원인**: 캐시 문제
**해결**:
```
1. Settings → Caching
2. "Purge everything" 클릭
3. 브라우저에서 Ctrl+Shift+R (강력 새로고침)
```

## 📚 추가 참고 자료

- [Cloudflare Pages 공식 문서](https://developers.cloudflare.com/pages/)
- [GitHub Integration 가이드](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Build Configuration 참조](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [환경 변수 관리](https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables)

## 🎯 다음 단계

1. ✅ GitHub 연동 완료
2. ✅ 자동 배포 설정 완료
3. ⏳ CI/CD 파이프라인 활성화 (GitHub Actions)
4. ⏳ 로드 테스트 자동화
5. ⏳ 모니터링 설정 (Sentry, Discord alerts)

---

**생성일**: 2026-03-05
**프로젝트**: UR Live
**작성자**: AI Developer
**버전**: 1.0.0
