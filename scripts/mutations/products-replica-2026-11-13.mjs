/** 🧬 주입 — 상품 목록·검색 읽기 사본. 가드: src/tests/unit/sections-roundtrips-2026-10-15.test.ts */
const T = 'src/tests/unit/sections-roundtrips-2026-10-15.test.ts'
export default [
  { name: '검색사본 — 목록·검색이 다시 원본(미국)만 읽는다', file: 'src/features/products/api/products.routes.ts', find: 'new ProductService(publicReadDb(DB))', replace: 'new ProductService(DB)', test: T, why: '2026-11-13 — 한국 손님 첫 검색어 0.4~1.0s 가 시드 마감 700ms 를 넘겼다.' },
]
