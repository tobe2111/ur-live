# 이용권 장바구니 (2026-09-15)

대표: *"장바구니쪽도 진행해줘. 끝까지 모두 다. 이용권 결제 플로우에 문제 없도록"*

## 🚦 상태: 코드 완료 · **게이트 OFF** · staging 실결제 대기

`platform_settings.voucher_cart_enabled = 'true'` 라야 열린다. 머니 경로라 CLAUDE.md 가 staging 실결제를
요구하고, 그 전까지 켜지 않는다. **꺼져 있으면 이 레일은 없는 것과 같고 단일 구매는 무영향이다**
(가드가 그걸 고정한다 — 두 엔드포인트 다 403).

## 1. 착수 전에 알아야 했던 것 — 레일이 둘이고 발급이 한쪽에만 있다

인계에 적혀 있던 실측이 이 설계 전체를 결정했다:

> `INSERT INTO vouchers` 는 `group-buy.routes.ts`(:614·:1245)와 `experience-campaign.routes.ts`
> 에만 있다. **소비자 `orders` 레일(`payment.routes /confirm`·`webhook.routes`)엔 0건이다.**

즉 장바구니를 기존 `/checkout`(소비자 레일)에 태우면 **결제는 되고 이용권은 안 나온다.**

선택지는 둘이었다:

| | |
|---|---|
| ❌ 발급을 소비자 레일로 옮긴다 | **Toss 감사-잠금 파일**(`payment.routes`·`webhook.routes`)을 열어야 하고, 한 상품당 열 가지 넘는 규칙(1인당 한도·리뷰 레벨·선착순·티어가·영입자 도장·재고·정산·알림)을 통째로 이사시켜야 한다 |
| ✅ **장바구니를 공구 레일로 태운다** | 그 규칙들이 이미 거기 산다. 줄마다 **같은 함수**를 부르면 된다. **잠긴 파일은 한 글자도 안 건드린다**(SSOT helper 를 *호출*만 — 잠금표 예외 절이 명시적으로 허용) |

## 2. 구조

```
담기        상세 하단 바 → POST /api/cart            (기존 cart_items 재사용)
장바구니    /cart → routeCartCheckout() 이 레일을 고른다
             ├ 이용권만  → POST /api/group-buy/cart/init      ← 금액을 **서버가** 정한다
             ├ 배송만    → /checkout (종전)
             └ 섞임      → 보내지 않고 이유를 말한다
결제        /pay/widget (잠금 파일 — 호출만)
확정        /group-buy/confirm-payment?cart=1
             → POST /api/group-buy/cart/confirm-toss
```

| 파일 | 하는 일 |
|---|---|
| `features/group-buy/api/cart-lines.ts` | 줄 정규화 + **게이트 전수** + 값매김 (순수에 가깝다 — 테스트가 실행해서 잰다) |
| `features/group-buy/api/cart-intent.ts` | "이 주문번호로 무엇을 사기로 했나" 를 서버가 기억 (`gb_cart_intents`) |
| `features/group-buy/api/cart-checkout.routes.ts` | `/cart/init` · `/cart/confirm-toss` |
| `pages/cart/voucher-checkout.ts` | 장바구니가 어느 레일로 갈지 **한 곳에서** 판단 |
| `pages/group-buy/AddToCartButton.tsx` · `DealBottomBar.tsx` | 담기 버튼 + 하단 바 분리 |
| `pages/group-buy/CartComplete.tsx` | 여러 매장이면 묶음 완료 화면(한 상품이면 기존 티켓 그대로) |

## 3. 설계 결정 넷 (각각 막는 사고가 있다)

### ① 품목은 **서버가 기억한다** — URL 로 돌려받지 않는다

토스 결제는 중간에 브라우저를 거친다. 품목을 복귀 URL 에 실으면 그건 **사용자가 고칠 수 있는 값**이다.

금액 검증만으로는 안 닫힌다:
- 부분결제 게이트 OFF(기본)면 `expectedAmount === chargedAmount` 를 강제하므로 **총액은 못 바꾼다**
- 그런데 **총액이 같은 다른 상품으로 바꿔치기**는 통과한다 — 1만원 A 를 결제하고 1만원 B 를 주장하면
  B 가 발급된다. 우리 돈은 안 새지만 **A 매장은 판 적 없는 매출을, B 매장은 판 줄 모르는 매출을** 갖는다.

⇒ `gb_cart_intents`(주문번호 = 행 하나, 주인만 읽음)에 적어 두고 확정 때 그것만 읽는다.
**확정 요청 본문에 `items` 가 아예 없다**(타입에서 지웠다).

### ② `orders` 는 한 행, 정산은 줄 단위

`order_number` = 토스 orderId(웹훅이 이 값으로 주문을 찾는다). 셀러가 여럿이면 `orders.seller_id` 는 null.

**그래도 정산이 안 깨지는 이유 — 셋 다 줄 단위라서다(실측 확인):**
- `donations.seller_id` — 셀러별로 나눠 적는다
- `ledger_entries` — `sellerLedgerAccount(sid)` 로 셀러별
- 환불 회수 `voucher-settlement-clawback` — `vouchers JOIN products` 의 **`p.seller_id`** 로 판단한다
  (`orders.seller_id` 를 안 본다)

### ③ 전부 되거나 전부 안 되거나

- 게이트: 한 줄이라도 막히면 **값매김 자체가 실패** → 결제창이 안 열린다(부분 구매 0)
- 재고: 줄마다 CAS 로 잡되 하나라도 못 잡으면 **앞서 잡은 것을 되돌리고 전액 환불**
- 딜: 차감 실패면 재고 되돌리고 전액 환불
- 발급: `order_items + vouchers + 카운터` 를 **한 batch** — 부분 발급이 구조적으로 불가능

### ④ 같은 상품 두 줄은 합친다

안 합치면 1인당 한도 검사가 줄마다 따로 돌아 **각각은 통과하고 합계는 초과**한다.

## 4. 이번에 틀렸던 것

| | |
|---|---|
| 결제창 이름을 **통째로** 잘랐다 | 상품명이 길면 `외 N건` 이 잘려 나가 **결제창이 나머지 품목을 감췄다.** 자를 것은 이름이지 꼬리표가 아니다. 내가 쓴 시험이 잡았다 |
| `continue` 검사를 `/\n\s+continue\b/` 로 썼다 | 주입이 넣은 `if (!p) continue` 는 앞이 `) ` 라 **매치가 안 돼 헛돌았다**. 자기 주입이 잡았다 |
| 거절 개수를 `[^}]*` 로 셌다 | 템플릿 리터럴 `${p.name}` 의 중괄호에서 끊겨 6건 중 **3건만** 셌다 |
| 하단 바를 옮기며 **남의 주입을 낡게** 했다 | `deal-use-chooser` 의 "고르는 자리가 구매 버튼 아래로" 가 대상을 잃었다 — 지우지 않고 재조준(짝인 테스트도 같이) |

## 5. 남은 것

- [ ] **staging 실결제** (`docs/STAGING_CHECKLIST.md` `S-CART`) — 이게 유일한 최종 판정이다
- [ ] 게이트 ON 은 **대표 결재** (머니 경로)
- [ ] 장바구니 화면에 이용권 전용 정리(지금은 기존 쇼핑 UI 가 비배송으로 잘 처리한다 — 쇼핑탭이
      숨겨져 있어 실제로는 이용권만 들어온다). 사용 후 필요하면 그때
- [ ] 버려진 `gb_cart_intents` 정리를 cron 에 배선(`purgeStaleCartIntents` 는 있고 호출부가 없다 —
      없어도 해가 없어 급하지 않다)
