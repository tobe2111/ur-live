# Cloudflare Pages 환경 변수 설정 가이드

## 📍 목적
Sentry를 프로덕션 환경에서 활성화하여 에러 추적 및 성능 모니터링을 수행합니다.

---

## 🔧 Step 1: Sentry 프로젝트 생성

### 1.1 Sentry 계정 접속
- URL: https://sentry.io
- 로그인 또는 회원가입

### 1.2 새 프로젝트 생성
1. **Projects** → **Create Project** 클릭
2. **Platform**: **React** 선택
3. **Project Name**: `ur-live-kr` (또는 원하는 이름)
4. **Create Project** 클릭

### 1.3 DSN 복사
- 프로젝트 생성 후 표시되는 **DSN** 주소를 복사합니다.
- 형식: `https://<key>@<org>.ingest.sentry.io/<project-id>`
- 예: `https://abc123def456@o123456.ingest.sentry.io/7890`

---

## 🚀 Step 2: Cloudflare Pages 환경 변수 설정

### 2.1 Cloudflare Dashboard 접속
1. https://dash.cloudflare.com 로그인
2. **Workers & Pages** 클릭
3. **ur-live** 프로젝트 선택

### 2.2 환경 변수 추가
1. **Settings** → **Environment variables** 클릭
2. **Add variable** 버튼 클릭
3. 아래 변수들을 **Production** 환경에 추가:

#### ✅ 필수 환경 변수

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `VITE_SENTRY_DSN` | `https://<key>@<org>.ingest.sentry.io/<project-id>` | Production |
| `VITE_SENTRY_ENVIRONMENT` | `production` | Production |

#### 🔍 옵션 환경 변수 (추가 권장)

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `VITE_SENTRY_RELEASE` | `v1.0.0` | 배포 버전 (선택사항) |
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | `0.1` | 성능 추적 샘플링 비율 (10%) |

### 2.3 환경 변수 저장
- **Save** 버튼 클릭
- ⚠️ **중요**: 환경 변수 추가 후 **재배포**가 필요합니다.

---

## 🔄 Step 3: 재배포 (환경 변수 적용)

### 3.1 로컬에서 재배포 (권장)

```bash
# 1. 빌드 (환경 변수 자동 주입)
npm run build:kr

# 2. Cloudflare Pages에 배포
npx wrangler pages deploy dist --project-name ur-live

# 3. 배포 확인
# https://live.ur-team.com 접속 후 콘솔 확인
# "[Sentry] Initialized: production" 메시지 확인
```

### 3.2 GitHub 연동 자동 배포 (선택사항)

```bash
# main 브랜치에 push하면 자동 배포
git add .
git commit -m "feat: Enable Sentry production monitoring"
git push origin main

# Cloudflare Pages 자동 빌드 시작
# 약 2-3분 후 배포 완료
```

---

## ✅ Step 4: Sentry 동작 확인

### 4.1 콘솔 로그 확인
1. https://live.ur-team.com 접속
2. **F12** → **Console** 탭 열기
3. 다음 메시지 확인:
   ```
   [Sentry] Initialized: { environment: 'production', dsn: 'https://...' }
   ```

### 4.2 테스트 에러 발생시키기 (선택사항)

브라우저 콘솔에서 실행:

```javascript
// 1. 테스트 에러 발생
window.Sentry?.captureException(new Error('Sentry Test Error'))

// 2. 커스텀 메시지 전송
window.Sentry?.captureMessage('Sentry Test Message', 'info')
```

### 4.3 Sentry Dashboard 확인
1. https://sentry.io 접속
2. **ur-live-kr** 프로젝트 선택
3. **Issues** 탭에서 테스트 에러 확인 (1-2분 소요)

---

## 🎯 Step 5: 커스텀 이벤트 추적 활성화

### 5.1 로그인 이벤트 추적

**파일**: `src/pages/LoginPage.tsx`

```typescript
import { trackLoginSuccess, trackLoginFailure } from '@/lib/sentry'

// 로그인 성공 시
const handleLoginSuccess = async (user) => {
  trackLoginSuccess('kakao', user.uid)
  // ... 기존 로직
}

// 로그인 실패 시
const handleLoginError = (error) => {
  trackLoginFailure('kakao', error.message)
  // ... 기존 로직
}
```

### 5.2 결제 이벤트 추적

**파일**: `src/components/payments/TossPaymentWidget.tsx`

```typescript
import { trackPaymentSuccess, trackPaymentFailure } from '@/lib/sentry'

// 결제 성공 시
const handlePaymentSuccess = (orderId, amount) => {
  trackPaymentSuccess(orderId, amount, 'toss')
  // ... 기존 로직
}

// 결제 실패 시
const handlePaymentError = (orderId, error) => {
  trackPaymentFailure(orderId, 0, error.message)
  // ... 기존 로직
}
```

