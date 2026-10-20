# 🔍 현재 기술적 현황 및 에러 분석 (2026-03-05)

## 📊 전체 프로젝트 현황

### ✅ 완료된 작업
1. **Phase 3 완료** (11개 컴포넌트 Zustand 마이그레이션)
   - LoginPage, RegisterPage, CheckoutPage, ProductDetailPage
   - AdminLoginPage, AdminPage, SellerLoginPage, SellerPage
   - RouteGuards, TopNav, UserProfilePage
   
2. **Phase 4 완료** (AuthContext 제거)
   - AuthContext.tsx 삭제
   - 21개 백업 파일 정리 (*.OLD.tsx, *.BACKUP.tsx 등)
   - 97 KB 백업 아카이브 생성

3. **Sentry 프로덕션 설정**
   - @sentry/react, @sentry/tracing 패키지 설치
   - 커스텀 이벤트 추적 함수 추가
   - CLOUDFLARE_ENV_SETUP.md 가이드 작성

4. **빌드 상태**
   - KR 빌드: ✅ Success (25.34s client, 2.92s worker)
   - 번들 크기: 유지 (vendor.js 278.13 KB gzip)
   - 에러 없음, 경고 없음

---

## 🚨 발견된 문제점 & 미완료 작업

### 1. **AuthContext 백업 파일 미정리** ⚠️

**위치**: `src/contexts/`

```
AuthContext.NEW.tsx   - 10.1 KB (사용 안 함)
AuthContext.SAFE.tsx  - 18.1 KB (사용 안 함)
```

**영향**:
- 코드베이스 혼란 가능성
- 불필요한 파일 (실제 사용 안 됨)
- Git 히스토리 불필요하게 증가

**해결 방법**:
```bash
cd /home/user/webapp
rm src/contexts/AuthContext.NEW.tsx
rm src/contexts/AuthContext.SAFE.tsx
git add .
git commit -m "chore: Remove unused AuthContext backup files"
```

---

### 2. **App.tsx에 주석 처리된 AuthProvider import** ⚠️

**위치**: `src/App.tsx:6`

```typescript
// ❌ import { AuthProvider } from './contexts/AuthContext' // REMOVED - Migrated to Zustand
```

**영향**:
- 코드 가독성 저하
- 주석만 남고 실제 파일 삭제됨

**해결 방법**:
- 주석 라인 완전 삭제 (이미 AuthContext 사용 안 함)

---

### 3. **RouteGuards DEBUG 플래그 켜진 상태** ⚠️

**위치**: `src/components/auth/RouteGuards.tsx:15`

```typescript
const DEBUG = true  // ← 프로덕션에서 과도한 로그 출력
```

**영향**:
- 프로덕션 환경에서 과도한 콘솔 로그
- 성능 미세 저하
- 사용자가 개발자 도구 열었을 때 혼란 가능성

**해결 방법**:
```typescript
const DEBUG = import.meta.env.DEV  // 개발 모드에서만 활성화
```

---

### 4. **Unused imports 및 TODO 주석** 🔵

**주요 위치**:
- `src/components/main/TopNav.tsx:31` - TODO: 알림 페이지 구현
- `src/contexts/AuthContext.SAFE.tsx` - DEBUG_AUTH 플래그

**영향**:
- 코드 가독성 저하
- 향후 개발 방향 불명확

**해결 방법**:
- TODO 주석 → GitHub Issues 로 이동
- 미사용 파일 정리

---

### 5. **CheckoutPage 에러 핸들링 불완전** ⚠️

**발견된 console.error 위치**:
```typescript
console.error('[CheckoutPage] ❌ userId 없음')
console.error('[CheckoutPage] ❌ 필수 항목 누락')
console.error('[Payment] ❌ 위젯 미준비')
```

**문제점**:
- 에러 발생 시 Sentry로 전송 안 됨
- 사용자에게 명확한 에러 메시지 표시 부족
- 에러 복구 로직 부족

**해결 방법**:
```typescript
import { captureError, captureMessage } from '@/lib/sentry'

// 에러 발생 시
captureError(new Error('userId 없음'), { context: 'CheckoutPage' })
showErrorToast('사용자 정보를 확인할 수 없습니다. 다시 로그인해주세요.')
```

