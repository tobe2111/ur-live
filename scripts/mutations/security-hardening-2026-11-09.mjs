/**
 * 🔐 2026-11-09 보안 전수조사 수리 — 주입 매니페스트.
 * 가드: src/tests/unit/security-hardening-2026-11-09.test.ts
 */
const TEST = 'src/tests/unit/security-hardening-2026-11-09.test.ts'

export default [
  {
    name: '[sec] 셀러 PIN 검증을 객체 참/거짓 판정으로 되돌린다',
    file: 'src/features/seller/api/seller-pin.routes.ts',
    find: '  const { valid: ok } = await verifyPassword(pin, pinHash)',
    replace: '  const ok = await verifyPassword(pin, pinHash)',
    test: TEST,
    why: '객체는 늘 참이라 아무 PIN 이나 통과한다 — 정산 계좌 변경의 유일한 2차 인증이 사라진다.',
  },
  {
    name: '[sec] 카카오 연결 해제 비밀번호 검사를 객체 판정으로 되돌린다',
    file: 'src/features/seller/api/seller-kakao-link.routes.ts',
    find: '    const { valid: ok } = await verifyPassword(body.current_password, seller.password_hash)',
    replace: '    const ok = await verifyPassword(body.current_password, seller.password_hash)',
    test: TEST,
    why: '아무 비밀번호로 카카오 연결을 끊을 수 있게 된다.',
  },
  {
    name: '[sec] 데모 시드 키 게이트 엔드포인트를 되살린다',
    file: 'src/features/products/api/products.routes.ts',
    find: "registerProductViewRoutes(productsRoutes as never);",
    replace: "registerProductViewRoutes(productsRoutes as never);\nconst DEMO_SEED_KEY = 'urdeal-demo-seed-2026';\nproductsRoutes.post('/demo-seed-linkshop', async (c) => c.json({ ok: DEMO_SEED_KEY }));",
    test: TEST,
    why: '키가 공개 레포에 있어 누구나 아무 매장에 상품·리뷰를 넣는다.',
  },
  {
    name: '[sec] 알림 설정 PUT 의 열 이름 허용 목록 검사를 뺀다',
    file: 'src/features/admin/api/admin-notification-settings.routes.ts',
    find: "if (typeof v === 'boolean' && CHANNEL_COLUMNS.has(k)) {",
    replace: "if (typeof v === 'boolean') {",
    test: TEST,
    why: '본문 키가 그대로 SQL 에 들어가 관리자 비밀번호 해시를 읽을 수 있다.',
  },
  {
    name: '[sec] 이미지 프록시의 래스터 검사를 뺀다',
    file: 'src/worker/index.ts',
    find: "    if (!RASTER.test(type)) return c.json({ success: false, error: 'not an image' }, 415);\n",
    replace: '',
    test: TEST,
    why: '허용 호스트에 올린 HTML 이 우리 출처에서 열린다.',
  },
  {
    name: '[sec] nonce 리라이터의 /api 제외를 뺀다',
    file: 'src/worker/index.ts',
    find: "if (ct.includes('text/html') && c.res.body && !new URL(c.req.url).pathname.startsWith('/api/')) {",
    replace: "if (ct.includes('text/html') && c.res.body) {",
    test: TEST,
    why: '/api 가 내보내는 남의 HTML 스크립트에도 nonce 가 붙어 CSP 가 무력화된다.',
  },
]
