# 배송 시스템 재설계

**제안 날짜**: 2026-05-25
**현 상태**: ✅ **A 확정 (2026-05-25)** — voucher only, §4-1 `group_orders` / §6 (공구 배송) / §11 Phase 2-B / §12 공구 정책 행은 **deprecated** (다음 정리 commit 에서 제거)
**연계 docs**: [linkshop-pivot.md](./linkshop-pivot.md)
**audit 출처**: 2026-05-25 채팅 history (배송 구현 상태 thorough audit)

---

## 0. 🚨 2026-05-25 audit 정정 (사용자 catch) — A/B 결정 필요

초기 docs 작성 시 "공구 = 실물 배송" 으로 가정했으나, **사용자 catch + 코드 재확인 결과 공구 = 100% voucher (QR/교환권) 모델** 임을 발견.

### 현 공구 시스템 사실
- 카테고리 7종 전부 voucher: `meal_voucher` / `beauty_voucher` / `stay_voucher` / `etc_voucher` / `health_voucher` / `pet_voucher` / `activity_voucher` (`marketing.routes.ts:698`)
- 공구 성공 → `vouchers` 테이블에 `code` 발급 (`group-buy-types.ts`, `group-buy.routes.ts:662`)
- 매장 오프라인 검증: `store_verify_pin`, `store_owner_token`
- 카카오맵 후기 보너스 시스템 존재 (`review-bonus.routes.ts`)
- **실물 배송 불필요**

### 배송 시스템 실제 범위
| 카테고리 | 배송 필요 |
|---|---|
| `shopping` (일반 실물 상품) | ✅ |
| `*_voucher` (7종) | ❌ (QR/PIN) |
| `stay_voucher` (숙박) | ❌ (체크인) |
| `kt_alpha` (교환권) | ❌ (KT API) |

### 사용자 결정 필요 분기

| 분기 | 의미 | 영향 |
|---|---|---|
| **A. 공구 = voucher only 유지 (권장)** | 어드민 카탈로그도 voucher 위주, 실물 상품은 일반 쇼핑 (1인 주문) only. | 본 docs 의 §6 (공구 배송 모델) 전체 삭제. 배송 재설계 = "일반 쇼핑" 영역만. |
| **B. 실물 공구 신규 도입** | 어드민 실물 상품도 공구 모집 가능 (올웨이즈식). | 본 docs §6 유지 + `group_orders` 신규 + 카테고리 확장. |

**결정 전까지 §6 (공구 배송 모델) 은 "B 가설 plan" 으로 유지**. A 채택 시 본 섹션 + §6 + §4-1 `group_orders` 삭제.

### ✅ 2026-05-25 사용자 결정: **A 채택**
- 공구 = voucher only 유지 (기존 모델 그대로)
- 실물 배송 영역은 일반 쇼핑 (1인 주문) 만 해당
- 본 docs 의 공구 관련 모든 섹션 (§4-1 `group_orders`, §6 전체, §11 Phase 2-B, §12 공구 정책 4행) 은 **deprecated** — 다음 정리 commit 에서 제거 예정
- **남는 배송 작업**: §4-1 `shipping_logs`+`regional_shipping_fees`, §4-2 컬럼 확장, §5 배송비 함수, §7 CSV 일괄, §8 외부링크, §9 합배송, §10 알림

---

---

## 1. 한 줄 요약

기존 "셀러 1건씩 송장 입력 + 14일 cron 자동 배송완료" → **"어드민 SSOT 발송 + 공구 일괄 발송 모델 + 지역별 배송비 + CSV 일괄 송장 + 택배사 추적 통합"** 로 재설계.

---

## 2. 현 시스템 audit 요약 (2026-05-25)

