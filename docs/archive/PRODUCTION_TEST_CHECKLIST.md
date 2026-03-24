# 🧪 프로덕션 테스트 체크리스트 (Production Test Checklist)

**작성일**: 2026-03-05  
**대상**: https://live.ur-team.com (KR 버전 단일 빌드 배포)  
**배포 방식**: Cloudflare Pages, Region Runtime Detection  
**테스트 환경**: Chrome + Firefox (최신 버전), 시크릿 모드, 모바일 에뮬레이션

---

## 📋 테스트 환경 설정 (Test Environment)

### 브라우저 설정
- [ ] **Chrome** (최신 버전) - 메인 테스트 브라우저
- [ ] **Firefox** (최신 버전) - 호환성 검증
- [ ] **시크릿 모드** (Incognito) - 캐시/쿠키 없는 깨끗한 환경
- [ ] **모바일 에뮬레이션** - Chrome DevTools → Device Toolbar (Ctrl+Shift+M)
  - iPhone 13 Pro (390x844)
  - Samsung Galaxy S21 (360x800)

### DevTools 설정
- [ ] **Console 탭 열기** (F12 → Console)
- [ ] **Preserve log** 체크 (페이지 이동 시 로그 유지)
- [ ] **Network 탭** 준비 (API 요청 모니터링)
- [ ] **Network throttling** (선택사항):
  - Fast 3G (1.6 Mbps down, 750 Kbps up)
  - Slow 3G (400 Kbps down, 400 Kbps up)

### 테스트 계정 준비
- [ ] **Kakao 계정** (본인 계정 또는 테스트 계정)
- [ ] **이메일 계정** - 새 가입용 (`test+{timestamp}@example.com` 형식 권장)
- [ ] **Seller 계정** - `seller@example.com` / `seller1234` (D1 DB에 사전 등록 필요)
- [ ] **Admin 계정** - `admin@ur-team.com` / `admin1234` (D1 DB에 사전 등록 필요)
- [ ] **테스트 신용카드** (Toss Payments 테스트 키):
  - 카드번호: `5570****0001****` (가상 카드)
  - 유효기간: `01/25`
  - CVC: `123`

### 환경 변수 확인
- [ ] Cloudflare Pages → Settings → Environment variables
  - `VITE_SENTRY_DSN` ✅ 설정됨
  - `VITE_SENTRY_ENVIRONMENT=production` ✅ 설정됨
  - `VITE_KAKAO_REST_API_KEY` ✅ 설정됨
  - `VITE_TOSS_CLIENT_KEY` ✅ 설정됨

---

## 🎯 핵심 테스트 시나리오 (8개)

### ✅ Scenario 1: Kakao 로그인 E2E (5분)
**목적**: Kakao OAuth 플로우 전체 검증 (로그인 → 콜백 → Firebase 인증 → 리다이렉트)

#### 실행 단계
1. **시크릿 모드** 열기 (Ctrl+Shift+N)
2. https://live.ur-team.com/login 접속
3. F12 → Console 탭 열기, "Preserve log" 체크
4. **"카카오로 시작하기"** 버튼 클릭
5. Kakao 로그인 페이지에서 계정 입력 (또는 자동 로그인)
6. 권한 동의 화면 → **"동의하고 계속하기"** 클릭
7. 리다이렉트 대기 (약 2-3초)

#### ✅ 예상 성공 로그
```javascript
[LoginPage] 🔑 REST API Key: 975a2e7f97...
[LoginPage] 🔗 Redirect URI: https://live.ur-team.com/auth/kakao/sync/callback
[Kakao Login] 🔥 Firebase Custom Token 요청 시작
[Kakao Login] ✅ Firebase Custom Token 받기 완료: {userId: 123456, userName: "테스트유저"}
[Kakao Login] ✅ Firebase 로그인 성공: 테스트유저
[useAuthKR] ✅ onAuthStateChanged: User logged in
[TopNav] ✅ User state updated
```

