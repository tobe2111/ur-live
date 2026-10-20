# 🚨 결제 성공 후 주문 생성 실패 (500 에러) 분석

## 📋 문제 요약

**증상:**
- TossPayments 결제는 성공 (`paymentKey`, `orderId`, `amount` 정상 반환)
- 결제 성공 페이지(`PaymentSuccessPage`)에서 `/api/orders` POST 요청
- **서버에서 500 Internal Server Error 발생**
- 결과: 결제는 됐지만 주문이 DB에 저장 안 됨 → 주문 내역 없음

**콘솔 로그:**
```
[API] 서버 오류: Object
/api/orders:1 Failed to load resource: the server responded with a status of 500 ()
```

---

## 🔍 원인 분석

### 1️⃣ **가장 가능성 높은 원인: userId 문제**

**PaymentSuccessPage.tsx (Line 104):**
```typescript
const orderData = {
  userId: userId,  // ← Firebase UID (예: "BpcLipJtvwasGTs162L2Dz56bD12")
  // ...
}
```

**콘솔 로그:**
```
[Auth] ⚠️ Custom Claims에 userId 없음 - Firebase UID 사용: BpcLipJtvwasGTs162L2Dz56bD12
```

**Backend src/index.tsx (Line 5423):**
```typescript
userId || null,  // ← userId가 Firebase UID인 경우, DB에서 매칭 실패 가능
```

**문제:**
- `orders` 테이블의 `user_id` 컬럼이 **숫자(integer)**를 기대하는데
- Firebase UID는 **문자열** (예: "BpcLipJtvwasGTs162L2Dz56bD12")
- DB 삽입 시 **타입 불일치** 또는 **foreign key constraint** 위반 가능

---

### 2️⃣ **Missing 필드: `shippingAddressDetail`**

**PaymentSuccessPage.tsx (Line 103-112):**
```typescript
const orderData = {
  // ...
  shippingAddress: shippingAddress,  // ← 있음
  // shippingAddressDetail: 없음!  ← 누락됨
  recipientName: recipientName,
  recipientPhone: recipientPhone,
  // ...
}
```

**Backend src/index.tsx (Line 5408-5410):**
```typescript
const fullAddress = shippingAddressDetail 
  ? `${shippingAddress} ${shippingAddressDetail}` 
  : shippingAddress;
```

**문제:**
- `shippingAddressDetail`이 `undefined`인 경우 문제없을 것으로 예상되지만,
- 백엔드에서 다른 로직에서 참조 시 오류 가능

---

### 3️⃣ **Reserved Stock 컬럼 없음 (가능성 낮음)**

**Backend src/index.tsx (Line 5339):**
```typescript
const availableStock = (product.stock as number) - (product.reserved_stock as number || 0);
```

**문제:**
- `products` 테이블에 `reserved_stock` 컬럼이 없으면 쿼리 실패
- 하지만 기존 주문은 성공했을 것이므로 가능성 낮음

---

### 4️⃣ **DB Schema Mismatch**

**Backend에서 기대하는 필드:**
- `order_number` (string)
- `user_id` (integer or string?)
- `total_amount` (integer)
- `shipping_address` (string)
- `shipping_name` (string)
- `shipping_phone` (string)
- `payment_key` (string)

**실제 전송되는 필드:**
```typescript
{
  userId: "BpcLipJtvwasGTs162L2Dz56bD12",  // ← Firebase UID (string)
  orderNumber: "order_1772669010208_...",
  items: [...],
  totalAmount: 93000,
  shippingAddress: "...",
  recipientName: "...",
  recipientPhone: "...",
  status: "pending"
}
```

**매핑:**
- `userId` → `user_id` (타입 불일치 가능)
- `recipientName` → `shipping_name`
- `recipientPhone` → `shipping_phone`

---

## 🛠 해결 방법

### ✅ **해결책 1: userId를 숫자로 변환 (권장)**

**방법 A: Firebase UID → DB user ID 매핑**

**수정: PaymentSuccessPage.tsx**
```typescript
// Before
const userId = getUserId()

// After
const userId = getUserId() // Firebase UID
let dbUserId = null

// Firebase UID를 DB user ID로 변환
try {
  const userResponse = await api.get('/api/auth/me')
  dbUserId = userResponse.data?.data?.id // DB의 숫자 ID
} catch (e) {
  console.error('Failed to get user ID:', e)
}

const orderData = {
  userId: dbUserId,  // ← 숫자 ID 사용
  // ...
}
```

**방법 B: Backend에서 Firebase UID → DB ID 매핑 추가**

**수정: src/index.tsx (Line 5421-5423)**
```typescript
// Before
userId || null,

// After
// Firebase UID인 경우 DB user ID로 변환
let dbUserId = userId;
if (userId && typeof userId === 'string' && userId.length > 20) {
  // Firebase UID 형식 (긴 문자열)
  const userResult = await DB.prepare(`
    SELECT id FROM users WHERE firebase_uid = ?
  `).bind(userId).first();
  
  dbUserId = userResult?.id || null;
  console.log(`[Order] Firebase UID ${userId} → DB ID ${dbUserId}`);
}

// INSERT ...
userId: dbUserId || null,
```

