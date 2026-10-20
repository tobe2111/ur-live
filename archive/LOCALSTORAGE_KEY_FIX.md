# localStorage 키 불일치 문제 수정 완료

## 🐛 발생한 문제

### 증상
- 라이브 페이지에서 로그인 후에도 "결제" 버튼 클릭 시 "로그인이 필요합니다" 팝업 발생
- 장바구니 페이지로 이동되지 않음
- 실제로는 로그인이 되어 있는 상태인데 인증 체크 실패

### 보고된 상황
> "로그인 자체는 이제 문제가 없는데 라이브 페이지에서 결제 버튼 누르면 왜 로그인 해라는 팝업이 뜨면서 cart 페이지로 제대로 이동이 안되는거지?"

## 🔍 원인 분석

### localStorage 키 불일치

여러 페이지에서 **서로 다른 localStorage 키**를 사용하고 있었습니다:

| 페이지 | 사용한 키 | 상태 |
|--------|-----------|------|
| **LivePage** | `user_id` | ✅ 정상 |
| **CartPage** | `user_id` | ✅ 정상 |
| **CheckoutPage** | `userId` | ❌ 불일치 |
| **PaymentSuccessPage** | `userId` | ❌ 불일치 |
| **MyOrdersPage** | `userId` | ❌ 불일치 |

### 문제 발생 흐름

```
1. 카카오 로그인 성공
   ↓
2. LivePage에서 localStorage.setItem('user_id', userId) 저장
   ↓
3. 사용자가 "결제" 버튼 클릭
   ↓
4. CheckoutPage로 이동
   ↓
5. CheckoutPage에서 localStorage.getItem('userId') 확인 ❌
   ↓
6. userId가 null이므로 "로그인이 필요합니다" 표시
   ↓
7. 로그인 페이지로 리디렉트
```

### 코드 분석

#### LivePage (정상)
```typescript
// LivePage.tsx:130
localStorage.setItem('user_id', userId || '')

// LivePage.tsx:150
const userId = localStorage.getItem('user_id')
```

#### CheckoutPage (문제)
```typescript
// CheckoutPage.tsx:80 (수정 전)
const uid = localStorage.getItem('userId')  // ❌ 잘못된 키!

if (!uid) {
  requireLogin(navigate, '결제하려면 로그인이 필요합니다.')
  return
}
```

#### PaymentSuccessPage (문제)
```typescript
// PaymentSuccessPage.tsx:42 (수정 전)
const userId = localStorage.getItem('userId')  // ❌ 잘못된 키!
```

#### MyOrdersPage (문제)
```typescript
// MyOrdersPage.tsx:87 (수정 전)
const userId = localStorage.getItem('userId')  // ❌ 잘못된 키!
```

## ✅ 해결 방법

### 1. CheckoutPage 수정

```typescript
// ✅ 수정 후
const uid = localStorage.getItem('user_id')  // 'userId' → 'user_id'

if (!uid) {
  requireLogin(navigate, '결제하려면 로그인이 필요합니다.')
  return
}
```

### 2. PaymentSuccessPage 수정

```typescript
// ✅ 수정 후
const userId = localStorage.getItem('user_id')  // 'userId' → 'user_id'
if (userId) {
  await axios.delete(`/api/cart/${userId}`)
}
```

### 3. MyOrdersPage 수정

```typescript
// ✅ 수정 후
const userId = localStorage.getItem('user_id')  // 'userId' → 'user_id'
const userName = localStorage.getItem('user_name') || '게스트'  // 'userName' → 'user_name'
```

## 📝 표준화된 localStorage 키 규칙

앞으로 **모든 페이지**에서 다음 키를 사용합니다:

| 데이터 | localStorage 키 | 예시 값 |
|--------|-----------------|---------|
| 사용자 ID | `user_id` | `"12345"` |
| 사용자 이름 | `user_name` | `"홍길동"` |
| 세션 토큰 | `session` | `"eyJhbGc..."` |
| 액세스 토큰 | `access_token` | `"ya29.a0A..."` |
| 장바구니 상태 | `hasCartItems` | `"true"` |

## 🔄 수정된 파일

### 1. src/pages/CheckoutPage.tsx

**변경 전:**
```typescript
useEffect(() => {
  const uid = localStorage.getItem('userId')  // ❌
  if (!uid) {
    requireLogin(navigate, '결제하려면 로그인이 필요합니다.')
    return
  }
  setUserId(uid)
  loadCart(uid)
  loadAddresses(uid)
}, [])
```

**변경 후:**
```typescript
useEffect(() => {
  const uid = localStorage.getItem('user_id')  // ✅
  if (!uid) {
    requireLogin(navigate, '결제하려면 로그인이 필요합니다.')
    return
  }
  setUserId(uid)
  loadCart(uid)
  loadAddresses(uid)
}, [])
```

### 2. src/pages/PaymentSuccessPage.tsx

**변경 전:**
```typescript
// 주문 완료 후 장바구니 비우기
const userId = localStorage.getItem('userId')  // ❌
if (userId) {
  await axios.delete(`/api/cart/${userId}`)
}
```

**변경 후:**
```typescript
// 주문 완료 후 장바구니 비우기
const userId = localStorage.getItem('user_id')  // ✅
if (userId) {
  await axios.delete(`/api/cart/${userId}`)
}
```

### 3. src/pages/MyOrdersPage.tsx

**변경 전:**
```typescript
// Check login status
const userId = localStorage.getItem('userId')  // ❌
const userName = localStorage.getItem('userName') || '게스트'  // ❌
const userEmail = localStorage.getItem('userEmail') || ''
```

