# NicePay 결제 연동 최종 구현 가이드

## 📋 공식 매뉴얼 기반 정확한 구현

### **핵심 요약**

1. **환경 변수 2개만 필요**:
   - `NICEPAY_CLIENT_ID`: Client Key (S2_로 시작)
   - `NICEPAY_SECRET_KEY`: Secret Key (32자 hex)

2. **MID는 필요 없음**: API 호출 시 Client ID만 사용

3. **Authorization 방식**: `Basic Base64(ClientId:SecretKey)`

---

## 🔑 API 키 발급 가이드

### NicePay 관리자 페이지에서 확인

```
1. https://start.nicepay.co.kr/merchant/login/main.do 로그인
2. 상점 선택
3. 개발정보 탭 클릭
4. KEY 정보 섹션:

   ┌────────────────────────────────────────┐
   │ 결제창 승인 방식                        │
   │ ☑ Server 승인 모델 선택 (필수!)         │
   ├────────────────────────────────────────┤
   │ Client Key (클라이언트 키)             │
   │ S2_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   │ ← 복사
   ├────────────────────────────────────────┤
   │ API 인가 방식                          │
   │ ☑ Basic 인증 선택 (필수!)              │
   ├────────────────────────────────────────┤
   │ Secret Key (시크릿 키)                 │
   │ xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx      │ ← 복사
   └────────────────────────────────────────┘
```

---

## 💻 코드 구현

### 1. 프론트엔드 (cart.html)

```javascript
// NicePay 결제 실행
function initiateNicePayPayment(order, shippingInfo) {
    console.log('🔵 NicePay 결제 시작:', order);
    
    // 상품명 생성
    const goodsName = cartItems.length > 1 
        ? `${cartItems[0].product_name} 외 ${cartItems.length - 1}건`
        : cartItems[0].product_name;
    
    // NicePay 결제창 호출
    AUTHNICE.requestPay({
        clientId: window.NICEPAY_CLIENT_ID,  // 환경 변수에서 주입
        method: 'card',
        orderId: order.orderNo,
        amount: order.totalAmount,
        goodsName: goodsName,
        returnUrl: window.location.origin + '/api/payments/nicepay/callback',  // 서버 엔드포인트!
        buyerName: shippingInfo.recipientName,
        buyerTel: shippingInfo.recipientPhone,
        buyerEmail: shippingInfo.recipientEmail || '',
        mallReserved: JSON.stringify({
            orderNo: order.orderNo,
            userId: userId
        }),
        fnError: function(result) {
            console.error('❌ 결제 실패:', result);
            alert('결제 중 오류가 발생했습니다.\n' + result.errorMsg);
        }
    });
}
```

### 2. 백엔드 (src/index.tsx)

#### A. 결제창 응답 수신 엔드포인트

```typescript
// POST /api/payments/nicepay/callback
app.post('/api/payments/nicepay/callback', async (c) => {
  const { DB } = c.env;
  
  try {
    // 1. 결제창 응답 데이터 파싱
    const body = await c.req.parseBody();
    console.log('📥 NicePay 결제창 응답:', body);
    
    const {
      authResultCode,
      authResultMsg,
      tid,
      orderId,
      amount,
      authToken,
      signature,
      mallReserved
    } = body;
    
    // 2. 인증 결과 확인
    if (authResultCode !== '0000') {
      console.error('❌ 인증 실패:', authResultMsg);
      return c.redirect(`/cart?error=${encodeURIComponent(authResultMsg)}`);
    }
    
    // 3. 주문 정보 조회
    const order = await DB.prepare(`
      SELECT * FROM orders WHERE order_number = ?
    `).bind(orderId).first();
    
    if (!order) {
      console.error('❌ 주문 없음:', orderId);
      return c.json({ success: false, error: 'Order not found' }, 404);
    }
    
    // 4. 금액 검증 (필수!)
    const requestAmount = parseInt(amount as string);
    if (requestAmount !== order.total_amount) {
      console.error('❌ 금액 불일치:', { 
        request: requestAmount, 
        order: order.total_amount 
      });
      return c.json({ success: false, error: 'Amount mismatch' }, 400);
    }
    
    // 5. 위변조 검증 (signature)
    const expectedSignature = await generateSignature(
      authToken as string,
      c.env.NICEPAY_CLIENT_ID,
      amount as string,
      c.env.NICEPAY_SECRET_KEY
    );
    
    if (signature !== expectedSignature) {
      console.error('❌ 서명 불일치');
      return c.json({ success: false, error: 'Signature mismatch' }, 400);
    }
    
    // 6. 승인 API 호출
    console.log('🔵 승인 API 호출 중...');
    const approvalResult = await approvePayment(
      c.env.NICEPAY_CLIENT_ID,
      c.env.NICEPAY_SECRET_KEY,
      tid as string,
      requestAmount
    );
    
    // 7. 승인 성공 처리
    if (approvalResult.resultCode === '0000') {
      console.log('✅ 결제 승인 성공');
      
      // 주문 상태 업데이트
      await DB.prepare(`
        UPDATE orders 
        SET payment_status = 'approved',
            payment_key = ?,
            transaction_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE order_number = ?
      `).bind(approvalResult.tid, approvalResult.tid, orderId).run();
      
      // 장바구니 비우기
      if (order.user_id) {
        await DB.prepare(`
          DELETE FROM cart_items WHERE user_id = ?
        `).bind(order.user_id).run();
      }
      
      // 주문 완료 페이지로 리다이렉트
      return c.redirect(`/order-complete?orderNo=${orderId}`);
      
    } else {
      console.error('❌ 승인 실패:', approvalResult);
      return c.json({ 
        success: false, 
        error: approvalResult.resultMsg 
      }, 500);
    }
    
  } catch (error) {
    console.error('❌ 결제 처리 오류:', error);
    return c.json({ 
      success: false, 
      error: (error as Error).message 
    }, 500);
  }
});
```

