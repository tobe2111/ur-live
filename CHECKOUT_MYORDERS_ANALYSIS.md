# Checkout & MyOrders 페이지 코드 분석

**분석 일시**: 2026-03-17 02:30 UTC  
**상태**: 코드 분석 완료, 기능 테스트 대기 중

---

## ✅ Checkout Page Analysis

### 파일 정보
- **파일**: `src/client/pages/CheckoutPage.tsx` (392 lines)
- **의존성**: `react-hook-form`, `useCart`, `useAuthStore`, `api`

### 구현된 기능

#### 1. 배송지 정보 입력 ✅
- **Form Fields**:
  - `recipient_name`: 수령인 이름 (기본값: `user?.name`)
  - `phone`: 전화번호 (기본값: `user?.phone`)
  - `postal_code`: 우편번호
  - `address1`: 주소
  - `address2`: 상세 주소
  - `city`: 도시
  - `memo`: 배송 메모
- **Validation**: `react-hook-form` 사용
- **Default Values**: 로그인한 사용자 정보 자동 입력

#### 2. 멀티 셀러 주문 생성 ✅
- **로직** (lines 92-114):
  ```typescript
  const orderPromises = sellerGroups.map(async (group: SellerCartGroup) => {
    const idempotencyKey = `${orderNumber}:${group.seller_id}`;
    
    const response = await api.post<ApiResponse<Order>>('/orders', {
      seller_id: group.seller_id,
      order_number: orderNumber,
      items: group.items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        options: item.options,
      })),
      shipping_address: shippingAddress,
      shipping_name: formData.recipient_name,
      shipping_phone: formData.phone,
      shipping_memo: formData.memo || undefined,
      idempotency_key: idempotencyKey,
    });
    
    return response.data;
  });
  
  const orders = await Promise.all(orderPromises);
  ```
- **특징**:
  - 셀러별로 개별 주문 생성
  - Idempotency key 사용 (중복 요청 방지)
  - 병렬 처리 (`Promise.all`)

#### 3. Toss Payments 통합 ✅
- **결제 세션 생성** (lines 120-129):
  ```typescript
  const sessionResponse = await api.post<ApiResponse<CheckoutSessionData>>(
    '/payments/checkout-session',
    { order_number: orderNumber }
  );
  ```
- **Toss SDK 초기화** (lines 143-176):
  - SDK 로드: `loadTossScript()`
  - `window.TossPayments(session.toss_client_key)` 초기화
  - `requestPayment('카드', { ... })` 호출
- **Redirect URLs**:
  - Success: `/payment/success`
  - Fail: `/payment/fail`

#### 4. UI/UX ✅
- 빈 장바구니 시 `/cart`로 리다이렉트
- 에러 메시지 표시
- 로딩 상태 관리 (`isSubmitting`)
- 주문 요약 정보 표시

### 예상 문제 및 해결
| 문제 | 원인 | 해결 방법 |
|------|------|-----------|
| Toss SDK 로드 실패 | CSP 정책 | ✅ 이미 CSP에 `https://js.tosspayments.com` 추가됨 |
| 주문 생성 실패 | API 응답 형식 불일치 | 확인 필요: `/orders` POST 엔드포인트 |
| 결제 세션 생성 실패 | `/payments/checkout-session` 미구현 | 백엔드 구현 확인 필요 |

### 테스트 체크리스트
- [ ] 배송지 정보 입력 및 validation
- [ ] 멀티 셀러 주문 생성 (셀러별 개별 주문)
- [ ] Toss 위젯 로드 및 표시
- [ ] 샌드박스 결제 플로우 (카드 결제)
- [ ] `/payment/success` 리다이렉트
- [ ] 에러 처리 (네트워크 오류, API 실패 등)

---

## ✅ MyOrders Pages Analysis

### 1. Order List Page

#### 파일 정보
- **파일**: `src/client/pages/OrderListPage.tsx` (80 lines)
- **API**: `GET /api/orders`
- **응답 형식**: `{ success: true, data: { items: Order[], total, page, limit, has_next } }`

#### 구현된 기능
1. **주문 목록 조회** ✅
   ```typescript
   const { data, isLoading, error } = useQuery({
     queryKey: ['orders'],
     queryFn: () => api.get<ApiResponse<PaginatedResponse<Order>>>('/orders'),
   });
   
   const orders = data?.data?.items ?? [];
   ```
   - ✅ **API 응답 형식 호환**: `data?.data?.items` 사용 (올바름!)

2. **주문 정보 표시** ✅
   - 주문 번호 (`order_number`)
   - 주문 상태 (`status`) - 색상 코드 포함
   - 주문 일시 (`created_at`)
   - 주문 항목 (첫 번째 상품명 + "외 N건")
   - 총 금액 (`total_amount`)

3. **빈 상태 처리** ✅
   - 주문 내역 없을 때 "쇼핑 시작하기" 버튼

4. **Navigation** ✅
   - 주문 클릭 시 `/orders/:id`로 이동

#### 테스트 체크리스트
- [ ] 주문 목록 로드
- [ ] 빈 주문 내역 표시
- [ ] 주문 상세 페이지 이동
- [ ] 로딩 상태 표시
- [ ] 에러 처리

