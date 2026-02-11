# 🎯 Toss Live Commerce - 남은 구현 작업

## 📊 현재 상태 요약
**✅ 완료된 핵심 기능**: 95%
- 인증 시스템 ✅
- 결제 위젯 통합 ✅
- 장바구니 & 주문 ✅
- 라이브 커머스 UI ✅
- 셀러 관리 ✅

**⚠️ 미완성/개선 필요**: 5%

---

## 🚧 필수 완성 작업 (Phase 1 - 즉시)

### 1. 결제 시스템 DB 연동 ⭐⭐⭐
**현재 상태**: 결제 승인 API는 작동하지만 DB 저장 없음 (주석 처리됨)

**필요 작업**:
```sql
-- 1.1 payments 테이블 생성 (마이그레이션)
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  payment_key TEXT NOT NULL,
  method TEXT NOT NULL,           -- 카드, 가상계좌, 간편결제 등
  amount INTEGER NOT NULL,
  status TEXT DEFAULT 'completed', -- completed, failed, cancelled
  approved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_no)
);

-- 1.2 orders 테이블에 결제 관련 컬럼 추가 (이미 있을 수 있음)
ALTER TABLE orders ADD COLUMN payment_key TEXT;
ALTER TABLE orders ADD COLUMN payment_method TEXT;
```

**코드 수정**:
- `src/index.tsx` 3833-3843번 라인 주석 해제
- 결제 승인 후 DB 저장 로직 활성화
- 주문 상태 `pending` → `paid` 업데이트

---

### 2. 주문 생성 API 완성 ⭐⭐⭐
**현재 상태**: `POST /api/orders` API가 있지만 결제 연동 부족

**필요 작업**:
```typescript
// CheckoutPage에서 결제 완료 후 호출
// POST /api/orders
{
  userId: string,
  orderNo: string,        // ORDER_{timestamp}_{random}
  items: [
    {
      productId: number,
      quantity: number,
      priceSnapshot: number,
      optionValue?: string
    }
  ],
  totalAmount: number,
  shippingAddress: {
    recipientName: string,
    phone: string,
    postalCode: string,
    address: string,
    addressDetail: string
  },
  paymentKey: string,     // 토스페이먼츠 paymentKey
  paymentMethod: string   // 결제 수단
}
```

**구현 위치**:
- `src/index.tsx` - Order API 섹션 (1976번 라인 근처)

---

### 3. 재고 차감 로직 ⭐⭐⭐
**현재 상태**: 주문 생성 시 재고 확인만 하고 차감 안함

**필요 작업**:
```typescript
// 결제 성공 시 재고 차감
// PaymentSuccessPage에서 주문 생성 후 실행
await DB.prepare(`
  UPDATE products 
  SET stock = stock - ? 
  WHERE id = ? AND stock >= ?
`).bind(quantity, productId, quantity).run();

// 상품 옵션이 있는 경우
await DB.prepare(`
  UPDATE product_options 
  SET stock = stock - ? 
  WHERE id = ? AND stock >= ?
`).bind(quantity, optionId, quantity).run();
```

**구현 위치**:
- `src/pages/PaymentSuccessPage.tsx` - 결제 승인 후
- `src/index.tsx` - POST /api/orders 내부

---

### 4. 장바구니 비우기 개선 ⭐⭐
**현재 상태**: PaymentSuccessPage에서 localStorage만 업데이트

**필요 작업**:
```typescript
// 결제 완료 후 DB에서도 장바구니 비우기
const userId = getUserId();
await axios.delete(`/api/cart/clear/${userId}`);

// 백엔드 API 추가
app.delete('/api/cart/clear/:userId', async (c) => {
  const userId = c.req.param('userId');
  await DB.prepare('DELETE FROM cart_items WHERE user_id = ?')
    .bind(userId).run();
  return c.json({ success: true });
});
```

---

## 🎨 UX 개선 작업 (Phase 2 - 중요도 높음)

### 5. 결제 성공 페이지 개선 ⭐⭐
**현재 상태**: 기본 정보만 표시

**개선 사항**:
- 주문 상세 정보 표시 (상품 목록, 배송지, 금액)
- 주문번호 강조 표시
- "주문 상세보기" 버튼 추가 (`/my-orders` 이동)
- 예상 배송일 표시

---

### 6. MyOrdersPage 개선 ⭐⭐
**현재 상태**: 주문 목록 기본 표시

**개선 사항**:
- 주문 상태별 필터 (전체, 결제완료, 배송중, 배송완료, 취소)
- 주문 상세 모달
- 배송 추적 링크
- 재주문 버튼

---

### 7. 에러 처리 개선 ⭐
**현재 상태**: alert() 사용

**개선 사항**:
- Toast 알림 컴포넌트 도입
- 에러 페이지 개선
- 네트워크 오류 재시도 옵션

---

## 💼 비즈니스 로직 (Phase 3 - 선택적)

### 8. 주문 상태 관리 시스템 ⭐⭐
**필요 작업**:
```typescript
// 주문 상태 전환
// pending → paid → preparing → shipping → delivered → completed
// 취소: paid → cancelled

// API 추가
POST /api/orders/:orderId/status
{
  status: 'preparing' | 'shipping' | 'delivered',
  trackingNumber?: string  // 배송중일 때
}
```

