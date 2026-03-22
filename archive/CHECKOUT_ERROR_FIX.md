# CheckoutPage 결제 위젯 오류 수정 완료

## 🐛 발생한 문제

### 증상
- 장바구니 페이지에서 "주문하기" 버튼 클릭 시
- CheckoutPage 로딩 중 "앗! 오류가 발생했습니다" 에러 메시지 표시
- 결제 페이지가 정상적으로 로드되지 않음

### 스크린샷
![에러 화면](https://www.genspark.ai/api/files/s/IDsyglnv)

## 🔍 원인 분석

### 1. 변수 선언 순서 문제
```typescript
// ❌ 문제 코드
useEffect(() => {
  // ...
  const paymentMethodWidget = paymentWidget.renderPaymentMethods(
    '#payment-widget',
    { value: totalAmount },  // ← totalAmount가 아직 정의되지 않음!
    { variantKey: 'DEFAULT' }
  )
}, [userId, cartItems, totalAmount])

// totalAmount는 나중에 정의됨
const subtotal = cartItems.reduce(...)
const totalAmount = subtotal + SHIPPING_FEE
```

**문제:**
- `useEffect` 내부에서 `totalAmount`를 참조하지만
- `totalAmount`는 코드 아래쪽에서 계산됨
- JavaScript의 hoisting으로 인해 `undefined` 참조 발생

### 2. clientKey 검증 부족
```typescript
// ❌ 문제 코드
const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY || ''
const paymentWidget = await loadPaymentWidget(clientKey, customerKey)
```

**문제:**
- `clientKey`가 빈 문자열일 때 에러 처리 없음
- 토스페이먼츠 SDK 로딩 실패 시 적절한 에러 메시지 없음

### 3. 에러 처리 미흡
```typescript
// ❌ 문제 코드
catch (error) {
  console.error('결제 위젯 초기화 실패:', error)
  // 사용자에게 에러 표시 안 함!
}
```

**문제:**
- 콘솔에만 에러 출력
- 사용자에게 에러 메시지 표시 안 됨

## ✅ 해결 방법

### 1. totalAmount 계산 순서 변경

```typescript
// ✅ 수정 코드
export default function CheckoutPage() {
  const navigate = useNavigate()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  // ... 기타 상태 ...
  
  const SHIPPING_FEE = 3000
  
  // 🎯 totalAmount를 useEffect보다 먼저 계산
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price_snapshot * item.quantity,
    0
  )
  const totalAmount = subtotal + SHIPPING_FEE
  
  // 이제 useEffect에서 totalAmount를 안전하게 사용 가능
  useEffect(() => {
    // ...
    const paymentMethodWidget = paymentWidget.renderPaymentMethods(
      '#payment-widget',
      { value: totalAmount },  // ✅ 정상 작동!
      { variantKey: 'DEFAULT' }
    )
  }, [userId, cartItems, totalAmount, clientKey])
}
```

**개선사항:**
- `totalAmount`를 컴포넌트 상단에서 계산
- `useEffect`가 실행될 때 이미 계산 완료
- 순환 참조 없이 안전하게 사용 가능

### 2. clientKey 검증 추가

```typescript
// ✅ 수정 코드
useEffect(() => {
  if (!userId || cartItems.length === 0) return
  
  // 🎯 clientKey 검증 추가
  if (!clientKey) {
    console.error('토스페이먼츠 클라이언트 키가 설정되지 않았습니다.')
    setError('결제 시스템 설정이 올바르지 않습니다. 관리자에게 문의하세요.')
    return
  }

  const initializePaymentWidget = async () => {
    try {
      console.log('[CheckoutPage] 결제 위젯 초기화 시작', { 
        clientKey: clientKey.substring(0, 20) + '...', 
        totalAmount 
      })
      
      const paymentWidget = await loadPaymentWidget(clientKey, customerKey)
      // ...
      
      console.log('[CheckoutPage] 결제 위젯 초기화 완료')
    } catch (error) {
      console.error('[CheckoutPage] 결제 위젯 초기화 실패:', error)
      setError('결제 위젯을 불러올 수 없습니다. 페이지를 새로고침해주세요.')
    }
  }

  initializePaymentWidget()
}, [userId, cartItems, totalAmount, clientKey])
```

**개선사항:**
- `clientKey` 존재 여부 확인
- 에러 발생 시 `setError()`로 사용자에게 알림
- 디버깅을 위한 상세 로그 추가
- 의존성 배열에 `clientKey` 추가

### 3. 에러 처리 개선

```typescript
// ✅ 수정 코드
try {
  console.log('[CheckoutPage] 결제 위젯 초기화 시작')
  const paymentWidget = await loadPaymentWidget(clientKey, customerKey)
  
  const paymentMethodWidget = paymentWidget.renderPaymentMethods(
    '#payment-widget',
    { value: totalAmount },
    { variantKey: 'DEFAULT' }
  )

  paymentWidgetRef.current = paymentWidget
  paymentMethodWidgetRef.current = paymentMethodWidget
  setPaymentReady(true)
  console.log('[CheckoutPage] 결제 위젯 초기화 완료')
} catch (error) {
  console.error('[CheckoutPage] 결제 위젯 초기화 실패:', error)
  // 🎯 사용자에게 에러 표시
  setError('결제 위젯을 불러올 수 없습니다. 페이지를 새로고침해주세요.')
}
```

**개선사항:**
- `setError()`로 에러 상태 관리
- 사용자 친화적인 에러 메시지
- 페이지에 에러 UI 표시

## 📝 변경 파일

### src/pages/CheckoutPage.tsx

**변경 전:**
```typescript
const SHIPPING_FEE = 3000

useEffect(() => {
  // ... userId 체크 ...
}, [])

useEffect(() => {
  if (!userId || cartItems.length === 0) return

  const initializePaymentWidget = async () => {
    try {
      const paymentWidget = await loadPaymentWidget(clientKey, customerKey)
      
      const paymentMethodWidget = paymentWidget.renderPaymentMethods(
        '#payment-widget',
        { value: totalAmount },  // ❌ undefined!
        { variantKey: 'DEFAULT' }
      )
      // ...
    } catch (error) {
      console.error('결제 위젯 초기화 실패:', error)
    }
  }

  initializePaymentWidget()
}, [userId, cartItems, totalAmount])

// ...

const subtotal = cartItems.reduce(...)
const totalAmount = subtotal + SHIPPING_FEE  // ← 너무 늦게 정의됨
```

**변경 후:**
```typescript
const SHIPPING_FEE = 3000

// ✅ totalAmount를 먼저 계산
const subtotal = cartItems.reduce(
  (sum, item) => sum + item.price_snapshot * item.quantity,
  0
)
const totalAmount = subtotal + SHIPPING_FEE

useEffect(() => {
  // ... userId 체크 ...
}, [])

useEffect(() => {
  if (!userId || cartItems.length === 0) return
  
  // ✅ clientKey 검증
  if (!clientKey) {
    console.error('토스페이먼츠 클라이언트 키가 설정되지 않았습니다.')
    setError('결제 시스템 설정이 올바르지 않습니다. 관리자에게 문의하세요.')
    return
  }

  const initializePaymentWidget = async () => {
    try {
      console.log('[CheckoutPage] 결제 위젯 초기화 시작', { 
        clientKey: clientKey.substring(0, 20) + '...', 
        totalAmount 
      })
      
      const paymentWidget = await loadPaymentWidget(clientKey, customerKey)
      
      const paymentMethodWidget = paymentWidget.renderPaymentMethods(
        '#payment-widget',
        { value: totalAmount },  // ✅ 정상 작동!
        { variantKey: 'DEFAULT' }
      )

      paymentWidgetRef.current = paymentWidget
      paymentMethodWidgetRef.current = paymentMethodWidget
      setPaymentReady(true)
      console.log('[CheckoutPage] 결제 위젯 초기화 완료')
    } catch (error) {
      console.error('[CheckoutPage] 결제 위젯 초기화 실패:', error)
      // ✅ 사용자에게 에러 표시
      setError('결제 위젯을 불러올 수 없습니다. 페이지를 새로고침해주세요.')
    }
  }

  initializePaymentWidget()
}, [userId, cartItems, totalAmount, clientKey])

// 중복 제거됨 (이미 상단에서 정의)
```

## 🚀 배포 정보

### Preview URL
```
https://94be9545.toss-live-commerce.pages.dev
```

### Production URL
```
https://live.ur-team.com
```

### Git Commit
```
fix: Fix CheckoutPage payment widget initialization error
Commit: bfbded7
```

## 🧪 테스트 방법

### 1. 장바구니 → 결제 플로우 테스트

```
1. https://live.ur-team.com 접속
2. 라이브 방송 시청
3. 상품을 장바구니에 담기
4. 장바구니 페이지로 이동 (/cart)
5. "주문하기" 버튼 클릭
6. ✅ 결제 페이지 정상 로드 확인
```

### 2. 결제 위젯 표시 확인

```
1. /checkout 페이지 접속
2. ✅ 배송지 섹션 표시
3. ✅ 주문 상품 목록 표시
4. ✅ 결제 위젯 (카드, 계좌이체 등) 표시
5. ✅ 결제 금액 표시
6. ✅ "결제하기" 버튼 활성화
```

### 3. 콘솔 로그 확인 (개발자 도구)

```javascript
// 정상 동작 시 콘솔 로그
[CheckoutPage] 결제 위젯 초기화 시작 {clientKey: "test_gck_P9BRQmyarYPA...", totalAmount: 152000}
[CheckoutPage] 결제 위젯 초기화 완료
```

### 4. 에러 케이스 테스트

**Case 1: clientKey 없을 때**
```
1. .env 파일에서 VITE_TOSS_CLIENT_KEY 제거
2. /checkout 접속
3. ✅ "결제 시스템 설정이 올바르지 않습니다" 에러 메시지 표시
```

**Case 2: 네트워크 오류**
```
1. 개발자 도구 → Network → Offline
2. /checkout 접속
3. ✅ "결제 위젯을 불러올 수 없습니다" 에러 메시지 표시
```

## 📊 Before / After

| 항목 | Before | After |
|------|--------|-------|
| **장바구니 → 결제 이동** | ❌ 에러 발생 | ✅ 정상 작동 |
| **totalAmount 참조** | ❌ undefined | ✅ 정상 계산 |
| **clientKey 검증** | ❌ 없음 | ✅ 추가됨 |
| **에러 처리** | ❌ 콘솔만 | ✅ 사용자에게 표시 |
| **디버깅 로그** | ❌ 부족 | ✅ 상세 로그 |
| **사용자 경험** | ❌ 에러 화면 | ✅ 정상 결제 화면 |

## 🎯 핵심 개선사항

### 1. 변수 선언 순서 최적화
- `totalAmount`를 `useEffect` 이전에 계산
- 의존성 배열에서 안전하게 참조 가능

### 2. 에러 핸들링 강화
- `clientKey` 검증 추가
- 사용자 친화적 에러 메시지
- 상세 디버깅 로그

### 3. 코드 품질 개선
- 중복 코드 제거
- 명확한 에러 메시지
- 타입 안전성 유지

## ✅ 결과

**문제:**
- ❌ 장바구니에서 주문하기 클릭 시 에러 발생
- ❌ "앗! 오류가 발생했습니다" 화면 표시
- ❌ 결제 페이지 로드 실패

**해결:**
- ✅ 장바구니 → 결제 페이지 정상 이동
- ✅ 결제 위젯 정상 로드
- ✅ 배송지, 상품 목록, 결제 수단 모두 정상 표시
- ✅ 사용자가 실제로 결제 가능

**🎉 이제 장바구니에서 결제까지 전체 플로우가 정상 작동합니다!**

## 📞 추가 지원

문제가 지속되면:
- 고객센터: 0507-0177-0432
- 이메일: jiwon@ur-team.com
- 운영시간: 평일 09:00 - 18:00
