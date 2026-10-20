# DB 스키마 룰

프로덕션 DB 는 **구 스키마** (`migrations/0001_initial_schema.sql` + 이후 마이그레이션) 기반.
`001_initial.sql` (신 스키마) 은 **적용되지 않음**.

**Single Source of Truth**: `src/shared/db/production-schema.ts`

## 새 DB 쿼리 작성 시 필수 확인

1. `src/shared/db/production-schema.ts` 에서 실제 컬럼 확인
2. INSERT 시 모든 NOT NULL 컬럼 포함
3. try-catch 래핑 (방어적 코딩)

## 절대 사용 금지 컬럼 (존재하지 않음)

| 테이블 | ❌ 금지 | ✅ 대체 |
|--------|--------|--------|
| sellers | user_id, firebase_uid | id |
| sellers | slug | username |
| sellers | logo_url | profile_image |
| sellers | description | bio |
| users | deal_balance | user_points 테이블 사용 |
| users | status, role, avatar_url | 존재하지 않음 |
| users | display_name | name |
| users | referred_by, affiliate_ref | 존재하지 않음 |
| products | category_id | category (TEXT) |
| orders | total_price, amount | total_amount |
| orders | webhook_processed_at, webhook_event_id | 존재하지 않음 |
| orders | cancel_fail_reason | cancel_reason |
| order_items | price_snapshot | price |
| live_streams | viewer_count | current_viewers |
| donations | status | payment_status |

> ℹ️ `order_items.product_thumbnail`, `order_items.product_sku` 는 마이그레이션 0118 에서 추가 — 사용 가능

## Status 값 대소문자 규칙

- **orders.status**: 대문자 (`'PENDING'`, `'PAID'`, `'DONE'`, `'SHIPPING'`, `'DELIVERED'`, `'CANCELLED'`, `'REFUNDED'`)
- **payment_status**: 소문자 — CHECK 제약 허용 값: `'pending'`, `'approved'`, `'failed'`, `'cancelled'`, `'refunded'`
- 주문 "결제완료" 조건: `status IN ('PAID','DONE')` 또는 `payment_status = 'approved'` 모두 유효

## 자주 쓰는 컬럼 alias 주의

- `stock` (NOT `stock_quantity`)
- `is_active` (NOT `status`)
- `credit_amount` (NOT `seller_amount`)

## 검증 스크립트

```bash
bash scripts/check-schema-refs.sh  # 금지 컬럼 검출
bash scripts/check-api-auth.sh     # 인증 누락 검출
bash scripts/quality-check.sh      # 위 둘 + TS + 빌드
```

## 알려진 이중화 컬럼 (TD)

- `stock` / `stock_quantity`
- `shipping_fee` / `base_shipping_fee`

## DB Migration 파이프라인

🔴 **CI 자동 적용 미작동** (D1 권한 없음)
- 응급 처치: `/api/_internal/repair-schema`
- 적용 상태 확인: `/api/_internal/migration-status` (admin, 읽기 전용)

## 🧱 seller_meta 사이드테이블 (2026-07-05 — sellers 100컬럼 한도 도달)

sellers 가 D1 결과셋 한도(100)에 **정확히 도달** — 다음 ALTER 는 `SELECT s.*` 류를 500 으로
만들 수 있다(products 2026-06-10 사고와 동일 클래스). 새 셀러 메타는 무조건:

```ts
import { getSellerMeta, setSellerMeta } from '@/worker/utils/seller-meta' // 워커에선 상대경로
const meta = await getSellerMeta(DB, [sellerId])   // Map<seller_id, Record<key,value>>
await setSellerMeta(DB, sellerId, { some_flag: '1' })
```

- (seller_id, key, value) K-V — 스키마 변경 0 으로 확장. value TEXT(호출측 캐스팅), null=키 삭제.
- sellers ALTER 는 `check-products-column-budget.mjs`(sellers-column-baseline.json)가 CI 차단.
