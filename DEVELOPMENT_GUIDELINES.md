# 🔐 Toss Live Commerce - 개발 가이드라인

## 📋 목차
1. [인증 시스템](#인증-시스템)
2. [localStorage 사용 규칙](#localstorage-사용-규칙)
3. [결제 시스템](#결제-시스템)
4. [코드 작성 원칙](#코드-작성-원칙)
5. [테스트 체크리스트](#테스트-체크리스트)

---

## 🔐 인증 시스템

### 필수 규칙
**❌ 절대 금지**: 직접 `localStorage.getItem('user_id')` 사용  
**✅ 필수 사용**: `src/utils/auth.ts`의 중앙화된 함수만 사용

### 표준 인증 API

```typescript
import { 
  isLoggedIn, 
  getUserId, 
  getUserName, 
  getUserEmail,
  saveUserInfo,
  requireLogin,
  logout 
} from '@/utils/auth'

// ✅ 올바른 사용법
const userId = getUserId()
const userName = getUserName()
if (!isLoggedIn()) {
  requireLogin(navigate, '로그인이 필요합니다.')
  return
}

// ❌ 잘못된 사용법 - 절대 사용 금지!
const userId = localStorage.getItem('user_id')
const userId = localStorage.getItem('userId')
```

### localStorage 표준 키 (읽기 전용 - 직접 사용 금지)

```typescript
// 표준 키 (auth.ts에서만 사용)
const STORAGE_KEYS = {
  SESSION: 'session',           // ✅ 세션 토큰
  USER_ID: 'user_id',          // ✅ 사용자 ID
  USER_NAME: 'user_name',      // ✅ 사용자 이름
  USER_EMAIL: 'user_email',    // ✅ 사용자 이메일
  USER_PROFILE_IMAGE: 'user_profile_image' // ✅ 프로필 이미지
}

// ❌ 레거시 키 - 절대 사용 금지!
// 'userId', 'userName', 'userEmail', 'accessToken', 'access_token'
```

### 로그인 체크 패턴

```typescript
// ✅ 권장 패턴 1: 컴포넌트 진입 시
useEffect(() => {
  if (!isLoggedIn()) {
    requireLogin(navigate, '이 페이지는 로그인이 필요합니다.')
    return
  }
  loadData()
}, [navigate])

// ✅ 권장 패턴 2: 함수 실행 시
const handleCheckout = async () => {
  const userId = getUserId()
  if (!userId) {
    requireLogin(navigate, '결제하려면 로그인이 필요합니다.')
    return
  }
  // 결제 로직...
}
```

### 로그인 정보 저장 패턴

```typescript
// ✅ 올바른 저장 방법
import { saveUserInfo } from '@/utils/auth'

// Kakao 로그인 성공 후
saveUserInfo(
  user.id,           // userId
  user.name,         // userName
  session_token,     // sessionToken
  user.email,        // userEmail (optional)
  user.profile_image // profileImage (optional)
)

// ❌ 잘못된 방법 - 절대 사용 금지!
localStorage.setItem('user_id', userId)
localStorage.setItem('userId', userId)
```

---

## 💳 결제 시스템

### Toss Payments 통합

#### 환경 변수
```bash
# 프론트엔드 (.env)
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN

# 백엔드 (Cloudflare Secret)
TOSS_SECRET_KEY=test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY
```

#### 결제 흐름
1. **CheckoutPage** (`/checkout`)
   - 결제 위젯 로드
   - 배송지 필수 확인
   - 총 금액 계산 (상품 + 배송비 3000원)

2. **PaymentSuccessPage** (`/payment/success`)
   - URL 파라미터: `orderId`, `amount`, `paymentKey`
   - 백엔드 승인 API 호출: `POST /api/payments/confirm`
   - 장바구니 비우기
   - 주문 내역으로 이동

3. **PaymentFailPage** (`/payment/fail`)
   - URL 파라미터: `code`, `message`, `orderId`
   - 에러 메시지 표시
   - 재시도 옵션 제공

#### 백엔드 결제 API
```typescript
// POST /api/payments/confirm
{
  orderId: string,
  amount: number,
  paymentKey: string
}
```

---

## 📝 코드 작성 원칙

### 1. 새로운 페이지 추가 시

```typescript
// ✅ 필수 체크리스트
import { isLoggedIn, getUserId, requireLogin } from '@/utils/auth'

const NewPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    // 1. 로그인 체크 (필요한 경우)
    if (!isLoggedIn()) {
      requireLogin(navigate, '로그인이 필요합니다.')
      return
    }
    
    // 2. 데이터 로드
    loadData()
  }, [navigate])
  
  const loadData = async () => {
    const userId = getUserId() // ✅ auth 유틸리티 사용
    // API 호출...
  }
}
```

### 2. API 호출 시

```typescript
// ✅ 권장 패턴
const response = await axios.get(`/api/endpoint/${getUserId()}`)

// ❌ 금지 패턴
const userId = localStorage.getItem('user_id')
const response = await axios.get(`/api/endpoint/${userId}`)
```

### 3. 에러 처리

```typescript
try {
  // API 호출
} catch (error) {
  console.error('Error:', error)
  const message = error.response?.data?.error || '오류가 발생했습니다.'
  alert(message)
}
```

---

## 🧪 테스트 체크리스트

### 배포 전 필수 테스트

#### 1. 인증 플로우
- [ ] 로그아웃 상태에서 보호된 페이지 접근 → 로그인 페이지로 리다이렉트
- [ ] Kakao 로그인 → 메인 페이지로 리다이렉트
- [ ] 로그인 후 원래 페이지로 복귀 (`loginReturnUrl`)
- [ ] 로그아웃 → 모든 localStorage 키 삭제 확인

#### 2. 장바구니 플로우
- [ ] 라이브 페이지 → 장바구니 담기 → /cart 이동
- [ ] 로그아웃 상태에서 장바구니 담기 → 로그인 → 자동 장바구니 담기
- [ ] 장바구니 수량 변경
- [ ] 장바구니 아이템 삭제

#### 3. 결제 플로우
- [ ] 장바구니 → 주문하기 → /checkout
- [ ] 배송지 선택/추가
- [ ] 결제 금액 계산 (상품 + 배송비)
- [ ] 결제 진행 → /payment/success
- [ ] 결제 승인 API 호출
- [ ] 장바구니 비우기
- [ ] 결제 실패 → /payment/fail

#### 4. localStorage 검증
```javascript
// 브라우저 콘솔에서 실행
Object.keys(localStorage).forEach(key => {
  console.log(key, localStorage.getItem(key))
})

// ✅ 예상 결과 (로그인 후)
// session: "xxx"
// user_id: "123"
// user_name: "홍길동"
// user_email: "hong@example.com"
// hasCartItems: "true"

// ❌ 있으면 안 되는 키들
// userId, userName, userEmail, accessToken, access_token
```

---

## 🚨 자주 하는 실수

### 1. localStorage 직접 접근
```typescript
// ❌ 잘못된 예
const userId = localStorage.getItem('user_id')
const userId = localStorage.getItem('userId')

// ✅ 올바른 예
import { getUserId } from '@/utils/auth'
const userId = getUserId()
```

### 2. 로그인 체크 누락
```typescript
// ❌ 잘못된 예
const MyPage = () => {
  useEffect(() => {
    loadUserData() // 로그인 체크 없이 바로 호출
  }, [])
}

// ✅ 올바른 예
const MyPage = () => {
  const navigate = useNavigate()
  
  useEffect(() => {
    if (!isLoggedIn()) {
      requireLogin(navigate)
      return
    }
    loadUserData()
  }, [navigate])
}
```

### 3. 에러 처리 누락
```typescript
// ❌ 잘못된 예
const response = await axios.get('/api/cart')
setCartItems(response.data.data)

// ✅ 올바른 예
try {
  const response = await axios.get('/api/cart')
  setCartItems(response.data.data || [])
} catch (error) {
  console.error('Cart load error:', error)
  alert('장바구니를 불러오는데 실패했습니다.')
}
```

---

## 📚 주요 파일 참고

### 인증 관련
- `src/utils/auth.ts` - **핵심 인증 유틸리티**
- `src/pages/KakaoCallbackPage.tsx` - Kakao 로그인 콜백 처리
- `src/pages/LoginPage.tsx` - 로그인 페이지

### 결제 관련
- `src/pages/CheckoutPage.tsx` - 결제 페이지
- `src/pages/PaymentSuccessPage.tsx` - 결제 성공 페이지
- `src/pages/PaymentFailPage.tsx` - 결제 실패 페이지
- `src/index.tsx` - 백엔드 결제 API (`/api/payments/confirm`)

### 장바구니 관련
- `src/pages/CartPage.tsx` - 장바구니 페이지
- `src/pages/LivePage.tsx` - 라이브 페이지 (장바구니 담기)

---

## 🎯 핵심 원칙 요약

1. **인증은 반드시 `auth.ts` 사용**
2. **localStorage는 직접 접근 금지**
3. **모든 보호된 페이지는 로그인 체크 필수**
4. **에러 처리는 사용자 친화적으로**
5. **배포 전 테스트 체크리스트 완료**

---

## 📞 문제 발생 시

1. `AUTH_SYSTEM_CENTRALIZATION_COMPLETE.md` 문서 확인
2. `LOCALSTORAGE_KEY_FIX.md` 문서 확인
3. `CHECKOUT_ERROR_FIX.md` 문서 확인
4. `TOSSPAYMENTS_IMPLEMENTATION_COMPLETE.md` 문서 확인

---

**마지막 업데이트**: 2026-02-11  
**작성자**: AI Assistant  
**프로젝트**: Toss Live Commerce
