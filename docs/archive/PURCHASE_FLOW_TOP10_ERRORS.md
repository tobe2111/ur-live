# 🚨 구매 플로우 Top 10 에러 예상 및 수정

**날짜**: 2026-03-19
**플로우**: 로그인 → 장바구니 → 결제 → 주문 완료 → 주문 취소

---

## 📊 에러 우선순위

| # | 에러 | 발생 확률 | 영향도 | 우선순위 |
|---|------|----------|--------|---------|
| 1 | Cart API 401 Unauthorized | ⚠️ 높음 | 🔥 치명 | ⭐⭐⭐⭐⭐ |
| 2 | Checkout Order 생성 실패 (user_id 누락) | ⚠️ 높음 | 🔥 치명 | ⭐⭐⭐⭐⭐ |
| 3 | Payment Success 페이지 500 에러 | ⚠️ 높음 | 🔥 치명 | ⭐⭐⭐⭐⭐ |
| 4 | MyOrders 빈 배열 (Firebase UID ≠ DB ID) | ⚠️ 높음 | 🔥 치명 | ⭐⭐⭐⭐⭐ |
| 5 | Toss SDK 로드 실패 | ⚠️ 중간 | 🔥 치명 | ⭐⭐⭐⭐ |
| 6 | Checkout 빈 장바구니 리다이렉트 무한 루프 | ⚠️ 중간 | 🔥 치명 | ⭐⭐⭐⭐ |
| 7 | Cart 수량 업데이트 race condition | ⚠️ 낮음 | 🟡 중간 | ⭐⭐⭐ |
| 8 | Payment Fail 페이지 주문 복구 실패 | ⚠️ 낮음 | 🟡 중간 | ⭐⭐⭐ |
| 9 | Order Detail 404 (권한 체크 누락) | ⚠️ 낮음 | 🟡 중간 | ⭐⭐ |
| 10 | Shipping Fee 계산 오류 (null seller_info) | ⚠️ 낮음 | 🟢 낮음 | ⭐⭐ |

---

## 🔴 에러 #1: Cart API 401 Unauthorized

### 🎯 발생 단계
**로그인 → /cart 페이지 접근 → GET /api/cart**

### 🐛 예상 원인
```
✅ 이미 수정 완료 (PR #28)
- Firebase ID Token이 useAuthStore.accessToken에 저장되지 않음
- API 클라이언트가 Authorization 헤더 없이 요청
```

### ✅ 수정 상태
**이미 수정됨** - `KakaoCallbackPage.tsx`, `useAuthKR.ts`에서 토큰 저장 로직 추가

### 🧪 검증 방법
```bash
# 1. 로그인
https://live.ur-team.com
# 카카오로 시작하기 클릭

# 2. 장바구니 접근
https://live.ur-team.com/cart

# 3. 확인 포인트
✅ Network Tab: GET /api/cart → 200 OK
✅ Authorization: Bearer eyJhbGciOiJSUzI1... 헤더 존재
✅ cartData 객체 정상 로드 (items 배열 있음)
❌ 401 Unauthorized 없음
```

---

## 🔴 에러 #2: Checkout Order 생성 실패 (user_id 누락)

### 🎯 발생 단계
**결제 페이지 → "결제하기" 버튼 클릭 → POST /api/orders**

### 🐛 예상 원인
```ts
// src/client/pages/CheckoutPage.tsx (라인 95)
const response = await api.post<ApiResponse<Order>>('/orders', {
  seller_id: group.seller_id,
  order_number: orderNumber,
  items: group.items.map(...),
  shipping_address: shippingAddress,
  // ❌ user_id 누락!
  // Backend는 user_id를 필수로 요구함
});
```

**Backend 검증 로직**:
```ts
// src/features/orders/api/orders.routes.ts (라인 154)
if (!data.user_id || !data.seller_id || !data.items || data.items.length === 0) {
  return c.json({ success: false, error: 'Missing required fields' }, 400);
}
```