#### ✅ 예상 UI 변화
- [ ] `/user/profile` 또는 returnUrl로 자동 리다이렉트
- [ ] TopNav 우측 상단에 **사용자 아이콘** 표시
- [ ] 사용자 이름 또는 이메일 표시
- [ ] localStorage에 `user` 객체 저장 확인:
  ```javascript
  localStorage.getItem('user') // {"uid":"...", "email":"...", ...}
  ```

#### ❌ 실패 시나리오 & 해결

| 에러 메시지 | 증상 | 원인 | 해결 방법 |
|------------|------|------|----------|
| **무한 리다이렉트** | `/login` ↔ `/auth/kakao/sync/callback` 반복 | `isAuthReady` 타이밍 이슈 또는 localStorage 충돌 | `localStorage.clear()` → 새로고침 → 재시도 |
| **KOE101 에러** | "카카오 로그인 설정 오류입니다" | `VITE_KAKAO_REST_API_KEY` 환경 변수 미설정 | Cloudflare Pages → 환경 변수 확인 → 재배포 |
| **401 Unauthorized** | Firebase Custom Token 교환 실패 | `/api/auth/kakao/firebase` API 에러 | Network 탭에서 응답 확인, Worker 로그 확인 |
| **White screen** | 아무것도 표시 안 됨 | React 렌더 에러 | Console에서 에러 메시지 확인, Sentry 대시보드 확인 |

#### 🧹 테스트 후 정리
```javascript
// 브라우저 콘솔에서 실행
localStorage.clear()
sessionStorage.clear()
window.location.reload()
```

---

### ✅ Scenario 2: Email 회원가입 & 로그인 (5분)
**목적**: Firebase Email/Password 인증 플로우 검증

#### 실행 단계 (2.1 회원가입)
1. https://live.ur-team.com/register 접속
2. 폼 입력:
   - **이름**: `테스트유저123`
   - **이메일**: `test+{현재시각}@example.com` (예: `test+202603051430@example.com`)
   - **비밀번호**: `Test1234!` (8자 이상, 영문+숫자+특수문자)
   - **비밀번호 확인**: `Test1234!`
3. [ ] 약관 동의 체크 (필수)
4. [ ] **"가입하기"** 버튼 클릭
5. 성공 메시지 확인 → `/login`으로 자동 리다이렉트

#### 실행 단계 (2.2 로그인)
1. `/login` 페이지에서 **"이메일로 로그인"** 버튼 클릭
2. 방금 생성한 이메일과 비밀번호 입력
3. **"로그인"** 버튼 클릭
4. [ ] `/user/profile`로 리다이렉트 확인
5. [ ] TopNav에 사용자 정보 표시 확인

#### ✅ 예상 성공 로그 (회원가입)
```javascript
[RegisterPage] ✅ Firebase user created: uid=abc123xyz
[RegisterPage] ✅ User profile initialized
[RegisterPage] ✅ Navigate to /login
```

#### ✅ 예상 성공 로그 (로그인)
```javascript
[LoginPage] ✅ Email login success
[useAuthKR] ✅ User logged in: uid=abc123xyz
[TopNav] ✅ User state updated
```

#### ❌ 실패 시나리오

| 에러 코드 | 증상 | 원인 | 해결 |
|----------|------|------|------|
| `auth/email-already-in-use` | "이미 사용 중인 이메일입니다" | 중복 이메일 | 다른 이메일 사용 (test+456@...) |
| `auth/weak-password` | "비밀번호가 너무 약합니다" | 6자 미만 | 8자 이상 입력 (영문+숫자 조합) |
| `auth/invalid-email` | "잘못된 이메일 형식입니다" | 이메일 형식 오류 | 올바른 형식 입력 (xxx@yyy.com) |
| 약관 미동의 경고 | "약관에 동의해주세요" | 체크박스 누락 | 약관 체크 후 재시도 |

---

### ✅ Scenario 3: Checkout 인증 가드 (3분)
**목적**: 로그아웃 상태에서 결제 페이지 접근 시 자동 리다이렉트 검증

#### 실행 단계
1. **로그아웃 상태 확인** (콘솔에서 실행):
   ```javascript
   localStorage.clear()
   sessionStorage.clear()
   window.location.reload()
   ```
