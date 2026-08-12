# 🚦 기능 현황판 (자동 생성)

> ⚠️ **이 파일을 손으로 고치지 마라.** `src/shared/feature-flags.ts` 에서 생성된다.
> 갱신: `node scripts/generate-feature-status.mjs` (pre-commit 이 자동 재생성 + stage)

## 왜 이 표가 있나

이 레포에는 **종료됐는데 코드가 그대로 남아 있는 기능**이 여럿이다. 라우트도 페이지도 API 도
살아 있고, 꺼진 사실은 플래그 한 줄로만 표현된다. ⇒ **파일을 열어보는 것으로는 판단할 수 없다.**

2026-08-03 에 실제로 그 함정에 빠졌다 — 이미 종료된 **딜 충전**을 대표에게 실결제 절차로 제안했다.
코드가 온전했기 때문이다.

🔑 **소비자 경로·구매 절차·테스트 시나리오를 제안하기 전에 이 표를 먼저 볼 것.**

## 🔴 꺼진 기능 — 코드는 있지만 사용자에게 없다 (10)

| 플래그 | 상태 | 값 | 설명 |
|---|---|---|---|
| `LIVE_COMMERCE_SUSPENDED` | 🔴 꺼짐 | `true` | 라이브커머스 **영구 중단** (2026-06-04 잠정 → 2026-06-17 사용자 확정 "안하기로 했어"). |
| `SHOPPING_TAB_HIDDEN` | 🔴 꺼짐 | `true` | 쇼핑 탭 잠정 숨김 (2026-06-10 사용자 결정, 동네딜 집중 전략). |
| `REFERRAL_GROUP_DISCOUNT_DISABLED` | 🔴 꺼짐 | `true` | 친구초대 '동적 가격 할인'(referral_groups 티어) 종료 (2026-06-17 사용자 결정 — 즉시판매 단일가로 통일). |
| `HOSTING_HIDDEN` | 🔴 꺼짐 | `true` | '공구 호스팅' 카탈로그(/host, /host/new) 진입 숨김 (2026-06-17 사용자 결정). |
| `COMMUNITY_PROPOSAL_HIDDEN` | 🔴 꺼짐 | `true` | '동네 공구 제안'(community-group-buy) 진입 숨김 (2026-06-18 사용자 결정). |
| `SELLER_PROMO_FIELD_ENABLED` | 🔴 꺼짐 | `false` | 셀러 딜 등록 화면의 '소개비(promo)%' 입력 + 마진 계산기 노출 (2026-07-05 인플루언서 이용권 공구 엔진 스프린트 §1). |
| `GB_ENGINE_ENABLED` | 🔴 꺼짐 | `false` | 공구 상태 엔진(상태형·양방향) 표면 노출 (2026-07-06 공구 엔진 완결 스펙). |
| `TOPUP_DISABLED` | 🔴 꺼짐 | `true` | '딜 충전'(현금→딜 유상 충전) **서비스 전체 종료** (2026-07-18 대표 확정 "딜 포인트 충전 자체를 빼자 우리 서비스에서" — 앱 전환 시 Apple IAP 30% 이슈 원천 제거). |
| `ADS_AI_HIDDEN` | 🔴 꺼짐 | `true` | 유어애즈 **AI 기능 노출 숨김** (2026-07-28 대표 결정 "AI 기능 안 쓸 거야"). |
| `CONSUMER_LANGUAGE_SWITCH_HIDDEN` | 🔴 꺼짐 | `true` | 소비자 **언어 전환 UI 숨김** (2026-08-11 대표 "모두 진행해"). |

## 🟢 켜진 기능 (7)

| 플래그 | 상태 | 값 | 설명 |
|---|---|---|---|
| `IOS_HIDE_DIGITAL_TOPUP` | 🟢 켜짐 | `false` | iOS 네이티브 앱에서 '딜 충전'(순수 디지털 포인트)을 숨기고 외부 브라우저로 유도 (Apple 인앱결제(IAP) 정책 대비). |
| `SELLER_STORE_ONLY_MODE` | 🟢 켜짐 | `true` | 셀러 대시보드 = 순수 '매장 운영 콘솔' (2026-07-19 대표 확정 "온라인 판매·소싱은 필요없다 — 이용권 파는 매장 업주만을 위한 형태로. |
| `MATCHING_ENABLED` | 🟢 켜짐 | `true` | 인플루언서↔업체 성과기반 매칭 **어드민 전용 내부 도구** 노출 (2026-07-14). |
| `REGION_PAGES_ENABLED` | 🟢 켜짐 | `true` | 도시별 색인 페이지 `/region/*` 노출 (2026-08-03 대표 지시 — "도시별로도 보이게" + "이전으로 돌아갈 수도 있게끔 해두자"). |
| `REGION_COUNT_INCLUDE_DEMO` | 🟢 켜짐 | `true` | 지역 집계에 **데모 딜 포함** (2026-08-03 대표 결정 "포함시키자"). |
| `HOME_SHOWCASE_ENABLED` | 🟢 켜짐 | `true` | 홈 쇼케이스(④히어로 · ①카테고리 섹션 · ③중간 배너) 노출 (2026-08-04 대표 시안 승인 "좋다 이렇게 가자" — 여기어때 메인 참고, 쓸만한 것만 차용). |
| `CAMPAIGN_SIGNUP_ENABLED` | 🟢 켜짐 | `true` | 캠페인 인플루언서 모집 신청 페이지(/campaign/:code) 노출 (2026-08-09). |

## ⚠️ 이 표가 담지 못하는 것

- **서버측 게이트**(`platform_settings` · env)는 여기 없다. 예: `SHOPPING_LEDGER_ENABLED`,
  `commission_budget_enabled`, `pickup_unclaimed_policy_enabled`. 그건 어드민에서 실측할 것.
- **플래그 없이 데이터로만 꺼진 것**도 없다. 예: 공구 특가는 "세션이 열린 상품이 있는가"로 정해지고,
  추첨 상품은 `product_supply_meta.fcfs_enabled` 로 정해진다.
- ⇒ 여기서 🟢 라고 해서 **그 경로가 실제로 완주된다는 보장은 아니다.** 표면 노출만 말한다.
