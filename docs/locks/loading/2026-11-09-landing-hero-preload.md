# [LOADING_ADDITIVE] 2026-11-09 대외 안내 페이지 맨 위 사진을 HTML 과 함께 출발

- 대표 *"계속 최적화"*. #2225(안내 페이지 코드 미리받기) 배포 후 실측(폰 흉내): /about FCP 2.04 · LCP 3.17s — **LCP 는 맨 위 사진(222KB)** 이고
  앱 코드가 다 돈 뒤(1.67s)에야 출발했다. 코드 미리받기로는 안 줄었다(병목이 사진이었다).
- 잠금 접촉: `src/worker/index.ts` Early Hints Link 줄 옆에 **한 줄 추가**(`appendLcpLink(..., landingHeroFor(path))`) — 기존 preconnect 불변.
- 주소 SSOT `shared/landing-photo.ts` — 화면 `PhotoHero` 와 워커가 같은 상수(갈리면 두 번 받는다).
- 가드: `landing-hero-preload-2026-11-09.test.ts`. 롤백: 그 한 줄 제거.
- 판정(E4): 배포 후 /about · /partners · /influencer LCP(전 3.1~3.2s).
