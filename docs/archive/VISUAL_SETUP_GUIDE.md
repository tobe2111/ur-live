# 🎯 시각적 단계별 가이드 - Google OAuth & Stripe 설정

이 가이드는 스크린샷을 참고하며 따라할 수 있도록 작성되었습니다.

---

## 📸 Google OAuth Client ID 발급 (5분)

### 화면 1: Google Cloud Console 접속

```
URL: https://console.cloud.google.com/
```

**보이는 화면**:
- 왼쪽 메뉴: "APIs & Services"
- 프로젝트 선택 드롭다운 (상단)

**해야 할 일**:
1. ✅ Firebase 프로젝트 선택 (urteam-live-commerce 또는 본인 프로젝트)
2. ✅ 왼쪽 메뉴 → "APIs & Services" 클릭

---

### 화면 2: OAuth Consent Screen 설정

```
경로: APIs & Services > OAuth consent screen
```

**보이는 화면**:
- User Type 선택:
  - ⚪ Internal
  - ⚫ External ← **선택**

**입력할 내용**:
```
App name: UR Live Global
User support email: jiwon@ur-team.com
Developer contact information: jiwon@ur-team.com
```

**버튼**:
- [SAVE AND CONTINUE] 클릭

---

### 화면 3: Scopes 설정

```
경로: OAuth consent screen > Scopes
```

**보이는 화면**:
- [ADD OR REMOVE SCOPES] 버튼

**선택할 스코프**:
- ☑ .../auth/userinfo.email
- ☑ .../auth/userinfo.profile  
- ☑ openid

**버튼**:
- [UPDATE] → [SAVE AND CONTINUE]

---

### 화면 4: Credentials 생성

```
경로: APIs & Services > Credentials
```

**보이는 화면**:
- 상단 [+ CREATE CREDENTIALS] 버튼

**순서**:
1. ✅ [+ CREATE CREDENTIALS] 클릭
2. ✅ "OAuth client ID" 선택
3. ✅ Application type: **Web application** 선택

---

### 화면 5: OAuth Client ID 설정 (중요!)

```
경로: Create OAuth client ID
```

**입력 필드**:

#### Name:
```
UR Live Global Web Client
```

#### Authorized JavaScript origins:
```
https://world.ur-team.com
https://ur-live-global.pages.dev
http://localhost:5173
```

#### Authorized redirect URIs:
```
https://world.ur-team.com/__/auth/handler
https://ur-live-global.pages.dev/__/auth/handler
http://localhost:5173/__/auth/handler
```

**버튼**:
- [CREATE] 클릭

---

### 화면 6: Client ID 복사

```
팝업: OAuth client created
```

**보이는 내용**:
```
Your Client ID:
123456789-abcdefghijklmnop.apps.googleusercontent.com

Your Client Secret:
GOCSPX-xxxxxxxxxxxxxxxxxxxxx
```

**해야 할 일**:
1. ✅ **Client ID** 복사 (긴 문자열, .apps.googleusercontent.com으로 끝남)
2. ✅ 메모장에 저장:
   ```
   VITE_GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
   ```
3. ⚠️ Client Secret은 Firebase 사용 시 불필요 (저장 안 해도 됨)

---

### 화면 7: Firebase에서 Google 인증 활성화

```
URL: https://console.firebase.google.com/
```

**경로**:
1. ✅ 프로젝트 선택
2. ✅ 왼쪽 메뉴 → "Authentication"
3. ✅ "Sign-in method" 탭 클릭
4. ✅ "Google" 제공업체 클릭

**보이는 화면**:
```
Google
[Enable/Disable 토글]
Project support email: [선택]
승인된 도메인:
  - localhost
  - yourproject.firebaseapp.com
  - yourproject.web.app
```

**해야 할 일**:
1. ✅ Enable 토글 켜기
2. ✅ Project support email 선택
3. ✅ 승인된 도메인에 추가:
   - `world.ur-team.com`
   - `ur-live-global.pages.dev`
4. ✅ [SAVE] 클릭

