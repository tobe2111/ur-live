## 🔴 2026-07-29 — 세션 ②: sitemap 몰 격리 가드 (SEO 되돌림 불가 → 최우선)

**왜 sitemap 만 별도 순위인가**: 운영자 몰 상품이 본진으로 새는 사고는 여러 표면에서 나는데,
다른 표면은 **배포 한 번으로 되돌아간다**(조건 고치면 다음 요청부터 안 나오고 캐시는 TTL 로 빠짐).
**sitemap 은 아니다** — 색인은 검색엔진 쪽에 남고 회수는 재크롤링·삭제요청에 달려 **통제권이 없다.**
⇒ **첫 운영자 몰 개설보다 먼저** 들어가야 하는 가드.

**왜 기존 보호막이 안 먹히나**: 오늘 본진↔도매가 안 섞이는 이유는 `mall_id` 가 아니라
**`is_supply_product`**(불변식 ①)인데, 운영자 몰 상품은 `is_supply_product=0`(소비자 셀러 상품)이라
**그 필터를 그냥 통과한다.** sitemap 의 상품 2쿼리·셀러 1쿼리 전부 무방비였다.

**수정**: 신규 `worker/utils/consumer-scope.ts`(초크포인트) + `sitemap.routes.ts` 3쿼리에 적용.
- 판별자(대표 확정): 본진 = `COALESCE(mall_id,1) = 1` / 몰 = `mall_id = :mallId`(신규 몰 id ≥ 3)
- ❌ `mall_id IS NULL` 금지 — `ALTER ... DEFAULT 1` 이라 기존 행이 전부 1. NULL 은 0건이라 안 걸러진다
- 컬럼 부재 내성: PRAGMA 1회 감지(WeakMap 메모이즈) → 없으면 조건 생략.
  **컬럼이 없으면 몰을 스탬프할 수단 자체가 없어 누수 0** — 조용한 우회가 아니라 구조적 안전 폴백
- 잘못된 몰 id 는 **fail-closed**(`AND 0 = 1`) — 최악의 실패인 "조건 소실 → 본진 카탈로그 통째 노출" 차단
- JOIN 쿼리는 별칭 한정(`s.mall_id`) — 모호 참조로 SQL 이 깨지지 않게

**되돌려-검증 3종(전부 빨강 확인 후 복원)**: 셀러 쿼리 조건 제거 → 빨강 / fail-closed 를 fail-open 으로 → 빨강
/ `IS NULL` 판별자 회귀 → 빨강.

⚠️ **가드가 못 막는 것**(테스트 주석 명시): 라이브 색인 상태 · sitemap **밖** 노출 경로(홈·검색·`/browse`·
피드 cron 캐시 — 세션 ③ 범위) · 값이 잘못 스탬프된 경우(등록 경로 → ③-b).
🛡️ 빈 스캔 방지: 상품/셀러 쿼리가 **3개 이상** 잡히는지 먼저 확인한다(쿼리가 사라졌는데 "위반 0"으로
통과하면 가드가 헛돈다).

### ✅ 정정 — `clearCart` 는 버그가 아니었다

직전 인계에 *"`cart.store.ts:89 clearCart` 호출처 0건 → 결제 성공 후 장바구니가 안 비워진다"* 로 적었는데
**틀렸다. 정상 동작한다.** 실제 장바구니는 **서버측**(`/api/cart`·`cart_items`)이고
`PaymentSuccessPage.tsx:126·271` 이 `POST /api/cart/clear` 를 `order_number` 와 함께 호출한다.
서버는 **그 주문 상품만** 지운다(`cart.routes.ts:565` — 2026-06-12 에 "전체 비우기 → 선택 삭제"로 이미 수정).
`cart.store.ts` 는 **헤더 뱃지 카운트에만 쓰이는 잔존 zustand 스토어**라 `clearCart` 가 안 불릴 뿐이다.

> ⚠️ 교훈: **심볼 호출처 0건 = 기능 부재가 아니다.** 그 심볼이 그 기능의 실제 경로인지부터 확인할 것.
> (남은 것은 버그가 아니라 죽은 스토어 정리이고, 선택사항이다.)

---

## ✅ 2026-07-31 — 양방향 가드의 **런타임 절반** 배선 (③-a)

대표 경계조건 ②(*"가드는 양방향이어야 합니다"*)의 **CI 가 못 보는 쪽**을 채웠다.

| 방향 | 누가 본다 | 어디 |
|---|---|---|
| `라우트 ⊆ 예약어` | CI | `mall-branding.test.ts`(기존) |
| **`기존 슬러그 ∩ 예약어 = ∅`** | **런타임** | `auditMallSlugs` + `GET /api/admin/wholesale-malls/slug-conflicts` (신규) |
| **생성·수정 차단** | **런타임** | `POST`/`PATCH` 에 `validateMallSlug` → 400 `SLUG_RESERVED` (신규) |

### 왜 지금이 맞는 타이밍인가
경로 리졸버(`decideMallSource`/`firstPathSegment`)는 **아직 워커에 배선 안 됐다**(grep 확인: 주석 참조뿐).
⇒ 오늘은 예약어 슬러그가 있어도 **아무것도 안 깨진다**. 깨지는 건 **리졸버를 켜는 순간**이다.
**차단은 리졸버보다 먼저 들어가야** 한다 — 순서가 반대면 켜자마자 라우트가 죽는다.

### ⚠️ 다음 세션이 알아야 할 것 (실측)

