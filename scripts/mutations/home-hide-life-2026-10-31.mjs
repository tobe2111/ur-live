/** 🧬 주입 — 메인에 생활 이용권이 다시 뜬다(2026-10-31). 가드: src/tests/unit/home-hide-life-2026-10-31.test.tsx */
const T = 'src/tests/unit/home-hide-life-2026-10-31.test.tsx'
export default [
  {
    name: 'home-hide-life — 홈 탭에서 생활을 안 뺀다',
    file: 'src/shared/deal-cats.ts',
    find: "export const HOME_HIDDEN_CATEGORIES: ReadonlySet<string> = new Set(['home_voucher'])",
    replace: 'export const HOME_HIDDEN_CATEGORIES: ReadonlySet<string> = new Set([])',
    test: T,
    why: '대표가 메인에서 빼라고 한 생활 탭·카드가 다시 뜬다.',
  },
  {
    name: 'home-hide-life — 워커 첫 화면이 생활 카드를 거르지 않는다',
    file: 'src/worker/utils/home-first-screen.ts',
    find: '{ ...s, products: s.products.filter(isHomeVisibleProduct) }',
    replace: 's',
    test: T,
    why: '서버 첫 화면엔 생활 카드가 뜨고 마운트 때 사라진다(첫 카드가 갈아끼워진다).',
  },
  {
    name: 'home-hide-life — 섹션이 생활을 거르지 않는다',
    file: 'src/components/home/HomeSections.tsx',
    find: 's.products.filter(isHomeVisibleProduct)',
    replace: 's.products',
    test: T,
    why: '편성 섹션에 생활 이용권이 그대로 뜬다.',
  },
  {
    name: 'home-hide-life — 지역 페이지까지 생활을 숨긴다',
    file: 'src/pages/region/RegionPage.tsx',
    find: '          showLife\n',
    replace: '',
    test: T,
    why: '메인 규칙이 지역 착지 페이지로 번져 생활 이용권이 거기서도 사라진다.',
  },
]
