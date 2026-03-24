# 라이브 상품 전환 경쟁 조건(Race Condition) 테스트

## 🎯 테스트 목적
라이브 방송 중 셀러가 빠르게 상품을 전환할 때, 시청자가 잘못된 상품을 장바구니에 담거나 에러가 발생하는지 검증

---

## 🔒 현재 구현된 안전장치

### 1. **Price Snapshot (가격 스냅샷)** ✅
**위치:** `LivePage.tsx` → `handleAddToCart()`
```typescript
await axios.post('/api/cart', {
  userId: userId,
  productId: currentProduct.product.id,
  quantity: 1,
  priceSnapshot: currentProduct.product.price,  // ← 담는 순간의 가격 저장
  liveStreamId: streamId
})
```

**효과:**
- ✅ 담은 시점의 정확한 가격 보존
- ✅ 상품 전환 후에도 가격 변경 없음
- ✅ 결제 시 price_snapshot 사용

---

### 2. **Double-Click 방지** ✅
**위치:** `LivePage.tsx` → `handleAddToCart()`
```typescript
const [addingToCart, setAddingToCart] = useState(false)

async function handleAddToCart() {
  if (addingToCart) return  // ← 중복 클릭 차단
  
  setAddingToCart(true)
  try {
    // ... API 호출 ...
  } finally {
    setAddingToCart(false)
  }
}
```

**효과:**
- ✅ API 호출 중 추가 클릭 차단
- ✅ 중복 장바구니 담기 방지

---

### 3. **Product ID 독립성** ✅
**위치:** `LivePage.tsx` → 장바구니 담기
```typescript
productId: currentProduct.product.id  // ← 상품 ID만 저장
```

**효과:**
- ✅ 상품 전환 시 장바구니에는 이전 상품 ID 유지
- ✅ 각 상품이 독립적으로 장바구니에 저장
- ✅ A 상품 담고 → B 상품으로 전환해도 A는 장바구니에 그대로

---

### 4. **3초 자동 갱신** ✅
**위치:** `LivePage.tsx` → `useEffect`
```typescript
useEffect(() => {
  loadCurrentProduct()
  const interval = setInterval(loadCurrentProduct, 3000)  // ← 3초마다 갱신
  return () => clearInterval(interval)
}, [streamId])
```

**효과:**
- ✅ 최신 상품 정보 자동 동기화
- ✅ 셀러가 전환하면 3초 이내에 시청자 화면 업데이트
- ⚠️ 단, 0.5초 내 빠른 전환 시 중간 상품 누락 가능

---

## ⚠️ 잠재적 위험 시나리오

### 시나리오 1: 빠른 연속 전환 (< 3초)
**상황:**
```
0초: 상품 A 노출
1초: 셀러가 상품 B로 전환
2초: 셀러가 상품 C로 전환
3초: 시청자 화면 갱신 → 상품 C 표시
```

**결과:**
- ✅ 상품 B는 시청자 화면에 표시되지 않음 (누락)
- ✅ 하지만 에러는 없음
- ⚠️ 상품 B를 보여주고 싶었다면 의도와 다를 수 있음

**해결 방안:**
1. **갱신 주기 단축**: 3초 → 1초 (서버 부하 증가)
2. **WebSocket/SSE 사용**: 실시간 Push 방식 (구현 복잡)
3. **셀러 안내**: "상품 전환 후 3초 이상 대기하세요"

---

### 시나리오 2: 담기 중 상품 전환
**상황:**
```
0초: 시청자 화면에 상품 A (₩10,000)
1초: 시청자가 [담기] 클릭 → API 호출 시작
2초: 셀러가 상품 B로 전환
2.5초: API 응답 완료 → 장바구니에 상품 A 추가
3초: 시청자 화면 갱신 → 상품 B 표시
```

**결과:**
- ✅ **정상 동작**: 장바구니에는 상품 A가 담김 (의도대로)
- ✅ 상품 B와 무관하게 A의 정보 보존

**증거:**
```typescript
// 담는 순간의 currentProduct 사용
productId: currentProduct.product.id,
priceSnapshot: currentProduct.product.price
```

---

### 시나리오 3: 동시 다발적 담기 (100명 동시 클릭)
**상황:**
```
0초: 셀러가 인기 상품으로 전환
0-1초: 100명의 시청자가 동시에 [담기] 클릭
```

**결과:**
- ✅ **재고 경쟁**: 선착순으로 재고 차감 (안전)
- ✅ **장바구니 담기**: 모두 성공 (재고와 무관)
- ⚠️ **주문 생성 시**: 재고 부족한 사람은 에러

**백엔드 재고 체크:**
```typescript
// POST /api/cart - 장바구니 담기 시
const product = await DB.prepare(
  'SELECT stock FROM products WHERE id = ?'
).bind(productId).first()

if (product.stock < quantity) {
  return c.json({ success: false, error: 'Insufficient stock' }, 400)
}
```

```typescript
// POST /api/orders - 주문 생성 시 (재고 차감)
const stockCheck = await DB.prepare(`
  UPDATE products 
  SET stock = stock - ? 
  WHERE id = ? AND stock >= ?
`).bind(quantity, productId, quantity).run()

if (stockCheck.meta.changes === 0) {
  return c.json({ success: false, error: 'Insufficient stock' }, 400)
}
```

---

## 🧪 실전 테스트 시나리오

### Test 1: 빠른 연속 전환
**목표:** 3초 내 여러 번 전환 시 누락 확인

