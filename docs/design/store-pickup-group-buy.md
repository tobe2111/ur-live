# 🏪 매장 상품 픽업 공구 — 설계 판정 (조사 전용, 코드 0)

> **작성**: 2026-07-28 · **브랜치** `claude/store-pickup-group-buy-design-nb800g` · **산출물**: 이 문서 1건
> **범위**: 조사·판정만. **코드 작성 없음.** 구현으로 넘어갈 때는 별도 게이트(기본 false) + draft PR.
> **경계 준수**: 머니 경로 무접촉 · 라이브 무접촉 · 방배 flip/온보딩과 경로·브랜치 분리 · PR #496/#514/#523(전부 머지됨) 불변식 존중.

## 0. 모델 정의 (대표 지시 그대로)

유어딜 매장이 **자기 상품(물리 재화)** 을 공구로 팔고, 소비자가 **그 매장에서 픽업**한다.
소싱·배송·재고는 전부 매장 몫. 유어딜이 제공하는 것은 **판(노출) · 정산 · 픽업확인** 셋뿐.

이 정의에서 유어딜이 새로 감당해야 하는 것은 **"물리 재화의 인도(引渡)를 시스템이 확인하는 것"** 하나다.
나머지(노출·결제·정산)는 이미 이용권 레일이 하고 있다. 아래 판정은 전부 그 한 문장에서 갈린다.

---

## 1. 판정 요약표

| # | 질문 | 판정 | 한 줄 근거 |
|---|---|---|---|
| 1 | `SHOPPING_TAB_HIDDEN` 뒤 일반상품 기능 재사용 가능? | **부분 재사용(된다) — 단 결제/정산 레일은 재사용 불가** | 재고·상품등록·주문라인·환불은 종류 무관 공용. 배송·장바구니·`standard_checkout` 은 픽업에 무의미하고, 정산 레일이 갈린다 |
| 2 | `gb_mode` 를 물리 상품에 얹으면? | **안 된다 (그대로는)** — 최소 변경은 §3 | 코드 게이트 3곳이 `isVoucherCategory` 로 물리 상품을 막고, 그걸 풀어도 gb 세션에 **재고·마감후 판매정지** 개념이 없다 |
| 3 | `voucher_visits` 를 픽업 확인으로 그대로? | **최소 변경으로 된다** | 스키마 변경 0(`path` 가 TEXT). 단 `self` 경로 차단 + #523 매칭 집계 오염 차단 2개가 필수 |
| 4a | 주문 마감일 | **된다 (기존 커버)** | `products.group_buy_deadline` + `/join` 마감 400 이미 존재 |
| 4b | 픽업일 | **안 된다 (개념 부재)** — 최소 변경은 `appointment_bookings` 재사용 | 이용권엔 "언제 오는가"가 없다. 예약 테이블은 이미 2개 있고 3번째를 만들면 안 된다 |
| 4c | 한정 수량 | **된다 (기존 커버, 단 데이터 신뢰도 주의)** | `products.stock` 원자 CAS 가 오버셀을 이미 막는다. 기존 이용권 행의 stock 값은 신뢰 불가 |
| 4d | 미수령 처리 | **안 된다 — 가장 큰 빈 곳. 최소 변경 없음(정책 결정 선행)** | 현행 만료 정책이 **100% 자동 환불**이라, 실물을 소싱한 매장이 전액 손실을 진다 |
| 5 | 5% 구조 + promo 레일 성립? | **성립한다 (새 요율 로직 불필요)** | `fee-resolver` 가 이미 `voucher`/`shopping` 을 **같은 요율**로 처리. 갈리는 건 요율이 아니라 **적립 시점·계정** |

**한 줄 결론**: 픽업 공구는 *쇼핑의 재오픈*이 아니라 **이용권 레일 위의 새 하위종(sub-kind)** 이다.
`stay_voucher` → `/stays/:id` 가 이미 만든 선례와 같은 모양이며, 그 선례를 따르면 막히는 것의 대부분이 사라진다.
남는 진짜 문제는 **미수령(§4d)** 하나이고, 그건 코드가 아니라 **대표 정책 결정**이 먼저다.

---

## 2. 질문 1 — `SHOPPING_TAB_HIDDEN` 뒤 일반상품 기능 재사용

### 2.1 무엇이 숨겨져 있나 (사실 확인)

`SHOPPING_TAB_HIDDEN = true` (`src/shared/feature-flags.ts:17`) 가 숨기는 것은 **표면뿐이고 가역**이다:

| 숨김 대상 | 파일 |
|---|---|
| 하단바 쇼핑 탭 | `src/components/main/BottomNav.tsx:194` |
| PC 상단/사이드 쇼핑 | `DesktopTopNav.tsx:66,76` · `DesktopLiveSidebar.tsx:103` |
| `/vouchers` 의 쇼핑 탭 + `ShoppingGrid` 섹션 | `src/pages/VouchersPage.tsx:730, 1029` |

