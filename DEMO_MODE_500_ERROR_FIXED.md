# /api/orders 500 에러 해결 - 데모 모드 지원 추가

## 📅 작업 일시
- **날짜**: 2025-02-12
- **커밋**: e285838

## 🎯 문제 상황

### 증상
```
/api/orders:1  Failed to load resource: the server responded with a status of 500 ()
```

### 원인
**PaymentSuccessPage**가 모든 결제에서 무조건 다음을 요구:
1. `userId` (로그인 사용자 ID)
2. 장바구니 정보 (`/api/cart/${userId}`)
3. 주문 생성 API 호출 (`POST /api/orders`)

**데모 페이지** (`/payment/demo`)에서는:
- ❌ 로그인하지 않음 (userId 없음)
- ❌ 장바구니 없음
- ❌ 실제 주문 생성 불필요

→ `/api/orders` 호출 시 500 에러 발생!

## ✅ 해결 방법

### 데모 모드 감지 로직 추가

**PaymentSuccessPage 수정:**

```typescript
async function confirmPayment() {
  try {
    console.log('[PaymentSuccess] 결제 승인 프로세스 시작')
    
    // 1️⃣ 사용자 정보 확인
    const userId = getUserId()
    
    // 🎯 데모 모드 감지: userId가 없으면 데모 결제로 간주
    if (!userId) {
      console.log('[PaymentSuccess] 🎭 데모 모드 - 간단한 성공 메시지만 표시')
      setOrderInfo({
        orderId: orderId,
        method: '테스트',
        status: 'demo'  // 데모 플래그
      })
      setLoading(false)
      return  // ✅ 여기서 종료! 주문 생성하지 않음
    }

    // 2️⃣ 실제 결제: 장바구니 조회
    console.log('[PaymentSuccess] 장바구니 조회 중...')
    const cartResponse = await axios.get(`/api/cart/${userId}`)
    // ... 실제 주문 생성 로직 계속 ...
  }
}
```

### UI 조건부 렌더링

**데모 모드일 때 다른 메시지 표시:**

```typescript
{/* 안내 메시지 */}
{orderInfo?.status === 'demo' ? (
  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
    <p className="text-sm text-yellow-900">
      🎭 <strong>데모 모드</strong>: 실제 결제가 진행되지 않았습니다. 
      테스트 목적으로만 사용하세요.
    </p>
  </div>
) : (
  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
    <p className="text-sm text-blue-900">
      🎉 주문이 접수되었습니다. 배송은 영업일 기준 3~5일 소요됩니다.
    </p>
  </div>
)}
```

**데모 모드일 때 다른 버튼 표시:**

```typescript
{/* 액션 버튼 */}
<div className="mt-8 flex gap-3">
  {orderInfo?.status === 'demo' ? (
    <>
      <Button onClick={() => navigate('/payment/demo')}>
        다시 테스트하기
      </Button>
      <Button onClick={() => navigate('/')}>
        메인으로
      </Button>
    </>
  ) : (
    <>
      <Button onClick={() => navigate('/orders')}>
        주문 내역 보기
      </Button>
      <Button onClick={() => navigate('/')}>
        쇼핑 계속하기
      </Button>
    </>
  )}
</div>
```

## 📊 변경 요약

| 구분 | 이전 | 현재 |
|------|------|------|
| 데모 결제 | ❌ 500 에러 | ✅ 성공 메시지 |
| userId 체크 | 필수 (없으면 에러) | 선택 (없으면 데모 모드) |
| 주문 생성 | 무조건 호출 | 로그인 사용자만 호출 |
| UI 메시지 | 일반 성공 메시지 | 데모/실제 구분 |
| 버튼 | 주문 내역/쇼핑 | 데모: 다시 테스트/메인 |

## 🔍 동작 흐름

### 데모 모드 (userId 없음)
```
1. PaymentDemoPage에서 결제 요청
   ↓
2. 토스페이먼츠 결제창
   ↓
3. successUrl로 리다이렉트 (/payment/success?paymentKey=...&orderId=...&amount=...)
   ↓
4. PaymentSuccessPage
   - getUserId() → null
   - 🎭 데모 모드 감지!
   - orderInfo = { status: 'demo' }
   - 주문 생성 SKIP
   ↓
5. 데모 성공 메시지 표시
   - "🎭 데모 모드: 실제 결제가 진행되지 않았습니다"
   - "다시 테스트하기" 버튼
```

