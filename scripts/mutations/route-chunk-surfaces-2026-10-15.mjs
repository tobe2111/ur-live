/** 🐢 로딩 화면이 뜨던 페이지 9곳 청크 병렬화 + 묶음기 결함 둘 (2026-10-15) — 가드: src/tests/unit/route-chunk-surfaces-2026-10-15.test.ts */
const TEST = 'src/tests/unit/route-chunk-surfaces-2026-10-15.test.ts'
export default [
  {
    name: '🐢 묶음기가 lazy 로만 쓰는 모듈을 다시 공용 봉투로 올린다',
    file: 'scripts/surface-chunks.mjs',
    find: "        if (lazyOnly(set) && users >= commonMin) { group.set(m, null); continue }\n",
    replace: '',
    test: TEST,
    why: '결제 위젯이 lz-common 에 들어가 stripe·toss 를 끌고 온다 — 전 화면 +15~21KB(br) 실측.',
  },
  {
    name: '🐢 lazy 로만 쓰는 작은 묶음을 다시 공용으로 합친다',
    file: 'scripts/surface-chunks.mjs',
    find: '(lazyOnly(labels.get(m)) ? g : \'lz-common\')',
    replace: "'lz-common'",
    test: TEST,
    why: '첫 화면 봉투가 나중에만 쓰는 코드를 정적으로 실어 나른다.',
  },
  {
    name: '🐢 공용 기준을 다시 고정값 4 로',
    file: 'vite.config.ts',
    find: 'commonMin: Number(process.env.LZ_COMMON || Math.max(4, Math.ceil(Object.keys(SURFACE_ROUTES).length * 0.4))),',
    replace: 'commonMin: Number(process.env.LZ_COMMON || 4),',
    test: TEST,
    why: '표면 19곳에서 새 표면 넷이 같이 쓰는 모듈이 전부 공용이 돼 기존 화면이 +7~9KB(br) 무거워진다.',
  },
  {
    name: '🐢 로그인한 사람에게도 로그인 전 화면 청크를 미리 받게 한다',
    file: 'src/worker/index.ts',
    find: "url.pathname === '/user/profile' ? (authed ? null : 'guestMy')",
    replace: "url.pathname === '/user/profile' ? 'guestMy'",
    test: TEST,
    why: '로그인 사용자의 마이는 다른 화면인데 안 쓰는 로그인 전 청크를 받는다.',
  },
  {
    name: '🐢 장바구니가 청크 맵에서 빠진다',
    file: 'scripts/generate-route-chunk-map.mjs',
    find: "  cart: ['src/pages/CartPage.tsx'],\n",
    replace: '',
    test: TEST,
    why: '장바구니(로그아웃) 페이지 청크가 앱 부팅 뒤에야 출발한다 — 실측 5.6초.',
  },
]
