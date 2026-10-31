/**
 * 🧬 주입 — 모바일 홈 한 줄 카드(Y2, 2026-10-31). 가드: home-y2-rows · home-ssr-first-screen
 */
const T = 'src/tests/unit/home-y2-rows-2026-10-31.test.ts'
export default [
  {
    name: 'Y2 — 모바일 편성 섹션이 격자 카드로 돌아간다',
    file: 'src/components/home/HomeSections.tsx',
    find: "layout={rail ? 'grid' : 'row'}",
    replace: "layout={rail ? 'grid' : 'grid'}",
    test: T,
    why: '자리표시는 한 줄인데 진짜 카드는 격자 — 응답 순간 섹션 모양이 바뀌며 아래가 밀린다.',
  },
  {
    name: 'Y2 — 본문 높이 고정이 풀린다',
    file: 'src/shared/home-row.ts',
    find: "body: 'flex-1 min-w-0 h-[120px] overflow-hidden flex flex-col',",
    replace: "body: 'flex-1 min-w-0 flex flex-col',",
    test: T,
    why: '줄마다 높이가 갈려 자리표시(120 고정)와 진짜 줄의 높이가 달라진다.',
  },
  {
    name: 'Y2 — 워커 첫 화면이 격자 카드로 그린다',
    file: 'src/worker/utils/home-first-screen.ts',
    find: "  const cards = products.map((p, i) => rowCardHtml(p, i < HOME_CARD_ABOVE_FOLD)).join('')",
    replace: "  const cards = products.map((p, i) => cardHtml(p, i < HOME_CARD_ABOVE_FOLD)).join('')",
    test: 'src/tests/unit/home-ssr-first-screen-2026-10-08.test.tsx',
    why: '서버가 그린 첫 화면과 마운트한 화면이 다른 모양이라 첫 프레임이 통째로 바뀐다.',
  },
  {
    name: 'Y2 — 구매 0명을 적는다',
    file: 'src/shared/home-row.ts',
    find: "  if (v <= 0) return ''",
    replace: "  if (v < 0) return ''",
    test: T,
    why: '새 가게마다 "0명 구매" 가 붙어 팔리지 않는 상품처럼 보인다.',
  },
]
