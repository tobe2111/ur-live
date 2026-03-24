# UR Live 듀얼 사이트 Cloudflare Pages 설정 가이드

> **중요**: UR Live는 **2개의 독립적인 사이트**로 운영됩니다!  
> - **live.ur-team.com** (KR 버전) - Kakao, TossPayments  
> - **world.ur-team.com** (GLOBAL 버전) - Google, Stripe

---

## 🌍 아키텍처 개요

```
GitHub Repository (1개)
    tobe2111/ur-live
         │
         ├─ main 브랜치 (공통 코드)
         │
         ├─→ Cloudflare Pages Project 1: "ur-live-kr"
         │   ├─ Build: npm run build:kr
         │   ├─ Output: /dist
         │   ├─ Domain: live.ur-team.com
         │   └─ Region: KR (Kakao + Toss)
         │
         └─→ Cloudflare Pages Project 2: "ur-live-global"
             ├─ Build: npm run build:global
             ├─ Output: /dist-global
             ├─ Domain: world.ur-team.com
             └─ Region: GLOBAL (Google + Stripe)
```

**핵심**: 하나의 GitHub 저장소를 2개의 Cloudflare Pages 프로젝트가 각각 다른 빌드 명령어로 배포!

---

## 📋 설정 순서

### Phase 1: KR 사이트 설정 (live.ur-team.com)
### Phase 2: GLOBAL 사이트 설정 (world.ur-team.com)

---

## 🇰🇷 Phase 1: KR 사이트 설정

### Step 1: Cloudflare Pages 프로젝트 생성

```
1. https://dash.cloudflare.com/ 로그인
2. Workers & Pages → "Create application"
3. "Pages" → "Connect to Git"
4. GitHub 계정 연결
5. Repository 선택: tobe2111/ur-live
6. "Begin setup" 클릭
```

### Step 2: Build Configuration (KR)

```yaml
Project name: ur-live-kr

Production branch: main

Framework preset: None (또는 Custom)

Build command: npm run build:kr

Build output directory: /dist

Root directory: (비워두기)

Environment variables: Production
```

### Step 3: Environment Variables (KR) - 12개

**Firebase (8개)**:
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

**Kakao OAuth (3개)**:
```bash
VITE_KAKAO_REST_API_KEY=실제_카카오_REST_키
VITE_KAKAO_JAVASCRIPT_KEY=실제_카카오_JS_키
VITE_KAKAO_AUTH_URL=https://kauth.kakao.com
```

**TossPayments (1개)**:
```bash
VITE_TOSS_CLIENT_KEY=실제_토스_클라이언트_키
```

### Step 4: Worker Secrets (KR)

```bash
cd /home/user/webapp

# Firebase Admin SDK
echo "실제값" | npx wrangler pages secret put FIREBASE_PROJECT_ID --project-name ur-live-kr
echo "실제값" | npx wrangler pages secret put FIREBASE_PRIVATE_KEY --project-name ur-live-kr
echo "실제값" | npx wrangler pages secret put FIREBASE_CLIENT_EMAIL --project-name ur-live-kr

# Kakao
echo "실제값" | npx wrangler pages secret put KAKAO_CLIENT_SECRET --project-name ur-live-kr

# TossPayments
echo "실제값" | npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live-kr

# 공통
echo "실제값" | npx wrangler pages secret put JWT_SECRET --project-name ur-live-kr
echo "실제값" | npx wrangler pages secret put RESEND_API_KEY --project-name ur-live-kr
echo "실제값" | npx wrangler pages secret put EMAIL_FROM --project-name ur-live-kr
```

### Step 5: Custom Domain (KR)

```
1. Settings → Custom domains
2. "Set up a custom domain"
3. Domain 입력: live.ur-team.com
4. DNS 자동 설정 확인
5. "Activate domain"
```

### Step 6: 첫 배포 (KR)

```
1. "Save and Deploy" 클릭
2. 빌드 로그 확인:
   ✅ Building for region: KR
   ✅ Env validation passed
   ✅ Build completed
3. 배포 URL 확인
4. https://live.ur-team.com 접속 테스트
```

---

## 🌏 Phase 2: GLOBAL 사이트 설정

### Step 1: 새 Cloudflare Pages 프로젝트 생성

```
1. https://dash.cloudflare.com/ 로그인
2. Workers & Pages → "Create application"
3. "Pages" → "Connect to Git"
4. GitHub 계정 연결 (이미 연결됨)
5. Repository 선택: tobe2111/ur-live (동일 저장소!)
6. "Begin setup" 클릭
```

