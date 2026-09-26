/**
 * 🧬 주입 — 이용권 등록 · 숙소를 마이 안에서 (2026-09-26, 설계 §21 후속)
 *
 * 여기 있는 것들은 **전부 에러 없이** 회귀한다. 폼을 복제해도 동작하고(두 벌이 될 뿐),
 * `light-island` 를 빼도 렌더는 되고(다크에서 안 보일 뿐), 껍데기 반환 순서가 바뀌어도
 * 대부분의 사용자에겐 아무 일도 안 난다(도매 겸업 사장님에게만 마이가 통째로 사라진다).
 */
const TEST = 'src/tests/unit/seller-register-stays-in-my-2026-09-26.test.ts'
const TEST_GROUPS = 'src/tests/unit/seller-groups-in-my-2026-09-26.test.ts'

export default [
  {
    name: '🎟️ 등록 시트가 자기 입력 칸을 갖기 시작한다 (폼이 두 벌로 갈린다)',
    file: 'src/pages/user-profile/seller-section/VoucherNewSheet.tsx',
    find: '          <VoucherWizard embedded onClose={onClose} onCreated={onCreated} />',
    replace: '          <input placeholder="이용권 이름" />',
    test: TEST,
    why: '위저드는 3단계에 지도·사진·임시저장까지 얹혀 있다 — 시트용으로 다시 만들면 반드시 한쪽만 고쳐지고, 두 화면이 서로 다른 상품을 만든다.',
  },
  {
    name: '🎟️ 등록 위저드를 정적으로 끌고 온다 (마이 청크가 통째로 커진다)',
    file: 'src/pages/user-profile/seller-section/VoucherNewSheet.tsx',
    find: "const VoucherWizard = lazy(() => import('@/pages/SellerMealVoucherNewPage'))",
    replace: "import VoucherWizard from '@/pages/SellerMealVoucherNewPage'",
    test: TEST,
    why: '지도 SDK·업로드까지 딸린 화면이다 — 등록을 한 번도 안 하는 사람이 그 값을 매번 치른다.',
  },
  {
    name: '🏝️ 라이트 섬 클래스가 사라진다 (다크에서 흰 폼 위 흰 글자)',
    file: 'src/pages/user-profile/seller-section/VoucherNewSheet.tsx',
    find: '      <div className="light-island bg-white min-h-full">',
    replace: '      <div className="bg-white min-h-full px-3 py-3">',
    test: TEST,
    why: '이 페이지들은 대시보드 규칙상 `dark:` 가 금지돼 있다. 클래스가 없으면 전역 다크 입력 규칙이 이겨 글자가 안 보인다(2026-09-03 지도 검색창과 같은 사고).',
  },
  {
    name: '🪟 껍데기 반환이 도매 리다이렉트 뒤로 밀린다 (겸업 사장님의 마이가 사라진다)',
    file: 'src/components/SellerLayout.tsx',
    // 🔁 2026-09-26 재조준: `bare` → `bare || embedded`(마이 시트 컨텍스트 추가)로 줄이 바뀌었다.
    //   지키는 불변식은 그대로다 — **껍데기 반환이 도매 리다이렉트보다 먼저**여야 한다.
    // 🔁 2026-09-26: 조기 반환이 여러 줄 블록이 됐다. 지키는 불변식은 그대로 —
    //   **껍데기 반환이 도매 리다이렉트보다 먼저**여야 한다.
    // 🩸 첫 재조준은 헛돌았다 — 진짜 블록은 그대로 두고 **뒤에 복제본**만 넣어서, 순서 검사가
    //   여전히 통과했다. 결함을 실제로 재현하려면 도매 리다이렉트가 **먼저** 돌아야 한다.
    find: '  if (bare || embedded) {',
    replace: '  if (wholesaleOnly) return null\n  if (bare || embedded) {',
    test: TEST,
    why: '시트 안에서 `/wholesale` 로 튕기면 마이가 통째로 사라진다 — 좌석은 마이가 이미 확인하고 열었다.',
  },
  {
    name: '🎟️ 시트 안에서 라우팅해 마이를 떠난다 (작성 중인 내용이 날아간다)',
    file: 'src/pages/SellerMealVoucherNewPage.tsx',
    find: "                onClick={() => { if (embedded) { onClose?.(); return } navigate('/seller/group-buy') }}",
    replace: "                onClick={() => navigate('/seller/group-buy')}",
    test: TEST,
    why: '시트는 닫는 것이지 이동하는 게 아니다 — 취소 한 번에 마이 전체가 사라진다.',
  },
  {
    name: '🎟️ 시트에서도 로그인 리다이렉트를 탄다 (쓰던 내용이 날아간다)',
    file: 'src/pages/SellerMealVoucherNewPage.tsx',
    find: '  if (!isSellerAuthenticated()) { if (!embedded) { redirectToLogin(navigate); return null } }',
    replace: '  if (!isSellerAuthenticated()) { redirectToLogin(navigate); return null }',
    test: TEST,
    why: '마이는 이미 로그인 상태이고 좌석도 맞춰 열었다 — 여기서 튕기면 3단계까지 쓴 내용이 사라진다.',
  },
  {
    name: '🏨 숙소 시트가 쓰기를 시작한다 (좌석 확인 없이 남의 가게를 고친다)',
    file: 'src/pages/user-profile/seller-section/StaysSheet.tsx',
    find: "                  onClick={() => onOpen(`/seller/stays/${s.id}`)}",
    replace: "                  onClick={() => { import('@/lib/api').then(({ default: api }) => api.put(`/api/seller/stays/${s.id}`, {})) }}",
    test: TEST,
    why: '이 시트는 읽기 전용이라 `assertSeat` 이 없다 — 쓰기가 생기면 그 가드 없이 나간다.',
  },
  {
    name: '🏝️ 새 라이트 섬을 커버리지 표에 안 올린다 (다크 검사 밖으로 조용히 나간다)',
    file: 'src/tests/unit/dark-contrast-coverage-2026-09-16.test.ts',
    find: "  'src/pages/user-profile/seller-section/VoucherNewSheet.tsx': { by: '/user/profile',",
    replace: "  'src/pages/user-profile/seller-section/__none__.tsx': { by: '/user/profile',",
    test: 'src/tests/unit/dark-contrast-coverage-2026-09-16.test.ts',
    why: '2026-09-26 에 실제로 CI 를 넘어뜨린 자리다 — 라이트 섬은 다크에서도 흰 표면이라, 표에서 빠지면 그 화면만 대비 검사 밖으로 조용히 나간다.',
  },
  {
    name: '🎫 쿠폰 라우트를 지운다 (플래그를 false 로 해도 안 돌아온다)',
    file: 'src/routes/seller.routes.tsx',
    find: '      <Route path="/seller/coupons" element={',
    replace: '      <Route path="/seller/coupons-removed" element={',
    test: TEST,
    why: '숨긴 근거는 "지금 안 쓴다"(셀러 생성 0건)이지 "영원히 틀렸다" 가 아니다 — 되돌릴 수 있어야 한다.',
  },
  {
    name: '🎫 쿠폰을 근거 없이 다시 메뉴에 올린다',
    file: 'src/components/seller/seller-nav.ts',
    find: "      ...(SELLER_COUPONS_HIDDEN ? [] : [navFromGroup('/seller/coupons')]),",
    replace: "      navFromGroup('/seller/coupons'),",
    test: TEST,
    why: '라이브 실측으로 셀러 생성 0건을 확인하고 내린 것이다 — 되살리려면 플래그를 false 로 하고 이유를 남겨야 한다.',
  },
  {
    name: '🎫 쿠폰 탭 묶음만 남는다 (착지점이 사이드바에 없어 위치를 잃는다)',
    file: 'src/components/seller/seller-tab-groups.ts',
    find: '  ...(SELLER_COUPONS_HIDDEN ? [] : [{',
    replace: '  ...([{',
    test: 'src/tests/unit/voucher-nav-reachability-2026-09-03.test.ts',
    why: '이 커밋에서 실제로 난 회귀다 — 쿠폰을 사이드바에서만 내렸더니 그 묶음의 착지점이 사라져, 탭으로 이동한 순간 사이드바 줄이 꺼진다(pre-push 게이트가 잡았다).',
  },
  {
    name: '🎟️ 이용권 묶음이 등록 시트 대신 경로로 나간다',
    file: 'src/pages/user-profile/seller-section/VoucherSheet.tsx',
    find: '            onClick={() => setAdding(true)}',
    replace: "            onClick={() => onOpenPath('/seller/meal-voucher/new')}",
    test: TEST_GROUPS,
    why: '대표 지시가 "등록도 마이에서" 다 — 경로로 나가면 마이를 떠나고 귀환 띠에 의존하게 된다.',
  },
]