### 🔧 수정 방법
```diff
// src/client/pages/CheckoutPage.tsx (라인 75-115)

export function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();  // ✅ user 있음
  
  const onSubmit = async (formData: ShippingFormData) => {
+   // ✅ Firebase UID → DB integer ID 변환 필요
+   const userIdResponse = await api.get<ApiResponse<{ id: number }>>('/users/me');
+   if (!userIdResponse.success || !userIdResponse.data) {
+     throw new Error('사용자 정보를 가져올 수 없습니다');
+   }
+   const dbUserId = userIdResponse.data.id;

    const orderPromises = sellerGroups.map(async (group: SellerCartGroup) => {
      const response = await api.post<ApiResponse<Order>>('/orders', {
+       user_id: dbUserId,  // ✅ 추가
        seller_id: group.seller_id,
        order_number: orderNumber,
        items: group.items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          options: item.options,
        })),
        shipping_address: shippingAddress,
        // ...
      });
    });
  };
}
```

**또는 Backend 수정 (더 간단)**:
```diff
// src/features/orders/api/orders.routes.ts (라인 147-176)

ordersRoutes.post('/', cors(), requireAuth(), async (c) => {
  const { DB } = c.env;
  
  try {
+   // ✅ 인증된 사용자 ID 가져오기
+   const authUser = getCurrentUser(c);
+   if (!authUser) {
+     return c.json({ success: false, error: 'Unauthorized' }, 401);
+   }
+   
+   // Firebase UID → DB ID 변환
+   const dbUserId = await getUserDbIdFromFirebaseUid(DB, String(authUser.id));
+   if (!dbUserId) {
+     return c.json({ success: false, error: 'User not found' }, 404);
+   }
    
    const data: OrderCreateInput = await c.req.json();
    
    // 필수 필드 검증
-   if (!data.user_id || !data.seller_id || !data.items || data.items.length === 0) {
+   if (!data.seller_id || !data.items || data.items.length === 0) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }
    
+   // ✅ 인증된 사용자 ID 강제 설정 (보안)
+   data.user_id = dbUserId;
    
    const repository = new OrderRepository(DB);
    const order = await repository.create(data);
```

### 🧪 검증 방법
```bash
# 1. 장바구니에 상품 추가
https://live.ur-team.com/products
# 상품 클릭 → "장바구니 추가"

# 2. 결제 페이지 이동
https://live.ur-team.com/checkout

# 3. 배송 정보 입력 후 "결제하기" 클릭

# 4. 확인 포인트
✅ Network Tab: POST /api/orders → 201 Created
✅ Response: { success: true, data: { id: 123, order_number: "ORD-..." } }
❌ 400 Bad Request "Missing required fields" 없음
```

---

## 🔴 에러 #3: Payment Success 페이지 500 에러

### 🎯 발생 단계
**Toss 결제 완료 → /payment/success?orderId=xxx&paymentKey=yyy&amount=zzz**

### 🐛 예상 원인
```ts
// src/client/pages/PaymentSuccessPage.tsx
// POST /api/payments/confirm 호출 시:

// 1️⃣ orderId가 order_number (문자열)인데 숫자로 파싱 시도
// 2️⃣ amount 불일치 (총액 계산 오류)
// 3️⃣ 주문 조회 실패 (Firebase UID vs DB ID 불일치)
```

**Backend 검증 코드**:
```ts
// src/features/payments/api/payment.routes.ts (라인 176-181)
const order = await new QueryBuilder()
  .select(['o.*'])
  .from('orders o')
  .where('o.order_number = ?', orderId)  // ✅ 문자열 비교 (정상)
  .where('o.user_id = ?', userId)        // ⚠️ userId는 DB integer ID
  .execute<any>(db);
```

### 🔧 수정 필요 확인
```bash
# PaymentSuccessPage.tsx 확인
cd /home/user/webapp && grep -A 30 "function PaymentSuccessPage" src/client/pages/PaymentSuccessPage.tsx | head -40
```