### 실제 결제 (userId 있음)
```
1. CheckoutPage에서 결제 요청
   ↓
2. 토스페이먼츠 결제창
   ↓
3. successUrl로 리다이렉트
   ↓
4. PaymentSuccessPage
   - getUserId() → userId 있음
   - 장바구니 조회
   - POST /api/orders (주문 생성)
   - POST /api/payments/confirm (결제 승인)
   - 장바구니 비우기
   ↓
5. 실제 성공 메시지 표시
   - "🎉 주문이 접수되었습니다"
   - "주문 내역 보기" 버튼
```

## 🚀 배포 정보
- **Preview URL**: https://68853b1d.toss-live-commerce.pages.dev
- **Production URL**: https://live.ur-team.com
- **데모 페이지**: https://live.ur-team.com/payment/demo
- **커밋 해시**: e285838
- **배포 일시**: 2025-02-12

## 🧪 테스트 방법

### 1. 데모 모드 테스트
```
1. https://live.ur-team.com/payment/demo 접속
2. 결제 수단 선택
3. 테스트 카드 정보 입력:
   - 카드번호: 4000-0000-0000-0008
   - 유효기간: 12/25
   - CVC: 123
   - 비밀번호: 12
4. "결제하기" 클릭
5. ✅ 성공 페이지에서 "🎭 데모 모드" 메시지 확인
6. ✅ "다시 테스트하기" 버튼 확인
```

### 2. 실제 결제 테스트
```
1. 로그인
2. 상품을 장바구니에 추가
3. /checkout 접속
4. 배송지 입력
5. 결제하기
6. ✅ "🎉 주문이 접수되었습니다" 메시지 확인
7. ✅ "주문 내역 보기" 버튼 확인
```

## 📝 적용된 파일
- ✅ `/home/user/webapp/src/pages/PaymentSuccessPage.tsx`

## 🎯 핵심 개선사항

### 1. 에러 방지
- ❌ 이전: 데모 결제 시 500 에러
- ✅ 현재: 데모 모드 자동 감지 및 우회

### 2. 사용자 경험
- 데모/실제 결제 명확히 구분
- 각 모드에 맞는 안내 메시지
- 적절한 액션 버튼 제공

### 3. 코드 안정성
- userId 체크로 안전한 분기
- 불필요한 API 호출 방지
- 명확한 로그 메시지

## ⚠️ 주의사항

### 데모 모드 감지 조건
```typescript
const userId = getUserId()
if (!userId) {
  // 데모 모드
}
```

**이 방식은 다음을 가정:**
1. 데모 페이지에서는 **로그인하지 않음**
2. 실제 결제에서는 **반드시 로그인 필요**

만약 비회원 결제를 지원한다면, 다른 방식으로 데모 모드를 감지해야 합니다:
- URL 파라미터 (`?demo=true`)
- orderId 패턴 매칭 (`DEMO_` 접두사)
- localStorage 플래그

## 🔜 다음 단계
1. ✅ 데모 모드 500 에러 해결 완료
2. ⏳ 실제 결제 플로우 E2E 테스트
3. ⏳ 비회원 결제 지원 시 데모 감지 로직 개선
4. ⏳ 에러 핸들링 고도화

## 📚 관련 문서
- ✅ **VARIANT_KEY_ISSUE_RESOLVED.md** - variantKey 문제 해결
- ✅ **OFFICIAL_GUIDE_STRICT_COMPLIANCE.md** - 공식 가이드 준수
- ✅ **PAYMENT_IMPLEMENTATION_COMPLETE.md** - 결제 구현 완료

---

## 🎉 최종 결과

**데모 페이지에서 500 에러 없이 정상적으로 결제 UI를 테스트할 수 있습니다!**

### ✅ 해결된 문제
- /api/orders 500 에러 완전 해결
- 데모/실제 결제 명확히 구분
- 사용자 경험 개선

### 🚀 테스트 가능
**지금 바로 데모 페이지에서 테스트하세요:**
```
https://live.ur-team.com/payment/demo
```

모든 결제 수단이 정상적으로 표시되고, 테스트 결제 후 성공 메시지를 확인할 수 있습니다! 🎊
