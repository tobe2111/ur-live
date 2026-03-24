# 🧪 프로덕션 검증 가이드

## 📋 개요
Phase 3 & 4 완료 후 프로덕션 환경에서 실제 사용자 시나리오를 테스트하는 가이드입니다.

**작성일**: 2026-03-05  
**대상**: Phase 3 완료 (11개 컴포넌트 마이그레이션), Phase 4 완료 (AuthContext 제거)

---

## 🚀 배포 전 준비 사항

### 1. Sentry 설정 (선택사항)
Sentry를 활성화하려면 `CLOUDFLARE_ENV_SETUP.md`를 참고하세요.

### 2. 배포 체크리스트

- [ ] `npm run build:kr` 빌드 성공 확인
- [ ] `git status` - 모든 변경사항 커밋 완료
- [ ] `.env.kr` 환경 변수 확인
- [ ] Cloudflare Pages 환경 변수 설정 완료
- [ ] 백업 파일 정리 (*.OLD.tsx 삭제 확인)

---

## 🧪 프로덕션 테스트 시나리오 (8개)

### 준비물
- [ ] Chrome 브라우저 (최신 버전)
- [ ] Firefox 브라우저 (호환성 테스트)
- [ ] 모바일 기기 (iOS/Android) 또는 Chrome DevTools 모바일 모드
- [ ] 시크릿 모드 (캐시 없는 환경)
- [ ] 카카오 계정 (로그인 테스트용)
- [ ] 테스트 신용카드 (Toss Payments 테스트 키 사용)

---

### ✅ Scenario 1: Kakao 로그인 E2E

**목적**: Kakao OAuth 로그인부터 사용자 프로필까지 전 과정 검증

#### 실행 단계
1. **시크릿 모드** 열기 (캐시 제거 상태)
2. https://live.ur-team.com/login 접속
3. F12 → Console 탭 열기
4. **"카카오로 시작하기"** 버튼 클릭
5. Kakao 계정 로그인 (또는 자동 로그인)
6. 권한 동의 화면 → **"동의하고 계속하기"** 클릭
7. 리다이렉트 대기 (약 2-3초)

#### ✅ 예상 성공 결과

**콘솔 로그**:
```
[LoginPage] ✅ Kakao OAuth redirect
[KakaoCallback] ✅ Code received: abc123...
[KakaoCallback] ✅ Firebase token exchange success
[useAuthKR] ✅ User logged in: uid=xyz123
[TopNav] ✅ User state updated
```

**UI 변화**:
- [ ] UserProfile 페이지로 자동 리다이렉트
- [ ] TopNav 우측 상단에 사용자 아이콘 표시
- [ ] 사용자 이름 표시 (또는 기본값)

#### ❌ 실패 시나리오

| 에러 | 증상 | 해결 방법 |
|------|------|----------|
| **무한 리다이렉트** | /login ↔ /kakao/callback 반복 | `isAuthReady` 타이밍 문제 - 개발자 도구 콘솔 확인 |
| **KOE101 에러** | Kakao 계정 연동 실패 | `/api/auth/kakao/firebase` API 에러 확인 |
| **White screen** | 아무것도 표시 안 됨 | React 렌더 에러 - 콘솔 에러 확인 |

#### 🧹 테스트 후 정리
```javascript
// 브라우저 콘솔에서 실행
localStorage.clear()
window.location.reload()
```

---

### ✅ Scenario 2: Email 회원가입 & 로그인

**목적**: Firebase Email/Password 인증 플로우 검증

#### 실행 단계

**2.1 회원가입**
1. https://live.ur-team.com/register 접속
2. 폼 입력:
   - 이름: `테스트유저`
   - 이메일: `test+{timestamp}@example.com` (중복 방지)
   - 비밀번호: `Test1234!` (8자 이상)
3. [ ] 약관 동의 체크
4. [ ] **"가입하기"** 버튼 클릭
5. 성공 메시지 확인 → `/login`으로 리다이렉트

**2.2 로그인**
1. `/login` 페이지에서 **"이메일로 로그인"** 탭 클릭
2. 방금 생성한 계정으로 로그인
3. [ ] `/user/profile`로 리다이렉트 확인
4. [ ] TopNav에 사용자 정보 표시

