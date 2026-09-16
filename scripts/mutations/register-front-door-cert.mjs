/**
 * 🧬 주입 — 가입 앞문의 등록증 사본 (2026-09-16).
 * 각 항목은 "되돌리면 가짜 매장이 증거 없이 들어온다" 형태다.
 */
const TEST = 'src/tests/unit/register-front-door-cert-2026-09-16.test.ts'

export default [
  {
    name: 'register-cert: 업로드 칸을 지운다',
    file: 'src/pages/SellerRegisterSupplierPage.tsx',
    find: '<BusinessCertUpload value={certUrl} onChange={setCertUrl} />',
    replace: '<input id="cert-noop" />',
    test: TEST,
    why: '칸이 없으면 사진이 도착할 길이 자체가 없다 — 어드민이 대조할 근거가 사라진다.',
  },
  {
    // 🥕 2026-09-16 대표 *"복잡해서도 안되긴 하는데"* 로 **선택**이 됐다 → 방향이 뒤집힌 주입이다.
    //    "막는 코드가 돌아오면 빨간불" — 되돌아온 게이트는 에러가 아니라 **가입 이탈**이라 안 보인다.
    name: 'register-cert: 제출 게이트를 되살린다 (선택인데 다시 막는다)',
    file: 'src/pages/SellerRegisterSupplierPage.tsx',
    find: '    if (!termsAgreed) {',
    replace: '    if (!certUrl) { return }\n    if (!termsAgreed) {',
    test: TEST,
    why: '앞문 등록증은 선택으로 확정됐다. 게이트가 돌아오면 사장님이 사진을 못 찾아 가입을 그만둔다.',
  },
  {
    name: 'register-cert: 보내는 것만 빼먹는다 (칸은 그대로)',
    file: 'src/pages/SellerRegisterSupplierPage.tsx',
    find: '        business_cert_url: certUrl || undefined,',
    replace: '',
    test: TEST,
    why: '화면엔 올렸는데 서버엔 안 간다 — 사장님은 냈다고 믿고 어드민은 못 본다. 에러가 안 난다.',
  },
  {
    name: 'register-cert: 서버가 임의 URL 을 그대로 저장한다',
    file: 'src/features/seller/api/seller-registration.routes.ts',
    find: '    const certStored = BIZ_CERT_PATH.test(certUrl) ? certUrl : null',
    replace: '    const certStored = certUrl || null',
    test: TEST,
    why: '경로 검증이 빠지면 어드민 승인 화면이 남의 서버 이미지를 띄운다(대조 근거가 조작 가능해진다).',
  },
  {
    name: 'register-cert: 검수 대기 상태를 안 찍는다',
    file: 'src/features/seller/api/seller-registration.routes.ts',
    find: "      certStored ? 'pending' : null,",
    replace: '      null,',
    test: TEST,
    why: "사본은 저장되는데 상태가 없으면 어드민 화면에서 승인/반려 버튼이 뜨지 않는다.",
  },
  {
    name: 'register-cert: 선택 항목을 진행 분모에 넣는다',
    file: 'src/pages/SellerRegisterSupplierPage.tsx',
    find: '  const filled = filledRequired(form)',
    replace: '  const filled = filledRequired(form) + (certUrl ? 1 : 0)',
    test: TEST,
    why: '선택 항목이 분모에 들어가면 필수를 다 채워도 영영 5/6 이라 사장님이 고장으로 읽는다.',
  },
  {
    name: 'register-cert: 사본 도착 여부를 화면에 안 알려 준다',
    file: 'src/features/seller/api/seller-registration/session-routes.ts',
    find: 'has_business_cert: !!seller.business_registration_image_url,',
    replace: '',
    test: TEST,
    why: '선택으로 바꾼 대가는 "나중에 반드시 알린다" 이다. 신호가 없으면 아무도 안 올리고 심사가 멈춘다.',
  },
]
