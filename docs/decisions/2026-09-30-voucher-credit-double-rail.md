# 이용권 매출을 매장에 **구매 시점**에 적립하는 지금 방식을 **사용 시점**으로 옮길까?

상태: open
등급: C
역할: finance
올린 날: 2026-09-30
기한: 2026-10-07

## 질문

같은 이용권 한 장에 매장 적립이 **두 번** 일어난다(구매 시 `seller:N`, 사용 시 `merchant:N`).
지급 집계는 **두 계정을 모두** 더한다 — 1,000원 판매가 **1,850원**으로 집계된다(실측).
사용 시점 하나로 합칠까? (기본안 = 1번)

⚠️ **코드는 아직 안 고쳤다.** 이건 "적립 계정 한 줄"이 아니라 **매장이 언제 돈을 받는가**를
바꾸는 일이고, 손대야 하는 자리가 5곳이다(§근거 ⑥). 지금까지 잘못 나간 돈은 **0원**이라
서둘 이유가 없다 — 대표가 방향을 고르면 단독 세션 + staging 실결제로 진행한다.

## 근거 (실측)

### ① 적립이 두 번 일어난다

| 시점 | 파일 | credit 계정 | 금액 |
|---|---|---|---|
| **구매** | `group-buy.routes.ts:505`(딜) · `:1354`(카드) · `cart-checkout.routes.ts:276`(장바구니) | `sellerLedgerAccount(seller_id)` = **`seller:14`** | `총액 − 수수료` |
| **사용** | `ledger.ts:139` `recordVoucherUsedLedger` | **`merchant:14`** | `총액 − 플랫폼 − 셀러` |

위탁(`consigned_from_seller_id`)이 없는 보통의 경우 **두 계정의 숫자가 같은 매장**이다.
`payouts-generate.ts:56` 의 집계는 `merchant:%` 와 `seller:%` 를 **둘 다** 더하고,
`:93` 에서 `merchant → store_owner` 로 이름만 바꿔 **payout 행을 두 개** 만든다.

`node:sqlite` 로 실제 집계 SQL 을 돌려 확인(1,000원 판매 1건):

```
merchant:14 → 900
seller:14   → 950
가게 14 에 지급될 합계: 1,850 원  (판매액 1,000 → 185%)
```

### ② 무엇도 구매 적립을 되돌리지 않는다

- `recordVoucherUsedLedger` 는 `platform:escrow` 를 차감할 뿐 `seller:N` 을 건드리지 않는다
- `recordRefundLedger`(ledger.ts:448)는 `platform:revenue → platform:escrow` 만 움직인다
- `clawbackVoucherCommission`(voucher-clawback.ts)에는 원장 기록이 **없다**(인플루언서 attribution 전용)

⇒ 만료 환불로 소비자에게 돈을 돌려줘도 **매장 적립은 그대로 남는다**(= 미사용·환불 이용권까지 지급).

### ③ 두 레일이 같은 매출에 다른 수수료를 적용한다

- 구매: `commissionRate`(셀러별 `commission_rate` 또는 `commission_rate_meal_voucher`)
- 사용: `channelPlatformRate`(2026-08-25 채널 요율 — 직접 10% / 중개 5%)

2026-08-25 주석이 `recordVoucherUsedLedger` 를 *"실제 정산인 이 함수"* 라고 부르며
채널 요율을 **그쪽에만** 올렸다.

### ④ 다른 정산 레일은 이미 사용 시점 모델이다

`cron/auto-settlement.ts:179` 는 `WHERE v.status = 'used'` — **사용된 이용권만** 정산한다.
`settlement_skip_ledgered=true`(현재 ON)로 그 레일이 원장 레일에 자리를 비켜 준 상태이므로,
원장 레일이 구매 시점에 지급하는 것은 **양보받은 쪽이 규칙을 바꿔 버린** 셈이다.

그리고 대표가 이미 켠 `payout_requires_voucher_use`(= 정산은 사용 확인 뒤에)와도 같은 원칙이다.

### ⑤ 지금까지 잘못 나간 돈은 0원

| | 값 |
|---|---|
| `voucher_used` 원장 행 | **0** — 아무도 이용권을 사용한 적이 없다 ⇒ ①이 아직 발화하지 않았다 |
| `group_buy_join` 원장 행 | 2건 — `seller:14` 950 · `seller:null` 1,710 |
| payouts 행 | **0** (한 번도 생성된 적 없다) |
| 계좌 등록 매장 | 9곳 중 **0곳** |

⚠️ 다만 ②는 **이미 살아 있다**: `seller:14` 의 950원은 **한 번도 사용되지 않은** 이용권
(id=2 `UR-LUBA-RCP5`, 무기한)에 대한 적립이고, 최소출금액(10,000원)을 넘는 순간 나간다.