⚠️ **중요**: 동일한 GitHub 저장소를 다시 선택합니다!

### Step 2: Build Configuration (GLOBAL)

```yaml
Project name: ur-live-global

Production branch: main

Framework preset: None (또는 Custom)

Build command: npm run build:global

Build output directory: /dist-global

Root directory: (비워두기)

Environment variables: Production
```

### Step 3: Environment Variables (GLOBAL) - 10개

**Firebase (8개)**:
```bash
VITE_FIREBASE_API_KEY=실제_API_키
VITE_FIREBASE_AUTH_DOMAIN=프로젝트.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=프로젝트_ID
VITE_FIREBASE_STORAGE_BUCKET=프로젝트.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:실제앱ID
VITE_FIREBASE_MEASUREMENT_ID=G-실제측정ID
VITE_REGION=GLOBAL
```

**Google OAuth (1개)**:
```bash
VITE_GOOGLE_CLIENT_ID=실제_구글_클라이언트_ID.apps.googleusercontent.com
```

**Stripe (1개)**:
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_실제_스트라이프_퍼블릭_키
```

### Step 4: Worker Secrets (GLOBAL)

```bash
cd /home/user/webapp

# Firebase Admin SDK (동일)
echo "실제값" | npx wrangler pages secret put FIREBASE_PROJECT_ID --project-name ur-live-global
echo "실제값" | npx wrangler pages secret put FIREBASE_PRIVATE_KEY --project-name ur-live-global
echo "실제값" | npx wrangler pages secret put FIREBASE_CLIENT_EMAIL --project-name ur-live-global

# Google OAuth
echo "실제값" | npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name ur-live-global

# Stripe
echo "실제값" | npx wrangler pages secret put STRIPE_SECRET_KEY --project-name ur-live-global

# 공통
echo "실제값" | npx wrangler pages secret put JWT_SECRET --project-name ur-live-global
echo "실제값" | npx wrangler pages secret put RESEND_API_KEY --project-name ur-live-global
echo "실제값" | npx wrangler pages secret put EMAIL_FROM --project-name ur-live-global
```

### Step 5: Custom Domain (GLOBAL)

```
1. Settings → Custom domains
2. "Set up a custom domain"
3. Domain 입력: world.ur-team.com
4. DNS 자동 설정 확인
5. "Activate domain"
```

### Step 6: 첫 배포 (GLOBAL)

```
1. "Save and Deploy" 클릭
2. 빌드 로그 확인:
   ✅ Building for region: GLOBAL
   ✅ Env validation passed
   ✅ Build completed
3. 배포 URL 확인
4. https://world.ur-team.com 접속 테스트
```

---

## 🔄 자동 배포 워크플로우

### 코드 푸시 시 (main 브랜치)

```bash
git push origin main
```

**자동으로 발생하는 일**:
```
1. Cloudflare가 변경 감지
2. 두 프로젝트 모두 자동 빌드 시작:
   
   ├─ ur-live-kr
   │  ├─ npm run build:kr 실행
   │  ├─ /dist 폴더 배포
   │  └─ live.ur-team.com 업데이트 ✅
   │
   └─ ur-live-global
      ├─ npm run build:global 실행
      ├─ /dist-global 폴더 배포
      └─ world.ur-team.com 업데이트 ✅
```

**배포 시간**: 각 사이트 약 3분, 병렬 실행 가능

---

## 📊 설정 비교표

| 항목 | KR (live.ur-team.com) | GLOBAL (world.ur-team.com) |
|------|----------------------|----------------------------|
| **프로젝트명** | ur-live-kr | ur-live-global |
| **Build command** | `npm run build:kr` | `npm run build:global` |
| **Output directory** | `/dist` | `/dist-global` |
| **환경 변수** | Firebase (8) + Kakao (3) + Toss (1) = 12개 | Firebase (8) + Google (1) + Stripe (1) = 10개 |
| **Worker Secrets** | Firebase + Kakao + Toss + 공통 = 8개 | Firebase + Google + Stripe + 공통 = 8개 |
| **인증 방식** | Kakao OAuth | Google OAuth |
| **결제 방식** | TossPayments | Stripe |

---

## ✅ 검증 방법

### KR 사이트 검증
```bash
# 1. 빌드 확인
curl -I https://live.ur-team.com
# → HTTP/2 200

# 2. Kakao SDK 확인
curl https://live.ur-team.com | grep -i "kakao"
# → Kakao 관련 스크립트 확인