2. 브라우저 주소창에 직접 입력: `https://live.ur-team.com/checkout`
3. [ ] 자동으로 `/login?returnUrl=/checkout`로 리다이렉트 확인
4. Kakao 로그인 (또는 Email 로그인)
5. [ ] 로그인 후 `/checkout`으로 자동 복귀 확인
6. [ ] 장바구니 데이터 로드 확인 (상품 목록 표시)
7. [ ] **Toss Payment Widget** 표시 확인 (결제 방법 선택 UI)

#### ✅ 예상 성공 로그
```javascript
[RouteGuards] ❌ ProtectedRoute: Not authenticated → /login
[LoginPage] 🎯 returnUrl 저장: /checkout
[LoginPage] ✅ 이미 로그인됨 - returnUrl로 리다이렉트: /checkout
[CheckoutPage] ✅ User authenticated, loading cart
[CheckoutPage] ✅ Payment widget initialized
[CheckoutPage] ✅ Cart loaded: 3 items
```

#### ✅ 예상 UI 변화
- [ ] 로그인 페이지로 **즉시 리다이렉트** (무한 루프 없음)
- [ ] URL에 `?returnUrl=/checkout` 파라미터 표시
- [ ] 로그인 후 `/checkout`으로 **자동 복귀**
- [ ] 결제 위젯 로딩 완료 (카드/계좌이체/간편결제 선택 UI)

#### ❌ 실패 시나리오

| 에러 | 증상 | 해결 |
|------|------|------|
| **무한 리다이렉트** | `/checkout` ↔ `/login` 반복 | RouteGuards의 `isAuthReady` 체크 누락 - 콘솔 로그 확인 |
| **Payment widget 에러** | "위젯을 불러올 수 없습니다" | Toss Payments SDK 로드 실패 - Network 탭에서 CDN 확인 |
| **장바구니 비어있음** | "장바구니가 비어있습니다" | 장바구니에 상품 추가 후 재시도 |
| **returnUrl 손실** | 로그인 후 `/`로 이동 | sessionStorage에 returnUrl 저장 여부 확인 |

---

### ✅ Scenario 4: Seller JWT 인증 (3분)
**목적**: Seller 로그인 (JWT 토큰) → Dashboard 데이터 로드 검증

#### 실행 단계
1. https://live.ur-team.com/seller/login 접속
2. 테스트 Seller 계정 입력:
   - **Email**: `seller@example.com`
   - **Password**: `seller1234`
3. [ ] **"Sign In"** 버튼 클릭
4. [ ] `/seller` 대시보드로 자동 리다이렉트
5. [ ] 통계 데이터 표시 확인 (총 매출, 주문 수, 스트림 수 등)
6. [ ] 스트림 목록 표시 확인
7. [ ] 상품 목록 표시 확인
8. [ ] 로그아웃 버튼 클릭 → `/seller/login`으로 리다이렉트

#### ✅ 예상 성공 로그
```javascript
[SellerLoginPage] ✅ JWT login success
[SellerLoginPage] seller_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
[SellerPage] ✅ Dashboard loaded
[SellerPage] Stats: {revenue: 1000000, orders: 25, streams: 5}
```

#### ✅ localStorage 확인
```javascript
localStorage.getItem('seller_token') // "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
localStorage.getItem('user_type')    // "seller"
```

#### ✅ Network 탭 확인
| API | Method | Status | Response |
|-----|--------|--------|----------|
| `/api/seller/login` | POST | 200 | `{token: "eyJ...", seller: {...}}` |
| `/api/seller/stats` | GET | 200 | `{revenue: 1000000, orders: 25}` |
| `/api/seller/streams` | GET | 200 | `[{id: 1, title: "..."}]` |

#### ❌ 실패 시나리오

| 에러 | 원인 | 해결 |
|------|------|------|
| `401 Unauthorized` | JWT 토큰 만료 (1시간 유효) | 재로그인 |
| `403 Forbidden` | 권한 없음 (일반 사용자 또는 Admin 계정) | Seller 계정으로 재시도 |
| 통계 로드 실패 | API 에러 또는 DB 연결 실패 | Network 탭 → `/api/seller/stats` 응답 확인 |

