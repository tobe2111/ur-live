# [LOADING_ADDITIVE] 2026-11-09 — 유어쇼츠 목록(`/urshorts`) 서버 첫 화면

대표 *"계속 최적화"*. 라이브 실측(폰 4G 흉내) 첫 글자 **2.0초** — 다른 소비자 화면은 0.5초대. 시드(#2249)로 목록은 1.3초에 왔지만 `#root` 는 앱이 켜질 때까지 로더뿐이었다.

## 잠금표 접촉
- `src/worker/index.ts` HTMLRewriter SSR inject 블록 — `/life` 분기 줄에 **분기 하나 추가**(폰 UA · 시드 있음일 때만). 줄 수 2672(래칫 상한) 유지. 다른 분기 불변.

## 그리는 것
[머리(뒤로 칸·제목·편수) + 설명 한 줄 + 칩 줄(도시·종류 — `pages/urshorts/facets.ts` **같은 함수**, 둘 미만이면 안 그림) + 2열 격자(시드 10편, 앞 4장 eager)].
카드는 `BrowseCard` 마크업 그대로(아이콘만 빈 칸). 화면은 시드로 첫 렌더한 카드에 등장 애니메이션(`ur-vc-in`)을 안 건다 — 서버가 이미 보여 준 카드가 다시 커지면 깜빡임.
CSS-first(`cssFirstApplies`) · critical CSS 표면 `urshorts`(34KB) 등록.

## 못 보는 것
- 픽셀 밀림(jsdom) · 실제 FCP — 배포 뒤 라이브 실측. PC 는 안 그린다(홈과 같은 규율 — 좁게 시작).

## 가드
`urshorts-first-screen-2026-11-09.test.tsx` 9건(진짜 `BrowseCard` 렌더 ↔ 서버 HTML 을 태그·클래스·글자·img 속성으로 평탄화해 대조) · 주입 4건 되돌려 빨간불 확인 · critical-css·css-first-boot 가드 표면 등록.
