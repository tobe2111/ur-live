# Cloudflare Pages 환경 변수 설정 가이드

> **긴급 수정**: live.ur-team.com 404 오류 해결을 위한 환경 변수 설정

## 🎯 목표
Cloudflare Pages 프로젝트에 필요한 모든 환경 변수를 설정하여 사이트가 정상 작동하도록 합니다.

## 📋 설정해야 할 환경 변수

### **KR 프로젝트** (`ur-live-kr` 또는 `ur-live`)

#### 1️⃣ Firebase 설정 (8개)
```bash
VITE_FIREBASE_API_KEY=AIzaSyCxmgG3NEXsWtHKbE425dvq5EWs3WHXOh8
VITE_FIREBASE_AUTH_DOMAIN=urteam-live-commerce-5b284.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=urteam-live-commerce-5b284
VITE_FIREBASE_STORAGE_BUCKET=urteam-live-commerce-5b284.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=352937066044
VITE_FIREBASE_APP_ID=1:352937066044:web:e5bfd5e1d8f61688e30d39
VITE_FIREBASE_MEASUREMENT_ID=G-TEST123456
VITE_FIREBASE_DATABASE_URL=https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
```

#### 2️⃣ Kakao 로그인 (3개)
```bash
VITE_KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd
VITE_KAKAO_JAVASCRIPT_KEY=975a2e7f97254b08f15dba4d177a2865
VITE_KAKAO_AUTH_URL=https://kauth.kakao.com
```

#### 3️⃣ Toss Payments (1개)
```bash
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
```

#### 4️⃣ 기타 설정 (3개)
```bash
VITE_REGION=KR
VITE_DEFAULT_LANGUAGE=ko
VITE_API_BASE_URL=https://live.ur-team.com
```

**총 15개 환경 변수**

---

### **GLOBAL 프로젝트** (`ur-live-global`)

#### 1️⃣ Firebase 설정 (8개) - KR과 동일
```bash
VITE_FIREBASE_API_KEY=AIzaSyCxmgG3NEXsWtHKbE425dvq5EWs3WHXOh8
VITE_FIREBASE_AUTH_DOMAIN=urteam-live-commerce-5b284.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=urteam-live-commerce-5b284
VITE_FIREBASE_STORAGE_BUCKET=urteam-live-commerce-5b284.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=352937066044
VITE_FIREBASE_APP_ID=1:352937066044:web:e5bfd5e1d8f61688e30d39
VITE_FIREBASE_MEASUREMENT_ID=G-TEST123456
VITE_FIREBASE_DATABASE_URL=https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
```

#### 2️⃣ Google OAuth (1개)
```bash
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID
```
> ⚠️ 실제 Google OAuth Client ID로 교체 필요

#### 3️⃣ Stripe (1개)
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_STRIPE_KEY
```
> ⚠️ 실제 Stripe Publishable Key로 교체 필요

#### 4️⃣ 기타 설정 (3개)
```bash
VITE_REGION=GLOBAL
VITE_DEFAULT_LANGUAGE=en
VITE_API_BASE_URL=https://world.ur-team.com
```

**총 13개 환경 변수**

---

## 🚀 Cloudflare Pages 설정 방법

### **방법 1: Cloudflare Dashboard (권장, ~10분)**

#### Step 1: 프로젝트 접속
1. https://dash.cloudflare.com/ 접속
2. **Workers & Pages** 클릭
3. **ur-live** (또는 **ur-live-kr**) 프로젝트 선택

#### Step 2: 환경 변수 추가
1. **Settings** 탭 클릭
2. **Environment variables** 선택
3. **Production** 탭에서 **Add variable** 클릭
4. 위의 **KR 프로젝트** 환경 변수 15개를 하나씩 추가:
   - Variable name: `VITE_FIREBASE_API_KEY`
   - Value: `AIzaSyCxmgG3NEXsWtHKbE425dvq5EWs3WHXOh8`
   - **Add variable** 클릭
   - 나머지 14개도 동일하게 반복

#### Step 3: 재배포
1. **Deployments** 탭으로 이동
2. 최신 deployment의 **...** 메뉴 클릭
3. **Retry deployment** 선택
4. 3~5분 후 https://live.ur-team.com 접속하여 확인

---

### **방법 2: Wrangler CLI (빠름, ~3분)**

#### 전제 조건
```bash
npm install -g wrangler
npx wrangler login
```

#### 환경 변수 설정
```bash
cd /home/user/webapp

# KR 프로젝트 환경 변수 설정
npx wrangler pages project create ur-live-kr --production-branch=main

# 환경 변수 일괄 추가 (아래 스크립트 실행)
cat > set-cloudflare-env.sh << 'EOF'
#!/bin/bash
PROJECT="ur-live-kr"

# Firebase
wrangler pages secret put VITE_FIREBASE_API_KEY --project=$PROJECT
# 프롬프트에: AIzaSyCxmgG3NEXsWtHKbE425dvq5EWs3WHXOh8

wrangler pages secret put VITE_FIREBASE_AUTH_DOMAIN --project=$PROJECT
# urteam-live-commerce-5b284.firebaseapp.com

wrangler pages secret put VITE_FIREBASE_PROJECT_ID --project=$PROJECT
# urteam-live-commerce-5b284

wrangler pages secret put VITE_FIREBASE_STORAGE_BUCKET --project=$PROJECT
# urteam-live-commerce-5b284.firebasestorage.app

wrangler pages secret put VITE_FIREBASE_MESSAGING_SENDER_ID --project=$PROJECT
# 352937066044

