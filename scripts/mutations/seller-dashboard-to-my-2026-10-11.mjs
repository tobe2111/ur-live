/** 🚪 셀러 대시보드 → 마이 (2026-10-11) — 가드: src/tests/unit/seller-dashboard-to-my-2026-10-11.test.ts */
const TEST = 'src/tests/unit/seller-dashboard-to-my-2026-10-11.test.ts'
const FILE = 'src/pages/SellerPage.tsx'
export default [
  {
    name: '[대시보드→마이] 에이전시 직원도 마이로 보낸다',
    file: FILE,
    find: "    if (isAgencySeatToken(localStorage.getItem('seller_token'))) return false\n",
    replace: '',
    test: TEST,
    why: '에이전시 직원은 마이가 없다 — 맡은 매장을 열면 빈 마이로 튕긴다.',
  },
  {
    name: '[대시보드→마이] 마이 시트 안에서도 보낸다',
    file: FILE,
    find: '  if (embedded) return false\n',
    replace: '',
    test: TEST,
    why: '시트 안 대시보드가 바깥으로 튕겨 시트가 닫힌다.',
  },
]