| 항목 | 상태 |
|---|---|
| 개별 송장 입력 (셀러 1건씩) | ✅ |
| `orders` 테이블 배송 컬럼 (courier, tracking_number, shipped_at, delivered_at) | ✅ |
| 사용자 배송지 관리 (`shipping_addresses`) | ✅ |
| 반품 시스템 (9단계 상태) | ✅ |
| 무료배송 threshold (셀러별) | ✅ |
| **일괄 송장 CSV 업로드** | ❌ |
| **공구 배송 모델 (`group_orders` + 일괄 발송)** | ❌ 0% |
| **지역별 배송비 (제주/도서산간)** | ❌ UI 만 있고 계산 미연결 |
| **합배송 (다중 SKU 묶음)** | ❌ |
| **택배사 추적 API 연동** | ❌ |
| **배송 상태 알림 (push/카톡)** | ❌ |
| **배송비 컬럼 이중화 정리** (`shipping_fee` / `base_shipping_fee`) | 🟡 부채 |
| 자동 배송완료 (14일 cron) | 🟡 단순 cron, 실 추적 없음 |

---

## 3. 재설계 목표

### 3-1. 신모델 정합성
- 어드민 SSOT 카탈로그 → **발송 주체도 어드민이 default** (셀러는 라이브권자만 발송)
- 공구 = 모집 완료 → **일괄 발송 트리거** (단건 송장이 아닌 batch 처리)
- 모든 유저가 호스트 가능 → 발송 권한과 분리 (호스트 ≠ 발송자)

### 3-2. 운영 cost 최소화
- 100건 주문 시 1건씩 클릭 ❌ → **CSV 일괄 업로드 1번**
- 14일 추정 ❌ → **택배사 API 자동 동기화** (또는 수동 동기화 UI)

### 3-3. 사용자 경험
- "배송중" 상태에서 외부 추적 URL 클릭 가능
- 배송 시작 / 배송 완료 카톡 알림
- 제주/도서산간 추가비 명시 (체크아웃에서 사전 안내)

---

## 4. DB 스키마 재설계

### 4-1. 새 테이블

#### `group_orders` (공구 주문 컨테이너)
```sql
CREATE TABLE group_orders (
  id TEXT PRIMARY KEY,
  group_buy_id TEXT NOT NULL REFERENCES group_buys(id),
  status TEXT NOT NULL, -- recruiting / closed / shipping / delivered / cancelled
  total_quantity INTEGER NOT NULL DEFAULT 0,
  target_quantity INTEGER NOT NULL,
  closed_at TEXT, -- 모집 마감 시각
  bulk_shipped_at TEXT, -- 일괄 발송 시각
  cancellation_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```
- 각 `orders.group_order_id` 가 이 컨테이너 가리킴
- 모집 미달 → `cancelled` + 일괄 환불 (orders 전체)
- 모집 성공 → `closed` → 어드민 일괄 발송

#### `shipping_logs` (배송 상태 변경 audit)
```sql
CREATE TABLE shipping_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id),
  status TEXT NOT NULL, -- ready / picked_up / in_transit / delivered / returned
  source TEXT NOT NULL, -- manual / csv_bulk / courier_api / cron
  changed_by TEXT, -- user_id (어드민/셀러)
  note TEXT,
  raw_response TEXT, -- 택배사 API raw JSON
  created_at TEXT NOT NULL
);
```

#### `regional_shipping_fees` (지역 추가 배송비 매트릭스)
```sql
CREATE TABLE regional_shipping_fees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region_code TEXT NOT NULL, -- 'jeju' / 'island' / 'mountain'
  postal_code_pattern TEXT NOT NULL, -- '63%' (제주 63xxx) / '23000-23099' 등
  extra_fee INTEGER NOT NULL, -- 원 단위
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);
```
seed:
- 제주 (63xxx): +3,000원
- 울릉도 (40200-40240): +5,000원
- 도서산간 일반: +5,000원

### 4-2. 기존 테이블 확장

#### `orders` 추가 컬럼
```sql
ALTER TABLE orders ADD COLUMN group_order_id TEXT REFERENCES group_orders(id);
ALTER TABLE orders ADD COLUMN region_code TEXT; -- 'jeju' / 'island' / 'normal'
ALTER TABLE orders ADD COLUMN extra_shipping_fee INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN consolidated_with TEXT; -- 합배송 그룹 ID
ALTER TABLE orders ADD COLUMN courier_tracked_at TEXT; -- 택배사 API 마지막 동기화
```

#### `products` 추가 컬럼
```sql
ALTER TABLE products ADD COLUMN ship_from_postal TEXT; -- 출발지 우편번호
ALTER TABLE products ADD COLUMN ships_to_jeju INTEGER DEFAULT 1; -- 제주 배송 가능 여부
ALTER TABLE products ADD COLUMN ships_to_island INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN bundling_key TEXT; -- 같은 key 끼리 합배송
```

