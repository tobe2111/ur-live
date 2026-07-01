# 유어딜(소비자) 정산 정합 설계 — Severe 1 + Severe 2

> 작성: 2026-07-01 (정산 라이브 점검 결과). 대상: **소비자 셀러(사업자 유저) 정산만**.
> 도매몰(제조사/판매사)·이용권 가맹점(restaurant_settlements)·에이전시 정산은 별개 시스템 — 본 문서 범위 밖.
>
> ⚠️ 본 문서의 **머니-이동 패치(§4.2, §4.3)** 는 이중지급 위험이 있어 **스테이징 검증 + 대표 승인 전까지 미배포**.
> 이번 커밋에서 배포된 것은 §5의 안전한 수수료 정합(5% 통일)뿐.

---

## 1. 현상 — 정산 회계가 3중으로 분리, 루프가 안 닫힘

| # | 시스템 | 저장소 | 크레딧(적립) 주체 | 지급 주체 | 셀러 대시보드 노출 |
|---|---|---|---|---|---|
| A | 주문 기반 | `orders.settlement_status` / `seller_amount` | 결제 확정(fee-resolver 스냅샷) | **어드민** '정산 관리'가 `completed` 처리 (`admin-settlements.routes.ts`) | ❌ 통계카드에 안 뜸 |
| B | 신청 테이블 | `settlements` (+ `seller_deal_balances`) | (없음 — §2 참조) | 어드민 수동 송금(추정) | ✅ 상단 통계카드(대기/완료/지급) = `settlements` SUM |
| C | 이중원장→지급 | `ledger_entries` → `payouts` | voucher 사용 시 `recordVoucherUsedLedger` → `seller:N` credit | **주간 크론**(차주 목요일) `payouts-generate.ts` 자동 | 일부(RestaurantSettlementsSection) |

### 핵심 불일치
- **어드민이 처리하는 대상(A: orders)** 과 **셀러 통계카드가 읽는 대상(B: settlements)** 이 **다른 테이블**.
  → 어드민이 '정산 완료'를 눌러도 셀러 상단 통계카드는 안 바뀜 (`SellerSettlementsPage.tsx:67` → `/settlements/stats` = B).
- **실제 자동 지급(C: payouts)** 금액이 이 페이지 통계카드에 없음 → 셀러가 실제 받은 돈 ≠ 화면 숫자.
- `settlement-automation.ts` 의 월간 리포트(`calculateSellerSettlement`, `generateSettlementReport`, `runMonthlySettlement`)는 `status IN ('delivered','confirmed')` **소문자** 필터 → orders.status 는 대문자(`DONE`/`DELIVERED`) → **항상 0건(죽은 코드)**. 활성 경로는 `calculateAutoSettlement`(대문자). ⚠️ "고치면" 휴면 writer 가 깨어나 매월 seller_id=0 마스터 행을 쓰기 시작하므로 **활성화하지 말고 제거 대상으로 표시**.

---

## 2. Severe 2 — 셀러 '정산 신청/환급' 이 구조적으로 항상 실패

### 근본 원인
- `SellerSettlementsPage.requestSettlement()` → `amount = stats.pending_amount`(= B 테이블의 이미 대기중 신청 합계)로 `POST /settlements/request`.
- `/settlements/request` 는 그 금액을 **`seller_deal_balances.redeemable_deal_amount` 로 상한 검증** (`seller-settlements.routes.ts:142-148`).
- **`redeemable_deal_amount` / `gated_deal_amount` 는 코드 어디서도 적립(+)되지 않음** — 전수 grep: 감소(차감/롤백)만 존재, `INSERT INTO seller_deal_balances` 0건. 행 자체가 없으면 SELECT=null → `settleable=0`.
- 결과:
  - 대기금액 > 0 → `"정산 가능 잔액(0원)을 초과했습니다"` (AMOUNT_EXCEEDS_BALANCE)
  - 대기금액 = 0 → `"정산할 금액이 없습니다"`
  - **어느 경우도 성공 못 함.** `/deal-withdraw`(환급)도 동일 원인으로 항상 잔액 0.
- 게다가 요청 금액을 `pending_amount`(이미 대기중 합계)로 잡는 것도 의미 오류 — 미정산 *수익* 이 아니라 *이미 신청한 것* 을 재신청하는 셈.

---

## 3. ⚠️ 이중지급 위험 (설계 결정이 필요한 이유)

`payouts-generate.ts` 크론은 매주(목) `seller:N` 원장 credit 을 집계해 **자동으로 `payouts` 를 생성**한다.
그런데 `getPayablePending('seller:N')`(`ledger.ts:425`)는 `credit − payouts(approved/sent)` 만 계산하고 **`settlements` 테이블은 차감하지 않는다.**

→ 만약 Severe 2 를 "정산 신청/환급을 원장 payable 에 연결"하는 식으로 순진하게 고치면, **같은 수익이 (1) 주간 자동 payout + (2) 수동 settlements 로 두 번 지급**될 수 있다. 두 경로가 서로를 안 본다.

