# 결제 고급 API 구현 완료 ✅

## 📌 개요

토스페이먼츠 PG 통합에서 **필수적이지만 누락되었던 고급 기능들**을 모두 구현했습니다.

---

## ✅ 구현된 기능

### 1️⃣ 웹훅 엔드포인트 (Webhook)

**엔드포인트:** `POST /api/payments/webhook`

**목적:**
- 가상계좌 입금 완료 알림 수신
- 결제 상태 변경 실시간 알림
- 비동기 결제 처리 (가상계좌, 계좌이체 등)

**지원 이벤트:**
- `PAYMENT_STATUS_CHANGED`: 결제 상태 변경 (가상계좌 입금 완료 등)
- `VIRTUAL_ACCOUNT_ISSUED`: 가상계좌 발급 완료

**처리 로직:**
```typescript
// 웹훅 수신 → 이벤트 타입별 핸들러 호출
switch (body.eventType) {
  case 'PAYMENT_STATUS_CHANGED':
    // payments 테이블 status 업데이트
    // 입금 완료 시 orders 테이블 status = 'paid' 업데이트
    break;
  
  case 'VIRTUAL_ACCOUNT_ISSUED':
    // 가상계좌 정보 저장 (은행, 계좌번호, 입금자명, 입금기한)
    break;
}
```

**보안:**
- 토스페이먼츠에서 설정한 웹훅 URL로만 요청 수신
- IP 화이트리스트 추천 (Cloudflare Workers Secrets에 저장)

**설정 방법:**
1. 토스페이먼츠 개발자센터 로그인
2. **내 개발 정보 > 웹훅 설정**
3. 웹훅 URL 등록: `https://live.ur-team.com/api/payments/webhook`
4. 수신할 이벤트 선택: `결제 상태 변경`, `가상계좌 발급`

---

### 2️⃣ 결제 취소/환불 API

**엔드포인트:** `POST /api/payments/:paymentKey/cancel`

**요청 예시:**
```bash
curl -X POST https://live.ur-team.com/api/payments/tgen_xxx/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "cancelReason": "단순 변심",
    "cancelAmount": 50000
  }'
```

**요청 파라미터:**
- `cancelReason` (필수): 취소 사유
- `cancelAmount` (선택): 부분 취소 금액 (없으면 전액 취소)

**처리 로직:**
1. ✅ 결제 정보 조회 (`payments` 테이블)
2. ✅ 이미 취소된 결제인지 확인
3. ✅ PG사에 취소 요청 (Toss Payments API)
4. ✅ `payments` 테이블 업데이트
   - `status = 'CANCELED'`
   - `cancelled_at = <취소 시각>`
5. ✅ `orders` 테이블 업데이트
   - `status = 'cancelled'`
   - `payment_status = 'cancelled'`

**응답 예시:**
```json
{
  "success": true,
  "data": {
    "paymentKey": "tgen_xxx",
    "orderId": "ORDER_xxx",
    "cancelAmount": 50000,
    "canceledAt": "2025-02-11T10:30:00.000Z",
    "status": "CANCELED"
  }
}
```

**부분 취소 지원:**
- 전액 취소: `cancelAmount` 생략
- 부분 취소: `cancelAmount` 지정 (예: 50,000원만 취소)

---

### 3️⃣ 결제 조회 API

#### 3-1. 단건 조회

**엔드포인트:** `GET /api/payments/:paymentKey`

**요청 예시:**
```bash
curl https://live.ur-team.com/api/payments/tgen_xxx
```

**응답 예시:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "order_id": "ORDER_xxx",
    "pg_provider": "tosspayments",
    "pg_payment_key": "tgen_xxx",
    "method": "카드",
    "amount": 100000,
    "status": "completed",
    "card_company": "신한카드",
    "card_number": "1234-****-****-5678",
    "approved_at": "2025-02-11T10:00:00.000Z",
    "order_status": "paid"
  }
}
```

#### 3-2. 주문별 결제 목록 조회

**엔드포인트:** `GET /api/payments/order/:orderId`

**요청 예시:**
```bash
curl https://live.ur-team.com/api/payments/order/ORDER_xxx
```

**응답 예시:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "order_id": "ORDER_xxx",
      "pg_payment_key": "tgen_xxx",
      "method": "카드",
      "amount": 100000,
      "status": "completed",
      "approved_at": "2025-02-11T10:00:00.000Z"
    }
  ]
}
```

