# ⚡ 빠른 시작 가이드 - API Keys 발급

**목표**: 15분 안에 Google OAuth + Stripe 테스트 키 발급받기

---

## ✅ 체크리스트

### 1️⃣ Google OAuth Client ID (5분)

- [ ] https://console.cloud.google.com/ 접속
- [ ] Firebase 프로젝트 선택
- [ ] **APIs & Services** → **OAuth consent screen**
- [ ] External 선택 → App name: "UR Live Global" 입력
- [ ] **Credentials** → **+ CREATE CREDENTIALS** → **OAuth client ID**
- [ ] **Web application** 선택
- [ ] Authorized JavaScript origins 추가:
  ```
  https://world.ur-team.com
  https://ur-live-global.pages.dev
  http://localhost:5173
  ```
- [ ] Authorized redirect URIs 추가:
  ```
  https://world.ur-team.com/__/auth/handler
  https://ur-live-global.pages.dev/__/auth/handler
  http://localhost:5173/__/auth/handler
  ```
- [ ] **CREATE** → Client ID 복사 (형식: `xxxxx.apps.googleusercontent.com`)
- [ ] Firebase Console → Authentication → Sign-in method → Google 활성화
- [ ] 승인된 도메인에 `world.ur-team.com` 추가

**결과**: 
```
VITE_GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
```

---

### 2️⃣ Stripe API Keys (3분)

- [ ] https://stripe.com/ 접속 → 계정 생성 (이메일/비밀번호)
- [ ] 오른쪽 상단 "Test mode" 토글 확인 (테스트 모드 ON)
- [ ] **Developers** → **API keys** 클릭
- [ ] **Publishable key** 복사:
  ```
  pk_test_51Hxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ```
- [ ] **Secret key** "Reveal test key" 클릭 → 복사:
  ```
  sk_test_51Hxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ```

**결과**:
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51Hxx...
STRIPE_SECRET_KEY=sk_test_51Hxx...
```

---

### 3️⃣ Cloudflare Pages 환경 변수 추가 (5분)

- [ ] https://dash.cloudflare.com/ 접속
- [ ] **Workers & Pages** → **ur-live-global** 선택
- [ ] **Settings** → **Variables and Secrets**
- [ ] 다음 7개 변수 추가 (+ 버튼 클릭):

| Variable name | Value | Type |
|---------------|-------|------|
| `VITE_REGION` | `GLOBAL` | Text |
| `VITE_GOOGLE_CLIENT_ID` | `[위에서 복사한 값]` | Text |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | Text |
| `STRIPE_SECRET_KEY` | `sk_test_...` | **Secret** 🔒 |
| `VITE_DEFAULT_LANGUAGE` | `en` | Text |
| `VITE_API_BASE_URL` | `https://world.ur-team.com` | Text |
| `D1_DATABASE` | `lister-db` | Text |

- [ ] **Save** 클릭
- [ ] **Deployments** 탭 → 최근 빌드 → **Retry deployment** 클릭

---

### 4️⃣ 배포 완료 대기 (3분)

- [ ] 배포 진행 상태 확인 (Build → Deploy)
- [ ] 배포 성공 메시지 확인: "Success: Deployment complete!"

---

### 5️⃣ 테스트 (2분)

**Google 로그인 테스트**:
- [ ] https://world.ur-team.com 접속
- [ ] 로그인 페이지 → "Login with Google" 버튼 클릭
- [ ] Google 계정 선택 → 로그인 성공

**Stripe 결제 테스트**:
- [ ] 상품 추가 → 체크아웃 페이지
- [ ] Stripe Payment Element 로딩 확인 (카드 입력 폼 표시됨)
- [ ] 테스트 카드 입력:
  ```
  Card: 4242 4242 4242 4242
  Expiry: 12/34
  CVC: 123
  ```
- [ ] 결제 버튼 클릭 → 결제 성공

**API 테스트** (터미널):
```bash
curl -X POST https://world.ur-team.com/api/payment/stripe/create-intent \
  -H "Content-Type: application/json" \
  -d '{"amount":1000,"currency":"usd"}'

# 예상 응답: {"success":true,"clientSecret":"pi_xxx_secret_yyy"}
```

---

## 🎯 최종 확인 사항

배포 후 브라우저 콘솔(F12 → Console)에서:

```javascript
// 1. 리전 확인
console.log(import.meta.env.VITE_REGION)
// Expected: "GLOBAL"

// 2. Google Client ID 확인
console.log(import.meta.env.VITE_GOOGLE_CLIENT_ID)
// Expected: "xxxxx.apps.googleusercontent.com"

// 3. Stripe Publishable Key 확인
console.log(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
// Expected: "pk_test_..."

// 4. API Base URL 확인
console.log(import.meta.env.VITE_API_BASE_URL)
// Expected: "https://world.ur-team.com"
```

---

## ❌ 문제 해결

### 문제: "Login with Google" 버튼 클릭 시 에러

**원인**: Google OAuth Client ID 미설정 또는 승인된 도메인 누락

**해결**:
1. Firebase Console → Authentication → Sign-in method → Google 활성화 확인
2. Google Cloud Console → Credentials → OAuth Client ID → Authorized origins에 `https://world.ur-team.com` 추가
3. Cloudflare Pages → Variables에 `VITE_GOOGLE_CLIENT_ID` 설정 확인
4. 재배포 후 5분 대기

---

### 문제: Stripe Payment Element가 로딩되지 않음

**원인**: Stripe API Keys 미설정

**해결**:
1. Stripe Dashboard에서 "Test mode" 활성화 확인
2. Cloudflare Pages → Variables에 다음 확인:
   - `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...` (Text)
   - `STRIPE_SECRET_KEY=sk_test_...` (Secret)
3. 브라우저 콘솔(F12) → Network 탭에서 `/api/payment/stripe/create-intent` 호출 확인
4. 응답 에러 메시지 확인 후 문의

---

### 문제: 환경 변수가 undefined로 나옴

**원인**: 환경 변수 저장 후 재배포하지 않음

**해결**:
1. Cloudflare Pages → Settings → Variables and Secrets에서 변수 저장 확인
2. **Deployments** 탭으로 이동
3. 최근 배포 선택 → **Redeploy** 클릭
4. 배포 완료 후 5분 대기
5. 브라우저 하드 리프레시 (Ctrl+Shift+R 또는 Cmd+Shift+R)

---

## 📞 추가 도움

더 자세한 설명이 필요하면 다음 문서를 참고하세요:

- **전체 가이드**: `GETTING_API_KEYS.md`
- **Cloudflare 설정**: `CLOUDFLARE_PAGES_SETUP.md`
- **배포 가이드**: `DEPLOYMENT_GUIDE.md`
- **테스트 가이드**: `TESTING_GUIDE.md`

---

**예상 총 소요 시간**: 15-20분  
**난이도**: 초급-중급  
**필수 요구사항**: Google 계정, Stripe 계정 (무료), Cloudflare 계정

---

## 🎉 완료!

모든 체크리스트를 완료했다면:

- ✅ **한국 버전**: https://live.ur-team.com (Kakao + Toss)
- ✅ **글로벌 버전**: https://world.ur-team.com (Google + Stripe)

두 사이트가 정상 작동합니다! 🚀
