# 🚀 UR Live 듀얼 사이트 배포 실행 가이드

> **실행 계획**: KR 사이트 + GLOBAL 사이트 완전 구축  
> **예상 소요 시간**: 40-50분  
> **상태**: ⏳ 사용자 작업 대기 중

---

## 📋 전체 로드맵

```
Phase 1: KR 사이트 (live.ur-team.com)        [20-25분]
    ├─ Step 1-1: 프로젝트 생성 (5분)
    ├─ Step 1-2: Build 설정 (2분)
    ├─ Step 1-3: 환경 변수 추가 (5분)
    ├─ Step 1-4: Worker Secrets (5분)
    ├─ Step 1-5: Custom Domain (2분)
    └─ Step 1-6: 첫 배포 및 검증 (3분)

Phase 2: GLOBAL 사이트 (world.ur-team.com)  [20-25분]
    ├─ Step 2-1: 프로젝트 생성 (5분)
    ├─ Step 2-2: Build 설정 (2분)
    ├─ Step 2-3: 환경 변수 추가 (5분)
    ├─ Step 2-4: Worker Secrets (5분)
    ├─ Step 2-5: Custom Domain (2분)
    └─ Step 2-6: 첫 배포 및 검증 (3분)

Phase 3: 자동 배포 검증                      [5분]
    ├─ Step 3-1: 테스트 커밋 푸시
    ├─ Step 3-2: 병렬 빌드 확인
    └─ Step 3-3: 양쪽 사이트 검증
```

---

## 🇰🇷 Phase 1: KR 사이트 (live.ur-team.com)

### ✅ Step 1-1: 프로젝트 생성 및 GitHub 연동 (5분)

**1. Cloudflare Dashboard 접속**
```
URL: https://dash.cloudflare.com/
```

**2. Workers & Pages로 이동**
```
좌측 메뉴 → Workers & Pages 클릭
```

**3. 새 프로젝트 생성**
```
"Create application" 버튼 클릭
→ "Pages" 탭 선택
→ "Connect to Git" 선택
```

**4. GitHub 연결**
```
"Connect GitHub" 클릭
→ GitHub 로그인 및 승인
→ Repository 선택: tobe2111/ur-live
→ "Begin setup" 클릭
```

✅ **확인**: GitHub 저장소가 연결되고 설정 페이지로 이동

---

### ✅ Step 1-2: Build Configuration 설정 (2분)

**설정 값 입력**:

```yaml
Project name: ur-live-kr

Production branch: main

Framework preset: None

Build command: npm run build:kr

Build output directory: /dist

Root directory: (비워두기)
```

⚠️ **중요**: 
- Build command를 정확히 `npm run build:kr`로 입력
- Build output은 `/dist` (슬래시 포함)

✅ **확인**: 모든 값이 정확히 입력되었는지 재확인

---

### ✅ Step 1-3: 환경 변수 추가 (5분)

**"Environment variables" 섹션으로 스크롤**

**다음 12개 변수 추가**:

#### Firebase (8개)
```bash
VITE_FIREBASE_API_KEY
→ 실제 Firebase API Key 입력

VITE_FIREBASE_AUTH_DOMAIN
→ your-project.firebaseapp.com

VITE_FIREBASE_PROJECT_ID
→ your-project-id

VITE_FIREBASE_STORAGE_BUCKET
→ your-project.appspot.com

VITE_FIREBASE_MESSAGING_SENDER_ID
→ 123456789012

VITE_FIREBASE_APP_ID
→ 1:123456789012:web:your-app-id

VITE_FIREBASE_MEASUREMENT_ID
→ G-YOUR-MEASUREMENT-ID

VITE_REGION
→ KR
```

#### Kakao (3개)
```bash
VITE_KAKAO_REST_API_KEY
→ Kakao REST API Key

VITE_KAKAO_JAVASCRIPT_KEY
→ Kakao JavaScript Key

VITE_KAKAO_AUTH_URL
→ https://kauth.kakao.com
```

