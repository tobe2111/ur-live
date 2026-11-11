/**
 * 🧬 주입 — 매장 지도 자리 예약 (2026-11-11)
 *    가드: src/tests/unit/store-map-reserve-2026-11-11.test.ts
 */
const T = 'src/tests/unit/store-map-reserve-2026-11-11.test.ts'
export default [
  {
    name: '지도 상자가 최소 높이를 안 잡는다',
    file: 'src/pages/group-buy/StoreLocation.tsx',
    find: "overflow: 'hidden', minHeight: STORE_MAP_H, ",
    replace: "overflow: 'hidden', ",
    test: T,
    why: '지도가 뜨는 순간 주소·아래 카드가 48px 밀린다(라이브 CLS 0.0079).',
  },
  {
    name: '예약 높이가 지도 높이와 어긋난다',
    file: 'src/pages/group-buy/StoreLocation.tsx',
    find: 'const STORE_MAP_H = 220',
    replace: 'const STORE_MAP_H = 172',
    test: T,
    why: '예약이 지도보다 작으면 다시 밀린다.',
  },
]
