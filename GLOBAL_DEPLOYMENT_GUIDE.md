# 🌍 글로벌 버전 배포 완료 가이드

## ✅ 배포 상태

### 완료된 작업
- [x] `ur-live-global` Cloudflare Pages 프로젝트 생성
- [x] 글로벌 빌드 완료 (VITE_REGION=GLOBAL, Stripe)
- [x] Cloudflare Pages 배포 완료
- [x] 임시 URL 활성화: https://a9d9163d.ur-live-global.pages.dev/

### 필요한 작업
- [ ] 커스텀 도메인 연결: world.ur-team.com → ur-live-global
- [ ] 환경변수 설정 (Stripe API 키 등)
- [ ] 도메인 활성화 확인

---

## 🔧 커스텀 도메인 연결 방법

### 방법 1: Cloudflare Dashboard (권장)

1. **Cloudflare Dashboard 접속**
   - https://dash.cloudflare.com/

2. **Workers & Pages 선택**
   - 좌측 메뉴 → "Workers & Pages"

3. **ur-live-global 프로젝트 선택**
   - 프로젝트 목록에서 `ur-live-global` 클릭

4. **Custom domains 탭**
   - 상단 탭에서 "Custom domains" 클릭

5. **도메인 추가**
   - "Set up a custom domain" 버튼 클릭
   - 도메인 입력: `world.ur-team.com`
   - "Continue" 클릭
   - DNS 레코드 자동 생성 확인
   - "Activate domain" 클릭

6. **완료 대기**
   - DNS 전파 대기 (보통 1-5분)
   - SSL 인증서 자동 발급 (수 분 소요)

### 방법 2: CLI 사용 (참고용)

현재 wrangler CLI의 domain 명령어가 변경되어 다음과 같이 사용해야 합니다:

```bash
# 프로젝트 설정 업데이트가 필요할 수 있음
# Dashboard 사용을 권장합니다
```

---

## 🌐 도메인 구조

| 도메인 | 프로젝트 | 리전 | 결제 | 상태 |
|--------|----------|------|------|------|
| https://live.ur-team.com/ | ur-live | KOREA | Toss Payments | ✅ 활성 |
| https://world.ur-team.com/ | ur-live-global | GLOBAL | Stripe | 🔄 연결 필요 |
| https://a9d9163d.ur-live-global.pages.dev/ | ur-live-global (임시) | GLOBAL | Stripe | ✅ 배포됨 |

---

## 📋 환경변수 설정

### Cloudflare Pages Dashboard에서 설정

**Workers & Pages** → **ur-live-global** → **Settings** → **Environment variables**

#### Production 환경변수

**Frontend (빌드 시):**
```
VITE_REGION=GLOBAL
VITE_GOOGLE_CLIENT_ID=352937066044-52u0bd7f8ae9898d8colgo8rrcr4ve5o.apps.googleusercontent.com
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_STRIPE_PUBLISHABLE_KEY
VITE_DEFAULT_LANGUAGE=en
VITE_API_BASE_URL=https://world.ur-team.com
```

**Backend (런타임):**
```
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY
JWT_SECRET=your-jwt-secret-key
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=UR World <noreply@ur-team.com>
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
```

**설정 방법:**
1. 각 변수의 **Name** 입력
2. **Value** 입력
3. **Environment**: `Production` 선택
4. "Save" 클릭
5. 모든 변수 입력 후 **Re-deploy** 필요

---

## 🔑 Stripe API 키 발급

### 1. Stripe Dashboard 접속
- https://dashboard.stripe.com/

### 2. API 키 확인
- 좌측 메뉴 → "Developers" → "API keys"

### 3. 테스트 키 복사
- **Publishable key** (pk_test_로 시작)
  - Frontend에서 사용 → `VITE_STRIPE_PUBLISHABLE_KEY`
- **Secret key** (sk_test_로 시작)
  - Backend에서 사용 → `STRIPE_SECRET_KEY`
  - ⚠️ 절대 공개하지 마세요!

### 4. 프로덕션 키 (나중에)
- 실제 결제를 받으려면 Stripe 계정 활성화 필요
- 테스트 키 (pk_test_, sk_test_) → 실제 키 (pk_live_, sk_live_) 교체

---

## 🧪 테스트 방법

### 1. 임시 URL 테스트 (현재 가능)
```bash
# 메인 페이지 확인
curl https://a9d9163d.ur-live-global.pages.dev/

# API 엔드포인트 확인
curl https://a9d9163d.ur-live-global.pages.dev/api/test/env
```

브라우저로 접속:
- https://a9d9163d.ur-live-global.pages.dev/

### 2. 커스텀 도메인 테스트 (도메인 연결 후)
```bash
curl https://world.ur-team.com/
```

브라우저로 접속:
- https://world.ur-team.com/

### 3. 결제 기능 테스트
- Stripe 테스트 카드 번호: `4242 4242 4242 4242`
- 만료일: 미래 날짜 (예: 12/34)
- CVC: 아무 3자리 (예: 123)
- 우편번호: 아무 5자리 (예: 12345)

---

## 🔄 재배포 방법

### 코드 변경 후 재배포
```bash
# 글로벌 버전 재배포
export CLOUDFLARE_API_TOKEN="yp2LoilEU8-WtBGMSCDZpIs2D2Yd69booRAgvhb4"
npm run deploy:global
```

### 환경변수만 변경 시
1. Cloudflare Dashboard에서 환경변수 수정
2. **Re-deploy** 버튼 클릭 (Settings 페이지)

---

## 📊 배포 정보

**배포 날짜**: 2026-03-04  
**빌드 ID**: 84b267495e9bc848  
**프로젝트**: ur-live-global  
**계정**: jiwon@ur-team.com (Account ID: 1a2c006f0fb54894f81283a5ea787b83)  
**임시 URL**: https://a9d9163d.ur-live-global.pages.dev/  
**최종 URL**: https://world.ur-team.com/ (도메인 연결 필요)

---

## 🆘 문제 해결

### 도메인이 연결되지 않는 경우
1. DNS 레코드 확인
   - Cloudflare DNS 페이지에서 `world.ur-team.com` CNAME 레코드 확인
   - 값: `ur-live-global.pages.dev`
2. SSL 인증서 상태 확인
   - Custom domains 탭에서 "Active" 상태 확인
3. 캐시 클리어
   - 브라우저 하드 리프레시 (Ctrl+Shift+R)

### "Hello world"만 표시되는 경우
- 이전 Worker가 아직 활성화되어 있을 수 있음
- Dashboard에서 Workers 확인하고 비활성화

### 결제가 작동하지 않는 경우
1. Stripe API 키 확인
   - Dashboard에서 환경변수 올바르게 설정되었는지 확인
2. 브라우저 콘솔 확인
   - F12 → Console 탭에서 에러 메시지 확인
3. Network 탭 확인
   - API 요청이 성공하는지 확인

---

## 📞 지원

**문제가 있으신가요?**
- Cloudflare Dashboard: https://dash.cloudflare.com/
- Stripe Dashboard: https://dashboard.stripe.com/
- GitHub Repository: https://github.com/tobe2111/ur-live

---

**작성일**: 2026-03-04  
**작성자**: Claude AI Assistant  
**버전**: 1.0
