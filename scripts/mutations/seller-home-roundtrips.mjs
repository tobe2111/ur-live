/**
 * 🐌 주입 — 셀러 홈 이용권 목록 앞의 스키마 보정 왕복.
 *
 * 2026-09-17, 대표 *"내 이용권이 너무 늦게 떠. 로딩이 느려."*
 * `src/tests/unit/seller-home-schema-roundtrips-2026-09-17.test.ts` 가 실패할 수 있는지 확인한다.
 */
const TEST = 'src/tests/unit/seller-home-schema-roundtrips-2026-09-17.test.ts'
const HELPERS = 'src/features/group-buy/api/helpers.ts'
// 🔀 2026-09-17 재조준 — 컬럼 읽기를 `worker/utils/ensure-columns.ts` 로 뺐다(helpers.ts 가 600줄 래칫).
const UTIL = 'src/worker/utils/ensure-columns.ts'
const ROUTE = 'src/features/seller/api/seller-orders.routes.ts'

export default [
  {
    name: '홈왕복 — products 컬럼 게이트를 없애 ALTER 20개가 다시 무조건 돈다',
    file: HELPERS,
    find: '    if (haveProducts.has(columnNameOf(col))) continue',
    replace: '',
    test: TEST,
    why: '라이브에선 20개 전부 실패하는 왕복이다 — 이용권 목록이 그걸 다 기다린 뒤에야 시작한다.',
  },
  {
    name: '홈왕복 — vouchers 컬럼 게이트를 없앤다',
    file: HELPERS,
    find: '    if (haveVouchers.has(columnNameOf(col))) continue',
    replace: '',
    test: TEST,
    why: '같은 클래스. 왕복 3회가 조용히 돌아온다.',
  },
  {
    name: '홈왕복 — 컬럼이 없어도 안 고친다 (self-heal 이 죽는다)',
    file: HELPERS,
    find: '    if (haveProducts.has(columnNameOf(col))) continue',
    replace: '    continue',
    test: TEST,
    why: '새 D1 이 "no such column" 으로 죽는다 — 빠르게 만들려다 self-heal 을 없애는 것이 이 수정의 최대 위험이다.',
  },
  {
    name: '홈왕복 — PRAGMA 실패를 "컬럼 다 있음"으로 오해한다',
    file: UTIL,
    find: "    .catch(() => ({ results: [] as { name: string }[] }))",
    replace: "    .catch(() => ({ results: [{ name: 'restaurant_name' }] as { name: string }[] }))",
    test: TEST,
    why: '목록을 못 읽었는데 있다고 치면 조용히 덜 고친다 — 못 읽으면 전부 시도가 맞다.',
  },
  {
    name: '홈왕복 — 두 보정을 다시 직렬로 기다린다',
    file: ROUTE,
    find: 'await Promise.all([ensureSupplyVisibilitySchema(db), ensureGroupBuyColumns(db)]);',
    replace: 'await ensureSupplyVisibilitySchema(db);\n    await ensureGroupBuyColumns(db);',
    test: TEST,
    why: '콜드 isolate 에서 두 보정의 왕복이 최댓값이 아니라 합으로 돌아온다.',
  },
]
