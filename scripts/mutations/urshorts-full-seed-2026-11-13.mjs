/** 🧬 주입 — 유어쇼츠 서버 시드 = 전량. 가드: src/tests/unit/urshorts-first-screen-2026-11-09.test.tsx */
const T = 'src/tests/unit/urshorts-first-screen-2026-11-09.test.tsx'
export default [
  { name: '유어쇼츠시드 — 레일 12편 시드로 되돌린다', file: 'src/worker/index.ts', find: "ssrTarget = { slot: 'URSHORTS', path: '/api/urshorts?all=1' };", replace: "ssrTarget = { slot: 'URSHORTS', path: '/api/urshorts' };", test: T, why: '2026-11-13 라이브 CLS 0.15 — 앱이 종류 칩 줄을 늦게 꽂았다.' },
  { name: '유어쇼츠시드 — 카드 상한을 지운다(60장 전부 HTML 로)', file: 'src/worker/utils/urshorts-first-screen.ts', find: 'items.slice(0, URSHORTS_FS_CARDS).map(', replace: 'items.map(', test: T, why: '편수·칩만 전량이면 되고 카드 60장은 HTML 만 불린다.' },
]