`/browse` 라우트·prefetch·`ShoppingGrid` 컴포넌트·`standard_checkout` 흐름은 **전부 코드에 살아 있다**.
즉 "기능이 삭제된 게 아니라 문이 닫혀 있다."

### 2.2 재사용 가능 — ✅

종류(kind)에 의존하지 않는 부품들. 픽업 공구가 그대로 쓴다.

- **재고 원자 예약**: `products.stock` + `UPDATE ... WHERE id=? AND stock >= ?` (`group-buy.routes.ts:259`, 카드경로 `:1211`). BUG #26 fix 로 오버셀이 구조적으로 차단돼 있고, 취소 시 복원(`group-buy-voucher.routes.ts:497`)까지 대칭이다.
- **상품 등록/상세 필드**: 이미지·상세설명·`original_price`·`region_si/gu`·`restaurant_*`(매장 좌표/주소/전화) — 픽업 장소 표기에 그대로 쓸 수 있다.
- **주문 라인**: `orders` + `order_items` 는 종류 공용.
- **결제 승인**: Toss `confirmTossPayment` SSOT(잠금) — **호출만** 하면 되고 helper 수정 불필요.
- **환불**: `refundOrderFully` / `returns.routes` — 종류 무관.
- **리뷰**: `product_reviews` 종류 무관.

### 2.3 재사용 **불가** — ❌ (여기가 판정의 핵심)

**(a) 배송 일체** — 픽업엔 의미가 없다.
배송지(`shipping_address`)·송장·`base_shipping_fee`/`shipping_fee`·`tracker-delivery.ts` 전부 사용 안 함.
다만 주문 상태머신은 이미 픽업을 알고 있다 — `state-machine.ts:26` 이 *"교환권·매장픽업·외부 송장 등 SHIPPING 단계가 없는 케이스"* 를 위해 `PAID → DELIVERED` 전진 건너뛰기를 명시 허용한다. **상태머신은 변경 불필요.**

**(b) 장바구니 / `standard_checkout`** — 구조적으로 안 맞는다.
장바구니는 여러 셀러 상품을 한 주문으로 묶는다. 픽업은 "이 매장에 이 날 간다"가 주문의 본질이라, 서로 다른 매장 상품이 한 주문에 섞이면 픽업 확인 단위가 깨진다. 픽업은 이용권과 같은 **단품 즉시결제**여야 한다.

**(c) `/browse` 카탈로그 노출** — CI 가 막는다.
`check-dongnedeal-separation.mjs` 의 R1~R4 가 **배송형(`general`) 이 동네딜 표면에 유입되는 것을 차단**한다(2026-07-02 대표 확정, 유령 general 데모 사고 후 신설). 픽업 상품을 `general` 카테고리로 만들면 동네딜 피드·수기 폼·데모 시드 어디에도 못 넣는다.
→ **픽업은 `general` 이 되면 안 된다.** 이것이 §3 의 최소 변경 방향을 결정한다.

**(d) 정산 레일** — 가장 조용하지만 가장 중요한 불가 사유.
쇼핑 주문은 `creditSellerOrderToLedger`(`order-ledger-credit.ts`)가 **결제 시점**에 `seller:{id}` 로 크레딧한다. 그런데 이 함수는
- 아직 **게이트 OFF**(`SHOPPING_LEDGER_ENABLED`) 이고 **staging 실결제 미검증**이며,
- 스스로 `p.category IN VOUCHER_CATEGORIES` 이면 **skip** 한다(`:56~66`).

픽업은 "결제했지만 아직 안 받아간" 구간이 존재하므로 **결제 시점 크레딧이 틀렸다**(받아가기 전에 매장 채권이 확정되면 미수령 환불과 충돌). 픽업의 정산 트리거는 **픽업 확인 시점**이고, 그건 이용권 레일(`recordVoucherUsedLedger`)의 모양이다. §6 참조.

**(e) 상속하면 안 되는 부채**: `docs/AUDIT_INVARIANTS.md` 에 *"결제 셀프취소 🔴 3건 (쇼핑 숨김 gated, latent) — 쇼핑 재오픈 전 fix 필요"* 가 등록돼 있다. 픽업이 쇼핑 결제 흐름을 타면 **이 미해결 부채를 그대로 물려받는다.** 이용권 흐름은 해당 없음.

### 2.4 판정

> **부분 재사용(된다). 어디까지 = 재고·상품필드·주문라인·결제승인·환불·리뷰까지.**
> **배송·장바구니·`/browse` 노출·쇼핑 정산 레일은 재사용 불가.**
> 픽업 공구는 새 개념이지만 **새 서비스는 아니다** — 이용권의 하위종이다.
> `SHOPPING_TAB_HIDDEN` 을 되돌릴 이유는 이 작업에 **없다**(플래그 무접촉).

