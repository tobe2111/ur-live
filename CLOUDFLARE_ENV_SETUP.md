# 🔧 Cloudflare Pages 환경 변수 설정 가이드

## 📍 위치
Cloudflare Dashboard → Workers & Pages → `ur-live-global` → Settings → Environment variables

---

## 🌍 Global Version 환경 변수

### Production 환경에 다음 변수들을 추가하세요:

#### 1. Region 설정
```
Variable name: VITE_REGION
Value: GLOBAL
```

#### 2. Google Login (Firebase)
```
Variable name: VITE_GOOGLE_CLIENT_ID
Value: YOUR_GOOGLE_OAUTH_CLIENT_ID
```

**🔍 Google Client ID 찾기**:
1. Firebase Console → Project Settings
2. General 탭
3. Your apps → Web app
4. SDK setup and configuration
5. Config 객체에서 `authDomain`과 함께 있는 Client ID 복사

또는:
1. Google Cloud Console → APIs & Services → Credentials
2. OAuth 2.0 Client IDs에서 Web client 찾기

#### 3. Stripe Publishable Key (Frontend)
```
Variable name: VITE_STRIPE_PUBLISHABLE_KEY
Value: pk_test_YOUR_STRIPE_PUBLISHABLE_KEY
```

**🔍 Stripe Publishable Key 찾기**:
1. Stripe Dashboard: https://dashboard.stripe.com/
2. Developers → API keys
3. "Publishable key" 복사 (pk_test_로 시작)

#### 4. Stripe Secret Key (Backend) ⚠️ 중요!
```
Variable name: STRIPE_SECRET_KEY
Value: sk_test_YOUR_STRIPE_SECRET_KEY
```

**⚠️ 주의**: 
- 이 키는 `VITE_` 접두사가 없습니다 (Backend 전용)
- 절대 프론트엔드 코드에 노출되면 안 됩니다
- Stripe Dashboard → Developers → API keys → "Secret key" 복사 (sk_test_로 시작)

#### 5. Default Language
```
Variable name: VITE_DEFAULT_LANGUAGE
Value: en
```

#### 6. API Base URL
```
Variable name: VITE_API_BASE_URL
Value: https://world.ur-team.com
```

#### 7. Database (이미 설정되어 있을 수 있음)
```
Variable name: D1_DATABASE
Value: lister-db
```

**🔍 D1 Database 확인**:
1. Cloudflare Dashboard → Workers & Pages → D1
2. Database 이름 확인 (`lister-db`)

---

## 📋 체크리스트

### Environment Variables
- [ ] `VITE_REGION` = `GLOBAL`
- [ ] `VITE_GOOGLE_CLIENT_ID` = `YOUR_GOOGLE_CLIENT_ID`
- [ ] `VITE_STRIPE_PUBLISHABLE_KEY` = `pk_test_...`
- [ ] `STRIPE_SECRET_KEY` = `sk_test_...` (VITE_ 없음!)
- [ ] `VITE_DEFAULT_LANGUAGE` = `en`
- [ ] `VITE_API_BASE_URL` = `https://world.ur-team.com`
- [ ] `D1_DATABASE` = `lister-db`

### 변수 추가 후
- [ ] 모든 변수 저장 완료
- [ ] **Redeploy** 버튼 클릭
- [ ] 배포 완료 대기 (약 2-3분)

---

## 🧪 배포 후 테스트

### 1. 도메인 접속 확인
```bash
curl -I https://world.ur-team.com
# HTTP/2 200 OK 확인
```

### 2. Region 설정 확인
브라우저에서 https://world.ur-team.com 접속 후 Console (F12):
```javascript
console.log(import.meta.env.VITE_REGION)
// "GLOBAL" 출력되어야 함
```

### 3. UI 확인
- [ ] 기본 언어가 **English**
- [ ] **Google 로그인 버튼** 표시 (4색 로고)
- [ ] 카카오 로그인 버튼 없음

### 4. Stripe Payment Intent API 테스트
```bash
curl -X POST https://world.ur-team.com/api/payment/stripe/create-intent \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "currency": "usd", "metadata": {"test": "true"}}'

# Expected response:
# {"success":true,"clientSecret":"pi_xxx_secret_xxx","paymentIntentId":"pi_xxx"}
```

### 5. 결제 테스트
1. 상품을 장바구니에 추가
2. Checkout 페이지로 이동
3. **Stripe Payment Element** 로딩 확인
4. 테스트 카드 입력:
   ```
   카드번호: 4242 4242 4242 4242
   만료일: 12/34
   CVC: 123
   ZIP: 12345
   ```
5. "Pay" 버튼 클릭
6. 결제 성공 확인

---

## ⚠️ 트러블슈팅

### 문제: "Stripe is not configured" 에러
**원인**: `STRIPE_SECRET_KEY` 환경 변수가 없음

**해결**:
1. Cloudflare Dashboard → ur-live-global → Settings → Environment variables
2. `STRIPE_SECRET_KEY` 추가 (주의: `VITE_` 접두사 없음)
3. Redeploy

### 문제: Google 로그인 실패
**원인**: Firebase에 `world.ur-team.com` 도메인 미등록

**해결**:
1. Firebase Console → Authentication → Settings
2. Authorized domains에 `world.ur-team.com` 추가

### 문제: Region이 "GLOBAL"이 아님
**원인**: 환경 변수 미적용 또는 오타

**해결**:
1. 환경 변수 확인 (대소문자 구분)
2. `VITE_REGION=GLOBAL` (모두 대문자)
3. Redeploy 후 캐시 클리어 (Ctrl+Shift+R)

### 문제: API 호출이 live.ur-team.com으로 감
**원인**: `VITE_API_BASE_URL` 미설정

**해결**:
1. `VITE_API_BASE_URL=https://world.ur-team.com` 추가
2. Redeploy

---

## 🎯 완료!

모든 환경 변수를 추가하고 Redeploy하면 다음과 같이 작동합니다:

| Feature | Status |
|---------|--------|
| Domain | https://world.ur-team.com |
| UI Language | English (기본) |
| Login | Google OAuth |
| Payment | Stripe |
| Region | GLOBAL |

---

## 📞 문제 발생 시

1. Cloudflare Dashboard → ur-live-global → Deployments → 최신 배포 선택 → **Logs** 확인
2. 브라우저 Console (F12) 확인
3. Network 탭에서 API 요청 확인
4. [TESTING_GUIDE.md](./TESTING_GUIDE.md) 참고

---

**작성일**: 2026-03-03  
**최종 업데이트**: Build ID 314c94080362b0d8
