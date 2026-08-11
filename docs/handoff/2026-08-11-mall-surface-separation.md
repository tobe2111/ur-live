# 🏬 공구 서비스(운영자 몰) — 소비자 표면을 유어딜에서 분리 (단계 1/4)

> **지시**: 2026-08-11 대표 — *"그 서비스(다이클로 식 공동구매)는 유어딜과 **철저히 분리**되어야 해."*
> **동의된 경계**: **표면은 완전 분리 · 결제/정산 레일은 공유 유지**(대표 확인). 아래 §4 참조.
> **범위**: 단계 1(몰 전용 상품 상세) + 단계 3(가드). 단계 2·4 는 미착수 — §3.

---

## 1. 왜 했나 — 실측 (같은 상품 하나가 세 화면에서 세 값)

| 화면 | 브랜드 | 가격 | 근거 |
|---|---|---|---|
| 몰 홈 `/{슬러그}` | 운영자 | **공구가 7,000원** | `mall-public.routes.ts` `resolveGbPricing` |
| 카톡 공유 카드 | 운영자 | **공구가** | `mall-ssr-meta.ts` |
| **본진 상세 `/products/:id`** | **유어딜**(탭바·배너·추천) | **상시가 10,000원** | `products.routes.ts` 는 `resolveGbPricing` 을 **안 부른다**(grep 0건) · `current_price` 미주입 → `ProductDetailPage:385` 가 `product.price` 표시 |
| 결제 | 유어딜 | **공구가 7,000원** | `order.routes.ts:303` `gbPricing.basePrice` |

즉 **살지 말지 정하는 바로 그 화면에서만 가격이 올라가** 있었다. 브랜드도 거기서 바뀌었다.

🔑 **두 증상의 원인이 하나였다** — `isMallSurfacePath` 가 **1세그먼트만** 몰 표면으로 판정해
분리가 걸린 곳이 **몰 홈 한 장뿐**이었다. 몰 카드가 본진 `/products/:id` 로 링크하는 순간 전부 샜다.

---

## 2. 한 것 (완료)

| # | 변경 | 파일 |
|---|---|---|
| 1 | 몰 상품 경로 SSOT — `mallProductPath` · `parseMallProductPath` · `isMallSurfacePath` 확장 | `shared/mall/resolve.ts` |
| 2 | 몰 전용 상세 API `GET /api/mall/:slug/products/:id` (몰 스코프 **쿼리에** · 공구 비활성이면 404 · 수수료 비노출) | `features/mall/api/mall-public.routes.ts` |
| 3 | 몰 전용 상세 화면 `/{슬러그}/p/{id}` | `pages/MallProductPage.tsx` (신규) |
| 4 | 라우트 등록(`/:mallSlug` **앞**) | `App.tsx` |
| 5 | 몰 카드 → 몰 상세로 링크 | `pages/MallHomePage.tsx` |
| 6 | 본진 상세가 몰 상품을 **그 가게로 되돌림**(옛 링크·검색 유입 커버) | `pages/ProductDetailPage.tsx` + `products.routes.ts`(`mall_slug` 스탬프) + `mall-consumer.ts`(`consumerMallSlugById`) |
| 7 | **카톡 OG 재발 방지** — `MALLPRODUCT` SSR 슬롯 + 메타 | `worker/index.ts` · `mall-ssr-meta.ts` |
| 8 | 가드 5종 + 되돌려-검증 | `tests/unit/mall-surface-boundary.test.ts` |

**검증**: tsc 0 · **vitest 5429 pass (414 파일)** · `npm run build` 0 · 정적 가드 14종 GREEN
(file-size·theme·mobile·duplicate-routes·modal-z·utc-date·pagination·robots·sitemap·guard-registry·
conflict-markers·lock-table·dongnedeal·sql-bind/column).

**되돌려-검증 5건 전부 빨강 확인 후 복원** — ①몰카드→본진링크 ②본진되돌림 제거 ③`mall_slug` 제거
④OG슬롯 제거 ⑤표면판정 1세그먼트 환원.

---

## 3. 🔴 다음 세션의 첫 액션 — **단계 2 (결제 표면)**. 파일럿 오픈 전 필수

몰 손님 여정 5단계 중 **③장바구니 ④체크아웃 ⑤결제확정은 아직 유어딜 본진**이다(`mall_id` 인지 0건).
거기서 **두 가지가 지금도 틀리다**:

**(a) 체크아웃이 상시가를 보여준다** — `order.routes.ts:1293` 견적이 `unitPrice = Number(p.price)`
(상시가). 주문 생성(`:303`)만 공구가라 **청구는 맞고 화면은 틀리다.**

**(b) 픽업 상품에 배송비 3,000원이 붙는다** 🔴 **머니**
```
order.routes.ts:1300
  g.allNoShip = g.allNoShip && (Number(p.deal_only) === 1 || isVoucherCategory(p.category ?? null))
```
픽업 몰 상품은 **둘 다 아니다** → 비배송으로 안 쳐서 배송비가 붙는다.
`MallProductPage` 가 `shipping_fee: 0` 을 넘기지만 **서버 견적이 이기므로 그것만으로는 안 고쳐진다.**

