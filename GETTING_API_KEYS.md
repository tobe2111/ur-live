# API Keys 발급 가이드

이 문서는 글로벌 버전(world.ur-team.com)에 필요한 API 키들을 발급받는 방법을 설명합니다.

---

## 🔑 필요한 API 키 목록

1. **Google OAuth Client ID** - Google 로그인용
2. **Stripe Publishable Key** - Stripe 결제 UI용 (클라이언트)
3. **Stripe Secret Key** - Stripe 결제 서버용 (백엔드)
4. **Firebase Config** - Firebase Authentication용

---

## 1️⃣ Google OAuth Client ID 발급 (Google 로그인)

### Step 1: Google Cloud Console 접속

1. https://console.cloud.google.com/ 접속
2. 기존 Firebase 프로젝트 선택 (또는 새 프로젝트 생성)

### Step 2: OAuth 동의 화면 설정

1. 왼쪽 메뉴 → **APIs & Services** → **OAuth consent screen** 클릭
2. User Type 선택:
   - **External** 선택 (일반 사용자용)
   - **CREATE** 클릭

3. App information 입력:
   ```
   App name: UR Live Global
   User support email: jiwon@ur-team.com (또는 본인 이메일)
   Developer contact email: jiwon@ur-team.com
   ```

4. Scopes 설정:
   - **ADD OR REMOVE SCOPES** 클릭
   - 다음 스코프 선택:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
   - **UPDATE** 클릭

5. Test users 추가 (선택 사항):
   - 개발/테스트 단계에서는 테스트 사용자 이메일 추가
   - **SAVE AND CONTINUE** 클릭

### Step 3: OAuth Client ID 생성

1. 왼쪽 메뉴 → **Credentials** 클릭
2. 상단 **+ CREATE CREDENTIALS** → **OAuth client ID** 선택

3. Application type:
   - **Web application** 선택

4. 설정:
   ```
   Name: UR Live Global Web Client
   
   Authorized JavaScript origins:
   - https://world.ur-team.com
   - https://ur-live-global.pages.dev (Cloudflare Pages 기본 도메인)
   - http://localhost:5173 (로컬 개발용)
   
   Authorized redirect URIs:
   - https://world.ur-team.com/__/auth/handler
   - https://ur-live-global.pages.dev/__/auth/handler
   - http://localhost:5173/__/auth/handler
   ```

5. **CREATE** 클릭

6. 팝업에서 **Client ID** 복사:
   ```
   형식: 123456789-abcdefghijklmnop.apps.googleusercontent.com
   ```

### Step 4: Firebase에 Google 인증 활성화

1. Firebase Console 접속: https://console.firebase.google.com/
2. 프로젝트 선택 → **Authentication** → **Sign-in method** 탭
3. **Google** 제공업체 클릭
4. **Enable** 토글 켜기
5. **Project support email** 선택
6. **승인된 도메인**에 추가:
   - `world.ur-team.com`
   - `ur-live-global.pages.dev`
7. **SAVE** 클릭

---

## 2️⃣ Stripe API Keys 발급 (결제 처리)

### Step 1: Stripe 계정 생성

1. https://stripe.com/ 접속
2. **Start now** 또는 **Sign up** 클릭
3. 이메일/비밀번호로 계정 생성

### Step 2: Test Mode API Keys 확인

⚠️ **주의**: 처음에는 반드시 **Test mode**에서 시작하세요!

1. Stripe Dashboard 접속: https://dashboard.stripe.com/
2. 오른쪽 상단 토글이 **"Test mode"** 인지 확인 (테스트 모드 = 실제 결제 안 됨)
3. 왼쪽 메뉴 → **Developers** → **API keys** 클릭

4. 두 개의 키 확인:

   **🔓 Publishable key** (클라이언트용 - 공개 가능)
   ```
   pk_test_51Hxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   - "Reveal test key" 클릭하여 전체 키 복사
   - Cloudflare 환경 변수: `VITE_STRIPE_PUBLISHABLE_KEY`

   **🔒 Secret key** (서버용 - 절대 공개 금지!)
   ```
   sk_test_51Hxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   - "Reveal test key" 클릭하여 전체 키 복사
   - Cloudflare 환경 변수: `STRIPE_SECRET_KEY` (Secret으로 설정)