**예상 수정**:
```diff
// src/client/pages/PaymentSuccessPage.tsx

export function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  useEffect(() => {
    const confirmPayment = async () => {
      const orderId = searchParams.get('orderId');
      const paymentKey = searchParams.get('paymentKey');
      const amount = searchParams.get('amount');
      
      if (!orderId || !paymentKey || !amount) {
        navigate('/payment/fail');
        return;
      }
      
      try {
        const response = await api.post<ApiResponse>('/payments/confirm', {
          paymentKey,
          orderId,  // ✅ 문자열 그대로 전송 (ORD-xxx 형식)
          amount: parseInt(amount, 10),  // ✅ 숫자로 변환
        });
        
        if (!response.success) {
          throw new Error(response.error || '결제 승인 실패');
        }
        
        // ✅ 장바구니 초기화
+       const { clearCart } = await import('../stores/cart.store');
+       clearCart();
        
        // 주문 완료 페이지로 이동
        navigate(`/orders/${response.data.order.id}`);
        
      } catch (error) {
        console.error('[Payment] Confirm error:', error);
        navigate('/payment/fail');
      }
    };
    
    confirmPayment();
  }, [searchParams, navigate]);
  
  return (
    <div className="flex justify-center items-center py-32">
      <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      <p className="ml-3 text-gray-600">결제를 처리하는 중...</p>
    </div>
  );
}
```

### 🧪 검증 방법
```bash
# 1. 결제 진행 (Toss 테스트 카드)
https://live.ur-team.com/checkout
# 배송 정보 입력 → "결제하기"
# Toss 팝업 → 테스트 카드 정보 입력

# 2. 리다이렉트 확인
# URL: /payment/success?orderId=ORD-xxx&paymentKey=yyy&amount=50000

# 3. 확인 포인트
✅ Network Tab: POST /api/payments/confirm → 200 OK
✅ Response: { success: true, data: { payment: {...}, order: {...} } }
✅ 자동으로 /orders/123 페이지로 이동
❌ 500 Internal Server Error 없음
❌ "Missing required fields" 없음
```

---

## 🔴 에러 #4: MyOrders 빈 배열 (Firebase UID ≠ DB ID)

### 🎯 발생 단계
**로그인 후 → /orders (내 주문 목록)**

### 🐛 예상 원인
```ts
// src/features/orders/api/orders.routes.ts (라인 58-65)
if (authUser.type === 'user') {
  // ✅ Firebase UID → DB ID 변환
  const dbUserId = await getUserDbIdFromFirebaseUid(DB, String(authUser.id));
  if (!dbUserId) {
    return c.json({ success: true, data: [] });  // ⚠️ 빈 배열 반환
  }
  enforcedUserId = dbUserId;
}
```

**원인**:
- `users` 테이블에 `firebase_uid` 컬럼이 없거나
- Kakao 로그인 시 `users` 테이블에 레코드 생성 안 됨

### 🔧 수정 방법

**1️⃣ users 테이블 스키마 확인**:
```sql
-- users 테이블에 firebase_uid 컬럼이 있는지 확인
SELECT sql FROM sqlite_master WHERE type='table' AND name='users';
```

**2️⃣ Kakao 로그인 시 users 레코드 생성 확인**:
```ts
// src/features/auth/api/kakao.routes.ts
// /api/auth/kakao/callback 엔드포인트에서:

// ✅ Firebase Custom Token 생성 후
// ✅ users 테이블에 레코드 생성/업데이트 필요
const userRecord = await db.prepare(`
  INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
  VALUES (?, ?, ?, datetime('now'), datetime('now'))
  ON CONFLICT(firebase_uid) DO UPDATE SET
    email = excluded.email,
    name = excluded.name,
    updated_at = datetime('now')
  RETURNING id
`).bind(firebaseUid, kakaoEmail, kakaoName).first();
```

**3️⃣ Frontend에서 /api/users/me 엔드포인트 사용**:
```ts
// 주문 생성 전에 DB ID 가져오기
const userResponse = await api.get<ApiResponse<{ id: number }>>('/users/me');
```

### 🧪 검증 방법
```bash
# 1. 로그인
https://live.ur-team.com
# 카카오로 시작하기

# 2. 주문 생성 (먼저 주문 1개 생성)
https://live.ur-team.com/checkout
# 결제 완료

# 3. 주문 목록 확인
https://live.ur-team.com/orders

# 4. 확인 포인트
✅ Network Tab: GET /api/orders → 200 OK
✅ Response: { success: true, data: [{ id: 123, order_number: "ORD-..." }] }
❌ data: [] (빈 배열) 없음
```

---

## 🟡 에러 #5: Toss SDK 로드 실패

### 🎯 발생 단계
**결제 페이지 → "결제하기" 버튼 → Toss SDK 로드**

