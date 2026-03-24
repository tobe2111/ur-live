# 🔍 확장성 및 성능 분석

## 📊 현재 아키텍처

### 배포 환경
- **플랫폼**: Cloudflare Pages + Workers
- **데이터베이스**: Cloudflare D1 (SQLite 기반)
- **실시간 동기화**: Firebase Realtime Database
- **결제**: NicePay (외부 API)
- **인증**: Kakao OAuth (외부 API)

---

## ⚠️ 대규모 트래픽 시 문제점

### 1. 🚨 Cloudflare D1 (SQLite) 한계
**현재 상태**: 모든 데이터를 D1에 저장

**문제점**:
- ❌ **동시 쓰기 제한**: SQLite는 동시 쓰기가 매우 제한적
- ❌ **읽기 성능**: 대량 동시 읽기 시 병목 발생
- ❌ **용량 제한**: Cloudflare D1 무료 플랜 5GB (유료도 제한적)
- ❌ **트랜잭션 충돌**: 동시 주문 시 재고 차감 경쟁 조건 발생 가능

**예상 한계**:
```
동시 접속 유저: ~500-1,000명 (읽기 위주)
동시 주문: ~50-100건/초 (쓰기)
라이브 시청자: ~1,000-2,000명 (Firebase 의존)
```

**실제 시나리오**:
```
❌ 인기 셀러의 라이브 시작 (5,000명 동시 접속)
   → D1 읽기 병목 발생
   → 장바구니/주문 API 응답 지연 (5-10초)
   
❌ 한정판 상품 오픈 (1,000명 동시 주문)
   → D1 쓰기 충돌
   → 재고 차감 오류 발생
   → 초과 판매 문제
```

---

### 2. 🚨 Cloudflare Workers CPU 제한
**현재 상태**: 모든 비즈니스 로직을 Worker에서 처리

**문제점**:
- ❌ **CPU 시간 제한**: 무료 10ms, 유료 30ms/요청
- ❌ **메모리 제한**: 128MB
- ❌ **복잡한 쿼리**: JOIN이 많은 쿼리 시 시간 초과

**예상 한계**:
```
복잡한 주문 생성: ~20-30ms (거의 한계)
정산 통계 계산: ~50-100ms (시간 초과 위험)
CSV 생성: 대량 데이터 시 실패
```

---

### 3. 🚨 재고 관리 경쟁 조건
**현재 로직**:
```typescript
// 1. 재고 조회
const product = await DB.prepare('SELECT stock FROM products WHERE id = ?').first()

// 2. 재고 검증
if (product.stock < quantity) { error }

// 3. 재고 차감
await DB.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run()
```

**문제점**:
- ❌ **Race Condition**: 동시 요청 시 재고가 음수가 될 수 있음
- ❌ **트랜잭션 없음**: D1은 트랜잭션 격리 수준이 낮음

**실제 시나리오**:
```
재고 1개 남음
→ A, B 동시 주문 (둘 다 재고 1개 확인)
→ A 주문 성공 (재고 0)
→ B 주문 성공 (재고 -1) ❌ 초과 판매!
```

---

### 4. 🚨 Firebase Realtime Database 비용
**현재 상태**: 실시간 상품 전환에 Firebase 사용

**문제점**:
- ❌ **비용 폭증**: 대량 동시 접속 시 읽기/쓰기 비용 급증
- ❌ **무료 플랜 한계**: 동시 접속 100명, 1GB 다운로드
- ❌ **예상 비용**: 1만 동시 접속 시 월 $500-1,000+

---

### 5. 🚨 NicePay 결제 처리 지연
**현재 상태**: 동기 방식으로 NicePay API 호출

**문제점**:
- ❌ **외부 API 지연**: NicePay 응답 2-5초
- ❌ **Worker 타임아웃**: 대기 시간이 CPU 시간에 포함됨
- ❌ **동시 결제 제한**: NicePay API 속도 제한

---

## 🛠️ 해결 방안 (Scale-Up)

### Phase 1: 즉시 적용 가능 (비용 최소)

#### 1-1. D1 쿼리 최적화
```typescript
// ❌ Before: N+1 쿼리
for (const item of cartItems) {
  const product = await DB.prepare('SELECT * FROM products WHERE id = ?').first()
}

// ✅ After: 단일 쿼리
const productIds = cartItems.map(i => i.product_id).join(',')
const products = await DB.prepare(`
  SELECT * FROM products WHERE id IN (${productIds})
`).all()
```

#### 1-2. 인덱스 추가
```sql
-- 주문 조회 최적화
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_seller_status ON orders(seller_id, payment_status);

-- 상품 조회 최적화
CREATE INDEX idx_products_seller_active ON products(seller_id, is_active);
CREATE INDEX idx_products_stream ON products(live_stream_id, is_active);
```

