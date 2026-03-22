# 토스페이먼츠 PG 구현 미비 사항 점검

## 🚨 심각도 높음 (필수 구현)

### 1. ❌ **금액 검증 로직 없음** (보안 취약점!)

**현재 상태:**
```typescript
// src/index.tsx - app.post('/api/payments/confirm')
const { paymentKey, orderId, amount } = body;

// ❌ 클라이언트가 보낸 금액을 그대로 믿음!
// 해커가 100원짜리 상품을 1원으로 조작 가능!
```

**문제점:**
- 클라이언트에서 전송한 `amount`를 서버에서 검증하지 않음
- 사용자가 브라우저 개발자도구로 금액 조작 가능
- **심각한 보안 취약점!**

**해결 방법:**
```typescript
app.post('/api/payments/confirm', async (c) => {
  const { DB } = c.env;
  const { paymentKey, orderId, amount } = await c.req.json();

  // ✅ 1. DB에서 주문 정보 조회
  const order = await DB.prepare(`
    SELECT total_amount FROM orders WHERE order_no = ?
  `).bind(orderId).first();

  // ✅ 2. 금액 검증
  if (!order) {
    return c.json({ 
      success: false, 
      error: '주문을 찾을 수 없습니다.' 
    }, 404);
  }

  if (order.total_amount !== amount) {
    console.error('[Payment] 금액 불일치:', {
      orderAmount: order.total_amount,
      requestAmount: amount,
      orderId
    });
    
    return c.json({ 
      success: false, 
      error: '결제 금액이 일치하지 않습니다.' 
    }, 400);
  }

  // ✅ 3. 검증 통과 후 결제 승인
  const paymentResult = await provider.confirmPayment({
    paymentKey,
    orderId,
    amount: order.total_amount  // DB의 금액 사용!
  });
  
  // ...
});
```

---

### 2. ❌ **중복 결제 방지 로직 없음**

**현재 상태:**
```typescript
// 동일한 orderId로 여러 번 결제 승인 가능!
// 사용자가 F5 새로고침 → 중복 결제 발생 가능!
```

**문제점:**
- 같은 주문에 대해 여러 번 결제 가능
- 네트워크 지연으로 중복 클릭 시 중복 결제
- 고객 불만 및 환불 처리 필요

**해결 방법:**
```typescript
app.post('/api/payments/confirm', async (c) => {
  const { DB } = c.env;
  const { paymentKey, orderId, amount } = await c.req.json();

  // ✅ 1. 이미 결제된 주문인지 확인
  const existingPayment = await DB.prepare(`
    SELECT id FROM payments WHERE order_id = ? AND status = 'completed'
  `).bind(orderId).first();

  if (existingPayment) {
    console.warn('[Payment] 중복 결제 시도:', orderId);
    return c.json({ 
      success: false, 
      error: '이미 결제가 완료된 주문입니다.' 
    }, 400);
  }

  // ✅ 2. 주문 상태 확인
  const order = await DB.prepare(`
    SELECT status FROM orders WHERE order_no = ?
  `).bind(orderId).first();

  if (order?.status === 'paid') {
    console.warn('[Payment] 이미 결제 완료된 주문:', orderId);
    return c.json({ 
      success: false, 
      error: '이미 결제가 완료된 주문입니다.' 
    }, 400);
  }

  // ✅ 3. 결제 진행
  // ...
});
```

---

### 3. ❌ **웹훅(Webhook) 미구현**

**현재 상태:**
- 웹훅 엔드포인트 없음
- 가상계좌 입금 알림 받을 수 없음
- 결제 상태 변경 알림 받을 수 없음

**문제점:**
- 가상계좌 발급 후 입금 확인 불가
- 결제 취소/환불 알림 받을 수 없음
- PG사에서 보내는 이벤트 처리 불가