wrangler pages secret put VITE_FIREBASE_APP_ID --project=$PROJECT
# 1:352937066044:web:e5bfd5e1d8f61688e30d39

wrangler pages secret put VITE_FIREBASE_MEASUREMENT_ID --project=$PROJECT
# G-TEST123456

wrangler pages secret put VITE_FIREBASE_DATABASE_URL --project=$PROJECT
# https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app

# Kakao
wrangler pages secret put VITE_KAKAO_REST_API_KEY --project=$PROJECT
# 5dd74bccb797640b0efd070467f3bafd

wrangler pages secret put VITE_KAKAO_JAVASCRIPT_KEY --project=$PROJECT
# 975a2e7f97254b08f15dba4d177a2865

wrangler pages secret put VITE_KAKAO_AUTH_URL --project=$PROJECT
# https://kauth.kakao.com

# Toss Payments
wrangler pages secret put VITE_TOSS_CLIENT_KEY --project=$PROJECT
# test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN

# Other
wrangler pages secret put VITE_REGION --project=$PROJECT
# KR

wrangler pages secret put VITE_DEFAULT_LANGUAGE --project=$PROJECT
# ko

wrangler pages secret put VITE_API_BASE_URL --project=$PROJECT
# https://live.ur-team.com
EOF

chmod +x set-cloudflare-env.sh
```

#### 직접 배포
```bash
cd /home/user/webapp

# KR 빌드
npm run build:kr

# Cloudflare Pages 배포
npx wrangler pages deploy dist --project-name=ur-live-kr
```

---

## 🔍 설정 확인

### 1. 환경 변수 확인
```bash
npx wrangler pages deployment list --project-name=ur-live-kr
```

### 2. 사이트 접속
- **KR**: https://live.ur-team.com
- **GLOBAL**: https://world.ur-team.com

### 3. 카카오 로그인 테스트
1. https://live.ur-team.com 접속
2. **카카오 로그인** 버튼 클릭
3. 정상 로그인 되는지 확인

---

## ⚠️ 주의사항

### 1. 테스트 키 vs 프로덕션 키
현재 설정된 키들:
- ✅ **Firebase**: 실제 프로덕션 키
- ✅ **Kakao**: 실제 프로덕션 키
- ⚠️ **Toss**: **테스트 키** (`test_gck_...`)
  - 프로덕션 배포 전 실제 키로 교체 필요

### 2. Stripe & Google OAuth (GLOBAL 프로젝트)
- 현재 `.env.global` 파일의 값이 `YOUR_...` placeholder
- 실제 키를 발급받아 교체 필요:
  - Google OAuth: https://console.cloud.google.com/apis/credentials
  - Stripe: https://dashboard.stripe.com/apikeys

### 3. Backend 환경 변수 (Cloudflare Workers)
`wrangler.toml`에 정의된 secret 추가 필요:
```bash
npx wrangler pages secret put RESEND_API_KEY --project=ur-live-kr
npx wrangler pages secret put JWT_SECRET --project=ur-live-kr
npx wrangler pages secret put TOSS_SECRET_KEY --project=ur-live-kr
npx wrangler pages secret put EMAIL_FROM --project=ur-live-kr
npx wrangler pages secret put KAKAO_REST_API_KEY --project=ur-live-kr
```

값 입력 시:
- `KAKAO_REST_API_KEY`: `5dd74bccb797640b0efd070467f3bafd`
- `JWT_SECRET`: 안전한 랜덤 문자열 (예: `openssl rand -base64 32`)
- `RESEND_API_KEY`, `TOSS_SECRET_KEY`, `EMAIL_FROM`: 해당 서비스에서 발급

---

## 📊 현재 상태

### ✅ 확인된 실제 키
- ✅ Firebase API Key
- ✅ Firebase Project ID
- ✅ Firebase Database URL
- ✅ Kakao REST API Key
- ✅ Kakao JavaScript Key
- ✅ Toss Client Key (테스트)

### ⚠️ 확인 필요
- ⚠️ Google OAuth Client ID (GLOBAL)
- ⚠️ Stripe Publishable Key (GLOBAL)
- ⚠️ Toss 프로덕션 키

### 📁 환경 변수 파일 위치
- `/home/user/webapp/.env` - 테스트 환경
- `/home/user/webapp/.env.kr` - 한국 환경 (일부 키만)
- `/home/user/webapp/.env.global` - 글로벌 환경 (placeholder)
- `/home/user/webapp/src/lib/firebase-config.ts` - Firebase 실제 키

---

## 🎯 즉시 실행 체크리스트

- [ ] Cloudflare Dashboard 접속
- [ ] **ur-live** 또는 **ur-live-kr** 프로젝트 선택
- [ ] Settings → Environment variables → Production
- [ ] 위의 **KR 프로젝트 15개 환경 변수** 추가
- [ ] Deployments → Retry deployment
- [ ] 3~5분 후 https://live.ur-team.com 접속
- [ ] 카카오 로그인 테스트
- [ ] ✅ 404 오류 해결 확인

---

## 📚 관련 문서
- [URGENT_FIX_404_ERROR.md](./URGENT_FIX_404_ERROR.md) - 긴급 수정 가이드
- [SETUP_STEP_BY_STEP.md](./SETUP_STEP_BY_STEP.md) - 전체 설정 가이드
- [AUTOMATIC_DUAL_DEPLOYMENT_GUIDE.md](./AUTOMATIC_DUAL_DEPLOYMENT_GUIDE.md) - 자동 배포 가이드

---

**작성일**: 2026-03-05  
**작성자**: AI Assistant  
**목적**: live.ur-team.com 404 오류 긴급 수정