# 3. 자동 검증 스크립트
./scripts/verify-deployment.sh https://live.ur-team.com
```

### GLOBAL 사이트 검증
```bash
# 1. 빌드 확인
curl -I https://world.ur-team.com
# → HTTP/2 200

# 2. Google/Stripe 확인
curl https://world.ur-team.com | grep -i "google\|stripe"
# → Google/Stripe 관련 스크립트 확인

# 3. 자동 검증 스크립트
./scripts/verify-deployment.sh https://world.ur-team.com
```

---

## 🆘 트러블슈팅

### 문제 1: KR 사이트에서 Kakao SDK 로드 안됨

**원인**: 잘못된 환경 변수 또는 빌드 명령어

**확인**:
```
1. Cloudflare Dashboard → ur-live-kr → Settings
2. Build command: npm run build:kr 확인
3. Environment variables에서 VITE_KAKAO_* 확인
4. "Retry deployment" 클릭
```

### 문제 2: GLOBAL 사이트에서 Google 로그인 안됨

**원인**: Google Client ID 누락

**해결**:
```
1. Cloudflare Dashboard → ur-live-global → Settings
2. Environment variables → VITE_GOOGLE_CLIENT_ID 확인
3. Google Cloud Console에서 Client ID 확인
4. "Retry deployment" 클릭
```

### 문제 3: 두 사이트가 같은 빌드를 사용함

**원인**: Build command가 동일하게 설정됨

**해결**:
```
ur-live-kr:    npm run build:kr
ur-live-global: npm run build:global

각 프로젝트의 Build command를 확인하고 수정
```

### 문제 4: 빌드는 성공했는데 404 에러

**원인**: Output directory 불일치

**해결**:
```
ur-live-kr:    /dist
ur-live-global: /dist-global

Settings → Build output directory 확인
```

---

## 📋 체크리스트

### KR 사이트 (live.ur-team.com)

- [ ] Cloudflare Pages 프로젝트 생성 (ur-live-kr)
- [ ] GitHub 저장소 연결 (tobe2111/ur-live)
- [ ] Build command: `npm run build:kr`
- [ ] Build output: `/dist`
- [ ] 환경 변수 12개 추가
- [ ] Worker secrets 8개 추가
- [ ] Custom domain: live.ur-team.com
- [ ] 첫 배포 성공
- [ ] 사이트 접속 테스트
- [ ] Kakao 로그인 테스트

### GLOBAL 사이트 (world.ur-team.com)

- [ ] Cloudflare Pages 프로젝트 생성 (ur-live-global)
- [ ] GitHub 저장소 연결 (tobe2111/ur-live) - 동일!
- [ ] Build command: `npm run build:global`
- [ ] Build output: `/dist-global`
- [ ] 환경 변수 10개 추가
- [ ] Worker secrets 8개 추가
- [ ] Custom domain: world.ur-team.com
- [ ] 첫 배포 성공
- [ ] 사이트 접속 테스트
- [ ] Google 로그인 테스트
- [ ] Stripe 결제 테스트

### 자동 배포 검증

- [ ] main 브랜치에 테스트 커밋 푸시
- [ ] ur-live-kr 자동 빌드 확인
- [ ] ur-live-global 자동 빌드 확인
- [ ] 두 사이트 모두 업데이트 확인

---

## 💡 핵심 포인트

### ✅ 반드시 기억할 것

1. **동일한 GitHub 저장소**를 2개의 Cloudflare Pages 프로젝트가 사용
2. **Build command가 다름**: `npm run build:kr` vs `npm run build:global`
3. **Output directory가 다름**: `/dist` vs `/dist-global`
4. **환경 변수가 다름**: Kakao+Toss vs Google+Stripe
5. **하나의 코드 푸시로 두 사이트 모두 자동 배포**

### ❌ 주의사항

1. Build command를 혼동하지 말 것 (KR/GLOBAL 구분)
2. 환경 변수를 잘못된 프로젝트에 추가하지 말 것
3. Output directory를 동일하게 설정하지 말 것

---

## 📚 관련 문서

- **ENVIRONMENT_VARIABLES.md** - 모든 환경 변수 레퍼런스
- **DEPLOYMENT_PROTOCOL_2026.md** - 배포 프로토콜
- **CLOUDFLARE_BUILD_ERROR_FIX.md** - 빌드 에러 해결

---

**생성일**: 2026-03-05  
**프로젝트**: UR Live  
**버전**: 2.0.0 (Dual Site Architecture)  
**상태**: ✅ 완성 - 즉시 실행 가능