### 4-3. 정리 (기술 부채 해소)
- `sellers.shipping_fee` → 제거 (구 컬럼)
- `sellers.base_shipping_fee` 만 SSOT 로 유지
- migration 작성 시 데이터 백필 후 안전한 시점에 DROP

---

## 5. 배송비 계산 함수 재설계

```ts
// src/shared/utils/shipping.ts (신규 SSOT)
import { detectRegion } from './korea-regions'
import { POLICY } from '@/shared/constants/policy'

export function calculateShippingFee(input: {
  subtotal: number
  baseFee: number
  freeThreshold: number | null
  postalCode: string
  productFlags?: { shipsToJeju: boolean; shipsToIsland: boolean }
}): {
  baseFee: number
  regionFee: number
  totalFee: number
  region: 'normal' | 'jeju' | 'island' | 'unsupported'
  freeShippingApplied: boolean
} {
  // 1. 지역 detect
  // 2. 무료배송 threshold 체크
  // 3. 도서산간/제주 추가비 합산
  // 4. 배송 불가 지역 reject
}
```
- 체크아웃 / 카트 / 주문 생성 모두 이 함수 1개만 호출
- 기존 `calculateShippingFee(subtotal, baseShippingFee, freeThreshold)` 시그니처 deprecate

---

## 6. 공구 배송 모델

### 6-1. 라이프사이클

```
[모집 중]            ─────────────────────────────────────────
  └ orders status=PENDING_GROUP, group_order_id 발급
                                                              │
[모집 마감]                                                    │
  ├ 성공: group_orders.status=closed → orders status=PAID    │
  │       어드민이 일괄 발송 (CSV)                            │
  │       → group_orders.status=shipping                      │
  │       → orders.status=SHIPPING (batch update)             │
  │                                                            │
  └ 실패: group_orders.status=cancelled                       │
          → 일괄 환불 (toss cancelTossPayment x N)            │
          → orders.status=CANCELLED                            │
          → 배송비도 환불 (플랫폼 부담)                       │
─────────────────────────────────────────────────────────────
```

### 6-2. 결정 필요 정책

| 항목 | 권장 default | 확정 필요 |
|---|---|---|
| 모집 미달 환불 시 배송비 부담 | **플랫폼** (사용자/큐레이터에게 부담시키지 않음) | ⏳ |
| 결제 시점 | 모집 마감 후 일괄 결제 vs 참여 시 즉시 결제 | ⏳ (지금은 즉시 결제) |
| 모집 성공 후 개별 취소 | 마감 전까지만 (마감 후 일반 환불 룰) | ⏳ |
| 부분 출고 (일부 SKU 품절) | 출고 가능분 발송 + 품절 SKU 환불 | ⏳ |
| 일괄 발송 SLA | 마감 후 3영업일 이내 | ⏳ |

---

## 7. 어드민 일괄 송장 CSV 업로드

### 7-1. CSV 포맷
```csv
order_id,courier,tracking_number,shipped_at
ORD-001,cj,123456789012,2026-05-26
ORD-002,kr_post,987654321098,2026-05-26
```

### 7-2. API
```
POST /api/admin/orders/bulk-tracking
Content-Type: multipart/form-data
Body: file=<csv>

Response:
{
  total: 100,
  succeeded: 98,
  failed: 2,
  errors: [
    { row: 5, order_id: 'ORD-005', reason: 'order not found' },
    { row: 23, order_id: 'ORD-023', reason: 'already shipped' }
  ]
}
```
- transaction 처리 — 모두 성공 or 모두 rollback 옵션
- 일괄 처리 후 사용자에게 카톡 알림 trigger

### 7-3. UI
- `/admin/orders` 상단에 "CSV 일괄 업로드" 버튼
- 드래그앤드롭 + preview + dry-run 모드

---

## 8. 택배사 추적 API 연동

### 8-1. 옵션 비교

