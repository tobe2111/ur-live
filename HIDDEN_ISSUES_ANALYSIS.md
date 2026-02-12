# 🚨 숨겨진 문제들 - 완전 분석 보고서

## 📊 발견된 심각한 문제들

### 🔴 문제 #1: 재고 차감 타이밍 오류 (CRITICAL)

#### 현재 플로우
```
1. 사용자가 결제 시작
2. ❌ 주문 생성 시점에 즉시 재고 차감 (src/index.tsx:2396-2402)
3. 사용자가 결제 창에서 취소
4. ❌ 재고 복원 안 됨!
```

#### 코드 위치
```typescript
// src/index.tsx - 라인 2396-2402
const stockUpdateResult = await DB.prepare(`
  UPDATE products 
  SET stock = stock - ?, 
      updated_at = datetime('now')
  WHERE id = ? 
    AND stock >= ?
`).bind(item.quantity, item.product_id, item.quantity).run();
```

#### 문제점
- **결제 전에 재고 차감**: 주문 생성 단계에서 즉시 차감
- **결제 실패 시 복원 안 됨**: PaymentFailPage.tsx에 재고 복원 로직 없음
- **장바구니 이탈 시 복원 안 됨**: 사용자가 브라우저를 닫으면 재고만 줄어듦
- **결제 취소 시 복원 안 됨**: 사용자가 결제 창에서 취소 버튼 클릭

#### 영향
- **재고 부족 발생**: 실제로는 재고가 있지만 시스템상으로는 품절 표시
- **매출 손실**: 정상 고객이 구매하지 못함
- **데이터 불일치**: DB 재고 ≠ 실제 재고

#### 올바른 플로우
```
1. 사용자가 결제 시작
2. ✅ 주문 생성 (재고 차감 안 함!)
3. 사용자가 결제 완료
4. ✅ 결제 승인 API에서 재고 차감
5. 실패 시 → 주문 취소 API 자동 호출
```

---

### 🔴 문제 #2: 주문 생성 시 status 컬럼 누락

#### 현재 코드
```typescript
// src/index.tsx - 라인 2373-2389
INSERT INTO orders (
  order_number, user_id, total_amount, payment_status,
  shipping_address, shipping_name, shipping_phone, shipping_memo,
  payment_key, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
```

#### 문제점
- `status` 컬럼이 INSERT 쿼리에 없음
- DB 기본값 `pending`에 의존
- 명시적이지 않아 나중에 혼란 발생 가능

#### 수정안
```typescript
INSERT INTO orders (
  order_number, user_id, total_amount, payment_status, status,  // ✅ status 추가
  shipping_address, shipping_name, shipping_phone, shipping_memo,
  payment_key, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
// bind(..., 'pending', 'pending', ...)
```

---

### 🟡 문제 #3: 결제 실패 시 주문 자동 취소 없음

#### 현재 상황
```typescript
// PaymentFailPage.tsx - 결제 실패 시
useEffect(() => {
  console.error('결제 실패:', { code, message, orderId })
  // ❌ 아무 처리도 안 함!
}, [code, message, orderId])
```