---

### ✅ Scenario 5: Admin 인증 (3분)
**목적**: Admin 로그인 → 관리자 전용 페이지 접근 검증 + 권한 체크

#### 실행 단계
1. https://live.ur-team.com/admin/login 접속
2. Admin 계정 로그인:
   - **Email**: `admin@ur-team.com`
   - **Password**: `admin1234`
3. [ ] `/admin` 대시보드 접근 확인
4. [ ] Admin 전용 메뉴 표시 확인 (사용자 관리, 배너 관리, 주문 관리 등)
5. **권한 테스트**: 로그아웃 → 일반 사용자 계정으로 재로그인
6. [ ] 주소창에 직접 입력: `https://live.ur-team.com/admin`
7. [ ] **자동으로 `/`로 리다이렉트 확인** (권한 없음)

#### ✅ 예상 성공 로그 (Admin 로그인)
```javascript
[AdminLoginPage] ✅ Admin login success
[useAuthKR] userRole: 'admin'
[RouteGuards] ✅ AdminRoute: Admin access granted
[AdminPage] ✅ Admin dashboard loaded
```

#### ✅ 예상 성공 로그 (일반 사용자 → /admin 접근)
```javascript
[RouteGuards] ❌ AdminRoute: Insufficient permissions (role: user) → /
```

#### ✅ Network 탭 확인
| API | Method | Status | Response |
|-----|--------|--------|----------|
| `/api/admin/login` | POST | 200 | `{token: "eyJ...", admin: {...}}` |
| `/api/users/role` | GET | 200 | `{role: "admin"}` |
| `/api/admin/users` | GET | 200 | `[{id: 1, email: "..."}]` |

---

### ✅ Scenario 6: Route Guards 전체 (5분)
**목적**: ProtectedRoute, PublicRoute, AdminRoute, SellerRoute 동작 검증

#### 테스트 케이스 (6개)

| # | 사용자 상태 | 접근 URL | 예상 결과 | 예상 로그 |
|---|------------|----------|-----------|----------|
| 1 | 로그아웃 | `/checkout` | → `/login?returnUrl=/checkout` | `[RouteGuards] ❌ ProtectedRoute: Not authenticated` |
| 2 | 로그인 (user) | `/login` | → `/` (홈) | `[RouteGuards] ✅ PublicRoute: Already authenticated` |
| 3 | 로그인 (user) | `/admin` | → `/` (권한 없음) | `[RouteGuards] ❌ AdminRoute: Insufficient permissions` |
| 4 | 로그인 (admin) | `/admin` | ✅ Admin 대시보드 표시 | `[RouteGuards] ✅ AdminRoute: Admin access granted` |
| 5 | 로그인 (seller) | `/seller` | ✅ Seller 대시보드 표시 | `[RouteGuards] ✅ SellerRoute: Seller access granted` |
| 6 | 로그인 (user) | `/seller` | → `/` (권한 없음) | `[RouteGuards] ❌ SellerRoute: Insufficient permissions` |

#### 실행 방법
각 케이스를 순서대로 실행하고 콘솔 로그 & 리다이렉트 확인:

**Case 1**: 
```javascript
// 1. 로그아웃
localStorage.clear()
window.location.href = 'https://live.ur-team.com/checkout'
// 예상: /login?returnUrl=/checkout로 리다이렉트
```

**Case 2**:
```javascript
// 1. 로그인 (Kakao 또는 Email)
// 2. 주소창에 입력: https://live.ur-team.com/login
// 예상: /로 자동 리다이렉트
```

**Case 3 ~ 6**: 위 테이블 참고하여 순차 실행

#### ✅ 성공 기준
- [ ] 모든 케이스에서 예상 결과와 일치
- [ ] 무한 리다이렉트 없음
- [ ] 콘솔에 예상 로그 출력
- [ ] returnUrl 파라미터 정상 동작

---

### ✅ Scenario 7: TopNav 상태 업데이트 (2분)
**목적**: 로그인/로그아웃 시 TopNav UI 즉시 업데이트 검증 (Zustand 구독)