1. **이 엔드포인트는 `utongstart.com` 에서만 열린다.** `/api/admin/wholesale-malls/*` 는
   `mount-wholesale.ts` 에 있고 `__INCLUDE_WHOLESALE__=false` 인 **소비자 번들에서 DCE 로 빠진다**.
   ⇒ `urdeal.kr` 에서 호출하면 404 다. 이건 결함이 아니라 번들 분리의 결과.
   ⇒ **이 환경(프록시)에서는 utongstart 도달 불가** — 대표만 확인 가능하다.
2. **`checked:0` 을 통과로 읽지 말 것.** 응답에 `checked` 를 넣은 이유가 그것이다
   (가드 레지스트리 교훈: *"측정 대상 0건이면 통과가 아니라 실패"*).
3. **3~30자 제한은 취향이 아니다.** `firstPathSegment` 가 그 문법으로 후보를 거르므로,
   범위 밖 슬러그는 **만들어져도 경로로 안 열린다**. 그래서 `unreachable` 로 따로 보고하되
   **`ok` 는 깨지 않는다** — 합치면 진짜 충돌 경보가 묻힌다.
4. **현재 시드는 안전**: `default`·`medi` 둘 다 예약어가 아니다(테스트로 고정).

### 되돌려-검증 2종 (실측)
- 예약어 대조 제거 → **3 fail** ✅
- `ok` 가 `unreachable` 까지 보게 → **1 fail** ✅ (복원 후 12 pass)

### 남은 것 — ③-a 마지막 단계
**워커 배선**(`worker/index.ts` HTMLRewriter 에 몰 OG 메타 + 몰 스코프). 그 파일은 **로딩 잠금** 대상이라
`[UNLOCK_LOADING]` 절차(대표 확인)가 먼저다. 배선 전까지 `buildMallMeta`·`decideMallSource` 는 **휴면**이다.

---

## 🏬 2026-08-01 — 소비자 경로 몰 조회 (③-a O2 토대)

`urdeal.kr/{슬러그}` 를 몰로 해석하는 **판정 계층**. 아직 **워커 미배선**(순수 모듈 + 조회 함수).

### 왜 도매 모듈을 안 쓰고 새로 만들었나 (실측)

`features/supply/api/wholesale-malls.ts`(`resolveMallId`·`ensureMallSchema`)는
**`__INCLUDE_WHOLESALE__=false` 인 소비자 번들에서 DCE 로 빠진다.** 거기서 import 하면
**도매 그래프 전체(~200KB gzip)가 되살아난다.**
⇒ `worker/utils/mall-consumer.ts` 는 **테이블만 직접 읽는다.** 같은 파일의 host→도매몰 판별
(`getWholesaleMallHosts`, `worker/index.ts:2519`)이 이미 쓰는 방식이라 선례가 있다.

**빌드 실측**: 소비자 번들에 `ensureMallSchema` **0건** — 도매 그래프 미유입 확인.
(`mall-consumer` 자체도 0건 — **아직 아무도 안 부르기 때문**. 배선 PR 에서 다시 볼 것.)

### 불변식 2개

**① 핫패스 불변** — 예약어는 **DB 를 아예 안 본다**. 기존 소비자 라우트는 전부 `RESERVED_SLUGS` 에 있고
CI 가 `라우트 ⊆ 예약어` 를 강제하므로, **DB 를 보는 건 어차피 404 로 가던 경로뿐**이다.
⚠️ 검사 **순서**가 중요하다 — 예약어가 문법 검사보다 **먼저**여야 조회가 0이 된다(테스트가 순서를 고정).

**② 서비스 분리 (fail-closed)** — `consumer_path = 1` 인 몰만 경로로 연다.
신규 컬럼 `wholesale_malls.consumer_path INTEGER DEFAULT 0`(repair-schema + ensureMallSchema 자가치유).

> 🔴 **왜 `host IS NULL` 로 추론하지 않았나**: 메디스타트(id=2)는 **host 가 NULL 인 도매몰**이다.
> 추론했으면 `urdeal.kr/medi` 로 **B2B 도매몰이 소비자 도메인에 열렸을 것**이다.
> **추론 대신 표시.** 기존 행은 전부 기본값 0 → **새로 열리는 것 0**.

### 되돌려-검증 2종
- 예약어 조기탈출 제거 → **2 fail** ✅ (핫패스가 DB 를 보게 됨)
- `consumer_path` 게이트 제거 → **3 fail** ✅ (도매몰이 열림)

### 다음 세션의 첫 액션
1. **대표가 몰을 만들 때 `consumer_path:1` 을 켜야 한다** — 어드민 CRUD 에 필드는 뚫었지만
   **화면(체크박스)은 없다**(대표 지시 ⑥ *"디자인 개선 금지"* 준수). PATCH 로 켤 수 있다:
   `PATCH /api/admin/wholesale-malls/{id} {"consumer_path":1}` (utongstart.com, 슈퍼어드민).
2. **워커 배선**이 남았다 — `worker/index.ts` 에 ⓐ `lookupConsumerMall` 로 몰 컨텍스트 확정
   ⓑ `buildMallMeta` 로 OG 메타 rewrite. 그 파일은 **로딩 잠금**이지만 잠금표의 예외 절
   *"새 페이지 / 새 SSR slot 추가(기존 4페이지 inject 패턴 따라)"* 에 해당한다.
   ⚠️ **단 SPA 라우트(`/:mallSlug`)가 먼저다** — 지금 OG 메타만 붙이면 **존재하지 않는 페이지의
   미리보기**를 만들게 된다. 순서: SPA 몰 화면 → 워커 메타.