---

### 6. **미완료된 인증 흐름 (예상 에러)** 🔴

#### 6.1 Kakao 로그인 무한 루프 위험
**위치**: `LoginPage.tsx`, `KakaoCallbackPage.tsx`

**증상**:
- `/login` ↔ `/auth/kakao/sync/callback` 무한 반복 가능성
- `isAuthReady` 타이밍 문제

**해결 방법**:
- `isAuthReady` 체크 강화
- localStorage 토큰 정리 로직 추가

#### 6.2 JWT 토큰 만료 처리 부족
**위치**: `SellerPage.tsx`, `AdminPage.tsx`

**증상**:
- 1시간 후 JWT 토큰 만료 시 자동 리다이렉트 안 됨
- 401 Unauthorized 에러 발생해도 계속 재시도

**해결 방법**:
```typescript
// API interceptor에서 401 처리
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // JWT 만료 → 로그아웃 & 리다이렉트
      localStorage.removeItem('seller_token')
      window.location.href = '/seller/login'
    }
    return Promise.reject(error)
  }
)
```

---

### 7. **Firebase ID Token 갱신 로직 부족** 🔴

**위치**: `useAuthKR.ts`, `useAuthWorld.ts`

**문제점**:
- Firebase ID Token은 1시간마다 갱신 필요
- 현재 자동 갱신 로직 확인 필요

**해결 방법**:
```typescript
// Firebase는 자동 갱신하지만, API 호출 전 강제 갱신 권장
const idToken = await auth.currentUser?.getIdToken(true)  // true = force refresh
```

---

### 8. **Toss Payments Widget 초기화 실패 가능성** ⚠️

**위치**: `CheckoutPage.tsx`, `TossPaymentWidget.tsx`

**예상 증상**:
- "결제 시스템을 불러올 수 없습니다" 에러
- `window.PaymentWidget` undefined

**원인**:
- SDK CDN 로드 실패
- 네트워크 타임아웃

**해결 방법**:
```typescript
// Retry 로직 추가
useEffect(() => {
  let retries = 0
  const maxRetries = 3
  
  const checkWidget = setInterval(() => {
    if (window.PaymentWidget) {
      clearInterval(checkWidget)
      initializeWidget()
    } else if (++retries >= maxRetries) {
      clearInterval(checkWidget)
      showErrorToast('결제 시스템 로드 실패. 새로고침 후 다시 시도해주세요.')
    }
  }, 1000)
  
  return () => clearInterval(checkWidget)
}, [])
```

---

### 9. **TopNav User 상태 동기화 지연** 🔵

**위치**: `TopNav.tsx`

**예상 증상**:
- 로그인 후 TopNav가 즉시 업데이트 안 됨
- 새로고침 해야 사용자 아이콘 표시

**원인**:
- Zustand store 구독 누락
- useEffect 의존성 배열 문제

**해결 방법**:
- Selector 패턴 사용 확인
- `isAuthReady` 완료 후에만 렌더링

---

### 10. **Route Guards 권한 체크 순서 문제** ⚠️

**위치**: `RouteGuards.tsx`

**문제점**:
```typescript
// 현재 로직
if (!user) return <Navigate to="/login" />
if (requireAdmin && userRole !== 'admin') return <Navigate to="/" />
```

**예상 에러**:
- `userRole`이 undefined일 때 권한 체크 실패
- Admin/Seller JWT 로그인 시 userRole 설정 누락

**해결 방법**:
```typescript
// userRole이 null이면 로딩 대기
if (requireAdmin || requireSeller) {
  if (!userRole) {
    return <div>권한 확인 중...</div>
  }
}
```

---

## 🔧 즉시 수정해야 할 사항 (Priority 순서)

### 🔴 Critical (배포 전 필수)

1. **RouteGuards DEBUG 플래그 변경**
   ```typescript
   const DEBUG = import.meta.env.DEV
   ```

2. **AuthContext 백업 파일 삭제**
   ```bash
   rm src/contexts/AuthContext.{NEW,SAFE}.tsx
   ```