#### 실행 단계
1. **로그아웃 상태** 확인 (`localStorage.clear()`)
2. TopNav 우측 상단 확인 → **로그인 아이콘** 표시
3. **User 아이콘** 클릭
4. [ ] `/login?returnUrl=/user/profile`로 리다이렉트 확인
5. Kakao 로그인 (또는 Email 로그인)
6. [ ] TopNav에 **사용자 아이콘** 즉시 표시 (≤500ms)
7. **User 아이콘** 클릭 → `/user/profile` 이동 (리다이렉트 없음, 직접 접근)
8. 프로필 페이지에서 **"로그아웃"** 버튼 클릭
9. [ ] TopNav 상태 즉시 업데이트 (로그인 아이콘으로 변경, ≤500ms)
10. [ ] `/`로 자동 리다이렉트

#### ✅ 예상 성공 로그
```javascript
// 로그아웃 상태
[TopNav] user: null → isLoggedIn: false

// 로그인 완료
[TopNav] user: {uid: 'abc123', email: 'test@example.com'} → isLoggedIn: true
[TopNav] ✅ User state updated

// 로그아웃
[TopNav] ✅ Logged out → user: null
[TopNav] user: null → isLoggedIn: false
```

#### ✅ UI 확인 항목
- [ ] 로그인 전: "로그인" 텍스트 또는 아이콘 표시
- [ ] 로그인 후: 사용자 프로필 아이콘 (또는 이름 첫 글자) 표시
- [ ] 로그아웃 후: 다시 "로그인" 텍스트로 변경
- [ ] 상태 변경 지연 시간 **≤500ms** (즉시 반영)

#### ❌ 실패 시나리오
- TopNav 업데이트 지연 (>1초) → Zustand selector 미사용 또는 재렌더 이슈
- 로그아웃 후에도 사용자 아이콘 유지 → localStorage 정리 누락
- 로그인 후 새로고침 필요 → `onAuthStateChanged` 구독 이슈

---

### ✅ Scenario 8: Product Detail 조건부 인증 (3분)
**목적**: 로그아웃 상태에서 상품 상세 페이지 접근 → 장바구니 추가 시 인증 요구 검증

#### 실행 단계
1. **로그아웃 상태** 확인 (`localStorage.clear()`)
2. https://live.ur-team.com/product/1 접속
3. [ ] 상품 상세 정보 정상 표시 (인증 불필요)
   - 상품 이미지
   - 상품명, 가격, 설명
   - 리뷰 (있는 경우)
4. **"장바구니 추가"** 버튼 클릭
5. [ ] 로그인 페이지로 리다이렉트 (`/login?returnUrl=/product/1`)
6. Kakao 로그인 (또는 Email 로그인)
7. [ ] `/product/1`로 자동 복귀
8. **"장바구니 추가"** 재클릭
9. [ ] 장바구니 추가 성공 메시지 표시 ("장바구니에 추가되었습니다")
10. [ ] TopNav 장바구니 아이콘 뱃지 업데이트 (예: 1 → 2)

#### ✅ 예상 성공 로그
```javascript
// 로그아웃 상태에서 페이지 로드
[ProductDetailPage] ✅ Page loaded (no auth required)
[ProductDetailPage] Product ID: 1, Price: 29900

// 장바구니 추가 클릭 (로그아웃 상태)
[ProductDetailPage] ❌ Not logged in → prompt login
[ProductDetailPage] 🎯 Redirecting to /login?returnUrl=/product/1

// 로그인 후 복귀
[ProductDetailPage] ✅ Logged in → add to cart enabled

// 장바구니 추가 재클릭
[ProductDetailPage] ✅ Cart updated: +1 item
[ProductDetailPage] ✅ Cart API response: {success: true, cart: [{...}]}
```

#### ✅ 예상 UI 변화
- [ ] 로그아웃 상태: 상품 정보 정상 표시
- [ ] "장바구니 추가" 클릭 → 로그인 페이지로 리다이렉트
- [ ] 로그인 후 상품 페이지로 복귀 (세션 유지)
- [ ] "장바구니 추가" 성공 → Toast 메시지 표시
- [ ] TopNav 장바구니 아이콘 뱃지 업데이트

