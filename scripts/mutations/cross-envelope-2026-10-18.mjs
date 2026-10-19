/**
 * 🔀 장바구니·로그아웃 마이가 남의 봉투를 통째로 받던 것 (2026-10-18) — 주입 매니페스트.
 * 가드: src/tests/unit/cross-envelope-2026-10-18.test.ts
 */
const TEST = 'src/tests/unit/cross-envelope-2026-10-18.test.ts'

export default [
  {
    name: '[cross-envelope] app-cross 규칙이 사라진다',
    file: 'vite.config.ts',
    find: "if (CROSS_MODULES.some((p) => id.includes(p))) return 'app-cross'",
    replace: "if (false) return 'app-cross'",
    test: TEST,
    why: '작은 공용 부품이 다시 app-components 로 떨어져 장바구니·로그아웃 마이가 그 봉투 전체(~70KB)를 받는다 — 에러 0.',
  },
  {
    name: '[cross-envelope] 묶음기가 app-cross 를 다시 가른다',
    file: 'scripts/surface-chunks.mjs',
    find: "'app-ui-utils', 'app-cross', 'app-map-row',",
    replace: "'app-ui-utils', 'app-map-row',",
    test: TEST,
    why: '묶음기가 app-cross 모듈을 쓰는 페이지 봉투로 옮겨 다시 남의 봉투를 끌고 온다.',
  },
  {
    name: '[cross-envelope] 장바구니 옵션 모달을 다시 정적으로',
    file: 'src/pages/CartPage.tsx',
    find: "const OptionSelectModal = lazy(() => import('@/components/OptionSelectModal'))",
    replace: "import OptionSelectModal from '@/components/OptionSelectModal'",
    test: TEST,
    why: '열지도 않는 모달 때문에 장바구니 첫 화면이 사진 슬라이드(embla)까지 받는다.',
  },
  {
    name: '[cross-envelope] 결제 유틸을 다시 정적으로',
    file: 'src/pages/cart/voucher-checkout.ts',
    find: "import api from '@/lib/api'\n",
    replace: "import api from '@/lib/api'\nimport { appendPaySummary } from '@/shared/pay-summary'\n",
    test: TEST,
    why: '결제 버튼을 누르기 전에는 안 쓰는 모듈이 이용권 상세 봉투를 장바구니 첫 화면에 끌고 온다.',
  },
]