#### TossPayments (1개)
```bash
VITE_TOSS_CLIENT_KEY
→ Toss Client Key (test_ 또는 live_ 시작)
```

**변수 추가 방법**:
```
1. "Add variable" 클릭
2. Name: 변수명 입력
3. Value: 실제 값 입력
4. Environment: "Production" 선택
5. "Save" 클릭
6. 위 과정을 12번 반복
```

✅ **확인**: 12개 변수가 모두 추가되었는지 확인

---

### ✅ Step 1-4: Worker Secrets 설정 (5분)

⚠️ **주의**: 이 단계는 **배포 후**에 실행해야 합니다. 지금은 **Step 1-6 완료 후**로 이동하세요.

---

### ✅ Step 1-5: Custom Domain 설정 (2분)

⚠️ **주의**: 현재 기존 프로젝트에 `live.ur-team.com`이 연결되어 있다면:

**1. 기존 프로젝트에서 도메인 제거**
```
기존 ur-live 프로젝트 → Settings → Custom domains
→ live.ur-team.com 찾기
→ "Remove" 클릭
```

**2. 지금은 건너뛰고 Step 1-6 완료 후 설정**

---

### ✅ Step 1-6: 첫 배포 실행 (3분)

**1. 배포 시작**
```
"Save and Deploy" 버튼 클릭
```

**2. 빌드 로그 모니터링**
```
자동으로 빌드 로그 페이지로 이동
→ 다음 메시지 확인:

✅ "🌍 [Vite Config] Building for region: KR"
✅ "🔍 [Env Validator] 환경 변수 검증 시작 (Mode: kr, Region: KR)"
✅ "✅ [Env Validator] 빌드 타임 검증 완료"
```

**3. 배포 완료 대기** (약 3분)
```
"Success" 상태 확인
→ 배포 URL 확인 (예: abc123.ur-live-kr.pages.dev)
```

**4. 배포 URL 접속 테스트**
```
배포 URL 클릭
→ 사이트 로딩 확인
→ F12 → Console → 404 에러 없는지 확인
```

✅ **확인**: 
- 빌드 성공
- 사이트 정상 로딩
- Console에 404 에러 없음

---

### ✅ Step 1-4 (재개): Worker Secrets 설정 (5분)

**이제 프로젝트가 생성되었으므로 Secrets 추가 가능**

**터미널에서 실행** (또는 Cloudflare Dashboard):

```bash
cd /home/user/webapp

# Firebase Admin SDK
npx wrangler pages secret put FIREBASE_PROJECT_ID --project-name ur-live-kr
# → 프롬프트에서 실제 Project ID 입력

npx wrangler pages secret put FIREBASE_PRIVATE_KEY --project-name ur-live-kr
# → 프롬프트에서 Private Key 입력 (-----BEGIN PRIVATE KEY----- 포함)

npx wrangler pages secret put FIREBASE_CLIENT_EMAIL --project-name ur-live-kr
# → 프롬프트에서 firebase-adminsdk@... 이메일 입력

# Kakao
npx wrangler pages secret put KAKAO_CLIENT_SECRET --project-name ur-live-kr
# → Kakao Client Secret 입력

# TossPayments
npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live-kr
# → Toss Secret Key 입력

# 공통
npx wrangler pages secret put JWT_SECRET --project-name ur-live-kr
# → JWT Secret (랜덤 문자열) 입력

npx wrangler pages secret put RESEND_API_KEY --project-name ur-live-kr
# → Resend API Key 입력

npx wrangler pages secret put EMAIL_FROM --project-name ur-live-kr
# → 발신자 이메일 입력 (예: noreply@ur-team.com)
```

**Secrets 확인**:
```bash
npx wrangler pages secret list --project-name ur-live-kr
```

✅ **확인**: 8개 secrets가 모두 등록됨

---

