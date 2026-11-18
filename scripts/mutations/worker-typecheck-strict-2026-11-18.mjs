/** 🧬 주입 — 워커 타입 검사 strict (2026-11-18) · 가드: src/tests/unit/worker-typecheck-strict-2026-11-18.test.ts */
const T = 'src/tests/unit/worker-typecheck-strict-2026-11-18.test.ts'
export default [
  { name: 'workertsc: 다시 경고만', file: '.github/workflows/verify.yml',
    find: '        run: npx tsc --noEmit --skipLibCheck --project tsconfig.worker.json\n',
    replace: '        run: npx tsc --noEmit --skipLibCheck --project tsconfig.worker.json\n        continue-on-error: true\n', test: T,
    why: '서버 타입 오류가 다시 조용히 쌓인다(348건이 그렇게 쌓였다).' },
  { name: 'workertsc: 첫 화면이 아이콘 모듈을 다시 끌어온다', file: 'src/worker/utils/map-first-screen.ts',
    find: "from '../../pages/restaurant-map/voucher-labels'", replace: "from '../../pages/restaurant-map/voucher-types'", test: T,
    why: '워커 번들에 React 아이콘이 딸려 오고 워커 타입 검사에 .tsx 가 들어온다.' },
]
