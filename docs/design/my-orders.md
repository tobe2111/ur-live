# 주문 내역 / 주문 상세 리디자인 — 무신사(MUSINSA) 레퍼런스 기반

- **시안 받은 날**: 2026-06-18
- **출처**: 사용자가 공유한 무신사(musinsa.com) 스크린샷 2장 — ① 주문 내역 목록 ② 주문 상세 (`musinsa.com/order/offline-detail/...`)
- **대상 페이지**: `/my-orders` (`src/pages/MyOrdersPage.tsx` → `src/components/mypage/OrdersTab.tsx` → `src/pages/my-orders/OrderDetailModal.tsx`)
- **상태**: ✅ 구현 완료 (옵션 A — 종류 탭 + 종류별 카드). 상세 아래 "✅ 구현 완료" 참조.
- **사용자 명시 제외**: **바코드는 불필요** (무신사는 오프라인 매장 픽업용 바코드. 유어딜은 온라인/라이브 커머스라 해당 없음)

> ⚠️ 채팅 이미지는 세션 종료 시 사라지므로 아래에 시안을 **텍스트로 상세 박제**한다. PNG 를 보존하려면
> `docs/design/assets/my-orders-musinsa-list.png` / `my-orders-musinsa-detail.png` 로 수동 저장 권장
> (Claude Code 는 첨부 이미지를 직접 읽지만 디스크 저장은 사용자 수동).

---

## 주문내역 데이터 범위 (코드 확인 완료 2026-06-18)

**Q. 주문내역은 쇼핑 상품 / 교환권 / 공구권 모두 해당되나?** → **네, 셋 다 `orders` 테이블에 들어가고
`/my-orders` 쿼리에 종류 필터가 없어 모두 노출됩니다.** 단 중복/레이아웃 문제가 있어 시안 적용 시 핵심 고려사항.

| 종류 | orders 행 생성 경로 | /my-orders 노출 | 추가 페이지 |
|---|---|---|---|
| 쇼핑 상품 (배송) | `order.routes.ts` / `OrderRepository.create` | ✅ | — |
| 교환권 (meal/beauty/stay/… voucher) | `group-buy.routes.ts:404` `INSERT INTO orders` → `:519` `INSERT INTO vouchers(order_id,…)` | ✅ | `/my-vouchers` (코드+바코드/QR) |
| 공구권 (공동구매) | 위와 동일 경로 (공구도 voucher 발급 모델) | ✅ | `/my-vouchers` |
| 딜 충전 | point ledger (`user_points`) — orders 아님 | ❌ (제외) | — |

- 근거: `findByUserId` 는 `SELECT o.* FROM orders WHERE o.user_id = ?` (종류/카테고리 필터 없음, `order.repository.ts:271`).
- ⚠️ **중복 노출**: 교환권/공구권은 `/my-orders`(주문 행) **와** `/my-vouchers`(사용 가능 코드) 양쪽에 나타남.
- ⚠️ **레이아웃 부적합**: 현 `/my-orders` 카드는 *배송* 전제(배송지/송장/배송조회). 교환권/공구권 주문은 배송이 없어 빈 배송 박스 노출 → **종류별 카드 분기 필요**.
- → 무신사식 **종류 탭(전체/상품/교환권/공구)** + **종류별 카드**(상품=배송 / 교환권·공구=사용처·유효기간·바코드 진입)가 이 구조에 잘 맞음. 아래 "결정 필요 #1" 참조.

## 시안 ① — 주문 내역 목록 (list)

레이아웃 (위→아래):

1. **타이틀** "주문 내역" — 큰 굵은 글씨, 좌측 정렬 (현재 유어딜은 중앙 정렬 16px 작은 헤더)
2. **검색바** — full-width 둥근 입력창, placeholder `"상품명 / 브랜드명으로 검색하세요."` + 우측 돋보기 아이콘
3. **필터 탭** — **텍스트 + 하단 밑줄** 스타일 (pill 아님): `전체 · 온라인 주문 · 오프라인 구매 · 유즈드 · 상품권 · 티켓`
   - 활성 탭(`전체`) = 진한 검정 굵게 + 밑줄, 나머지 = 회색
   - ⚠️ 무신사 탭은 **주문 종류**(온라인/오프라인/유즈드/상품권/티켓) 기준. 유어딜 현재 탭은 **상태**(결제완료/배송중/…) 기준 → 아래 "결정 필요" 참조