### ✅ Step 1-5 (재개): Custom Domain 설정 (2분)

**1. Cloudflare Dashboard**
```
ur-live-kr 프로젝트 → Settings → Custom domains
```

**2. 도메인 추가**
```
"Set up a custom domain" 클릭
→ Domain 입력: live.ur-team.com
→ "Activate domain" 클릭
```

**3. DNS 자동 설정 확인**
```
Cloudflare가 자동으로 CNAME 레코드 추가
→ "Active" 상태 확인 (약 1-2분 소요)
```

**4. HTTPS 인증서 확인**
```
자동으로 SSL 인증서 발급 (약 5분)
```

✅ **확인**: 
- live.ur-team.com → Active
- HTTPS 작동

---

### 🎉 Phase 1 완료!

**KR 사이트 체크리스트**:
- [x] Cloudflare Pages 프로젝트 생성 (ur-live-kr)
- [x] Build command: npm run build:kr
- [x] 환경 변수 12개 추가
- [x] Worker secrets 8개 추가
- [x] Custom domain: live.ur-team.com
- [x] 첫 배포 성공
- [x] 사이트 정상 작동

**다음**: Phase 2 (GLOBAL 사이트) 시작

---

## 🌏 Phase 2: GLOBAL 사이트 (world.ur-team.com)

### ✅ Step 2-1: 프로젝트 생성 및 GitHub 연동 (5분)

**1. Cloudflare Dashboard**
```
Workers & Pages → "Create application" 클릭
```

**2. 동일한 저장소 연결**
```
"Pages" → "Connect to Git"
→ 이미 GitHub 연결됨
→ Repository 선택: tobe2111/ur-live (동일!)
→ "Begin setup" 클릭
```

⚠️ **중요**: 동일한 GitHub 저장소를 다시 선택합니다!

---

### ✅ Step 2-2: Build Configuration 설정 (2분)

**설정 값 입력**:

```yaml
Project name: ur-live-global

Production branch: main

Framework preset: None

Build command: npm run build:global

Build output directory: /dist-global

Root directory: (비워두기)
```

⚠️ **중요**: 
- Build command: `npm run build:global`
- Build output: `/dist-global` (KR과 다름!)

---

### ✅ Step 2-3: 환경 변수 추가 (5분)

**다음 10개 변수 추가**:

#### Firebase (8개) - KR과 동일
```bash
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
VITE_REGION=GLOBAL
```

⚠️ **주의**: `VITE_REGION`은 `GLOBAL`로 설정!

#### Google OAuth (1개)
```bash
VITE_GOOGLE_CLIENT_ID
→ your-client-id.apps.googleusercontent.com
```

#### Stripe (1개)
```bash
VITE_STRIPE_PUBLISHABLE_KEY
→ pk_live_... 또는 pk_test_...
```

✅ **확인**: 10개 변수가 모두 추가되었는지 확인

---

### ✅ Step 2-4: Worker Secrets 설정 (배포 후)

**Step 2-6 완료 후 실행**

---

### ✅ Step 2-5: Custom Domain 설정 (배포 후)

**Step 2-6 완료 후 설정**

---

### ✅ Step 2-6: 첫 배포 실행 (3분)

**1. 배포 시작**
```
"Save and Deploy" 버튼 클릭
```

**2. 빌드 로그 확인**
```
✅ "🌍 [Vite Config] Building for region: GLOBAL"
✅ "✅ [Env Validator] 빌드 타임 검증 완료"
```

**3. 배포 완료 대기**
```
"Success" 상태 확인
→ 배포 URL 접속 테스트
```

✅ **확인**: GLOBAL 빌드 성공

---

### ✅ Step 2-4 (재개): Worker Secrets 설정 (5분)

