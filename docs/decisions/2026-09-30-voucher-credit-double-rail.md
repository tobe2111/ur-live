# 이용권 매출을 매장에 **구매 시점**에 적립하는 지금 방식을 **사용 시점**으로 옮길까?

상태: approved
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

**2026-10-01 대표 — "최대한 이상적으로 다 해줘."**

⇒ **안 1 채택**(사용 시점 단일화 + 매장 계정 접기). 같은 날 구현했다.

### 🔀 안 1 의 "계정 이름 통일" 을 **리네임이 아니라 접기**로 바꿨다

§⑥ 은 `merchant:N` ↔ `seller:N` 을 "한 이름으로 수렴" 하라고 했다. 착수해서 실측하니
**그 이름을 읽는 곳이 §⑥ 이 센 5곳보다 많았다**:

| 읽는 곳 | 무엇을 읽나 | 리네임하면 |
|---|---|---|
| `seller-analytics.routes.ts:442` | `credit_account = 'merchant:N' AND event_type='voucher_used'` | 셀러 대시보드 **'매출' 카드가 0원**이 된다 |
| `weekly-metrics-summary.ts:64` | `payouts.payee_type = 'store_owner'` | 정산 **이중레일 경보가 조용히 0을 센다** |
| `owner-promo.ts:47` · `ledger.ts:441` | `ownerAccount: merchant:{id}`(promo 재원) | 재원 계정이 가리키는 대상이 바뀐다 |
| `payout-use-gate.ts:12` | *"매장 몫(`merchant:N`)은 사용 시점에만 붙는다"* 는 **의미** | 그 게이트의 전제가 사라진다 |

넷 다 **에러 없이** 틀린 값을 내기 시작한다(이 레포가 반복해 당한 조용한 부재).

⇒ **이름은 그대로 두고 지급 집계에서만 한 payee 로 접었다.** `merchant:` 는 *사용 시점의 매장 몫*
이라는 뜻을 유지하고, 지급은 "같은 가게에 두 번 보내지 않는다" 만 지킨다. §⑥ 이 요구한 효과
(*"차감이 제자리를 찾는다"*)는 그대로 달성되고, 읽는 곳 네 군데는 **한 글자도 안 건드렸다.**

### 구현 (SSOT = `src/worker/utils/payout-account.ts`)

| 무엇 | 어디 |
|---|---|
| 구매 적립 → `platform:escrow`(매장 상품) / `platform:revenue`(플랫폼 상품) | `purchaseCreditAccount()` · 구매 3자리(딜·카드·장바구니) |
| 구매 시점 수수료 **미인식**(escrow 는 총액) | `carriesFee` — 사용 시점 3번째 분개가 인식한다 |
| `merchant:N` ↔ `seller:N` 접기 | `canonicalPayee()` + `canonicalPayeeSql()` |
| 이미 생성된 payout 도 같은 키로 | `canonicalPaidPayee()` + `canonicalPaidPayeeSql()` |
| `payee_type` 을 **셀러 역할**에서 | `payoutPayeeType()` — 접두어가 아니다 |
| 집계 문장 자체를 SSOT 로 | `payoutCreditsSql()` · `payoutPaidSql()` — cron 이 위임 |

