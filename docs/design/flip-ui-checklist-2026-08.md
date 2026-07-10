# 8월 flip UI 변경 체크리스트 — 대시보드 3표면 적합도 전수조사 종합

> 2026-07-10 전수조사(에이전시·어드민·서비스/매장 3표면 병렬 감사) 종합. **구현은 8월 flip 세션에서** — 설계 논의는 봉인됨(대표 확정). 확정 모델·불변식 SSOT: `docs/design/commission-funding-restructure.md` §확정 원칙 / 3단 권한 §4.3 (`vendor-commission-passthrough.md`).
>
> 확정 모델(박제): 유어딜 5% = 순수 인프라비(PG 포함, 커미션 불사용) · 모든 판매 커미션 + 에이전시 조율 몫 = 매장 promo(95% 안) 재원 · 에이전시 = promo에서 스스로 가져가는 독립 조율 사업자 · 3단 위임(셀프/승인형[기본]/완전위임) · 불변식 #44: 원장 `platform:revenue` = 5% 전액, 성장 커미션 debit 0.

## 1. 한 줄 결론

**flip 스위치·계산기·캡·비교 인프라(설계도)는 어드민에 완비돼 있으나 전부 OFF 상태이고, 라이브에 노출된 커미션 표면은 3표면 모두 여전히 "유어딜이 준다" 구모델이며, 위임·promo 투명성·매장→인플 제안 UI는 미구현** — 8월 flip은 스위치 ON + 프레이밍 전환 + 부재 UI 신설의 3종 작업이다.

## 2. 3표면 요약 표

