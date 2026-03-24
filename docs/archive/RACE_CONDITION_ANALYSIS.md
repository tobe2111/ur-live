# Race Condition & UX 개선 분석 보고서

## 📋 요청사항 검토

### 1️⃣ 중복 결제 방지 (Race Condition)
### 2️⃣ 상품 동기화 UX 개선
### 3️⃣ JWT 만료 시 데이터 유실 방지

---

## 1️⃣ 중복 결제 방지 (Race Condition)

### ✅ 프론트엔드 - **완벽하게 구현됨**

#### CheckoutPage.tsx

**1. isProcessing 상태 관리**
```typescript
const [isProcessing, setIsProcessing] = useState(false)
```

**2. 중복 실행 방지 (라인 561-564)**
```typescript
if (isProcessing) {
  console.log('[Payment] ⚠️ 이미 결제 진행 중')
  return
}
setIsProcessing(true)  // 라인 602
```

**3. 버튼 disabled 처리**

Desktop 버튼 (라인 946):
```typescript
<button
  onClick={handlePayment}
  disabled={!ready || !selectedAddress || isProcessing || !widgets}
  className="... disabled:cursor-not-allowed disabled:opacity-40"
>
  {isProcessing ? (
    <div>
      <Spinner />
      <span>결제 처리중</span>
    </div>
  ) : '결제하기'}
</button>
```

Mobile 버튼 (라인 1031):
```typescript
<button
  onClick={handlePayment}
  onTouchEnd={(e) => {
    e.preventDefault()
    if (!isProcessing && ready && selectedAddress) {
      handlePayment(e)
    }
  }}
  disabled={!ready || !selectedAddress || isProcessing || !widgets}
>
  {isProcessing ? '결제 처리중' : '결제하기'}
</button>
```

**결과**: ✅ **프론트엔드 중복 클릭 방지는 완벽함**

---

### ⚠️ 서버 측 - **Race Condition 발견**

#### 문제점: 재고 차감 시점과 방식

**현재 플로우**:
```
1. POST /api/orders (주문 생성)
   ├─ 재고 확인만 수행
   └─ 재고 차감 안 함 (라인 4376-4379 주석 처리)

2. Toss Payments 결제 승인

3. POST /api/payments/confirm (결제 승인 API)
   ├─ 토스 API 승인 성공
   ├─ 주문 상태 업데이트
   └─ 재고 차감 (라인 7619-7647)
```

#### 재고 차감 코드 (src/index.tsx 라인 7626-7634)

```typescript
// ✅ N+1 최적화: 재고 차감을 배치로 처리
const batchQueries = orderItems.results.map((item: any) =>
  DB.prepare(`
    UPDATE products 
    SET stock = stock - ?
    WHERE id = ? AND stock >= ?  // ⚠️ Race Condition 가능!
  `).bind(item.quantity, item.product_id, item.quantity)
);

const batchResults = await DB.batch(batchQueries);
```

#### 문제 시나리오 (오버셀링 가능)

```
초기 재고: 1개

┌─────────────────────────────────────────────────┐
│ 사용자 A                 │ 사용자 B              │
├─────────────────────────────────────────────────┤
│ 1. 재고 확인: 1개 ✅      │                      │
│ 2. 주문 생성 (재고 차감 X)│                      │
│ 3. 결제 시작              │ 1. 재고 확인: 1개 ✅  │
│                          │ 2. 주문 생성          │
│                          │ 3. 결제 시작          │
│ 4. 결제 승인 성공 ✅      │                      │
│ 5. 재고 차감: 1 → 0개     │                      │
│                          │ 4. 결제 승인 성공 ✅  │
│                          │ 5. 재고 차감 시도     │
│                          │    ❌ stock = 0       │
│                          │    WHERE stock >= 1   │
│                          │    → 차감 실패!       │
└─────────────────────────────────────────────────┘

결과:
- 사용자 A: 주문 성공 (재고 0개)
- 사용자 B: 주문 성공 (결제는 성공, 재고 차감 실패)
- 🚨 오버셀링 발생! (재고 1개인데 2개 주문 성공)
```

#### 현재 에러 처리 (라인 7636-7644)

```typescript
// 재고 부족 경고 (결제는 이미 성공했으므로 주문 유지)
for (let i = 0; i < batchResults.length; i++) {
  if (batchResults[i].meta.changes === 0) {
    const item = orderItems.results[i];
    console.error(`[Payment] ⚠️ 재고 부족: product_id=${item.product_id}`);
    // 재고 부족 시에도 결제는 성공했으므로 주문은 유지
    // 관리자가 수동으로 처리해야 함
  }
}
```

