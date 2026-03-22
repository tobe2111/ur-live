# ✅ Cloudflare Pages 설정 체크리스트

## 🎯 프로젝트: ur-live-global

### ⬜ Step 1: 프로젝트 생성
**위치**: Cloudflare Dashboard → Workers & Pages

- [ ] "Create application" 클릭
- [ ] Pages → Connect to Git 선택
- [ ] Repository: `tobe2111/ur-live` 선택
- [ ] Project name: `ur-live-global`
- [ ] Branch: `main`
- [ ] Build command: `npm run build:global`
- [ ] Build output directory: `dist`
- [ ] "Save and Deploy" 클릭
- [ ] 첫 배포 완료 대기 (약 3-5분)

---

### ⬜ Step 2: 환경 변수 추가
**위치**: ur-live-global → Settings → Environment variables

#### Production 환경에 추가:

```bash
# 1. Region
VITE_REGION = GLOBAL

# 2. Google OAuth (Firebase Console에서 확인)
VITE_GOOGLE_CLIENT_ID = YOUR_GOOGLE_CLIENT_ID

# 3. Stripe Publishable Key (Frontend)
VITE_STRIPE_PUBLISHABLE_KEY = pk_test_...

# 4. Stripe Secret Key (Backend) ⚠️ VITE_ 없음!
STRIPE_SECRET_KEY = sk_test_...

# 5. Language
VITE_DEFAULT_LANGUAGE = en

# 6. API Base URL
VITE_API_BASE_URL = https://world.ur-team.com

# 7. Database (이미 있을 수 있음)
D1_DATABASE = lister-db
```

- [ ] 모든 변수 추가 완료
- [ ] "Save" 클릭
- [ ] **"Redeploy"** 버튼 클릭
- [ ] 재배포 완료 대기

---

### ⬜ Step 3: Custom Domain 연결
**위치**: ur-live-global → Custom domains

- [ ] "Set up a custom domain" 클릭
- [ ] Domain 입력: `world.ur-team.com`
- [ ] "Continue" 클릭
- [ ] DNS 레코드 자동 인식 확인
- [ ] "Activate domain" 클릭
- [ ] SSL 인증서 발급 대기 (약 5-10분)

---

### ⬜ Step 4: D1 Database 바인딩 (이미 되어있을 수 있음)
**위치**: ur-live-global → Settings → Functions

- [ ] D1 database bindings 확인
- [ ] Variable name: `DB`
- [ ] D1 database: `lister-db`
- [ ] (이미 설정되어 있다면 스킵)

---

### ⬜ Step 5: 배포 후 테스트

#### 5.1 도메인 접속
```bash
curl -I https://world.ur-team.com
```
- [ ] HTTP/2 200 OK 응답 확인

#### 5.2 Region 확인
브라우저 Console (F12):
```javascript
console.log(import.meta.env.VITE_REGION)
```
- [ ] "GLOBAL" 출력 확인

#### 5.3 UI 확인
- [ ] 기본 언어: English
- [ ] Google 로그인 버튼 표시 (4색 로고)
- [ ] 카카오 로그인 버튼 없음
- [ ] 언어 전환: English ↔ Korean

#### 5.4 Stripe API 테스트
```bash
curl -X POST https://world.ur-team.com/api/payment/stripe/create-intent \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "currency": "usd"}'
```
- [ ] `{"success":true,"clientSecret":"pi_..."}` 응답 확인

#### 5.5 결제 플로우 테스트
- [ ] 상품 장바구니 추가
- [ ] Checkout 페이지 이동
- [ ] Stripe Payment Element 로딩 확인
- [ ] 테스트 카드 입력 (4242 4242 4242 4242)
- [ ] 결제 성공 확인

---

## 🚨 문제 발생 시

### Stripe 에러: "Stripe is not configured"
✅ **해결**: `STRIPE_SECRET_KEY` 환경 변수 추가 (VITE_ 접두사 없음)

### Google 로그인 실패
✅ **해결**: Firebase Console → Authorized domains에 `world.ur-team.com` 추가

### Region이 "GLOBAL"이 아님
✅ **해결**: 환경 변수 `VITE_REGION=GLOBAL` 확인 후 Redeploy

### SSL 인증서 에러
✅ **해결**: 5-10분 대기 (자동 발급) 또는 Cloudflare Dashboard에서 SSL/TLS 설정 확인

---

## 📊 최종 확인

### 한국 버전
- [ ] https://live.ur-team.com 접속 가능
- [ ] 카카오 로그인 작동
- [ ] Toss 결제 작동
- [ ] 한국어 UI

### 글로벌 버전
- [ ] https://world.ur-team.com 접속 가능
- [ ] Google 로그인 작동
- [ ] Stripe 결제 작동
- [ ] English UI

---

## 🎉 완료!

모든 체크 항목이 완료되면 Multi-Region E-Commerce가 정상 작동합니다!

**예상 소요 시간**: 15-20분  
**문서 참고**: [CLOUDFLARE_ENV_SETUP.md](./CLOUDFLARE_ENV_SETUP.md)

---

**작성일**: 2026-03-03