---

### 2. Order Detail Page

#### 파일 정보
- **파일**: `src/client/pages/OrderDetailPage.tsx` (129 lines)
- **API**: `GET /api/orders/:id`
- **응답 형식**: `{ success: true, data: Order }`

#### 구현된 기능
1. **주문 상세 조회** ✅
   ```typescript
   const { data, isLoading } = useQuery({
     queryKey: ['order', id],
     queryFn: () => api.get<ApiResponse<Order>>(`/orders/${id}`),
     enabled: !!id,
   });
   
   const order = data?.data;
   ```
   - ✅ **API 응답 형식 호환**: `data?.data` 사용 (올바름!)

2. **주문 정보 표시** ✅
   - 주문 번호, 상태
   - 주문 항목 (상품명, 수량, 단가, 소계)
   - 가격 정보 (상품 금액, 배송비, 총 결제 금액)
   - 배송 정보 (수령인, 전화번호, 주소, 메모)
   - 운송장 번호 (있을 경우)
   - 주문/결제 일시

3. **Navigation** ✅
   - 뒤로 가기 버튼 (`/orders`)

#### 테스트 체크리스트
- [ ] 주문 상세 조회
- [ ] 주문 항목 표시
- [ ] 배송 정보 표시
- [ ] 운송장 정보 표시 (있을 경우)
- [ ] 주문 목록으로 돌아가기

---

## 🔍 백엔드 API 확인

### Orders API (Worker)
**파일**: `src/worker/routes/order.routes.ts`

#### GET /api/orders (주문 목록)
```typescript
// Lines 200-227
ordersRouter.get('/', async (c) => {
  const userId = c.get('user').id;
  const { page = '1', limit = '20' } = c.req.query();
  const orderRepo = new OrderRepository(c.env.DB);

  const { orders, total } = await orderRepo.findByUserId(
    userId,
    parseInt(page, 10),
    Math.min(parseInt(limit, 10), 100)
  );

  return c.json({
    success: true,
    data: {
      items: orders,  // ✅ Paginated 형식
      total,
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
      has_next: parseInt(page, 10) * Math.min(parseInt(limit, 10), 100) < total,
    },
  });
});
```
- ✅ **응답 형식 올바름**: `{ success: true, data: { items: [...] } }`

#### GET /api/orders/:id (주문 상세)
```typescript
// Lines 229+
ordersRouter.get('/:id', async (c) => {
  const userId = c.get('user').id;
  const orderId = c.req.param('id');
  const orderRepo = new OrderRepository(c.env.DB);

  const order = await orderRepo.findById(orderId);

  if (!order) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }
  
  // 권한 확인 (userId === order.user_id)
  
  return c.json({ success: true, data: order });
});
```
- ✅ **응답 형식 올바름**: `{ success: true, data: Order }`

---

## 📊 분석 결과 요약

| 페이지 | API 형식 | 프론트엔드 코드 | 호환성 | 수정 필요 |
|--------|---------|----------------|--------|-----------|
| CheckoutPage | `/orders` POST | `response.data` | ✅ 호환 | ❌ 없음 |
| CheckoutPage | `/payments/checkout-session` | `response.data` | ⚠️ 확인 필요 | 백엔드 확인 |
| OrderListPage | `/orders` GET | `data?.data?.items` | ✅ 호환 | ❌ 없음 |
| OrderDetailPage | `/orders/:id` GET | `data?.data` | ✅ 호환 | ❌ 없음 |

### ✅ 예상 결론
- **CheckoutPage**: 코드 수정 필요 없음, Toss SDK 및 `/payments/checkout-session` API 확인 필요
- **OrderListPage**: 코드 수정 필요 없음, 그대로 동작 예상
- **OrderDetailPage**: 코드 수정 필요 없음, 그대로 동작 예상

---

## 🚀 다음 단계

### 즉시 테스트 (High Priority)
1. **회원가입 및 로그인** (5분)
   - 신규 계정 생성 (`cart_test_001@test.com`)
   - 로그인 성공 확인

2. **Cart → Checkout 플로우** (10분)
   - 제품 담기
   - Cart 페이지 확인
   - Checkout 페이지 이동
   - 배송지 정보 입력
   - Toss 위젯 로드 확인
   - 샌드박스 결제 (테스트 카드)

3. **MyOrders 테스트** (10분)
   - 주문 목록 확인
   - 주문 상세 확인
   - 주문 취소 (구현 여부 확인)

### 백엔드 확인 필요
- [ ] `/api/payments/checkout-session` 엔드포인트 구현 여부
- [ ] Toss Payments Secret Key 환경 변수 설정
- [ ] 주문 취소 API (`POST /api/orders/:id/cancel` 또는 `DELETE /api/orders/:id`)

---

## 📚 관련 문서
- `RESTORATION_SUMMARY.md` - 전체 복원 진행 상황
- `CART_PAGE_ANALYSIS.md` - Cart 페이지 분석
- `CART_TEST_INSTRUCTIONS.md` - Cart 테스트 지침

---

**분석자**: Claude (Sonnet 3.5)  
**Repository**: https://github.com/tobe2111/ur-live  
**Branch**: main
