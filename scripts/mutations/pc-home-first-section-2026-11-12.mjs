/** 🧬 주입 — PC 홈 첫 섹션 서버 그림. 가드: src/tests/unit/pc-home-first-section-2026-11-12.test.ts */
const T = 'src/tests/unit/pc-home-first-section-2026-11-12.test.ts'
export default [
  { name: 'PC첫섹션 — 워커가 시드를 안 넘긴다(다시 회색 자리표시)', file: 'src/worker/index.ts', find: 'buildPcHomeFirstScreen(homeBannersPayload, urdealLoaderHtml, ssrExtraPayload)', replace: 'buildPcHomeFirstScreen(homeBannersPayload, urdealLoaderHtml)', test: T, why: '2026-11-12 대표 캡처 — 배너 아래가 회색.' },
  { name: 'PC첫섹션 — 사진을 모바일 폭으로(같은 사진을 두 번 받는다)', file: 'src/worker/utils/pc-home-first-screen.ts', find: 'cardHtml(p, i < HOME_CARD_ABOVE_FOLD, undefined, false, HOME_CARD_IMG_WIDTH_LG)', replace: 'cardHtml(p, i < HOME_CARD_ABOVE_FOLD, undefined, false)', test: T, why: '화면은 4열 폭(400)으로 받는다.' },
  { name: 'PC첫섹션 — 위치 섹션도 그린다(손님 위치를 모르는 부제)', file: 'src/worker/utils/pc-home-first-screen.ts', find: '  if (!sec || sec.near || !sec.title) return \'\'', replace: '  if (!sec || !sec.title) return \'\'', test: T, why: '서버는 손님 위치를 모른다.' },
  { name: 'PC첫섹션 — 줄 클래스가 화면과 갈린다', file: 'src/shared/pc-home-first-screen.ts', find: "  railWrap: 'relative',", replace: "  railWrap: 'relative mt-1',", test: T, why: '마운트 때 줄이 튄다.' },
]