#### ✅ 예상 성공 결과

**콘솔 로그 (회원가입)**:
```
[RegisterPage] ✅ Firebase user created: uid=abc123
[RegisterPage] ✅ User profile initialized
[RegisterPage] ✅ Navigate to /login
```

**콘솔 로그 (로그인)**:
```
[LoginPage] ✅ Email login success
[useAuthKR] ✅ User logged in: uid=abc123
```

#### ❌ 실패 시나리오

| 에러 | 원인 | 해결 |
|------|------|------|
| `auth/email-already-in-use` | 이메일 중복 | 다른 이메일 사용 (test+123@...) |
| `auth/weak-password` | 비밀번호 6자 미만 | 8자 이상 입력 |
| 약관 미동의 경고 | 체크박스 누락 | 약관 체크 후 재시도 |

---

### ✅ Scenario 3: Checkout 인증 가드

**목적**: 로그아웃 상태에서 결제 페이지 접근 → 자동 리다이렉트 검증

#### 실행 단계
1. **로그아웃 상태** 확인:
   ```javascript
   localStorage.clear()
   window.location.reload()
   ```
2. 직접 URL 입력: https://live.ur-team.com/checkout
3. [ ] 자동으로 `/login?returnUrl=/checkout`로 리다이렉트 확인
4. Kakao 로그인 (또는 Email 로그인)
5. [ ] 로그인 후 `/checkout`으로 복귀 확인
6. [ ] 장바구니 데이터 로드 확인
7. [ ] Toss Payment Widget 표시 확인

#### ✅ 예상 성공 결과

**콘솔 로그**:
```
[ProtectedRoute] ❌ Not authenticated → /login redirect
[LoginPage] ✅ returnUrl saved: /checkout
[CheckoutPage] ✅ User authenticated, loading cart
[CheckoutPage] ✅ Payment widget initialized
```

**UI 변화**:
- [ ] 로그인 페이지로 즉시 리다이렉트 (무한 루프 없음)
- [ ] 로그인 후 `/checkout`으로 복귀
- [ ] 결제 위젯 로딩 완료

#### ❌ 실패 시나리오

| 에러 | 증상 | 해결 |
|------|------|------|
| **무한 리다이렉트** | /checkout ↔ /login 반복 | `isLoading` 체크 누락 |
| **Payment widget 에러** | "위젯을 불러올 수 없습니다" | Toss Payments SDK 로드 실패 |
| **장바구니 비어있음** | "장바구니가 비어있습니다" | 장바구니에 상품 추가 후 재시도 |

---

### ✅ Scenario 4: Seller JWT 인증

**목적**: Seller 로그인 (JWT 토큰) → Dashboard 데이터 로드 검증

#### 실행 단계
1. https://live.ur-team.com/seller/login 접속
2. 테스트 Seller 계정 입력:
   - Email: `seller@example.com`
   - Password: `seller1234`
3. [ ] **"Sign In"** 클릭
4. [ ] `/seller` 대시보드로 리다이렉트
5. [ ] 통계 데이터 로드 확인 (총 매출, 주문 수 등)
6. [ ] 스트림 목록 표시 확인
7. [ ] 상품 목록 표시 확인

#### ✅ 예상 성공 결과

**localStorage 확인**:
```javascript
localStorage.getItem('seller_token') // eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
localStorage.getItem('user_type')    // "seller"
```

**콘솔 로그**:
```
[SellerLoginPage] ✅ JWT login success
[SellerLoginPage] seller_token: eyJ...
[SellerPage] ✅ Dashboard loaded
[SellerPage] Stats: {revenue: 100000, orders: 15, streams: 3}
```

#### ❌ 실패 시나리오

| 에러 | 원인 | 해결 |
|------|------|------|
| `401 Unauthorized` | JWT 토큰 만료 | 재로그인 |
| `403 Forbidden` | 권한 없음 | Admin 계정으로 시도한 경우 |
| 통계 로드 실패 | API 에러 | Network 탭에서 `/api/seller/stats` 확인 |

---

### ✅ Scenario 5: Admin 인증

