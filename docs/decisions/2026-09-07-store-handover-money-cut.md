# 매장 손바뀜 때 과거 미지급 잔액을 새 주인에게 줄 것인가?

상태: open
등급: C
역할: finance
올린 날: 2026-09-07
기한: 2026-09-14

## 질문

매장 소유자가 바뀔 때, **그 이전에 발생한 미지급 정산금**을 (1) 새 주인에게 그대로 넘길지,
(2) 승계 시점으로 끊어 이전 주인에게 정산하고 새 주인은 **그 시점부터** 계산할지.

> 대표: *"매장 가져오는 것에선 돈까지 귀속이 되면 안되지, 귀속되는 시점부터 계산해서 성과 수익이
> 계산되어야 하지 않을까?"*

## 근거 (실측)

### 지금은 (2)가 아니다 — 전액이 새 주인에게 간다

돈의 귀속 키가 **사람이 아니라 매장 행**이고, 집계에 **기간이 없다**.

| 사실 | 근거 |
|---|---|
| 원장 계정은 `seller:N` 문자열뿐 — 사람 컬럼이 없다 | `worker/utils/ledger.ts:42-55` (라이브 스키마 실측으로도 확인: 컬럼 10개에 `seller_id`/`user_id` 없음) |
| payout 집계에 `created_at` 필터가 **없다**(전기간 누적) | `worker/cron/payouts-generate.ts:44-55` |
| 그게 의도된 변경이다 | 같은 파일 `:35-39` — 2026-06-26 "지난주만 → 전기간 누적"(누락 주가 영영 재포착 안 되던 문제 수리) |
| `getLedgerReceivable` 도 무기간 | `worker/utils/ledger.ts:428-434` |
| 송금 목적지는 `sellers.bank_account` | `payouts-generate.ts:85` |
| `payouts` 의 `period_start/end` 는 **라벨·멱등 키일 뿐** 집계 범위가 아니다 | `payouts-generate.ts:29-30` |

⇒ `sellers.linked_user_id` 를 새 사람으로 바꾸고 그 사람이 `bank_account` 를 자기 계좌로 바꾸면,
**그 매장이 창업 이래 쌓은 미지급 잔액 전액이 다음 주 cron 에서 통째로 새 계좌로 나간다.**
승계 시점을 적는 컬럼도, 그 시점으로 원장을 자르는 코드도, 승계 시 잔액을 정산·동결하는 절차도 없다.

### 다만 지금 당장 사고가 난 상태는 아니다 (라이브 실측 2026-09-07)

```
매장(sellers)            1곳          seller_operators        1행
운영자 2명 이상인 매장     0곳          ledger_entries          2건
introduced_by 붙은 매장   0곳
```
**아직 손바뀜이 한 번도 일어나지 않았다.** 그래서 지금은 **마이그레이션 없이 규칙을 정할 수 있는 시점**이다.

### 필요한 시점 값은 이미 기록되고 있다

`seller_operators` 에 **`granted_at` · `revoked_at` · `role`** 이 있다(라이브 DDL 실측).
쓰이는 곳은 **화면 표시 1곳뿐** — `seller-operators.routes.ts:249-289` 의 `orders_since_grant`·
`revenue_since_grant`. 돈 경로(`payouts-generate`)는 `seller_operators` 를 **한 번도 조회하지 않는다**.
⇒ 대표가 말한 "귀속 시점"은 **이미 데이터로 있고, 정산이 그걸 안 볼 뿐이다.**

### 축마다 처리가 이미 다르다 (일관성이 없다)

| 축 | 시점 처리 | 근거 |
|---|---|---|
| 주문 판매자 | ✅ 주문 시점 고정 — `UPDATE orders SET seller_id` 가 레포에 **0건** | `OrderRepository.ts:114-128` |
| 소개 커미션(결제 레일) | ✅ `order_id` 별 1행 + **1년 만료** 실재 | `influencer-store-intro-commission.ts:231`, `isStoreIntroExpired :58-76` |
| 공급자 정산 | ✅ `order_id` 별 고정 | `supply-settlement.ts:79-82` |
| 소개 커미션(**이용권 사용** 레일) | ❌ **소급된다** — 사용 순간의 `introduced_by_influencer_id` 를 읽는다 | `ledger.ts:317-319` |
| 매장 정산금 | ❌ **무기간 전액** | 위 표 |

## 함께 발견한 것 (이 결정과 별개로 처리 필요)