4. **프로모 배너** (연파랑 bg, 라운드) — `"안 입는 옷 201,900원에 판매할 수 있어요. >"` (무신사 유즈드 리셀 CTA. 유어딜은 미적용 또는 다른 CTA 로 대체)
5. **날짜 그룹 헤더** — `25.12.01(월)` 굵게 좌측 + 우측에 `주문 상세 >` 링크 (날짜 = 주문 묶음 단위 그룹핑)
6. **주문 상품 카드** (날짜 그룹 안에 상품별로):
   - 상단 작은 회색 상태 라벨: `오프라인 구매 완료` (컬러 배지 아님, **은은한 텍스트**)
   - 본문 행: `[썸네일 64px 정사각] | 정보`
     - **브랜드명** 굵게: `무신사 스탠다드`
     - 상품명: `코튼 케이블 크루 넥 니트 [네이비]`
     - 옵션/수량 회색: `L / 1개`
     - 가격 굵게: `59,900원`
   - 아이템 아래 **full-width 회색 액션 행**: `무신사 스탠다드 서면점 >` (판매처/매장 바로가기)

핵심 인상: **흰 배경 + 넉넉한 여백 + 얇은 구분선 + 썸네일 중심**. 컬러 배지/박스 거의 없음, 상태는 작은 회색 텍스트.

## 시안 ② — 주문 상세 (detail)

레이아웃 (위→아래):

1. **타이틀** "주문 상세"
2. 날짜 `25.12.01(월)` 굵게
3. `구매 번호 10202512011500607` (회색)
4. `무신사 스탠다드 서면점 매장 정보` (파랑 링크)
5. ~~바코드~~ + ~~`바코드 공유` / `구매 영수증` 버튼~~ → **유어딜 제외** (온라인은 영수증만 선택적으로)
6. **섹션: `구매 상품 N개`**
   - 상태 라벨 `오프라인 구매 완료` (회색)
   - `[썸네일] | 브랜드 / 상품명 / 옵션(L) / 가격(59,900원)`
   - 썸네일 없으면 회색 placeholder 박스 (시안 2번째 아이템)
7. **섹션: `결제 정보`** (label 좌 / value 우 정렬)
   - `상품 금액 ........ 60,000원`
   - `할인 금액 ........ 0원`
   - `결제 금액 ........ 60,000원` ← **굵게**
   - `결제 수단 ........ 삼성마스타카드(일시불)`
8. **섹션: `이번 주문으로 받은 혜택 ⓘ`**
   - `추가 적립 ........ 290원`
   - `받은 총 혜택 ...... 290원` ← 굵게/파랑
9. **버튼: `구매 내역 삭제`** (full-width 아웃라인)

핵심 인상: **섹션 헤더로 명확히 구분 + 결제 내역을 정직하게 라인 분해**(상품금액/할인/결제금액/수단). 군더더기 없음.

---

## 현재 유어딜 vs 무신사 시안 — 차이점

| 영역 | 현재 유어딜 | 무신사 시안 | 조치 |
|---|---|---|---|
| 헤더 | 중앙 정렬 16px 작은 제목 + 뒤로가기 | 좌측 큰 타이틀 | 좌측 large title 로 (쇼핑 표준 유지) |
| 검색 | 없음 | 상단 검색바 (상품/브랜드) | **추가** — 주문 많은 유저 필수 |
| 필터 | pill 6개 (상태 기준) | 텍스트+밑줄 (종류 기준) | 스타일=밑줄로, 기준=아래 결정 필요 |
| 썸네일 | **없음** (텍스트만) | 64px 썸네일 | **추가** (최대 임팩트) |
| 상태 표기 | 큰 컬러 배지 | 작은 회색 텍스트 라벨 | 은은한 라벨로 전환(배지는 배송중 등만) |
| 상품 가격 | **"0원" 으로 깨짐** (버그) | 정상 표시 | 데이터 버그 수정(아래) |
| 플로우 스텝퍼 | 모든 카드에 항상 노출 → 카드 길어짐 | 없음 (상태 텍스트로 충분) | 배송중/준비중일 때만 or 제거 |
| 배송지 박스 | 카드마다 풀박스 | 없음(상세로) | 카드에서 제거, 송장/배송조회만 |
| 날짜 그룹 | 없음 | `YY.MM.DD(요일)` 그룹 헤더 | **추가** |
| 판매처 행 | 없음 | `브랜드 매장 >` 행 | 판매자 링크/문의 행으로 |
| 상세 결제 | 배송비 **3,000원 하드코딩** | 상품/할인/결제/수단 분해 | 실데이터로 분해(아래) |
| 받은 혜택 | 없음 | 적립 혜택 섹션 | 유어딜 적립/딜 있으면 추가 |

