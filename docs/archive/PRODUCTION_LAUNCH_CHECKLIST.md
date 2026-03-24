# 🚀 프로덕션 서비스 시작 최종 체크리스트

**날짜**: 2026-03-19  
**배포 URL**: https://live.ur-team.com  
**Staging URL**: https://d88e9939.ur-live.pages.dev  

---

## ✅ 완료된 작업

### 1. **Top 10 Critical 에러 수정 완료**
- [x] **에러 #1**: Cart API 401 Unauthorized (토큰 저장 로직 추가)
- [x] **에러 #2**: Checkout Order 생성 실패 (`user_id` 자동 설정)
- [x] **에러 #3**: Payment Success 페이지 500 에러 (`total_amount` 매핑)
- [x] **에러 #4**: MyOrders 빈 배열 (Firebase UID → DB ID 변환)
- [x] **에러 #5**: Toss SDK 에러 메시지 개선
- [x] **에러 #6**: Checkout 빈 장바구니 무한 루프 (`replace: true`)
- [x] **에러 #9**: Order Detail 권한 체크 (403 Forbidden)

### 2. **빌드 & 배포 완료**
- [x] 최신 코드 빌드 성공 (Client + Worker)
- [x] Cloudflare Pages 배포 완료 (https://d88e9939.ur-live.pages.dev)
- [x] Production 도메인 자동 승격 (https://live.ur-team.com)

---

## 🔍 Phase 1: 즉시 테스트 필요 항목 (긴급 - 30분)

### ✅ Test 1: 로그인 & 토큰 저장 검증

**시나리오**:
1. **Incognito 모드**로 https://live.ur-team.com 접속
2. "카카오로 시작하기" 클릭
3. 카카오 로그인 (테스트 계정: `tobe2111@kakao.com`)

**✅ 성공 조건**:
```javascript
// Console 로그 확인
[AuthKR] ✅ ID Token 저장 완료: eyJhbGciOiJS...
[AuthKR] ✅ accessToken 저장 완료

// localStorage 확인 (DevTools → Application → Local Storage)
{
  "auth-storage": {
    "state": {
      "accessToken": "eyJhbGciOiJSUzI1NiIs...",  // ✅ 존재해야 함
      "user": {
        "uid": "kakao_473531250",
        "displayName": "tobe2111"
      }
    }
  }
}
```

**❌ 실패 조건**:
- Console에 `accessToken: null` 로그
- localStorage에 `accessToken` 필드 없음
- 401 Unauthorized 에러

---

### ✅ Test 2: 장바구니 API 검증

**시나리오**:
1. 로그인 후 홈 화면에서 상품 클릭
2. "구매하기" 버튼 클릭 → 장바구니 추가
3. 우측 상단 장바구니 아이콘 클릭 → `/cart` 페이지 이동

**✅ 성공 조건** (Network Tab):
```
POST /api/cart
Request Headers:
  Authorization: Bearer eyJhbGciOiJSUzI1NiIs...  ✅
Response:
  Status: 200 OK
  Body: { "success": true, "data": {...} }

GET /api/cart
Request Headers:
  Authorization: Bearer eyJhbGciOiJSUzI1NiIs...  ✅
Response:
  Status: 200 OK
  Body: {
    "success": true,
    "data": {
      "items": [{...}],
      "total": 100000
    }
  }
```

**❌ 실패 조건**:
- 401 Unauthorized 응답
- Authorization 헤더 없음
- `cartData.items is undefined` 에러

---

### ✅ Test 3: 결제 플로우 검증 (End-to-End)

**시나리오**:
1. 장바구니에서 "결제하기" 버튼 클릭 → `/checkout` 이동
2. 배송지 정보 입력:
   - 이름: 테스트
   - 전화번호: 010-1234-5678
   - 주소: 서울시 강남구 테헤란로 123
   - 상세주소: 456호
3. "결제하기" 버튼 클릭
4. Toss 결제창에서 **테스트 카드** 입력:
   - 카드번호: `5365-7077-6780-2788`
   - 유효기간: `12/28`
   - CVC: `123`
5. 결제 승인

**✅ 성공 조건**:

**1) Checkout 페이지 (`/checkout`)**:
```
POST /api/orders
Request:
  {
    "seller_id": 1,
    "order_number": "20260319ABCD",
    "items": [{...}],
    "shipping_address": {...}
    // ✅ user_id 없음 (Backend에서 자동 설정)
  }
Response:
  Status: 200 OK
  Body: { "success": true, "data": { "id": 123, ... } }
```

**2) Payment 세션 생성**:
```
POST /api/checkout/session
Request:
  {
    "amount": 100000,
    "order_ids": [123],
    "customer_name": "테스트"
  }
Response:
  Status: 200 OK
  Body: {
    "success": true,
    "data": {
      "order_id": "toss_abc123",
      "customer_key": "customer_xyz"
    }
  }
```