**목적**: Admin 로그인 → 관리자 전용 페이지 접근 검증

#### 실행 단계
1. https://live.ur-team.com/admin/login 접속
2. Admin 계정 로그인:
   - Email: `admin@ur-team.com`
   - Password: `admin1234`
3. [ ] `/admin` 대시보드 접근 확인
4. [ ] Admin 전용 메뉴 표시 확인 (사용자 관리, 배너 관리 등)
5. [ ] 일반 사용자 계정으로 로그아웃 → 재로그인
6. [ ] `/admin` 접근 시도 → `/` 리다이렉트 확인

#### ✅ 예상 성공 결과

**콘솔 로그 (Admin 로그인)**:
```
[AdminLoginPage] ✅ Admin login success
[useAuthKR] userRole: 'admin'
[ProtectedRoute] ✅ Admin access granted
```

**콘솔 로그 (일반 사용자 → /admin 접근)**:
```
[ProtectedRoute] ❌ Insufficient permissions: user → /
```

---

### ✅ Scenario 6: Route Guards

**목적**: ProtectedRoute, PublicRoute, AdminRoute, SellerRoute 동작 검증

#### 테스트 케이스

| 상태 | 접근 URL | 예상 결과 |
|------|---------|-----------|
| 로그아웃 | `/checkout` | → `/login?returnUrl=/checkout` |
| 로그인 (user) | `/login` | → `/` (홈) |
| 로그인 (user) | `/admin` | → `/` (권한 없음) |
| 로그인 (admin) | `/admin` | ✅ Admin 대시보드 표시 |
| 로그인 (seller) | `/seller` | ✅ Seller 대시보드 표시 |
| 로그인 (user) | `/seller` | → `/` (권한 없음) |

#### 실행 방법
각 케이스를 순서대로 실행하고 콘솔 로그 확인:

```
[ProtectedRoute] ❌ Not authenticated → /login redirect
[PublicRoute] ✅ Authenticated → / redirect
[ProtectedRoute] ❌ Insufficient permissions → / redirect
```

---

### ✅ Scenario 7: TopNav 상태 업데이트

**목적**: 로그인/로그아웃 시 TopNav UI 즉시 업데이트 검증

#### 실행 단계
1. 로그아웃 상태 확인
2. TopNav 우측 상단 **User 아이콘** 클릭
3. [ ] `/login?returnUrl=/user/profile`로 리다이렉트
4. 로그인 완료
5. [ ] TopNav에 사용자 아이콘 즉시 표시
6. **User 아이콘** 클릭 → `/user/profile` 이동 (리다이렉트 없음)
7. 로그아웃 버튼 클릭
8. [ ] TopNav 상태 즉시 업데이트 (로그인 아이콘으로 변경)

#### ✅ 예상 성공 결과

**콘솔 로그**:
```
[TopNav] user: null → isLoggedIn: false
[TopNav] user: {uid: 'abc123'} → isLoggedIn: true
[TopNav] ✅ Logged out → user: null
```

---

### ✅ Scenario 8: Product Detail 조건부 인증

**목적**: 로그아웃 상태에서 상품 상세 페이지 접근 → 장바구니 추가 시 인증 요구 검증

#### 실행 단계
1. 로그아웃 상태에서 https://live.ur-team.com/product/1 접속
2. [ ] 상품 상세 정보 정상 표시 (인증 불필요)
3. **"장바구니 추가"** 버튼 클릭
4. [ ] 로그인 페이지로 리다이렉트 (`/login?returnUrl=/product/1`)
5. 로그인 완료
6. [ ] `/product/1`로 복귀
7. **"장바구니 추가"** 재클릭
8. [ ] 장바구니 추가 성공 메시지 표시

#### ✅ 예상 성공 결과

**콘솔 로그**:
```
[ProductDetailPage] ✅ Page loaded (no auth required)
[ProductDetailPage] ❌ Not logged in → prompt login
[ProductDetailPage] ✅ Logged in → add to cart
[ProductDetailPage] ✅ Cart updated: +1 item
```

---

## 📊 테스트 결과 기록 템플릿

배포 후 아래 표를 작성하세요:

