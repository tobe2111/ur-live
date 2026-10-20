# 모바일 결제 문제 해결 요약

## 🚨 **발견된 문제**

### 1. `renderAgreement()` 메서드 - 동기/비동기 불일치
**문제**: V1에서는 `renderPaymentMethods()`와 `renderAgreement()`가 **동기 메서드**인데, 코드에서 `await`를 사용하고 있었습니다.

**Toss Payments 마이그레이션 가이드 내용**:
| v1 | v2 | 설명 |
|---|---|---|
| **동기적 렌더링 메서드** | 비동기적 렌더링 메서드 | `renderPaymentMethods()`, `renderAgreement()` 메서드가 비동기로 바뀌었습니다 |

**해결**:
```typescript
// ❌ 이전 (잘못된 코드)
await widgets.renderPaymentMethods('#payment-method', ...)
await widgets.renderAgreement('#agreement', ...)

// ✅ 수정 (정상 코드)
widgets.renderPaymentMethods('#payment-method', ...)
widgets.renderAgreement('#agreement', ...)
setReady(true)  // V1은 동기라서 즉시 완료됨
```

### 2. `flowMode` 파라미터 제거 완료
**V1에서는 `flowMode` 파라미터를 지원하지 않습니다** (V2 전용).
- V1은 자동으로 모바일/PC 환경을 감지하여 최적화된 UI를 제공합니다
- 이미 이전에 제거 완료되어 현재는 정상입니다

## ✅ **수정 완료 사항**

### 1. SDK 버전 올바르게 설정됨
```html
<!-- index.html -->
<script src="https://js.tosspayments.com/v1/payment-widget"></script>
```

### 2. 위젯 초기화 V1 방식
```typescript
new window.PaymentWidget(clientKey, customerKey)
```

### 3. 렌더링 메서드 V1 방식 (동기)
```typescript
// Step 2: 결제 UI 렌더링
widgets.renderPaymentMethods(
  '#payment-method',
  { value: totalAmount, currency: 'KRW' },
  { variantKey: 'DEFAULT' }
)

widgets.renderAgreement(
  '#agreement',
  { variantKey: 'AGREEMENT' }
)

// V1은 동기 메서드라 즉시 완료됨
setReady(true)
```

### 4. 금액 업데이트 V1 방식
```typescript
// V1에서는 updateAmount() 사용
await widgets.updateAmount(totalAmount)
```

### 5. 결제 요청 V1 방식
```typescript
const requestOptions = {
  orderId,
  orderName,
  successUrl: `${window.location.origin}/payment/success`,
  failUrl: `${window.location.origin}/payment/fail`,
  customerEmail: 'customer@example.com',
  customerName: selectedAddress.recipient_name,
  customerMobilePhone: selectedAddress.phone.replace(/-/g, '')
}

// V1은 자동으로 모바일/PC 감지 (flowMode 불필요)
await widgets.requestPayment(requestOptions)
```

## 📋 **모바일 테스트 체크리스트**

### 필수 확인 사항
- [x] SDK URL이 V1인지 확인 (`v1/payment-widget`)
- [x] 전역 객체가 `window.PaymentWidget`인지 확인
- [x] 초기화 방식이 V1인지 확인 (`new PaymentWidget(...)`)
- [x] 렌더링 메서드에 `await` 제거
- [x] `setReady(true)` 호출되는지 확인
- [x] `flowMode` 파라미터 제거됨
- [x] 금액이 `Number(amount)`로 변환됨
- [x] API 버전이 `2022-11-16`인지 확인

### 모바일 환경 설정
- [x] `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />`
- [x] `<meta name="mobile-web-app-capable" content="yes" />`
- [x] `<meta name="apple-mobile-web-app-capable" content="yes" />`

## 🎯 **기대 효과**

### 문제 해결
1. **위젯 렌더링 실패** → V1 동기 메서드로 수정하여 `setReady(true)` 정상 호출
2. **모바일 환경 자동 감지** → V1이 자동으로 최적화
3. **결제 요청 성공** → 올바른 파라미터 전달

### 다음 테스트
1. **PC 브라우저**에서 테스트:
   - 크롬/엣지 시크릿 모드
   - https://live.ur-team.com 접속
   - 카카오 로그인
   - 상품 추가 → 결제하기
   - 테스트 카드 입력 (1111-1111-1111-1111)
   - 결제 완료 확인

2. **모바일 브라우저**에서 테스트:
   - Safari (iOS) 또는 Chrome (Android)
   - https://live.ur-team.com 접속
   - 카카오 로그인
   - 상품 추가 → 결제하기
   - 테스트 카드 입력
   - 결제 완료 확인

## 🔗 **배포 정보**

- **Preview URL**: https://232c7ed9.toss-live-commerce.pages.dev
- **Production URL**: https://live.ur-team.com
- **Git Commit**: 166a80d "Fix: V1 renderAgreement is synchronous method (remove await)"
- **배포 시간**: 2026-02-13 03:07 UTC

## 📚 **참고 문서**

- [토스페이먼츠 마이그레이션 가이드](https://docs.tosspayments.com/guides/v2/get-started/migration-guide)
- [결제위젯 V1 연동 가이드](https://docs.tosspayments.com/en/integration-widget)
- [API 키 가이드](https://docs.tosspayments.com/en/api-guide)

---

## 🎉 **결론**

모든 V1 관련 설정이 완료되었습니다. **`renderAgreement()` 메서드가 비동기가 아닌 동기**라는 중요한 사실을 발견하여 수정했습니다. 이제 모바일과 PC 모두에서 정상 작동할 것으로 예상됩니다.

**다음 단계**: 실제 모바일 기기에서 테스트를 진행하고 결과를 공유해주세요! 🚀