### ⑥ 🔴 한 매장에 계정 이름이 **둘**이고, 지급 집계는 그 둘을 **따로 묶는다**

이게 이번 조사에서 제일 중요한 발견이고, "적립 계정 한 줄만 바꾸면 된다"를 무너뜨린다.

`payouts-generate` 는 계정 **문자열**로 GROUP BY 한다. `seller:14` 와 `merchant:14` 는 같은
가게인데 **서로 차감되지 않는다.** 그래서 `seller:N` 에 걸린 차감들이 `merchant:N` 의 적립에서
빠지지 않는다:

| 차감 | 자리 |
|---|---|
| 인플루언서 커미션 | `group-buy.routes.ts:574` `debit_account: sellerLedgerAccount(seller_id)` |
| 친구 추천 보너스 | `group-buy.routes.ts:547` (인플 활성 시 매장 부담) |
| 중개사 몫 | `broker-share.ts:155` `debit_account: sellerLedgerAccount(p.sellerId)` |
| 부분 환불 | `group-buy-voucher.routes.ts:683` `debit_account: seller:${seller_id}` |

⇒ 구매 적립만 escrow 로 옮기면 `seller:14` 에는 **차감만 남아 음수**가 되고, 음수는 최소출금액
미달로 스킵돼 **영원히 정산되지 않는다**. 즉 매장이 부담해야 할 인플루언서 커미션·중개사 몫을
**아무도 안 내게 된다**(플랫폼 손실). 옵션 1은 반드시 **계정 이름 통일**까지 함께 가야 한다.

## 선택지

1. **사용 시점으로 단일화 + 매장 계정 이름을 하나로 통일**
   - 구매 적립 → `platform:escrow`(수수료도 그때 안 뗀다 — 사용 시점 3번째 분개가 인식한다).
     매장이 없는 플랫폼 상품(`seller_id` NULL, 교환권·KT)은 **종전 `platform:revenue` 유지** —
     그 경로는 사용 시점 적립이 아예 없어서(`merchantId` 0 → 스킵) escrow 에 담으면 영원히 안 빠진다.
   - `merchant:N` ↔ `seller:N` 을 한 이름으로 수렴(⑥). `payouts-generate` 의 `merchant → store_owner`
     매핑도 함께 정리.
   - 장점: `recordVoucherUsedLedger` 주석이 처음부터 말한 설계(`escrow → merchant_payable`) ·
     레일 A(④)와 일치 · 대표가 켠 사용 확인 게이트와 일치 · ②의 환불 역전이 **필요 없어진다**
     (적립 자체가 없다) · ⑥의 차감이 제자리를 찾는다
   - 단점: **매장은 손님이 실제로 쓴 뒤에 받는다**(판매 시점엔 못 받는다). 무기한 이용권은
     손님이 언제든 쓸 수 있으므로 그때까지 escrow 에 남는다. 손대는 자리 5곳 + 집계 1곳.
   - 머니 접촉: **있음** — 단독 세션 + staging 실결제

2. **구매 시점으로 단일화** — `recordVoucherUsedLedger` 의 `merchant:N` 적립을 지운다
   - 장점: 매장이 빨리 받는다 · 변경 지점 1곳 · ⑥을 건드릴 필요가 없다(차감이 이미 `seller:N`)
   - 단점: 미사용·환불된 이용권까지 매장에 지급된다(②가 영구 결함으로 굳는다) ·
     채널 요율(③)이 적용되는 쪽을 버린다 · 사용 확인 게이트가 무의미해진다 · 레일 A(④)와 어긋난다
   - 머니 접촉: 있음

3. **아무것도 안 한다**
   - 단점: 첫 실사용이 곧 이중지급이다. 지금은 손실 0 이지만 그 순간부터 회수 문제가 된다.

## 기본안 (답이 없을 때 권하는 것 — 자동 실행되지 않는다)

**1번.** 코드의 설계 의도·다른 정산 레일·대표가 이미 켠 게이트 **셋이 모두 사용 시점**을 가리킨다.
2번은 "매장이 빨리 받는다"는 장점 하나를 위해 미사용·환불 지급을 영구화한다.

단, 1번은 이 세션에서 손대지 않았다 — ⑥ 때문에 범위가 "한 줄"이 아니고, 매장의 정산 시점을
바꾸는 결정은 대표가 먼저 봐야 한다.

## 롤백

각 항목 독립. 구매 적립은 `credit_account: sellerLedgerAccount(...)` + `fee_amount: commissionAmount`
환원, 계정 통일은 `merchant:` 접두어 복원. 그때 새 가드가 빨간불이 되므로 함께 판단할 것.

## 결정 (대표가 한 말 그대로)

## 반영 커밋
