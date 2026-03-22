# NicePay 결제 연동 구현 가이드

## 📋 NicePay 공식 가이드 분석 결과

### **결제 플로우 (Server 승인 모델)**

```
1. 사용자가 결제 버튼 클릭
   ↓
2. 프론트엔드: AUTHNICE.requestPay() 호출
   - clientId: 클라이언트 키
   - method: 'card'
   - orderId: 주문번호
   - amount: 금액
   - goodsName: 상품명
   - returnUrl: 결과를 받을 엔드포인트
   ↓
3. NicePay 결제창 노출 → 사용자 카드 인증
   ↓
4. NicePay → returnUrl로 POST 전송
   - authResultCode: '0000' (성공)
   - tid: 거래 키
   - authToken: 인증 토큰
   - signature: 서명
   ↓
5. 백엔드: returnUrl에서 데이터 수신
   - 금액 검증
   - 위변조 검증 (signature)
   ↓
6. 백엔드: 승인 API 호출
   POST https://api.nicepay.co.kr/v1/payments/{tid}
   Authorization: Basic Base64(clientId:secretKey)
   Body: { "amount": 1004 }
   ↓
7. NicePay → 승인 응답
   - resultCode: "0000"
   - status: "paid"
   - 결제 완료!
```

---

## ⚠️ 현재 구현 문제점

### **1. 결제 흐름이 NicePay 가이드와 다름**

**문제:**
- 현재: 결제창 응답을 `/payment-result`에서 받고 즉시 승인 API 호출
- 가이드: `returnUrl`을 서버 엔드포인트로 설정하고 POST로 데이터 수신

**영향:**
- 클라이언트에서 직접 승인 API를 호출하면 보안 위험
- 금액 검증 및 위변조 검증이 제대로 안 됨

---

### **2. Authorization 인증 방식 불일치**

**문제:**
- 현재: `MID:KEY`를 Base64 인코딩
- 가이드: `ClientId:SecretKey`를 Base64 인코딩

**차이:**
```javascript
// ❌ 현재 구현 (잘못됨)
Authorization: Basic Base64(MID:MerchantKey)

// ✅ 올바른 구현
Authorization: Basic Base64(ClientId:SecretKey)
```

---

### **3. 환경 변수 이름 혼동**

**문제:**
- `NICEPAY_KEY`가 실제로는 무엇인가?
  - Merchant Key? (88자 Base64)
  - Secret Key? (32자 hex)

**가이드에 따르면:**
- Client Key = Client ID (`S2_`로 시작)
- Secret Key = API 인증용 (32자 hex, 예: `9eb85607103646da9f9c02b128f2e5ee`)
- Merchant Key ≠ Secret Key

---

## ✅ 올바른 구현 방법

### **1. 환경 변수 정리**

```bash
# NicePay에서 발급받아야 하는 값
NICEPAY_CLIENT_ID=S2_xxxxxxxxxxxxxxxxxxxxxxxx  # Client Key
NICEPAY_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxx   # Secret Key (32자)
```

**MID는 필요 없음!** 
- MID는 NicePay 내부적으로 Client ID와 연결되어 있음
- API 호출 시 MID를 전달할 필요 없음

---

### **2. 프론트엔드 (cart.html)**

```javascript
// 결제 버튼 클릭 시
AUTHNICE.requestPay({
  clientId: window.NICEPAY_CLIENT_ID,  // 환경 변수에서 주입
  method: 'card',
  orderId: orderNo,  // 주문번호
  amount: totalAmount,
  goodsName: goodsName,
  returnUrl: window.location.origin + '/api/payments/nicepay/callback',  // 서버 엔드포인트!
  fnError: function(result) {
    console.error('결제 실패:', result);
    alert('결제 중 오류가 발생했습니다.');
  }
});
```

---

### **3. 백엔드 (src/index.tsx)**

#### **A. 결제창 응답 수신 (returnUrl)**