**따라서 머니-이동 수정 전에 반드시 하나의 정책 결정이 필요하다** (§4.1).

---

## 4. 목표 설계

### 4.1 정책 결정 (대표 확정 필요) — "단일 지급 경로"
소비자 셀러 현금 지급은 **원장(C) 단일 경로로 수렴**한다:
- **SSOT = `ledger_entries` 의 `seller:N` credit** (결제확정/voucher사용 시 적립) − **`payouts` 지급분**.
- 지급 실행 = **주간 자동 `payouts`** (차주 목요일, ≥10,000원). 어드민은 `payouts` 상태(pending→approved→sent)만 관리.
- **B(`settlements` 테이블) 수동 신청 경로는 폐기(deprecate)** — 자동 payout 이 이를 대체. `seller_deal_balances`(gated/redeemable)도 폐기.
  - 단, 비사업자 원천징수(gated) / KT교환권 수령은 별도 유지 필요 여부를 §4.4 에서 판단.

> 대안(비권장): B 를 유일 경로로 삼고 C 자동 payout 을 끄기 — 이미 원장/주간스케줄에 투자된 인프라를 버리는 것이라 비권장.

### 4.2 [스테이징/승인 후] 셀러 대시보드를 진실되게 — 원장 payable 노출
- `/api/seller/settlements/summary` 또는 신규 `/api/seller/payouts` 가 **`getPayablePending('seller:'+sellerId)`(미지급 잔액) + `payouts` 이력(지급됨)** 을 반환.
- `SellerSettlementsPage` 통계카드를:
  - **미정산(payable)** = `getPayablePending`
  - **지급 예정** = 이번 주기 `payouts(status=pending)`
  - **지급 완료** = `payouts(status=sent)` 합계
  로 교체. `settlements` SUM 기반 카드 제거.
- 머니-이동 없음(읽기 전용). 하지만 표시 숫자가 바뀌므로 스테이징 확인 권장.

### 4.3 [스테이징/승인 후] '정산 신청' 버튼 처리
자동 payout 이 SSOT 가 되면 수동 '신청'은 불필요:
- **옵션 A(권장):** '정산 신청' 버튼 제거 → "매주 목요일 자동 정산" 안내로 대체. `/settlements/request` 는 deprecated (410 또는 안내).
- **옵션 B:** 유지하되 "조기 지급 요청"으로 의미 변경 → `getPayablePending` 상한 + **동일 주기 `payouts` 자동생성 스킵** 배선(이중지급 방지 CAS). 복잡 → 비권장.

### 4.4 비사업자 / 교환권 / 원천징수
- 비사업자 셀러의 gated 적립은 현재 `seller_deal_balances.gated_deal_amount` 인데 이 역시 미적립.
  → 원장에 `userdeal:` 패턴(비사업자 audit)처럼 `sellerdeal:N` gated credit 을 만들거나, 비사업자도 `seller:N` 에 적립하되 **출금 게이트(사업자 검증)** 만 유지.
- KT교환권 수령(`/voucher-redeem`)·원천징수(`withholdAndLog`)는 잘 동작(멱등·CAS) — SSOT 전환 시 차감 대상만 원장 payable 로 바꾸면 됨.

---

## 5. 이번 커밋에 포함된 안전한 수정 (머니-이동 없음, 배포됨)

수수료 기본율 **10% → 5% 정합** (정산=플랫폼 take, policy SSOT `PLATFORM_FEE_PCT=5`):
- `admin-settlements.routes.ts`: `DEFAULT_COMMISSION_RATE`(=`@/shared/constants` 의 10) 를 `COMMISSION_DEFAULTS.PLATFORM_FEE_PCT`(5) alias 로 교체 → stats/records/execute/CSV 의 NULL-rate 주문 집계가 fee-resolver/auto-settlement 와 일치.
- `settlement-automation.ts` `getSellerSettlementSummary` 기본율 `10.0 → PLATFORM_FEE_PCT`.
- (`orders.commission_rate` 스냅샷이 있으면 그 값 우선이므로 대부분 주문은 영향 0 — NULL-rate 레거시 주문만 5% 로 정정되어 셀러에 유리/정책 일치.)

전역 `DEFAULT_COMMISSION_RATE=10`(제휴/도매 등 타 소비처)는 **불변** — 정산 파일에서만 국소 교체.

---

## 6. 후속 작업 체크리스트 (스테이징 필요)
- [ ] §4.1 정책 대표 확정(단일 지급=원장 payout)
- [ ] §4.2 셀러 대시보드 payable/payouts 노출 (읽기)
- [ ] §4.3 '정산 신청' 버튼 처리(옵션 A)
- [ ] `settlements` 테이블 + `seller_deal_balances` deprecate 마이그레이션 계획
- [ ] `settlement-automation.ts` 죽은 월간 리포트 경로(소문자 status) 제거
- [ ] 어드민 '정산 관리'(orders 기반)와 payouts 정합 — 어느 하나로 통일 or 명시적 역할 분리
- [ ] 이중지급 방지 회귀 테스트(같은 수익이 payout+settlement 로 2번 안 나가는지)
