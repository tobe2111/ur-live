/**
 * 🔒 매장 확정 (2026-09-15, 대표 "매장을 등록해야 그 매장에 맞는 이용권만 만들지") — 주입 매니페스트.
 * 가드: src/tests/unit/store-canonical-2026-09-15.test.ts
 */
const TEST = 'src/tests/unit/store-canonical-2026-09-15.test.ts'

export default [
  {
    name: '🔒 등록 핸들러가 매장 확정을 건너뛴다 (좌석 A + 매장 B 상호가 다시 가능해진다)',
    file: 'src/features/seller/api/seller-orders.routes.ts',
    find: '        Object.assign(body, fields);',
    replace: '        void fields;',
    test: TEST,
    why: '이용권↔매장 결합의 유일한 키는 좌석인데 상호는 폼 텍스트다 — 반영하지 않으면 소비자는 B, 정산은 A 로 갈린다.',
  },
  {
    name: '🔒 빠른 등록(이용권 아님)에는 매장 필드를 안 쓴다 (소비자 지도에서 사라진다)',
    file: 'src/features/seller/api/seller-orders.routes.ts',
    find: '        if (!isVoucherCategory(category)) await writeVoucherProductFields(db, Number(productId), fields);',
    replace: '        if (false) await writeVoucherProductFields(db, Number(productId), fields);',
    test: TEST,
    why: '/seller/products/quick 은 매장을 아예 안 묻는다 — 여기서 안 채우면 restaurant_lat/lng 가 비어 지도·근처순에 영원히 안 뜬다.',
  },
  {
    name: '🔒 확정이 이용권 writer 뒤로 밀린다 (폼 값이 이미 저장된 뒤라 무의미)',
    file: 'src/worker/utils/store-profile.ts',
    find: '  const canonical: Record<string, string> = { restaurant_name: name }',
    replace: '  const canonical: Record<string, string> = {}',
    test: TEST,
    why: '상호가 확정 대상에서 빠지면 이 수리의 본체가 사라진다 — 나머지 필드만 맞고 이름은 여전히 갈린다.',
  },
  {
    name: '🔒 개인 셀러의 계정 이름을 상호로 쓴다 (사람 이름이 매장명이 된다)',
    file: 'src/worker/utils/store-profile.ts',
    find: '  const isStore = isStoreOwner(seller?.seller_type)',
    replace: '  const isStore = true',
    test: TEST,
    why: 'store_owner 가 아닌 좌석의 `name` 은 사람 이름이다 — 상호로 쓰면 소비자 지도에 개인 이름이 가게로 뜬다.',
  },
  {
    name: '🔒 프로필에 좌표가 없어도 폼 좌표를 버린다 (지도에서 처음 고른 값이 사라진다)',
    file: 'src/worker/utils/store-profile.ts',
    find: "  const put = (key: string, v: string) => { if (v) canonical[key] = v }",
    replace: '  const put = (key: string, v: string) => { canonical[key] = v }',
    test: TEST,
    why: '빈 canonical 로 덮으면 첫 등록 매장이 좌표 없이 저장돼 소비자 지도·근처순에서 통째로 빠진다.',
  },
]
