# 🏪 토스페이먼츠 MID urteamizy1 계정 설정 가이드

## 📌 개요

**MID (Merchant ID):** `urteamizy1`

브랜드페이를 사용하지 않고, **일반 결제 수단**만을 통해 결제를 진행합니다.

---

## ✅ 지원 결제 수단

MID `urteamizy1` 계정으로 다음 결제 수단을 사용할 수 있습니다:

1. **카드** - 신용카드/체크카드 즉시 결제
2. **계좌이체** - 실시간 계좌이체
3. **가상계좌** - 가상계좌 발급 후 입금
4. **휴대폰** - 휴대폰 소액결제

**❌ 브랜드페이는 사용하지 않습니다.**

---

## 🔑 API 키 설정

### 1️⃣ 환경 변수 설정

**Cloudflare Pages 환경 변수:**
```bash
# 클라이언트 키 (프론트엔드용)
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN  # 테스트
# VITE_TOSS_CLIENT_KEY=live_gck_xxxxxxxxxx  # 라이브 (PG 승인 후)

# 시크릿 키 (백엔드용)
npx wrangler pages secret put TOSS_SECRET_KEY
# 입력: test_gsk_xxxxxxxxxx  # 테스트
# 입력: live_sk_xxxxxxxxxx   # 라이브 (PG 승인 후)
```

### 2️⃣ 로컬 개발 환경 (.dev.vars)

`.dev.vars` 파일 생성:
```bash
# Toss Payments Secret Key (로컬 개발용)
TOSS_SECRET_KEY=test_gsk_xxxxxxxxxx

# Payment Provider (optional, default: tosspayments)
PAYMENT_PG_PROVIDER=tosspayments
```

**⚠️ 주의: `.dev.vars` 파일은 절대 Git에 커밋하지 마세요!**

---

## 📋 결제 플로우

### 1️⃣ 체크아웃 페이지 (/checkout)

```typescript
// CheckoutPage.tsx
const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY

// SDK 로드
const tossPayments = await loadTossPayments(clientKey)

// customerKey 생성 (사용자 고유 ID)
const customerKey = `customer_${userId}`

// widgets 인스턴스 생성 (brandpay 옵션 없음!)
const widgets = tossPayments.widgets({ customerKey })

// 결제 수단 UI 렌더링
await widgets.renderPaymentMethods({
  selector: '#payment-method',
  variantKey: 'DEFAULT'  // 모든 결제 수단 표시
})

// 결제 요청
await widgets.requestPayment({
  orderId: 'ORDER_xxx',
  orderName: '상품명 외 2건',
  successUrl: '/payment/success',
  failUrl: '/payment/fail',
  customerEmail: 'customer@example.com',
  customerName: '김토스',
  customerMobilePhone: '01012341234'
})
```

### 2️⃣ 결제 승인 API (/api/payments/confirm)

```typescript
// POST /api/payments/confirm
{
  paymentKey: 'xxx',
  orderId: 'ORDER_xxx',
  amount: 50000
}

// 백엔드 처리:
// 1. 금액 검증 (DB의 order.total_amount와 비교)
// 2. 중복 결제 방지 (payments 테이블 체크)
// 3. PG사에 결제 승인 요청
// 4. payments 테이블에 결제 정보 저장
// 5. orders 테이블 status 업데이트 (pending → paid)
```

### 3️⃣ 결제 성공 페이지 (/payment/success)

```typescript
// PaymentSuccessPage.tsx
// 1. 장바구니 조회
// 2. 주문 생성 (status: 'pending')
// 3. 결제 승인 요청
// 4. 장바구니 비우기
```

---

## 🧪 테스트 카드 정보

### 신용카드 (즉시 승인)

```
카드번호: 4000-0000-0000-0008
유효기간: 12/25
CVC: 123
비밀번호: 12
```

### 테스트 시나리오

1. **정상 결제**
   - 카드: 4000-0000-0000-0008
   - 결과: 즉시 승인

2. **잔액 부족**
   - 카드: 4000-0000-0000-0001
   - 결과: 잔액 부족 오류

3. **도난/분실 카드**
   - 카드: 4000-0000-0000-0002
   - 결과: 도난/분실 카드 오류

---

## 🔐 보안 설정

### 1️⃣ 금액 검증 (필수!)

```typescript
// src/index.tsx - /api/payments/confirm
const order = await DB.prepare(`
  SELECT total_amount FROM orders WHERE order_no = ?
`).bind(orderId).first()

if (order.total_amount !== amount) {
  return c.json({ 
    success: false, 
    error: '결제 금액이 일치하지 않습니다.' 
  }, 400)
}

// PG 승인 시 DB의 금액 사용 (클라이언트 금액 무시)
await provider.confirmPayment({
  paymentKey,
  orderId,
  amount: order.total_amount  // ✅ DB 금액 사용
})
```

### 2️⃣ 중복 결제 방지 (필수!)

```typescript
// payments 테이블 체크
const existingPayment = await DB.prepare(`
  SELECT id FROM payments WHERE order_id = ? AND status = 'completed'