**문제**: 
- 재고 차감 실패해도 주문은 유지됨
- 관리자가 수동으로 처리해야 함 (운영 부담 증가)
- 고객에게 재고 부족 알림 없음

---

### 🛠️ 해결 방안 3가지

#### **Option 1: 비관적 락 (Pessimistic Lock)** ⭐ 추천

**장점**: 완벽한 동시성 제어, 오버셀링 완전 방지  
**단점**: 성능 약간 감소

**구현 방법**:

**1단계: products 테이블 수정 (마이그레이션)**
```sql
-- migrations/0101_add_reserved_stock.sql
ALTER TABLE products ADD COLUMN reserved_stock INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(id, stock, reserved_stock);
```

**2단계: POST /api/orders 수정 (주문 생성 시 재고 예약)**
```typescript
// src/index.tsx 라인 4324-4329 수정
// 재고 확인 + 예약 (atomic operation)
for (const item of items) {
  const result = await DB.prepare(`
    UPDATE products 
    SET reserved_stock = reserved_stock + ?
    WHERE id = ? AND (stock - reserved_stock) >= ?
  `).bind(item.quantity, item.productId, item.quantity).run();
  
  if (result.meta.changes === 0) {
    // 예약 실패 시 이미 예약한 상품 롤백
    await rollbackReservation(DB, itemsWithDetails);
    
    return c.json({
      success: false,
      error: `재고 부족: ${product.name} (예약 가능 재고 부족)`,
    }, 400);
  }
  
  itemsWithDetails.push({...});
}
```

**3단계: POST /api/payments/confirm 수정 (결제 승인 시 재고 확정)**
```typescript
// src/index.tsx 라인 7626-7634 수정
// ✅ 예약된 재고를 확정으로 전환
const batchQueries = orderItems.results.map((item: any) =>
  DB.prepare(`
    UPDATE products 
    SET stock = stock - ?,
        reserved_stock = reserved_stock - ?
    WHERE id = ?
  `).bind(item.quantity, item.quantity, item.product_id)
);

await DB.batch(batchQueries);
```

**4단계: 결제 실패 시 예약 해제 (새 API 추가)**
```typescript
// POST /api/payments/cancel
app.post('/api/payments/cancel', async (c) => {
  const { orderId } = await c.req.json();
  
  // 주문 아이템 조회
  const orderItems = await DB.prepare(`
    SELECT product_id, quantity 
    FROM order_items 
    WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)
  `).bind(orderId).all();
  
  // 예약 해제
  const batchQueries = orderItems.results.map((item: any) =>
    DB.prepare(`
      UPDATE products 
      SET reserved_stock = reserved_stock - ?
      WHERE id = ?
    `).bind(item.quantity, item.product_id)
  );
  
  await DB.batch(batchQueries);
  
  // 주문 상태 업데이트
  await DB.prepare(`
    UPDATE orders SET status = 'cancelled' WHERE order_number = ?
  `).bind(orderId).run();
  
  return c.json({ success: true });
});
```

---

#### **Option 2: 낙관적 락 (Optimistic Lock)**

**장점**: 성능 영향 적음  
**단점**: 충돌 시 재시도 필요, 구현 복잡

**구현 방법**:

**1단계: products 테이블에 version 컬럼 추가**
```sql
ALTER TABLE products ADD COLUMN version INTEGER DEFAULT 0;
```

**2단계: 재고 차감 시 version 체크**
```typescript
// 재고 차감
const result = await DB.prepare(`
  UPDATE products 
  SET stock = stock - ?,
      version = version + 1
  WHERE id = ? AND stock >= ? AND version = ?
`).bind(quantity, productId, quantity, currentVersion).run();

if (result.meta.changes === 0) {
  // version이 변경됨 = 다른 트랜잭션이 수정함
  // → 재시도 또는 재고 부족 에러
}
```

---

#### **Option 3: 단순화 - 결제 시작 시 재고 차감**

**장점**: 구현 간단  
**단점**: 결제 실패 시 재고 롤백 필요

**구현 방법**:

