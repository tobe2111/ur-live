// 🗺️ 2026-10-19 — 지역 페이지가 PC 홈 봉투를 다시 받는 방향.
const T = 'src/tests/unit/region-first-screen-2026-10-19.test.ts'
export default [
  {
    name: '[region-first-screen] 지역 링크 표 규칙이 사라진다',
    file: 'vite.config.ts',
    find: "          if (REGION_GRID_MODULES.some((p) => id.includes(p))) return 'app-region-grid'\n",
    replace: '\n',
    test: T,
    why: '지역 첫 화면(색인 44개)이 PC 홈 전용 봉투를 다시 받는다 — 에러 0.',
  },
  {
    name: '[region-first-screen] 보호 목록에서 빠진다',
    file: 'scripts/surface-chunks.mjs',
    find: "'app-map-row', 'app-region-grid', 'app-subpage'])",
    replace: "'app-map-row', 'app-subpage'])",
    test: T,
    why: '묶음기가 이름을 lz-homePc 로 덮어써 규칙이 헛돈다.',
  },
  {
    name: '[region-first-screen] 부품이 홈 봉투 모듈을 import 한다',
    file: 'src/components/region/RegionLinkGrid.tsx',
    find: "import { Link } from 'react-router-dom'",
    replace: "import { Link } from 'react-router-dom'\nimport { usePopularDeals } from '@/pages/pc-home/usePopularDeals'\nvoid usePopularDeals",
    test: T,
    why: '고정 묶음이 PC 홈 봉투를 끌면 옮긴 효과가 사라진다.',
  },
]