| 옵션 | 비용 | 구현 난이도 | 정합성 |
|---|---|---|---|
| **스마트택배 API** | 유료 (월 정액) | 낮음 | ✅ 통합 |
| **각 택배사 API 개별 연동** | 무료 (대부분) | 높음 (택배사별 다른 스펙) | 분산 |
| **수동 동기화 (어드민이 송장번호 클릭 → 외부 페이지 열기)** | 무료 | 매우 낮음 | ⚠️ 수동 |
| **포기 — 14일 cron 유지** | 무료 | 0 | ❌ 사용자 경험 저하 |

**권장**: Phase 2 에서는 **옵션 3 (수동 동기화 + 외부 링크)** + 14일 cron 유지. Phase 6 (마케팅 UX) 에서 스마트택배 도입.

### 8-2. 택배사 외부 추적 URL (즉시 가능)
```ts
const COURIER_TRACK_URLS = {
  cj: 'https://trace.cjlogistics.com/next/tracking.html?wblNo=',
  hanjin: 'https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&wblnumText2=',
  lotte: 'https://www.lotteglogis.com/home/reservation/tracking/index?InvNo=',
  kr_post: 'https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=',
  // ...
}
```
사용자가 송장 클릭 → 새 탭으로 택배사 페이지 이동.

---

## 9. 합배송 (Bundling)

### 9-1. 규칙
- 같은 `bundling_key` (상품에 설정) + 같은 사용자 + 같은 배송지 → 합배송 1건
- 배송비 = `MAX(bundling_key 별 baseFee)` (각각 더하지 않음)
- 무료배송 threshold 는 bundling 합계 기준

### 9-2. 합배송 트리거
- 체크아웃 시점 자동 그룹핑
- `orders.consolidated_with` 로 묶음 추적
- 어드민 발송 UI 에서 묶음 표시 (1 박스 = 묶음 1개)

---

## 10. 배송 상태 알림

| 이벤트 | 채널 | 본문 |
|---|---|---|
| 결제 완료 | 카톡 | "주문이 접수되었습니다 (ORD-001)" |
| 발송 시작 | 카톡 | "🚚 [CJ대한통운] 123456789012 발송되었습니다" + 추적 URL |
| 배송 중 (택배사 API 동기화 시) | (옵션) | - |
| 배송 완료 | 카톡 | "📦 배송이 완료되었습니다. 리뷰 작성하기" |
| 공구 마감 성공 | 카톡 | "공구가 성공했습니다! 3영업일 이내 발송 예정" |
| 공구 마감 실패 | 카톡 | "공구가 무산되어 전액 환불됩니다" |

알림 trigger 위치:
- `seller-orders.routes.ts` 송장 등록 직후
- `admin-orders.routes.ts` CSV 일괄 업로드 후
- `cron/scheduled-cleanup.ts` 배송완료 cron
- `cron/group-buy-close.ts` 공구 마감 cron (신규)

---

## 11. 구현 phase 분해

### Phase 2-A: DB + 배송비 계산 (1주)
- [ ] `regional_shipping_fees` 테이블 + seed
- [ ] `orders.region_code`, `extra_shipping_fee` 컬럼
- [ ] `calculateShippingFee()` SSOT 함수 재작성
- [ ] 체크아웃 / 카트 호출부 마이그레이션
- [ ] migration 0205 + repair-schema 등록

### Phase 2-B: 공구 배송 모델 (2주)
- [ ] `group_orders` 테이블 + `orders.group_order_id`
- [ ] 공구 마감 cron (`cron/group-buy-close.ts`)
- [ ] 모집 성공 → orders batch update / 실패 → 일괄 환불
- [ ] 어드민 공구 발송 UI

### Phase 2-C: 일괄 송장 CSV (1주)
- [ ] `POST /api/admin/orders/bulk-tracking`
- [ ] `/admin/orders` CSV 업로드 UI
- [ ] `shipping_logs` 테이블 + audit

### Phase 2-D: 택배사 외부 링크 + 알림 (3일)
- [ ] `COURIER_TRACK_URLS` 매핑
- [ ] 송장 클릭 → 새 탭
- [ ] 카톡 알림 trigger (발송/완료/공구 마감)

### Phase 2-E: 합배송 (옵션 — Phase 6 으로 미뤄도 OK)
- [ ] `products.bundling_key`
- [ ] 체크아웃 그룹핑
- [ ] `orders.consolidated_with`