### 5.3 페이지 로드 시간 추적

**파일**: `src/pages/CheckoutPage.tsx`

```typescript
import { trackPageLoadTime } from '@/lib/sentry'

useEffect(() => {
  const startTime = Date.now()
  
  // 데이터 로드 후
  const loadTime = Date.now() - startTime
  trackPageLoadTime('CheckoutPage', loadTime)
}, [])
```

---

## 📊 Step 6: Sentry 대시보드 모니터링

### 6.1 주요 메트릭 확인

| 메트릭 | 목표값 | 확인 위치 |
|-------|--------|----------|
| **Error Rate** | < 0.1% | Issues → Overview |
| **Avg Response Time** | < 1s | Performance → Overview |
| **Uptime** | ≥ 99.9% | Performance → Web Vitals |
| **User Impact** | < 50 users/day | Issues → Users Affected |

### 6.2 알림 설정 (권장)

1. **Settings** → **Alerts** → **Create Alert**
2. **Alert Type**: **Issues**
3. **Conditions**:
   - Error count > 10 in 1 hour
   - New issue appears
4. **Actions**:
   - Email notification
   - Slack webhook (선택사항)

---

## 🔐 보안 주의사항

### ⚠️ DSN은 공개되어도 안전합니다
- Sentry DSN은 **클라이언트에서 사용**되므로 공개되어도 문제없습니다.
- 단, **Auth Token**은 절대 공개하지 마세요!

### ✅ 환경 변수 분리 권장

| 환경 | DSN 프로젝트 | 용도 |
|------|-------------|------|
| Development | `ur-live-dev` | 개발 중 에러 테스트 |
| Production | `ur-live-prod` | 실제 사용자 에러 추적 |

---

## 🛠️ 문제 해결

### Q1: "Sentry가 초기화되지 않았습니다"
**원인**: `VITE_SENTRY_DSN` 환경 변수 누락

**해결**:
1. Cloudflare Pages → Settings → Environment variables 확인
2. `VITE_SENTRY_DSN` 변수 추가
3. 재배포 (`npm run build:kr && npx wrangler pages deploy dist`)

---

### Q2: "에러가 Sentry에 표시되지 않습니다"
**원인**: 개발 환경에서는 Sentry 전송이 차단됨

**해결**:
1. `src/lib/sentry.ts` 파일 확인:
   ```typescript
   // 개발 환경에서는 전송 안 함
   if (environment === 'development') {
     return null; // ← 이 로직 때문
   }
   ```
2. **프로덕션 빌드**로 테스트:
   ```bash
   npm run build:kr
   npm run preview
   # http://localhost:4173 에서 테스트
   ```

---

### Q3: "Sentry 요금이 초과될까 걱정됩니다"
**현재 설정**:
- **Performance 샘플링**: 10% (90% 트랜잭션 무시)
- **Replay 샘플링**: 10% (에러 발생 시 100%)

**무료 티어**:
- **5,000 errors/month** (초과 시 $26/month)
- **10,000 performance units/month** (초과 시 $16/month)

**권장**:
- 샘플링 비율을 낮춰서 비용 절감 (5% → `tracesSampleRate: 0.05`)

---

## 📝 체크리스트

배포 전 확인 사항:

- [ ] Sentry 프로젝트 생성 완료
- [ ] Cloudflare Pages 환경 변수 `VITE_SENTRY_DSN` 추가
- [ ] Cloudflare Pages 환경 변수 `VITE_SENTRY_ENVIRONMENT` = `production` 설정
- [ ] `npm run build:kr` 빌드 성공
- [ ] 프로덕션 배포 완료
- [ ] 콘솔에서 "[Sentry] Initialized" 메시지 확인
- [ ] Sentry 대시보드에서 테스트 에러 확인
- [ ] (선택) 커스텀 이벤트 추적 코드 추가 (로그인, 결제)
- [ ] (선택) Sentry 알림 설정

---

## 🎯 다음 단계

1. ✅ Sentry 설정 완료
2. 📊 48시간 모니터링 (48H_MONITORING_GUIDE.md 참고)
3. 🧪 프로덕션 테스트 체크리스트 실행 (PRODUCTION_TEST_CHECKLIST.md)
4. 🔥 에러 발생 시 대응 (ERROR_RESPONSE_FLOW.md)

---

**작성일**: 2026-03-05  
**작성자**: UR Live Development Team  
**문서 버전**: v1.0
