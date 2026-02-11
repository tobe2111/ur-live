# 브랜드페이 Customer Key 오류 수정

## 🚨 문제 상황

### 에러 메시지
```
Error: 비회원은 브랜드페이 사용이 어려워요.
    at r (_app-47269b18fb6bc00b.js:304:353718)
    ...
```

### 증상
- 로그인한 사용자가 체크아웃 페이지 접속 시 "결제 화면을 불러올 수 없습니다" 오류 발생
- F12 콘솔에 "비회원은 브랜드페이 사용이 어려워요" 에러 표시
- 결제 위젯이 렌더링되지 않음

---

## 🔍 근본 원인

### 문제의 코드
```typescript
// ❌ 잘못된 코드
const widgetsInstance = tossPayments.widgets({ customerKey: ANONYMOUS })
```

### 왜 문제인가?

1. **`ANONYMOUS`는 비회원 전용**
   - Toss Payments SDK에서 `ANONYMOUS`는 비회원 결제 전용 상수
   - 브랜드페이는 회원 전용 기능이므로 `ANONYMOUS` 사용 시 오류 발생

2. **로그인한 사용자임에도 비회원으로 처리**
   - CheckoutPage는 로그인 필수 페이지 (Line 118-127)
   - 로그인한 사용자가 접속하는데 `ANONYMOUS`를 사용
   - Toss SDK가 "로그인했는데 왜 비회원인가?" 혼란

3. **브랜드페이 활성화 불가**
   - 브랜드페이는 `customerKey`가 고유 사용자 식별자여야 함
   - `ANONYMOUS`는 익명이므로 사용자 식별 불가
   - 따라서 브랜드페이 기능 사용 불가

---

## ✅ 해결 방법

### 수정된 코드
```typescript
// ✅ 올바른 코드
const customerKey = `customer_${userId}`
const widgetsInstance = tossPayments.widgets({ customerKey })
```

### 변경 사항

#### Before (잘못된 코드)
```typescript
// CheckoutPage.tsx Line 177-179
// 비회원 결제 (브랜드페이 비활성화)
console.log('[CheckoutPage] widgets() 호출...', { customerKey: 'ANONYMOUS' })
const widgetsInstance = tossPayments.widgets({ customerKey: ANONYMOUS })
```

#### After (수정된 코드)
```typescript
// CheckoutPage.tsx Line 177-180
// 로그인한 사용자: 회원 결제 (브랜드페이 가능)
const customerKey = `customer_${userId}`
console.log('[CheckoutPage] widgets() 호출...', { customerKey })
const widgetsInstance = tossPayments.widgets({ customerKey })
```

### Import 수정
```typescript
// Before
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk'

// After
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
```

---

## 🎯 결과

### 기대 효과

1. ✅ **로그인한 사용자의 결제 위젯 정상 로드**
   - "비회원은 브랜드페이 사용이 어려워요" 에러 해결
   - 결제 화면이 정상적으로 표시됨

2. ✅ **브랜드페이 활성화**
   - 로그인한 사용자는 브랜드페이 사용 가능
   - 카드 등록 및 간편 결제 기능 이용 가능

3. ✅ **사용자별 결제 이력 관리**
   - `customer_${userId}` 형태로 사용자 식별
   - Toss Payments 대시보드에서 사용자별 결제 이력 확인 가능

### 테스트 결과

#### Before (오류 발생)
```javascript
[CheckoutPage] widgets() 호출... {customerKey: "ANONYMOUS"}
❌ Error: 비회원은 브랜드페이 사용이 어려워요.
```

#### After (정상 작동)
```javascript
[CheckoutPage] widgets() 호출... {customerKey: "customer_1"}
[CheckoutPage] widgets() 완료
[CheckoutPage] ✅ Step 1 완료: TossPayments widgets 초기화 성공
```

---

## 🤔 왜 이런 실수가 발생했나?

### 1. 공식 가이드 오해
```typescript
// Toss Payments 공식 가이드 예시
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk'

const tossPayments = await loadTossPayments(clientKey)
const widgets = tossPayments.widgets({ customerKey: ANONYMOUS })  // ← 비회원 예시
```

- 공식 가이드에서 `ANONYMOUS` 예시를 먼저 보여줌
- 하지만 이는 **비회원 결제 예시**
- 로그인한 사용자는 `customerKey: 'customer_123'` 형태로 사용해야 함

### 2. 주석이 오해를 유발
```typescript
// 주석: "비회원 결제 (브랜드페이 비활성화)"
// 실제: 로그인한 사용자가 접속하는 페이지
```

### 3. 테스트 부족
- 실제 로그인 → 장바구니 → 체크아웃 전체 흐름 테스트 부족
- 콘솔 에러를 바로 확인하지 못함

---

## 📚 Toss Payments customerKey 가이드

