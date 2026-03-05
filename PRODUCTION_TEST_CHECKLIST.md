# 프로덕션 테스트 체크리스트

## ✅ Test Scenarios (8 Core + 5 Edge Cases)

### 🔥 **Critical Tests (반드시 통과해야 함)**

#### **1. Kakao 로그인 플로우** 🔴
- [ ] `/login` 페이지 로드 정상 (3초 이내)
- [ ] "카카오로 시작하기" 버튼 클릭
- [ ] Kakao 인증 페이지로 리다이렉트
- [ ] 인증 후 `/auth/kakao/sync/callback` 도착
- [ ] Firebase 커스텀 토큰 교환 성공
- [ ] `localStorage.user` 저장 확인
- [ ] UserProfile 페이지로 자동 이동 (또는 returnUrl)
- [ ] TopNav에 사용자 아이콘 표시
- [ ] 로그아웃 → 다시 로그인 정상

**예상 정상 결과**:
```javascript
// Console 로그 확인
[LoginPage] ✅ Kakao OAuth redirect
[KakaoCallback] ✅ Code received: abc123
[KakaoCallback] ✅ Firebase token exchange success
[useAuthKR] ✅ User logged in: uid=xyz
[TopNav] ✅ User state updated
```

**실패 시나리오 체크**:
- [ ] 무한 루프 발생하지 않음
- [ ] KOE101 에러 발생하지 않음
- [ ] 브라우저 콘솔에 에러 없음

---

#### **2. Email 회원가입 플로우** 🔴
- [ ] `/register` 페이지 로드
- [ ] 이름, 이메일, 비밀번호 입력
- [ ] 약관 동의 체크
- [ ] "가입하기" 버튼 클릭
- [ ] Firebase 계정 생성 성공
- [ ] `/api/users/init` 호출 성공 (user_role='user')
- [ ] 성공 메시지 표시
- [ ] `/login` 페이지로 이동
- [ ] 생성한 계정으로 로그인 가능

**예상 정상 결과**:
```javascript
[RegisterPage] ✅ Firebase user created: uid=abc123
[RegisterPage] ✅ User profile initialized
[RegisterPage] ✅ Navigate to /login
```

**에러 케이스**:
- [ ] 중복 이메일 에러 메시지 정상 표시
- [ ] 비밀번호 8자 미만 에러 표시
- [ ] 약관 미동의 시 가입 차단

---

#### **3. Checkout 인증 가드** 🔴
- [ ] 로그아웃 상태에서 `/checkout` 접근
- [ ] 자동으로 `/login?returnUrl=/checkout`로 리다이렉트
- [ ] 로그인 후 `/checkout`으로 복귀
- [ ] 장바구니 데이터 로드 성공
- [ ] Toss Payment Widget 초기화 성공
- [ ] 주소 입력 및 결제 진행 가능

**예상 정상 결과**:
```javascript
[ProtectedRoute] ❌ Not authenticated → /login redirect
[LoginPage] ✅ returnUrl saved: /checkout
[CheckoutPage] ✅ User authenticated, loading cart
[CheckoutPage] ✅ Payment widget initialized
```

**실패 시나리오**:
- [ ] 무한 리다이렉트 발생하지 않음
- [ ] Payment widget 초기화 전에 에러 없음

---

#### **4. Seller JWT 인증** 🔴
- [ ] `/seller/login` 페이지 접근
- [ ] Email/Password 입력
- [ ] "Sign In" 클릭
- [ ] `/api/seller/login` 호출 성공
- [ ] `localStorage.seller_token` 저장 확인
- [ ] `/seller` 대시보드로 이동
- [ ] 통계, 스트림, 상품 데이터 로드 성공
- [ ] 로그아웃 → JWT 토큰 삭제 확인

**예상 정상 결과**:
```javascript
[SellerLoginPage] ✅ JWT login success
[SellerLoginPage] seller_token: eyJ...
[SellerPage] ✅ Dashboard loaded
[SellerPage] Stats: {revenue: 1000, orders: 5}
```

**중요**: Firebase 인증이 아닌 **JWT 토큰** 사용

---

#### **5. Admin 인증** 🔴
- [ ] `/admin/login` 접근
- [ ] Admin 계정으로 로그인
- [ ] `userRole='admin'` 확인
- [ ] `/admin` 대시보드 접근 성공
- [ ] Admin 전용 메뉴 표시
- [ ] 일반 사용자로 로그인 시 `/admin` 차단됨

**예상 정상 결과**:
```javascript
[AdminLoginPage] ✅ Admin login success
[useAuthKR] userRole: 'admin'
[ProtectedRoute] ✅ Admin access granted
```

---

