/** 🧬 주입 — /products/:id 정본 302. 가드: src/tests/unit/product-canonical-redirect-2026-11-11.test.ts */
const T = 'src/tests/unit/product-canonical-redirect-2026-11-11.test.ts'
const U = 'src/worker/utils/product-canonical-redirect.ts'
export default [
  { name: '상품정본 — 워커 배선을 뺀다(이용권을 /products 로 열면 다시 2초)', file: 'src/worker/index.ts', find: " if (ssrSlot === 'PRODUCT' && !url.search) { const canon = productCanonicalRedirect(ssrPayload, url.pathname); if (canon) { c.res = new Response(null, { status: 302, headers: { Location: canon, 'Cache-Control': 'no-store' } }); return; } }", replace: "", test: T, why: '앱이 켜지고 상품을 읽은 뒤에야 정본으로 넘긴다(라이브 2.0s).' },
  { name: '상품정본 — 쿼리가 있어도 서버가 넘긴다(?ref= 귀속 기록을 건너뛴다)', file: 'src/worker/index.ts', find: "if (ssrSlot === 'PRODUCT' && !url.search) {", replace: "if (ssrSlot === 'PRODUCT') {", test: T, why: '`ProductDetailPage` 가 넘기기 전에 소개자(ref)를 기기에 적는다 — 서버가 먼저 넘기면 그 줄이 안 돈다(귀속 = 머니 경로).' },
  { name: '상품정본 — 몰 상품도 넘긴다(몰 화면 대신 본진 이용권 화면)', file: U, find: "    if (mallRedirectPathFor(p)) return null", replace: "", test: T, why: '화면은 몰 경로를 먼저 본다 — 서버가 순서를 바꾸면 몰 상품이 본진 상세로 간다.' },
  { name: '상품정본 — 시드의 상품 번호를 안 본다(남의 상품으로 넘긴다)', file: U, find: "if (!m || String(p.id) !== m[1]) return null", replace: "if (!m) return null", test: T, why: '낡은 캐시가 다른 상품을 주면 그 상품의 종류로 넘긴다.' },
  { name: '상품정본 — 화면의 안전판을 지운다(시드가 없을 때 쇼핑 상세에 갇힌다)', file: 'src/pages/ProductDetailPage.tsx', find: "if (dest) navigate(`${dest}${window.location.search}`, { replace: true })", replace: "", test: T, why: '시드가 없거나 쿼리가 있는 주소는 앱이 넘긴다 — 지우면 이용권이 쇼핑 화면에 뜬다.' },
]