### 🐛 예상 원인
```ts
// src/client/pages/CheckoutPage.tsx (라인 379-392)
function loadTossScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('toss-sdk')) {
      resolve();  // ✅ 이미 로드됨
      return;
    }
    const script = document.createElement('script');
    script.id = 'toss-sdk';
    script.src = 'https://js.tosspayments.com/v1/payment';  // ⚠️ 네트워크 실패 가능
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Toss SDK 로드 실패'));  // ⚠️
    document.head.appendChild(script);
  });
}
```

**원인**:
1. 네트워크 오류 (CDN 다운)
2. Content Security Policy (CSP) 차단
3. CORS 에러

### 🔧 수정 방법
```diff
// src/client/pages/CheckoutPage.tsx

  const initializeTossPayment = async (...) => {
-   await loadTossScript();
+   try {
+     await loadTossScript();
+   } catch (err) {
+     throw new Error('Toss 결제 모듈을 불러올 수 없습니다. 페이지를 새로고침해주세요.');
+   }
    
    // @ts-ignore
    const tossPayments = window.TossPayments?.(session.toss_client_key);
    
    if (!tossPayments) {
-     throw new Error('Toss Payments SDK를 불러오지 못했습니다');
+     throw new Error('Toss 결제가 초기화되지 않았습니다. 브라우저를 최신 버전으로 업데이트해주세요.');
    }
    
    // ...
  };
```

**또는 SDK를 `<head>`에 미리 로드**:
```html
<!-- public/index.html -->
<head>
  <script src="https://js.tosspayments.com/v1/payment" async></script>
</head>
```

### 🧪 검증 방법
```bash
# 1. 결제 페이지 접근
https://live.ur-team.com/checkout

# 2. DevTools Network Tab 확인
✅ https://js.tosspayments.com/v1/payment → 200 OK

# 3. Console 확인
✅ window.TossPayments 함수 존재
❌ "Toss SDK 로드 실패" 에러 없음
```

---

## 🟡 에러 #6: Checkout 빈 장바구니 리다이렉트 무한 루프

### 🎯 발생 단계
**장바구니 비어있음 → /checkout 접근 → /cart 리다이렉트 → 다시 /checkout?**

### 🐛 예상 원인
```ts
// src/client/pages/CheckoutPage.tsx (라인 63-67)
useEffect(() => {
  if (items.length === 0) {
    navigate('/cart');  // ⚠️ replace: true 없음
  }
}, [items, navigate]);
```

**원인**: `navigate('/cart')`가 history에 추가되어 뒤로가기 시 다시 /checkout으로 이동

### 🔧 수정 방법
```diff
// src/client/pages/CheckoutPage.tsx

  useEffect(() => {
    if (items.length === 0) {
-     navigate('/cart');
+     navigate('/cart', { replace: true });  // ✅ history 교체
    }
  }, [items, navigate]);
```

### 🧪 검증 방법
```bash
# 1. 장바구니 비우기
https://live.ur-team.com/cart
# "모두 삭제" 클릭

# 2. 직접 checkout URL 접근
https://live.ur-team.com/checkout

# 3. 확인 포인트
✅ 즉시 /cart로 리다이렉트
✅ 브라우저 뒤로가기 → /cart 유지 (무한 루프 없음)
❌ /checkout ↔ /cart 반복 없음
```

---

## 🟢 에러 #7: Cart 수량 업데이트 race condition

### 🎯 발생 단계
**장바구니 페이지 → 수량 증가/감소 버튼 연속 클릭**

### 🐛 예상 원인
```ts
// src/client/pages/CartPage.tsx (라인 52-66)
<button
  onClick={() => onUpdateQty(item.product_id, item.quantity - 1)}
  // ⚠️ 연속 클릭 시 optimistic update가 race condition 발생
>
```

**원인**: Zustand store의 `updateQuantity`가 동기적이지만, 서버 동기화 없음

### 🔧 수정 방법 (옵션)
```diff
// src/client/stores/cart.store.ts

  updateQuantity: (productId, quantity) => {
+   const { items } = get();
+   const item = items.find(i => i.product_id === productId);
+   if (!item) return;
+   
+   // ✅ 범위 검증 강화
+   const newQty = Math.max(1, Math.min(quantity, item.stock_quantity));
+   if (newQty === item.quantity) return;  // ✅ 변경 없으면 무시
    
    set(state => ({
      items: state.items.map(i =>
        i.product_id === productId
-         ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock_quantity)), subtotal: i.price * Math.max(1, Math.min(quantity, i.stock_quantity)) }
+         ? { ...i, quantity: newQty, subtotal: i.price * newQty }
          : i
      ),
    }));
    
+   // ✅ 서버 동기화 (debounce 추천)
+   debouncedSyncToServer(productId, newQty);
  },
```