---

### ✅ **해결책 2: shippingAddressDetail 추가**

**수정: PaymentSuccessPage.tsx (Line 103-112)**
```typescript
// Before
const shippingAddress = localStorage.getItem('checkoutShippingAddress') || ''
const recipientName = localStorage.getItem('checkoutRecipientName') || ''
const recipientPhone = localStorage.getItem('checkoutRecipientPhone') || ''

// After
const shippingAddress = localStorage.getItem('checkoutShippingAddress') || ''
const shippingAddressDetail = localStorage.getItem('checkoutShippingAddressDetail') || ''  // ← 추가
const recipientName = localStorage.getItem('checkoutRecipientName') || ''
const recipientPhone = localStorage.getItem('checkoutRecipientPhone') || ''

const orderData = {
  // ...
  shippingAddress: shippingAddress,
  shippingAddressDetail: shippingAddressDetail,  // ← 추가
  recipientName: recipientName,
  // ...
}
```

---

### ✅ **해결책 3: 더 나은 에러 핸들링**

**수정: src/index.tsx (Line 5285-5310 추가)**
```typescript
app.post('/api/orders', requireAuth, async (c) => {
  const { DB } = c.env;

  try {
    const requestData = await c.req.json();
    
    // ✅ 입력 검증 추가
    console.log('[Order] 요청 데이터:', JSON.stringify(requestData, null, 2));
    
    const { 
      userId, 
      items,
      shippingAddress,
      shippingAddressDetail,
      recipientName,
      recipientPhone,
      totalAmount: providedTotalAmount,
      orderNumber: providedOrderNo,
    } = requestData;
    
    // ✅ 필수 필드 검증
    if (!items || items.length === 0) {
      console.error('[Order] ❌ items 없음');
      return c.json({ success: false, error: 'items required' }, 400);
    }
    
    if (!shippingAddress) {
      console.error('[Order] ❌ shippingAddress 없음');
      return c.json({ success: false, error: 'shippingAddress required' }, 400);
    }
    
    // ✅ userId 타입 확인 및 변환
    console.log('[Order] userId 타입:', typeof userId, 'length:', userId?.length);
    
    // ...
```

---

## 🔧 즉시 적용 가능한 임시 해결책

### **Quick Fix: user_id를 nullable로 변경**

**수정: src/index.tsx (Line 5421-5423)**
```typescript
// Before
userId || null,

// After  
null,  // ← 일단 null로 주문 생성 (나중에 userId 매핑)
```

**장점:**
- 즉시 주문 생성 가능
- Firebase UID → DB ID 매핑 없이도 작동

**단점:**
- 주문이 어느 사용자 것인지 추적 불가
- 나중에 별도 작업 필요

---

## 📊 디버깅 방법

### 1. **Cloudflare Pages 로그 확인 (가장 중요)**
```bash
cd /home/user/webapp
export CLOUDFLARE_API_TOKEN="yp2LoilEU8-WtBGMSCDZpIs2D2Yd69booRAgvhb4"
npx wrangler pages deployment tail --project-name=ur-live
```

- 결제 성공 페이지 재로딩
- 콘솔에서 `/api/orders` 요청 에러 로그 확인

### 2. **로컬에서 재현**
```bash
cd /home/user/webapp
npm run preview
```

- http://localhost:3000/payment/success?paymentKey=test&orderId=test&amount=93000 접속
- 개발자 도구 → Network 탭에서 `/api/orders` 요청 확인

### 3. **수동 API 테스트**
```bash
curl -X POST https://live.ur-team.com/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "userId": "BpcLipJtvwasGTs162L2Dz56bD12",
    "orderNumber": "test-order-123",
    "items": [{"productId": 1, "quantity": 1, "price": 10000}],
    "totalAmount": 10000,
    "shippingAddress": "서울시 강남구",
    "recipientName": "홍길동",
    "recipientPhone": "010-1234-5678"
  }'
```

---

## 🎯 추천 해결 순서

1. **Backend 로그 추가** → 에러 위치 정확히 파악
2. **userId 타입 확인** → Firebase UID인지, DB ID인지
3. **DB schema 확인** → `user_id` 컬럼 타입 확인
4. **Firebase UID → DB ID 매핑** 추가 또는 `user_id`를 nullable로 변경
5. **재배포** → 테스트

---

## 📝 다음 단계

**우선순위 1: Cloudflare 로그 확인**
```bash
npx wrangler pages deployment tail --project-name=ur-live
```

**우선순위 2: Backend userId 처리 수정**
- Firebase UID → DB ID 매핑 추가
- 또는 임시로 `null` 허용

**우선순위 3: 재배포 & 테스트**
```bash
export CLOUDFLARE_API_TOKEN="yp2LoilEU8-WtBGMSCDZpIs2D2Yd69booRAgvhb4"
npm run deploy
```

---

**작성일**: 2026-03-05  
**작성자**: Claude AI Assistant
