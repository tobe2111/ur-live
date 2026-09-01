# 이용권 장바구니·결제 — 배송비 판정이 두 화면에서 갈려 있었다 (2026-09-01)

## 다음 세션의 첫 액션

```bash
npm run build
node scripts/visual-preview.mjs --route=/cart     --cart --auth=user --name=cart-pickup
node scripts/visual-preview.mjs --route=/checkout --cart --auth=user --name=checkout-pickup
```
두 그림의 **결제예정금액이 같아야 한다(64,900원)** 그리고 **어느 쪽에도 "배송비" 줄이 없어야 한다.**
다르거나 배송비가 보이면 회귀다. 배송 레일 회귀는 `--cart=shipping` 으로(합배송 배지 +
"3,100원 더 담으면 무료배송!" 이 살아 있어야 한다).

## 무엇이 문제였나 — 대표가 한 줄로 잡아냈다

대표: *"이용권은 배송비도 없는데? 이용권에 맞는 장바구니가 필요한데...?"*

그 말을 확인하려고 하네스 시드를 비배송으로 바꿔 렌더했더니 그대로였다.

| | 상품금액 | 배송비 | 결제예정 |
|---|---|---|---|
| `/cart` | 64,900 | **+6,000** | **70,900** |
| `/checkout` | 64,900 | 0 (합계) / **3,000원 두 줄**(목록) | 64,900 |

합계가 결제 직전에 줄어드는 화면은 깎아 준 것도 아니고 틀린 것도 아닌, 그냥 **못 믿을 화면**이다.
그리고 결제 화면은 위에서 *"배송지 입력이 필요 없어요"* 라고 해 놓고 아래에 배송비를 찍고 있었다.

### 원인 셋

1. **같은 판정이 두 파일에 따로 적혀 갈라졌다.** CheckoutPage 는 2026-06-22 에
   "이용권 카테고리도 비배송" 으로 넓혔는데 CartPage 는 `deal_only === 1` 에 머물렀다.
2. **`item.shipping_fee || 3000`** — `||` 가 셀러가 명시한 **0**(비배송·무료)을 3,000 으로
   되돌린다. 한 글자(`||` → `??`)가 6,000원을 만들었다.
3. **서버가 `p.category` 를 아예 안 보내고 있었다**(`cart.routes` SELECT 누락).
   그래서 CheckoutPage 의 2026-06-22 수리도 **절반은 죽어 있었다** — `/api/cart` 를 거쳐 온
   장바구니에서는 `isVoucherCategory(undefined)` 라 항상 false 였다. 몰 상품(`MallProductPage`)만
   `category` 를 직접 넘겨 우연히 동작하고 있었다.

## 내가 틀렸던 판단 (제일 값진 부분)

**이용권에는 장바구니가 없다.** 처음에 시드를 배송 상품(배송비 3,000 · 합배송 · 무료배송 바)으로
만들고 `/checkout` 을 렌더한 뒤 "유어딜 결제 화면" 이라고 대표에게 보고했다. 경로를 실제로
따라가 보니 아니었다:

- 이용권 `/group-buy/:id` → **`/pay/widget`**(TossWidgetPayPage) → `/group-buy/confirm-payment`
- 교환권(`deal_only=1`) → 상세에서 딜로 즉시 교환 (결제 화면 자체가 없다)
- `/cart`·`/checkout` 을 타는 것은 **쇼핑**(`SHOPPING_TAB_HIDDEN` 으로 숨김)과
  **공구 서비스의 몰 상품**(`MallProductPage` → directPurchase)뿐

grep 으로 확인: `GroupBuyDetailPage`·`VoucherDetailPage` 에 '장바구니 담기' **0건**.
⇒ 하네스 `--cart` 기본값을 **비배송**으로 바꿨고(살아 있는 쪽이 그쪽), 배송 케이스는
`--cart=shipping` 으로 밀어 뒀다. 그 이유를 시드 주석에 적어 뒀다.

## 완료분

- **SSOT 신설** `shared/product-flow.ts` `isNoShippingProduct` / `getNoShippingKind`
  (`'deal'` = 휴대폰으로 온다 / `'voucher'` = 아무것도 안 온다, 매장에서 쓴다).
  CartPage · CheckoutPage 가 둘 다 이 함수를 거친다.
- `cart.routes` 두 SELECT(본 쿼리 + `bundling_key` 부재 fallback)에 **`p.category` 추가**.
- 배송비 줄을 **비배송이면 아예 뺀다** — `CartSummary` · `OrderSummary` · `OrderItemsList`.
  ('무료'라고 쓰면 원래 있었어야 할 비용을 깎아 준 것처럼 읽힌다.)
- 셀러 그룹 줄을 `components/cart/CartGroupShippingRow.tsx` 로 추출(CartPage 658 → 638, 동결값).
- **가드 신설** `check-no-shipping-ssot.mjs`(audit-gate + verify strict, 불변식 **98**개).
  되돌려-검증 3종 전부 빨간불 확인 — ① 옛 판정 복원 ② `??`→`||` ③ SSOT 에서 이용권 제외(unit).
- 단위 테스트 4건 추가(`product-flow.test.ts`, 13 pass).

### 결제 문구 (대표 `AskUserQuestion` 승인 "허가 — 문구만 수정", Toss 잠금파일)
`TossPaymentWidget.tsx` · `TossWidgetPayPage.tsx` — **문자열만**. 분기 조건(정규식)·
`requestPayment`·`widgets()`·금액 검증·키 분기·상태 전이 전부 byte-불변.
- 화면에 붙던 **`[SDK 원본]: <영문 스택 조각>` 제거**(원인 값은 `console.error` 가 남긴다).
- *"Toss 콘솔 → 결제 → 결제수단 → 활성화"* 는 **운영자용 지시**였다 — 소비자는 그 콘솔에
  못 들어간다. 소비자가 할 수 있는 행동으로 교체.
- `payment.errors.systemError` "결제 시스템 오류 (새로고침 필요)" → **"지금은 결제할 수 없어요"**
  (6개 언어). 그 버튼은 error 상태에서 **비활성**이라 행동을 약속하면 안 된다.
- `payment.initError` "결제 초기화 실패" → "결제를 시작하지 못했습니다…"(6개 언어).
  ⚠️ 코드의 `defaultValue` 만 고치면 안 된다 — **locale 값이 이긴다**(그래서 6개 다 고쳤다).

## 남은 것 / 대표 판단

1. **`/pay/widget` 을 아직 눈으로 못 봤다.** 이용권 결제의 **유일한 화면**인데 하네스가 외부
   호스트를 차단해 Toss SDK 가 안 뜬다(=항상 error 상태만 렌더된다). 실제 위젯 화면은
   staging 실결제로만 볼 수 있다.
2. **error 상태의 빈 상자 두 개** — Toss 가 렌더할 컨테이너(`#toss-payment-methods` ·
   `#toss-agreement`)가 실패 시 **빈 테두리 상자**로 남는다. 비활성 회색 버튼 위에 빈 상자
   둘이 뜨는 화면이다. 고치려면 마크업 변경이라 이번 "문구만" 승인 범위 밖 — 별도 판단.
3. `ProductDetailPage` 의 바로구매가 **`shipping_fee: 3000` 하드코딩 + `category` 미전달**이다.
   쇼핑 레일이 숨겨져 있어 지금은 안 보이지만, 재오픈 시 이용권을 그 경로로 사면 같은 사고가 난다.