#### B. 승인 API 호출 함수

```typescript
async function approvePayment(
  clientId: string,
  secretKey: string,
  tid: string,
  amount: number
) {
  // Basic Auth 생성
  const credentials = btoa(`${clientId}:${secretKey}`);
  
  console.log('승인 API 요청:', {
    tid,
    amount,
    clientId: clientId.substring(0, 10) + '...'
  });
  
  // 승인 API 호출
  const response = await fetch(
    `https://api.nicepay.co.kr/v1/payments/${tid}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify({ amount })
    }
  );
  
  const result = await response.json();
  console.log('승인 API 응답:', result);
  
  return result;
}
```

#### C. 서명 검증 함수

```typescript
async function generateSignature(
  authToken: string,
  clientId: string,
  amount: string,
  secretKey: string
): Promise<string> {
  // sha256(authToken + clientId + amount + secretKey)
  const data = authToken + clientId + amount + secretKey;
  
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  
  // hex 변환
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}
```

---

## 🚀 환경 변수 설정 명령어

```bash
# Client ID 설정
echo "S2_your_actual_client_id" | npx wrangler pages secret put NICEPAY_CLIENT_ID --project-name toss-live-commerce

# Secret Key 설정  
echo "your_actual_secret_key" | npx wrangler pages secret put NICEPAY_SECRET_KEY --project-name toss-live-commerce

# 설정 확인
npx wrangler pages secret list --project-name toss-live-commerce
```

---

## ✅ 구현 체크리스트

- [ ] NicePay 관리자 페이지에서 Server 승인 모델 선택
- [ ] NicePay 관리자 페이지에서 Basic 인증 선택
- [ ] Client Key 복사
- [ ] Secret Key 복사
- [ ] Cloudflare에 NICEPAY_CLIENT_ID 환경 변수 설정
- [ ] Cloudflare에 NICEPAY_SECRET_KEY 환경 변수 설정
- [ ] `/api/payments/nicepay/callback` 엔드포인트 구현
- [ ] `cart.html`의 `returnUrl` 수정
- [ ] 금액 검증 로직 구현
- [ ] 서명 검증 로직 구현
- [ ] 승인 API 호출 로직 구현
- [ ] 배포 및 테스트

---

## 📊 현재 상태

| 항목 | 상태 | 설명 |
|------|------|------|
| 환경 변수 플레이스홀더 | ✅ | `%%NICEPAY_CLIENT_ID%%` 준비됨 |
| Worker 주입 로직 | ✅ | `/cart` 라우트에서 주입 |
| 결제창 호출 로직 | ✅ | `cart.html`에 구현됨 |
| 결제창 응답 수신 | ⏳ | `/api/payments/nicepay/callback` 구현 예정 |
| 승인 API 호출 | ⏳ | `approvePayment()` 함수 구현 예정 |
| 서명 검증 | ⏳ | `generateSignature()` 함수 구현 예정 |

---

## 🎯 다음 단계

**API 키를 받으시면:**
1. 저에게 Client ID와 Secret Key 알려주세요
2. 즉시 환경 변수 설정
3. 코드 구현 및 배포
4. 테스트

**테스트 계정으로 먼저 진행하시려면:**
- 샌드박스 테스트 키로 개발 완료
- 나중에 실제 키로 환경 변수만 교체