---

## 3. 질문 2 — `gb_mode` 를 물리 상품에 얹을 때 깨지는 가정

### 3.0 먼저 짚을 사실 — gb 엔진은 아직 *가격을 적용하지 않는다*

이걸 먼저 말해야 뒤가 오해되지 않는다. `resolveGbPricing`(`src/shared/gb-session.ts:141`) 의 소비처를 전수 확인한 결과:

| 소비처 | 하는 일 |
|---|---|
| `gb-marketplace.routes.ts:69,132` | 인플루언서 **탐색 목록 표시** |
| `gb-cockpit.routes.ts` | 어드민 **설정 저장/조회** |
| `seller-orders.routes.ts:1310` | 매장 **세션 저장/조회** |

**소비자 구매 경로(`/join`·`/confirm-toss`·`payment.routes /confirm`)에는 한 곳도 배선돼 있지 않다.**
`seller-orders.routes.ts:1277` 주석이 이를 명시한다 — *"실제 소비자가/커미션 authoritative 적용은 owner-funding 검증 후 별도 슬라이스 — 여기선 상태 저장만."*
`CURRENT_WORK.md:1030` 의 "⏭️ 남은 것"도 같은 말이다.

⇒ **"gb_mode 를 물리 상품에 얹으면 깨진다"의 절반은 물리성 탓이 아니라 엔진 미완성 탓이다.**
이용권에 얹어도 아직 가격이 안 붙는다. 이 사실을 모르고 "픽업만 배선하면 된다"고 잡으면 범위를 크게 오산하게 된다.

### 3.1 물리 상품 때문에 **실제로** 깨지는 가정

#### G1. 카테고리 게이트 3곳 — 물리 상품은 열지도, 보이지도, 사지도 못한다

| 게이트 | 위치 | 결과 |
|---|---|---|
| 매장이 공구 **열기** | `seller-orders.routes.ts:1299` — `if (!isVoucherCategory(product.category)) return '공구는 이용권 상품에만 열 수 있습니다'` | 400 |
| 인플루언서 **탐색** | `gb-marketplace.routes.ts:65` — `.filter(p => isVoucherCategory(p.category))` | 목록에서 사라짐 |
| 소비자 **구매** | `group-buy.routes.ts:222` — `SELECT ... WHERE ... (category IN (voucher 7종) OR deal_only = 1)` | 404 |

세 곳 모두 `isVoucherCategory` 를 신호로 쓴다. **물리 상품을 voucher 카테고리 밖에 두는 순간 gb 는 통째로 작동하지 않는다.**

#### G2. 재고와 gb `target` 이 서로를 모른다

`GbSession.target` 의 주석이 스스로 못박는다 — `/** 목표 수량(선택, 표시용). */` (`gb-session.ts:22`).
`products.stock` 은 원자 CAS 로 정확히 지켜지지만, gb 세션은 stock 을 읽지도 쓰지도 않는다.
이용권에선 무해하다(발급이 무한이라 재고가 실질적 제약이 아니었다). **물리는 한정 수량이 본질**이라, "표시용 목표"와 "실재고"가 따로 노는 상태로는 소비자에게 "몇 개 남았는지"를 정직하게 말할 수 없다.

#### G3. "끝나면 상시가 자동 복귀" 가 원-샷 공구를 표현하지 못한다

gb 의 설계 전제는 *"이용권이 상시 판매되다가 공구가 켜지면 특가가 얹히고, 끝나면 상시가로 복귀"* 다(`gb-session.ts:4~6`).
그래서 `validateGbSession` 이 `s.price < listPrice` 를 **강제**한다(`:166`).

매장이 이번 공구를 위해서만 소싱하는 물리 상품에는 **상시가가 존재하지 않는다.** 상시 판매를 안 하기 때문이다.
현재 모델로 이걸 표현하려면 가짜 상시가를 지어내야 하고, 그러면 마감 후 그 가짜 가격으로 계속 팔린다(→ G4).

#### G4. `ended` 는 가격만 되돌리고 **판매를 멈추지 않는다**

`resolveGbStatus` 가 `ended` 를 반환하면 `resolveGbPricing` 은 `effectivePrice = listPrice` 로 되돌린다. 그뿐이다.
이용권은 마감 후에도 상시가로 계속 팔면 되니 옳다.
**물리는 마감이 곧 발주 확정선**이다. 마감 후 한 건이 더 들어오면 매장은 없는 물건을 팔게 된다.
현재 마감 차단은 gb 가 아니라 별개 컬럼(`products.group_buy_deadline`, `group-buy.routes.ts:184`)이 하고 있고, **gb `deadline` 과 `group_buy_deadline` 은 서로 모르는 두 개의 마감일이다** — 이 SSOT 충돌 자체가 물리 상품에서 사고가 된다.

