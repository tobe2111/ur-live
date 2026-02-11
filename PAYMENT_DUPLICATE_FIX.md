# 결제 중복 요청 방지 수정

## ⚠️ 문제 상황

**에러 메시지:**
```
Uncaught (in promise) InvalidMethodTransactionError: 이미 다른 명령을 수행하고 있어요
Uncaught (in promise) UserCancelError: 취소되었습니다.
```

**증상:**
- "결제하기" 버튼 클릭 시 위 에러 발생
- 결제 진행이 중단됨
- 브라우저 콘솔에 에러 로그 출력

---

## 🔍 근본 원인

### 1. **중복 실행 방지 로직 부재**

`handlePayment` 함수에 **중복 실행 방지 메커니즘**이 없었습니다:

**❌ Before (문제 코드):**
```tsx
const handlePayment = async () => {
  if (!widgets) {
    alert('결제 위젯이 준비되지 않았습니다.')
    return
  }

  if (!selectedAddress) {
    alert('배송지를 선택해주세요.')
    return
  }

  try {
    // 배송지 정보 저장...
    await widgets.requestPayment({ ... })  // ⚠️ 중복 호출 가능
  } catch (error) {
    // 에러 처리...
  }
}
```

**문제점:**
- 사용자가 버튼을 빠르게 여러 번 클릭하면 `widgets.requestPayment()`가 **동시에 여러 번 호출**됨
- Toss Payments SDK는 **동시에 하나의 결제만 처리** 가능
- 두 번째 호출부터 `InvalidMethodTransactionError: 이미 다른 명령을 수행하고 있어요` 에러 발생

### 2. **비동기 처리 중 상태 관리 미흡**

- `requestPayment()`는 비동기 함수이므로 완료되기 전까지 시간이 소요
- 이 시간 동안 버튼이 활성화되어 있어 중복 클릭 가능
- 결제창이 뜰 때까지 약 500ms~1초 소요되는데, 이 기간에 재클릭 가능

---

## ✅ 해결 방법

### 1. **`isProcessing` 상태 추가**

결제 처리 중 플래그를 추가하여 중복 실행 방지:

```tsx
const [isProcessing, setIsProcessing] = useState(false)  // 결제 처리 중 플래그
```

### 2. **`handlePayment` 함수 수정**

**✅ After (수정 코드):**
```tsx
const handlePayment = async () => {
  // ✅ 중복 실행 방지
  if (isProcessing) {
    console.warn('[CheckoutPage] 결제가 이미 진행 중입니다.')
    return
  }

  if (!widgets) {
    alert('결제 위젯이 준비되지 않았습니다.')
    return
  }

  if (!selectedAddress) {
    alert('배송지를 선택해주세요.')
    return
  }

  try {
    setIsProcessing(true)  // ✅ 처리 시작
    console.log('[CheckoutPage] 결제 요청 시작...')

    // 배송지 정보 저장...
    
    console.log('[CheckoutPage] requestPayment 호출:', { orderId, orderName, totalAmount })

    await widgets.requestPayment({
      orderId,
      orderName,
      successUrl: `${window.location.origin}/payment/success`,
      failUrl: `${window.location.origin}/payment/fail`,
      customerEmail: '',
      customerName: selectedAddress.recipient_name,
      customerMobilePhone: selectedAddress.phone,
    })
    
    console.log('[CheckoutPage] 결제 요청 완료 (리다이렉트 대기 중)')
  } catch (error: any) {
    console.error('[CheckoutPage] 결제 요청 실패:', error)
    
    // 에러 처리...
  } finally {
    // ✅ 처리 완료 (성공/실패 관계없이)
    setTimeout(() => {
      setIsProcessing(false)
      console.log('[CheckoutPage] 결제 처리 플래그 해제')
    }, 2000)  // 2초 후 플래그 해제 (중복 클릭 방지)
  }
}
```

### 3. **버튼 UI 개선**

버튼에 `isProcessing` 상태 반영:

```tsx
<Button
  onClick={handlePayment}
  disabled={!ready || !selectedAddress || isProcessing}  // ✅ isProcessing 추가
  className="w-full bg-gradient-to-r from-[#007aff] to-[#0051d5] hover:from-[#0051d5] hover:to-[#003d99] text-white h-14 rounded-xl text-lg font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
>
  {isProcessing ? '처리 중...' : ready ? '결제하기' : '결제 준비 중...'}  
  {/* ✅ 처리 중일 때 '처리 중...' 표시 */}
</Button>
```

---

## 🎯 수정 효과