---

## 📊 테스트 결과 기록 (Result Recording)

배포 후 아래 표를 작성하여 결과 기록:

| # | Scenario | Status | Error Code | Notes | Tested By | Date | Time |
|---|----------|--------|------------|-------|-----------|------|------|
| 1 | Kakao Login E2E | ⏳ | - | - | - | - | - |
| 2 | Email Register & Login | ⏳ | - | - | - | - | - |
| 3 | Checkout Auth Guard | ⏳ | - | - | - | - | - |
| 4 | Seller JWT Auth | ⏳ | - | - | - | - | - |
| 5 | Admin Auth | ⏳ | - | - | - | - | - |
| 6 | Route Guards (6 cases) | ⏳ | - | - | - | - | - |
| 7 | TopNav State Update | ⏳ | - | - | - | - | - |
| 8 | Product Detail Conditional Auth | ⏳ | - | - | - | - | - |

**범례 (Status)**:
- ⏳ **Pending** - 테스트 대기 중
- ✅ **Pass** - 정상 동작 확인
- ❌ **Fail** - 실패 (에러 발생)
- ⚠️ **Warning** - 경고 (동작하지만 이슈 있음)
- 🔄 **Retry** - 재시도 중

**범례 (Error Code)**:
- `KOE101` - Kakao OAuth 에러 (환경 변수 누락)
- `401` - Unauthorized (인증 실패)
- `403` - Forbidden (권한 없음)
- `500` - Server Error
- `auth/email-already-in-use` - Firebase 이메일 중복
- `auth/weak-password` - Firebase 비밀번호 약함

---

## 🔍 디버깅 도구 & 팁

### 1. 현재 인증 상태 확인 (Console)
```javascript
// localStorage 확인
console.log('User:', localStorage.getItem('user'))
console.log('Seller Token:', localStorage.getItem('seller_token'))
console.log('Firebase Token:', localStorage.getItem('firebase_token')?.substring(0, 20))
console.log('User Type:', localStorage.getItem('user_type'))

// Zustand Store 직접 확인 (개발 모드)
// import { useAuthKR } from '@/shared/stores/useAuthKR'
// useAuthKR.getState()
```

### 2. 강제 로그아웃
```javascript
localStorage.clear()
sessionStorage.clear()
window.location.reload()
```

### 3. Sentry 테스트 에러 발생 (Sentry 설정된 경우)
```javascript
window.Sentry?.captureException(new Error('프로덕션 테스트 에러'))
```

### 4. Network 탭 확인 (중요 API)

| API Endpoint | Method | Expected Status | Notes |
|--------------|--------|----------------|-------|
| `/api/auth/kakao/firebase` | POST | 200 | Kakao 토큰 → Firebase customToken 교환 |
| `/api/users/role` | GET | 200 | 사용자 권한 조회 (user/admin/seller) |
| `/api/seller/login` | POST | 200 | Seller JWT 발급 |
| `/api/admin/login` | POST | 200 | Admin JWT 발급 |
| `/api/cart` | GET | 200 | 장바구니 조회 |
| `/api/cart` | POST | 200 | 장바구니 추가 |
| `/api/shipping-addresses` | GET | 200 | 배송지 조회 |
| `/api/products` | GET | 200 | 상품 목록 조회 |

### 5. 콘솔 필터링 팁
```javascript
// 특정 태그만 보기
// Chrome DevTools Console → Filter: [LoginPage]
// Firefox DevTools Console → Filter: LoginPage

// Sentry 로그만 보기
// Filter: [Sentry]

// RouteGuards 로그만 보기
// Filter: [RouteGuards]
```

---

## ⚠️ 알려진 이슈 & 해결 방법 (Known Issues)

### Issue 1: Kakao 무한 루프 (Priority: HIGH)
**증상**: `/login` ↔ `/auth/kakao/sync/callback` 반복 리다이렉트

**원인**:
- `isAuthReady` 타이밍 이슈 (Firebase Auth 초기화 전에 리다이렉트)
- localStorage에 잘못된 토큰 저장
- 중복 OAuth 콜백 처리