**해결 방법:**
```typescript
// src/index.tsx

// ✅ 웹훅 엔드포인트 추가
app.post('/api/webhooks/toss', async (c) => {
  const { DB } = c.env;
  
  try {
    const event = await c.req.json();
    console.log('[Webhook] Toss Payments 이벤트 수신:', event);

    // ✅ 1. 웹훅 시그니처 검증 (선택적, 보안 강화)
    // const signature = c.req.header('Toss-Signature');
    // if (!verifyWebhookSignature(signature, event)) {
    //   return c.json({ success: false, error: 'Invalid signature' }, 401);
    // }

    // ✅ 2. 이벤트 타입별 처리
    switch (event.eventType) {
      case 'PAYMENT_STATUS_CHANGED':
        // 결제 상태 변경 (가상계좌 입금 등)
        console.log('[Webhook] 결제 상태 변경:', event);
        
        // DB 업데이트
        await DB.prepare(`
          UPDATE orders 
          SET status = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE order_no = ?
        `).bind(
          event.data.status === 'DONE' ? 'paid' : 'pending',
          event.data.status,
          event.data.orderId
        ).run();
        
        break;

      case 'VIRTUAL_ACCOUNT_DEPOSIT':
        // 가상계좌 입금 완료
        console.log('[Webhook] 가상계좌 입금 완료:', event);
        
        // DB 업데이트
        await DB.prepare(`
          UPDATE orders 
          SET status = 'paid', payment_status = 'completed', updated_at = CURRENT_TIMESTAMP
          WHERE order_no = ?
        `).bind(event.data.orderId).run();
        
        // TODO: 사용자에게 입금 완료 알림 전송 (이메일/SMS)
        
        break;

      case 'PAYMENT_CANCELED':
        // 결제 취소
        console.log('[Webhook] 결제 취소:', event);
        
        await DB.prepare(`
          UPDATE orders 
          SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
          WHERE order_no = ?
        `).bind(event.data.orderId).run();
        
        break;

      default:
        console.warn('[Webhook] 알 수 없는 이벤트 타입:', event.eventType);
    }

    return c.json({ success: true });
    
  } catch (error) {
    console.error('[Webhook] 처리 중 오류:', error);
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});
```

**Toss Payments 개발자센터 설정:**
```
1. https://developers.tosspayments.com/my/settings 접속
2. 웹훅 URL 등록: https://live.ur-team.com/api/webhooks/toss
3. 이벤트 타입 선택:
   - 결제 상태 변경
   - 가상계좌 입금
   - 결제 취소
```

---

## ⚠️ 심각도 중간 (권장 구현)

### 4. ⚠️ **결제 취소/환불 API 미구현**

**현재 상태:**
- 결제 취소 기능 없음
- 환불 처리 불가

**해결 방법:**
```typescript
// src/index.tsx

// ✅ 결제 취소 API
app.post('/api/payments/cancel', async (c) => {
  const { DB } = c.env;
  const { paymentKey, cancelReason } = await c.req.json();

  if (!paymentKey || !cancelReason) {
    return c.json({ 
      success: false, 
      error: '필수 파라미터가 누락되었습니다.' 
    }, 400);
  }

  try {
    const secretKey = c.env.TOSS_SECRET_KEY;
    
    // Toss Payments 취소 API 호출
    const response = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(secretKey + ':')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cancelReason })
    });

    if (!response.ok) {
      const error = await response.json();
      return c.json({ 
        success: false, 
        error: error.message 
      }, response.status);
    }

    const result = await response.json();

    // DB 업데이트
    await DB.prepare(`
      UPDATE orders 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE payment_key = ?
    `).bind(paymentKey).run();

    await DB.prepare(`
      UPDATE payments 
      SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
      WHERE pg_payment_key = ?
    `).bind(paymentKey).run();

    return c.json({ 
      success: true, 
      data: result 
    });

  } catch (error) {
    console.error('[Payment] 취소 실패:', error);
    return c.json({ 
      success: false, 
      error: (error as Error).message 
    }, 500);
  }
});
```

---

### 5. ⚠️ **결제 조회 API 미구현**

**현재 상태:**
- 결제 정보 조회 API 없음
- 결제 상태 확인 불가