#### G5. `linkOnly=false`(기본) 카니발라이제이션이 한정 수량과 충돌

기본값은 *"공구가로 통일 — 누구도 더 비싸게 안 삼"*(`gb-session.ts:29`). 이용권은 재고 무한이라 이 관대함이 공짜다.
물리는 **한정 수량이라 관대함에 비용이 붙는다** — 인플루언서 링크를 타지 않은 유입이 재고를 먼저 먹으면, 공구를 열어준 인플루언서에게 돌아갈 물량이 사라진다. 정책 판단이 필요한 지점이지 버그는 아니다.

### 3.2 판정 + 최소 변경

> **판정: 안 된다 (그대로는).** G1 이 세 지점에서 하드 차단하고, 그걸 풀어도 G2~G4 가 남는다.

**최소 변경(권장 방향)** — 새 카테고리를 만들지 말고, **`etc_voucher` 안의 하위 플래그**로 둔다.
`product_supply_meta` 에 `pickup_mode='1'` 같은 K-V 를 얹는다(컬럼 예산 동결 준수 — products 97/100, sellers 100/100).

이렇게 하면:

| 문제 | 해소 여부 |
|---|---|
| G1 (카테고리 게이트 3곳) | ✅ **자동 해소** — `isVoucherCategory('etc_voucher')` 가 true |
| §2.3(c) 동네딜 분리 가드 R1~R4 | ✅ **자동 해소** — `general` 이 아니므로 위반 아님 |
| §6 정산 레일 선택 | ✅ **자동 해소** — voucher 레일에 그대로 올라탐 |
| G2 (재고↔target) | ❌ 남음 — gb 세션이 `products.stock` 을 읽게 하거나, `target` 을 재고로 승격 |
| G3 (상시가 부재) | ❌ 남음 — `validateGbSession` 의 `price < listPrice` 강제를 픽업에서 완화해야 함 |
| G4 (마감 후 판매정지) | ❌ 남음 — gb `deadline` 과 `group_buy_deadline` SSOT 통일 + 마감 시 판매 차단 |
| G5 (카니발라이제이션) | 🟡 정책 — 픽업 기본값을 `linkOnly=true` 로 둘지 대표 결정 |

**선례 근거**: `stay_voucher` 는 이미 이 모양이다. voucher 카테고리 안에 있으면서 자기 예약 테이블(`stay_bookings`)과 자기 상세 페이지(`/stays/:id`)를 갖는다(`product-flow.ts:118`). 픽업은 **그 선례의 두 번째 사례**이지 새 축이 아니다.

> ⚠️ **애매한 부분(정직하게)**: `etc_voucher` 로 두면 기존 "기타 이용권" 상품과 한 카테고리를 공유한다. 소비자 칩·필터에서 물리 픽업과 무형 이용권이 섞여 보인다. 이걸 UI 에서 어떻게 가를지는 이 문서가 정하지 않았다 — 노출 설계 시 결정 필요.

---

## 4. 질문 3 — `voucher_visits` 를 픽업 확인으로 쓸 수 있나

### 4.1 그대로 맞는 부분

`voucher_visits`(`src/worker/utils/voucher-visit.ts`)는 PR #514 2단계 산출물이고, 구조가 픽업과 잘 맞는다:

- **`voucher_id` PK → 멱등**(`INSERT OR IGNORE`) — 한 이용권 1회. 픽업도 "1 수령권 = 1 수령"이라 정합.
- **`seller_id`(어느 매장) + `user_id`(누가) + `created_at`(언제)** — 픽업 확인이 필요로 하는 3요소와 정확히 일치.
- **`amount`** — 결제액. 픽업도 같은 의미.
- **`path`** 가 이미 TEXT 이고 3값(`pin`/`seller_scan`/`self`)을 담는다 → **`'pickup'` 추가에 스키마 변경 0**.
- **오스캔 정정** `removeVoucherVisit`(`:67`) — 잘못 찍은 픽업 되돌리기가 이미 있다.
- 사용처리 CAS(`unused → used`)가 이미 원자적(`group-buy-voucher.routes.ts:59, 350, 655`) — 이중 수령 확인 차단이 공짜.

### 4.2 그대로 쓰면 안 되는 부분 (2건)

**P1. `self` 경로 — 픽업엔 위험하다.**
`path='self'` 는 소비자가 자기 폰에서 스스로 '사용완료'를 누르는 경로다. 무형 이용권은 그래도 된다(매장에서 화면을 보여주는 절차가 실물 통제를 대신한다).
**물리 재화의 수령 확인을 구매자가 혼자 누를 수 있으면** 두 방향 모두 깨진다 — 받기 전에 누르면 매장이 인도 근거를 잃고, 동시에 §6 의 정산 트리거가 앞당겨져 **물건이 나가기 전에 매장 채권이 확정**된다.

