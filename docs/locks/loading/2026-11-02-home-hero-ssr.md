# [UNLOCK_LOADING] 홈 맨 위 지역 사진을 서버 첫 화면에 — 2026-11-02

- **바꾼 잠금 파일**: `src/worker/index.ts` (잠긴 항목: HTMLRewriter SSR inject 블록 — **구조 불변**, 홈 첫 화면 호출에 쿠키 머리글 인자 하나 추가)
- **대표 승인 문구(그대로, AskUserQuestion)**: *"허가 — 진행해줘"*
  - 질문: *"홈 맨 위 지역 사진을 서버 첫 화면에 넣으려 해요. 실제 손님 기록상 폰 홈은 화면이 도착한 뒤 그 사진 요청이 출발하기까지
    1.56초를 기다려요 … 로딩 잠금 파일(worker/index.ts)의 홈 첫 화면 호출 한 줄을 바꿔야 해서 허가가 필요해요."*
- **배경**: 대표 *"홈 화면 밀림 해결해줘. 처음 유어딜 켤 때 꽤 로딩 걸려"*.
  밀림(`shift` 4,859→2,126)은 하네스 스텁에 홈 섹션이 빠진 가짜였고 main `b66331f`(#2087)가 이미 고쳤다(재실행 보이는 곳 0).
  라이브 폰에서도 첫 카드 162→161px — 밀림 없음. 남은 것은 첫 로딩 = LCP: 11-02 p75 1,980ms 중 lrd(화면 도착 → LCP 요청 출발) 1,564ms.

## 무엇을
- `utils/home-first-screen.ts` — 사진 머리(`ur-region-hero`) + `RegionHeroBg` 와 같은 마크업을 서버가 그린다(`data-home-hero`).
- 어떤 사진: 쿠키 `ur_home_hero`(화면이 남김 · 1년 · 표시용) → 없으면 전국=서울 · `none`=사진 없음 · 모르는 값=서울.
- 화면은 서버 사진이 있으면 페이드 없이 보인 상태로 이어받는다.
- 첫 화면 CSS(`generated/critical-css.ts`) 재생성.

## 가드 · 롤백
`src/tests/unit/home-hero-ssr-2026-11-02.test.ts` + 주입 `scripts/mutations/home-hero-ssr-2026-11-02.mjs`. 롤백: revert.