```bash
cd /home/user/webapp

# Firebase Admin SDK (동일)
npx wrangler pages secret put FIREBASE_PROJECT_ID --project-name ur-live-global
npx wrangler pages secret put FIREBASE_PRIVATE_KEY --project-name ur-live-global
npx wrangler pages secret put FIREBASE_CLIENT_EMAIL --project-name ur-live-global

# Google OAuth
npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name ur-live-global

# Stripe
npx wrangler pages secret put STRIPE_SECRET_KEY --project-name ur-live-global

# 공통
npx wrangler pages secret put JWT_SECRET --project-name ur-live-global
npx wrangler pages secret put RESEND_API_KEY --project-name ur-live-global
npx wrangler pages secret put EMAIL_FROM --project-name ur-live-global
```

✅ **확인**: 8개 secrets 등록 완료

---

### ✅ Step 2-5 (재개): Custom Domain 설정 (2분)

```
ur-live-global 프로젝트 → Settings → Custom domains
→ "Set up a custom domain"
→ Domain: world.ur-team.com
→ "Activate domain"
```

✅ **확인**: world.ur-team.com → Active

---

### 🎉 Phase 2 완료!

**GLOBAL 사이트 체크리스트**:
- [x] Cloudflare Pages 프로젝트 생성 (ur-live-global)
- [x] Build command: npm run build:global
- [x] 환경 변수 10개 추가
- [x] Worker secrets 8개 추가
- [x] Custom domain: world.ur-team.com
- [x] 첫 배포 성공

---

## 🔄 Phase 3: 자동 배포 검증 (5분)

### ✅ Step 3-1: 테스트 커밋 푸시

**로컬에서 실행** (또는 여기서 실행):

```bash
cd /home/user/webapp

# 빈 커밋 생성
git commit --allow-empty -m "test: Verify dual-site auto-deployment"

# 푸시
git push origin main
```

---

### ✅ Step 3-2: 병렬 빌드 확인

**Cloudflare Dashboard에서 확인**:

```
Workers & Pages
├─ ur-live-kr
│  └─ Deployments → "Building" 상태 확인
│
└─ ur-live-global
   └─ Deployments → "Building" 상태 확인
```

**양쪽 모두 동시에 빌드 시작**!

---

### ✅ Step 3-3: 최종 검증

**1. KR 사이트 검증**
```bash
curl -I https://live.ur-team.com
# → HTTP/2 200

./scripts/verify-deployment.sh https://live.ur-team.com
```

**2. GLOBAL 사이트 검증**
```bash
curl -I https://world.ur-team.com
# → HTTP/2 200

./scripts/verify-deployment.sh https://world.ur-team.com
```

---

## 🎉 전체 완료!

### ✅ 최종 체크리스트

**KR 사이트 (live.ur-team.com)**:
- [x] 프로젝트: ur-live-kr
- [x] Build: npm run build:kr
- [x] 환경 변수: 12개
- [x] Secrets: 8개
- [x] 자동 배포: ✅
- [x] 사이트 작동: ✅

**GLOBAL 사이트 (world.ur-team.com)**:
- [x] 프로젝트: ur-live-global
- [x] Build: npm run build:global
- [x] 환경 변수: 10개
- [x] Secrets: 8개
- [x] 자동 배포: ✅
- [x] 사이트 작동: ✅

**자동 배포**:
- [x] git push → 양쪽 빌드 트리거
- [x] 병렬 빌드 작동
- [x] 양쪽 사이트 업데이트

---

## 📊 결과

```
하나의 코드 베이스 (tobe2111/ur-live)
         ↓
    git push origin main
         ↓
    ┌────────────────┴────────────────┐
    ↓                                 ↓
ur-live-kr                    ur-live-global
(npm run build:kr)            (npm run build:global)
    ↓                                 ↓
live.ur-team.com             world.ur-team.com
(Kakao + Toss)               (Google + Stripe)
```

---

**상태**: ✅ 준비 완료 - 단계별로 실행하세요!

**예상 소요 시간**: 40-50분

**다음**: Phase 1 Step 1-1부터 시작하세요!