3. **CheckoutPage Sentry 에러 캡처 추가**
   ```typescript
   import { captureError } from '@/lib/sentry'
   // 모든 console.error를 captureError로 변경
   ```

4. **API 401 에러 인터셉터 추가**
   ```typescript
   // src/lib/api.ts에 추가
   api.interceptors.response.use(null, (error) => {
     if (error.response?.status === 401) {
       // JWT 만료 처리
     }
   })
   ```

---

### 🟡 High (배포 후 24시간 이내)

5. **Toss Payment Widget Retry 로직 추가**
6. **Firebase ID Token 갱신 확인**
7. **TopNav 상태 동기화 테스트**
8. **Kakao 로그인 무한 루프 테스트**

---

### 🟢 Medium (1주일 이내)

9. **TODO 주석 → GitHub Issues 이동**
10. **Unused imports 정리**
11. **App.tsx 주석 제거**
12. **에러 메시지 다국어 지원 (i18n)**

---

## 📋 다음 단계 체크리스트

### ✅ Immediate Actions (지금 바로)

- [ ] RouteGuards DEBUG 플래그 변경
- [ ] AuthContext 백업 파일 삭제
- [ ] CheckoutPage Sentry 통합
- [ ] API 401 인터셉터 추가
- [ ] 테스트 빌드 (`npm run build:kr`)
- [ ] Git 커밋 & 푸시

### 🧪 Testing (배포 전)

- [ ] 로컬에서 8개 시나리오 테스트
- [ ] Kakao 로그인 무한 루프 테스트
- [ ] Checkout 결제 플로우 테스트
- [ ] Seller/Admin JWT 만료 테스트
- [ ] TopNav 상태 동기화 테스트

### 🚀 Deployment

- [ ] Cloudflare Pages 배포
- [ ] 프로덕션 8개 시나리오 테스트
- [ ] Sentry Dashboard 모니터링
- [ ] 48시간 에러 추적

---

## 🛠️ 권장 작업 순서

### Step 1: Critical Fixes (30분)
```bash
# 1. RouteGuards DEBUG 플래그 변경
# 2. AuthContext 백업 파일 삭제
# 3. Sentry 에러 캡처 추가
# 4. API 인터셉터 추가
```

### Step 2: Build & Test (20분)
```bash
npm run build:kr
npm run preview
# 로컬에서 8개 시나리오 테스트
```

### Step 3: Commit & Deploy (10분)
```bash
git add .
git commit -m "fix: Critical production fixes"
git push origin main
# Cloudflare Pages 자동 빌드 대기
```

### Step 4: Production Validation (30분)
```bash
# PRODUCTION_VALIDATION_GUIDE.md 참고
# 8개 시나리오 프로덕션 테스트
```

---

## 📊 예상 에러 시나리오 & 해결

### Error 1: "결제 시스템을 불러올 수 없습니다"
**원인**: Toss Payments SDK CDN 로드 실패
**해결**: Retry 로직 추가, 사용자에게 새로고침 안내

### Error 2: Kakao 무한 리다이렉트
**원인**: `isAuthReady` 타이밍, localStorage 토큰 충돌
**해결**: localStorage 정리, 타이밍 로직 강화

### Error 3: JWT 토큰 만료 후 401 에러
**원인**: API 인터셉터 부족
**해결**: 401 → 로그아웃 & 리다이렉트 로직 추가

### Error 4: TopNav 사용자 아이콘 표시 안 됨
**원인**: Zustand store 구독 누락
**해결**: Selector 패턴 재확인, `isAuthReady` 체크

---

## 🎯 성공 기준

### 배포 성공 확인
- [ ] 빌드 에러 0개
- [ ] 런타임 에러 < 5건/일
- [ ] Kakao 로그인 성공률 ≥ 95%
- [ ] 결제 위젯 초기화 성공률 ≥ 98%
- [ ] TopNav 상태 동기화 지연 < 500ms

### 48시간 안정성 확인
- [ ] Error Rate < 0.1%
- [ ] Page Load Time < 3초
- [ ] Auth Success Rate ≥ 95%
- [ ] Uptime ≥ 99.9%

---

**작성일**: 2026-03-05  
**작성자**: UR Live Development Team  
**문서 버전**: v1.0
