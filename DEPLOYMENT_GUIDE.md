# 🚀 Multi-Region E-Commerce Deployment Guide

## 📋 목차
1. [배포 전 준비사항](#1-배포-전-준비사항)
2. [한국 버전 배포 (live.ur-team.com)](#2-한국-버전-배포-liveur-teamcom)
3. [글로벌 버전 배포 (world.ur-team.com)](#3-글로벌-버전-배포-globalur-teamcom)
4. [환경 변수 설정](#4-환경-변수-설정)
5. [배포 후 검증](#5-배포-후-검증)
6. [롤백 가이드](#6-롤백-가이드)

---

## 1. 배포 전 준비사항

### 1.1 Prerequisites
```bash
# Wrangler CLI 설치 확인
wrangler --version

# 로그인 (처음만)
wrangler login

# Git commit 확인
git status
git log -1
```

### 1.2 로컬 테스트 완료
- [x] 한국 버전 로컬 테스트 완료 ([TESTING_GUIDE.md](./TESTING_GUIDE.md) 참고)
- [x] 글로벌 버전 로컬 테스트 완료
- [x] 결제 플로우 정상 작동 확인

### 1.3 Third-party 서비스 설정

#### Firebase (로그인)
- [x] Firebase Console에서 Google Authentication 활성화
- [x] 승인된 도메인 추가:
  - `live.ur-team.com` (한국)
  - `world.ur-team.com` (글로벌)

#### Kakao Developers (한국 로그인)
- [x] Kakao 앱 생성 완료
- [x] Redirect URI 등록:
  - `https://live.ur-team.com/auth/kakao/sync/callback`

#### Stripe (글로벌 결제)
- [x] Stripe 계정 생성
- [x] API Keys 발급:
  - Publishable Key: `pk_test_...`
  - Secret Key: `sk_test_...`

#### Toss Payments (한국 결제)
- [x] Toss Payments 계정 생성
- [x] Client Key 발급: `test_gck_...`

---

## 2. 한국 버전 배포 (live.ur-team.com)

### 2.1 빌드
```bash
# 한국 버전 빌드
npm run build:kr

# 빌드 확인
ls -lh dist/assets/ | grep -E "Toss|Stripe"
# TossPaymentWidget-*.js 파일만 있어야 함
```

### 2.2 배포
```bash
# Cloudflare Pages 배포
wrangler pages deploy dist --project-name=ur-live

# 또는 npm script 사용
npm run deploy
```

### 2.3 환경 변수 설정

#### Cloudflare Dashboard 접속
1. [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Workers & Pages → `ur-live` 선택
3. Settings → Environment variables

#### 환경 변수 추가

**Production 환경**:
```bash
# Region 설정
VITE_REGION=KR

# Kakao Login
VITE_KAKAO_APP_KEY=975a2e7f97254b08f15dba4d177a2865
VITE_KAKAO_REST_API_KEY=YOUR_KAKAO_REST_API_KEY

# Toss Payments
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN

# Language
VITE_DEFAULT_LANGUAGE=ko

# API Base URL
VITE_API_BASE_URL=https://live.ur-team.com

# Database (이미 설정되어 있을 수 있음)
D1_DATABASE=lister-db
```

**⚠️ 중요**: 각 변수 추가 후 **Save** 클릭!

### 2.4 Custom Domain 연결

#### DNS 설정
1. Cloudflare Dashboard → DNS → Records
2. CNAME 레코드 추가:
   ```
   Name: live
   Target: ur-live.pages.dev
   Proxy status: Proxied (오렌지 구름)
   ```

#### SSL/TLS 설정
1. SSL/TLS → Overview → Full (strict) 선택
2. Edge Certificates → Always Use HTTPS 활성화

---

## 3. 글로벌 버전 배포 (world.ur-team.com)

### 3.1 빌드
```bash
# 글로벌 버전 빌드
npm run build:global

# 빌드 확인
ls -lh dist/assets/ | grep -E "Toss|Stripe"
# StripeCheckout-*.js 파일만 있어야 함
```

### 3.2 Cloudflare Pages 프로젝트 생성

#### 3.2.1 Dashboard에서 생성
1. Cloudflare Dashboard → Workers & Pages
2. "Create application" → "Pages" → "Connect to Git"
3. GitHub repository 선택: `tobe2111/ur-live`
4. **Branch**: `main`
5. **Project name**: `ur-live-global`
6. Build settings:
   ```
   Build command: npm run build:global
   Build output directory: dist
   ```
7. "Save and Deploy" 클릭

#### 3.2.2 또는 CLI로 배포
```bash
# 글로벌 버전 배포
wrangler pages deploy dist --project-name=ur-live-global
```

### 3.3 환경 변수 설정

#### Cloudflare Dashboard 접속
1. Workers & Pages → `ur-live-global` 선택
2. Settings → Environment variables

#### 환경 변수 추가

**Production 환경**:
```bash
# Region 설정
VITE_REGION=GLOBAL

# Google Login (Firebase)
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID

# Stripe Payments
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY

# Language
VITE_DEFAULT_LANGUAGE=en

# API Base URL
VITE_API_BASE_URL=https://world.ur-team.com

# Database (동일한 D1 사용)
D1_DATABASE=lister-db
```

**⚠️ 주의**:
- `STRIPE_SECRET_KEY`는 **backend 전용** (VITE_ 접두사 없음)
- `VITE_STRIPE_PUBLISHABLE_KEY`는 **frontend 전용**

### 3.4 Custom Domain 연결

#### DNS 설정
1. Cloudflare Dashboard → DNS → Records
2. CNAME 레코드 추가:
   ```
   Name: global
   Target: ur-live-global.pages.dev
   Proxy status: Proxied (오렌지 구름)
   ```

#### SSL/TLS 설정
- 한국 버전과 동일하게 설정

---

## 4. 환경 변수 설정

### 4.1 한국 버전 (ur-live)

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `VITE_REGION` | `KR` | Region 식별자 |
| `VITE_KAKAO_APP_KEY` | `975a2e7f...` | Kakao JavaScript Key |
| `VITE_TOSS_CLIENT_KEY` | `test_gck_...` | Toss Payments 클라이언트 키 |
| `VITE_DEFAULT_LANGUAGE` | `ko` | 기본 언어 |
| `VITE_API_BASE_URL` | `https://live.ur-team.com` | API 베이스 URL |
| `D1_DATABASE` | `lister-db` | Cloudflare D1 데이터베이스 |

### 4.2 글로벌 버전 (ur-live-global)

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `VITE_REGION` | `GLOBAL` | Region 식별자 |
| `VITE_GOOGLE_CLIENT_ID` | `YOUR_GOOGLE_...` | Google OAuth 클라이언트 ID |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | Stripe Publishable Key (frontend) |
| `STRIPE_SECRET_KEY` | `sk_test_...` | Stripe Secret Key (backend) |
| `VITE_DEFAULT_LANGUAGE` | `en` | 기본 언어 |
| `VITE_API_BASE_URL` | `https://world.ur-team.com` | API 베이스 URL |
| `D1_DATABASE` | `lister-db` | Cloudflare D1 데이터베이스 |

### 4.3 환경 변수 적용

환경 변수 추가/수정 후:
1. **Save** 버튼 클릭
2. **Redeploy** 버튼 클릭 (또는 새로운 배포 푸시)

---

## 5. 배포 후 검증

### 5.1 한국 버전 체크리스트

```bash
# 1. 배포 완료 확인
curl -I https://live.ur-team.com
# HTTP/2 200 OK 확인

# 2. Region 설정 확인 (브라우저 Console)
console.log(import.meta.env.VITE_REGION)
// "KR" 출력되어야 함

# 3. 로그인 테스트
# https://live.ur-team.com/login
# - 카카오 로그인 버튼 확인
# - Google 로그인 버튼 없음

# 4. 결제 테스트
# https://live.ur-team.com/checkout
# - Toss Payment Widget 로드 확인
# - Stripe 관련 코드 로드되지 않음 (Network 탭 확인)

# 5. 언어 확인
# - 기본 언어: 한국어
# - 언어 전환: 한국어 ↔ 영어
```

### 5.2 글로벌 버전 체크리스트

```bash
# 1. 배포 완료 확인
curl -I https://world.ur-team.com
# HTTP/2 200 OK 확인

# 2. Region 설정 확인 (브라우저 Console)
console.log(import.meta.env.VITE_REGION)
// "GLOBAL" 출력되어야 함

# 3. 로그인 테스트
# https://world.ur-team.com/login
# - Google 로그인 버튼 확인 (4색 로고)
# - 카카오 로그인 버튼 없음

# 4. 결제 테스트
# https://world.ur-team.com/checkout
# - Stripe Payment Element 로드 확인
# - Toss 관련 코드 로드되지 않음 (Network 탭 확인)

# 5. 언어 확인
# - 기본 언어: English
# - 언어 전환: English ↔ Korean
```

### 5.3 API 엔드포인트 테스트

#### Stripe Payment Intent (글로벌)
```bash
curl -X POST https://world.ur-team.com/api/payment/stripe/create-intent \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "currency": "usd",
    "metadata": {
      "userId": "test_user"
    }
  }'

# Expected response:
# {
#   "success": true,
#   "clientSecret": "pi_xxx_secret_xxx",
#   "paymentIntentId": "pi_xxx"
# }
```

### 5.4 성능 확인

#### Lighthouse 점수
```bash
# Chrome DevTools → Lighthouse
# Performance, Accessibility, Best Practices, SEO 점수 확인
```

#### Bundle Size 확인
```bash
# 한국 버전
ls -lh dist/assets/ | grep -E "\.js$"
# TossPaymentWidget-*.js: ~3 KB
# StripeCheckout-*.js: 없음 (lazy loaded, tree-shaked)

# 글로벌 버전
ls -lh dist/assets/ | grep -E "\.js$"
# StripeCheckout-*.js: ~2.5 KB
# TossPaymentWidget-*.js: 없음
```

---

## 6. 롤백 가이드

### 6.1 Cloudflare Pages 롤백

#### Dashboard에서 롤백
1. Cloudflare Dashboard → Workers & Pages → `ur-live` (또는 `ur-live-global`)
2. Deployments 탭
3. 이전 배포 선택 → "Rollback to this deployment"

#### CLI로 롤백
```bash
# 배포 목록 확인
wrangler pages deployment list --project-name=ur-live

# 특정 배포로 롤백 (Deployment ID 사용)
wrangler pages deployment tail <DEPLOYMENT_ID>
```

### 6.2 Git 롤백

```bash
# 이전 커밋으로 롤백
git revert HEAD
git push origin main

# 또는 특정 커밋으로 리셋
git reset --hard <COMMIT_HASH>
git push origin main --force
```

### 6.3 환경 변수 롤백

1. Cloudflare Dashboard → Settings → Environment variables
2. "Edit variables" 클릭
3. 이전 값으로 수정
4. "Save" → "Redeploy"

---

## 🎯 배포 완료 체크리스트

### 한국 버전 (live.ur-team.com)
- [ ] 빌드 성공 (`npm run build:kr`)
- [ ] 배포 성공 (`wrangler pages deploy`)
- [ ] 환경 변수 설정 완료
- [ ] Custom domain 연결 완료
- [ ] SSL/TLS 설정 완료
- [ ] 카카오 로그인 테스트 성공
- [ ] Toss 결제 테스트 성공
- [ ] 한국어 UI 정상

### 글로벌 버전 (world.ur-team.com)
- [ ] 빌드 성공 (`npm run build:global`)
- [ ] 배포 성공 (`wrangler pages deploy`)
- [ ] 환경 변수 설정 완료 (STRIPE_SECRET_KEY 포함)
- [ ] Custom domain 연결 완료
- [ ] SSL/TLS 설정 완료
- [ ] Google 로그인 테스트 성공
- [ ] Stripe 결제 테스트 성공
- [ ] English UI 정상

---

## 📞 Support

배포 중 문제 발생 시:
1. `wrangler pages deployment tail` 로그 확인
2. Browser Console 확인 (F12)
3. Cloudflare Dashboard → Analytics 확인
4. GitHub Issues에 리포트

---

## 🔗 관련 문서
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - 로컬 테스트 가이드
- [MULTI_REGION_SETUP.md](./MULTI_REGION_SETUP.md) - 프로젝트 설정 가이드
- [MULTI_REGION_QUICKSTART.md](./MULTI_REGION_QUICKSTART.md) - 빠른 시작 가이드

---

**배포 완료!** 🎉

이제 한국과 글로벌 사용자가 각자의 언어와 결제 방식으로 쇼핑을 즐길 수 있습니다!
