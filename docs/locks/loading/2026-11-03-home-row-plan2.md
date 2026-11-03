# [LOADING_ADDITIVE] GroupBuyFeedCard 줄 목록 글자 순서 (2026-11-03)

- 파일: `src/pages/main-home/GroupBuyFeedCard.tsx` (잠금표 행: hover/touch/focus prefetch · viewport prefetch · image fade-in · React.memo · rootMargin)
- 바꾼 것: `row` 일 때 글자 칸 순서만(제목·거리 → 업체명·시·구). 주소 축약을 `shortRegion()` 으로.
- 잠긴 항목은 **하나도 안 건드렸다**(prefetch·IntersectionObserver·fade·memo·rootMargin 그대로). 사진 요소·폭 불변.
- 워커 첫 화면이 같은 마크업 — 대조 시험 `home-ssr-first-screen-2026-10-08` 통과.