**라인 4376-4379 주석 해제 (POST /api/orders)**
```typescript
// 주문 아이템 생성 + 재고 차감
for (const item of itemsWithDetails) {
  // ✅ 재고 차감 (주문 생성 시)
  const stockResult = await DB.prepare(`
    UPDATE products 
    SET stock = stock - ?
    WHERE id = ? AND stock >= ?
  `).bind(item.quantity, item.product_id, item.quantity).run();
  
  if (stockResult.meta.changes === 0) {
    // 재고 차감 실패 시 롤백
    await rollbackOrder(DB, orderId);
    return c.json({
      success: false,
      error: `재고 부족: ${item.product_name}`,
    }, 400);
  }
  
  // 주문 아이템 생성
  await DB.prepare(`...`).bind(...).run();
}
```

**결제 실패 시 롤백 API 추가 (필수)**
```typescript
// POST /api/payments/rollback
app.post('/api/payments/rollback', async (c) => {
  const { orderId } = await c.req.json();
  
  // 재고 복구
  const orderItems = await DB.prepare(`...`).bind(orderId).all();
  
  for (const item of orderItems.results) {
    await DB.prepare(`
      UPDATE products 
      SET stock = stock + ?
      WHERE id = ?
    `).bind(item.quantity, item.product_id).run();
  }
  
  // 주문 취소
  await DB.prepare(`
    UPDATE orders SET status = 'cancelled' WHERE order_number = ?
  `).bind(orderId).run();
  
  return c.json({ success: true });
});
```

---

### 🎯 권장사항: **Option 1 (비관적 락)** ⭐

**이유**:
1. **완벽한 동시성 제어** - 오버셀링 100% 방지
2. **명확한 상태 관리** - `reserved_stock` 컬럼으로 예약/확정 구분
3. **운영 안정성** - 관리자 수동 처리 불필요
4. **성능 영향 미미** - D1 Database는 트랜잭션 지원, 배치 처리 가능

**구현 우선순위**:
1. 마이그레이션 파일 작성 (0101_add_reserved_stock.sql)
2. POST /api/orders 수정 (재고 예약)
3. POST /api/payments/confirm 수정 (재고 확정)
4. POST /api/payments/cancel 추가 (예약 해제)
5. 테스트 (동시 결제 시뮬레이션)

---

## 2️⃣ 상품 동기화 UX 개선

### ⚠️ 현재 상태 - 기본 구현만 됨

#### LivePageV2.tsx - 3초 폴링 구현됨

**상품 변경 감지 로직**:
```typescript
// 현재: 3초마다 상품 목록 조회만 함
useEffect(() => {
  const interval = setInterval(() => {
    fetchStreamProducts();  // ✅ 3초마다 API 호출
  }, 3000);
  
  return () => clearInterval(interval);
}, []);
```

**문제점**:
- 상품이 변경되어도 사용자가 인지하지 못함
- "방송에선 구두 얘기하는데 화면엔 아직 가방" 혼란 발생

---

### 🛠️ 해결 방안: 토스트 알림 + 애니메이션

#### 수정 코드 (LivePageV2.tsx)

**1. 상품 변경 감지 로직 추가**
```typescript
// 이전 상품 ID 저장
const [prevProductId, setPrevProductId] = useState<number | null>(null);

useEffect(() => {
  const interval = setInterval(async () => {
    const newProducts = await fetchStreamProducts();
    
    // 현재 소개 중인 상품 ID 확인
    const newCurrentProductId = stream.current_product_id;
    
    // 상품 변경 감지
    if (prevProductId !== null && 
        newCurrentProductId !== prevProductId) {
      // 🎉 토스트 알림 표시
      showProductChangeNotification(newCurrentProductId);
      
      // 페이드 애니메이션 트리거
      triggerProductChangeAnimation();
    }
    
    setPrevProductId(newCurrentProductId);
  }, 3000);
  
  return () => clearInterval(interval);
}, [prevProductId, stream.current_product_id]);

// 토스트 알림 함수
function showProductChangeNotification(productId: number) {
  const product = streamProducts.find(p => p.id === productId);
  if (!product) return;
  
  // 토스트 메시지
  setNotificationText(`🔥 소개 상품이 변경되었습니다: ${product.name}`);
  setShowNotification(true);
  
  // 3초 후 자동 숨김
  setTimeout(() => setShowNotification(false), 3000);
}

// 페이드 애니메이션 함수
function triggerProductChangeAnimation() {
  // 페이드 아웃
  setProductFading(true);
  
  // 200ms 후 상품 업데이트
  setTimeout(() => {
    setCurrentProduct(newProduct);
  }, 200);
  
  // 400ms 후 페이드 인
  setTimeout(() => {
    setProductFading(false);
  }, 400);
}
```