#### 문제점
- 결제 실패해도 주문은 `pending` 상태로 남음
- 관리자가 수동으로 처리해야 함
- 재고는 이미 차감된 상태 (문제 #1과 연결)

#### 수정안
```typescript
useEffect(() => {
  console.error('결제 실패:', { code, message, orderId })
  
  // ✅ 주문 자동 취소 및 재고 복원
  if (orderId) {
    axios.post(`/api/orders/${orderId}/cancel`, {
      reason: `결제 실패: ${code} - ${message}`
    }).catch(err => {
      console.error('주문 취소 실패:', err)
    })
  }
}, [code, message, orderId])
```

---

### 🟡 문제 #4: 재고 차감 로직 중복

#### 발견된 재고 차감 위치
```bash
src/index.tsx:2398   - POST /api/orders (주문 생성 시)
src/index.tsx:2507   - 다른 주문 생성 경로
src/index.tsx:2531   - 또 다른 주문 생성 경로
src/index.tsx:5686   - POST /api/orders/create
```

#### 문제점
- 4곳에서 재고 차감 코드 중복
- 각 경로마다 로직이 약간씩 다름
- 유지보수 어려움

#### 수정안
```typescript
// 재고 차감 함수 분리
async function decreaseStock(DB: D1Database, productId: number, quantity: number) {
  const result = await DB.prepare(`
    UPDATE products 
    SET stock = stock - ? 
    WHERE id = ? AND stock >= ?
  `).bind(quantity, productId, quantity).run();
  
  if (result.meta.changes === 0) {
    throw new Error('재고 부족');
  }
  
  return result;
}

// 재고 복원 함수 분리
async function restoreStock(DB: D1Database, productId: number, quantity: number) {
  await DB.prepare(`
    UPDATE products 
    SET stock = stock + ? 
    WHERE id = ?
  `).bind(quantity, productId).run();
}
```

---

### 🟡 문제 #5: 주문 취소 조건 오류

#### 현재 코드
```typescript
// src/index.tsx - 라인 4012
if (order.status !== 'pending') {
  return c.json({ 
    success: false, 
    error: '결제완료 상태에서만 취소가 가능합니다.' 
  }, 400);
}
```

#### 문제점
- **에러 메시지가 반대**: "결제완료 상태에서만 취소 가능" → 실제로는 `pending`만 취소 가능
- **로직 오류**: `status === 'pending'`일 때만 취소 가능하다고 체크
- **혼란 발생**: 사용자가 이해하기 어려움

#### 수정안
```typescript
if (order.status !== 'pending') {
  return c.json({ 
    success: false, 
    error: '결제 대기 중인 주문만 취소할 수 있습니다. 결제가 완료된 주문은 환불을 신청해주세요.' 
  }, 400);
}
```

---

## 📋 우선순위별 수정 계획

### 🔴 HIGH (모바일 서비스 핵심 기능)
1. **재고 차감 타이밍 수정** - 결제 승인 후로 이동
2. **결제 실패 시 주문 자동 취소** - 재고 복원
3. **주문 생성 시 status 명시** - 명확한 상태 관리

### 🟡 MEDIUM (코드 품질 개선)
4. **재고 차감/복원 함수 분리** - 중복 코드 제거
5. **주문 취소 조건 및 메시지 수정** - 사용자 경험 개선

---

## 🎯 수정 후 올바른 플로우

### ✅ 정상 결제 플로우
```
1. 장바구니 → 결제 페이지
2. 주문 생성 (status='pending', 재고 차감 안 함)
3. 결제 위젯 로드
4. 사용자 결제 완료
5. /api/payments/confirm 호출
6. ✅ 결제 승인 성공 → status='paid' + 재고 차감
7. 주문 완료 페이지
```

### ✅ 결제 실패 플로우
```
1. 장바구니 → 결제 페이지
2. 주문 생성 (status='pending', 재고 차감 안 함)
3. 결제 위젯 로드
4. 사용자 결제 실패 또는 취소
5. /payment/fail로 리다이렉트
6. ✅ 주문 취소 API 자동 호출 → status='cancelled'
7. (재고는 차감되지 않았으므로 복원 불필요)
```

---

## 🛠️ 즉시 적용 가능한 임시 해결책

### 결제 실패 시 재고 복원 (긴급)
```typescript
// PaymentFailPage.tsx에 추가
useEffect(() => {
  if (orderId) {
    // 주문 취소 API 호출
    axios.post(`/api/orders/${orderId}/cancel`, {
      reason: `결제 실패: ${code || 'UNKNOWN'}`
    }).catch(err => console.error('주문 취소 실패:', err))
  }
}, [orderId, code])
```

---

## 📊 테스트 체크리스트

- [ ] 정상 결제 → 재고 차감 확인
- [ ] 결제 취소 → 재고 복원 확인
- [ ] 결제 실패 → 주문 자동 취소 확인
- [ ] 브라우저 이탈 → 재고 상태 확인
- [ ] 동시 주문 → 재고 동시성 제어 확인

---

**작성일**: 2026-02-12 12:50 KST  
**우선순위**: 🔴 CRITICAL (재고 관리 핵심)  
**예상 영향**: 재고 부족 오류, 매출 손실 방지