⇒ **판정 명령**(배포 후):
```bash
# 몰 상품 상세가 공구가로 뜨는가 (카드와 같은 값)
curl -s https://urdeal.kr/api/mall/{슬러그}/products/{id} | python3 -m json.tool | grep -E 'gb_price|list_price'
# 카톡 카드가 몰 카드인가 (제네릭 유어딜 카드가 아니어야)
curl -s https://urdeal.kr/{슬러그}/p/{id} | grep -E 'og:title|og:description'
# 본진 링크가 가게로 되돌아가는가
curl -s https://urdeal.kr/api/products/{몰상품id} | python3 -m json.tool | grep mall_slug
```
⚠️ **화면의 가격 일치는 눈으로 봐야 한다** — 이 PR 의 가드는 *배선이 있는지*만 본다.

---

## 4. 이번에 틀렸던 판단 (같은 오진 반복 방지 — 제일 값진 항목)

1. 🔴 **범위를 두 번 잘못 잡았다.** 대표가 *"공동구매 서비스"* 라고 했을 때 **유어딜 소비자 공구**
   (`features/group-buy`)를 검토했는데, 뜻한 것은 **공구 서비스(운영자 몰)** 였다.
   `CLAUDE.md` §서비스 분리가 *"코드가 둘 다 `group_buy_*` 라고 부르지만 서비스가 다르다"* 고
   경고하는 바로 그 짝이다. ⇒ **작업 전에 "넷 중 어디인가"를 먼저 말하고 확인받을 것.**
2. 🔴 **레퍼런스 이름을 못 찾고 "레포에 없다"고 답할 뻔했다.** 대표가 말한 **다이클로**를
   *"다이크로"* 로 듣고 검색해 0건 → 없는 줄 알았다. 실제로는
   `docs/design/operator-mall-pilot.md:16` 에 **경쟁사 레퍼런스 10장**으로 기록돼 있다.
   ⇒ 고유명사는 **표기 변형(오/우, 크/클 …)을 함께** 검색할 것.
3. 🔴 **첫 처방이 분리 원칙에 역행했다.** 가격 불일치를 *"본진 `products.routes` 에 `current_price`
   주입"* 으로 고치려 했다 — 가장 싸지만 **몰↔본진 결합을 더 굳힌다.** 대표 지시를 듣고 나서야
   원인이 "가격 한 줄"이 아니라 **"몰 손님이 왜 본진 화면에 있는가"** 임이 드러났다.
4. ⚠️ **경로를 옮기면 OG 가 따라가지 않는다.** 하마터면 2026-08-09 에 PRODUCT 슬롯으로 막아 둔
   *"몰 상품 공유가 본진 일반 카드로 나가는"* 갭을 **새 경로에서 재발**시킬 뻔했다.
   카톡 카드는 스크랩 캐시에 **박제**된다 ⇒ 경로 이전과 **같은 커밋**에서 슬롯을 함께 옮길 것.
5. ⚠️ **기존 테스트의 취약한 단정**: `mall-ssr-meta.test.ts` 가 import 문을 **정확한 문자열**로
   봐서, 같은 모듈에서 심볼을 하나 더 들여오자 **정상 변경이 빨강**이 됐다. 심볼 기반으로 교정
   (모듈 경로는 그대로 고정 — 느슨해지지 않았다).
6. ✅ **가드가 내 오타를 잡았다**: 주석에 `` `mall_id=1` `` 이라고 쓴 것만으로
   `mall-id-isolation` 래칫이 빨강을 냈다(리터럴 몰 id 대입 패턴). **가드를 고치지 않고 주석을
   고쳤다** — 가드가 옳았다.

---

## 5. 남은 결정 / 대기 (대표 판단)

| # | 항목 | 상태 |
|---|---|---|
| A | **`gb_engine_enabled` 게이트가 결제 경로에 없다** — `seller-gb.routes.ts:13`·`gb-cockpit.routes.ts:5` 는 *"실제 적용은 게이트 뒤"* 라고 적었는데 `order.routes.ts:250` 은 **무게이트**. 방향은 항상 내림(과다청구 불가)이지만 **킬스위치가 없고 문서가 거짓**이다. ⇒ (a)게이트를 붙인다 / (b)문서를 사실로 고친다 | 🔴 결정 대기 (권고: a) |
| B | 단계 2 (§3) — 체크아웃 표면. **(b) 배송비는 머니 경로** → 세 줄 보고 + 단독 PR | 🔴 미착수 |
| C | 몰 상품 목록 **200개 절단** — `mall-public.routes.ts` `ORDER BY p.id DESC LIMIT 200` 후 JS 필터. 상품 200개 넘는 몰에서 오래된 상품의 진행 중 공구가 안 뜬다 | 🟡 파일럿 규모에선 미발생 |
| D | 단계 4 — 미수령(C7)·실결제 환경(X1)·알림 env(X7). **세션이 풀 수 없다**(대표 결정·인프라) | 기존 추적 유지 |

> 유어딜 **소비자 공구**(별 축) 검토 결과도 같은 세션에서 나왔다 — 카드 결제 `order_number ≠ Toss orderId`
> 로 **웹훅 단절 + 가상계좌 무방비**, 셀러 환불 `meta_voucher` 하드코드, `/join` 본인구매 차단이
> **ID 네임스페이스 불일치**로 무효. 이 PR 범위 밖이고 **미착수**다.
