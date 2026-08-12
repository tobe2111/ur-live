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

---

## 6. 🔴 추가분 — 단계 2 + 킬스위치 (같은 세션, 대표 "모두 진행")

⚠️ **이 PR 은 이제 머니 경로를 만진다.** §2 의 *"머니 무접촉"* 은 아래 커밋으로 **더 이상 사실이 아니다**.
(브랜치가 하나로 지정돼 있어 단독 PR 로 못 나눴다 — 커밋은 분리했다.)

### (a) 픽업 상품 배송비 3,000원 — 오청구 수정
비배송 판정이 `deal_only=1 || isVoucherCategory` 뿐이라 **픽업 공구가 둘 다 아니어서** 배송으로 분류됐다.
손님은 가지러 가는데 배송비를 냈다. 규칙이 **세 벌**(주문생성·견적·CheckoutPage)로 복제돼 있던 것을
`allItemsNoShipping`(shared/order-type) SSOT 로 통일하고 **`has_pickup` 축을 추가**.
🔴 판정은 *"픽업 정보가 있는가"* 다 — 몰 상품인지로 가르지 않는다(본진 픽업에도 맞고 몰 결합이 안 생긴다).

### (b) 견적이 상시가를 보여주던 것
`/quote` 가 `Number(p.price)` 였고 주문 생성만 `gbPricing.basePrice` 라 **청구는 맞고 화면은 틀렸다.**
견적도 같은 `loadGbOrderPricing` 을 쓴다.

### (c) 공구가 킬스위치 `gb_pricing_enabled` (기본 **ON**)
🔴 **`gb_engine_enabled` 를 쓰지 않았다** — 그 키는 기본값이 `'false'` 라 그대로 걸면 **오늘 당장
공구가가 안 먹어** 몰 화면은 공구가인데 청구는 상시가가 된다(지금보다 나쁘다).
게이트의 목적은 "잠가 두는 것"이 아니라 **잘못된 공구가를 즉시 되돌릴 손잡이**다.
⇒ 방향이 반대인 스위치: 미설정·조회실패 = 적용(fail-open), **`'false'` 저장 시에만** 상시가로 환원.
그리고 `seller-gb.routes:13`·`gb-cockpit.routes:5` 의 *"적용은 게이트 뒤"* 라는 **거짓 주석을 정정**했다.

### 가드
신규 `pickup-shipping-gb-killswitch.test.ts` — 되돌려-검증 4건 빨강 확인 후 복원
(픽업축 제거 / 빈배열 가드 제거 / 견적 상시가 환원 / 킬스위치 방향 반전).

### ⚠️ 다음 세션 — **staging 실결제 전에는 파일럿을 열지 말 것**
테스트는 **판정과 배선**만 본다. 실제 청구액(배송비 0 · 단가 공구가)은 검증하지 않았다.
확인 항목: ① 픽업 상품 결제 시 배송비 0 ② 체크아웃 표시가 = 청구가 = 몰 카드가
③ `gb_pricing_enabled='false'` 저장 → 즉시 상시가 청구로 환원되는가.

### 남은 것
- 몰 상품 목록 **200개 절단**(`mall-public.routes.ts`) — 파일럿 규모에선 미발생, 미착수.
- `scripts/file-size-baseline.json` 의 `App.tsx`·`worker/index.ts` 2개 항목을 +6줄 갱신했다
  (blanket `file-size-ok` 로 god 파일 4개를 영구 면제하는 것보다 낫다고 판단). **대표 승인받음.**

### 🔴 7. 이 세션에서 **두 번 반복한 검증 실수** (다음 세션 필독)

**① `check-file-size` 를 CI 와 다른 모드로 돌려 두 번 놓쳤다.**
- CI: `node scripts/check-file-size.mjs --changed-only -s` (**strict**)
- 내가 돌린 것: `node scripts/check-file-size.mjs` (**기본 warn-only → exit 0 → 초록으로 보임**)
⇒ **가드는 워크플로에 적힌 인자 그대로 돌릴 것.** `verify.yml` 에서 복사해 붙이는 게 안전하다.