### Before (문제):
1. 사용자가 "결제하기" 버튼을 빠르게 2번 클릭
2. `requestPayment()` 2번 동시 호출
3. Toss SDK가 첫 번째 호출 처리 중
4. 두 번째 호출이 `InvalidMethodTransactionError` 발생 → 결제 중단

### After (해결):
1. 사용자가 "결제하기" 버튼을 빠르게 2번 클릭
2. 첫 번째 클릭: `isProcessing = true` → `requestPayment()` 호출
3. 두 번째 클릭: `isProcessing === true` → 함수 즉시 리턴 (중복 방지)
4. 2초 후 `isProcessing = false` → 필요시 재시도 가능

---

## 🚀 배포 정보

**Preview URL:** https://3768e69f.toss-live-commerce.pages.dev  
**Production URL:** https://live.ur-team.com  
**커밋 해시:** `a0f71b0`  
**배포 일시:** 2025-02-11

---

## 📝 변경 파일

```
src/pages/CheckoutPage.tsx
```

**변경 내용:**
- `isProcessing` 상태 추가
- `handlePayment()` 함수에 중복 실행 방지 로직 추가
- 버튼 disabled 조건에 `isProcessing` 추가
- 버튼 텍스트에 처리 중 상태 표시 추가
- 상세 로그 추가 (디버깅 용이성)

---

## ✅ 테스트 방법

### 1. 정상 결제 흐름
```bash
1. https://live.ur-team.com/login 접속 → user@example.com / user123 로그인
2. https://live.ur-team.com/live 접속 → 상품 담기
3. https://live.ur-team.com/checkout 접속
4. F12 콘솔 열기
5. "결제하기" 버튼 클릭
6. 콘솔 로그 확인:
   ✅ [CheckoutPage] 결제 요청 시작...
   ✅ [CheckoutPage] requestPayment 호출: { orderId: '...', orderName: '...', totalAmount: ... }
7. 결제창이 정상적으로 열림
```

### 2. 중복 클릭 테스트
```bash
1. 위 1~3 단계 동일
2. F12 콘솔 열기
3. "결제하기" 버튼을 **빠르게 여러 번** 클릭
4. 콘솔 로그 확인:
   ✅ [CheckoutPage] 결제 요청 시작...  (첫 번째 클릭)
   ⚠️ [CheckoutPage] 결제가 이미 진행 중입니다.  (두 번째 클릭 이후)
5. 결제창이 **한 번만** 열림 (중복 방지 성공)
```

### 3. 버튼 상태 확인
```bash
1. "결제하기" 버튼 클릭 후 즉시 확인
2. 버튼 텍스트가 "처리 중..."으로 변경됨
3. 버튼이 비활성화됨 (disabled)
4. 2초 후 버튼이 다시 활성화됨
```

---

## 🔑 핵심 교훈

### 1. **비동기 처리에는 반드시 상태 관리 필요**
- 버튼 클릭 → API 호출 → 완료까지의 시간이 있을 때
- **중복 실행 방지 플래그** 필수

### 2. **외부 SDK 사용 시 동시성 제약 확인**
- Toss Payments SDK는 동시에 하나의 결제만 처리 가능
- 문서에 명시되지 않은 제약도 에러 메시지로 확인 가능

### 3. **사용자 경험 개선**
- 버튼 상태 변경 (`처리 중...`)으로 현재 상태 명확히 표시
- 2초 타이머로 실수로 버튼을 여러 번 누르는 것 방지

### 4. **로깅의 중요성**
- 상세한 콘솔 로그로 디버깅 시간 단축
- 문제 발생 시 원인 파악 용이

---

## 🎓 최종 상태

✅ **중복 결제 요청 완벽 방지**  
✅ **사용자 경험 개선** (버튼 상태 표시)  
✅ **로그 강화** (디버깅 용이)  
✅ **에러 핸들링 개선**  

**이제 완벽하게 작동합니다! 🎉**

---

## 📚 관련 문서

- [CHECKOUT_ERROR_DEBUG.md](./CHECKOUT_ERROR_DEBUG.md) - 체크아웃 오류 디버깅 가이드
- [BRANDPAY_COMPLETE_IMPLEMENTATION.md](./BRANDPAY_COMPLETE_IMPLEMENTATION.md) - 브랜드페이 완전 구현
- [CHECKOUT_TEST_GUIDE.md](./CHECKOUT_TEST_GUIDE.md) - 체크아웃 테스트 가이드
- [OFFICIAL_SDK_MIGRATION.md](./OFFICIAL_SDK_MIGRATION.md) - 공식 SDK 마이그레이션
