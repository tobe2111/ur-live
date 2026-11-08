# [UNLOCK_LOADING] 2026-11-08 교환권 분류(`/vouchers?category=…`) 첫 화면을 서버가 그린다

- 대표 *"모두 최적화"*(분류 목록이 1순위 후보로 보고됨).
- 실측(라이브, 느린 4G 흉내): `/vouchers?category=영화` FCP 2.05s · LCP 3.15s — 시드는 받아 놓고(`ssrPayload`) 크롤러 본문에만 쓰고
  주입은 끊었다(10-12 규율: "화면이 facet 시드를 안 먹는다"). 그래서 `#root` 는 로더였다.
- 잠금 접촉: `src/worker/index.ts`(facet 시드 주입 차단 한 줄 제거 · VOUCHERS 분기에 카테고리 인자) · `src/pages/VouchersPage.tsx`(시드 소비 조건).
- 처방:
  ① 워커가 facet 시드도 주입한다(유어쇼츠 차단은 그대로).
  ② `buildVouchersFirstScreen(…, category)` — 제목만 그 카테고리(나머지 구조는 기본과 같다: 브랜드 줄 예약은 React 도 카테고리가 있으면 한다).
  ③ `readVouchersSsrSeed` — 소비 조건을 *기본 카테고리* → **첫 문서 주소의 카테고리**(`voucherFacetCategory(firstDocumentSearch())`).
     지금 주소가 아니라 첫 문서(Navigation Timing `name`)로 판정해, 앱 안 이동으로 다른 카테고리에 와도 남의 시드를 먹지 않는다.
- 불변: 기본 `/vouchers` 의 시드·첫 화면·HOT_PATHS·캐시 헤더 — `voucherFacetCategory('')` = 기본 카테고리라 byte-동일.
- 가드: `voucher-facet-body-2026-10-12` · `vouchers-first-screen-2026-10-14` · `first-screen-fetch-2026-10-06` 재조준 + ⑥ facet 제목/판정 시험.
- 롤백: revert.
- 판정(E4): 배포 후 같은 조건으로 `/vouchers?category=영화` FCP·LCP(전 2.05 · 3.15s), 화면 제목이 그 카테고리인지.
