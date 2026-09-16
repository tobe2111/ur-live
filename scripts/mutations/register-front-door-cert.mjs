/**
 * 🧬 주입 — 가입 앞문의 등록증 사본 (2026-09-16).
 * 각 항목은 "되돌리면 가짜 매장이 증거 없이 들어온다" 형태다.
 */
const TEST = 'src/tests/unit/register-front-door-cert-2026-09-16.test.ts'

export default [
  {
    name: 'register-cert: 업로드 칸을 지운다',
    file: 'src/pages/SellerRegisterSupplierPage.tsx',
    find: '<BusinessCertUpload value={certUrl} onChange={setCertUrl} required />',
    replace: '<input id="cert-noop" />',
    test: TEST,
    why: '칸이 없으면 사진이 도착할 길이 자체가 없다 — 어드민이 대조할 근거가 사라진다.',
  },
  {
    name: 'register-cert: 첨부 없이도 제출되게 한다',
    file: 'src/pages/SellerRegisterSupplierPage.tsx',
    find: '    if (!certUrl) {',
    replace: '    if (false) {',
    test: TEST,
    why: '조용히 통과하면 증거 없는 매장이 그대로 승인 대기열에 들어간다.',
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
    name: 'register-cert: 진행 표시가 등록증을 안 센다',
    file: 'src/pages/SellerRegisterSupplierPage.tsx',
    find: '  const filled = filledRequired(form) + (certUrl ? 1 : 0)',
    replace: '  const filled = filledRequired(form)',
    test: TEST,
    why: '바가 "6/6" 인데 제출이 막히면 사장님은 고장으로 읽고 이탈한다.',
  },
]