### Step 3: Webhook 설정 (선택 사항)

결제 완료/실패 이벤트를 받으려면:

1. **Developers** → **Webhooks** 클릭
2. **Add endpoint** 클릭
3. Endpoint URL 입력:
   ```
   https://world.ur-team.com/api/payment/stripe/webhook
   ```
4. Events to send 선택:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.succeeded`
5. **Add endpoint** 클릭
6. **Signing secret** 복사 (웹훅 검증용):
   ```
   whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### Step 4: 테스트 카드 번호

Stripe Test mode에서 사용 가능한 테스트 카드:

| 카드 번호 | 결과 | 설명 |
|-----------|------|------|
| `4242 4242 4242 4242` | ✅ 성공 | 기본 성공 케이스 |
| `4000 0000 0000 9995` | ❌ 실패 (잔액 부족) | 잔액 부족 오류 |
| `4000 0000 0000 0002` | ❌ 실패 (카드 거부) | 카드 거부 오류 |
| `4000 0025 0000 3155` | 🔐 3D Secure 필요 | 추가 인증 테스트 |

**공통 정보** (모든 테스트 카드):
- Expiry: 미래 날짜 아무거나 (예: `12/34`)
- CVC: 아무 3자리 숫자 (예: `123`)
- ZIP: 아무 5자리 숫자 (예: `12345`)

---

## 3️⃣ Firebase Config 확인 (이미 있는 경우)

### Step 1: Firebase Console 접속

1. https://console.firebase.google.com/ 접속
2. 프로젝트 선택: **urteam-live-commerce** (또는 본인 프로젝트)

### Step 2: Web App Config 확인

1. ⚙️ 설정 (Project Settings) 클릭
2. 하단 **Your apps** 섹션에서 Web app (`</>`) 선택
3. **Firebase SDK snippet** → **Config** 탭 클릭

4. 다음과 같은 설정 확인:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "urteam-live-commerce.firebaseapp.com",
     projectId: "urteam-live-commerce",
     storageBucket: "urteam-live-commerce.firebasestorage.app",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef",
     databaseURL: "https://urteam-live-commerce-default-rtdb.firebaseio.com"
   };
   ```

5. 이 설정은 **이미 코드에 포함되어 있음** (src/config/firebase.ts)
   - 추가 환경 변수 불필요
   - Google OAuth만 활성화하면 됨

---

## 📋 Cloudflare Pages에 추가할 환경 변수

모든 키를 발급받은 후, Cloudflare Pages Dashboard에 다음과 같이 추가:

### 필수 변수 (7개)

```
Variable name: VITE_REGION
Value: GLOBAL
---
Variable name: VITE_GOOGLE_CLIENT_ID
Value: 123456789-abcdefghijklmnop.apps.googleusercontent.com
---
Variable name: VITE_STRIPE_PUBLISHABLE_KEY
Value: pk_test_51Hxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
---
Variable name: STRIPE_SECRET_KEY (Secret 타입 권장)
Value: sk_test_51Hxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
---
Variable name: VITE_DEFAULT_LANGUAGE
Value: en
---
Variable name: VITE_API_BASE_URL
Value: https://world.ur-team.com
---
Variable name: D1_DATABASE
Value: lister-db
```

### 선택 변수 (권장)

```
Variable name: JWT_SECRET (Secret 타입)
Value: [openssl rand -base64 32 결과]
---
Variable name: STRIPE_WEBHOOK_SECRET (Secret 타입)
Value: whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
---
Variable name: RESEND_API_KEY (Secret 타입)
Value: re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🧪 테스트 방법

### 1. Google 로그인 테스트

1. https://world.ur-team.com 접속
2. 로그인 페이지로 이동
3. "Login with Google" 버튼 클릭
4. Google 계정 선택 → 권한 승인
5. 로그인 성공 확인