---

## 💳 Stripe API Keys 발급 (3분)

### 화면 1: Stripe 계정 생성

```
URL: https://stripe.com/
```

**보이는 화면**:
- [Sign up] 또는 [Start now] 버튼

**입력 내용**:
```
Email: jiwon@ur-team.com
Password: [안전한 비밀번호]
```

**버튼**:
- [Create account] 클릭

---

### 화면 2: Stripe Dashboard - Test Mode 확인

```
URL: https://dashboard.stripe.com/
```

**오른쪽 상단 확인**:
```
[Test mode 🧪] ← 이 토글이 켜져 있어야 함!
```

⚠️ **중요**: 처음에는 반드시 Test mode에서 시작!

---

### 화면 3: API Keys 페이지

```
경로: Developers > API keys
```

**보이는 화면**:

#### Publishable key (공개 가능)
```
pk_test_51Hxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

[Reveal test key] 버튼
```

#### Secret key (절대 공개 금지!)
```
sk_test_51Hxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

[Reveal test key] 버튼
```

**해야 할 일**:

1. ✅ **Publishable key** 섹션:
   - [Reveal test key] 클릭
   - 전체 키 복사 (`pk_test_51H...`)
   - 메모장에 저장:
     ```
     VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51Hxx...
     ```

2. ✅ **Secret key** 섹션:
   - [Reveal test key] 클릭
   - 전체 키 복사 (`sk_test_51H...`)
   - 메모장에 저장:
     ```
     STRIPE_SECRET_KEY=sk_test_51Hxx...
     ```

---

## ⚙️ Cloudflare Pages 환경 변수 추가 (5분)

### 화면 1: Cloudflare Dashboard

```
URL: https://dash.cloudflare.com/
```

**경로**:
1. ✅ Workers & Pages 클릭
2. ✅ "ur-live-global" 프로젝트 선택

---

### 화면 2: Settings 페이지

```
경로: ur-live-global > Settings
```

**왼쪽 메뉴**:
- Environment variables ← 클릭

**보이는 화면**:
```
Production (TAB)
Preview (TAB)

Variables and Secrets
None [+] 버튼
```

---

### 화면 3: 변수 추가 팝업

**[+] 버튼 클릭 시 나타나는 팝업**:

```
Type: [Text ▼]
Variable name: [입력 필드]
Value: [입력 필드]

[Add variable] 버튼
```

---

### 화면 4: 7개 변수 추가 (하나씩)

#### Variable 1
```
Type: Text
Variable name: VITE_REGION
Value: GLOBAL
```
[Add variable] 클릭

#### Variable 2
```
Type: Text
Variable name: VITE_GOOGLE_CLIENT_ID
Value: [위에서 복사한 Google Client ID]
```
[Add variable] 클릭

#### Variable 3
```
Type: Text
Variable name: VITE_STRIPE_PUBLISHABLE_KEY
Value: pk_test_51Hxx...
```
[Add variable] 클릭

#### Variable 4 (Secret으로 설정!)
```
Type: Secret (또는 Text)
Variable name: STRIPE_SECRET_KEY
Value: sk_test_51Hxx...
```
[Add variable] 클릭

#### Variable 5
```
Type: Text
Variable name: VITE_DEFAULT_LANGUAGE
Value: en
```
[Add variable] 클릭

#### Variable 6
```
Type: Text
Variable name: VITE_API_BASE_URL
Value: https://world.ur-team.com
```
[Add variable] 클릭

#### Variable 7
```
Type: Text
Variable name: D1_DATABASE
Value: lister-db
```
[Add variable] 클릭

---

### 화면 5: 변수 확인 및 저장

**모든 변수 추가 후 화면**:
```
Variables and Secrets

Production:
  VITE_REGION = GLOBAL
  VITE_GOOGLE_CLIENT_ID = 123456789-abcdef.apps.googleusercontent.com
  VITE_STRIPE_PUBLISHABLE_KEY = pk_test_51Hxx...
  STRIPE_SECRET_KEY = ********** (Secret)
  VITE_DEFAULT_LANGUAGE = en
  VITE_API_BASE_URL = https://world.ur-team.com
  D1_DATABASE = lister-db
```