**P2. #523 매칭 엔진 지표 오염.**
`matching.ts:9` 가 이 테이블의 의미를 못박아 두었다 — *"`voucher_visits` : 이용권 사용(=매장 방문) 이벤트"*. 그리고 `:237, :404, :492` 에서 재방문/전환 지표의 근거로 집계한다.
픽업은 **체류 없는 수령**이라 "방문"으로서의 가치가 다르다. 구분 없이 섞으면 인플루언서 매칭 점수가 조용히 왜곡된다 — 에러도 로그도 안 남는 종류의 오염이다.

### 4.3 판정 + 최소 변경

> **판정: 최소 변경으로 쓸 수 있다. 새 테이블 불필요.**

**최소 변경 3건 (전부 additive, 스키마 변경 0):**

1. `VoucherVisitInput.path` 에 `'pickup'` 추가 (`voucher-visit.ts:41` — TS 유니온 1줄. 테이블은 TEXT 라 마이그레이션 없음)
2. 픽업 상품은 **`self` 사용처리 경로를 차단** — `seller_scan`(매장이 QR 스캔) 또는 `pin`(매장이 PIN 확인)만 허용
3. `matching.ts` 의 집계 3곳에서 `path` 를 구분 (픽업 제외 또는 별도 가중치) — #523 불변식 보호

> ⚠️ **애매한 부분**: 픽업은 "예약 → 수령"이라 **예약 시점과 수령 시점이 다르다**. `voucher_visits` 는 수령(1회)만 기록한다. 예약 자체를 남길 곳은 §5b 의 `appointment_bookings` 이고, 두 테이블이 같은 주문을 각자 기록하게 된다. 이 이중 기록이 허용 가능한지는 검토되지 않았다.

---

## 5. 질문 4 — 이용권에 없고 상품에만 있는 개념

### 5a. 주문 마감일 — **된다 (기존 커버)**

**커버되는 범위**: `products.group_buy_deadline` 컬럼이 이미 있고(baseline 97개 중 존재), 구매 경로가 이미 검사한다 —
`group-buy.routes.ts:184` 딜 경로 / `:240` 카드 경로 모두 `new Date(deadline) < new Date()` 면 400.
`group-buy-deadline-push.ts` cron 으로 마감 임박 푸시도 이미 있다.

**빈 곳 2개**:
- **마감 = 주문 차단뿐**이고, 마감 후 **자동 상태 전이가 없다.** 물리 공구는 마감 순간이 "매장 발주 확정" 이벤트여야 하는데 그 훅이 없다.
- **마감일이 두 개다** — `products.group_buy_deadline`(구매 차단이 실제로 읽는 것) vs `GbSession.deadline`(gb 엔진이 읽는 것). 서로 모른다(§3.1 G4). 물리에서는 이 불일치가 오버셀로 직결된다.

### 5b. 픽업일 — **안 된다 (개념 부재). 최소 변경 = `appointment_bookings` 재사용**

이용권엔 "언제 오는가"가 없다. 유효기간(`voucher_expiry`) 안에 아무 때나 가면 된다.
픽업은 **매장이 그 날 그 물건을 준비해야 하므로 날짜가 계약의 일부**다. 완전히 새 개념이다.

**단, 새로 만들 필요는 없다.** `appointment_bookings`(`src/features/appointments/api/appointments.routes.ts`)가 필요한 것을 이미 다 갖고 있다:

| 필요 | 이미 있음 |
|---|---|
| 주문과 연결 | `order_id` 컬럼 |
| 날짜 + 시간 | `booking_date` + `start_time`/`end_time` |
| 매장 귀속 | `seller_id` |
| 정원(슬롯당 capacity) | `idx_appointments_slot` + application capacity check |
| 중복 예약 차단 | `idx_appointments_user_unique` (UNIQUE, status='confirmed') |
| 매장 완료 처리 | `PATCH /api/seller/appointments/:id/complete` |
| 노쇼 감지 | `appointment-noshow-alert.ts` cron (시작+30분, `noshow_alert_sent_at` 중복 0) |
| 상태값 | `confirmed`/`completed`/`no_show`/`cancelled` |

픽업일 = **슬롯 1개짜리 예약**이다.

> 🚫 **하지 말 것**: 세 번째 예약 테이블을 만드는 것. 이미 `appointment_bookings`(시간 슬롯)와 `stay_bookings`(숙박 야간)가 있다. 세 번째를 만들면 노쇼·정원·취소 로직이 3벌로 갈라진다.