| 표면 | ✅ 적합 | 🟡 구모델 | ❌ 미구현 | 핵심 한 줄 |
|---|---|---|---|---|
| 에이전시 | ~7% | ~50% | ~43% | 커미션 표면 전체가 "유어딜로부터 2%/1% 수령" 프레이밍, 위임·분배·조율 UI 전무 |
| 어드민 | 11개 중 3개 (#4,5,6) | 7개 | 1개 (#7) | flip 스위치·캡 이력·fee 비교는 준비 완료(OFF), 정산·요율·세무는 구모델 |
| 셀러/소비자 | 10개 중 3개 (#2,8,10) | 5개 | 2개 (#5,6) | promo 계산기(모델 정본)는 이미 존재하나 게이트 OFF, 위임 회수·인플 제안 UI 전무 |

## 3. 공통 패턴 (3표면 관통)

1. **"설계도는 있고 스위치는 OFF"** — `commission_budget_enabled` / `promo_funding_source` / `pg_reserve_pct` / `seller_promo_field_enabled`(어드민 #4), `SELLER_PROMO_FIELD_ENABLED=false`(feature-flags.ts:62), PromoMarginCalculator(모델 정본, 게이트 뒤). flip = 대부분 신규 개발이 아니라 **활성화 + 배선**.
2. **라이브 노출 표면 = 전부 구모델 프레이밍** — "유어딜이 지급/설정" 언어가 에이전시 정산 전 페이지, 어드민 요율·payout, 인플 정산(:204,286)에 공통. flip 시 **재원 출처("○○매장 promo에서")** 로 일괄 전환 필요.
3. **promo 지출 투명성·위임 UI 3표면 공통 부재** — 매장별 promo 잔액/소진 뷰(에이전시·어드민 #7·셀러 #4), 3단 위임(store_agency_delegation) 표면, 매장 위임 회수, 매장→인플 제안 UI 전부 없음. **flip의 유일한 순수 신규 개발 영역.**
4. **어드민 역할 전환 공통 방향** — "요율 설정·지급 주체" → "캡 가드·감사 뷰어"로 이동(#1,#3,#8,#9,#10 동일 패턴).
5. **게이트 우회 잔존물** — 게이트 없이 라이브인 구식 병렬 referral UI(SellerStayNewPage), 쇼핑탭 숨김인데 남은 CTA(PrimaryActions) 등 flip 전 정리 대상.

## 4. 8월 flip UI 변경 체크리스트 (우선순위 순)

### A. 어드민 (스위치 + 재배선 + 신설 1)

- [ ] **A1. flip 스위치 ON** — [어드민] AdminPlatformSettingsPage.tsx:46-86,185-219 · admin-tools.routes.ts:306-322. `commission_budget_enabled` / `promo_funding_source=owner` / `pg_reserve_pct` / `seller_promo_field_enabled` 활성화 (⚠️ 머니 경로 — 단독 세션 + staging 실결제 필수, CLAUDE.md 룰).
- [ ] **A2. promo 재원 원장 감사 화면 신설 (유일 미구현)** — [어드민] order당 재원 구분(5% vs promo) + `platform:revenue` 5% 전액 검증(불변식 #44) + 매장 promo 잔액·소진 뷰. 현재 부재 (감사 #7).
- [ ] **A3. 수수료율 탭 전환** — [어드민] admin-payouts.routes.ts:342-415 · AdminPayoutsPage.tsx:298-376. 5% 분배 슬라이더에서 agency/influencer share 제거, `platform_fee_pct` "인프라비 5% 불변" read-only化.
- [ ] **A4. 4계정 분배 바 이관** — [어드민] AdminCommissionSettingsPage.tsx:116-158. "매출 100% 분배"(유어딜/인플/유저/에이전시/셀러) 중 인플·유저·에이전시 슬라이스를 promo 재원으로 이관.
- [ ] **A5. 캡 표면 승격** — [어드민] AdminCommissionSettingsPage.tsx:255-267 · commission-rates.ts:159. `max_influencer_commission_pct`를 구모델 페이지에서 분리해 캡 전용 가드 화면으로 (GMV clamp → promo 분배 clamp 관점 정리).
- [ ] **A6. fee 비교의 promo 슬라이스 실기록** — [어드민] AdminFeeBreakdownComparePage.tsx · admin-fee-breakdown.routes.ts:61-198. `new_promo` 항상 0인 문제(fee-breakdown.routes.ts:193 promo 미모델링) 해소.
- [ ] **A7. 에이전시 payout 재배선** — [어드민] admin-payout-center.routes.ts:66-110,220-261 + admin-payouts.routes.ts:29-306. "유어딜→에이전시 지급" → promo 통과 정산, 어드민은 캡 감사만. agency `payee_type` 이관.
- [ ] **A8. 에이전시 per-요율 설정 이동** — [어드민] AdminAgencyPage.tsx:533-557 · admin-agency.routes.ts:125-160. 어드민의 에이전시별 요율·24개월 설정 → 매장↔에이전시 위임으로 이동, 어드민은 max cap 가드만.
- [ ] **A9. 세무 export 회계 분리** — [어드민] admin-tax.routes.ts:232-282,117-184. 에이전시 몫을 유어딜 비용/세금계산서 대상에서 제외 → 매장 promo 통과(유어딜 비용 아님)로.

### B. 에이전시 대시보드 (프레이밍 전환 + 신설 3)

- [ ] **B1. 커미션 전 표면 프레이밍 전환** — [에이전시] AgencySettlementsPage.tsx · agency-settlements.routes.ts · AgencyIncentivesPage.tsx · AgencyStatsPage.tsx · AgencyPage.tsx · AgencyIntroducedStoresPage.tsx. "유어딜로부터 2%/1% 수령" → "매장 promo에서 조율 몫 수령(독립 사업자)".
- [ ] **B2. 3단 위임 표면 신설** — [에이전시] `store_agency_delegation` 기반 셀프/승인형[기본]/완전위임 상태·전환 UI. 현재 미구현.
- [ ] **B3. vendor_commission_splits 분배 UI 신설** — [에이전시] 매장-인플 커미션 조율(에이전시가 promo 안에서 분배 설정하는 화면). 현재 미구현.
- [ ] **B4. 매장별 promo 잔액/소진 투명성 뷰 신설** — [에이전시] 조율 대상 매장의 promo 재원 현황. 현재 미구현.

### C. 셀러(매장) 대시보드

- [ ] **C1. promo 설정 화면 라이브 노출** — [셀러] SellerMealVoucherNewPage.tsx:89,253,637-672 (promo_pct→`products.referral_commission_rate` 매핑 정확) + PromoMarginCalculator.tsx:41-85 — `SELLER_PROMO_FIELD_ENABLED`(feature-flags.ts:62) ON으로 게이트 해제 (A1과 동시).
- [ ] **C2. 구식 병렬 referral UI 흡수** — [셀러] SellerStayNewPage.tsx:463-499. 게이트 없이 라이브인 influencer_discount_pct/commission_pct("인플 settle 시 지급") → 통합 promo 모델로 흡수.
- [ ] **C3. promo 지출 브레이크다운 노출** — [셀러] SellerSettlementsPage + seller-settlements.routes.ts:64-66 (현재 5% 수수료만) + SellerRealtimeDashboardPage.tsx:91-94 (총액만). promo 지출·수령인별 내역 추가.
- [ ] **C4. 매장 위임 회수 UI 신설** — [셀러] 현재 전무 (agency-members.routes.ts:311 `status='removed'`는 에이전시 내부 멤버 제거일 뿐 — 매장 주도 회수 아님). 3단 위임의 매장측 짝.
- [ ] **C5. 매장→인플 promo 제안 UI 신설** — [셀러] `seller_influencer_deals` seller-facing 화면 전무 (인플측 InfluencerSettlementPage.tsx:106-115만 존재).
- [ ] **C6. 쇼핑 CTA 잔존물 정리** — [셀러] PrimaryActions.tsx:52-54 "상품 등록 · 쇼핑/공구 모두" — `SHOPPING_TAB_HIDDEN=true`(feature-flags.ts:17)와 불일치.

### D. 인플루언서

- [ ] **D1. 정산 재원 출처 표기 전환** — [인플] InfluencerSettlementPage.tsx:204,286. "유어딜에서 받는 돈" → "○○매장 promo에서 지급".

### E. 소비자

- [ ] **E1. 체크아웃 기본 구조 역전 해소** — [소비자] CheckoutPage.tsx:190-227. 배송이 기본/이용권이 예외인 구조(shipping_fee 3000 기본) → 이용권 우선으로 정합.

## 5. 이미 적합 — flip 때 건드릴 필요 없음

- **flip 스위치 세트 자체** (AdminPlatformSettingsPage.tsx:46-86,185-219) — 켜기만 하면 됨.
- **캡 발동 이력 표** (AdminPlatformSettingsPage.tsx:277-330, `commission_budget_logs`) — 게이트 ON 시 자동으로 채워짐.
- **PromoMarginCalculator.tsx:41-85** — "판매가→플랫폼5%→소개비(주인 몫)→매장 실수령" + "소비자 결제액에 추가되지 않아요"(:82-84), 확정 모델 그대로. 게이트만 열면 됨.
- **소비자 이용권→QR/PIN 흐름** (my-vouchers/VoucherTicket.tsx:13-20, QRModal, SellerVoucherScanPage, StoreScanPage) — 매장 방문 모델 선명.
- **쇼핑 탭 숨김** (SHOPPING_TAB_HIDDEN=true) — 유지 (C6 잔존 CTA만 정리).
- **에이전시 모델-중립 표면** (매장 목록/기본 관리 등 ~7%).
