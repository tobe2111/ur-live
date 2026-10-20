# 💸 머니 게이트(그림자) 전수 — 2026-08-25 실측

> 대표 질문 *"또 그림자? 오래된 것들이 있어?"* 에 대한 답. **실측이지 추정이 아니다** —
> 라이브 워커(`ur-live`) 바인딩과 `platform_settings` 를 직접 조회했다.

## 왜 이 문서가 필요한가

이 레포는 머니 경로를 바꿀 때 **2단 스위치**(그림자 → staging 검증 → 활성)를 쓴다. 안전한 설계다.
문제는 **2단계로 넘어가는 조건이 "staging 실결제"인데 실결제가 없다는 것**이다. 그래서 그림자가
쌓이기만 하고 아무도 그 총량을 안 본다. 이 표가 그 총량이다.

## 전수 (2026-08-25 라이브 기준 — 전부 OFF)

| 게이트 | 무엇을 켜나 | 도입 | 나이 | 저장소 |
|---|---|---|---|---|
| `FEE_RESOLVER_ENABLED` | 채널별 요율 계산을 `order_fee_breakdown` 에 **기록만** | 06-27 | **2개월** | env |
| `fee_channel_rates_enabled` 🆕 | 채널별 요율을 **실제 정산에 적용**(직접10%/중개5%) | 08-25 | 신규 | platform_settings |
| `SHOPPING_LEDGER_ENABLED` | 일반 쇼핑 매출 원장 적립 | 07-01 | 8주 | env |
| `commission_budget_enabled` | 커미션 예산 캡(주문당 배분) | 07-04 | 7주 | platform_settings |
| `promo_funding_source=owner` | 커미션 재원 → 매장 promo(5% 밖) | 07-04 | 7주 | platform_settings |
| `DISTRICT_AUTO_ISSUE_ENABLED` | 상권 쿠폰 온라인 자동발급 | 07-13 | 6주 | env |
| `MATCHING_SETTLEMENT_ENABLED` | 매칭 정산 | — | — | env |

## 🩸 이번에 드러난 것 — 그림자가 **오래되면 문서와 갈린다**

`fee-resolver` 는 **직접 10% / 중개 5%**(대표 최종 2026-08-20)를 구현하고 있었는데,
설계 SSOT(`commission-funding-restructure.md`)는 **7월 8일자 "유어딜 5%"** 를 그대로 말하고 있었다.
2026-08-25 세션이 **하루 종일 5% 를 전제로 작업**하다가 대표가 *"직접 10%, 중개 5% 맞지?"* 라고
물어서야 알았다.

⇒ **그림자는 코드에만 있고 문서는 옛 결정을 말한다.** 그게 이 클래스의 진짜 비용이다 —
   버그가 아니라 **다음 사람이 틀린 전제로 일하게 만드는 것.**

## 게이트를 켜는 권장 순서

1. **`fee_channel_rates_enabled`** — 요율이 먼저다. 이게 틀리면 아래 배분의 분모가 틀린다.
2. `commission_budget_enabled` — 예산 캡(5% 잠식 방지)
3. `SHOPPING_LEDGER_ENABLED` — 쇼핑 매출 적립
4. `promo_funding_source=owner` — 재원 전환. **가장 마지막.** 이걸 켜면 커미션 부담이 매장으로
   가므로, 위 셋이 검증된 뒤에만.

⚠️ **각 단계마다 staging 실결제 1건씩.** 한꺼번에 켜면 어느 게 틀렸는지 못 가른다.

## 판정 쿼리 (staging 실결제 후 이걸 보면 된다)

```sql
-- 플랫폼 순수취가 채널별 요율과 맞는가
SELECT reference_id, amount, fee_amount, debit_account, credit_account, metadata
  FROM ledger_entries WHERE reference_id LIKE 'voucher:%' ORDER BY id DESC LIMIT 20;
```

- 직접 입점 매장 주문: `platform:revenue` 몫이 결제액의 **10%**
- 중개 매장 주문: **5%**
- 성장 커미션(agency/intro)의 debit 이 `platform:revenue` 가 **아니어야** 함(flip ON 시) — [INV-#44]

## ⚠️ 알려진 비대칭 — 요율 승격이 **이용권에만** 걸려 있다 (2026-08-25 실측)

`fee_channel_rates_enabled` 를 켜면 **이용권 원장**(`recordVoucherUsedLedger`)은 채널 요율
(직접 10% / 중개 5%)로 계산한다. 그런데 **일반 쇼핑 원장**(`order-ledger-credit.ts`)은 여전히
`orders.commission_rate ?? COMMISSION_DEFAULTS.PLATFORM_FEE_PCT`(=5) 를 쓴다 —
`store_channel` 을 **한 번도 읽지 않는다**(실측: 참조 0건).

⇒ 게이트를 켜면 **같은 직접 입점 매장이 이용권은 10%, 쇼핑은 5%** 로 갈린다.

**지금 라이브 영향은 0이다**: 쇼핑 탭이 숨김(`SHOPPING_TAB_HIDDEN`)이고 `SHOPPING_LEDGER_ENABLED`
도 OFF라 그 경로가 원장을 아예 안 건드린다. 그래서 **급하지 않지만, 쇼핑을 재오픈하기 전에는
반드시 맞춰야 한다** — 안 맞추면 재오픈 시점에 조용히 절반 요율로 정산된다.

**왜 이번에 같이 안 고쳤나**: 머니 경로 변경이라 룰상 *단독 세션 + staging 실결제*가 붙는다
(CLAUDE.md §서비스 분리 4항). 이용권 승격과 한 PR 에 묶으면 staging 에서 **어느 쪽이 틀렸는지
가릴 수 없다.** 순서를 지키는 편이 낫다.

**대표 판단 대기**: 쇼핑 재오픈 일정이 잡히면 그 전에 이 배선을 별도 PR 로.