**문제 발생 시 체크리스트**:
- [ ] Firebase Authentication에서 Google 제공업체 활성화됨
- [ ] Google Cloud Console에서 OAuth Client ID 생성됨
- [ ] Authorized JavaScript origins에 `world.ur-team.com` 추가됨
- [ ] Cloudflare 환경 변수 `VITE_GOOGLE_CLIENT_ID` 설정됨
- [ ] 배포 후 재시작됨

### 2. Stripe 결제 테스트

1. https://world.ur-team.com 접속 → 상품 추가 → 체크아웃
2. Stripe Payment Element 로딩 확인 (카드 입력 폼)
3. 테스트 카드 입력:
   ```
   Card number: 4242 4242 4242 4242
   Expiry: 12/34
   CVC: 123
   ZIP: 12345
   ```
4. 결제 버튼 클릭
5. 결제 성공 메시지 확인

**문제 발생 시 체크리스트**:
- [ ] Stripe Dashboard에서 Test mode 활성화됨
- [ ] Cloudflare 환경 변수 `VITE_STRIPE_PUBLISHABLE_KEY` 설정됨
- [ ] Cloudflare 환경 변수 `STRIPE_SECRET_KEY` 설정됨
- [ ] 브라우저 콘솔에 에러 없음
- [ ] 네트워크 탭에서 `/api/payment/stripe/create-intent` 호출 성공 (200 OK)

### 3. API 엔드포인트 테스트

```bash
# Stripe Payment Intent 생성 테스트
curl -X POST https://world.ur-team.com/api/payment/stripe/create-intent \
  -H "Content-Type: application/json" \
  -d '{"amount":1000,"currency":"usd","metadata":{"orderId":"test-123"}}'

# 예상 응답:
# {"success":true,"clientSecret":"pi_xxxxxxxxxxxxx_secret_yyyyyyyyyy"}
```

---

## 🔒 보안 주의사항

### ✅ 공개해도 되는 것 (Frontend)
- `VITE_STRIPE_PUBLISHABLE_KEY` (pk_test_... 또는 pk_live_...)
- `VITE_GOOGLE_CLIENT_ID` (xxxxx.apps.googleusercontent.com)
- Firebase Config (apiKey, authDomain 등)

### ❌ 절대 공개하면 안 되는 것 (Backend)
- `STRIPE_SECRET_KEY` (sk_test_... 또는 sk_live_...)
- `JWT_SECRET`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`

### 📌 Secret 관리 규칙
1. Secret key는 Cloudflare Pages의 "Secret" 타입으로 설정
2. GitHub 코드에 절대 커밋하지 않기
3. .env 파일은 .gitignore에 포함 (이미 포함됨)
4. Production 환경에서는 `pk_live_`, `sk_live_` 사용

---

## 🚀 프로덕션 전환 (나중에)

테스트가 완료되면 Production mode로 전환:

### Stripe Production Keys
1. Stripe Dashboard → 오른쪽 상단 토글 "View live data" 클릭
2. Business information 입력 (사업자 정보)
3. Bank account 연결 (정산 계좌)
4. API keys → Live keys 복사:
   - `pk_live_...`
   - `sk_live_...`

### Google OAuth Production
1. OAuth consent screen → **PUBLISH APP** 클릭
2. Google 검토 통과 (7-14일 소요)
3. Production 환경 변수에 동일한 Client ID 사용

---

## 📞 추가 도움

### 공식 문서
- Stripe API Docs: https://stripe.com/docs/api
- Google OAuth 2.0: https://developers.google.com/identity/protocols/oauth2
- Firebase Authentication: https://firebase.google.com/docs/auth

### 문제 해결
막히는 부분이 있으면 다음 정보와 함께 질문해주세요:
1. 어느 단계에서 막혔는지
2. 에러 메시지 (있는 경우)
3. 스크린샷 (민감한 정보 가린 후)

---

**작성일**: 2026-03-03  
**업데이트**: 최신 Stripe/Google OAuth API 기준  
**예상 소요 시간**: Google OAuth 10분 + Stripe 5분 = 총 15분