1. 🕳️ **`credit_account = 'seller:null'` 원장 1건**(1,800원, 2026-05-24). `group-buy.routes.ts:513` 이
   `seller:${product.seller_id}` 를 **null 가드 없이** 쓴다 — 플랫폼 상품(`seller_id` NULL)이면 이렇게 된다.
   같은 클래스의 `auto-settlement.ts:351` 은 `&& voucher.seller_id` 가드가 있다(비대칭).
2. 🕳️ **정산 조회에 owner 게이트가 없다** — `seller-settlements.routes.ts:317` 은 `payload.seller_id` 만
   보고 전기간 receivable + payout 이력 50건을 준다. 운영자로 추가된 사람이 **과거 전부를 열람**한다
   (수취는 못 한다 — 목적지가 `sellers.bank_account` 라서).
3. 영입자 재배정이 `introduced_at = datetime('now')` 로 **시계를 되감는다** (`reassign-introducer.ts:131`).
   `referral_bonus_until` 은 안 건드려 두 컬럼이 갈린다.

## 선택지

1. **승계 시점으로 자른다 (대표 제안)** — 승계 시각을 기록하고, 그 이전 잔액은 **이전 주인에게 정산 후
   0 으로 마감**, 새 주인은 그 시점부터 적립. 장점: 사실과 맞고 분쟁이 없다. 단점: 마감 절차(정산·동결·
   승인)를 새로 만들어야 하고 **머니 경로**다. 머니 접촉: **있음**.
2. **그대로 넘긴다(현행)** — 장점: 코드 0. 단점: 이전 주인이 판 매출이 새 주인 계좌로 나간다.
   매장 하나만 손바뀜해도 **되돌릴 수 없는 오지급**이 된다. 머니 접촉: 있음(현행 유지).
3. **승계 자체를 안 만든다** — 손바뀜이 필요하면 **새 매장으로 등록**하고 옛 매장은 닫는다.
   장점: 돈이 원리적으로 안 섞이고 코드가 가장 작다. 단점: 리뷰·단골·이용권 이력이 끊긴다.
   머니 접촉: 없음.

## 기본안 (답이 없을 때 권하는 것 — 자동 실행되지 않는다)

**안 1**, 단 **지금은 "잠금"만 먼저**. 승계 기능이 아직 없으므로(`owner_verified` 레포 전체 0건)
지금 필요한 것은 승계 구현이 아니라 **승계가 생길 때 돈이 새지 않도록 막는 가드**다:
`sellers.linked_user_id` 가 바뀌는 경로에서 미지급 잔액이 0 이 아니면 차단하거나 경고.
그러면 나중에 누가 승계를 만들 때 이 결정을 **반드시 마주치게** 된다.

## 롤백

가드는 조건 1개 제거로 원복. 승계 구현 자체는 착수 전이라 롤백 대상 없음.

## 결정 (대표가 한 말 그대로)

> *"매장 가져오는 것에선 돈까지 귀속이 되면 안되지, 귀속되는 시점부터 계산해서 성과 수익이
> 계산되어야 하지 않을까? 확인해볼래?"* (2026-09-07)
>
> 이어서 기본안(잠금 먼저 + 함께 발견한 것 3건 수리)에 **"모두 다 순서대로 해줘"**.

### ⭐ 2026-09-08 — **선택지 1 확정**

> *"아니 만약 중개사가 한 매장으로 유어딜에서 번 돈이 있으면 그 돈은 승계가 되더라도 일단
> 중개사에게 정산되어야지. 반대 상황도 마찬가지고."*

**⇒ 답은 "손바뀜을 막는다" 가 아니라 "마감하고 나서 넘긴다" 다.** 자물쇠는 그 순서를 강제하는
장치이지 종착점이 아니었다 — 마감 창구가 없으면 자물쇠는 **막다른 길**이다.

#### 대표가 말한 "중개사가 번 돈" 이 코드에서 무엇인가 (실측)

중개사에게 **유어딜이 주는 돈은 없다.** 확정 원칙 그대로다 — *"5%는 중개사일 때 유어딜의
수수료인거고, 중개사는 나머지 95%에서 매장이랑 거래를 하는거지"*(`ledger.ts:238`,
`seller-operators.routes.ts:230`). `broker:N` 같은 원장 계정 자체가 없다.