**해결 방법:**
```typescript
// src/index.tsx

// ✅ 결제 조회 API
app.get('/api/payments/:paymentKey', async (c) => {
  const paymentKey = c.req.param('paymentKey');

  try {
    const secretKey = c.env.TOSS_SECRET_KEY;
    
    const response = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}`, {
      headers: {
        'Authorization': `Basic ${btoa(secretKey + ':')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      return c.json({ 
        success: false, 
        error: error.message 
      }, response.status);
    }

    const result = await response.json();

    return c.json({ 
      success: true, 
      data: result 
    });

  } catch (error) {
    console.error('[Payment] 조회 실패:', error);
    return c.json({ 
      success: false, 
      error: (error as Error).message 
    }, 500);
  }
});
```

---

### 6. ⚠️ **에러 처리 및 로깅 미흡**

**현재 상태:**
```typescript
catch (err) {
  console.error('결제 승인 처리 중 오류:', err);
  return c.json({ 
    success: false, 
    error: (err as Error).message 
  }, 500);
}
```

**개선 방법:**
```typescript
catch (err) {
  // ✅ 상세 에러 로깅
  console.error('[Payment] 결제 승인 실패:', {
    orderId,
    amount,
    error: (err as Error).message,
    stack: (err as Error).stack,
    timestamp: new Date().toISOString()
  });

  // ✅ 에러 타입별 분기 처리
  if (err instanceof NetworkError) {
    return c.json({ 
      success: false, 
      error: '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
    }, 503);
  }

  if (err instanceof ValidationError) {
    return c.json({ 
      success: false, 
      error: err.message 
    }, 400);
  }

  // ✅ 사용자 친화적 에러 메시지
  return c.json({ 
    success: false, 
    error: '결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.' 
  }, 500);
}
```

---

## 📝 심각도 낮음 (선택 구현)

### 7. 📌 **결제 재시도 로직**

```typescript
async function retryPayment(paymentFn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await paymentFn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.warn(`[Payment] 재시도 ${i + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

---

### 8. 📌 **결제 타임아웃 처리**

```typescript
// 결제창 열린 후 30분 이내 결제하지 않으면 주문 자동 취소
const PAYMENT_TIMEOUT = 30 * 60 * 1000; // 30분

setTimeout(async () => {
  const order = await DB.prepare(`
    SELECT status FROM orders WHERE order_no = ?
  `).bind(orderId).first();

  if (order?.status === 'pending') {
    await DB.prepare(`
      UPDATE orders SET status = 'timeout' WHERE order_no = ?
    `).bind(orderId).run();
  }
}, PAYMENT_TIMEOUT);
```

---

## 🎯 우선순위별 구현 순서

### 🔴 즉시 구현 필요 (보안 필수)
1. ✅ **금액 검증 로직** (가장 중요!)
2. ✅ **중복 결제 방지**

### 🟡 1주일 내 구현 권장
3. ✅ **웹훅 구현** (가상계좌 사용 시 필수)
4. ✅ **결제 취소/환불 API**

### 🟢 필요 시 구현
5. 결제 조회 API
6. 에러 처리 개선
7. 결제 재시도 로직
8. 결제 타임아웃 처리

---

## 📊 현재 구현 상태

| 기능 | 상태 | 우선순위 |
|------|------|----------|
| 결제 승인 | ✅ 구현됨 | - |
| 금액 검증 | ❌ **미구현** | 🔴 높음 |
| 중복 결제 방지 | ❌ **미구현** | 🔴 높음 |
| 웹훅 | ❌ **미구현** | 🟡 중간 |
| 결제 취소 | ❌ **미구현** | 🟡 중간 |
| 결제 조회 | ❌ 미구현 | 🟢 낮음 |
| 에러 처리 | ⚠️ 부족 | 🟡 중간 |

---

## 🚀 즉시 적용 가능한 수정 코드

```typescript
// src/index.tsx - 결제 승인 API 개선

app.post('/api/payments/confirm', async (c) => {
  const { DB } = c.env;
  
  try {
    const { paymentKey, orderId, amount } = await c.req.json();

    // ✅ 1. 필수 파라미터 검증
    if (!paymentKey || !orderId || !amount) {
      return c.json({
        success: false,
        error: '필수 파라미터가 누락되었습니다.'
      }, 400);
    }

    // ✅ 2. 중복 결제 방지
    const existingPayment = await DB.prepare(`
      SELECT id FROM payments WHERE order_id = ? AND status = 'completed'
    `).bind(orderId).first();

    if (existingPayment) {
      console.warn('[Payment] 중복 결제 시도:', orderId);
      return c.json({ 
        success: false, 
        error: '이미 결제가 완료된 주문입니다.' 
      }, 400);
    }

    // ✅ 3. 주문 조회 및 금액 검증
    const order = await DB.prepare(`
      SELECT total_amount, status FROM orders WHERE order_no = ?
    `).bind(orderId).first();

    if (!order) {
      return c.json({ 
        success: false, 
        error: '주문을 찾을 수 없습니다.' 
      }, 404);
    }

    if (order.status === 'paid') {
      return c.json({ 
        success: false, 
        error: '이미 결제가 완료된 주문입니다.' 
      }, 400);
    }

    // ✅ 4. 금액 검증 (가장 중요!)
    if (order.total_amount !== amount) {
      console.error('[Payment] 금액 불일치:', {
        orderAmount: order.total_amount,
        requestAmount: amount,
        orderId
      });
      
      return c.json({ 
        success: false, 
        error: '결제 금액이 일치하지 않습니다.' 
      }, 400);
    }

    // ✅ 5. PG 결제 승인 (DB 검증된 금액 사용)
    const pgProvider = c.env.PAYMENT_PG_PROVIDER || 'tosspayments';
    const secretKey = c.env.TOSS_SECRET_KEY;
    
    if (!secretKey) {
      return c.json({
        success: false,
        error: '결제 시스템 설정이 올바르지 않습니다.'
      }, 500);
    }

    const provider = createPaymentProvider(pgProvider, secretKey);
    
    const paymentResult = await provider.confirmPayment({
      paymentKey,
      orderId,
      amount: order.total_amount  // ✅ DB의 금액 사용!
    });

    if (!paymentResult.success) {
      console.error(`[Payment] ${pgProvider} 승인 실패:`, paymentResult.error);
      return c.json({
        success: false,
        error: paymentResult.error || '결제 승인에 실패했습니다.'
      }, 400);
    }

    // ✅ 6. DB 저장 (기존 로직)
    await DB.prepare(`
      INSERT INTO payments (
        order_id, pg_provider, pg_payment_key, pg_transaction_id,
        method, amount, status, 
        card_company, card_number, installment_months,
        virtual_account_bank, virtual_account_number, 
        virtual_account_holder, virtual_account_due_date,
        approved_at, pg_raw_data, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      orderId,
      pgProvider,
      paymentResult.paymentKey,
      paymentResult.transactionId || null,
      paymentResult.method,
      paymentResult.totalAmount,
      paymentResult.status,
      paymentResult.cardCompany || null,
      paymentResult.cardNumber || null,
      paymentResult.installmentMonths || null,
      paymentResult.virtualAccountBank || null,
      paymentResult.virtualAccountNumber || null,
      paymentResult.virtualAccountHolder || null,
      paymentResult.virtualAccountDueDate || null,
      paymentResult.approvedAt,
      JSON.stringify(paymentResult.rawData)
    ).run();

    await DB.prepare(`
      UPDATE orders 
      SET status = 'paid', 
          payment_key = ?,
          payment_status = 'completed',
          updated_at = CURRENT_TIMESTAMP 
      WHERE order_no = ?
    `).bind(paymentResult.paymentKey, orderId).run();

    console.log(`✅ 결제 승인 완료 [${pgProvider}]: ${orderId}`);

    return c.json({
      success: true,
      data: {
        orderId: paymentResult.orderId,
        paymentKey: paymentResult.paymentKey,
        method: paymentResult.method,
        totalAmount: paymentResult.totalAmount,
        status: paymentResult.status,
        approvedAt: paymentResult.approvedAt,
        pgProvider: pgProvider
      }
    });
    
  } catch (err) {
    console.error('[Payment] 결제 승인 실패:', {
      error: (err as Error).message,
      stack: (err as Error).stack,
      timestamp: new Date().toISOString()
    });
    
    return c.json({ 
      success: false, 
      error: '결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.' 
    }, 500);
  }
});
```

---

## ✅ 결론

**즉시 수정이 필요한 심각한 보안 취약점:**
1. 🔴 **금액 검증 로직 없음** → 해커가 금액 조작 가능!
2. 🔴 **중복 결제 방지 없음** → 중복 결제 발생 가능!

**권장 구현:**
3. 🟡 웹훅 (가상계좌 사용 시 필수)
4. 🟡 결제 취소/환불 API

위 수정 코드를 적용하시겠습니까?
