/**
 * 🧨 도매몰 철거 — 지운 것/남긴 것 양방향 (2026-10-11 대표 "도매몰 잔해들은 아예 다 삭제해줘").
 * 가드: src/tests/unit/wholesale-teardown-2026-10-11.test.ts
 */
const TEST = 'src/tests/unit/wholesale-teardown-2026-10-11.test.ts'

export default [
  {
    name: '🧨 철거 — 소비자 앱에 /wholesale 라우트가 되살아난다',
    file: 'src/App.tsx',
    find: '            <Route path="/" element={<HomeRoute />} />',
    replace: '            <Route path="/wholesale" element={<HomeRoute />} />\n            <Route path="/" element={<HomeRoute />} />',
    test: TEST,
    why: '라우트를 되살리면 화면이 없으니 흰 페이지가 되고, 철거가 반쪽이 된다.',
  },
  {
    name: '🧨 철거 — 워커가 도매 라우트를 다시 마운트한다',
    file: 'src/worker/index.ts',
    find: "app.route('/api/admin/wholesale-malls', adminWholesaleMallRoutes);",
    replace: "app.route('/api/wholesale', adminWholesaleMallRoutes);",
    test: TEST,
    why: '도매 네임스페이스가 되살아나면 서비스 분리가 다시 흐려진다.',
  },
  {
    name: '🧨 철거 — 어드민 nav 에 도매 밴드가 다시 생긴다',
    file: 'src/components/admin/admin-nav-config.ts',
    find: "export type NavSectionKey =",
    replace: "const _revived = { domain: 'wholesale', };\nexport type NavSectionKey =",
    test: TEST,
    why: '대표가 2026-08-03 에 "잔재도 없애는거야" 라고 한 바로 그 메뉴다.',
  },
  {
    name: '🧨 빌드 스위치를 env 로 되살린다 (도매 번들 부활 경로)',
    file: 'scripts/build-worker.js',
    find: 'const INCLUDE_WHOLESALE = false;',
    replace: "const INCLUDE_WHOLESALE = process.env.WHOLESALE_BUNDLE === '1';",
    test: TEST,
    why: 'env 하나로 도매 그래프 전체가 번들에 돌아온다 — 코드가 사라졌으니 빌드가 깨진다.',
  },
  {
    name: '🔴 잔류 — 정산 엔진 호출부를 끊는다 (환불이 공급자 적립을 역전하지 못한다)',
    // ⚠️ 앵커는 **유일**해야 한다. `order-commissions.ts` 는 같은 동적 import 가 두 곳(142·308)이고
    //   앞뒤 줄까지 같아 가를 수 없다 ⇒ 호출부가 하나뿐인 `order-refund.ts` 로 앵커한다(같은 엔진·같은 불변식).
    file: 'src/worker/utils/order-refund.ts',
    find: "const { reverseSupplierOnRefund } = await import('../../features/supply/api/supply-settlement')",
    replace: "const reverseSupplierOnRefund = async (..._a: unknown[]) => {}",
    test: TEST,
    why: '철거의 최대 함정이 바로 이것이다 — 디렉터리 이름이 supply 라서 도매로 보이지만 소비자 결제가 부른다.',
  },
  {
    name: '🔴 잔류 — 겸업 lock-out 방어선(computeWholesaleOnly)을 뗀다',
    file: 'src/features/auth/api/seller.routes.ts',
    find: "import { computeWholesaleOnly } from '@/features/supply/api/wholesale-helpers';",
    replace: "const computeWholesaleOnly = async () => false;",
    test: TEST,
    why: '이름에 wholesale 이 들어갔지만 이건 셀러↔도매 겸업이 서로 튕기지 않게 하는 서버 권위 신호다.',
  },
  {
    name: '🔴 잔류 — 공구 서비스 몰 관리 API 마운트를 뺀다',
    file: 'src/worker/index.ts',
    find: "app.route('/api/admin/wholesale-malls', adminWholesaleMallRoutes);",
    replace: '// 제거됨',
    test: TEST,
    why: '2026-08-03 에 대표가 실측한 404 가 그대로 재발한다(화면은 있고 API 가 없다).',
  },
  {
    name: '🧨 철거 — 이름이 Supplier 인 옛 가입 링크를 같이 쓸어 간다',
    file: 'src/routes/seller.routes.tsx',
    find: '      <Route path="/seller/register/supplier" element={<LegacySellerRegisterRedirect />} />',
    replace: '',
    test: TEST,
    why: '2026-10-11 철거 때 이름만 보고 유어딜 가입 화면을 지웠던 바로 그 클래스다 — 이미 공유된 옛 가입 링크가 /store/new 대신 404 가 된다.',
  },
]