**해결 방법**:
1. `localStorage.clear()` 실행
2. 시크릿 모드에서 재시도
3. 콘솔에서 `isAuthReady` 값 확인:
   ```javascript
   // useAuthKR.getState().isAuthReady
   // true여야 정상
   ```
4. 여전히 반복되면 → `KAKAO_LOGIN_KOE101_FIX.md` 문서 참고

---

### Issue 2: Payment Widget 초기화 실패 (Priority: MEDIUM)
**증상**: "결제 시스템을 불러올 수 없습니다" 에러 메시지

**원인**:
- Toss Payments SDK 로드 실패 (CDN 블로킹)
- `VITE_TOSS_CLIENT_KEY` 환경 변수 누락
- Widget 초기화 타이밍 이슈

**해결 방법**:
1. F12 → Console → 에러 메시지 확인
2. Network 탭에서 SDK CDN 로드 확인:
   ```
   https://js.tosspayments.com/v1/payment-widget
   ```
3. `window.PaymentWidget` 존재 여부 확인:
   ```javascript
   console.log(window.PaymentWidget)
   ```
4. 환경 변수 확인:
   ```javascript
   console.log(import.meta.env.VITE_TOSS_CLIENT_KEY)
   ```

---

### Issue 3: Seller JWT 401 Unauthorized (Priority: LOW)
**증상**: Seller 대시보드 데이터 로드 실패 (`401 Unauthorized`)

**원인**:
- JWT 토큰 만료 (기본 1시간 유효)
- localStorage에서 토큰 누락
- 서버 JWT secret 불일치

**해결 방법**:
1. localStorage에서 토큰 확인:
   ```javascript
   localStorage.getItem('seller_token')
   ```
2. JWT 만료 여부 확인 (jwt.io에서 디코딩)
3. 재로그인 후 재시도
4. 여전히 실패 시 → Worker 로그 확인 (Cloudflare Dashboard)

---

### Issue 4: returnUrl 손실 (Priority: MEDIUM)
**증상**: 로그인 후 홈(`/`)으로 이동, 원래 페이지로 돌아가지 않음

**원인**:
- sessionStorage에 returnUrl 저장 누락
- 페이지 새로고침 시 sessionStorage 초기화
- RouteGuards에서 returnUrl 파라미터 누락

**해결 방법**:
1. sessionStorage 확인:
   ```javascript
   sessionStorage.getItem('returnUrl')
   ```
2. URL에 `?returnUrl=/checkout` 파라미터 확인
3. LoginPage에서 returnUrl 저장 로직 확인:
   ```javascript
   const urlParam = searchParams.get('returnUrl')
   if (urlParam) {
     sessionStorage.setItem('returnUrl', urlParam)
   }
   ```

---

## 🎯 배포 성공 기준 (Success Criteria)

### Critical (필수 통과)
- [ ] 빌드 성공 (`npm run build` 0 errors)
- [ ] 배포 성공 (Cloudflare Pages → Success)
- [ ] 사이트 접근 가능 (`curl -I https://live.ur-team.com` → `HTTP/2 200`)
- [ ] **Kakao 로그인 성공률 ≥95%** (10회 시도 중 9회 이상 성공)
- [ ] **결제 위젯 초기화 ≥98%** (Toss Payments Widget 로드)
- [ ] **런타임 에러 <5건/일** (Sentry 대시보드, Critical만)

### High (중요)
- [ ] Email 로그인 & 회원가입 정상 동작
- [ ] Seller/Admin JWT 인증 정상
- [ ] RouteGuards 정상 동작 (6개 케이스 모두 통과)
- [ ] TopNav 상태 업데이트 **≤500ms**

### Medium (권장)
- [ ] 페이지 로드 시간 **<3초** (Chrome DevTools Performance)
- [ ] API 응답 시간 **<1초** (Network 탭)
- [ ] 가동시간 **≥99.9%** (Cloudflare Analytics)

### Low (추가 개선)
- [ ] 모바일 UX 최적화
- [ ] SEO 메타 태그 설정
- [ ] 접근성 (a11y) 체크

