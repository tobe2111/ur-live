/**
 * 🧬 주입 — 가입 앞문의 등록증 사본 (2026-09-16).
 * 각 항목은 "되돌리면 가짜 매장이 증거 없이 들어온다" 형태다.
 */
const TEST = 'src/tests/unit/register-front-door-cert-2026-09-16.test.ts'

export default [
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
    name: 'register-cert: 사본 도착 여부를 화면에 안 알려 준다',
    file: 'src/features/seller/api/seller-registration/session-routes.ts',
    find: "has_business_cert: !!(await import('../../../../worker/utils/seller-cert-url').then(m => m.resolveSellerCertUrl(db, Number(seller.id), seller.business_registration_image_url)).catch(() => seller.business_registration_image_url || null)), // 🧾 2026-09-20 meta 폴백",
    replace: '',
    test: TEST,
    why: '선택으로 바꾼 대가는 "나중에 반드시 알린다" 이다. 신호가 없으면 아무도 안 올리고 심사가 멈춘다.',
  },
]