**사용 시나리오:**
- 관리자 페이지에서 결제 내역 조회
- 고객 마이페이지에서 결제 상세 정보 표시
- 환불 처리 전 결제 상태 확인

---

## 🔐 이미 구현된 보안 기능

### ✅ 금액 검증 (Payment Amount Validation)

**위치:** `src/index.tsx:4046-4059`

```typescript
// 4️⃣ 금액 검증 (보안 핵심!)
if (order.total_amount !== amount) {
  console.error('[Payment] ❌ 금액 불일치 감지!', {
    orderId,
    orderAmount: order.total_amount,
    requestAmount: amount,
    difference: order.total_amount - amount
  });
  
  return c.json({ 
    success: false, 
    error: '결제 금액이 일치하지 않습니다.' 
  }, 400);
}
```

**보안 효과:**
- ✅ 클라이언트에서 금액 조작 불가
- ✅ DB에 저장된 주문 금액(`order.total_amount`)과 비교
- ✅ 불일치 시 결제 승인 거부 (400 에러)

**예시 공격 시나리오 차단:**
```javascript
// ❌ 해커가 브라우저 콘솔에서 시도
fetch('/api/payments/confirm', {
  body: JSON.stringify({
    paymentKey: 'xxx',
    orderId: 'ORDER_xxx',
    amount: 1  // 100,000원 → 1원으로 조작
  })
})
// → 400 Bad Request: "결제 금액이 일치하지 않습니다."
```

---

### ✅ 중복 결제 방지 (Duplicate Payment Prevention)

**위치:** `src/index.tsx:4012-4044`

```typescript
// 2️⃣ 중복 결제 방지 - payments 테이블 확인
const existingPayment = await DB.prepare(`
  SELECT id FROM payments WHERE order_id = ? AND status = 'completed'
`).bind(orderId).first();

if (existingPayment) {
  console.warn('[Payment] ❌ 중복 결제 시도 차단:', orderId);
  return c.json({ 
    success: false, 
    error: '이미 결제가 완료된 주문입니다.' 
  }, 400);
}

// 3️⃣ 주문 상태 확인
if (order.status === 'paid') {
  console.warn('[Payment] ❌ 이미 결제 완료된 주문:', orderId);
  return c.json({ 
    success: false, 
    error: '이미 결제가 완료된 주문입니다.' 
  }, 400);
}
```

**보안 효과:**
- ✅ 같은 주문에 대해 여러 번 결제 불가
- ✅ F5 새로고침, 뒤로 가기 후 재결제 차단
- ✅ 이중 차감 방지

**예시 시나리오:**
```
1️⃣ 사용자가 결제 완료
2️⃣ F5 새로고침 또는 뒤로 가기 후 다시 결제 버튼 클릭
3️⃣ 시스템이 이미 완료된 결제 감지
4️⃣ 400 Bad Request: "이미 결제가 완료된 주문입니다."
```

---

## 📊 API 엔드포인트 정리

| HTTP 메서드 | 엔드포인트 | 기능 | 상태 |
|------------|-----------|------|------|
| `POST` | `/api/payments/confirm` | 결제 승인 | ✅ 구현 완료 |
| `POST` | `/api/payments/webhook` | 웹훅 수신 | ✅ 구현 완료 |
| `POST` | `/api/payments/:paymentKey/cancel` | 결제 취소/환불 | ✅ 구현 완료 |
| `GET` | `/api/payments/:paymentKey` | 결제 단건 조회 | ✅ 구현 완료 |
| `GET` | `/api/payments/order/:orderId` | 주문별 결제 목록 | ✅ 구현 완료 |

---

## 🧪 테스트 시나리오

### 1️⃣ 웹훅 테스트 (로컬)

```bash
# 가상계좌 입금 완료 시뮬레이션
curl -X POST http://localhost:3000/api/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "PAYMENT_STATUS_CHANGED",
    "orderId": "ORDER_xxx",
    "status": "DONE",
    "paymentKey": "tgen_xxx"
  }'
```

### 2️⃣ 결제 취소 테스트

