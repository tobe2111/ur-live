/** 🐢 로딩 화면이 뜨던 페이지 9곳 preload 전용 표면 (2026-10-15) — 가드: src/tests/unit/route-chunk-surfaces-2026-10-15.test.ts */
const TEST = 'src/tests/unit/route-chunk-surfaces-2026-10-15.test.ts'
export default [
  {
    name: '🐢 생성기가 preload 전용 표를 맵에 안 낸다',
    file: 'scripts/generate-route-chunk-map.mjs',
    find: 'Object.entries({ ...ROUTES, ...PRELOAD_ONLY_ROUTES })',
    replace: 'Object.entries(ROUTES)',
    test: TEST,
    why: '워커가 주입할 청크가 없어 9곳이 다시 앱 부팅 뒤에야 페이지 청크를 받는다(실측 장바구니 5.6초).',
  },
  {
    name: '🐢 preload 전용 표면을 묶음기 입력(ROUTES)에 섞는다',
    file: 'scripts/generate-route-chunk-map.mjs',
    find: "  urshorts: ['src/pages/UrShortsBrowsePage.tsx'],\n}",
    replace: "  urshorts: ['src/pages/UrShortsBrowsePage.tsx'],\n  cart: ['src/pages/CartPage.tsx'],\n}",
    test: TEST,
    why: '묶음이 다시 짜여 결제 위젯이 공용 봉투로 간다 — 전 화면 +15~21KB(br) 실측.',
  },
  {
    name: '🐢 로그인한 사람에게도 로그인 전 화면 청크를 미리 받게 한다',
    file: 'src/shared/route-surface.ts',
    find: "if (p === '/user/profile') return authed ? null : 'guestMy'",
    replace: "if (p === '/user/profile') return 'guestMy'",
    test: TEST,
    why: '로그인 사용자의 마이는 다른 화면인데 안 쓰는 로그인 전 청크를 받는다.',
  },
  {
    name: '🐢 장바구니가 preload 전용 표에서 빠진다',
    file: 'scripts/generate-route-chunk-map.mjs',
    find: "  cart: ['src/pages/CartPage.tsx'],\n",
    replace: '',
    test: TEST,
    why: '장바구니(로그아웃) 페이지 청크가 앱 부팅 뒤에야 출발한다 — 실측 5.6초.',
  },
]
