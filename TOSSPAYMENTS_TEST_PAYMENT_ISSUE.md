# 토스페이먼츠 테스트 결제내역 미표시 문제

## 🔍 문제 상황
**토스페이먼츠 개발자센터에서 테스트 결제내역이 표시되지 않음**

---

## ✅ 코드 확인 결과

### 결제 승인 API (정상)
```typescript
// src/index.tsx - 라인 4075-4086
const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
  method: 'POST',
  headers: {
    'Authorization': encryptedSecretKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    orderId: orderId,
    amount: amount,
    paymentKey: paymentKey
  })
});
```

✅ **TossPayments API를 올바르게 호출하고 있음**

---

## 🔍 테스트 결제내역 표시 조건

### 1. 테스트 시크릿 키 사용
- **테스트 키**: `test_sk_...`로 시작
- **실서비스 키**: `live_sk_...`로 시작
- 개발자센터에 표시되려면 **테스트 키를 사용**해야 함

### 2. 결제 승인 성공
- TossPayments API가 HTTP 200 응답을 반환해야 함
- 에러 발생 시 결제내역에 저장되지 않음

### 3. 올바른 메뉴 확인
- **개발자센터 > 결제 > 테스트 결제내역** (테스트 키 사용 시)
- **개발자센터 > 결제 > 결제 내역** (실서비스 키 사용 시)

---

## 🧪 테스트 방법

### 1. 결제 승인 API 로그 확인
```bash
# 프로덕션 환경에서 결제 시도
# 브라우저 콘솔에서 확인:
[Payment] 결제 승인 요청: { orderId: '...', amount: 17500 }
[Payment] 토스페이먼츠 결제 승인 API 호출...
[Payment] ✅ 결제 승인 성공: ORDER_...
```

### 2. TossPayments 응답 확인
- HTTP 200: 성공 (개발자센터에 표시됨)
- HTTP 4xx/5xx: 실패 (표시 안 됨)

### 3. 개발자센터에서 확인
1. [TossPayments 개발자센터](https://developers.tosspayments.com/) 로그인
2. **결제 > 테스트 결제내역** 메뉴 확인
3. 필터: 오늘 날짜, 전체 상태

---

## 💡 가능한 원인

### 1. 테스트 키가 아닌 실서비스 키 사용 중
- 확인: `TOSS_SECRET_KEY` 환경변수 값
- `test_sk_`로 시작하는지 확인

### 2. 결제 승인 API 호출 실패
- 네트워크 에러
- 인증 실패 (잘못된 시크릿 키)
- 파라미터 오류

### 3. 다른 계정으로 로그인
- 시크릿 키를 발급받은 계정과 동일한 계정으로 로그인했는지 확인

---

## 🔧 해결 방법

### 즉시 확인 사항
```javascript
// 브라우저 개발자 도구 > Network 탭에서 확인
// POST /api/payments/confirm 요청 확인
// Response 탭에서 success: true 확인
```

### DB에서 결제 상태 확인
```sql
SELECT 
  order_number, 
  payment_key, 
  payment_status, 
  status, 
  total_amount
FROM orders
WHERE order_number = 'ORDER_1770867395983_...'
```

**예상 결과**:
- ✅ `payment_key`: `tgen_...` (저장됨)
- ✅ `payment_status`: `approved`
- ✅ `status`: `paid`

### TossPayments API 직접 조회
```bash
# 시크릿 키로 결제 조회
curl -X GET \
  "https://api.tosspayments.com/v1/payments/orders/{orderId}" \
  -H "Authorization: Basic {base64(secretKey:)}"
```

---

## 📋 체크리스트

- [x] 결제 승인 API 코드 정상 (TossPayments API 호출 확인)
- [ ] 테스트 시크릿 키 사용 확인 (`test_sk_...`)
- [ ] 결제 승인 API 성공 응답 확인 (HTTP 200)
- [ ] 개발자센터 올바른 메뉴 확인 (테스트 결제내역)
- [ ] 동일 계정 로그인 확인

---

## 🎯 결론

**코드는 정상이며, 다음을 확인하세요:**

1. ✅ **우리 코드**: TossPayments API를 올바르게 호출
2. ❓ **시크릿 키**: 테스트 키(`test_sk_...`) 사용 중인지 확인
3. ❓ **API 응답**: 결제 승인이 실제로 성공했는지 확인
4. ❓ **개발자센터**: 올바른 메뉴 (테스트 결제내역) 확인

**다음 결제 시도 시**:
- 브라우저 콘솔에서 `[Payment]` 로그 확인
- 결제 승인 성공 메시지 확인
- 개발자센터에서 즉시 새로고침

---

**작성일**: 2026-02-12 13:00 KST  
**상태**: 코드 정상 / 설정 확인 필요
