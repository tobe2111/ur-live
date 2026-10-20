# 🚀 Sentry 프로덕션 배포 단계

## 현재 상태 (2026-03-05)
- ✅ Sentry 코드 완료 (src/lib/sentry.ts)
- ✅ .env.kr에 DSN 설정됨
- ✅ GitHub에 푸시 완료 (커밋 6a5b2e5)
- ❌ **Cloudflare Pages 환경 변수 미설정** ← 지금 해야 할 작업

## 🔴 문제
프로덕션 사이트 (https://live.ur-team.com)에서:
```
[Sentry] Mock mode - DSN not configured
```
→ Cloudflare Pages가 .env.kr 파일을 읽지 못함 (빌드 시에만 사용됨)

---

## ✅ 해결 방법: Cloudflare Pages 환경 변수 설정 (5분)

### 1️⃣ Cloudflare Dashboard 접속
1. https://dash.cloudflare.com 로그인
2. 좌측 메뉴 → **Pages** 클릭
3. **ur-live** 프로젝트 선택

### 2️⃣ 환경 변수 추가
1. 상단 탭 → **Settings** 클릭
2. 좌측 메뉴 → **Environment variables** 클릭
3. **Add variable** 버튼 클릭

**추가할 변수 (2개):**

#### 변수 1: Sentry DSN
- **Variable name**: `VITE_SENTRY_DSN`
- **Value**: `https://08caf64e8e7955f09acc2b0551fdb049@o4510992097935360.ingest.us.sentry.io/4510992127295488`
- **Environment**: `Production` 체크 ✅
- **Environment**: `Preview` 체크 (선택사항)
- **Save** 클릭

#### 변수 2: Sentry Environment
- **Variable name**: `VITE_SENTRY_ENVIRONMENT`
- **Value**: `production`
- **Environment**: `Production` 체크 ✅
- **Save** 클릭

### 3️⃣ 재배포 트리거
환경 변수를 추가한 후 **반드시 재배포**해야 적용됩니다:

#### 방법 A: Cloudflare에서 직접 재배포
1. **Deployments** 탭 클릭
2. 최신 배포 옆 **...** (메뉴) → **Retry deployment** 클릭

#### 방법 B: Git 푸시 (빈 커밋)
```bash
cd /home/user/webapp
git commit --allow-empty -m "chore: Trigger Cloudflare rebuild for Sentry env vars"
git push origin main
```

### 4️⃣ 배포 완료 확인 (2-3분 대기)
Cloudflare Dashboard → Deployments → 상태가 **Success** 될 때까지 대기

---

## 🧪 테스트: Sentry 작동 확인 (3분)

### A. 프로덕션 콘솔 확인
1. https://live.ur-team.com 접속
2. F12 → Console 탭
3. **예상 로그**:
   ```
   [Sentry] Initialized: {environment: 'production', dsn: 'https://08caf64e8e79...'}
   ```
   
4. **이전 로그 (Mock 모드) - 나오면 안 됨**:
   ```
   [Sentry] Mock mode - DSN not configured
   ```

### B. 테스트 에러 발생
브라우저 콘솔에서:
```javascript
window.Sentry?.captureException(new Error('프로덕션 Sentry 테스트'));
```

### C. Sentry Dashboard 확인
1. https://o4510992097935360.sentry.io/issues/ 접속
2. "프로덕션 Sentry 테스트" 에러가 나타나는지 확인 (5-10분 소요)

---

## 📊 Sentry 대시보드 사용법

### Issues 탭 (에러 모니터링)
- **최근 에러**: 실시간 에러 목록
- **에러율**: 그래프로 확인
- **필터**: 환경(production/development), 브라우저, 사용자

### Performance 탭 (성능 모니터링)
- **페이지 로드 시간**: /checkout, /login 등
- **API 응답 시간**: Firebase, Toss API
- **느린 트랜잭션**: >3초 걸린 요청

### Replays 탭 (세션 재생)
- **에러 발생 시**: 사용자 화면 재생
- **클릭 경로**: 에러 발생까지의 과정
- **네트워크 요청**: API 호출 내역

### Alerts 설정 (선택사항)
1. Settings → Alerts → **New Alert Rule**
2. **조건 예시**:
   - 에러율 >10 errors/hour
   - 결제 실패 발생 시
   - 페이지 로드 >5초
3. **알림 방법**: 이메일, Slack, Webhook

---

## 🎯 자동 추적 중인 이벤트

Sentry가 이미 다음 항목을 자동으로 추적하고 있습니다:

### 1. CheckoutPage 에러
```typescript
// src/pages/CheckoutPage.tsx
captureError(new Error('userId 없음'), { context: 'CheckoutPage' });
captureError(error, { context: 'CheckoutPage.loadData', userId });
captureError(error, { context: 'CheckoutPage.payment', orderId });
```

### 2. API 인증 에러
```typescript
// src/lib/api.ts
captureMessage('API 401 Unauthorized', 'error');
captureError(new Error('API Permission denied'), { context: 'API.403' });
captureError(new Error('API Server Error'), { context: 'API.500' });
```

### 3. 커스텀 이벤트
```typescript
trackLoginSuccess('kakao', userId);      // 로그인 성공
trackLoginFailure('email', reason);      // 로그인 실패
trackPaymentSuccess(orderId, 50000, 'toss'); // 결제 성공
trackPaymentFailure(orderId, 50000, reason); // 결제 실패
trackPageLoadTime('CheckoutPage', 2340);     // 페이지 로드 시간
```

---

## 📋 체크리스트

### 즉시 해야 할 작업 (5분)
- [ ] Cloudflare Dashboard → Pages → ur-live
- [ ] Settings → Environment variables
- [ ] `VITE_SENTRY_DSN` 추가
- [ ] `VITE_SENTRY_ENVIRONMENT=production` 추가
- [ ] Deployments → Retry deployment (또는 빈 커밋 푸시)
- [ ] 2-3분 대기 후 배포 완료 확인

### 배포 후 확인 (3분)
- [ ] https://live.ur-team.com 접속
- [ ] F12 → Console → `[Sentry] Initialized` 로그 확인
- [ ] `window.Sentry?.captureException(new Error('테스트'))` 실행
- [ ] Sentry Dashboard에서 에러 확인

### 48시간 모니터링
- [ ] Sentry Issues 탭 - 에러율 <0.1%
- [ ] Performance 탭 - 페이지 로드 <3초
- [ ] Replays 탭 - 에러 발생 시 세션 재생
- [ ] Alerts 설정 (선택사항)

---

## 🔗 링크

- **Sentry Dashboard**: https://o4510992097935360.sentry.io/
- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **프로덕션 사이트**: https://live.ur-team.com
- **GitHub 리포지토리**: https://github.com/tobe2111/ur-live
- **최신 커밋**: https://github.com/tobe2111/ur-live/commit/6a5b2e5

---

## 💡 자주 묻는 질문 (FAQ)

### Q: .env.kr에 DSN이 있는데 왜 Cloudflare에도 추가해야 하나요?
**A**: `.env.kr`는 로컬 개발용이고, Cloudflare Pages는 자체 환경 변수 시스템을 사용합니다. 프로덕션 빌드 시 Cloudflare가 환경 변수를 주입합니다.

### Q: 무료 플랜 제한은?
**A**: Sentry Developer 플랜 - 5,000 errors/month, 무제한 프로젝트. 충분합니다.

### Q: Sentry가 성능에 영향을 주나요?
**A**: 매우 적습니다:
- 샘플링: 10% 트랜잭션만 추적 (`tracesSampleRate: 0.1`)
- 번들 크기: ~254 KB (gzip 후 ~80 KB)
- 네트워크: 비동기로 전송, 페이지 로드 차단 안 함

### Q: 개발 환경에서도 Sentry가 작동하나요?
**A**: 아니요. `beforeSend` 필터가 development 환경에서는 콘솔에만 출력하고 전송하지 않습니다 (src/lib/sentry.ts:44-48).

---

## 📞 다음 단계

1. **지금**: Cloudflare 환경 변수 설정 (5분)
2. **배포 후**: Sentry 작동 확인 (3분)
3. **24-48시간**: 모니터링 및 대시보드 확인
4. **선택사항**: Slack/이메일 알림 설정

**준비 완료! 위 단계를 따라하면 5분 내에 Sentry가 프로덕션에서 작동합니다.** 🚀