#### **6. Route Guards** 🟡
- [ ] `ProtectedRoute`: 미인증 시 `/login` 리다이렉트
- [ ] `PublicRoute`: 인증 시 `/` 리다이렉트
- [ ] `requireAdmin`: admin이 아니면 `/` 리다이렉트
- [ ] `requireSeller`: seller가 아니면 `/` 리다이렉트
- [ ] 로딩 중에는 spinner 표시 (리다이렉트 안 됨)

**테스트 케이스**:
```
1. 로그아웃 → /checkout 접근 → /login 리다이렉트 ✅
2. 로그인 → /login 접근 → / 리다이렉트 ✅
3. user → /admin 접근 → / 리다이렉트 ✅
4. seller → /seller 접근 → 대시보드 표시 ✅
```

---

#### **7. TopNav 상태 업데이트** 🟡
- [ ] 로그인 전: User 아이콘 클릭 → `/login?returnUrl=/user/profile`
- [ ] 로그인 후: User 아이콘 클릭 → `/user/profile`
- [ ] 로그아웃 후: TopNav 상태 즉시 업데이트
- [ ] Notification 클릭 시 인증 체크 정상

**예상 정상 결과**:
```javascript
[TopNav] user: null → isLoggedIn: false
[TopNav] user: {uid: 'abc'} → isLoggedIn: true
```

---

#### **8. Product Detail 조건부 인증** 🟢
- [ ] 로그아웃 상태에서 상품 상세 페이지 접근 가능
- [ ] "장바구니 추가" 클릭 시:
  - 로그인 안 됨 → `/login?returnUrl=/product/123` 리다이렉트
  - 로그인 됨 → 장바구니 추가 성공

**예상 정상 결과**:
```javascript
[ProductDetailPage] ✅ Page loaded (no auth required)
[ProductDetailPage] ❌ Not logged in → prompt login
[ProductDetailPage] ✅ Logged in → add to cart
```

---

### 🔍 **Edge Case Tests (예외 상황)**

#### **9. Kakao 토큰 만료**
- [ ] 7일 후 다시 로그인 시도
- [ ] 자동으로 새 토큰 발급
- [ ] 기존 사용자 데이터 유지

#### **10. 동시 로그인 (다른 브라우저)**
- [ ] Chrome에서 로그인
- [ ] Safari에서 같은 계정 로그인
- [ ] 둘 다 정상 동작 (충돌 없음)

#### **11. Network 오류**
- [ ] 인터넷 끊긴 상태에서 로그인 시도
- [ ] 명확한 에러 메시지 표시
- [ ] 재연결 후 재시도 가능

#### **12. JWT 토큰 만료 (Seller)**
- [ ] 1시간 후 `/seller` 접근
- [ ] 자동으로 `/seller/login` 리다이렉트
- [ ] 재로그인 후 복귀

#### **13. 브라우저 뒤로가기**
- [ ] 로그인 → 뒤로가기 → 다시 앞으로
- [ ] 상태 유지, 에러 없음

---

## 📊 **테스트 결과 기록 템플릿**

| Test | Status | Error | Notes |
|------|--------|-------|-------|
| 1. Kakao Login | ⏳ | - | - |
| 2. Email Register | ⏳ | - | - |
| 3. Checkout Guard | ⏳ | - | - |
| 4. Seller JWT | ⏳ | - | - |
| 5. Admin Auth | ⏳ | - | - |
| 6. Route Guards | ⏳ | - | - |
| 7. TopNav Update | ⏳ | - | - |
| 8. Product Detail | ⏳ | - | - |

**범례**:
- ⏳ Pending
- ✅ Pass
- ❌ Fail
- ⚠️ Warning

---

## 🔧 **테스트 도구**

### **Chrome DevTools**
```javascript
// Console에서 현재 auth 상태 확인
window.localStorage.getItem('user')
window.localStorage.getItem('seller_token')
window.localStorage.getItem('kakao_token')

// Zustand store 직접 확인 (개발 모드)
// useAuthKR.getState()
// useAuthWorld.getState()
```

### **Network Tab**
- `/api/auth/kakao/firebase` 호출 확인
- `/api/users/role` 호출 확인
- `/api/seller/login` JWT 응답 확인

### **Performance Tab**
- 페이지 로드 시간 측정
- Re-render 횟수 확인 (React DevTools Profiler)

---

## ⚡ **빠른 체크 스크립트**

배포 후 바로 실행:

```bash
# 1. Login 페이지 응답 시간
curl -w "@curl-format.txt" -o /dev/null -s https://live.ur-team.com/login

# 2. API health check
curl https://live.ur-team.com/api/health

# 3. Kakao debug 페이지
curl https://live.ur-team.com/debug/kakao
```

---

**다음 단계**: Sentry 설정으로 자동 에러 추적 🎯