### 🧪 검증 방법
```bash
# 1. 장바구니 접근
https://live.ur-team.com/cart

# 2. 수량 버튼 빠르게 10번 클릭

# 3. 확인 포인트
✅ 수량이 정확히 업데이트됨
✅ stock_quantity를 초과하지 않음
✅ 0 이하로 내려가지 않음
```

---

## 🟢 에러 #8: Payment Fail 페이지 주문 복구 실패

### 🎯 발생 단계
**결제 실패 → /payment/fail → 주문 복구 시도**

### 🐛 예상 원인
```ts
// src/client/pages/PaymentFailPage.tsx
// 주문 복구 로직이 없을 가능성

// 결제 실패 시:
// 1. orders 테이블에는 이미 레코드 생성됨 (status: pending)
// 2. 장바구니는 이미 비워짐
// 3. 사용자가 다시 결제하려면 orders에서 items 복원 필요
```

### 🔧 수정 방법
```diff
// src/client/pages/PaymentFailPage.tsx

export function PaymentFailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  useEffect(() => {
    const orderId = searchParams.get('orderId');
    const message = searchParams.get('message');
    
+   // ✅ 주문 복구 (옵션)
+   if (orderId) {
+     // 주문 정보를 가져와서 장바구니에 다시 추가
+     api.get<ApiResponse<Order>>(`/orders/${orderId}`)
+       .then(res => {
+         if (res.success && res.data?.items) {
+           // 장바구니에 아이템 복원
+           const { addItem } = useCartStore.getState();
+           res.data.items.forEach(item => {
+             addItem({
+               product_id: item.product_id,
+               product_name: item.product_name,
+               price: item.unit_price,
+               quantity: item.quantity,
+               // ...
+             }, sellerInfo);
+           });
+         }
+       })
+       .catch(err => console.error('Order recovery failed:', err));
+   }
  }, [searchParams]);
  
  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">결제 실패</h1>
      <p className="text-gray-600 mb-6">{message || '결제 처리 중 문제가 발생했습니다'}</p>
+     <button
+       onClick={() => navigate('/cart')}
+       className="btn-primary"
+     >
+       장바구니로 돌아가기
+     </button>
    </div>
  );
}
```

### 🧪 검증 방법
```bash
# 1. 결제 실패 시뮬레이션
https://live.ur-team.com/checkout
# Toss 테스트 카드로 "결제 실패" 유도

# 2. /payment/fail로 리다이렉트

# 3. 확인 포인트
✅ 에러 메시지 표시
✅ "장바구니로 돌아가기" 버튼 존재
✅ 클릭 시 /cart로 이동
(옵션) ✅ 장바구니에 주문 아이템 복원됨
```

---

## 🟢 에러 #9: Order Detail 404 (권한 체크 누락)

### 🎯 발생 단계
**/orders/123 접근 → 다른 사용자의 주문인 경우**

### 🐛 예상 원인
```ts
// src/features/orders/api/orders.routes.ts (라인 98-119)
ordersRoutes.get('/:id', cors(), requireAuth(), async (c) => {
  const id = Number(c.req.param('id'));
  
  const repository = new OrderRepository(DB);
  const order = await repository.findById(id);
  
  if (!order) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }
  
  // ⚠️ 권한 체크 누락!
  // 다른 사용자의 주문도 조회 가능
  
  return c.json({ success: true, data: order });
});
```