#### 1-3. 낙관적 락 (Optimistic Locking)
```typescript
// 재고 차감 시 버전 체크
await DB.prepare(`
  UPDATE products 
  SET stock = stock - ?, version = version + 1
  WHERE id = ? AND stock >= ? AND version = ?
`).bind(quantity, productId, quantity, currentVersion).run()

// 영향받은 행이 0이면 재시도
if (result.meta.changes === 0) {
  throw new Error('재고 부족 또는 동시 수정 발생')
}
```

**예상 효과**: 
- 동시 주문 ~100-200건/초로 증가
- 재고 초과 판매 방지

---

### Phase 2: 아키텍처 개선 (비용 중간)

#### 2-1. Cloudflare KV 캐싱
```typescript
// 상품 정보 캐싱 (읽기 90% 개선)
const cached = await c.env.KV.get(`product:${productId}`)
if (cached) return JSON.parse(cached)

const product = await DB.prepare('SELECT * FROM products WHERE id = ?').first()
await c.env.KV.put(`product:${productId}`, JSON.stringify(product), { 
  expirationTtl: 300  // 5분
})
```

**예상 효과**:
- 읽기 성능 10x 향상
- D1 부하 90% 감소
- 동시 접속 ~5,000-10,000명 가능

**비용**: KV 무료 플랜 100,000 읽기/일

#### 2-2. Cloudflare Durable Objects (재고 관리)
```typescript
// 상품별 Durable Object로 재고 관리
class ProductStock extends DurableObject {
  async fetch(request) {
    const { action, quantity } = await request.json()
    
    if (action === 'decrease') {
      const currentStock = await this.ctx.storage.get('stock')
      if (currentStock < quantity) throw new Error('재고 부족')
      
      await this.ctx.storage.put('stock', currentStock - quantity)
      return new Response(JSON.stringify({ success: true }))
    }
  }
}
```

**예상 효과**:
- 재고 관리 경쟁 조건 완벽 해결
- 동시 주문 무제한 처리 가능
- 초과 판매 완벽 방지

**비용**: Durable Objects 유료 플랜 필요 (~$5/월 + 사용량)

#### 2-3. Cloudflare Queues (비동기 처리)
```typescript
// 주문 처리를 Queue로 비동기화
await c.env.QUEUE.send({
  type: 'order_created',
  orderId: order.id,
  userId: user.id,
  items: cartItems
})

// Consumer에서 처리
export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      await processOrder(message.body, env.DB)
    }
  }
}
```

**예상 효과**:
- Worker CPU 시간 제한 우회
- 복잡한 로직 비동기 처리
- 안정적인 주문 처리

**비용**: Queues 무료 플랜 100만 요청/월

---

### Phase 3: 외부 서비스 전환 (비용 높음)

#### 3-1. 메인 DB → PostgreSQL (Neon/Supabase)
```typescript
// Cloudflare Workers에서 PostgreSQL 연결
import { neon } from '@neondatabase/serverless'

const sql = neon(c.env.DATABASE_URL)
const products = await sql`
  SELECT * FROM products WHERE seller_id = ${sellerId}
`
```

**장점**:
- ✅ 동시 쓰기 무제한
- ✅ 트랜잭션 완벽 지원
- ✅ 용량 무제한
- ✅ JOIN 성능 우수

**단점**:
- ❌ 비용: Neon Pro ~$19/월, Supabase Pro ~$25/월
- ❌ Latency: Cloudflare Workers에서 외부 DB 호출 시 50-100ms 추가

**예상 효과**:
- 동시 접속 무제한
- 동시 주문 무제한
- 확장성 완벽 해결

#### 3-2. Firebase → Cloudflare Pub/Sub
```typescript
// Cloudflare Pub/Sub로 실시간 동기화
await c.env.PUBSUB.publish('stream-1-product', {
  productId: 123,
  name: '상품명',
  price: 50000
})

// 클라이언트는 WebSocket으로 구독
const ws = new WebSocket('wss://pubsub.cloudflare.com/stream-1-product')
```

**장점**:
- ✅ Firebase 비용 절감
- ✅ Cloudflare 네트워크 활용

**단점**:
- ❌ 아직 베타 단계
- ❌ 마이그레이션 비용

---

## 📊 확장성 시나리오별 대응

### 시나리오 1: 동시 접속 10,000명
**현재 상태**: ❌ D1 병목 발생

**해결책**:
- Phase 1: 쿼리 최적화 + 인덱스 (무료)
- Phase 2: KV 캐싱 추가 (무료)
- **예상 비용**: $0 (무료 플랜 내)

---

### 시나리오 2: 동시 주문 1,000건/초
**현재 상태**: ❌ 재고 경쟁 조건 + D1 쓰기 한계

**해결책**:
- Phase 2: Durable Objects 재고 관리 ($5/월)
- Phase 2: Cloudflare Queues 비동기 처리 (무료)
- **예상 비용**: ~$5-10/월

