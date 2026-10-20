# 🧾 에이전시 머니/운영 런북 — 정산 E2E · 가이드 재시드 · 셀러 스코프 SSOT

> 2026-06-17 작성. 에이전시 대시보드 '매장 영입' 중심 재편 + 개선점 12종 작업의 **외부 권한이 필요한 잔여 3건**
> (④ 자동정산 staging E2E / ⑫ 운영 가이드 재시드 / ② 에이전시↔셀러 스코프 정합) 의 실행 런북.

---

## ④ 자동정산 staging 실결제 E2E 체크리스트

**왜 필요한가**: 자동정산 cron(`agency-auto-settle.ts`)에 **claim-before-credit**(`UPDATE orders SET agency_settled=1 ... RETURNING` 원자적 선점)과 **원천징수 SSOT**(`WITHHOLDING_RATES.business_income`)를 도입했다. 단위/빌드는 통과하나, 실제 `결제 → 주문확정 → cron 정산행 → 지급액` 배선은 외부망 차단 환경이라 미검증.

### 에이전시 수익 경로는 2가지
1. **매장 영입 commission** (`creditAgencyStoreIntroCommission`, `payment.routes.ts:405` 결제확정 시 즉시):
   - 영입 매장(`sellers.introduced_by_agency_id`) 첫 결제 → **가입 보너스 ₩30,000**(1회) + 매출 **2%**(`agencies.store_intro_commission_pct`).
   - 적립 행: `agency_store_intro_commissions` (status `pending`→`available`→`paid`).
   - 멱등: order_id 기준 중복 차단. 환불 시 `status='cancelled'` 역전.
2. **소속 셀러 매출 commission** (`agency-auto-settle.ts`, 주 1회 cron):
   - `agency_sellers` 소속 셀러의 `DELIVERED/DONE + settlement_status=confirmed + agency_settled=0` 주문을 원자 선점 → 수수료 = 매출 × `commission_rate%` → 세금 3.3% 차감 → `agency_settlements` 행.

### E2E 단계 (staging)
1. 테스트 에이전시 생성 + `auto_settle=1`, `commission_rate` 확인.
2. **매장 영입**: 영입 코드(`AG-XXXX`)로 가게 셀러 가입 → `introduced_by_agency_id` 세팅 확인.
3. 가게 셀러가 공구 상품 등록 → 소비자 **실결제**(또는 staging 결제).
4. ✅ 검증 A (store-intro): `SELECT * FROM agency_store_intro_commissions WHERE agency_id=?` →
   - 첫 결제에 `signup_bonus` ₩30,000 1행 + `sales_commission` 2% 1행.
   - **동일 주문 재확정/webhook 중복** 시 행 추가 안 됨(멱등).
5. 주문을 `DELIVERED` + `settlement_status='confirmed'` 로.
6. cron 수동 트리거(`/api/admin/_run-cron` 또는 스케줄) → ✅ 검증 B (auto-settle):
   - `agency_settlements` 1행 생성, `tax_amount = round(commission × 0.033)`.
   - **cron 2회 실행해도 동일 주문 재정산 안 됨**(claim-before-credit — 2번째 실행은 `RETURNING` 0행 → skip).
7. **환불**: 주문 환불 → store-intro commission `cancelled` 역전 확인. `available_commission` 감소.
8. **출금**: 영입 commission 출금 신청 → `commission_withdrawals` 의 `withholding_tax`/`net_amount` 로 원천징수 반영 확인(사업자=면제/계산서, 비사업자=3.3%).

### 통과 기준
- 표시 commission = 적립 행 합 = 출금 가능액. 이중 정산 0. 환불 역전 정확. 세금 라인 일치.

---

## ⑫ 운영 가이드 재시드 (라이브→공구·매장 재정렬 반영)

**왜 필요한가**: `guide-seed-agency.ts` 를 공구·매장 중심으로 재정렬했으나, `ensureSeeded` 는 **operation_guides 가 0행일 때만** `INSERT OR IGNORE` 하므로 **기존 에이전시 DB 엔 자동 반영 안 됨**.

### 방법 A — 1-클릭 재시드 엔드포인트 (권장, 2026-06-17 신설)
```bash
# 관리자 토큰으로 (해당 type 전체 DELETE 후 시드에서 재삽입 — 관리자 수동 편집분도 덮어씀)
curl -X POST https://live.ur-team.com/api/guides/agency/reseed \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'
# → { success: true, inserted: N }
```
- `confirm:true` 없으면 400(footgun 가드). admin 전용. `type` = `agency`/`seller`/`admin`/`wholesale`.

### 방법 B — 관리자 UI 수동 편집
- `/admin/operations-guide` 에서 변경된 agency 섹션을 직접 편집(섹션별 PATCH). 수동 편집을 보존하고 싶을 때.

> ⚠️ 방법 A 는 **전체 교체**라 그간의 수동 편집을 덮어쓴다. 에이전시 가이드는 라이브 시대 시드가 박제돼 있어 재시드가 목적에 부합하지만, seller/admin 가이드에 방법 A 를 쓸 땐 수동 편집 유무 먼저 확인.

---

## ② 에이전시 ↔ 셀러/매장 스코프 SSOT (정합 결정)

에이전시가 "내 셀러/매장"을 가리키는 컬럼이 **3종** 존재하며, 의미가 **서로 다르다**(통합 X — 각자 다른 사실):

| linkage | 의미 | 주 사용처 |
|---|---|---|
| `agency_sellers` (조인 테이블) | 에이전시가 **관리**하는 셀러 (초대/매칭/이전/배정으로 등록) | agency-stats(주문·매출·라이브), bundle |
| `sellers.agency_id` (역정규화 컬럼) | 셀러의 소속 에이전시 (1:1) | 일부 admin/auth 경로 |
| `sellers.introduced_by_agency_id` | 그 가게를 **영입**한 에이전시 (관리 주체와 다를 수 있음) | introduced-stores, store-intro commission |

### 결정 (2026-06-17)
- **컬럼 통합/collapse 금지** — 의미가 다르다(영입 ≠ 관리). 전역 collapse 는 정산·통계 다수 쿼리에 영향이라 위험.
- **'에이전시의 공구' 스코프 = `agency_sellers` OR `introduced_by_agency_id`** 로 통일(관리 셀러 + 영입 매장 모두 포함).
  - 적용됨: `agency-stats /stats`(진행중 공구 KPI), `disputes/agency-overview`(active_groups/at_risk/churn alert).
  - → 대시보드 "진행중 공구" KPI 와 alert "진행중 공구 N개" 배지가 **동일 숫자**.
- **잔여 주의**: `agency_sellers` 와 `sellers.agency_id` 는 **독립 갱신**되어 drift 가능. 둘을 동시에 세팅하지 않는 코드 경로가 있으면 향후 정합 작업 대상. 신규 코드는 **관리 셀러 = `agency_sellers`** 를 SSOT 로 사용할 것.