### 🔧 수정 방법
```diff
// src/features/orders/api/orders.routes.ts

ordersRoutes.get('/:id', cors(), requireAuth(), async (c) => {
  const { DB } = c.env;
  
  try {
+   const authUser = getCurrentUser(c);
+   if (!authUser) {
+     return c.json({ success: false, error: 'Unauthorized' }, 401);
+   }
    
    const id = Number(c.req.param('id'));
    
    if (isNaN(id)) {
      return c.json({ success: false, error: 'Invalid order ID' }, 400);
    }
    
    const repository = new OrderRepository(DB);
    const order = await repository.findById(id);
    
    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }
    
+   // ✅ 권한 체크: 본인 주문만 조회 가능
+   if (authUser.type === 'user') {
+     const dbUserId = await getUserDbIdFromFirebaseUid(DB, String(authUser.id));
+     if (order.user_id !== dbUserId) {
+       return c.json({ success: false, error: 'Forbidden' }, 403);
+     }
+   }
    
    // 주문 아이템도 함께 조회
    const items = await repository.findItems(id);
    
    return c.json({
      success: true,
      data: { ...order, items }
    });
    
  } catch (error) {
    console.error('[Orders API] Get detail error:', error);
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});
```

### 🧪 검증 방법
```bash
# 1. 본인 주문 조회
https://live.ur-team.com/orders/123

# 2. 확인 포인트
✅ 200 OK (본인 주문)
✅ 403 Forbidden (다른 사용자 주문)
❌ 다른 사용자 주문 데이터 노출 없음
```

---

## 🟢 에러 #10: Shipping Fee 계산 오류 (null seller_info)

### 🎯 발생 단계
**장바구니 페이지 → 배송비 표시**

### 🐛 예상 원인
```ts
// src/client/stores/cart.store.ts (라인 97-145)
getSellerGroups: (sellerInfoMap) => {
  const { items } = get();
  
  // Group items by seller
  const grouped = new Map<string, CartItem[]>();
  for (const item of items) {
    const sellerId = item.seller_id;
    if (!grouped.has(sellerId)) {
      grouped.set(sellerId, []);
    }
    grouped.get(sellerId)!.push(item);
  }
  
  // Build seller groups
  const groups: SellerCartGroup[] = [];
  for (const [sellerId, sellerItems] of grouped) {
    const info = sellerInfoMap.get(sellerId);
    // ⚠️ info가 없으면 기본값 사용
    const sellerName = info?.seller_name || `판매자 ${sellerId}`;
    const subtotal = sellerItems.reduce((sum, i) => sum + i.subtotal, 0);
    
    // ⚠️ info가 없으면 배송비 계산 불가
    const shippingFee = info
      ? calculateShippingFee(subtotal, info.base_shipping_fee, info.free_shipping_threshold)
      : 0;  // ⚠️ 기본값 0 (부정확할 수 있음)
    
    groups.push({
      seller_id: sellerId,
      seller_name: sellerName,
      items: sellerItems,
      subtotal,
      shipping_fee: shippingFee,
      free_shipping_threshold: info?.free_shipping_threshold,
      total: subtotal + shippingFee,
    });
  }
  
  return groups;
},
```

**원인**: `sellerInfoCache`에 판매자 정보가 없으면 배송비 0원으로 계산

### 🔧 수정 방법 (옵션)
```diff
// src/client/stores/cart.store.ts

  getSellerGroups: (sellerInfoMap) => {
    const { items } = get();
    
    // ...
    
    for (const [sellerId, sellerItems] of grouped) {
      const info = sellerInfoMap.get(sellerId);
      
+     // ✅ 판매자 정보 없으면 경고
+     if (!info) {
+       console.warn(`[Cart] Missing seller info for seller_id: ${sellerId}`);
+     }
      
      const sellerName = info?.seller_name || `판매자 ${sellerId}`;
      const subtotal = sellerItems.reduce((sum, i) => sum + i.subtotal, 0);
      
      const shippingFee = info
        ? calculateShippingFee(subtotal, info.base_shipping_fee, info.free_shipping_threshold)
-       : 0;
+       : 3000;  // ✅ 기본 배송비 (또는 서버에서 조회)
      
      groups.push({
        seller_id: sellerId,
        seller_name: sellerName,
        items: sellerItems,
        subtotal,
        shipping_fee: shippingFee,
        free_shipping_threshold: info?.free_shipping_threshold,
        total: subtotal + shippingFee,
      });
    }
    
    return groups;
  },
```

