/** 🔁 예열 주소 = 화면 주소 (2026-10-11) — 가드: src/tests/unit/prewarm-matches-feed-2026-10-11.test.ts */
const TEST = 'src/tests/unit/prewarm-matches-feed-2026-10-11.test.ts'
export default [
  {
    name: '[예열정합] 칩 예열이 정렬 없는 옛 주소로 돌아간다',
    file: 'src/worker/cron/cache-prewarm.ts',
    find: "  '/api/group-buy/products?status=active&category=meal_voucher&sort=popular',\n",
    replace: "  '/api/group-buy/products?status=active&category=meal_voucher',\n",
    test: TEST,
    why: '화면은 &sort=popular 를 붙여 부른다 — 옛 주소는 아무도 안 쓴다.',
  },
  {
    name: '[예열정합] 홈 피드 기본 요청이 예열에서 빠진다',
    file: 'src/worker/cron/cache-prewarm.ts',
    find: "  '/api/group-buy/products?status=active&category=all&sort=popular',\n",
    replace: '',
    test: TEST,
    why: '홈에 들어온 첫 사람이 피드를 콜드 D1 로 기다린다.',
  },
]