**곁가지로 같이 고친 것 둘** (같은 함수를 지나가므로 분리가 더 위험하다):
1. 🔴 **어드민 '정산 생성' 버튼이 cron 과 다른 공식을 쓰고 있었다** — credit 만 더하고 `fee_amount`도
   `debit`(환불 역전·커미션 차감)도 빼지 않아 **과다지급**이 된다. 표시용 집계는 2026-07-01 에 net 으로
   고쳐졌는데 이 버튼만 남아 있었다(그 코드의 주석이 걱정한 *"화면과 생성분이 갈리면 없는 돈을
   승인한다"* 가 실제로 성립해 있었다). 같은 net 공식으로 맞췄다.
2. `seller:null` 오염을 **근원에서** 막는다 — 플랫폼 상품의 구매 적립이 더는 그 이름을 만들지 않는다
   (`payouts-generate` 의 id 숫자 검사는 두 번째 방어선으로 유지).

### 가드 — 문자열이 아니라 **실제 sqlite 로 금액을 센다**

`src/tests/unit/voucher-credit-single-rail-2026-10-01.test.ts` 18건. `node:sqlite` 에 표 둘을 만들고
**cron 이 실제로 쓰는 문장**을 돌려 행 수와 금액으로 판정한다:
`매장 지급 900`(종전 구조 재현 시 1,850 — 되돌려-검증이 그걸 고정) · `payee 행 1개` ·
`차감 접힘 800` · `기존 payout 차감 600` · 플랫폼 상품 미노출 · `seller:null` 미노출.
주입 **9건 전부 빨간불 확인**(`scripts/mutations/voucher-credit-single-rail.mjs`).

🩸 **주입 러너가 내 가드 하나를 "지키는 척" 이라고 잡았다**: `payee_type` 시험을 *"접두어 삼항이
없는가"* 라는 **모양**으로 썼더니, 다른 모양의 하드코딩(`kind === 'seller' ? 'store_owner' : …`)을
주입해도 초록이었다 ⇒ 판정을 순수 함수(`payoutPayeeType`)로 빼고 **동작**을 재도록 교체했다.
그리고 내 픽스처가 아니라 **내 단언**이 틀린 것도 하나 있었다 — 집계 SQL 은 `debit_account LIKE 'user:%'`
때문에 **구매자 지갑도 음수로 등장한다**(라이브도 그렇고 cron 은 최소출금액에서 건너뛴다).
"받을 사람" 을 말할 때는 **양수만** 봐야 한다.

### ⚠️ 라이브 영향 — 지금은 0, 그러나 지금이 유일하게 싼 창이다 (실측 2026-10-01)

```
payouts 0건 · restaurant_settlements 0건 · vouchers used 0건
ledger_entries 3행:  group_buy_join seller:null 1800(fee 90) · supplier_wholesale supplier:3 10000 · group_buy_join seller:14 1000(fee 50)
```
⇒ **지급이 한 번도 일어난 적이 없다.** 이 변경으로 **소급되는 돈은 없다.**

🔴 단 **이미 적힌 `seller:14` 1,000원(순 950)은 남는다** — 그건 한 번도 안 쓴 무기한 이용권
(id=2 `UR-LUBA-RCP5`)의 구매 적립이고, 최소출금액 10,000원을 넘는 순간 나간다. 지금 잔액이
그보다 작아 당장 나가지는 않지만, **다음 판매가 쌓이면 넘는다.** 그 한 행은 코드가 아니라
어드민에서 상계해야 한다(세션은 프로덕션 D1 을 쓰지 않는다 — CLAUDE.md).
⇒ **대표 액션 1건**: 이용권 id=2 가 사용되기 전에 그 950원을 지급 대상에서 뺄지 결정.
   (쓰면 사용 시점 적립이 또 붙어 그 한 장은 여전히 두 번 적립된 상태가 된다.)

### E4 판정 (첫 이용권 사용 뒤 — 다음 세션이 이걸 확인한다)

```sql
-- 한 가게에 payee 행이 하나인가
SELECT payee_type, payee_id, amount FROM payouts ORDER BY id;
-- 구매 적립이 escrow 로 갔는가(매장 계정이 아니라)
SELECT credit_account, amount, fee_amount FROM ledger_entries WHERE event_type='group_buy_join' ORDER BY id DESC LIMIT 3;
-- 사용 시점 세 분개가 escrow 를 비웠는가
SELECT credit_account, amount FROM ledger_entries WHERE event_type='voucher_used' ORDER BY id;
```
기대: `group_buy_join` 의 credit 이 `platform:escrow`(매장 상품) · `voucher_used` 가
`merchant:N`/`platform:revenue` · payouts 에 그 가게 행이 **하나**.

## 반영 커밋

- 2026-10-01 신규 SSOT `payout-account.ts` + 구매 3자리 + `payouts-generate` + 어드민 집계 2곳
  + 가드 18건 + 주입 9건(전부 빨간불 확인)