---

## 🐛 디자인 이전에 고칠 데이터 정합 버그 (구현 시 동반 수정)

코드 감사에서 발견 — 현재 카드가 **틀린 값**을 보여주고 있어 시안 적용 전 선결.

1. **상품별 가격이 전부 "0원"으로 표시**
   - `OrdersTab.tsx:282` 가 `item.price_snapshot * quantity` 를 쓰는데, 목록 API(`order.repository.ts:235` `findItemsGrouped`)는 `unit_price`/`subtotal` 만 SELECT → `price_snapshot = undefined` → `formatNumber(NaN)` 이 `'0'` 으로 마스킹.
   - 수정: 카드에서 `unit_price`(또는 `subtotal`) 사용 or mapper 에 `price_snapshot` alias 추가.
2. **썸네일 소스 자체가 목록에 없음**
   - `order_items.product_image` 컬럼에 주문 시점 썸네일이 **이미 저장**돼 있음(`order.repository.ts:162,170`)인데 목록 쿼리 `findItemsGrouped` SELECT 절에 `product_image` 가 빠짐 (mapper 는 `product_thumbnail` 로 매핑하나 소스 부재).
   - 수정: `findItemsGrouped` SELECT 에 `product_image` 추가 (JOIN 불필요). 프론트는 `item.product_thumbnail` 읽고 `cfImage(...,64)` 로 렌더.
3. **상세 모달 배송비 하드코딩** — `OrderDetailModal.tsx:217` `'3,000원'` 고정 → `order.shipping_fee` 실값으로. 시안처럼 `상품금액/할인/결제금액/결제수단` 라인 분해.

---

## ❓ 결정 필요 (구현 전 사용자 확인)

1. **필터 탭 기준** — 무신사는 *주문 종류*(온라인/오프라인/유즈드/상품권/티켓). 유어딜 현재는 *상태*(결제완료/배송중/…).
   - **위 "데이터 범위" 확인 결과**: 주문내역에 상품/교환권/공구가 섞여 있고 각각 카드 레이아웃이 달라야 함 → **종류 탭 권장(옵션 A)**.
   - 옵션 A (권장): 무신사처럼 **종류 탭**(전체/상품/교환권/공구) + 상태는 카드 내 작은 라벨. 종류별 카드 분기(상품=배송, 교환권/공구=사용처·유효기간).
   - 옵션 B: 현재 **상태 탭** 유지 + 무신사 *스타일*(밑줄)만 차용 — but 교환권/공구의 배송-빈박스 문제는 별도 해결 필요.
   - 옵션 C: 교환권/공구는 `/my-vouchers` 전담으로 두고 `/my-orders` 는 **배송 상품만** 필터(중복 제거) — 단 "한 곳에서 다 보기" UX 손해.
2. **프로모 배너**(무신사 "안 입는 옷 판매") 슬롯 — 유어딜은 비우거나 다른 CTA(예: "딜 충전하고 더 받기")로?
3. **받은 혜택 섹션** — 유어딜 주문에 적립/딜 적립 데이터가 있으면 노출, 없으면 생략?
4. **"구매 내역 삭제"** — 무신사엔 있음. 유어딜도 주문 숨김/삭제 기능 필요?

---

## 구현 todo 체크리스트

