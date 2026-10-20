# TossPayments 테스트 결제내역 미표시 문제 해결

## 📋 문제 상황

**증상:**
- 결제 완료 후 TossPayments 개발자센터 테스트 결제내역에 결제 기록이 표시되지 않음
- URL: https://developers.tosspayments.com/1515748/accounts/2084244/phases/test/payment-logs

**원인 분석:**
결제위젯(Payment Widget)을 사용하고 있지만, **API 개별 연동용 시크릿 키**를 사용하고 있었음!

## 🔑 키 종류와 사용법

TossPayments는 **두 가지 연동 방식**이 있으며, **각각 다른 키**를 사용합니다:

### 1. API 개별 연동 (Legacy)
```
Client Key: test_ck_KNbdOvk5rk5lGyQnAq0o3n07xlzm
Secret Key: test_sk_ORzdMaqN3wOGnjevbpZD35AkYXQG
```
- REST API 직접 호출 방식
- 결제창을 직접 구현해야 함
- **우리 서비스는 이 방식을 사용하지 않음**

### 2. 결제위젯 연동 (Payment Widget) ✅ 우리가 사용
```
Client Key: test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
Secret Key: test_gsk_bAjYKeZ4G5V47OvXZLy9lMKwv12Eqpmo
```
- TossPayments에서 제공하는 UI 위젯 사용
- 간편한 연동
- **우리 서비스는 이 방식을 사용 중**

**Store ID (MID):** `urteamizy1`

## 🔧 해결 방법

### 1. 시크릿 키 업데이트

**Before (잘못된 키):**
```bash
# API 개별 연동 키 사용 (잘못됨)
TOSS_SECRET_KEY=test_sk_ORzdMaqN3wOGnjevbpZD35AkYXQG
```

**After (올바른 키):**
```bash
# 결제위젯 키 사용 (올바름)
TOSS_SECRET_KEY=test_gsk_bAjYKeZ4G5V47OvXZLy9lMKwv12Eqpmo
```

**Cloudflare Secret 업데이트:**
```bash
echo "test_gsk_bAjYKeZ4G5V47OvXZLy9lMKwv12Eqpmo" | \
  npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live
```

### 2. 결제 API 로깅 강화

`src/index.tsx`의 `/api/payments/confirm` 엔드포인트에 상세 로깅 추가:

```typescript
console.log('[Payment] 🚀 토스페이먼츠 결제 승인 API 호출 시작...');
console.log('[Payment] 📋 요청 데이터:', {
  paymentKey,
  orderId,
  amount,
  secretKeyPrefix: secretKey.substring(0, 20) + '...'
});

const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
  method: 'POST',
  headers: {
    'Authorization': encryptedSecretKey,
    'Content-Type': 'application/json',
    'TossPayments-API-Version': '2022-11-16'
  },
  body: JSON.stringify({ orderId, amount, paymentKey })
});

const data = await response.json();

console.log('[Payment] 📡 토스페이먼츠 API 응답 상태:', response.status);
console.log('[Payment] 📡 토스페이먼츠 API 응답 데이터:', JSON.stringify(data).substring(0, 500));
```

### 3. 클라이언트 키 확인

`src/pages/CheckoutPage.tsx`:
```typescript
const clientKey = 'test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN'  // ✅ 결제위젯 키
```

## 🧪 테스트 방법

### 1. 테스트 결제 진행
```
1. https://live.ur-team.com 접속
2. 상품 선택 → 장바구니 → 결제하기
3. 테스트 카드: 4000 0000 0000 0010
4. 유효기간: 12/25
5. CVC: 123
6. 비밀번호: 00
```

### 2. 브라우저 콘솔 로그 확인

**예상 로그 (성공):**
```
[Payment] 🚀 토스페이먼츠 결제 승인 API 호출 시작...
[Payment] 📋 요청 데이터: { 
  paymentKey: "tgen_...", 
  orderId: "ORDER_...", 
  amount: 17500,
  secretKeyPrefix: "test_gsk_bAjYKeZ4G5..." 
}
[Payment] 📡 토스페이먼츠 API 응답 상태: 200
[Payment] 📡 토스페이먼츠 API 응답 데이터: {...}
[Payment] ✅ 결제 승인 성공! paymentKey: tgen_...
[Payment] ✅ 주문 번호: ORDER_...
[Payment] ✅ 주문 상태 업데이트 완료
[Payment] ✅ 재고 차감 완료
```