`).bind(orderId).first()

if (existingPayment) {
  return c.json({ 
    success: false, 
    error: '이미 결제가 완료된 주문입니다.' 
  }, 400)
}

// orders 테이블 체크
if (order.status === 'paid') {
  return c.json({ 
    success: false, 
    error: '이미 결제가 완료된 주문입니다.' 
  }, 400)
}
```

---

## 🌐 웹훅 설정 (가상계좌용)

### 1️⃣ 토스페이먼츠 개발자센터 설정

**웹훅 URL 등록:**
```
테스트: https://preview-url.pages.dev/api/payments/webhook
라이브: https://live.ur-team.com/api/payments/webhook
```

**수신 이벤트:**
- 결제 상태 변경 (PAYMENT_STATUS_CHANGED)
- 가상계좌 발급 (VIRTUAL_ACCOUNT_ISSUED)

### 2️⃣ 웹훅 엔드포인트

```typescript
// POST /api/payments/webhook
app.post('/api/payments/webhook', async (c) => {
  const body = await c.req.json()
  
  switch (body.eventType) {
    case 'PAYMENT_STATUS_CHANGED':
      // 가상계좌 입금 완료 처리
      await handlePaymentStatusChanged(DB, body)
      break
    
    case 'VIRTUAL_ACCOUNT_ISSUED':
      // 가상계좌 정보 저장
      await handleVirtualAccountIssued(DB, body)
      break
  }
  
  return c.json({ success: true })
})
```

---

## 📊 데이터베이스 스키마

### payments 테이블

```sql
CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,  -- FK to orders.order_no
  pg_provider TEXT NOT NULL DEFAULT 'tosspayments',
  pg_payment_key TEXT NOT NULL,
  pg_transaction_id TEXT,
  method TEXT NOT NULL,  -- '카드', '계좌이체', '가상계좌', '휴대폰'
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  
  -- 카드 정보
  card_company TEXT,
  card_number TEXT,
  installment_months INTEGER,
  
  -- 가상계좌 정보
  virtual_account_bank TEXT,
  virtual_account_number TEXT,
  virtual_account_holder TEXT,
  virtual_account_due_date DATETIME,
  
  -- 타임스탬프
  requested_at DATETIME,
  approved_at DATETIME,
  cancelled_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- 원본 데이터
  pg_raw_data TEXT
);
```

### orders 테이블

```sql
ALTER TABLE orders ADD COLUMN payment_key TEXT;
ALTER TABLE orders ADD COLUMN payment_status TEXT;
ALTER TABLE orders ADD COLUMN payment_method TEXT;
```

---

## 🚀 배포 체크리스트

### 테스트 환경

- [x] CheckoutPage 구현
- [x] 결제 승인 API 구현
- [x] 금액 검증 로직
- [x] 중복 결제 방지
- [x] 결제 취소/환불 API
- [x] 웹훅 엔드포인트
- [x] 테스트 카드로 결제 테스트

### 프로덕션 환경 (PG 승인 후)

- [ ] 라이브 API 키 발급
- [ ] 환경 변수 업데이트
  ```bash
  npx wrangler pages secret put TOSS_SECRET_KEY
  # 입력: live_sk_xxxxxxxxxx
  ```
- [ ] 웹훅 URL 등록 (https://live.ur-team.com/api/payments/webhook)
- [ ] 실제 카드로 결제 테스트
- [ ] 가상계좌 입금 테스트
- [ ] 환불 프로세스 테스트

---

## 📚 API 엔드포인트 요약

| HTTP | 엔드포인트 | 기능 | 상태 |
|------|-----------|------|------|
| `POST` | `/api/payments/confirm` | 결제 승인 | ✅ |
| `POST` | `/api/payments/webhook` | 웹훅 수신 | ✅ |
| `POST` | `/api/payments/:paymentKey/cancel` | 결제 취소/환불 | ✅ |
| `GET` | `/api/payments/:paymentKey` | 결제 조회 | ✅ |
| `GET` | `/api/payments/order/:orderId` | 주문별 결제 목록 | ✅ |

---

## 🔑 핵심 포인트

1. **MID urteamizy1** - 일반 결제 수단만 사용
2. **브랜드페이 미사용** - 카드 등록 없이 직접 결제
3. **variantKey: 'DEFAULT'** - 모든 결제 수단 표시
4. **보안 필수** - 금액 검증, 중복 결제 방지
5. **웹훅 설정** - 가상계좌 입금 알림

---

## 📞 다음 단계

1. **PG 승인 신청**
   - 토스페이먼츠 가맹점 계약
   - MID `urteamizy1` 계정 활성화

2. **라이브 키 발급**
   - 클라이언트 키: `live_gck_xxx`
   - 시크릿 키: `live_sk_xxx`

3. **프로덕션 배포**
   - 환경 변수 업데이트
   - 웹훅 URL 등록
   - 실제 결제 테스트

---

**작성일:** 2025-02-12  
**작성자:** Claude (AI Developer)  
**상태:** ✅ 테스트 환경 구현 완료, ⏳ PG 승인 대기