**3) Payment Success 페이지 (`/payment/success?orderId=...&amount=...`)**:
```
GET /api/orders/:id
Response:
  Status: 200 OK
  Body: {
    "success": true,
    "data": {
      "id": 123,
      "order_number": "20260319ABCD",
      "total_amount": 100000,  // ✅ total_price → total_amount 매핑
      "status": "pending",
      "items": [...]
    }
  }
```

**❌ 실패 조건**:
- Checkout에서 400 Bad Request (user_id 누락)
- Payment Success에서 500 Internal Server Error
- `total_amount is undefined` 에러
- 주문 생성 후 화면에 표시 안 됨

---

### ✅ Test 4: 주문 내역 확인

**시나리오**:
1. 결제 완료 후 우측 상단 프로필 아이콘 클릭
2. "주문 내역" 메뉴 클릭 → `/mypage/orders` 이동

**✅ 성공 조건**:
```
GET /api/orders
Request Headers:
  Authorization: Bearer eyJhbGciOiJSUzI1NiIs...  ✅
Response:
  Status: 200 OK
  Body: {
    "success": true,
    "data": [
      {
        "id": 123,
        "order_number": "20260319ABCD",
        "total_amount": 100000,  // ✅ 매핑됨
        "status": "pending",
        "created_at": "2026-03-19T07:30:00Z"
      }
    ]
  }
```

**화면 표시**:
- 주문 번호: `20260319ABCD`
- 결제 금액: `₩100,000`
- 주문 상태: `결제 대기 중`

**❌ 실패 조건**:
- 빈 배열 `[]` 반환
- 401 Unauthorized
- Firebase UID로 조회되지 않음

---

### ✅ Test 5: 주문 상세 확인

**시나리오**:
1. 주문 내역에서 특정 주문 클릭 → `/orders/123` 이동

**✅ 성공 조건**:
```
GET /api/orders/123
Request Headers:
  Authorization: Bearer eyJhbGciOiJSUzI1NiIs...  ✅
Response:
  Status: 200 OK
  Body: {
    "success": true,
    "data": {
      "id": 123,
      "order_number": "20260319ABCD",
      "total_amount": 100000,
      "status": "pending",
      "items": [{
        "product_id": 1,
        "product_name": "테스트 상품",
        "quantity": 1,
        "price": 100000
      }],
      "shipping_address": {
        "name": "테스트",
        "phone": "010-1234-5678",
        "address": "서울시 강남구 테헤란로 123",
        "detail_address": "456호"
      }
    }
  }
```

**❌ 실패 조건**:
- 403 Forbidden (권한 없음)
- 404 Not Found
- 다른 사용자의 주문 조회 가능 (보안 문제)

---

## 🟡 Phase 2: 추가 테스트 항목 (1-2시간)

### Test 6: 에러 처리 검증

**시나리오 6-1: 빈 장바구니에서 결제 시도**
```
✅ 예상 동작:
1. `/checkout` 접근 시 자동으로 `/cart`로 리다이렉트
2. navigate('/cart', { replace: true }) 적용
3. 무한 루프 없음
```

**시나리오 6-2: 토스 SDK 로드 실패**
```
✅ 예상 동작:
1. 네트워크 오프라인 상태에서 결제 시도
2. 명확한 에러 메시지 표시:
   "결제 시스템을 불러오는 중 오류가 발생했습니다. 페이지를 새로고침해주세요."
3. Console에 상세 에러 로그
```

**시나리오 6-3: 다른 사용자의 주문 조회 시도**
```
✅ 예상 동작:
1. 사용자 A로 로그인
2. URL에 사용자 B의 주문 ID 입력: `/orders/999`
3. 403 Forbidden 응답
4. 에러 메시지: "이 주문에 접근할 권한이 없습니다"
```

---

### Test 7: Race Condition 체크