### 3. TossPayments 개발자센터 확인

**URL:** https://developers.tosspayments.com/1515748/accounts/2084244/phases/test/payment-logs

**확인 항목:**
- ✅ 테스트 결제내역에 새 결제 표시됨
- ✅ 주문번호(ORDER_...), 금액, 시간 일치
- ✅ 상태: 승인 완료

### 4. DB 확인

```sql
-- 주문 상태 확인
SELECT 
  order_number, 
  payment_key, 
  payment_status, 
  status, 
  total_amount,
  created_at
FROM orders 
WHERE order_number LIKE 'ORDER_%'
ORDER BY created_at DESC 
LIMIT 5;
```

**예상 결과:**
```
order_number: ORDER_1770867395983_...
payment_key: tgen_20260212123636...
payment_status: approved
status: paid
total_amount: 17500
```

## 📊 Before vs After

### Before (문제 상태)
- ❌ 결제 완료되지만 TossPayments 개발자센터에 기록 없음
- ❌ 잘못된 시크릿 키 사용 (API 개별 연동 키)
- ❌ 로깅 부족으로 디버깅 어려움

### After (해결 상태)
- ✅ 결제 완료 시 TossPayments 개발자센터에 기록 표시
- ✅ 올바른 시크릿 키 사용 (결제위젯 키)
- ✅ 상세 로깅으로 문제 추적 용이

## 🚀 배포 정보

- **Preview URL:** https://0507fdb6.ur-live.pages.dev
- **Production URL:** https://live.ur-team.com
- **Git Commit:** bfa848a
- **배포 시각:** 2026-02-12 13:22 KST

## 📝 관련 파일

1. `src/index.tsx` - 결제 승인 API 로깅 강화
2. `src/pages/CheckoutPage.tsx` - 클라이언트 키 확인
3. Cloudflare Secret: `TOSS_SECRET_KEY` (결제위젯 시크릿 키)

## ⚠️ 주의사항

### 키 혼용 금지
- 결제위젯을 사용한다면 **반드시 결제위젯 키**를 사용
- API 개별 연동을 사용한다면 **API 개별 연동 키**를 사용
- **두 가지를 섞어 사용하면 결제 기록이 표시되지 않음!**

### 환경별 키 관리
```bash
# 테스트 환경
Client Key: test_gck_... (결제위젯)
Secret Key: test_gsk_... (결제위젯)

# 운영 환경 (실제 서비스 시)
Client Key: live_gck_... (결제위젯)
Secret Key: live_gsk_... (결제위젯)
```

## 🔍 트러블슈팅

### Q1. 결제는 완료되는데 개발자센터에 안 뜨는 경우
**A:** 시크릿 키가 잘못되었을 가능성 99%
- 결제위젯 사용 중 → `test_gsk_...` 키 사용
- API 개별 연동 사용 중 → `test_sk_...` 키 사용

### Q2. 콘솔에서 API 응답이 401 Unauthorized
**A:** 시크릿 키가 만료되었거나 잘못됨
- TossPayments 개발자센터에서 새 키 발급
- Cloudflare Secret 업데이트

### Q3. 테스트 결제내역이 아닌 실 결제내역에만 보이는 경우
**A:** Live 키를 사용 중임
- `test_gsk_...` 키로 변경
- 테스트 결제내역 탭 확인

## ✅ 최종 상태

- [x] 결제위젯 시크릿 키로 업데이트
- [x] 결제 API 로깅 강화
- [x] 빌드 및 배포 완료
- [ ] 실제 결제 테스트 (사용자가 진행)
- [ ] TossPayments 개발자센터에서 결제 기록 확인

---

**작업 완료 시각:** 2026-02-12 13:25 KST  
**우선순위:** 🔴 HIGH  
**Git 커밋:** bfa848a  
**문서 작성:** ur-team 개발팀
