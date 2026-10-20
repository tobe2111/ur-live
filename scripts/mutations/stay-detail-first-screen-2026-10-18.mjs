/**
 * 🛏️ 숙소 상세 첫 화면이 남의 봉투를 받던 것 (2026-10-18) — 주입 매니페스트.
 * 가드: src/tests/unit/stay-detail-first-screen-2026-10-18.test.ts
 */
const TEST = 'src/tests/unit/stay-detail-first-screen-2026-10-18.test.ts'

export default [
  {
    name: '[stay-first] 편의시설 아이콘을 다시 정적으로',
    file: 'src/pages/stay-detail/amenity-meta.tsx',
    find: "const AmenityIcon = lazy(() => import('./AmenityIcon'))",
    replace: "import AmenityIcon from './AmenityIcon'",
    test: TEST,
    why: '숙소 상세 첫 화면이 lucide 아이콘 봉투 셋(~22KB br)을 다시 받는다 — 에러 0.',
  },
  {
    name: '[stay-first] fallback 자리를 비운다',
    file: 'src/pages/stay-detail/amenity-meta.tsx',
    find: '<Suspense fallback={<span className={`${AMENITY_ICON_CLS} inline-block shrink-0`} aria-hidden />}>',
    replace: '<Suspense fallback={null}>',
    test: TEST,
    why: '아이콘이 늦게 도착할 때 시설 낱말이 16px 씩 오른쪽으로 밀린다.',
  },
  {
    name: '[stay-first] 판정 순서가 바뀐다(스파가 수영보다 먼저)',
    file: 'src/pages/stay-detail/amenity-meta.tsx',
    find: "  if (has('수영', '풀', 'pool')) return 'pool'\n",
    replace: '',
    test: TEST,
    why: "'수영장' 이 기본 체크로 떨어지고 '온수풀' 이 스파로 간다 — 종전 결과와 달라진다.",
  },
  {
    name: '[stay-first] 숙소 상세가 공용 lucide 아이콘을 다시 부른다',
    file: 'src/pages/StayDetailPage.tsx',
    find: "import { Calendar, Sparkles } from 'lucide-react'",
    replace: "import { Calendar, Sparkles, Hotel } from 'lucide-react'",
    test: TEST,
    why: 'Hotel 하나 때문에 공용 lucide 봉투(10KB br)가 숙소 상세 첫 화면에 다시 실린다.',
  },
  {
    name: '[stay-first] 편의시설 아이콘이 다시 lucide 를 부른다',
    file: 'src/pages/stay-detail/AmenityIcon.tsx',
    find: "import type { ReactNode } from 'react'",
    replace: "import type { ReactNode } from 'react'\nimport { Car } from 'lucide-react'",
    test: TEST,
    why: 'lazy 아이콘 청크가 교환권·홈 봉투(압축 ~28KB)를 다시 의존으로 단다 — 첫 화면 예산엔 안 잡혀 조용하다.',
  },
]