**2. 페이드 애니메이션 CSS**
```tsx
{/* Product overlay - 페이드 애니메이션 추가 */}
<div 
  className={`
    pointer-events-none absolute inset-0 z-10 flex flex-col
    transition-opacity duration-200
    ${productFading ? 'opacity-50' : 'opacity-100'}
  `}
>
  {/* 상품 정보 */}
</div>
```

**3. 토스트 알림 UI 개선**
```tsx
{/* 상품 변경 알림 토스트 */}
{showNotification && (
  <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[999] animate-slide-down">
    <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
      <span className="text-sm font-bold">{notificationText}</span>
    </div>
  </div>
)}
```

**4. 애니메이션 클래스 추가 (Tailwind)**
```css
@keyframes slide-down {
  0% {
    transform: translateY(-100%) translateX(-50%);
    opacity: 0;
  }
  100% {
    transform: translateY(0) translateX(-50%);
    opacity: 1;
  }
}

.animate-slide-down {
  animation: slide-down 0.3s ease-out;
}
```

---

## 3️⃣ JWT 만료 시 데이터 유실 방지

### ⚠️ 현재 상태 - 데이터 유실 발생

#### 문제 시나리오

```
1. 셀러가 상품 등록 페이지에서 10분 동안 상세 설명 작성
2. JWT 토큰 15분 만료
3. "저장" 버튼 클릭
4. 401 Unauthorized → 즉시 로그아웃
5. localStorage.clear() → 작성 내용 모두 삭제
6. 로그인 페이지로 리다이렉트
7. 😭 10분 동안 작성한 내용 모두 날아감
```

#### 현재 코드 (src/lib/api.ts 라인 120-124)

```typescript
// Refresh Token이 없거나 갱신 실패 시 로그아웃
console.warn('[API] 인증 실패 - 로그아웃 처리');

// localStorage 완전 클리어
localStorage.clear();  // ❌ 폼 데이터도 모두 삭제!
```

---

### 🛠️ 해결 방안: Auto-Save + 경고창

#### **1. Auto-Save 구현 (SellerProductNewPage.tsx)**

```typescript
// 폼 데이터 자동 저장
useEffect(() => {
  // Draft 키 생성
  const draftKey = `draft_product_${userId || 'guest'}`;
  
  // 2초마다 자동 저장
  const autoSave = setTimeout(() => {
    const draftData = {
      name: formData.name,
      description: formData.description,
      price: formData.price,
      image_url: formData.image_url,
      // ... 기타 필드
      savedAt: Date.now()
    };
    
    localStorage.setItem(draftKey, JSON.stringify(draftData));
    console.log('[AutoSave] 📝 폼 데이터 자동 저장됨');
  }, 2000);
  
  return () => clearTimeout(autoSave);
}, [formData, userId]);

// Draft 복구 로직 (페이지 로드 시)
useEffect(() => {
  const draftKey = `draft_product_${userId || 'guest'}`;
  const savedDraft = localStorage.getItem(draftKey);
  
  if (savedDraft) {
    try {
      const draft = JSON.parse(savedDraft);
      const savedTime = new Date(draft.savedAt).toLocaleString();
      
      const confirmed = confirm(
        `📝 저장된 임시 데이터가 있습니다.\n\n` +
        `저장 시간: ${savedTime}\n\n` +
        `복구하시겠습니까?`
      );
      
      if (confirmed) {
        setFormData(draft);
        console.log('[AutoSave] ✅ Draft 복구 완료');
      } else {
        localStorage.removeItem(draftKey);
      }
    } catch (err) {
      console.error('[AutoSave] Draft 복구 실패:', err);
    }
  }
}, [userId]);

// 저장 성공 시 Draft 삭제
async function handleSubmit() {
  try {
    await api.post('/api/seller/products', formData);
    
    // 저장 성공 시 Draft 삭제
    const draftKey = `draft_product_${userId}`;
    localStorage.removeItem(draftKey);
    console.log('[AutoSave] ✅ Draft 삭제됨 (저장 성공)');
    
    navigate('/seller/products');
  } catch (error) {
    // 에러 처리
  }
}
```

#### **2. 로그아웃 전 경고창 (src/lib/api.ts)**