```bash
# 전액 취소
curl -X POST https://live.ur-team.com/api/payments/tgen_xxx/cancel \
  -H "Content-Type: application/json" \
  -d '{"cancelReason": "단순 변심"}'

# 부분 취소 (50,000원만)
curl -X POST https://live.ur-team.com/api/payments/tgen_xxx/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "cancelReason": "부분 환불",
    "cancelAmount": 50000
  }'
```

### 3️⃣ 결제 조회 테스트

```bash
# 단건 조회
curl https://live.ur-team.com/api/payments/tgen_xxx

# 주문별 목록 조회
curl https://live.ur-team.com/api/payments/order/ORDER_xxx
```

---

## 🚀 배포 정보

- **Preview URL:** https://5d59f0fb.toss-live-commerce.pages.dev
- **Production URL:** https://live.ur-team.com
- **커밋 해시:** `7bbe2f0`
- **배포 일시:** 2025-02-11

---

## 📝 변경 파일

### `src/index.tsx`

**추가된 API 엔드포인트:**
1. `POST /api/payments/webhook` - 웹훅 수신기
2. `POST /api/payments/:paymentKey/cancel` - 결제 취소/환불
3. `GET /api/payments/:paymentKey` - 결제 단건 조회
4. `GET /api/payments/order/:orderId` - 주문별 결제 목록

**수정된 함수:**
- `PaymentProvider.cancelPayment()` - 시그니처 변경 및 부분 취소 지원

---

## ⚠️ 추가 작업 필요 (PG 승인 후)

### 1️⃣ 웹훅 URL 등록

**토스페이먼츠 개발자센터:**
1. 내 개발 정보 > 웹훅 설정
2. **테스트 환경:** `https://5d59f0fb.toss-live-commerce.pages.dev/api/payments/webhook`
3. **실제 환경:** `https://live.ur-team.com/api/payments/webhook`

### 2️⃣ 라이브 키 교체

**환경 변수 업데이트:**
```bash
# Cloudflare Pages 환경 변수 설정
npx wrangler pages secret put TOSS_SECRET_KEY --project-name toss-live-commerce
# 라이브 시크릿 키 입력 (live_sk_xxx)
```

### 3️⃣ 웹훅 보안 강화

**IP 화이트리스트 추가 (선택):**
```typescript
// src/index.tsx의 webhook 엔드포인트에 추가
const allowedIPs = c.env.TOSS_WEBHOOK_IPS?.split(',') || [];
const clientIP = c.req.header('CF-Connecting-IP');

if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
  return c.json({ success: false, error: 'Unauthorized' }, 403);
}
```

---

## 🎉 최종 결과

### ✅ 구현 완료된 기능

1. **결제 승인** (금액 검증 + 중복 방지)
2. **웹훅 수신** (가상계좌 입금 알림)
3. **결제 취소/환불** (전액 + 부분 취소)
4. **결제 조회** (단건 + 목록)

### 🔐 보안 기능

- ✅ 금액 조작 방지 (DB 금액 검증)
- ✅ 중복 결제 차단 (payments 테이블 체크)
- ✅ 주문 상태 검증 (paid 주문 재결제 불가)

### 📊 남은 작업

- ⏳ 웹훅 URL 등록 (PG 승인 후)
- ⏳ 라이브 API 키 교체
- ⏳ 관리자 페이지에서 환불 UI 구현 (프론트엔드)
- ⏳ 가상계좌 결제 E2E 테스트

---

## 📚 관련 문서

1. [PAYMENT_FOREIGN_KEY_FIX.md](./PAYMENT_FOREIGN_KEY_FIX.md) - FK 오류 해결
2. [ENABLE_ALL_PAYMENT_METHODS.md](./ENABLE_ALL_PAYMENT_METHODS.md) - 모든 결제 수단 활성화
3. [MISSING_PAYMENT_FEATURES.md](./MISSING_PAYMENT_FEATURES.md) - 미비된 기능 분석
4. [PAYMENT_GATEWAY_GUIDE.md](./docs/PAYMENT_GATEWAY_GUIDE.md) - PG 통합 가이드

---

**작성일:** 2025-02-11  
**작성자:** Claude (AI Developer)  
**상태:** ✅ 구현 완료 및 배포 완료