| # | Scenario | Status | Error | Notes | Tested By | Date |
|---|----------|--------|-------|-------|-----------|------|
| 1 | Kakao Login E2E | ⏳ | - | - | - | - |
| 2 | Email Register & Login | ⏳ | - | - | - | - |
| 3 | Checkout Auth Guard | ⏳ | - | - | - | - |
| 4 | Seller JWT Auth | ⏳ | - | - | - | - |
| 5 | Admin Auth | ⏳ | - | - | - | - |
| 6 | Route Guards | ⏳ | - | - | - | - |
| 7 | TopNav State | ⏳ | - | - | - | - |
| 8 | Product Detail | ⏳ | - | - | - | - |

**범례**:
- ⏳ Pending
- ✅ Pass
- ❌ Fail
- ⚠️ Warning

---

## 🔍 디버깅 도구

### Chrome DevTools 설정

```javascript
// 1. 현재 auth 상태 확인
console.log('User:', localStorage.getItem('user'))
console.log('Seller Token:', localStorage.getItem('seller_token'))
console.log('Firebase Token:', localStorage.getItem('firebase_token')?.substring(0, 20))

// 2. Zustand store 직접 확인 (개발 모드)
// useAuthKR.getState()
// useAuthWorld.getState()

// 3. 강제 로그아웃
localStorage.clear()
window.location.reload()

// 4. Sentry 테스트 에러 발생 (Sentry 설정된 경우)
window.Sentry?.captureException(new Error('Test Error'))
```

### Network 탭 확인 항목

| API | Method | Expected Status | Notes |
|-----|--------|----------------|-------|
| `/api/auth/kakao/firebase` | POST | 200 | Kakao 토큰 교환 |
| `/api/users/role` | GET | 200 | 사용자 권한 조회 |
| `/api/seller/login` | POST | 200 | Seller JWT 발급 |
| `/api/cart` | GET | 200 | 장바구니 조회 |
| `/api/shipping-addresses` | GET | 200 | 배송지 조회 |

---

## ⚠️ 알려진 이슈 & 해결 방법

### Issue 1: Kakao 무한 루프
**증상**: `/login` ↔ `/auth/kakao/sync/callback` 반복

**해결**:
1. `localStorage.clear()` 실행
2. 시크릿 모드에서 재시도
3. 콘솔에서 `isAuthReady` 값 확인

---

### Issue 2: Payment Widget 초기화 실패
**증상**: "결제 시스템을 불러올 수 없습니다"

**해결**:
1. F12 → Console → 에러 메시지 확인
2. Toss Payments SDK 로드 확인 (`window.PaymentWidget` 존재 여부)
3. 네트워크 탭에서 SDK CDN 로드 실패 확인

---

### Issue 3: Seller JWT 401 Unauthorized
**증상**: Seller 대시보드 데이터 로드 실패

**해결**:
1. `localStorage.getItem('seller_token')` 확인
2. JWT 만료 여부 확인 (1시간 유효)
3. 재로그인 후 재시도

---

## 🎯 배포 성공 기준

모든 시나리오가 **✅ Pass** 상태여야 합니다:

- [ ] Kakao 로그인 정상 동작 (무한 루프 없음)
- [ ] Email 회원가입 & 로그인 정상
- [ ] Checkout 인증 가드 정상 (자동 리다이렉트)
- [ ] Seller JWT 인증 정상 (Dashboard 데이터 로드)
- [ ] Admin 권한 체크 정상 (일반 사용자 차단)
- [ ] Route Guards 모두 정상 동작
- [ ] TopNav 상태 즉시 업데이트
- [ ] Product Detail 조건부 인증 정상

---

## 📝 다음 단계

테스트 완료 후:

1. ✅ 테스트 결과 기록 완료
2. 📊 Sentry Dashboard 확인 (에러 발생 여부)
3. 🔍 48시간 모니터링 시작 (`48H_MONITORING_GUIDE.md`)
4. 🚨 에러 발생 시 대응 (`ERROR_RESPONSE_FLOW.md`)

---

**작성일**: 2026-03-05  
**버전**: v1.0  
**작성자**: UR Live Development Team
