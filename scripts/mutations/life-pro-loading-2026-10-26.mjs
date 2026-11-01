/**
 * 🧬 주입 — 생활 페이지 하드로드 (2026-10-26 대표 "/life/pro 로딩이 상대적으로 많이 길어")
 *    가드: src/tests/unit/life-pro-loading-2026-10-26.test.ts
 */
const T = 'src/tests/unit/life-pro-loading-2026-10-26.test.ts'
export default [
  {
    name: '생활로딩 — 업체 등록이 결제 키 판정을 정적으로 다시 부른다',
    file: 'src/pages/life/pro/ProCredits.tsx',
    find: "import { formatNumber } from '@/utils/format'\n",
    replace: "import { formatNumber } from '@/utils/format'\nimport { resolveTossFlow } from '@/lib/toss-key-type'\n",
    test: T,
    why: '그 37줄짜리 파일이 든 이용권 상세 묶음(66KB raw)을 업체 등록 화면이 통째로 받는다.',
  },
  {
    name: '생활로딩 — 업체 등록이 표면 판정에서 빠진다',
    file: 'src/shared/route-surface.ts',
    find: "  if (p === '/life/pro') return 'lifePro'\n",
    replace: '',
    test: T,
    why: '하드로드 때 페이지 코드가 엔트리 뒤에야 출발하고 "페이지 로딩 중" 단계가 되살아난다.',
  },
  {
    name: '생활로딩 — 생활 허브를 React.lazy 로 되돌린다',
    file: 'src/App.tsx',
    find: "const LifePage = lazyPage(() => import('./pages/life/LifePage')); registerBootPage('life', LifePage.load);",
    replace: "const LifePage = lazy(() => import('./pages/life/LifePage'));",
    test: T,
    why: '모듈을 미리 받아도 lazy 가 첫 렌더에서 한 번 멈춰 0.5초 공개 지연을 탄다.',
  },
]