**더 나은 방법**: 서버에서 seller 정보 조회
```ts
// src/client/stores/cart.store.ts

// ✅ 장바구니 로드 시 판매자 정보도 함께 가져오기
const fetchCartWithSellerInfo = async () => {
  const response = await api.get<ApiResponse<{
    items: CartItem[];
    sellers: SellerInfo[];
  }>>('/cart');
  
  if (response.success && response.data) {
    // Store에 저장
    useCartStore.setState({ items: response.data.items });
    response.data.sellers.forEach(seller => {
      useCartStore.getState().setSellerInfo(seller.seller_id, seller);
    });
  }
};
```

### 🧪 검증 방법
```bash
# 1. 장바구니 페이지 접근
https://live.ur-team.com/cart

# 2. Console 확인
❌ "Missing seller info" 경고 없음

# 3. UI 확인
✅ 각 판매자별 배송비 정상 표시
✅ 배송비 계산 정확함
```

---

## 📝 전체 Flow 테스트 체크리스트

### ✅ Step 1: 로그인
```bash
URL: https://live.ur-team.com
Action: "카카오로 시작하기" 클릭
Expected:
  ✅ Kakao OAuth 페이지로 리다이렉트
  ✅ 로그인 후 원래 페이지로 리다이렉트
  ✅ localStorage에 accessToken 저장됨
  ✅ Console: "[AuthKR] ✅ accessToken 저장 완료"
  
Errors to check:
  ❌ 401 Unauthorized
  ❌ "Firebase: Error (auth/custom-token-mismatch)"
  ❌ 무한 로그인 루프
```

### ✅ Step 2: 장바구니 추가
```bash
URL: https://live.ur-team.com/products
Action: 상품 클릭 → "장바구니 추가" 버튼
Expected:
  ✅ Network: POST /api/cart → 201 Created
  ✅ Toast: "장바구니에 추가되었습니다"
  ✅ 장바구니 아이콘에 숫자 배지 표시
  
Errors to check:
  ❌ 401 Unauthorized
  ❌ 400 Bad Request "Missing required fields"
```

### ✅ Step 3: 장바구니 확인
```bash
URL: https://live.ur-team.com/cart
Expected:
  ✅ Network: GET /api/cart → 200 OK
  ✅ 추가한 상품 목록 표시
  ✅ 판매자별 그룹 표시
  ✅ 배송비 계산 정상
  ✅ 총 결제 금액 정확
  
Errors to check:
  ❌ 401 Unauthorized
  ❌ cartData: undefined
  ❌ items: []
```

### ✅ Step 4: 수량 조절
```bash
URL: https://live.ur-team.com/cart
Action: + / - 버튼 클릭
Expected:
  ✅ 수량 즉시 업데이트
  ✅ 소계 금액 재계산
  ✅ 총 금액 재계산
  
Errors to check:
  ❌ 수량 0 이하
  ❌ 재고 초과
```

### ✅ Step 5: 결제 페이지 이동
```bash
URL: https://live.ur-team.com/cart
Action: "결제하기" 버튼 클릭
Expected:
  ✅ /checkout 페이지로 이동
  ✅ 주문 상품 목록 표시
  ✅ 판매자별 그룹 표시
  ✅ 총 결제 금액 정확
  
Errors to check:
  ❌ 장바구니 비어있을 때 무한 루프
```

### ✅ Step 6: 배송 정보 입력
```bash
URL: https://live.ur-team.com/checkout
Action: 배송 정보 입력
Fields:
  - 수령인: 홍길동
  - 연락처: 010-1234-5678
  - 우편번호: 12345
  - 주소: 서울시 강남구
  - 상세주소: 101동 202호
  
Expected:
  ✅ 폼 검증 정상
  ✅ 필수 필드 표시
  
Errors to check:
  ❌ 폼 검증 오류
```

### ✅ Step 7: 주문 생성
```bash
URL: https://live.ur-team.com/checkout
Action: "결제하기" 버튼 클릭
Expected:
  ✅ Network: POST /api/orders → 201 Created (판매자 수만큼)
  ✅ Network: POST /api/payments/checkout-session → 200 OK
  ✅ Response에 order_number, toss_client_key 포함
  
Errors to check:
  ❌ 400 "Missing required fields" (user_id 누락)
  ❌ 401 Unauthorized
  ❌ 500 Internal Server Error
```

