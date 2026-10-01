# 2026-10-01 — 머니 게이트 판정 도구가 수수료를 0원으로 읽고 있었다

> 대표 지시: *"모두 진행해줘"* (앞선 보고에서 제시한 머니 게이트 검증 수순을 전부 진행).

## 1. 다음 세션의 첫 액션

배포 후 **같은 주문으로 판정이 바뀌었는지** 확인한다(이게 이번 수리의 E4 다):

```bash
# 어드민 토큰($TOK)·UA 는 CLAUDE.md "🔑 어드민 진단 접근" 절차
curl -sS "https://live.ur-team.com/api/admin/promo-ledger/order/GB-3-1789611467065" \
  -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" |
  python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(d['budget'])"
```
**판정**: `platform_fee_krw: 50` · `budget_krw: 22` 가 나와야 한다.
수리 전에는 **둘 다 0** 이었다. 0 이 그대로면 배포가 안 됐거나 수리가 되돌아간 것이다.

## 2. 무엇이 틀렸나

2026-09-15 에 *"게이트 판정은 주문번호 하나로 한다"* 며 만든 판정 패널
(`GET /api/admin/promo-ledger/order/:orderNumber`)에 **라이브 유일 주문**을 넣어 보니
`budget.platform_fee_krw: 0` 이었다. 원장에는 분명히 있었다:

```
ledger_entries id=3 · event_type='group_buy_join' · reference_id='GB-3-1789611467065'
  amount=1000 · debit='user:3' · credit='seller:14' · fee_amount=50 · fee_account='platform:commission'
```

쿼리가 이랬다 — **두 군데가 어긋나 있고, 각각만으로도 늘 0 이 된다.**

```sql
WHERE credit_account = 'platform:revenue' AND reference_id IN ('order:89')
```

| | 틀린 것 | 실제 |
|---|---|---|
| ① | `credit_account` 로 걸렀다 | 수수료는 **`fee_amount`** 에 붙고 목적지는 `fee_account` 가 말한다. 매장이 있는 주문의 크레딧은 `seller:N` 이다(`platform:revenue` 는 **매장 없는** 플랫폼 상품 — 교환권·KT — 일 때만) |
| ② | 참조 키를 `order:N` 만 물었다 | 쇼핑은 `order:N`(`order-ledger-credit.ts`), **공구·이용권은 주문번호 그대로**(`group-buy.routes.ts`·`cart-checkout.routes.ts`) ⇒ 지금 라이브 트래픽 **전부**를 놓쳤다 |

### 왜 치명적인가 — 통과가 아니라 **오판**이다

수수료가 0 이면 예산도 0 이고, S1 의 합격선(`Σ성장커미션 ≤ 예산`)이 **양쪽으로 틀린다**:
적립이 0 이면 `0 ≤ 0` 으로 늘 통과 · 적립이 1원만 있어도 **늘 초과**.
즉 아비터가 멀쩡히 일해도 *"게이트가 작동하지 않는다"* 고 읽게 된다.
**2026-09-07 결재 Q4-2 가 "아비터를 켠다"로 확정한 그 게이트라, 켜기 전에 이게 먼저였다.**

## 3. 고친 것

- 신규 SSOT `src/worker/utils/order-platform-fee.ts` — `orderLedgerRefs()`(두 참조 키 형태) +
  `platformFeeQuery()`(SQL·바인딩을 **함께** 돌려준다). 머리말에 실측과 근거를 박아 뒀다.
- 판정 패널이 그 SSOT 를 부른다(SQL 을 호출부에 베껴 쓰지 않는다 — 두 벌이 갈리면 시험이 의미를 잃는다).
- `platform_revenue` 참고 수치도 같은 참조 키 결함이 있어 함께 고쳤고, **`credit_krw: 0` 을
  "수취 0" 으로 읽지 말라**는 문장을 응답 `note` 에 넣었다(매장 주문은 그게 정상이다).
- `s4` 의 `readable: false` 문구에 **테이블 부재 가능성**을 담았다 — 라이브에
  `order_fee_breakdown` 이 **아직 없다**(게이트를 한 번도 안 켜 생성 자체가 안 됨). 스키마 사고가 아니다.

**이중 집계가 안 되는 근거**: `fee_account` 를 쓰는 경로는 레포 전체에 **네 곳**이고 전부 전진
기록이다. 환불 역전(`order_paid_refund` 등)은 `fee_amount`·`fee_account` 를 **안 쓴다**.
`platform:pg_fee` 는 타입 주석에만 있고 실제 사용 0(2026-10-01 실측).

## 4. 재발 방지 — 🩸 **그 쿼리를 보던 시험은 통과하고 있었다**

`promo-ledger-order-verdict.test.ts` 는 `SUM(fee_amount)` 가 **있는지**만 봤다. 있었다.
*어떤 행에* 더하는지는 안 봤다.