**시나리오 7-1: 장바구니 수량 빠른 업데이트**
```
1. 장바구니에 상품 추가
2. 수량 증가 버튼 5번 연속 빠르게 클릭
3. ✅ 최종 수량이 정확히 6개인지 확인
4. ❌ 2-3개로 잘못 표시되면 race condition 발생
```

**시나리오 7-2: 중복 주문 생성 방지**
```
1. 결제하기 버튼 클릭
2. 버튼이 비활성화되는지 확인
3. 네트워크가 느린 경우에도 중복 요청 방지
```

---

## 🔴 Phase 3: 남은 에러 가능성 Top 5

### 🐛 잠재적 에러 #1: 재고 부족 시 처리

**현재 상태**: ❌ 미구현
**발생 시나리오**:
1. 상품 A 재고: 1개
2. 사용자가 수량 5개 선택 후 결제 시도
3. **예상 문제**: 주문은 생성되지만 재고 차감 실패

**필요 수정**:
```diff
// src/features/orders/repositories/OrderRepository.ts

async createOrder(data: CreateOrderInput): Promise<Order> {
  // 1. 재고 확인
+ const productStock = await this.db
+   .prepare('SELECT stock FROM products WHERE id = ?')
+   .bind(data.items[0].product_id)
+   .first();
+ 
+ if (!productStock || productStock.stock < data.items[0].quantity) {
+   throw new Error('재고가 부족합니다');
+ }

  // 2. 주문 생성
  const order = await this.db
    .prepare('INSERT INTO orders ...')
    .bind(...)
    .run();

  // 3. 재고 차감
+ await this.db
+   .prepare('UPDATE products SET stock = stock - ? WHERE id = ?')
+   .bind(data.items[0].quantity, data.items[0].product_id)
+   .run();

  return order;
}
```

**우선순위**: 🟡 중간 (현재 테스트 환경에서는 문제 없음)

---

### 🐛 잠재적 에러 #2: 결제 실패 후 주문 복구

**현재 상태**: ❌ 미구현
**발생 시나리오**:
1. 주문 생성 성공 (DB에 저장됨)
2. Toss 결제창에서 결제 실패 (카드 한도 초과 등)
3. **예상 문제**: DB에는 주문이 남아있지만 결제는 미완료

**필요 수정**:
```diff
// src/client/pages/PaymentFailPage.tsx

export function PaymentFailPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const message = searchParams.get('message');

+ useEffect(() => {
+   if (orderId) {
+     // 주문 상태를 'cancelled'로 변경
+     api.patch(`/orders/${orderId}`, { status: 'cancelled' })
+       .catch(err => console.error('Failed to cancel order:', err));
+   }
+ }, [orderId]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1>결제 실패</h1>
      <p>{message}</p>
+     <button onClick={() => navigate('/cart')}>
+       장바구니로 돌아가기
+     </button>
    </div>
  );
}
```

**우선순위**: 🟡 중간 (프로덕션 전 구현 권장)

---

### 🐛 잠재적 에러 #3: 배송비 계산 오류

**현재 상태**: ⚠️ null seller_info 가능
**발생 시나리오**:
1. 장바구니에 seller_info가 null인 상품 존재
2. **예상 문제**: `Cannot read property 'shipping_fee' of null`

**체크 방법**:
```javascript
// Console에서 확인
const cart = useCartStore.getState();
cart.items.forEach((item, i) => {
  if (!item.seller_info) {
    console.error(`Item ${i} has null seller_info:`, item);
  }
});
```

**필요 수정**:
```diff
// src/stores/cart.store.ts

addItem: (item: CartItem) => {
+ if (!item.seller_info) {
+   console.warn('Adding item without seller_info, using defaults');
+   item.seller_info = {
+     id: 0,
+     name: 'Unknown Seller',
+     shipping_fee: 3000,
+     free_shipping_threshold: 50000
+   };
+ }
  
  set((state) => ({
    items: [...state.items, item]
  }));
}
```

**우선순위**: 🟢 낮음 (현재 모든 상품에 seller_info 있음)

---

### 🐛 잠재적 에러 #4: 토큰 만료 처리

**현재 상태**: ⚠️ 부분 구현 (1시간 캐싱만 있음)
**발생 시나리오**:
1. 사용자가 1시간 이상 페이지에 머무름
2. API 요청 시 토큰 만료
3. **예상 문제**: 401 Unauthorized 발생

**현재 구현**:
```typescript
// src/lib/api.ts (라인 31-33)
if (accessToken) {
  headers['Authorization'] = `Bearer ${accessToken}`;
}
```

