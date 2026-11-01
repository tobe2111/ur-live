/** 🧬 주입 — 시안 8(지역 배경)·10(줄 목록). 가드: src/tests/unit/home-region-hero-row-2026-10-31.test.tsx */
const T = 'src/tests/unit/home-region-hero-row-2026-10-31.test.tsx'
export default [
  {
    name: 'region-hero — 지역 사진을 첫 화면 사진과 같은 우선순위로 받는다',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: 'loading="lazy" decoding="async" fetchPriority="low"',
    replace: 'decoding="async"',
    test: T,
    why: '배경 사진이 첫 카드 사진과 회선을 다퉈 첫 화면이 늦어진다.',
  },
  {
    name: 'region-hero — 고른 지역보다 좌표가 이긴다',
    file: 'src/shared/home-region-hero.ts',
    find: '  if (input.regionKey) {',
    replace: '  if (input.regionKey && !input.loc) {',
    test: T,
    why: '부산을 골랐는데 서울에 있으면 서울 사진이 뜬다.',
  },
  {
    name: 'row — 워커 첫 화면이 격자로 남는다',
    file: 'src/worker/utils/home-first-screen.ts',
    find: 'cardHtml(p, i < HOME_CARD_ABOVE_FOLD, undefined, true)',
    replace: 'cardHtml(p, i < HOME_CARD_ABOVE_FOLD)',
    test: T,
    why: '서버 첫 화면은 2열, 화면은 줄 목록 — 마운트 때 첫 화면이 통째로 바뀐다.',
  },
  {
    name: 'row — 자리 카드가 격자로 남는다',
    file: 'src/components/home/DealCardPlaceholder.tsx',
    find: "className={row ? DEAL_ROW.link : 'flex flex-col'}",
    replace: "className=\"flex flex-col\"",
    test: T,
    why: '섹션이 오기 전 자리는 격자, 도착하면 줄 — 높이가 달라 아래가 튄다.',
  },
]