⇒ `promo-ledger-fee-real-rows-2026-10-01.test.ts` **13건** — 라이브 `sqlite_master` 에서 그대로
떠 온 DDL 로 실제 sqlite 를 만들고, 라이브와 **같은 행 모양**을 넣고, 라우트가 쓰는
**그 SQL 문자열 자체**를 돌려 금액을 센다. 이용권 레일 · 쇼핑 레일 · 장바구니 다중 셀러 ·
플랫폼 상품 · 환불 역전 혼재 · 다른 주문 격리 · **0 을 만들 수 있는가**(헛돌지 않는지).

주입 `scripts/mutations/promo-ledger-fee.mjs` **5건 전부 빨간불 확인**.
낡은 앵커(`SUM(fee_amount)`)는 **지우지 않고 재조준**했다 — 지키려던 것("요율로 다시 계산하지
않는다")은 그대로 살아 있고, *맞는지* 판정만 실제 행 시험으로 옮겼다.

🧭 **교훈: "쿼리가 있는가" 는 "쿼리가 맞는가" 를 전혀 말해 주지 않는다.**

## 5. 같은 클래스를 다른 게이트에서도 찾아봤다 — **없었다**

| 게이트 | 참조 키 | 판정 |
|---|---|---|
| S2 `promo_fee` | `order:{id}:promo` | ✅ `owner-promo.ts` 와 일치 |
| S3 `order_paid` | `order:N` | ✅ `order-ledger-credit.ts` 와 일치 |
| S5 `unclaimed_forfeit` | `voucher:{id}` | ✅ 교환권 키 |
| S6 · S8 | `order_id` 컬럼 | ✅ 참조 키 무관 |

## 6. 라이브 실측 (2026-10-01, 읽기 전용)

- `ledger_entries` **전수 3행**. 그중 소비자 주문은 **1건**(id=3, 위 주문 · 2026-09-21).
- 그 주문: `status=PAID` · `total_amount=1000` · **`deal_used=900`** ⇒ 딜 900 + 카드 100 **부분결제**다.
- 수수료 50 = **5%**(매장 14 홍대돈까스 `store_channel='brokered'`) — S7 의 ② 중개 5% 는 맞다.
- `platform_settings` 에 `pg_reserve_pct`·`commission_budget_enabled`·`promo_funding_source` **키 자체가 없다**
  (기본값 폴백: PG 준비금 2.75% · 게이트 OFF). 살아 있는 머니 게이트 키는 `fee_channel_rates_enabled='true'`.
- 그 주문의 교환권 1장: `status=unused` · **`expires_at=NULL`(무기한)** ⇒ S5 의 대상이 아니다.

## 7. 남은 것 — 🙋 **대표 손이 필요한 것과 그 이유**

> 결재 `2026-09-19-staging-gate-unperformable.md`: *"**실제 결제는 대표가 한다** — 세션이 대신 결제하지 않는다."*

| 항목 | 왜 세션이 못 하나 |
|---|---|
| **그 1건 환불** (S7 ⑤ fee 역전 대칭) | 프로덕션 머니 쓰기. 그리고 **환불하면 S1·S8 을 판정할 유일한 재료가 사라진다** ⇒ 아래 순서를 지킬 것 |
| S7 ① 직판 10% | 채널이 `direct` 인 매장의 주문이 **0건**. 결제 1건 필요 — **준비물 있음**(§7-B) |
| S1 | 커미션 축이 **겹치는** 주문 1건 필요(직접 입점 + `introduced_by_influencer_id` + 멀티티어 ON) |
| S9·S12·S-CART | 전부 결제 1건 이상 |

### 🔢 순서가 중요하다 (재료를 아껴 쓴다)

1. **배포 확인** — §1 의 curl 이 `50/22` 를 내는지. (지금 할 수 있는 일)
2. **그 1건을 환불하기 *전에*** 판정 패널을 한 번 더 찍어 `gates` 전체를 기록으로 남긴다.
3. 환불 → 같은 주문번호로 다시 찍어 **`s2`/`s3` 의 `reversal_symmetric`** 과 S7 ⑤ 를 본다.
4. 그다음 결제 건들(S7 ①·S1·S9·S12)은 **한 방문에 묶는다** — §통합 실결제 절차 참조.

⚠️ **게이트를 켜는 것은 여전히 대표 몫이다**(세션은 플랫폼 쓰기를 하지 않는다).
그리고 `commission_budget_enabled` 는 **켜기 전에** §S1 절차 4단계(끈 채 1건 → 켜고 1건 → 환불 → 복귀)를
그대로 밟아야 한다 — 이제 그 절차가 읽는 숫자가 진짜다.

## 7-B. 🧾 결제 준비물 — **전수로 확인했다. 새로 만들 것이 없다**

세션이 자주 *"결제 1건 필요"* 라고만 적어 두는데, 그러면 대표가 **무엇을 어디서 사야 하는지** 모른다.
2026-10-01 에 라이브 D1 + 공개 API 로 전수 확인했다(읽기 전용) — **셋 다 직링크로 지금 살 수 있다.**

| 재려는 것 | 링크 | 매장 | 채널·요율 | 재고 | 왜 이 상품인가 |
|---|---|---|---|---|---|
| **S7 ① 직판 10%** | `urdeal.kr/group-buy/2917` | 24 구서 우성아파트 (`approved`) | **`direct` · 10%** | 200 | 유일하게 *승인 + 직판 + 활성 상품* 이 겹친 매장. 10,000원이라 수수료가 **1,000원**으로 떨어져 10% 인지 눈으로 보인다 |
| **S8 소개자 몫 = 딜 %** · **S-BROKER** | `urdeal.kr/group-buy/2916` | 15 \[테스트\] 클로드분식 | `brokered` · 10% | 10 | 라이브 **유일한 딜 계약**(`seller_influencer_deals` id=1 · 소개자 `37` · **5%** · active)이 걸린 매장 |
| 재판정용(이미 결제됨) | `GB-3-1789611467065` | 14 홍대돈까스 | `brokered` · 5% | — | §7 순서의 2·3단계 |

⚠️ **매장 15 는 `suspended`** 라 메인 피드·목록에는 **안 뜬다**(2026-09-16 `approvedSellerProductSql`).
**직링크 상세는 열리고**(공개 API 실측 200) **공구 구매 경로엔 정지 매장 차단이 없다**(grep 0) ⇒ 결제는 된다.
그게 CLAUDE.md 가 *"직링크 상세·구매는 막지 않는다"* 고 적어 둔 바로 그 성질이다.

🔑 **S8 을 재려면 소개자 링크로 들어가야 한다** — 그냥 2916 을 사면 `influencer_attributions` 가
안 생기고 *"딜이 없으면 0원"* 쪽만 재어진다. 소개자 `37` 의 코드/링크(`?ref=`)를 타야 ①이 재어진다.

### 📏 라이브 실측 — 적립 축이 **통째로 0행**이다

```
influencer_attributions 0 · affiliate_earnings 0 · referral_commissions 0
seller_influencer_deals 1 (매장 15 ↔ 소개자 37, 5%, active)
orders 89행 — 그중 결제 캡처는 23건이고 22건이 2026-02~05(데모기), 6월 이후는 1건
sellers 11곳 (approved 8 · suspended 3) · store_channel: direct 7 · brokered 4
```

🔴 **그래서 체크리스트 S8 의 문장을 정정해야 한다.** 거기엔
*"이건 지금 돈이 그 규칙으로 흐르고 있는데 미검증이다"* 라고 적혀 있지만 — **흐른 적이 없다.**
딜 계약이 걸린 매장(15)에서 **팔린 주문이 0건**이다. 게이트가 없어 *코드가* 라이브인 것은 맞지만,
*돈이* 그 경로를 지난 적은 없다. 위험도가 다르다(지금 틀려 있어도 피해자가 없다).

## 8. 이번에 틀렸던 판단

1. 앞선 보고에서 *"첫 수순은 그 1건 환불"* 이라고 했다. **순서가 틀렸다** — 그 1건은 S1·S8 을
   판정할 **유일한 재료**이고, 환불하면 사라진다. 판정이 먼저다(§7 순서).
2. `platform_revenue.credit_krw: 0` 을 한때 "유어딜 수취 0" 으로 읽을 뻔했다. 매장이 있는 주문은
   **그게 정상**이다(유어딜 몫은 그 행의 `fee_amount`). 응답 `note` 에 그 문장을 박아 뒀다.
3. 새 시험 첫 판에서 행 대신 숫자(`[89]`)를 넣어 바인딩 오류를 냈다 — **시험이 스스로 잡았다**.
4. 🩸 **준비물 판정을 두 번 연달아 틀렸다.** ⓐ 매장 24 의 상품을 보고 *"재고 0 이라 못 쓴다"* 고 했는데
   내가 읽은 `stock_quantity` 가 **안 쓰이는 중복 컬럼**이었다 — 결제가 보는 것은 `stock` 이고 **200** 이다
   (`group-buy.routes.ts:1197` 의 원자 예약이 `stock` 을 쓴다). ⓑ 이어서 *"카테고리가 `lifestyle` 이라
   쇼핑 레일"* 이라고 했는데, 결제 레일을 정하는 것은 **카테고리가 아니라 `group_buy_status`**
   (`shared/product-flow.ts` SSOT — CLAUDE.md 가 명시한 그 규칙을 내가 어겼다).
   ⇒ **이중화 컬럼과 SSOT 를 확인하기 전에 준비물이 없다고 단정하지 말 것.** 둘 다 "없다" 쪽으로
   틀렸고, 그대로 보고했으면 대표가 멀쩡한 준비물을 새로 만드느라 시간을 썼다.

## 9. 못 한 것 / 가드가 못 보는 것

- **배포 후 판정은 안 했다**(§1 이 그 절차다). 지금 상태는 E3 이다.
- 실제 sqlite 시험은 **쿼리가 맞는지**만 본다. 그 주문의 적립 축이 정말 전부인지, 환불 뒤에도
  유어딜 것인지는 **S1 실결제**의 몫이다.
- `order_fee_breakdown` 이 없으므로 S4 는 게이트를 켜 테이블이 생긴 뒤에만 판정된다.
