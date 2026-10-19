// 🧳 2026-10-19 — 장바구니·숙소 목록·마이 설정이 lucide 봉투를 다시 끌어오는 방향.
const T = 'src/tests/unit/lucide-drag-first-screen-2026-10-19.test.ts'
export default [
  {
    name: '[lucide-drag] 장바구니 합배송이 다시 PackageCheck',
    file: 'src/pages/CartPage.tsx',
    find: "import { ChevronRight, X } from 'lucide-react'",
    replace: "import { ChevronRight, X, PackageCheck } from 'lucide-react'",
    test: T,
    why: '합배송 표시 하나로 장바구니가 lucide 봉투(br 10KB)를 다시 받는다 — 에러 0.',
  },
  {
    name: '[lucide-drag] 숙소 목록 달력이 다시 lucide',
    file: 'src/pages/StaysSearchPage.tsx',
    find: "import { Search, SlidersHorizontal, X } from 'lucide-react'",
    replace: "import { Search, Calendar, SlidersHorizontal, X } from 'lucide-react'",
    test: T,
    why: '숙소 목록이 달력 하나로 lucide 봉투를 다시 받는다.',
  },
  {
    name: '[lucide-drag] 테마 선택이 다시 lucide 해',
    file: 'src/components/settings/ThemeToggleSection.tsx',
    find: "import { useTranslation } from '@/lib/i18n-lite'",
    replace: "import { Sun } from 'lucide-react'\nimport { useTranslation } from '@/lib/i18n-lite'",
    test: T,
    why: '마이·로그아웃 마이가 설정의 해 하나로 lucide 봉투를 다시 받는다.',
  },
  {
    name: '[lucide-drag] 로컬 달력의 획이 세트와 갈린다',
    file: 'src/pages/StaysSearchPage.tsx',
    find: 'strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">\n      <rect x="3.8"',
    replace: 'strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">\n      <rect x="3.8"',
    test: T,
    why: '로컬 그림이 세트와 다른 획으로 그려져 같은 줄의 아이콘끼리 두께가 갈린다.',
  },
]
