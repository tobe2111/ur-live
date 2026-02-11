# 브랜드페이 비활성화 - customerToken 오류 해결

## 📋 문제 상황

### 오류 메시지
```
KnownError: customerToken이 존재하지 않습니다.
POST https://api.tosspayments.com/v1/brandpay/clients/authorizations 400 (Bad Request)
```

### 발생 시점
- 결제 위젯에서 **카드를 브랜드페이에 등록**하려고 할 때
- 사용자가 "카드 저장" 또는 "간편결제 등록" 버튼을 클릭할 때

## 🔍 원인 분석

### 1. 브랜드페이란?
- 카드 정보를 저장해서 다음 결제 시 간편하게 사용하는 기능
- 고객 토큰(`customerToken`)이 필요함

### 2. 테스트 환경 제한
```
테스트 키 (test_gck_xxx) 사용 시:
✅ 일반 카드 결제 - 가능
✅ 계좌이체 - 가능
✅ 가상계좌 - 가능
❌ 브랜드페이 카드 등록 - 불가 (customerToken 필요)
```

### 3. 근본 원인
- Toss Payments 테스트 키로는 `customerToken` 생성/관리 불가
- 브랜드페이는 **실제 계약 후 라이브 키**에서만 완전히 작동

## ✅ 해결 방법

### 코드 수정: `src/pages/CheckoutPage.tsx`

#### Before (❌ 브랜드페이 활성화)
```typescript
const paymentMethodWidget = paymentWidget.renderPaymentMethods(
  '#payment-widget',
  { value: totalAmount }
  // 기본 설정 - 브랜드페이 자동 활성화
)
```

#### After (✅ 브랜드페이 비활성화)
```typescript
const paymentMethodWidget = paymentWidget.renderPaymentMethods(
  '#payment-widget',
  { value: totalAmount },
  {
    variantKey: 'DEFAULT',
    methodVariants: [
      { key: 'CARD', options: { useBrandPay: false } },  // 브랜드페이 명시적으로 비활성화
      { key: 'TRANSFER', options: {} },
      { key: 'VIRTUAL_ACCOUNT', options: {} },
      { key: 'MOBILE_PHONE', options: {} }
    ]
  }
)
```

### 핵심 옵션
```typescript
{ key: 'CARD', options: { useBrandPay: false } }
```
- `useBrandPay: false`: 카드 결제에서 브랜드페이 등록 UI 숨김
- 일반 카드 결제만 가능

## 🧪 테스트 결과

### Before (오류 발생)
1. 결제 위젯 로드 ✅
2. 카드 입력 ✅
3. 카드 저장 버튼 클릭 ❌ **customerToken 오류**

### After (정상 작동)
1. 결제 위젯 로드 ✅
2. 카드 입력 ✅
3. 일회성 결제 진행 ✅ **정상 작동**
4. 카드 저장 버튼 없음 ✅ **UI 자체가 숨겨짐**

## 📊 결제 수단 비교

| 결제 수단 | 테스트 환경 | 운영 환경 |
|----------|------------|----------|
| **일반 카드 결제** | ✅ 사용 가능 | ✅ 사용 가능 |
| **계좌이체** | ✅ 사용 가능 | ✅ 사용 가능 |
| **가상계좌** | ✅ 사용 가능 | ✅ 사용 가능 |
| **휴대폰 결제** | ✅ 사용 가능 | ✅ 사용 가능 |
| **브랜드페이 (카드 저장)** | ❌ 제한적 | ✅ 완전 작동 |

## 🚀 배포 정보

- **Preview URL**: https://8f1c6066.toss-live-commerce.pages.dev
- **Production URL**: https://live.ur-team.com
- **커밋 해시**: `20a6452`
- **배포 시간**: 2026-02-11

## 🎯 운영 환경 전환 시

### 브랜드페이 활성화 방법 (라이브 키 사용 시)

1. **전자결제 계약 완료**
2. **라이브 키 발급** (`live_gck_xxx`)
3. **환경 변수 변경**:
   ```bash
   VITE_TOSS_CLIENT_KEY=live_gck_xxx...
   ```
4. **코드 수정** (`CheckoutPage.tsx`):
   ```typescript
   { key: 'CARD', options: { useBrandPay: true } }  // 브랜드페이 활성화
   ```

## 📚 참고 문서

- [Toss Payments 결제 위젯 가이드](https://docs.tosspayments.com/guides/v2/payment-widget/integration)
- [브랜드페이 소개](https://docs.tosspayments.com/reference/brandpay/overview)
- [테스트 환경 제한사항](https://docs.tosspayments.com/guides/v2/get-started/environment)

## 💡 핵심 정리

### 문제
- `customerToken이 존재하지 않습니다` 오류

### 원인
- 테스트 키로 브랜드페이 기능 제한

### 해결
- `useBrandPay: false`로 브랜드페이 비활성화

### 영향
- ✅ 일반 카드 결제 정상 작동
- ✅ 모든 결제 수단 사용 가능
- ❌ 카드 저장 기능만 비활성화 (테스트 환경에서만)

---

**최종 상태**: 테스트 환경에서 모든 결제 기능 정상 작동 ✅