**변경 후:**
```typescript
// Check login status
const userId = localStorage.getItem('user_id')  // ✅
const userName = localStorage.getItem('user_name') || '게스트'  // ✅
const userEmail = localStorage.getItem('userEmail') || ''
```

## 🚀 배포 정보

### Preview URL
```
https://a3e01b6b.toss-live-commerce.pages.dev
```

### Production URL
```
https://live.ur-team.com
```

### Git Commit
```
fix: Standardize localStorage key for userId across all pages
Commit: 05195d6
```

## 🧪 테스트 시나리오

### 1. 라이브 페이지 → 장바구니 → 결제 플로우

```
1. https://live.ur-team.com/live/1 접속
2. 카카오 로그인 (또는 이미 로그인된 상태)
3. 상품 "장바구니에 담기" 클릭
4. ✅ 장바구니에 정상 추가
5. "결제" 버튼 클릭
6. ✅ /cart 페이지로 정상 이동 (로그인 팝업 없음!)
7. "주문하기" 버튼 클릭
8. ✅ /checkout 페이지로 정상 이동
```

### 2. 로그인 상태 확인 (개발자 도구)

```javascript
// 콘솔에서 확인
console.log('user_id:', localStorage.getItem('user_id'))
console.log('user_name:', localStorage.getItem('user_name'))
console.log('session:', localStorage.getItem('session'))

// 예상 출력
// user_id: "12345"
// user_name: "홍길동"
// session: "eyJhbGc..."
```

### 3. 결제 플로우 전체 테스트

```
1. 로그인
2. 라이브 시청
3. 상품 장바구니 담기
4. 결제 버튼 클릭 → ✅ /cart로 이동
5. 주문하기 → ✅ /checkout로 이동
6. 결제 수단 선택
7. 결제하기 → ✅ 토스페이먼츠 결제 창
8. 결제 완료 → ✅ /payment/success
9. ✅ 장바구니 자동 비워짐
```

## 📊 Before / After

### Before (문제 상황)

```
라이브 페이지 (로그인됨)
  ↓ 장바구니 담기 ✅
  ↓ 결제 버튼 클릭
  ↓
❌ "로그인이 필요합니다" 팝업
  ↓
/login 페이지로 리디렉트
```

### After (수정 후)

```
라이브 페이지 (로그인됨)
  ↓ 장바구니 담기 ✅
  ↓ 결제 버튼 클릭
  ↓
✅ /cart 페이지로 정상 이동
  ↓ 주문하기
  ↓
✅ /checkout 페이지로 정상 이동
  ↓ 결제하기
  ↓
✅ 결제 완료
```

## 🎯 핵심 개선사항

### 1. localStorage 키 표준화
- 모든 페이지에서 `user_id` 사용
- 일관성 있는 키 네이밍 규칙 확립

### 2. 로그인 상태 체크 개선
- CheckoutPage: `user_id` 키로 정확한 로그인 확인
- PaymentSuccessPage: `user_id` 키로 장바구니 정리
- MyOrdersPage: `user_id` 키로 주문 목록 조회

### 3. 사용자 경험 개선
- 로그인 후 결제 플로우가 끊기지 않음
- 불필요한 로그인 팝업 제거
- 원활한 장바구니 → 결제 전환

## 📚 참고: localStorage 키 목록

### 인증 관련
```typescript
localStorage.setItem('user_id', userId)           // 사용자 ID
localStorage.setItem('user_name', userName)       // 사용자 이름
localStorage.setItem('session', sessionToken)     // 세션 토큰
localStorage.setItem('access_token', token)       // 액세스 토큰
```

### 장바구니 관련
```typescript
localStorage.setItem('hasCartItems', 'true')      // 장바구니 상태
localStorage.setItem('tempCartItem', JSON.stringify(item))  // 임시 장바구니
```

### 기타
```typescript
localStorage.setItem('loginReturnUrl', url)       // 로그인 후 복귀 URL
```

## ✅ 결과 요약

**문제:**
- ❌ 라이브 페이지에서 결제 버튼 클릭 시 로그인 팝업 발생
- ❌ localStorage 키 불일치로 인한 인증 실패
- ❌ 장바구니/결제 페이지 접근 차단

**해결:**
- ✅ 모든 페이지에서 `user_id` 키로 표준화
- ✅ CheckoutPage, PaymentSuccessPage, MyOrdersPage 수정
- ✅ 로그인 → 장바구니 → 결제 플로우 정상 작동

**🎉 이제 라이브 페이지에서 결제까지 끊김 없이 진행할 수 있습니다!**

## 🔧 향후 개선사항

### 1. TypeScript 타입 정의
```typescript
// src/types/storage.ts
export const StorageKeys = {
  USER_ID: 'user_id',
  USER_NAME: 'user_name',
  SESSION: 'session',
  ACCESS_TOKEN: 'access_token',
  HAS_CART_ITEMS: 'hasCartItems',
  TEMP_CART_ITEM: 'tempCartItem',
  LOGIN_RETURN_URL: 'loginReturnUrl'
} as const

// 사용 예시
localStorage.getItem(StorageKeys.USER_ID)
```

### 2. 유틸리티 함수
```typescript
// src/utils/storage.ts
export const storage = {
  getUserId: () => localStorage.getItem('user_id'),
  setUserId: (id: string) => localStorage.setItem('user_id', id),
  clearAuth: () => {
    localStorage.removeItem('user_id')
    localStorage.removeItem('user_name')
    localStorage.removeItem('session')
    localStorage.removeItem('access_token')
  }
}
```

## 📞 추가 지원

문제가 지속되면:
- 고객센터: 0507-0177-0432
- 이메일: jiwon@ur-team.com
- 운영시간: 평일 09:00 - 18:00