### Phase 0 — 데이터 버그 (선결, worker)
- [ ] `order.repository.ts findItemsGrouped` SELECT 에 `product_image` 추가 + 카드 가격 `unit_price` 정합
- [ ] `OrderDetailModal` 배송비 `order.shipping_fee` 실값 + 결제 라인 분해
- [ ] staging 실주문 1건으로 가격/썸네일/배송비 검증

### Phase 1 — 목록 카드 리디자인 (`OrdersTab.tsx`)
- [ ] 상품 **썸네일 64px** (`cfImage`, placeholder=회색 박스)
- [ ] 카드 레이아웃: `[썸네일] | 브랜드·상품명·옵션/수량·가격`
- [ ] 상태 = **작은 회색 라벨**(배송중/준비중만 컬러 강조) + 항상-노출 스텝퍼 제거/조건부화
- [ ] 배송지 풀박스 → 카드에서 제거(상세로), 송장/배송조회만 한 줄
- [ ] **날짜 그룹 헤더** `YY.MM.DD(요일)` + 그룹 우측 `주문 상세 >`
- [ ] 판매처/판매자 행 (`판매자명 >` → 문의/링크)
- [ ] 스켈레톤 첫 페인트 (스피너 제거 — CLAUDE.md 첫 페인트 표준)

### Phase 1b — 헤더/검색/필터 (`MyOrdersPage.tsx` + `OrdersTab.tsx`)
- [ ] 좌측 large title "주문 내역"
- [ ] 검색바(상품명/브랜드) — 클라 필터 or 서버 검색
- [ ] 필터 탭 밑줄 스타일 (기준은 "결정 필요" 확정 후)

### Phase 2 — 상세 모달/페이지 (`OrderDetailModal.tsx`)
- [ ] `구매 상품 N개` 섹션 + 썸네일/브랜드/옵션/가격
- [ ] `결제 정보` 라인 분해(상품/할인/결제금액 굵게/결제수단)
- [ ] (선택) `받은 혜택` 섹션 — 적립 데이터 있을 때
- [ ] (선택) 구매 영수증 / 주문 숨김

### 마감 품질
- [ ] 다크모드 `dark:` variant (배지/라벨/카드) — 테마 일관성 검사 통과
- [ ] 카드 전체 클릭 → 상세 (액션 버튼 stopPropagation)
- [ ] i18n 6개 언어 키
- [ ] `bash scripts/quality-check.sh` 통과

---

## 참고: 잠금 여부
- `MyOrdersPage.tsx` / `OrdersTab.tsx` / `OrderDetailModal.tsx` 는 **잠금 파일 아님** → 직접 작업 가능.
- Phase 0 의 `order.repository.ts` 는 결제 SSOT 가 아니라 조회 쿼리 → 잠금 외. 단 worker 변경이라 staging 검증 권장.

---

## ✅ 구현 완료 (2026-06-18 — 옵션 A)

사용자 결정 **옵션 A (종류 탭 + 종류별 카드)** 로 구현.

