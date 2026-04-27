# 스키마 이중화 컬럼 — 보수적 정리 계획 (W1 / TD-005)

> 작성: 2026-04-26
> 목적: DROP COLUMN 없이 점진적으로 단일 truth source 로 수렴.
>
> ⚠️ **DROP 은 진행 안 함**. 프로덕션 다운타임 위험. 대신:
> 1. 각 컬럼에 deprecation 마커
> 2. 신규 코드는 canonical 컬럼만 사용
> 3. 기존 fallback 패턴은 유지 (호환성)
> 4. 모든 쓰기 (INSERT/UPDATE) 에서 deprecated 컬럼 제거 → 자연 소멸 대기

---

## 1. 식별된 이중화 컬럼

| 테이블 | Canonical (사용) | Deprecated (fallback) | 현재 코드 패턴 |
|---|---|---|---|
| `products` | `stock` | `stock_quantity` | `COALESCE(stock, stock_quantity, 0)` |
| `sellers` | `shipping_fee` | `base_shipping_fee` | (확인 필요) |
| `orders` | `total_amount` | `total_price`, `amount` | `total_amount` 우선 (구 컬럼 이미 안 씀) |

---

## 2. 각 컬럼별 처리 계획

### 2.1 `products.stock_quantity` (deprecated)

**현재 사용처:**
- `src/worker/cron/scheduled-cleanup.ts:232,234` — `COALESCE` 읽기 (fallback)
- `src/worker/repositories/product.repository.ts:109` — `row['stock_quantity']` 읽기
- `src/features/seller/api/seller-orders.routes.ts:383,588,647,671` — INSERT 시 `stock_quantity = stock` 동시 작성 (현재 이중 쓰기)

**문제점:**
- INSERT 시 양쪽 모두 작성 → 동기화 부담
- 신규 환경엔 컬럼 없는데 `seller-orders.routes.ts:647` 가 `fields.push('stock_quantity = ?', 'stock = ?')` 둘 다 push

**권장 변경 (이번 PR — 안전 범위):**
- ✅ INSERT/UPDATE 시 `stock_quantity` 쓰기 **제거** (canonical `stock` 만)
- ✅ SELECT 의 fallback 은 유지 (구 데이터 보호)
- ❌ DROP COLUMN 은 안 함

**향후 정리 단계 (별도 PR):**
1. 6개월간 구 데이터 자연 소멸 관찰
2. `COALESCE` fallback 제거 (코드 단순화)
3. 그 후 1개월 무 이슈면 `ALTER TABLE products DROP COLUMN stock_quantity`

### 2.2 `sellers.base_shipping_fee` (확인 필요)

**현재 사용처:** grep 결과 없음 → 사실상 **이미 사용 안 함**.
**권장:** 코드 변화 없음 (deprecated 컬럼 자연 소멸).

### 2.3 `orders.total_price`, `orders.amount` (구 컬럼)

**현재 사용처:** 없음 (`total_amount` 만 사용).
**권장:** 코드 변화 없음.

---

## 3. 이번 PR 의 변경 범위

### A. `seller-orders.routes.ts:647` 의 stock_quantity 쓰기 제거

```diff
- fields.push('stock_quantity = ?', 'stock = ?');
- values.push(body.stock, body.stock);
+ fields.push('stock = ?');
+ values.push(body.stock);
```

→ INSERT 의 column list 에서 `stock_quantity` 도 제거.

### B. production-schema.ts 의 deprecated 마커 강화

```typescript
export interface ProductsTable {
  // ...
  stock: number  // INTEGER DEFAULT 0 — CANONICAL
  // 🚨 DEPRECATED: stock_quantity (read-only fallback). 신규 코드 사용 금지.
  // INSERT/UPDATE 에서 제거됨 (2026-04-26). 향후 DROP 예정.
}
```

### C. 운영 가이드 추가

이 문서 자체. 정리 단계별 모니터링 방법.

---

## 4. 위험 평가

| 변경 | 위험 | 완화 |
|---|---|---|
| INSERT 에서 stock_quantity 제거 | 🟡 신규 셀러 상품에 stock_quantity = NULL | `COALESCE(stock, stock_quantity, 0)` 가 stock 우선이라 무영향 |
| UPDATE 에서 stock_quantity 제거 | 🟡 기존 row 의 stock_quantity 가 stock 과 불일치 | SELECT 항상 stock 우선 → 사용자 무영향 |
| SCHEMA 자체 변경 | ❌ 없음 | DROP COLUMN 안 함 |

→ **전체 위험 LOW**. 사용자 영향 0.

---

## 5. 모니터링

배포 후 일주일간:
```sql
-- 신규 row 가 stock_quantity = NULL 로 들어오는지 확인
SELECT COUNT(*) AS null_count FROM products
  WHERE stock_quantity IS NULL AND created_at > '2026-04-26';

-- 기존 row 의 stock vs stock_quantity 불일치 (정상, 무시 가능)
SELECT COUNT(*) FROM products
  WHERE stock IS NOT NULL AND stock_quantity IS NOT NULL
    AND stock != stock_quantity;
```

→ 둘 다 정상이면 다음 단계 (fallback 제거) 로 진행.

---

## 6. 결정

**이번 PR 범위:**
- ✅ `seller-orders.routes.ts` 의 INSERT/UPDATE 에서 `stock_quantity` 쓰기 제거
- ✅ `production-schema.ts` 의 deprecated 마커 명확화
- ✅ 이 문서 (`SCHEMA_DEDUP_PLAN.md`)

**다음 PR 범위 (3~6개월 후):**
- COALESCE fallback 제거
- DROP COLUMN (사용자 합의 후)