**빈 곳 2개**:
- **UX 순서가 다르다.** 현행 appointment 는 *결제 → 별도 예약 단계*(`appointments.routes.ts:1~9` 흐름)다. 픽업은 "공구 참여할 때 픽업일을 함께 고른다"가 자연스럽다. 이 순서 차이는 코드가 아니라 화면 설계 문제.
- **노쇼가 알림만 하고 상태를 안 바꾼다** — cron 주석이 명시한다: *"알림은 안내일 뿐, 자동 noshow 상태 전환 X (사람이 결정)"* (`appointment-noshow-alert.ts:18`). 이 정책은 무형 서비스엔 옳지만, 물리 재화의 미수령(§5d)에는 그대로 못 쓴다.

### 5c. 한정 수량 — **된다 (기존 커버, 단 데이터 신뢰도 주의)**

**커버되는 범위**: `products.stock` 의 원자 예약이 **이미 이상적으로 구현돼 있다.**
`UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?` (`group-buy.routes.ts:259`, 카드경로 `:1211`) — BUG #26 fix. 동시 참여자 오버셀이 구조적으로 불가능하다.
조기 return 시 복원(`:270, :371, :405`), 셀프취소 시 복원(`group-buy-voucher.routes.ts:497`)까지 대칭이 맞춰져 있다. `reserved_stock`·`stock_version`·`min_stock_alert` 컬럼도 이미 존재한다.

**빈 곳 2개**:
- **기존 이용권 행의 `stock` 값을 신뢰할 수 없다.** 무형 이용권은 재고가 실질 제약이 아니었으므로 운영상 임의값이 들어 있을 수 있다. 픽업 상품은 **등록 시 stock 을 필수·정확 입력**으로 강제해야 한다.
- **소비자에게 보여줄 "N개 남음"의 출처가 미정** — `stock`(실재고) vs `group_buy_target - group_buy_current`(참여 진척) vs gb `target`(표시용). 셋이 공존한다(§3.1 G2).

### 5d. 미수령 처리 — **안 된다. 최소 변경 없음 (정책 결정이 먼저)**

**이것이 이 조사에서 발견한 가장 큰 빈 곳이다.**

현행 만료 정책은 `auto-settlement.ts:222` 에 박혀 있다:

> `🛡️ 2026-05-30 낙전(breakage) 정책 = "만료 시 고객 환불" (즉시판매 모델 정합).`

`expires_at` 이 지난 `unused` 이용권을 CAS 로 `expired` 전이시킨 뒤 **결제액 전액을 자동 환불**한다(딜: `:238` / 카드: `tossCancelPayment` `:277`).
`voucher-expire.ts:6` 주석이 정책 근거를 밝힌다 — *"만료 시엔 auto-settlement 가 100% 자동 환불 — 표준약관 90% 환급 기준을 상회하는 정책"*.

**무형 이용권에는 옳다.** 손님이 안 오면 매장은 원가를 쓰지 않았다.
**물리 픽업에는 성립하지 않는다.** 매장은 이미 소싱했고, 미수령 재화는 재고 손실 또는 폐기(신선식품이면 확정 폐기)다.
현행 정책을 그대로 적용하면 **"매장이 물건을 사서 준비했는데 손님이 안 오면 매장이 전액 손실"** 이 되고, 이건 대표 지시의 *"소싱·재고는 매장 몫"* 과 정반대 방향으로 리스크를 키운다.

**연쇄로 걸리는 것 2개:**
- **7일 청약철회 무조건 취소**: `group-buy-voucher.routes.ts:486` 이 `created_at > -7 days` 면 이유 불문 셀프취소 + 전액 환불을 허용한다. 픽업일 전날 취소가 자유롭다. 전자상거래법상 **주문제작·신선식품 등은 청약철회 제외**가 가능한 영역인데 현행 코드엔 그 분기가 없다.
- **유효기간 가드**: `group-buy.routes.ts:249` 가 `voucher_expiry <= group_buy_deadline` 이면 발급을 400 으로 막는다. 픽업일을 유효기간 개념에 매핑할 때 이 가드와 충돌하지 않는지 확인 필요.

**왜 "최소 변경"을 적지 않는가**: 여기서 필요한 것은 코드가 아니라 **누가 손실을 지는가**의 결정이다. 대표 결정 없이 코드를 제안하면 그 제안이 곧 정책이 된다. 선택지만 적는다:

| 선택지 | 매장 | 소비자 | 비고 |
|---|---|---|---|
| (a) 현행 유지 — 미수령 전액 환불 | 전손 | 무손실 | 매장이 픽업 공구를 안 열 이유가 됨 |
| (b) 픽업 마감 후 환불 불가(전액 매장 귀속) | 무손실 | 전손 | 청약철회 규정 검토 필수 |
| (c) 부분 환불(예: 마감 전 100% / 픽업일 경과 0%) | 부분 | 부분 | 표준약관·전상법 검토 필요 |
| (d) 픽업 기한 연장 후 소멸 | 지연 | 유예 | 신선식품엔 무의미 |

> ⚠️ **정직하게 애매한 것**: (b)(c) 는 법무 검토 없이 판단할 수 없다. 이 문서는 법적 판단을 하지 않는다.