### 변경 파일
| 파일 | 변경 |
|---|---|
| `src/shared/order-type.ts` (신규) | 종류 분류 SSOT — `getOrderKind()` (deal_only→교환권 / **isVoucherCategory(category)→공구** / else→상품), `ORDER_KIND_LABELS`, `orderKindHasShipping()`. ⚠️ **group_buy_status 사용 금지**(migration 0146 `DEFAULT 'active'` 라 모든 상품이 기본 active → 오분류) — voucher-categories.ts SSOT(category)로 판정(2026-06-18 정정). |
| `src/shared/types/index.ts` | worker `OrderItem` 에 `category/deal_only/group_buy_status` 추가 (분류 신호). |
| `src/worker/repositories/order.repository.ts` | **Phase0 버그수정**: `findItemsGrouped` 에 `oi.product_image`(썸네일) + products LEFT JOIN(`category/deal_only/group_buy_status`) 추가, 컬럼 누락 환경 try-catch fallback. `mapOrder` 가 새 필드 매핑. |
| `src/types/order.ts` | 프론트 `OrderItem` 에 `product_thumbnail/unit_price/subtotal/category/deal_only/group_buy_status` + **`orderItemLineTotal()` 헬퍼**(0원 버그 수정: price_snapshot 직접곱 → subtotal>unit_price×qty>price_snapshot 폴백). `Order` 에 `subtotal/shipping_fee/discount_amount`. |
| `src/components/mypage/OrdersTab.tsx` | **전면 개편**: 검색바 + 종류 탭(전체/상품/교환권/공구, 카운트) + 날짜 그룹(YY.MM.DD(요일)) + 썸네일 64px + 종류별 카드(상품=송장·배송조회 / 교환권·공구='내 교환권' 안내) + 은은한 상태 라벨 + 카드 전체 클릭 + 필터별 빈 상태. 기존 `getTrackingUrl` export 보존. |
| `src/pages/MyOrdersPage.tsx` | 좌측 large title + **스켈레톤 첫 페인트**(스피너 제거). |
| `src/pages/my-orders/OrderDetailModal.tsx` | 썸네일 + `구매 상품 N개` + **결제 라인 분해**(상품금액/할인/배송비 실값 — 하드코딩 3,000원 제거) + 교환권/공구는 배송 섹션 숨김 + 총액 잉크색. |
| `tests/unit/components/mypage/OrdersTab.test.tsx` | 종류 탭/썸네일/날짜그룹 새 설계로 교체 (12 pass). |

### Phase0 데이터 버그 — 해결됨
1. ✅ 상품별 "0원" → `orderItemLineTotal()` (subtotal/unit_price 우선).
2. ✅ 썸네일 누락 → `findItemsGrouped` 가 `product_image` SELECT → `product_thumbnail` → `cfImage(...,128)`.
3. ✅ 배송비 하드코딩 3,000원 → `order.shipping_fee` 실값(상품만 표시, 0이면 "무료").

### 검증
- `tsc --noEmit` 0 · `npm run build`(client+worker+prerender) 0 · OrdersTab 단위테스트 12 pass
- guard: schema-refs / sql-column-exists / sql-bind-params / theme-consistency / products-column-budget / money-patterns 전부 통과

### 구매 내역 삭제(숨김) — #4 구현 완료 (2026-06-18, 사용자 "구매 내역 삭제/숨김 기능만 필요")
- **실제 DELETE 금지** (재무/감사 레코드 보존) → side table `hidden_orders` 에 등재해 **사용자 뷰에서만 숨김**.
- `src/worker/utils/hidden-orders.ts` (신규): `ensureHiddenOrdersTable`(WeakSet 메모이즈, CREATE IF NOT EXISTS self-healing) + `hideOrder`(INSERT OR IGNORE 멱등). product-supply-meta.ts 패턴.
- `POST /api/orders/:id/hide` (order.routes.ts): requireAuth + **본인 주문 검증(IDOR)** + **종료 상태(DELIVERED/DONE/CANCELLED/REFUNDED)만 허용**(진행 중 주문 숨김 차단 → 배송/결제 추적 손실 방지).
- `order.repository.ts findByUserId`: `ensureHiddenOrdersTable` 후 COUNT/목록 쿼리에 `NOT EXISTS (hidden_orders)` 필터 (페이지네이션 카운트도 정합).
- UI: `OrderDetailModal` 하단 "구매 내역 삭제" 버튼(종료 상태만, 은은한 회색) → `MyOrdersPage.handleHideOrder` (confirmDialog "목록에서만 안 보임" 안내 → API → refetch).
- 복구: unhide UI 없음(무신사 동일). 필요 시 `hidden_orders` 에서 행 삭제로 복원 가능(데이터 보존).

### 미구현 (결정 #2~#3 — 추후 사용자 결정 시)
- 프로모 배너 슬롯(#2) / 받은 혜택 섹션(#3) — 데이터/정책 확정 후 별도 작업.

### ⚠️ 운영 검증 권장
- 쇼핑탭 숨김 상태(`SHOPPING_TAB_HIDDEN`)라 라이브 영향 낮으나, worker 조회 쿼리(`findItemsGrouped`) 변경 → **staging 에서 상품/교환권/공구 각 1건 주문으로 종류 분류·썸네일·가격·배송비 표시 확인 권장**.