### Phase 2-F: 정리 (1주)
- [ ] `sellers.shipping_fee` 컬럼 DROP (백필 후)
- [ ] 14일 cron → 7일 + 택배사 정보 있을 때만 (Phase 6 까지는 유지)
- [ ] TECHNICAL_DEBT.md 해당 항목 close

---

## 12. 정책 결정 필요 (사용자 확인)

| 항목 | 권장 default | 결정 필요 |
|---|---|---|
| 제주 추가 배송비 | +3,000원 | ⏳ |
| 도서산간 추가 배송비 | +5,000원 | ⏳ |
| 공구 모집 미달 환불 시 배송비 부담 | 플랫폼 | ⏳ |
| 공구 결제 시점 | 참여 시 즉시 결제 (현행 유지) | ⏳ |
| 공구 일괄 발송 SLA | 마감 후 3영업일 | ⏳ |
| 택배사 추적 API | Phase 2 는 외부 링크만, Phase 6 에서 스마트택배 | ⏳ |
| 합배송 도입 시점 | Phase 2-E (옵션) vs Phase 6 | ⏳ |
| 14일 자동 배송완료 cron | Phase 2 까지 유지, 이후 단축 | ⏳ |

---

## 13. 위험 요소

- 🔴 **공구 배송 정책 모호 → 환불 분쟁** — SLA 명문화 필수
- 🟡 **CSV 포맷 오류** — dry-run 모드 필수, 트랜잭션 처리
- 🟡 **합배송 = 사용자 기대 vs 실 출고 사이 mismatch** — 어드민 출고 UI 정교화
- 🟢 **택배사 외부 링크** — 택배사 URL 변경 시 깨짐. 자동 모니터링 시도 권장

---

## ⏳ 구현 todo

Phase 2-A → 2-F 순차 진행. 각 phase 완료 시 본 docs 하단에 `## ✅ Phase 2-X 구현 완료` 섹션 + commit hash 추가.

---

## ✅ Phase 2 구현 완료 (2026-05-25)

A 채택 (voucher 공구 only) — 실물 배송 영역만 재설계.

| Commit | 영역 | hash |
|---|---|---|
| 1/5 | DB (mig 0279) + 정책 SSOT + calculateShippingFeeV2 | `9d913840` |
| 2/5 | tracker.delivery 무료 API + courier-codes SSOT + 5 endpoints | `060e0249→` |
| 3/5 | order.routes V2 통합 + seller 송장 carrier_code | `bb45dae6` |
| 4/5 | 인앱 추적 모달 + OrderDetailModal 통합 | `74d945ba` |
| 5/5 | 어드민 CSV UI + 가이드 + docs | (이 commit) |

### 핵심 구현

**3중 안전망 (배송 추적)**:
1. tracker.delivery GraphQL (무료 공개) — 한국 택배사 20+ 자동 sync
2. 외부 URL fallback — 12개 매핑 (CJ/한진/롯데/우체국/로젠/CU/GS/대신/일양/경동/천일/CWAY)
3. cron 6시간 + 7일 추정 fallback

**지역별 배송비**:
- `regional_shipping_fees` 테이블 SSOT
- 제주(63xxx): +3000원
- 도서산간 (울릉/백령/연평/거제): +5000원

**일괄 송장 CSV**:
- `/admin/shipping/bulk-tracking` 페이지
- 1000행 batch + dry_run 사전 검증
- 중복 자동 skip

### 새 라우트
- `/admin/shipping/bulk-tracking` (requireAdmin)
- `GET  /api/shipping/track/:carrier/:trackingNumber` (public, 60s cache)
- `GET  /api/shipping/order/:orderId/track` (requireAuth)
- `GET  /api/shipping/couriers` (public)
- `POST /api/shipping/admin/bulk-tracking` (requireAdmin)
- `POST /api/shipping/admin/sync` (requireAdmin)

### 알려진 한계 (후속 PR)
- 합배송 (`ENABLE_BUNDLING=false`) — Phase 6
- 해외 배송 — 미지원
- 인스타 스토리 공유 (canvas 합성)
- 셀러용 CSV 업로드 (현재 어드민만)