---

### 9. 토스페이먼츠 웹훅 처리 ⭐
**목적**: 가상계좌 입금, 결제 취소 등 비동기 이벤트 처리

**필요 작업**:
```typescript
// POST /api/payments/webhook
app.post('/api/payments/webhook', async (c) => {
  const body = await c.req.json();
  const { eventType, data } = body;
  
  switch(eventType) {
    case 'PAYMENT_STATUS_CHANGED':
      // 결제 상태 변경 처리
      break;
    case 'VIRTUAL_ACCOUNT_ISSUED':
      // 가상계좌 발급
      break;
    case 'VIRTUAL_ACCOUNT_DEPOSITED':
      // 가상계좌 입금 완료
      break;
  }
});
```

---

### 10. 정산 시스템 ⭐
**목적**: 셀러별 판매 금액 정산

**필요 작업**:
- `settlements` 테이블 생성
- 셀러별 정산 내역 조회 API
- 정산 요청/승인 플로우
- 세금계산서 자동 발행 (바로빌 연동 - 이미 준비됨)

---

## 🔧 기술 개선 (Phase 4 - 선택적)

### 11. 실시간 기능 (WebSocket 대안) ⭐
**Cloudflare Workers 제약**: WebSocket 미지원

**대안**:
- **Durable Objects** 사용 (Cloudflare 유료 플랜)
- **Server-Sent Events (SSE)** 사용 (단방향)
- **폴링(Polling)** 방식 (간단, 현실적)

**구현 예시** (폴링):
```typescript
// LivePage에서 10초마다 현재 상품 확인
useEffect(() => {
  const interval = setInterval(async () => {
    const response = await axios.get(`/api/live-streams/${streamId}`);
    setCurrentProduct(response.data.current_product);
  }, 10000);
  
  return () => clearInterval(interval);
}, [streamId]);
```

---

### 12. 이미지 최적화 ⭐
**현재 상태**: 원본 이미지 그대로 사용

**개선**:
- Cloudflare Images 연동
- 이미지 리사이징/압축
- WebP 포맷 자동 변환
- Lazy loading 개선

---

### 13. 캐싱 전략 ⭐
**필요 작업**:
- Cloudflare CDN 캐시 설정
- API 응답 캐싱 (상품 목록, 라이브 목록)
- 브라우저 캐시 최적화

---

### 14. 성능 모니터링 ⭐
**도구 도입**:
- Sentry (에러 트래킹)
- Cloudflare Analytics
- Google Analytics

---

## 📱 모바일 최적화 (Phase 5 - 선택적)

### 15. 모바일 UX 개선 ⭐
- 하단 네비게이션 바 추가
- 터치 제스처 지원
- 모바일 결제 UI 최적화
- PWA 지원 (오프라인 모드)

---

## 🧪 테스트 & QA (Phase 6 - 필수)

### 16. E2E 테스트 ⭐⭐
**필요 작업**:
- Playwright 설정
- 핵심 플로우 테스트 작성
  - 로그인 → 장바구니 → 결제
  - 셀러 로그인 → 상품 등록 → 라이브 생성

---

### 17. 부하 테스트 ⭐
**목적**: 동시 접속자 100명 이상 테스트
- Cloudflare Workers 제한 확인
- D1 Database 쿼리 최적화

---

## 📋 우선순위 요약

### 🔥 즉시 (1-2일)
1. ✅ 결제 시스템 DB 연동
2. ✅ 주문 생성 API 완성
3. ✅ 재고 차감 로직
4. ✅ 장바구니 비우기 개선

### 🚀 중요 (3-5일)
5. 결제 성공 페이지 개선
6. MyOrdersPage 개선
7. 에러 처리 개선
8. 주문 상태 관리 시스템

### 💡 추가 (1-2주)
9. 토스페이먼츠 웹훅
10. 정산 시스템
11. 실시간 기능 (폴링)
12. 이미지 최적화

### 🎁 보너스 (선택적)
13. 캐싱 전략
14. 성능 모니터링
15. 모바일 최적화
16. E2E 테스트
17. 부하 테스트

---

## 🎯 다음 스텝 제안

**지금 바로 시작할 작업**:
1. **결제 DB 연동** - 가장 중요, 현재 결제는 토스만 승인하고 DB 미저장
2. **재고 차감** - 결제 완료 시 재고 감소 로직
3. **주문 생성 완성** - CheckoutPage → PaymentSuccessPage → DB 저장 플로우

**구현 순서**:
```
1. migrations/000X_add_payments_table.sql 생성
2. src/index.tsx - payments 테이블 저장 로직 활성화
3. src/pages/PaymentSuccessPage.tsx - 주문 생성 API 호출
4. src/index.tsx - POST /api/orders 재고 차감 로직 추가
5. 테스트: 결제 → DB 확인 → 재고 확인
```

---

**현재 상태**: ✅ 95% 완료  
**남은 핵심 작업**: 결제 DB 연동, 재고 차감, 주문 완성  
**예상 완료 시간**: 1-2일 (핵심 기능), 1-2주 (전체 개선)

**마지막 업데이트**: 2026-02-11