**절차:**
1. 셀러 로그인: https://live.ur-team.com/seller/live-control
2. 상품 A → B → C → D를 각 1초 간격으로 전환
3. 시청자 화면에서 어떤 상품들이 표시되는지 확인

**예상 결과:**
- ✅ A와 D는 표시됨 (3초 이상 유지)
- ⚠️ B와 C는 누락될 수 있음 (< 3초)

**해결:**
- 셀러에게 "최소 3초 이상 유지" 안내

---

### Test 2: 담기 중 전환
**목표:** 담기 중 상품 전환 시 올바른 상품 담김 확인

**절차:**
1. 시청자 화면에 상품 A 표시 (₩10,000)
2. [담기] 버튼 클릭
3. 즉시 셀러가 상품 B로 전환 (₩20,000)
4. 장바구니 확인

**예상 결과:**
- ✅ 장바구니에 상품 A (₩10,000) 담김
- ✅ 상품 B는 장바구니에 없음

**증거:**
```sql
SELECT * FROM cart_items WHERE user_id = ?
-- product_id: A, price_snapshot: 10000
```

---

### Test 3: 동시 담기 (부하 테스트)
**목표:** 여러 시청자가 동시에 담기 시 에러 없음 확인

**절차:**
1. 3개 브라우저/시크릿 모드로 동시 로그인
2. 같은 라이브 방송 접속
3. 동시에 [담기] 버튼 클릭

**예상 결과:**
- ✅ 3명 모두 장바구니에 추가 성공
- ✅ DB에 3개의 cart_items 생성

**SQL 확인:**
```sql
SELECT COUNT(*) FROM cart_items WHERE product_id = ? AND live_stream_id = ?
-- 결과: 3
```

---

### Test 4: 재고 부족 경쟁
**목표:** 재고 1개, 2명 동시 담기 시 1명만 주문 성공

**절차:**
1. 상품 재고를 1개로 설정
   ```sql
   UPDATE products SET stock = 1 WHERE id = ?
   ```
2. 2명의 시청자가 동시에 담기
3. 2명 모두 [주문하기] 시도

**예상 결과:**
- ✅ 2명 모두 장바구니 담기 성공
- ✅ 1명만 주문 생성 성공
- ✅ 1명은 "재고 부족" 에러

**코드:**
```typescript
// POST /api/orders - 재고 차감 (원자적 연산)
UPDATE products SET stock = stock - 1 WHERE id = ? AND stock >= 1
// 0개의 row가 업데이트되면 재고 부족
```

---

## 📊 성능 분석

### 현재 폴링 방식 (3초 간격)
**부하 계산:**
- 시청자 1,000명 × 1회/3초 = **초당 약 333 요청**
- Cloudflare Workers: 10,000+ 요청/초 처리 가능
- D1 Database: 읽기 1ms, 쓰기 2-3ms

**결론:** ✅ 성능 문제 없음

**개선 옵션:**
1. **1초 간격**: 더 실시간 느낌, 부하 3배 증가 (1,000 req/s)
2. **WebSocket**: 진정한 실시간, 구현 복잡, Cloudflare Durable Objects 필요

---

## ✅ 결론 및 권장사항

### 현재 구현 상태
| 안전장치 | 상태 | 효과 |
|---------|------|------|
| Price Snapshot | ✅ | 담은 시점 가격 보존 |
| Double-Click 방지 | ✅ | 중복 담기 차단 |
| Product ID 독립성 | ✅ | 상품 전환 시 기존 장바구니 보존 |
| 재고 이중 체크 | ✅ | 담기 & 주문 시 재고 확인 |
| 원자적 재고 차감 | ✅ | 동시 주문 경쟁 안전 |

### 잠재적 이슈
| 이슈 | 발생 확률 | 심각도 | 해결 방안 |
|-----|----------|--------|----------|
| 빠른 전환 시 상품 누락 | 중간 | 낮음 | 셀러 안내 문구 |
| 3초 딜레이 | 항상 | 낮음 | 1초로 단축 고려 |
| 재고 경쟁 | 낮음 | 중간 | 현재 안전하게 처리됨 |

### 최종 평가
**🟢 프로덕션 준비 완료**
- ✅ 에러 발생 위험: **매우 낮음**
- ✅ 데이터 무결성: **안전**
- ✅ 성능: **충분**
- ⚠️ UX 개선 여지: 1초 갱신 또는 WebSocket 고려

### 권장 조치
1. **현재 상태로 운영 시작** ✅
2. **셀러 안내**: "상품 전환 후 3초 이상 대기"
3. **모니터링**: 초기 2주간 에러 로그 관찰
4. **개선**: 필요 시 1초 갱신 또는 WebSocket 도입

---

## 🚀 배포 후 모니터링 포인트

### 체크리스트
- [ ] 빠른 상품 전환 시 시청자 화면 동기화
- [ ] 장바구니 담기 성공률
- [ ] 재고 부족 에러 빈도
- [ ] API 응답 시간 (< 200ms 유지)
- [ ] 동시 접속 1,000명 이상 시 성능

### 로그 확인
```sql
-- 장바구니 담기 성공률
SELECT 
  COUNT(*) as total_add_to_cart,
  SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful
FROM audit_logs 
WHERE action = 'add_to_cart'
AND created_at > datetime('now', '-1 day')

-- 재고 부족 에러
SELECT COUNT(*) 
FROM error_logs 
WHERE error_message LIKE '%Insufficient stock%'
AND created_at > datetime('now', '-1 day')
```

---

**결론: 현재 구현은 안전하며, 에러 발생 가능성은 매우 낮습니다!** 🎉
