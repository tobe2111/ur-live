/** 🧬 주입 — 로그인 전 예시 이용권 (2026-11-03 재조준 — 종전: 유어샵 예시 진열대 자리 잡기 2026-10-19) */
const T = 'src/tests/unit/guest-urshop-reserve-2026-10-19.test.tsx'
export default [
  { name: '게스트예시 — 이용권 탭이 실제 인기 이용권을 다시 부른다', file: 'src/pages/guest/GuestPassPage.tsx', find: "import GuestExampleRows from './GuestExampleRows'\n", replace: "import GuestExampleRows from './GuestExampleRows'\nimport { usePopularPasses } from './usePopularPasses'\n", test: T, why: '로그아웃 화면에 남의 가게 실제 상품이 예시처럼 뜬다(대표가 지적한 그 증상).' },
  { name: '게스트예시 — 예시 줄을 누르면 진짜 상세로 간다', file: 'src/pages/guest/GuestExampleRows.tsx', find: '          surface="plain"\n', replace: '          surface="plain"\n          to="/pass/1"\n', test: T, why: '예시를 눌러 실제 상품으로 가면 예시가 아니다.' },
  { name: '게스트예시 — 예시가 두 줄로 줄었다', file: 'src/shared/guest-page.ts', find: "  { store: '합정 파스타', name: '파스타 세트 2인', pct: 20, price: 36000, kind: 'meal' },\n", replace: '', test: T, why: '시안(예시 3줄)과 화면이 갈린다.' },
]