**② 로컬 `--changed-only` 가 조용히 전수 폴백을 타고 있었다.**
`origin/main` ref 가 없어(얕은 clone) merge-base 계산이 실패하면 **전수(-a) 스캔으로 폴백**한다.
전수 모드는 baseline 초과를 같은 방식으로 안 잡아 **초록이 뜬다.**
⇒ 검증 전에 **`git fetch origin main --depth=50`** 을 먼저 하라. 그러면 출력이
`changed-only vs origin/main — N개 판정` 으로 바뀐다(폴백이면 그 자리에 안내문이 뜬다 — 그게 신호다).

**③ 문자열 앵커 가드가 헛돌았다 (되돌려-검증이 잡았다).**
`pickup-flags.ts` 의 `has_pickup: pick.has(...)` 를 `false` 로 바꿔도 **초록**이었다 —
배선 검사는 *"호출이 있는지"* 만 보고 *"그 값이 실제로 쓰이는지"* 는 못 본다.
⇒ `vi.mock('@/worker/utils/product-supply-meta')` 로 **동작 테스트**(5건) 추가.
이제 같은 변형이 빨강이 된다. **판정 로직에는 문자열 앵커만 두지 말 것.**

> 세 개 다 "실패가 아니라 **조용한 통과**" 클래스다. 이 레포가 반복해 만나는 그 클래스다.

---

## 8. 마감분 — 남은 표면 항목 종료 (대표 "계속 해줘 끝까지")

### (a) 몰 목록 **200개 절단** 수정 〔§5 항목 C 종료〕
`LIMIT 200` 으로 **전체 상품**을 먼저 자르고 JS 에서 공구만 남기던 것 →
**공구 후보를 SQL 에서** 좁힌다(`EXISTS … gb_mode IN ('live','scheduled')`).
최종 판정(마감·시작시각)은 `resolveGbPricing` 이 그대로 하므로 **의미 불변**, 자르는 대상만 바뀐다.
여유분 `min(300, limit*3)` — 딱 맞게 가져오면 JS 필터 후 화면에 `limit` 보다 적게 남는다.

### (b) 🐛 **죽어 있던 몰 흔적을 살렸다**
`rememberMallOrigin`(2026-08-02 작성)의 **호출부가 0** 이었다. 흔적이 한 번도 안 남아
`readMallOrigin()` 이 늘 `null` → `ProductDetailPage` 의 **'가게로 돌아가기' 가 한 번도 뜬 적이 없다**
(항상 유어딜 홈으로 보냈다). 몰 홈 + **몰 상품 상세** 둘 다에서 남기게 배선
(카톡에서 **상품 링크로 바로** 들어오는 것이 흔한 경로라 홈에서만 남기면 그 손님은 흔적이 없다).

### (c) 몰은 있고 **상품만 없을 때** 유어딜 404 금지
품절·공구 종료·삭제 → `state='gone'` 으로 갈라 **그 가게 화면**으로 안내한다.
단톡방에 링크가 오래 남는 특성상 흔한 상황이고, 여기서 유어딜 404 를 보여주면
`MallHomePage` 주석이 말한 *"몰이 열렸다보다 나쁜 결과"* 가 된다.
⚠️ **몰 자체가 없으면** 그대로 `NotFoundPage` — 둘을 합치면 안 된다.

### ⚠️ 이번에도 걸린 함정 (§7 에 이어)
**주석 함정이 반대 방향으로 걸렸다.** `LIMIT 200` 이 되살아나는지 보는 가드를 만들었는데,
같은 파일의 *설명 주석*에 적은 "그전엔 `LIMIT 200` 으로…" 를 잡아 **정상 코드가 빨강**이 됐다.
⇒ 소스에서 **주석을 벗기고** 검사하도록 교정. (이 레포의 기존 경고는 "주석에 남아 통과"였는데,
   같은 뿌리에서 "주석 때문에 실패"도 난다. 코드 모양을 볼 땐 주석을 벗기는 것이 기본이다.)

### 검증
tsc 0 · vitest **5451 pass**(415 파일) · build 0 · `check-file-size` **CI 동일 모드** GREEN ·
sql column/table/bind GREEN. 되돌려-검증 3건(흔적 제거 / 상품없음→유어딜404 / 200절단 환원) 빨강 확인.