---

### 시나리오 3: 동시 접속 100,000명+
**현재 상태**: ❌ 완전히 불가능

**해결책**:
- Phase 3: PostgreSQL 전환 ($25/월)
- Phase 2: KV 캐싱 + CDN (무료)
- Phase 2: Durable Objects ($10/월)
- Phase 3: Pub/Sub ($10/월)
- **예상 비용**: ~$50-100/월

---

## 💰 비용 비교

### 현재 아키텍처 (Cloudflare Free)
```
Cloudflare Pages: $0
Cloudflare D1: $0 (5GB까지)
Firebase: $0 (100 동시 접속까지)
NicePay: 거래당 수수료만
────────────────────────
월 비용: $0
지원 가능 규모: ~500-1,000 동시 접속
```

### Phase 2 적용 (중규모)
```
Cloudflare Pages: $0
Cloudflare D1: $5/월
Cloudflare KV: $0 (무료 플랜)
Durable Objects: $5/월
Cloudflare Queues: $0 (무료 플랜)
Firebase: $25/월 (Blaze)
────────────────────────
월 비용: ~$35/월
지원 가능 규모: ~5,000-10,000 동시 접속
```

### Phase 3 적용 (대규모)
```
Cloudflare Pages: $20/월 (Pro)
PostgreSQL (Neon): $25/월
Cloudflare KV: $5/월
Durable Objects: $10/월
Cloudflare Queues: $5/월
Pub/Sub: $10/월
────────────────────────
월 비용: ~$75/월
지원 가능 규모: ~50,000-100,000 동시 접속
```

---

## 🎯 권장 사항

### 즉시 적용 (런칭 전)
1. ✅ **Phase 1-1**: D1 쿼리 최적화 (1시간)
2. ✅ **Phase 1-2**: 인덱스 추가 (30분)
3. ✅ **Phase 1-3**: 낙관적 락 구현 (2시간)

**소요 시간**: 3.5시간
**비용**: $0
**효과**: 동시 접속 ~1,000-2,000명, 재고 문제 90% 해결

---

### 런칭 후 모니터링
**지표 추적**:
- D1 응답 시간 (>1초면 경고)
- 동시 접속자 수
- 주문 실패율
- 재고 초과 판매 건수

**기준치**:
- 동시 접속 > 500명 → Phase 2 적용 고려
- 주문 실패율 > 5% → 즉시 Phase 2 적용
- 동시 접속 > 5,000명 → Phase 3 적용 필수

---

## 📝 최종 결론

### ⚠️ **현재 상태로는 대규모 트래픽 감당 불가**

**현재 한계**:
- 동시 접속: ~500-1,000명
- 동시 주문: ~50-100건/초
- 재고 경쟁 조건 존재

### ✅ **그러나 즉시 적용 가능한 개선책 존재**

**Phase 1 적용 시** (3.5시간, $0):
- 동시 접속: ~1,000-2,000명
- 동시 주문: ~100-200건/초
- 재고 문제 90% 해결
- **중소규모 런칭 가능**

**Phase 2 적용 시** ($35/월):
- 동시 접속: ~5,000-10,000명
- 동시 주문: ~500-1,000건/초
- 재고 문제 100% 해결
- **중대규모 서비스 가능**

**Phase 3 적용 시** ($75/월):
- 동시 접속: ~50,000-100,000명
- 동시 주문: 무제한
- 완벽한 확장성
- **대규모 서비스 가능**

---

## 🚀 제안

### 런칭 전략

**옵션 A**: Phase 1만 적용 후 런칭 (권장)
```
1. 쿼리 최적화 + 인덱스 + 낙관적 락 (3.5시간)
2. 소프트 런칭 (초대 제한, 1,000명 이하)
3. 모니터링하며 점진적 확장
4. 트래픽 증가 시 Phase 2 적용
```

**장점**:
- ✅ 빠른 시장 진입
- ✅ 비용 $0
- ✅ 검증된 후 확장

**옵션 B**: Phase 1+2 적용 후 런칭
```
1. Phase 1 적용 (3.5시간)
2. KV 캐싱 추가 (2시간)
3. Durable Objects 재고 관리 (4시간)
4. 정식 런칭
```

**장점**:
- ✅ 안정적인 서비스
- ✅ 5,000-10,000명 수용 가능
- ✅ 재고 문제 완벽 해결

**단점**:
- ❌ 추가 개발 9.5시간
- ❌ 월 $35 비용

---

어떻게 진행하시겠습니까?

**A)** Phase 1만 적용 후 소프트 런칭 (권장 ⭐)
**B)** Phase 1+2 적용 후 정식 런칭
**C)** 현재 상태로 런칭 (위험)
**D)** 전체 Phase 3까지 적용 후 런칭