**개선 필요**:
```diff
// src/lib/api.ts

const request = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const { accessToken } = useAuthStore.getState();
  
+ // 토큰 만료 체크 (Firebase는 1시간 유효)
+ if (accessToken) {
+   const tokenData = parseJWT(accessToken);
+   const expiresAt = tokenData.exp * 1000;
+   
+   if (Date.now() > expiresAt - 5 * 60 * 1000) {
+     // 만료 5분 전이면 갱신
+     const { user } = useAuthStore.getState();
+     if (user) {
+       const newToken = await user.getIdToken(true);
+       useAuthStore.getState().setAuth(user, newToken, '');
+     }
+   }
+ }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  // ... rest of code
};
```

**우선순위**: 🟡 중간 (1시간 내 사용 시 문제 없음)

---

### 🐛 잠재적 에러 #5: Cart Store 동기화

**현재 상태**: ❌ 미구현
**발생 시나리오**:
1. 사용자가 PC에서 장바구니에 상품 추가
2. 모바일에서 로그인
3. **예상 문제**: 장바구니가 비어있음 (로컬 스토어만 사용)

**필요 수정**:
```diff
// src/stores/cart.store.ts

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      
+     // 서버와 동기화
+     syncWithServer: async () => {
+       const { accessToken } = useAuthStore.getState();
+       if (!accessToken) return;
+       
+       try {
+         const response = await api.get('/cart');
+         if (response.success && response.data.items) {
+           set({ items: response.data.items });
+         }
+       } catch (err) {
+         console.error('Failed to sync cart:', err);
+       }
+     },
      
      addItem: async (item: CartItem) => {
        set((state) => ({
          items: [...state.items, item]
        }));
        
+       // 서버에도 저장
+       const { accessToken } = useAuthStore.getState();
+       if (accessToken) {
+         await api.post('/cart', item);
+       }
      },
      
      // ... rest of methods
    }),
    {
      name: 'cart-storage',
    }
  )
);
```

**우선순위**: 🟢 낮음 (단일 기기 사용 시 문제 없음)

---

## 📊 최종 우선순위 요약

### 🔴 즉시 해결 필요 (Launch Blocker)
- [x] ~~Cart API 401~~ (완료)
- [x] ~~Checkout Order 생성 실패~~ (완료)
- [x] ~~Payment Success 500~~ (완료)
- [x] ~~MyOrders 빈 배열~~ (완료)

### 🟡 프로덕션 전 권장
- [ ] 결제 실패 후 주문 복구 (PaymentFailPage)
- [ ] 토큰 만료 자동 갱신

### 🟢 추후 개선 가능
- [ ] 재고 부족 처리
- [ ] 배송비 계산 null 체크
- [ ] Cart Store 서버 동기화

---

## 🚀 Launch Decision Tree

```
[프로덕션 배포 완료] ✅
         ↓
[Phase 1 테스트 (5개 시나리오)]
         ↓
    모두 통과?
    ↙️     ↘️
   YES      NO
    ↓        ↓
[Soft Launch] [에러 수정]
 (제한적 오픈)    ↓
    ↓      [재배포]
    ↓        ↓
    └────→ [재테스트]
              ↓
         [Phase 2 테스트]
              ↓
         [Beta Launch]
         (전체 오픈)
```

---

## 📝 테스트 결과 기록

### Test 1: 로그인 & 토큰 저장
- [ ] 테스트 완료
- [ ] 성공
- [ ] 실패 (사유: _________________)

### Test 2: 장바구니 API
- [ ] 테스트 완료
- [ ] 성공
- [ ] 실패 (사유: _________________)

### Test 3: 결제 플로우
- [ ] 테스트 완료
- [ ] 성공
- [ ] 실패 (사유: _________________)

### Test 4: 주문 내역
- [ ] 테스트 완료
- [ ] 성공
- [ ] 실패 (사유: _________________)

### Test 5: 주문 상세
- [ ] 테스트 완료
- [ ] 성공
- [ ] 실패 (사유: _________________)

---

## 🎯 Next Steps

1. **지금 즉시**: Phase 1 테스트 (5개 시나리오)
2. **30분 이내**: 테스트 결과 기록
3. **문제 없으면**: Soft Launch 승인
4. **문제 있으면**: 에러 수정 후 재배포

---

**최종 배포 승인**: ⏳ 대기 중  
**승인자**: _______________  
**승인 일시**: _______________
