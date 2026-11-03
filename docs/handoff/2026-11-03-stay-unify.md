# 숙소를 이용권과 한 몸으로 — A(화면) 완료 · B(소개 적립) 결재

서비스: 유어딜(소비자) + 셀러 대시보드/에이전시 콘솔. 머니 경로 접촉: A 없음 / B 있음.

## 대표 지시
*"숙소이용권 상세페이지는 왜 다르지? 팔아보기 그런게 왜 없지? 지금 전체적으로 통합됐지 않아?"*
→ *"1,2 다 해야지. 사장님 계정, 에이전시 계정 등 볼게 많지 않아? 왜 분리가 되어있지?"*
→ *"숙소이용권 상세페이지 배경 색상도 지금 다르고"*

## 왜 갈라져 있었나
- 2026-05-18 숙소를 **별도 상품**으로 만들었다(객실·달력·예약표·자기 소개 방식 `?ref=` 까지 전부 따로).
- 2026-09-26 숙소 메뉴를 사장님 화면에서 내렸다(`SELLER_DORMANT_HIDDEN` — 숙소 상품 0·예약 0). 화면은 남았지만 들어가는 길이 끊겼다.
- 2026-10-25 "숙소를 이용권 방식으로" 는 **결제 뒤**(지갑 QR·스캔·정산·환불)만 합쳤다. 사기 전 화면과 사장님 쪽은 그대로.
- 2026-11-02 이용권 상세 바탕이 페이지 바탕(--bg)으로 바뀌었는데 숙소 상세는 카드색에 남아 다크에서만 달랐다.

## 이번에 한 것 (A — 돈 안 닿음)
1. 유어샵에 담긴 숙소 클릭 → `/pass`(이용권 상세, 객실·날짜 없이 열림)가 아니라 `/stays` 로 (`curator.routes.ts`)
2. PC 숙소 상세에 찜·담기·공유 (`stay-detail/StayPcActions.tsx`) — 폰 머리는 `lg:hidden` 이라 PC 엔 0개였다
3. 숙소 상세 바탕 = 이용권 상세 바탕(`bg-warm` = --bg). 다크 #1D1F29 → #11141C, 라이트 무변화 (`shared/stay-head.ts` — 서버 첫 화면도 같은 상수)
4. 사장님 이용권 탭(에이전시 콘솔이 같은 화면을 연다)의 숙소 행: [수정] → 숙소 편집(객실·달력) · 재발행/지점복사 → [예약 현황] (`VoucherRow.tsx`)
5. 이용권 등록 폼에서 '숙박' → 숙소 등록 화면(`/seller/stays/new`). 종전엔 그 폼으로 **객실 없는 숙소**가 만들어졌다 (`VoucherInfoStep.tsx`)
- 가드: `stay-unify-a-2026-11-03.test.ts` + 재조준 2(`voucher-nav-reachability`·`detail-unify-head-box`)

## B — 결재 대기
`docs/decisions/2026-11-03-stay-referral-unify.md`. 숙소 소개 적립을 `?aff`/딜 N% 로 + 숙소 상세 '팔아보기'.
결제 확정 블록(`payment.routes.ts` ~608, 잠금)을 건드리므로 단독 세션 + staging 실결제.

## 이번에 틀렸던 판단
- 첫 답에서 "숙소 상세에 담기·공유가 없다" 고 했는데 **폰에는 있었다**(`DetailFloatingHeader`). 없던 건 PC 뿐.
- 이 레포의 `tsconfig.worker.json` 타입체크는 main 에서도 오류 294개다 — 내 변경 판정엔 `npm run type-check`(0) 을 썼다.

## 남은 것 / 이어받는 세션의 첫 액션 (대표가 이 작업을 이어서 하라고 했을 때만)
- B 실행: 결재 파일의 1안/2안 확인 → `src/features/group-buy/api/stays-public.routes.ts` 예약 생성(약 451줄)에 `findActiveDealPct` 판정 → 결제 확정 적립·역전 → `StayDetailPage` 에 `SellThisCard`.
- `/pass/:id` 로 숙소 id 가 직접 들어오면 여전히 이용권 화면으로 열린다(`GroupBuyDetailPage` 는 로딩 잠금 파일이라 이번엔 안 고쳤다). 앱 안 링크는 `detailHref` 가 이미 `/stays` 로 보낸다.
- 사장님 메뉴의 숙소 묶음(`SELLER_DORMANT_HIDDEN`)은 그대로 접혀 있다 — 이제 이용권 탭에서 닿으므로 펼칠 필요가 없다.

---
## ① 등록·관리 통일 (같은 날 후속 — 대표 *"모두 해줘. 에이전시든 사장님이든 시간 예약도 받게 되어있어? 잠금 파일도 다 허가해줄테니 순서대로 다 해줘"*)
- A 는 #2150 으로 머지(0cc0afb).
- 시간 예약 실측: 코드(`appointments.routes.ts`·`SellerBookingSlotsPage`)는 5월부터 있었는데 **설정 화면에 들어가는 길이 0**, 라이브 `product_booking_slots` 0 · `appointment_bookings` 0. 에이전시도 같은 좌석 토큰이라 같은 상태였다.
- 한 것(90fa583): 이용권 등록 위저드에 숙박(유형·체크인/아웃·객실·시설) + 예약 방식(바로 사용/시간 예약/외부 예약). 숙소 상품도 `POST /api/seller/products` 로 만들고 `POST /api/seller/stays/:id/info` 로 숙소 정보를 붙인다(옛 소개 할인·수수료는 0 고정). 이용권 행 [예약 시간] · 주문 탭 옆 [예약]·[숙소 예약]. 옛 `SellerStayNewPage` 삭제(주소는 위저드로 리다이렉트).
- 남은 순서: ② 상세 화면 하나(로딩 잠금 — 대표 허가 2026-11-03) → ③ 소개 적립 통일(결제 잠금 — 허가, staging 실결제 필요) → ④ 옛 숙소 화면 정리.
- ② 상세(같은 PR): 숙소 상세에 이용권 상세와 같은 폰 구역 탭(`DetailSectionTabs` + `stay-detail/stay-tabs.ts`) · `/pass/<숙소id>` → `/stays/<id>`(`GroupBuyDetailPage`, 로딩 잠금 대표 허가 → `docs/locks/loading/2026-11-03-pass-stay-redirect.md`). 두 상세를 한 파일로 합치는 것은 하지 않았다 — SSR 첫 화면(`stay-detail-ssr-body`·`detail-ssr-body`)이 둘 다 따로 있어 한 번에 합치면 첫 페인트·무게 예산이 통째로 흔들린다. 대신 부품을 공유한다(구역 탭·찜/담기/공유·바탕·제목 크기).