---

## 6. 질문 5 — 정산: 5% 구조 + promo 레일 성립하는가

### 6.1 성립한다 — 요율 축

`fee-resolver.ts` 는 **이미 상품 종류를 알고 있고, 요율은 같게 둔다.**

```
export type ProductKind = 'voucher' | 'shopping';
/** 이용권 / 쇼핑 (요율은 동일하나 검증/표시용). */   ← fee-resolver.ts:71
```

요율을 가르는 유일한 축은 **소유(ownership)** 다 — `1P`(유어딜 직판) = 0% / `3P`(셀러) = 5% (`:105~112`).
**매장이 자기 상품을 파는 것 = 3P = 5%.** 새 요율 로직이 필요 없다. 픽업이라는 사실은 요율에 아무 영향을 주지 않는다.

`DEFAULT_FEE_RATES` = `{ platformPct: 5, agencyPct: 1, agencyTermMonths: 24 }` 그대로 적용된다.

### 6.2 성립한다 — promo 레일

`PromoSpec` 은 `{ promoterId, amount?, pct? }` 뿐이고(`fee-resolver.ts:53~60`) **상품 종류를 보지 않는다.**
owner-funding 도 마찬가지다 — `owner-promo.ts` 의 `debitOwnerPromoForOrder` 는 **주문 단위**로 동작하고 카테고리를 읽지 않는다. `promo_funding_source==='owner'` 게이트 하나뿐이다.

즉 2026-07-08 대표 확정 원칙 — *"유어딜 5% 는 어떤 커미션에도 안 쓴다, 성장 커미션은 전부 매장 promo 재원"* — 이 픽업에도 **구조 변경 없이 그대로 적용된다.**
PR #496 이 머지돼 있으므로 파일럿 스코프(`flip_pilot_seller_ids`)도 그대로 쓸 수 있다.

### 6.3 성립하지 **않는** 것 — 요율이 아니라 **적립 시점·계정**

레일이 둘이고, 픽업은 어느 쪽에도 자동으로 안 들어간다.

| | 이용권 레일 | 쇼핑 레일 |
|---|---|---|
| 함수 | `recordVoucherUsedLedger` (`ledger.ts:114`) | `creditSellerOrderToLedger` (`order-ledger-credit.ts`) |
| **적립 시점** | **사용(방문) 시점** | **결제 시점** |
| **크레딧 계정** | `merchant:{seller_id}` | `seller:{seller_id}` |
| 지급 | `auto-settlement` 주간 정산(월~일 → 차주 목) | `payouts-generate` 주간 payout |
| 상태 | 라이브 | **게이트 OFF · staging 미검증**(`SHOPPING_LEDGER_ENABLED`) |

**픽업의 올바른 트리거는 "픽업 확인 시점"** 이다 — 결제 시점에 매장 채권을 확정하면 §5d 의 미수령 환불과 정면 충돌한다(환불해야 하는데 이미 정산 대상에 들어감).
따라서 **이용권 레일(`recordVoucherUsedLedger`)에 올라타는 것이 맞다.** §3.2 의 "`etc_voucher` 하위 플래그" 방향을 택하면 이건 **자동으로 해결**된다 — 별도 배선이 필요 없다.

지급 측은 문제없다: `payouts-generate.ts:46` 이 `merchant:%`·`seller:%` 두 접두어를 모두 읽는다.

**단, 주의 1건**: `recordVoucherUsedLedger` 는 `platform_fee_pct`/`seller_commission_pct` 를 읽어 3분할(merchant/seller/platform)하는 **fee-resolver 와 별개 경로**다. fee-resolver 는 아직 그림자(`FEE_RESOLVER_ENABLED`, 2026-06-27 [UNLOCK]). 픽업을 만들면서 fee-resolver 를 authoritative 로 승격시키려는 시도는 **이 작업 범위 밖**이고 별도 flip 세션이어야 한다.

### 6.4 판정

> **성립한다. 새 요율 로직 불필요.**
> 5% 는 `ownership=3P` 로 자동, promo 는 종류 무관, owner-funding 도 종류 무관.
> 갈리는 것은 **요율이 아니라 적립 시점·계정**이고, 픽업을 voucher 하위종으로 두면 그것도 자동 해결된다.
> **불변식 #44("순수취 == 정확히 5%")는 8월 flip 에서 신설 예정이므로, 픽업은 그 flip 뒤에 놓여야 한다** — 앞서 라이브되면 안 된다.

---

## 7. 경계 준수 확인