### customerKey 형식

#### 1. 회원 결제
```typescript
// ✅ 권장: userId 기반
const customerKey = `customer_${userId}`

// ✅ 가능: 이메일 기반
const customerKey = `customer_user@example.com`

// ✅ 가능: 임의의 고유 식별자
const customerKey = 'cus_abc123def456'
```

**주의사항**:
- 최대 300자
- 영문, 숫자, 특수문자(`-`, `_`, `.`) 사용 가능
- 고유해야 함 (같은 사용자는 항상 같은 customerKey)

#### 2. 비회원 결제
```typescript
// ✅ ANONYMOUS 상수 사용
import { ANONYMOUS } from '@tosspayments/tosspayments-sdk'
const widgets = tossPayments.widgets({ customerKey: ANONYMOUS })

// ❌ 문자열로 직접 입력 (권장하지 않음)
const widgets = tossPayments.widgets({ customerKey: 'ANONYMOUS' })
```

### 브랜드페이 사용 조건

✅ **사용 가능**:
- `customerKey`가 고유 식별자인 경우
- 예: `customer_1`, `customer_user@example.com`

❌ **사용 불가**:
- `customerKey`가 `ANONYMOUS`인 경우
- 비회원은 브랜드페이 기능 이용 불가

---

## 🚀 배포 정보

### 수정 버전
- **커밋 해시**: `430f06b`
- **커밋 메시지**: "fix: Use customer_userId instead of ANONYMOUS for logged-in users to enable BrandPay"
- **배포 일시**: 2025-02-11
- **Preview URL**: https://97903fd5.toss-live-commerce.pages.dev
- **Production URL**: https://live.ur-team.com

### 변경된 파일
- `src/pages/CheckoutPage.tsx` (1 file, 5 insertions, 4 deletions)

---

## ✅ 테스트 방법

### 1. 로그인
```
URL: https://live.ur-team.com/login
계정: user@example.com / user123
```

### 2. 상품 담기
```
URL: https://live.ur-team.com/live
→ 상품 "장바구니 담기" 클릭
```

### 3. 체크아웃 페이지 접속
```
URL: https://live.ur-team.com/checkout
```

### 4. F12 콘솔 확인
```javascript
// ✅ 정상 로그
[CheckoutPage] widgets() 호출... {customerKey: "customer_1"}
[CheckoutPage] ✅ Step 1 완료: TossPayments widgets 초기화 성공
[CheckoutPage] ✅ Step 2 완료: 결제 UI 렌더링 성공

// ❌ 이전 로그 (오류)
[CheckoutPage] widgets() 호출... {customerKey: "ANONYMOUS"}
❌ Error: 비회원은 브랜드페이 사용이 어려워요.
```

### 5. 결제 위젯 확인
- ✅ 카드 결제 표시
- ✅ 계좌이체 표시
- ✅ 가상계좌 표시
- ✅ 휴대폰 결제 표시
- ✅ **브랜드페이 표시** (새로 활성화!)

---

## 🎓 교훈

### 1. 공식 문서를 정확히 이해하기
- `ANONYMOUS`는 **비회원 전용**
- 로그인한 사용자는 **고유 customerKey 사용**

### 2. 에러 메시지를 자세히 읽기
- "비회원은 브랜드페이 사용이 어려워요" 
- → ANONYMOUS 사용 중이라는 힌트

### 3. 전체 흐름 테스트의 중요성
- 로그인 → 장바구니 → 체크아웃 전체 흐름 테스트
- 각 단계별 콘솔 로그 확인

### 4. 주석과 실제 코드 일치시키기
- 주석: "비회원 결제"
- 실제: 로그인 필수 페이지
- → 혼란 유발

---

## 📚 관련 문서

- [Toss Payments 공식 가이드](https://docs.tosspayments.com/guides/v2/payment-widget/integration?frontend=react)
- [customerKey 가이드](https://docs.tosspayments.com/guides/v2/payment-widget/integration#customer-key)
- [브랜드페이 가이드](https://docs.tosspayments.com/guides/v2/brandpay/integration)
- [체크아웃 에러 디버깅 가이드](./CHECKOUT_ERROR_DEBUG.md)
- [체크아웃 테스트 가이드](./CHECKOUT_TEST_GUIDE.md)

---

## 🎉 최종 상태

### Before
```
❌ 로그인한 사용자 → ANONYMOUS 사용
❌ "비회원은 브랜드페이 사용이 어려워요" 에러
❌ 결제 화면 로드 실패
❌ 브랜드페이 비활성화
```

### After
```
✅ 로그인한 사용자 → customer_${userId} 사용
✅ 에러 없음
✅ 결제 화면 정상 로드
✅ 브랜드페이 활성화
✅ 모든 결제 수단 사용 가능
```

**이제 완벽하게 작동합니다!** 🎉