### ✅ Step 8: Toss 결제 위젯
```bash
Expected:
  ✅ Toss SDK 로드 (window.TossPayments 존재)
  ✅ Toss 결제 팝업 표시
  ✅ 주문 정보 정확 (금액, 주문명)
  
Errors to check:
  ❌ "Toss SDK 로드 실패"
  ❌ "Toss Payments SDK를 불러오지 못했습니다"
  ❌ 결제 팝업 안 뜸
```

### ✅ Step 9: 결제 완료
```bash
Action: Toss 테스트 카드 정보 입력 → "결제하기"
Test Card:
  - 카드번호: 1234-5678-9012-3456
  - 만료일: 12/28
  - CVC: 123
  
Expected:
  ✅ Redirect: /payment/success?orderId=ORD-xxx&paymentKey=yyy&amount=50000
  ✅ Network: POST /api/payments/confirm → 200 OK
  ✅ 자동으로 /orders/123으로 이동
  
Errors to check:
  ❌ 500 Internal Server Error
  ❌ 400 "Amount mismatch"
  ❌ 404 "Order not found"
```

### ✅ Step 10: 주문 완료 확인
```bash
URL: /orders/123
Expected:
  ✅ Network: GET /api/orders/123 → 200 OK
  ✅ 주문 상세 정보 표시
  ✅ 주문 아이템 목록 표시
  ✅ 결제 정보 표시
  ✅ 배송 정보 표시
  
Errors to check:
  ❌ 404 Not Found
  ❌ 403 Forbidden (다른 사용자 주문)
```

### ✅ Step 11: 주문 목록 확인
```bash
URL: https://live.ur-team.com/orders
Expected:
  ✅ Network: GET /api/orders → 200 OK
  ✅ 주문 목록 표시 (최소 1개)
  ✅ 주문 번호, 날짜, 금액, 상태 표시
  
Errors to check:
  ❌ data: [] (빈 배열)
  ❌ 401 Unauthorized
  ❌ 500 Internal Server Error
```

### ✅ Step 12: 주문 취소 (옵션)
```bash
URL: /orders/123
Action: "주문 취소" 버튼 클릭
Expected:
  ✅ Network: POST /api/payments/rollback → 200 OK
  ✅ 주문 상태 "cancelled"로 변경
  ✅ Toast: "주문이 취소되었습니다"
  
Errors to check:
  ❌ 400 "Cannot cancel delivered order"
  ❌ 500 Internal Server Error
```

---

## 🎯 우선순위 수정 순서

1. **에러 #2**: Checkout Order 생성 (user_id 누락) ← **가장 중요**
2. **에러 #3**: Payment Success 페이지 수정
3. **에러 #4**: MyOrders 빈 배열 (Firebase UID → DB ID)
4. **에러 #6**: Checkout 빈 장바구니 리다이렉트 무한 루프
5. **에러 #5**: Toss SDK 로드 실패 에러 메시지 개선
6. **에러 #9**: Order Detail 권한 체크
7. **에러 #7, #8, #10**: 기타 개선 사항 (낮은 우선순위)

---

## 📁 수정 대상 파일 요약

| 파일 | 수정 내용 | 우선순위 |
|-----|---------|---------|
| `src/features/orders/api/orders.routes.ts` | POST /orders에서 user_id 자동 설정 | ⭐⭐⭐⭐⭐ |
| `src/client/pages/PaymentSuccessPage.tsx` | 결제 승인 로직 수정, 장바구니 초기화 | ⭐⭐⭐⭐⭐ |
| `src/features/orders/api/orders.routes.ts` | GET /orders/:id에 권한 체크 추가 | ⭐⭐⭐⭐ |
| `src/client/pages/CheckoutPage.tsx` | navigate replace: true 추가 | ⭐⭐⭐⭐ |
| `src/features/auth/api/kakao.routes.ts` | users 테이블 레코드 생성 확인 | ⭐⭐⭐⭐ |
| `src/client/pages/CheckoutPage.tsx` | Toss SDK 에러 메시지 개선 | ⭐⭐⭐ |
| `src/client/pages/PaymentFailPage.tsx` | 주문 복구 로직 (옵션) | ⭐⭐ |
| `src/client/stores/cart.store.ts` | seller info 누락 시 기본값 처리 | ⭐⭐ |

---

**다음 단계**: 에러 #2, #3, #4 수정부터 시작하겠습니다!