---

## 📝 다음 단계 (Next Steps)

### 1. 테스트 완료 후 (≈30분)
- [ ] 위 테스트 결과 표 작성 완료
- [ ] 모든 시나리오 **✅ Pass** 확인
- [ ] 실패한 시나리오가 있다면 → 에러 로그 기록 & Sentry 확인

### 2. 48시간 모니터링 (Day 1-2)
- [ ] `48H_MONITORING_GUIDE.md` 참고
- [ ] Sentry Dashboard 매일 2회 확인 (오전/오후)
- [ ] Cloudflare Analytics 확인 (방문자, 에러율)
- [ ] 에러율 **<0.1%** 유지 (≤5건/일)

### 3. 에러 발생 시 대응 (Real-time)
- [ ] `ERROR_RESPONSE_FLOW.md` 참고
- [ ] Critical 에러 → 즉시 수정 & 핫픽스
- [ ] Medium/Low 에러 → 백로그 등록 & 다음 스프린트

### 4. 성공 후 작업 (Day 3+)
- [ ] 프로덕션 검증 완료 보고서 작성
- [ ] 글로벌 버전 준비 (6-12개월 후)
- [ ] 성능 최적화 (번들 사이즈 축소, lazy loading)
- [ ] SEO & 접근성 개선

---

## 📚 참고 문서 (Reference Docs)

| 문서 | 파일명 | 크기 | 용도 |
|------|--------|------|------|
| **프로덕션 검증 가이드** | `PRODUCTION_VALIDATION_GUIDE.md` | 9.4 KB | 8개 시나리오 상세 설명 |
| **빠른 시작 가이드** | `WHAT_TO_DO_NOW.md` | 2 KB | 배포 직후 해야 할 일 |
| **Sentry 배포 가이드** | `SENTRY_DEPLOYMENT_STEPS.md` | 5 KB | Sentry 환경 변수 설정 |
| **Cloudflare 환경 설정** | `CLOUDFLARE_ENV_MANUAL_SETUP.md` | 6.8 KB | 환경 변수 수동 설정 |
| **48시간 모니터링** | `48H_MONITORING_GUIDE.md` | - | 모니터링 체크리스트 |
| **에러 대응 플로우** | `ERROR_RESPONSE_FLOW.md` | - | 에러 분류 & 대응 방법 |
| **전체 프로젝트 현황** | `COMPLETE_PROJECT_STATUS_AND_ROADMAP.md` | 10 KB | 현재 상태 & 로드맵 |
| **Region 혼동 해결** | `REGION_CONFUSION_SOLVED.md` | - | KR/Global 빌드 전략 |

---

## 🔗 중요 링크 (Important Links)

| 항목 | URL |
|------|-----|
| **Production Site** | https://live.ur-team.com |
| **GitHub Repo** | https://github.com/tobe2111/ur-live |
| **Cloudflare Dashboard** | https://dash.cloudflare.com |
| **Sentry Dashboard** | https://o4510992097935360.sentry.io/ |
| **Toss Payments** | https://docs.tosspayments.com/ |
| **Kakao Developers** | https://developers.kakao.com/ |
| **Firebase Console** | https://console.firebase.google.com/ |

---

## ✅ 체크리스트 요약 (Quick Checklist)

### 배포 전
- [ ] 환경 변수 설정 완료 (Cloudflare Pages)
- [ ] `npm run build` 성공 (0 errors)
- [ ] Git 커밋 완료
- [ ] 테스트 계정 준비 완료

### 테스트 중
- [ ] 시크릿 모드 사용
- [ ] Console 로그 기록
- [ ] Network 탭 모니터링
- [ ] 각 시나리오 실행 & 결과 기록

### 배포 후
- [ ] 8개 시나리오 모두 ✅ Pass
- [ ] Sentry 대시보드 확인
- [ ] 48시간 모니터링 시작
- [ ] 에러 발생 시 즉시 대응

---

**작성일**: 2026-03-05  
**버전**: v1.0  
**작성자**: UR Live Development Team  
**최종 수정**: 2026-03-05 14:30 KST