```typescript
// POST /api/payments/nicepay/callback
app.post('/api/payments/nicepay/callback', async (c) => {
  const body = await c.req.parseBody();
  
  // 1. 결제창 응답 데이터
  const {
    authResultCode,
    authResultMsg,
    tid,
    orderId,
    amount,
    authToken,
    signature
  } = body;
  
  // 2. 결과 코드 확인
  if (authResultCode !== '0000') {
    console.error('인증 실패:', authResultMsg);
    return c.redirect(`/cart?error=${encodeURIComponent(authResultMsg)}`);
  }
  
  // 3. 주문 정보 조회
  const order = await DB.prepare(`
    SELECT * FROM orders WHERE order_number = ?
  `).bind(orderId).first();
  
  if (!order) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }
  
  // 4. 금액 검증
  if (parseInt(amount) !== order.total_amount) {
    console.error('금액 불일치');
    return c.json({ success: false, error: 'Amount mismatch' }, 400);
  }
  
  // 5. 승인 API 호출
  const approvalResult = await approvePayment(c.env, tid, amount);
  
  // 6. 승인 성공 시 주문 상태 업데이트
  if (approvalResult.resultCode === '0000') {
    await DB.prepare(`
      UPDATE orders 
      SET payment_status = 'approved', 
          payment_key = ?,
          transaction_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(approvalResult.tid, approvalResult.tid, orderId).run();
    
    // 주문 완료 페이지로 리다이렉트
    return c.redirect(`/order-complete?orderNo=${orderId}`);
  } else {
    return c.json({ success: false, error: approvalResult.resultMsg }, 500);
  }
});
```

#### **B. 승인 API 호출 함수**

```typescript
async function approvePayment(env: any, tid: string, amount: string) {
  const NICEPAY_CLIENT_ID = env.NICEPAY_CLIENT_ID;
  const NICEPAY_SECRET_KEY = env.NICEPAY_SECRET_KEY;
  
  // Basic Auth 생성
  const auth = btoa(`${NICEPAY_CLIENT_ID}:${NICEPAY_SECRET_KEY}`);
  
  // 승인 API 호출
  const response = await fetch(`https://api.nicepay.co.kr/v1/payments/${tid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`
    },
    body: JSON.stringify({ amount: parseInt(amount) })
  });
  
  return await response.json();
}
```

---

### **4. 웹훅 엔드포인트 (선택사항)**

가상계좌 등을 사용하는 경우 필수

```typescript
app.post('/api/payments/nicepay/webhook', async (c) => {
  const webhook = await c.req.json();
  
  console.log('NicePay 웹훅 수신:', webhook);
  
  // 웹훅 이벤트 처리
  switch(webhook.status) {
    case 'paid':
      // 결제 완료 처리
      break;
    case 'cancelled':
      // 취소 처리
      break;
  }
  
  return c.json({ success: true });
});
```

---

## 🔑 API 키 발급 방법

### **NicePay 관리자 페이지**

1. https://start.nicepay.co.kr/merchant/login/main.do 로그인
2. 상점 선택
3. **개발정보** 탭 클릭
4. **KEY 정보** 섹션에서 확인:

```
┌──────────────────────────────────────┐
│ 결제창 승인 방식                      │
│ ☑ Server 승인 모델                   │ ← 이것 선택!
├──────────────────────────────────────┤
│ Client Key (클라이언트 키)           │
│ S2_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  │ ← NICEPAY_CLIENT_ID
├──────────────────────────────────────┤
│ API 인가 방식                         │
│ ☑ Basic 인증                         │ ← 이것 선택!
├──────────────────────────────────────┤
│ Secret Key (시크릿 키)               │
│ xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx    │ ← NICEPAY_SECRET_KEY
└──────────────────────────────────────┘
```

---

## 🚀 환경 변수 설정 (Cloudflare Pages)

```bash
# Client ID 설정
echo "S2_your_client_id" | npx wrangler pages secret put NICEPAY_CLIENT_ID --project-name toss-live-commerce

# Secret Key 설정
echo "your_secret_key" | npx wrangler pages secret put NICEPAY_SECRET_KEY --project-name toss-live-commerce
```

---

## 📊 현재 vs 올바른 구현 비교

| 항목 | 현재 구현 | 올바른 구현 |
|------|----------|------------|
| **returnUrl** | `/payment-result` (HTML) | `/api/payments/nicepay/callback` (API) |
| **Authorization** | `Base64(MID:KEY)` | `Base64(ClientId:SecretKey)` |
| **환경 변수** | `NICEPAY_MID`, `NICEPAY_KEY` | `NICEPAY_CLIENT_ID`, `NICEPAY_SECRET_KEY` |
| **승인 호출 위치** | 프론트엔드 | 백엔드 (returnUrl에서) |
| **금액 검증** | 없음 | 있음 (필수!) |

---

## ⚠️ 보안 주의사항

1. **Client ID는 프론트엔드에 노출 가능** (결제창 호출용)
2. **Secret Key는 절대 프론트엔드에 노출 금지** (서버만!)
3. **금액 검증 필수** (returnUrl에서 주문 금액과 비교)
4. **서명 검증 권장** (signature 값 확인)

---

## 📝 다음 작업

1. ✅ 환경 변수 재정리 (`NICEPAY_CLIENT_ID`, `NICEPAY_SECRET_KEY`)
2. ✅ `/api/payments/nicepay/callback` 엔드포인트 추가
3. ✅ `cart.html`의 `returnUrl` 수정
4. ✅ 승인 API 호출 로직 수정
5. ✅ `payment-result.html` 제거 또는 단순 로딩 페이지로 변경

---

생성일: 2026-02-06
작성자: AI Developer
참고: https://start.nicepay.co.kr/manual/quickguide/start.do