```typescript
// Refresh Token이 없거나 갱신 실패 시 로그아웃
console.warn('[API] 인증 실패 - 로그아웃 처리');

// 🔧 Draft 데이터 확인
const draftKeys = Object.keys(localStorage).filter(key => 
  key.startsWith('draft_')
);

if (draftKeys.length > 0) {
  // Draft 데이터가 있으면 경고창 표시
  const confirmed = confirm(
    '⚠️ 세션이 만료되었습니다.\n\n' +
    `작성 중인 데이터 ${draftKeys.length}개가 있습니다.\n\n` +
    '로그인 후 복구할 수 있도록 임시 저장됩니다.\n\n' +
    '계속하시겠습니까?'
  );
  
  if (!confirmed) {
    // 사용자가 취소한 경우 데이터 복사 안내
    alert(
      '💡 Tip: 작성 중인 내용을 복사한 후 다시 시도하세요.\n\n' +
      '로그인 후 자동으로 복구됩니다.'
    );
    return Promise.reject(error);
  }
  
  // Draft 데이터만 보존하고 나머지 삭제
  const drafts = {};
  draftKeys.forEach(key => {
    drafts[key] = localStorage.getItem(key);
  });
  
  localStorage.clear();
  
  // Draft 데이터 복원
  Object.entries(drafts).forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });
  
  console.log('[API] ✅ Draft 데이터 보존됨:', draftKeys);
} else {
  // Draft 데이터가 없으면 그냥 로그아웃
  localStorage.clear();
}

// 현재 페이지가 로그인 페이지가 아닐 때만 리다이렉트
const currentPath = window.location.pathname;
if (!currentPath.includes('/login')) {
  // ...리다이렉트 로직
}
```

#### **3. Draft 관리 UI (SellerProductNewPage.tsx)**

```tsx
{/* Auto-Save 상태 표시 */}
<div className="fixed bottom-4 right-4 z-50">
  {autoSaving && (
    <div className="bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
      <span className="text-sm">자동 저장 중...</span>
    </div>
  )}
  
  {lastSavedTime && (
    <div className="mt-2 text-xs text-gray-500 text-right">
      마지막 저장: {new Date(lastSavedTime).toLocaleTimeString()}
    </div>
  )}
</div>

{/* Draft 데이터 삭제 버튼 */}
<button
  onClick={() => {
    const draftKey = `draft_product_${userId}`;
    localStorage.removeItem(draftKey);
    alert('임시 저장 데이터가 삭제되었습니다.');
  }}
  className="text-sm text-red-500 hover:underline"
>
  임시 저장 데이터 삭제
</button>
```

---

## 📊 종합 요약

### ✅ 완료된 항목

| 항목 | 상태 | 비고 |
|------|------|------|
| **프론트엔드 중복 클릭 방지** | ✅ 완료 | isProcessing 상태 + disabled 버튼 |
| **JWT 인증 시스템** | ✅ 완료 | 토큰 갱신, 권한 체크, 공개 API 예외 |
| **셀러 라이브 컨트롤 UI** | ✅ 완료 | 버튼 재배치, 크기 조정, 중복 제거 |

### ⚠️ 구현 필요한 항목

| 항목 | 우선순위 | 난이도 | 예상 시간 |
|------|----------|--------|-----------|
| **서버 측 재고 락** | 🔥 긴급 | 중간 | 2-3시간 |
| **상품 변경 알림** | 🔵 높음 | 낮음 | 30분 |
| **Auto-Save 기능** | 🔵 높음 | 중간 | 1시간 |

---

## 🎯 다음 단계 액션 플랜

### Phase 1: 서버 측 재고 락 구현 (최우선)

**Step 1**: 마이그레이션 파일 작성
```bash
# migrations/0101_add_reserved_stock.sql 생성
```

**Step 2**: POST /api/orders 수정
```typescript
// 재고 예약 로직 추가
```

**Step 3**: POST /api/payments/confirm 수정
```typescript
// 재고 확정 로직 수정
```

**Step 4**: POST /api/payments/cancel 추가
```typescript
// 예약 해제 API 추가
```

**Step 5**: 테스트
```bash
# 동시 결제 시뮬레이션
```

### Phase 2: UX 개선

**Step 1**: 상품 변경 알림 추가 (LivePageV2.tsx)
**Step 2**: Auto-Save 구현 (SellerProductNewPage.tsx)
**Step 3**: 로그아웃 전 경고창 (src/lib/api.ts)

---

## 📝 배포 정보

- **GitHub**: https://github.com/tobe2111/ur-live
- **커밋**: `e082ef7` (셀러 라이브 컨트롤 UI 개선)
- **문서**: `RACE_CONDITION_ANALYSIS.md`

---

**작성 시간**: 2026-02-25  
**작성자**: JenSpark AI Assistant  
**상태**: 분석 완료, 구현 대기 중
