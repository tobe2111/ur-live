/**
 * 🧾 같은 사업자번호로 두 번째 매장 등록 (2026-09-16) — 주입 매니페스트.
 * 가드: src/tests/unit/store-business-number-2026-09-16.test.ts
 */
const TEST = 'src/tests/unit/store-business-number-2026-09-16.test.ts'
const ROUTE = 'src/features/seller/api/seller-stores.routes.ts'
const CLAIM = 'src/worker/utils/store-ownership-claims.ts'
const ADMIN = 'src/worker/routes/internal-admin-tools.routes.ts'

export default [
  {
    name: '🧾 번호를 다시 무조건 컬럼에 넣는다 (두 번째 매장이 500 으로 되돌아간다)',
    file: ROUTE,
    find: 'let ins = await insertStore(bnoFree ? bno : null)',
    replace: 'let ins = await insertStore(bno || null)',
    test: TEST,
    why: 'sellers.business_number 는 UNIQUE 다 — 같은 사업자의 두 번째 매장이 통째로 막힌다(08-26 이후 등록 0이던 그 원인).',
  },
  {
    name: '🧾 번호를 meta 에 안 남긴다 (두 번째 매장의 번호가 데이터에서 사라진다)',
    file: ROUTE,
    find: '...(bno ? { [BUSINESS_NUMBER_META_KEY]: normalizeBno(bno) } : {}),',
    replace: '',
    test: TEST,
    why: '컬럼이 UNIQUE 라 두 번째부터는 meta 가 유일한 자리다. 안 적으면 심사도 대조도 못 한다.',
  },
  {
    name: '🧾 UNIQUE 경합 재시도를 없앤다 (경합 한 번에 매장이 안 만들어진다)',
    file: ROUTE,
    find: 'const again = bnoFree ? await insertStore(null).catch((e: unknown) => e as Error) : ins',
    replace: 'const again = ins',
    test: TEST,
    why: 'D1 엔 트랜잭션이 없어 검사와 INSERT 사이에 번호를 뺏길 수 있다 — 그때도 매장은 만들어져야 한다.',
  },
  {
    name: '🧾 소유권 이전 대조가 컬럼만 본다 (두 번째 매장은 영원히 "모름")',
    file: CLAIM,
    find: 'const storeBno = await resolveBusinessNumber(DB, seller)',
    replace: "const storeBno = String(seller.business_number || '').replace(/-/g, '')",
    test: TEST,
    why: 'bno_match 가 null 로 굳으면 사업자등록증 대조가 심사에서 통째로 빠진다.',
  },
  {
    name: '🧾 어드민 승인 화면이 컬럼만 본다 (심사 칸이 빈다)',
    file: ADMIN,
    find: 'const bnos = await resolveBusinessNumbers(c.env.DB, rows).catch(() => new Map<number, string>())',
    replace: 'const bnos = new Map<number, string>()',
    test: TEST,
    why: '대표가 등록증과 번호를 대조하는 자리다 — 비면 승인 자체를 못 한다.',
  },
]
