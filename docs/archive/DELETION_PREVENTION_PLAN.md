# 상품/라이브 스트림 삭제 방지 계획

## 문제 요약
- 상품 ID 18 삭제됨 (요청에 의해)
- 라이브 스트림 데이터 누락 발생 (원인 불명)
- 사용자 생성 데이터 보호 필요

## 삭제 원인 분석 결과

### 1. CASCADE DELETE 발견 ⚠️
```sql
-- 0020_create_live_stream_products.sql
FOREIGN KEY (live_stream_id) REFERENCES live_streams(id) ON DELETE CASCADE
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
```
→ 부모 레코드 삭제 시 자동으로 연결된 데이터 삭제

### 2. 수동 삭제 엔드포인트 존재
- `DELETE /api/seller/live-streams/:id` - 판매자 권한
- `DELETE /api/admin/streams/:id` - 관리자 권한
- `DELETE /api/seller/products/:id` - 판매자 권한

### 3. 자동 삭제 코드 없음 ✅
- 스케줄러, 크론 작업 없음
- 시간 기반 만료 삭제 없음

## 방지 방법

### 우선순위 1: Soft Delete 구현 (높음 🔴)

**현재**:
```sql
DELETE FROM products WHERE id = ?;
```

**개선**:
```sql
-- 1. 테이블에 deleted_at 컬럼 추가
ALTER TABLE products ADD COLUMN deleted_at DATETIME DEFAULT NULL;
ALTER TABLE live_streams ADD COLUMN deleted_at DATETIME DEFAULT NULL;

-- 2. 삭제 대신 soft delete
UPDATE products SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?;

-- 3. 조회 시 deleted_at IS NULL 조건 추가
SELECT * FROM products WHERE deleted_at IS NULL;
```

**장점**:
- 실수로 삭제해도 복구 가능
- 삭제 이력 추적 가능
- 감사 로그 자동 생성

---

### 우선순위 2: 삭제 로그 테이블 (중간 🟡)

```sql
CREATE TABLE deletion_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id INTEGER NOT NULL,
  deleted_by_user_id INTEGER,
  deleted_by_user_type TEXT,
  deletion_reason TEXT,
  record_snapshot TEXT, -- JSON
  deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**백엔드 수정**:
```typescript
// 삭제 전 로그 기록
await DB.prepare(`
  INSERT INTO deletion_logs (table_name, record_id, deleted_by_user_id, deleted_by_user_type, record_snapshot)
  VALUES (?, ?, ?, ?, ?)
`).bind('products', productId, userId, userType, JSON.stringify(product)).run();

// 실제 삭제
await DB.prepare('DELETE FROM products WHERE id = ?').bind(productId).run();
```

---

### 우선순위 3: 중요 레코드 삭제 방지 트리거 (낮음 🟢)

```sql
-- 특정 ID 삭제 방지
CREATE TRIGGER IF NOT EXISTS prevent_important_product_delete
BEFORE DELETE ON products
WHEN OLD.id IN (1, 2, 3, 17, 19, 20, 21)
BEGIN
  SELECT RAISE(ABORT, 'Cannot delete protected product');
END;

-- seller_id = 3 (사용자) 상품 삭제 방지
CREATE TRIGGER IF NOT EXISTS prevent_user_product_delete
BEFORE DELETE ON products
WHEN OLD.seller_id = 3
BEGIN
  SELECT RAISE(ABORT, 'Cannot delete user products without admin approval');
END;
```

---

### 우선순위 4: 관리자 승인 시스템 (낮음 🟢)

**삭제 요청 테이블**:
```sql
CREATE TABLE deletion_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id INTEGER NOT NULL,
  requested_by_user_id INTEGER NOT NULL,
  requested_by_user_type TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  reviewed_by_admin_id INTEGER,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**워크플로우**:
1. 판매자가 삭제 요청 생성
2. 관리자 검토 및 승인/거부
3. 승인 시에만 실제 삭제 실행

---

### 우선순위 5: DB 자동 백업 (높음 🔴)

**Cloudflare Workers Cron**:
```typescript
// wrangler.toml
[triggers]
crons = ["0 2 * * *"] // 매일 새벽 2시

// scheduled event handler
export default {
  async scheduled(event, env, ctx) {
    // 중요 테이블 백업
    const products = await env.DB.prepare('SELECT * FROM products').all();
    const liveStreams = await env.DB.prepare('SELECT * FROM live_streams').all();
    
    // R2에 백업 저장
    await env.R2.put(`backups/${Date.now()}-products.json`, JSON.stringify(products));
    await env.R2.put(`backups/${Date.now()}-live-streams.json`, JSON.stringify(liveStreams));
  }
}
```

---

## 즉시 적용 가능한 방법

### 1. Cloudflare D1 Time Travel (권장 🌟)