그래서 대표가 말한 그 돈은 **중개사가 그 매장 `sellers` 행의 주인일 때의 매장 정산금**이다:
중개사가 `/store/new` 로 매장을 대신 등록하면 `linked_user_id`·`bank_account` 가 중개사 것이고,
그 매장 정산금이 **중개사 계좌로** 들어온다. 나중에 사장님이 자기 매장을 가져가는 것이 승계이고,
**반대 상황**(사장님 → 중개사)도 정확히 같은 경로(`linked_user_id` 변경)다.
⇒ 대표가 말한 상황은 **자물쇠가 걸린 바로 그 경로**다. `seller_operators` 위임은 소유권도
정산 목적지도 안 바꾸므로 이 문제에 해당하지 않는다.

#### 구현 — 새 기계를 안 만들었다

`payouts` 행은 **생성 시점의 계좌를 자기 안에 스냅샷**한다(`payouts-generate` 가 이미 그렇게
`sellers.bank_account` 를 행에 박는다). 그래서 손바뀜 *전에* payout 행을 만들면 그 행은
**이전 주인 계좌**를 들고 있고, 주인이 바뀌어도 안 변한다. 그리고 주간 집계가
`pending/approved/sent` 를 빼므로 그 금액은 **새 주인 몫으로 다시 안 잡힌다.**
⇒ 전기간 누적 집계(2026-06-26 의 의도적 설계)를 **건드릴 필요가 없었다.**

- 창구: `POST /api/admin/payouts/handover-closeout` (finance 권한 + 2FA + 감사로그)
- **송금하지 않는다** — `pending` 행을 만들 뿐, 승인·송금은 종전 그대로 어드민이 한다.
- **최소출금액(10,000원)을 적용하지 않는다** — 마감엔 다음 주가 없다. 건너뛴 소액은
  그대로 새 주인에게 간다.
- 계좌가 없으면 마감하지 않는다(`NO_ACCOUNT`) · 음수 잔액도 막는다(`NEGATIVE_BALANCE`,
  `payouts.amount` 는 `CHECK > 0`).

#### 🩸 이 과정에서 자물쇠의 실제 결함을 찾았다

자물쇠가 `getLedgerReceivable`(**순수 원장**)을 보고 있었다. 원장은 마감을 해도 안 줄어들어서,
**마감을 마쳐도 손바뀜이 영원히 안 열렸다.** `getUnsettledBalance`(원장 − 배정분)로 교체 —
`payouts-generate` 와 같은 공식이다.

#### 아직 안 막은 것

마감 payout 을 손바뀜 **뒤에** `cancelled`/`failed` 로 되돌리면 잔액이 원장으로 되살아나
새 주인에게 간다(집계가 그 두 상태를 안 뺀다). 그 취소를 막는 장치는 아직 없다.

## 반영 커밋

| 무엇 | 어디 |
|---|---|
| 🔐 미지급 잔액이 남은 매장은 주인을 못 바꾼다 (fail-**closed**) | `worker/utils/store-handover-guard.ts` (신규) + 손바뀜 3경로 배선 |
| 🏷️ 판매자 없는 상품이 `seller:null` 로 적립되지 않는다 | `worker/utils/ledger.ts` `sellerLedgerAccount()` + `group-buy.routes.ts` raw 보간 4곳 |
| 🏷️ payout 이 숫자 아닌 계정 id 를 거른다 (두 번째 방어선) | `worker/cron/payouts-generate.ts` |
| 👥 운영자는 합류(`granted_at`) 이후 정산만 본다 | `worker/utils/settlement-scope.ts` (신규) + `seller-settlements/payouts.ts` (분리) |
| ⏳ 새 영입자를 붙이면 옛 만료일을 지운다 | `admin-sellers/reassign-introducer.ts` |
| ⏳ 이용권 사용 레일이 결제 레일과 같은 만료 규칙을 쓴다 | `worker/utils/ledger.ts` `recordIntroductionCommissionShare` |
| 🤝 **손바뀜 마감** — 이전 주인 계좌를 스냅샷해 배정 | `admin-payouts/handover-closeout.ts` (신규) + `ledger.ts` `getUnsettledBalance()` |

가드: `src/tests/unit/store-handover-money-2026-09-07.test.ts` 21건 + 주입 매니페스트 12건
(**전부 되돌려-검증 빨간불 확인**).

⚠️ **판정은 staging이다.** 위 전부 텍스트 가드로만 확인했다 — 실제 D1 동작·실제 송금은 안 봤다.