| 경계 | 준수 방법 |
|---|---|
| **머니 경로 무접촉** | 이 문서는 조사만. 구현 시에도 voucher 레일 **재사용**이라 `recordVoucherUsedLedger`·`fee-resolver`·`order-commissions` **수정 0**. `platform:revenue` = 5% 전액 불변 |
| **라이브 무접촉** | 잠금 파일(`payment.routes.ts`·`group-buy-public.routes.ts`·`toss-gateway.ts`) 무접촉 설계. 픽업은 `product_supply_meta` K-V + 별도 라우트 |
| **방배 flip·온보딩과 분리** | 별도 게이트 `PICKUP_GB_ENABLED`(클라, 기본 false) + 별도 `platform_settings` 키. `gb_engine_enabled`·`promo_funding_source`·`commission_budget_enabled` 와 **키 공유 금지** |
| **브랜치 분리** | `claude/store-pickup-group-buy-design-*` 단독 |
| **#496 (promo flip)** | 충돌 없음 — 재원 구조를 그대로 상속. 오히려 **#496 flip 완료가 선행 조건** |
| **#514 (voucher_visits)** | §4.3 최소 변경 3건이 전부 additive. `user_id` 조인키 정규화 그대로 준수 |
| **#523 (매칭)** | §4.3-③ 이 지표 오염을 막는 조건. 이걸 빠뜨리면 #523 불변식 훼손 |
| **컬럼 예산** | products 97/100 · sellers 100/100(한도 도달) → **ALTER 금지**. `product_supply_meta` K-V 사용 |
| **동네딜 분리 가드** | `etc_voucher` 방향이면 R1~R4 위반 0 |

---

## 8. 대표 결정 대기 (구현 착수 전 필요)

> 아래 4건 중 **D1 은 블로킹**이다. 나머지 없이도 설계는 진행 가능하나, D1 없이 만들면 매장이 안 쓰는 기능이 된다.

| # | 결정 | 왜 필요 | 기본 제안 |
|---|---|---|---|
| **D1** | **미수령 시 누가 손실을 지는가** (§5d (a)~(d)) | 현행 100% 자동 환불이 매장 전손을 만든다. 이걸 안 정하면 매장이 픽업 공구를 열 이유가 없다 | 없음 — **법무 검토 필요**. 이 문서가 정하지 않는다 |
| D2 | 픽업 상품을 `etc_voucher` 하위 플래그로 둘 것인가 (§3.2) | 새 카테고리면 게이트 3곳 + 동네딜 가드를 전부 뚫어야 한다 | ✅ `etc_voucher` + `pickup_mode` K-V (`stay_voucher` 선례) |
| D3 | 마감 후 판매 정지를 어디서 강제할 것인가 (§3.1 G4) | 마감일이 두 개고 서로 모른다. 물리에선 오버셀 직결 | `products.group_buy_deadline` 을 SSOT 로 두고 gb `deadline` 을 파생으로 |
| D4 | 픽업 기본 `linkOnly` 값 (§3.1 G5) | 한정 수량에서 "공구가로 통일"은 인플루언서 물량을 잠식 | 픽업은 `linkOnly=true` 기본 제안(재검토 여지 있음) |

---

## 9. 다음 세션 첫 액션

1. **이 문서 §8 의 D1 을 대표에게 먼저 묻는다.** D1 미결이면 구현 착수 금지.
2. D2 가 `etc_voucher` 로 확정되면, 구현 순서는:
   `게이트 신설(false)` → `product_supply_meta pickup_* 스키마 확정` → `appointment_bookings 픽업 슬롯 재사용` → `voucher_visits path='pickup'` → `matching.ts 구분` → draft PR
3. **선행 조건 확인**: 8월 promo flip(#496 런북) 완료 + 불변식 #44 신설 여부. 그 전엔 픽업을 라이브에 켜지 않는다.

## 10. 이번 조사에서 정정한 오해 (다음 세션이 같은 오진 반복하지 말 것)

- ❌ *"gb 엔진은 이용권에 이미 작동 중이니 물리 상품만 붙이면 된다"* → **틀렸다.** `resolveGbPricing` 은 **소비자 구매 경로 어디에도 배선돼 있지 않다**(§3.0). 이용권조차 아직 gb 가격이 결제에 안 붙는다. 범위 산정 시 이걸 놓치면 크게 오산한다.
- ❌ *"픽업은 물리 상품이니 쇼핑(`standard_checkout`) 흐름을 쓰면 된다"* → **틀렸다.** 쇼핑 레일은 결제 시점에 정산을 확정해 미수령 환불과 충돌하고, 게이트 OFF·미검증이며, 셀프취소 부채 3건을 상속한다(§2.3 d·e).
- ❌ *"`voucher_visits` 는 그냥 쓰면 된다"* → 절반만 맞다. `self` 경로와 #523 매칭 오염 2건을 반드시 함께 처리해야 한다(§4.2).
- ❌ *"5% 정산이 물리 상품에선 다르게 계산될 것"* → **틀렸다.** `fee-resolver` 가 두 종류를 같은 요율로 이미 처리한다. 다른 건 요율이 아니라 **시점**이다(§6).