Cloudflare D1은 **자동으로 7일간의 스냅샷**을 저장합니다!

**복구 방법**:
1. Cloudflare Dashboard → D1 Database 선택
2. "Time Travel" 탭 클릭
3. 삭제 전 시점으로 복원

또는 CLI:
```bash
# 특정 시점으로 복원
wrangler d1 time-travel restore toss-live-commerce-db --timestamp="2026-02-20T00:00:00Z"
```

### 2. CASCADE DELETE 제거 (주의 ⚠️)

**문제**: 기존 테이블 수정은 D1에서 어려움

**대안**: 새 마이그레이션에서 제약 조건 재정의
```sql
-- 0082_remove_cascade_delete.sql
-- SQLite에서는 Foreign Key 수정이 어려우므로 테이블 재생성 필요
-- 프로덕션에서는 신중하게 적용 필요
```

---

## 권장 우선순위

### 즉시 (1주 내):
1. ✅ **Soft Delete 구현** - 가장 효과적
2. ✅ **삭제 로그 테이블** - 감사 추적

### 중기 (1개월 내):
3. ✅ **DB 자동 백업** - R2 저장
4. ✅ **삭제 방지 트리거** - 중요 레코드 보호

### 장기 (필요시):
5. ✅ **관리자 승인 시스템** - 워크플로우 구축

---

## 현재 상태

### 복구 완료 ✅
- 라이브 스트림 5개 복구 (ID 1-3 초기 데이터 + 사용자 생성 ID 15, 19, 20 유지)
- 상품 ID 18 삭제 (요청에 의해)
- 현재 10개 상품, 6개 라이브 스트림 운영 중

### 보호 필요 데이터
- **사용자 생성 상품** (seller_id = 3): ID 17, 19, 20, 21
- **사용자 생성 라이브** (seller_id = 3): ID 15, 19, 20

---

## 다음 단계

1. **사용자 확인**: 삭제된 상품/라이브가 더 있는지 확인
2. **Time Travel 복구**: Cloudflare D1 Time Travel로 7일 내 데이터 복구 가능
3. **Soft Delete 구현**: 다음 배포 시 적용
4. **백업 자동화**: Cron + R2 백업 시스템 구축

---

## 🔍 추가 조사: "자동 삭제" 원인 확정

### 실제 원인: 캐시 문제 🎯

**발견 사항**:
1. **DB에는 데이터 존재**: 사용자 생성 라이브 스트림 3개 (ID 15, 19, 20) 모두 `status = 'live'`
2. **메인 페이지에 안 보임**: API `/api/streams?status=live` 호출
3. **캐시 레이어 2개 발견**:
   - CACHE_KV: 10분 TTL (라인 3004-3012)
   - 메모리 캐시: 60초 TTL (라인 3095-3118)

### 시나리오 재구성:

1. **과거 어느 시점**: 라이브 스트림 데이터가 실제로 삭제됨 (CASCADE DELETE 또는 수동 삭제)
2. **삭제 직후**: API 호출 시 빈 배열 `[]` 반환
3. **빈 데이터 캐싱**: CACHE_KV와 메모리 캐시 모두 빈 배열 저장
4. **데이터 복구**: DB에 라이브 스트림 복구
5. **하지만**: 캐시는 여전히 빈 배열 (TTL 만료 전)
6. **결과**: 메인 페이지에 "라이브 없음" 표시

### 해결:
```bash
# CACHE_KV 캐시 수동 삭제
npx wrangler kv key delete "streams:live" \
  --namespace-id="25ecc9ce2c464dd59edf5eb7d5fd1a10" \
  --remote
```

### 교훈:

**캐시 무효화 전략 필요!**

1. **데이터 수정 시 즉시 캐시 삭제**:
```typescript
// 라이브 스트림 생성/수정/삭제 후
await CACHE_KV.delete('streams:live');
```

2. **Stale-While-Revalidate 개선**:
   - 현재는 백그라운드 갱신만 (라인 3101-3112)
   - 데이터 변경 이벤트 발생 시 즉시 캐시 무효화 추가 필요

3. **Cache-Aside 패턴 개선**:
   - Write-Through: 데이터 쓰기 시 캐시도 함께 업데이트
   - Write-Behind: 비동기로 캐시 갱신

### 권장 수정 (다음 배포 시):

```typescript
// 라이브 스트림 생성 API
app.post('/api/seller/live-streams', async (c) => {
  // ... 라이브 스트림 생성 ...
  
  // ✅ 캐시 무효화
  await c.env.CACHE_KV.delete('streams:live');
  
  // ✅ 메모리 캐시도 삭제
  deleteFromMemoryCache('live_streams:live:all:20:0');
  
  return c.json({ success: true, data: newStream });
});
```

