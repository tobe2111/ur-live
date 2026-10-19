/**
 * 🔎 검색 첫 화면이 지도 봉투를 통째로 받던 것 (2026-10-19) — 주입 매니페스트.
 * 가드: src/tests/unit/search-first-screen-2026-10-19.test.ts
 */
const TEST = 'src/tests/unit/search-first-screen-2026-10-19.test.ts'

export default [
  {
    name: '[search-first] app-map-row 규칙이 사라진다',
    file: 'vite.config.ts',
    find: "if (MAP_ROW_MODULES.some((p) => id.includes(p))) return 'app-map-row'",
    replace: "if (false) return 'app-map-row'",
    test: TEST,
    why: '결과 한 줄이 지도 봉투로 돌아가 검색 첫 화면이 지도·홈 지도 봉투·카카오 로더(~44KB br)를 다시 받는다 — 에러 0.',
  },
  {
    name: '[search-first] 묶음기가 app-map-row 를 다시 가른다',
    file: 'scripts/surface-chunks.mjs',
    find: "'app-cross', 'app-map-row', 'app-region-grid'])",
    replace: "'app-cross', 'app-region-grid'])",
    test: TEST,
    why: '묶음기가 그 넷을 쓰는 페이지 봉투로 옮겨 다시 지도 봉투를 끌고 온다.',
  },
  {
    name: '[search-first] 결과 한 줄이 지도 화면 모듈을 import 한다',
    file: 'src/pages/restaurant-map/RestaurantRow.tsx',
    find: "import CatIcon from './CatIcon'\n",
    replace: "import CatIcon from './CatIcon'\nimport RestaurantList from './RestaurantList'\nvoid RestaurantList\n",
    test: TEST,
    why: '고정 묶음이 지도 목록을 정적으로 끌어 검색이 지도 봉투를 다시 받는다.',
  },
  {
    name: '[search-first] 인기 검색어 아이콘이 lucide 로 돌아간다',
    file: 'src/components/search/SearchStates.tsx',
    find: "import { X } from 'lucide-react'",
    replace: "import { X, TrendingUp } from 'lucide-react'\nvoid TrendingUp",
    test: TEST,
    why: '아이콘 하나 때문에 lucide 봉투(br 10.2KB)가 검색 첫 화면에 다시 실린다.',
  },
]