**버튼**:
- [Save] 클릭

---

### 화면 6: 재배포

```
경로: ur-live-global > Deployments
```

**보이는 화면**:
```
Latest deployment (3 minutes ago)
Status: Success ✅

[View deployment] [Manage deployment]
```

**해야 할 일**:
1. ✅ 최근 배포 선택
2. ✅ 오른쪽 [...] 메뉴 클릭
3. ✅ [Redeploy] 선택
4. ✅ 재배포 완료 대기 (3-5분)

---

## ✅ 테스트 (2분)

### 브라우저 테스트

#### 1. 사이트 접속
```
URL: https://world.ur-team.com
```

**F12 → Console 탭에서 실행**:
```javascript
// 리전 확인
console.log(import.meta.env.VITE_REGION)
// Expected: "GLOBAL"

// Google Client ID 확인
console.log(import.meta.env.VITE_GOOGLE_CLIENT_ID)
// Expected: "123456789-abcdef.apps.googleusercontent.com"

// Stripe Key 확인
console.log(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
// Expected: "pk_test_51Hxx..."
```

#### 2. Google 로그인 테스트
```
1. 로그인 페이지로 이동
2. "Login with Google" 버튼 클릭
3. Google 계정 선택
4. 권한 승인
5. ✅ 로그인 성공 확인
```

#### 3. Stripe 결제 테스트
```
1. 상품 추가 → 체크아웃 페이지
2. Stripe Payment Element 로딩 확인
3. 테스트 카드 입력:
   Card number: 4242 4242 4242 4242
   Expiry: 12/34
   CVC: 123
   ZIP: 12345
4. 결제 버튼 클릭
5. ✅ 결제 성공 확인
```

---

### 터미널 테스트

```bash
# Stripe API 테스트
curl -X POST https://world.ur-team.com/api/payment/stripe/create-intent \
  -H "Content-Type: application/json" \
  -d '{"amount":1000,"currency":"usd"}'

# 예상 응답:
# {"success":true,"clientSecret":"pi_xxx_secret_yyy"}
```

---

## 🎯 체크리스트 요약

완료한 항목 체크:

- [ ] Google Cloud Console → OAuth Client ID 생성
- [ ] Authorized origins 3개 추가
- [ ] Authorized redirect URIs 3개 추가
- [ ] Client ID 복사 (메모장 저장)
- [ ] Firebase Authentication → Google 활성화
- [ ] 승인된 도메인 2개 추가
- [ ] Stripe 계정 생성
- [ ] Test mode 확인
- [ ] Publishable key 복사
- [ ] Secret key 복사
- [ ] Cloudflare Pages → Variables 7개 추가
- [ ] Save → Redeploy
- [ ] 브라우저 콘솔 테스트
- [ ] Google 로그인 테스트
- [ ] Stripe 결제 테스트
- [ ] curl API 테스트

---

## 🚨 문제 해결 참고

### Google 로그인 실패
```
Error: redirect_uri_mismatch
```
**해결**: Authorized redirect URIs에 정확한 URL 추가
```
https://world.ur-team.com/__/auth/handler
```

### Stripe Element 로딩 안 됨
```
Console: VITE_STRIPE_PUBLISHABLE_KEY is undefined
```
**해결**: 
1. Cloudflare Variables 확인
2. Redeploy 실행
3. 브라우저 하드 리프레시 (Ctrl+Shift+R)

### 환경 변수 undefined
```
Console: import.meta.env.VITE_REGION is undefined
```
**해결**:
1. Cloudflare Dashboard에서 변수 저장 확인
2. Production 탭에 추가했는지 확인 (Preview 아님!)
3. Redeploy 후 5분 대기

---

**예상 총 소요 시간**: 15분  
**난이도**: ★★☆☆☆ (초급)  
**완료 시**: 글로벌 버전 배포 완료! 🎉
