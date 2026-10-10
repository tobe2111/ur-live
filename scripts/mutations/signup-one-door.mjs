/**
 * 🚪 가입 문 하나 · 약관 동의 · 중개 승계 (2026-10-10 대표 "1,2,5번은 해주고")
 * 가드: src/tests/unit/signup-one-door-2026-10-10.test.ts
 */
const TEST = 'src/tests/unit/signup-one-door-2026-10-10.test.ts'

export default [
  {
    name: '🚪 옛 가입 폼이 다시 라우트에 붙는다 (문이 둘)',
    file: 'src/routes/seller.routes.tsx',
    find: '      <Route path="/seller/register/supplier" element={<LegacySellerRegisterRedirect />} />',
    replace: '      <Route path="/seller/register/supplier" element={<SellerRegisterSupplierPage />} />',
    test: TEST,
    why: '문이 둘이면 약관·귀속 규칙이 다시 갈린다(오늘 고친 그 상태).',
  },
  {
    name: '🚪 새 문이 영입 귀속을 빠뜨린다',
    file: 'src/features/seller/api/seller-stores.routes.ts',
    find: '    await afterStoreCreated(c.env.DB,',
    replace: '    void (c.env.DB,',
    test: TEST,
    why: '영입자가 데려온 매장이 에러 없이 귀속을 잃는다.',
  },
  {
    name: '🚪 영입 귀속이 초대 링크 귀속을 덮는다',
    file: 'src/features/seller/api/store-signup-extras.ts',
    find: '          WHERE id = ? AND introduced_by_influencer_id IS NULL`,',
    replace: '          WHERE id = ?`,',
    test: TEST,
    why: '두 소개자 중 나중 것이 앞 사람의 귀속을 지운다.',
  },
  {
    name: '📜 서버가 약관 동의 없이 매장을 만든다',
    file: 'src/features/seller/api/seller-stores.routes.ts',
    find: "    if (termsErr) return c.json({ success: false, code: 'TERMS_REQUIRED', error: termsErr }, 400)",
    replace: '    void termsErr',
    test: TEST,
    why: '화면만 막으면 API 직호출로 동의 없는 매장이 생긴다(법적 공백).',
  },
  {
    name: '📜 화면이 약관 동의 없이 등록 버튼을 연다',
    file: 'src/components/seller/StoreRegisterModal.tsx',
    find: "    return termsAgreed ? null : '판매자 이용약관에 동의해주세요'",
    replace: '    return null',
    test: TEST,
    why: '버튼이 열리면 서버 400 을 만난다 — 사장님은 이유를 모른다.',
  },
  {
    name: '🔑 승계 코드가 다시 토스트 한 번으로 흘러간다',
    file: 'src/pages/StoreClaimPage.tsx',
    find: '                if (opts?.ownerClaimCode) { setHandoff(opts.ownerClaimCode); return }',
    replace: '',
    test: TEST,
    why: '대행사가 그 순간을 놓치면 사장님께 드릴 코드를 못 찾는다.',
  },
  {
    name: '🤝 사장님이 중개 조건에 동의하지 않아도 신청된다',
    file: 'src/features/seller/api/seller-store-claims.routes.ts',
    find: "        if (terms && (b.broker_terms_agreed !== true || !sameBrokerTerms(terms, b.broker_terms_seen))) {",
    replace: '        if (false) {',
    test: TEST,
    why: '대행사가 혼자 정한 요율을 사장님이 모른 채 넘겨받는다.',
  },
]
