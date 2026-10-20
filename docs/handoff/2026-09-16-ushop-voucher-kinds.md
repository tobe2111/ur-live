# 셀러가 올린 이용권이 유어샵에 뜨게 — 네 종류 중 한 종류만 알아보고 있었다 (2026-09-16)

`[E2]` 검증됨(tsc 0 · 신규 8 pass · pre-push 게이트 96개 · 주입 3건 되돌려-검증 빨간불).

## 대표 지시

> *"셀러가 셀러대시보드에서 이용권을 올려도 셀러의 계정의 유어샵에 이용권들 보여주는걸로 하자."*

## 실측부터 — 전제가 하나 달랐다

라이브 D1:

| | |
|---|---|
| 승인된 셀러 | **1곳** (홍대돈까스 id 14) |
| 그 셀러의 `linked_user_id` | **NULL** — 소비자 계정과 연결 안 됨 |
| 그 셀러의 상품 | 1건(2888 치즈돈가스 할인권) · `status=DELETED · is_active=0` |

⇒ **그 셀러에게는 아직 `/u/{handle}` 유어샵이 없다.** 유어샵은 소비자 계정에 붙고
(`curator.routes.ts` 가 `sellers.linked_user_id = 유저id` 로 찾는다), 연결이 없으면
`/profile/{username}` 의 셀러 공개 페이지로만 열린다. **그래서 이번 수리는 그 공개 페이지
(`SellerPublicPage`)에 했다** — 연결이 생기는 순간 `/u/{handle}` 은 같은 컴포넌트를 inline 으로
렌더하므로 그대로 이어진다.

## 무엇이 틀려 있었나

`SellerPublicPage.tsx:257` 이 이용권을 **한 종류로** 판정하고 있었다.

```js
const mealVouchers = products.filter(p => p.category === 'meal_voucher')
```

이용권은 네 종류다(`VOUCHER_CATEGORIES` — 식사·미용·숙소·기타) + 레거시 3종.
셀러 등록 폼은 **네 종류를 다 고를 수 있다**(`VoucherInfoStep.tsx:46-49`).

🔴 **서버는 안 막는다.** `/api/products?seller_id=N` 은 `ProductRepository.findAll` 을 타는데
deal_only/voucher 제외 블록은 **`excludeDealOnly` 일 때만** 돈다(`:182-192`). 유어샵 호출은
그 플래그를 안 넘기므로 네 종류가 다 응답에 실려 온다. **막은 건 화면 한 줄이었다.**

🔴 **그리고 사라지지 않아서 더 나빴다.** 여집합인 `shopProducts`(`:259`)도 같은 한 종류만
제외했으므로 미용·숙소·기타 이용권은 **'내 상품'(쇼핑) 섹션**으로 흘러갔다. 카드 목적지도
`/products/:id`(쇼핑 상세). 분류·섹션 제목·헤더 카운트·목적지가 전부 틀렸는데 **에러가 없었다.**
미용 이용권 하나만 올린 셀러는 히어로 한 장만 뜨고 화면에 '이용권' 이라는 단어가 한 번도 안 나왔다.

📌 **일반 유저 유어샵(`CuratorPage`)과 카테고리 칩은 이미 4종을 다뤘다** — 사업자 페이지만
뒤처져 있었다. 같은 개념의 판정이 두 벌이었고 한 벌만 갱신된 것이다.

## 수리

- `SellerPublicPage.tsx` — `isVoucherCategory`(SSOT) 로. **양쪽 다** 바꿨다(한쪽만 바꾸면 같은
  이용권이 두 섹션에 겹쳐 뜬다). 변수명 `mealVouchers` → `vouchers`, `VouchersTab` prop 도 동일.
- `curator.routes.ts` 핀 SELECT에 `COALESCE(p.deal_only, 0) AS deal_only` **추가**.
  클라(`CuratorPage` `isVoucher`)가 `deal_only === 1` 을 보는데 그 컬럼을 안 내려줘서 **그 분기가
  한 번도 참이 된 적이 없었다** → 담은 **교환권**(기프티콘. `deal_only=1` 인데 카테고리는
  '피자/치킨' 처럼 voucher 가 아니다)이 '교환권 · 동네딜' 이 아니라 '추천템' 으로 갔다.

## 가드

`ushop-voucher-kinds-2026-09-16.test.ts` 8건 — SSOT 를 쓰는지(배선) + 분류가 **양쪽으로 완전히
갈리는지**(동작: 겹치거나 빠지는 상품 0) + 핀 SELECT 의 `deal_only`.
주입 `scripts/mutations/ushop-voucher-kinds.mjs` 3건 전부 빨간불 확인.

## 다음 세션의 첫 액션

1. 배포 후 셀러 대시보드에서 **미용/숙소/기타 이용권을 하나 올려** 그 셀러 공개 페이지에서
   '이용권 N' 섹션에 들어가는지 확인(E4). `/products/:id` 가 아니라 `/group-buy/:id` 로 가야 한다.
2. `node scripts/check-guard-mutations.mjs --only="이용권을 다시 한 종류로 본다"` → 빨간불.

## 대표 판단이 필요한 것

- **셀러 ↔ 소비자 계정 연결.** 지금 유일한 셀러가 `linked_user_id = NULL` 이라 `/u/{handle}`
  유어샵이 없다. 대표가 말한 "셀러의 계정의 유어샵" 이 되려면 그 연결이 필요하고, 연결 경로는
  **같은 이메일 자동 연결**(`KakaoAuthService.upsertUser`, `email_verified` 게이트) 또는
  어드민 수동 연결이다. 어느 쪽으로 갈지는 정해지지 않았다.

## 이번에 틀렸던 판단

- 처음엔 "서버가 이용권을 거르고 있을 것" 이라고 봤다. **틀렸다** — 서버는 네 종류를 다 내려주고
  있었고 막은 건 화면 한 줄이었다. ⇒ "안 보인다" 를 곧바로 쿼리 문제로 읽지 말 것.
