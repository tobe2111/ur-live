# 🧪 스테이징 실결제 검증 체크리스트 — 2026-06-29 결제 정확성 감사

> 이 세션의 머니 산술 변경 4건은 이 환경에서 **라이브 검증 불가**(egress 차단). 배포 전 staging 에서 아래를 1회씩 확인. 각 항목 옆 commit 은 변경 출처.

## 1. 그룹바이 할인 cap (`8b3802d76` — `order.routes.ts`)
**목적**: 정상 공구 주문은 통과, 위조 할인은 차단되는지.
- [ ] **정상**: `group_buy_tiers` 가 설정된 공구권 상품을 정상 결제 → confirm 통과(400 안 남), 차감액 = `current_price`(상세페이지 표시가)와 일치.
- [ ] **경계**: 할인 없는(tiers null) 상품 결제 → 영향 0(통과).
- [ ] **위조(개발자도구)**: 주문 요청 body 의 discount 를 실제 tier 할인보다 크게 조작 → confirm 이 **서버 cap 으로 잘라** 통과하거나 금액불일치로 차단(과금 0). under-charge(할인 과대적용) 발생 안 함.
- [ ] 쿠폰+딜+공구할인 동시 주문 → 합산 할인이 `discountBase` 초과 안 함, confirm 통과 + 잔액 차감 정상.

## 2. 클로백 반올림 (`06e0784e1` — `voucher-settlement-clawback.ts`)
**목적**: 부분환불 후 정산액이 cron 재계산값과 일치(drift 0).
- [ ] 교환권/이용권 여러 건 매출 있는 셀러 → 1건 부분환불 → `seller_settlements` 의 해당 정산 row 의 revenue/commission/net 이 **남은 매출 기준 재계산값**과 정확히 일치(이전엔 per-voucher 차감으로 ±몇 원 drift).
- [ ] 환불 2건 연속 → 누적 정합(음수 안 됨, MAX(0) 가드).

## 3. Toss 취소 비정수액 (`06e0784e1` — `order.routes.ts`)
**목적**: 취소 금액이 정수로만 Toss 에 전달.
- [ ] 카드결제 주문 부분취소(`cancel_amount` 지정) → Toss 취소 호출의 cancelAmount 가 정수. (이전: `body.refund_amount` 가 소수면 Toss 거부 가능.)
- [ ] 전액취소(`refund_amount` 미지정) → cancelAmount=undefined → Toss 전액취소.

## 4. 5% 커미션 일원화 (`d6567ef89` — `settlement-automation.ts`)
**목적**: 라이브 경제변화 0 확인(이미 5%였음).
- [ ] 신규 셀러 주문 정산 → 플랫폼 수수료 5%(seller `commission_rate` 미설정 시 COALESCE 5). 어드민이 셀러별 조정한 rate 는 그대로 우선.
- [ ] 어드민 정산 화면의 수수료 표시 = 5%(10% 잔재 없음).

## 5. store-intro 상수 (`20aa1301c` — `policy.ts`)
**목적**: 값 불변(2.0%/1.5%) 확인 — 리팩터만.
- [ ] 에이전시 영입 가게 주문 → `agency_store_intro_commissions` 적립 = 매출의 2%.
- [ ] 영입자(인플) 영입 가게 주문 → `influencer_attributions(source='store_intro')` = 매출의 1.5%.

---
## 통과 후
- 위 전부 OK → 배포 진행(`npm run build` → wrangler pages deploy).
- fee-resolver 실배선은 **별개**(이 검증과 무관) — `docs/design/fee-resolver-cutover.md` 결정 후 착수.
