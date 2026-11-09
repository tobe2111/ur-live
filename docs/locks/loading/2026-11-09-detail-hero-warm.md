# [LOADING_ADDITIVE] 2026-11-09 카드에 손가락이 닿는 순간 상세 큰 사진을 받기 시작한다

- 대표 *"눌렀을 때 반응하는 속도"*(첫 로딩 다음 단계).
- 잠금 접촉: `src/pages/main-home/GroupBuyFeedCard.tsx` — hover/touch/focus 미리받기(잠금). **추가만**: `onTouchStart` 뒤에
  `warmDetailHero(p)` 한 호출(이용권 상세로 가는 카드만). 기존 두 호출(데이터·청크 즉시 미리받기)·시점·observer 100px 불변.
- 실측(폰 흉내 · CPU 4배 · 느린 4G, 라이브 홈 → 카드 탭): 주소 바뀜·h1 0.34s, 큰 사진(960px) 요청 **0.34s 에 출발** + 같은 순간 아래쪽 15건
  (지도 그림 9 · 리뷰 · 추천 등)이 함께 출발 → 사진이 회선을 나눴다. 닿는 순간 출발시키면 탭→화면 전환 ~0.3s 를 사진이 먼저 쓴다.
- 주소는 화면(`DetailGallery`)과 같은 함수(`detailGalleryImages` → `detailHeroMobileUrl`)라 요청 재사용. 폰 배치만(`DETAIL_DESKTOP_QUERY`). 카드당 1회.
- 가드: `detail-hero-warm-2026-11-09.test.ts` + 기존 3건 재조준(앞의 두 호출은 그대로 고정).
- 롤백: 그 한 호출 제거.
- 판정(E4): 배포 후 같은 조건으로 카드 탭 → 큰 사진 완료 시각(전 1.33s).
- 다음 후보(잠금 파일이라 대표 승인 필요): 상세 화면이 큰 사진을 받는 동안 아래쪽 15건(지도 그림 · 리뷰 · 추천 목록)을 사진 뒤로 미루기.

## 2차(같은 날) — 숙소 카드 · 유어샵 진열 줄에도
- 실측(같은 조건): 숙소 목록 → 상세 제목 0.57s · 큰 사진 **1.62s** / 유어샵 → 상세 큰 사진 **1.06s**.
- 숙소 상세도 같은 갤러리(`DetailGallery`)·같은 큰 사진 주소라 `warmDetailHero` 그대로 — 카드 조건 `isPassDetail || isStay`.
- 유어샵 줄(`PinRow` → `DealRow` 의 hover/touch/focus `prefetch`)에 같은 한 호출(이용권·숙소 상세로 가는 줄만 · 폰 배치만 — 함수가 PC 를 거른다).
