/** 🧬 주입 — 가입 시 휴대폰 번호 필수 (2026-11-04) */
const T = 'src/tests/unit/phone-required-signup-2026-11-04.test.tsx'
export default [
  { name: '번호필수 — 기존 회원에게도 뜬다', file: 'src/shared/phone-required.ts', find: "  if (!createdAt) return false\n  return String(createdAt)", replace: "  if (!createdAt) return false\n  return true || String(createdAt)", test: T, why: '대표가 "새 가입자만" 이라고 했는데 기존 회원 전원이 막힌다.' },
  { name: '번호필수 — 소식 동의가 기본 켜짐', file: 'src/components/onboarding/PhoneRequiredGate.tsx', find: 'useState(false) // 선택 동의', replace: 'useState(true) // 선택 동의', test: T, why: '광고성 정보 동의를 미리 체크해 두면 정보통신망법 위반이다.' },
  { name: '번호필수 — 개인정보처리방침 화면에서도 막는다', file: 'src/components/onboarding/PhoneRequiredGate.tsx', find: '|terms|privacy|refund|', replace: '|terms|refund|', test: T, why: '수집 고지를 읽으려고 눌러도 창이 덮어 읽을 수 없다.' },
  { name: '번호필수 — 세션 쿠키 분기가 판정을 안 내린다', file: 'src/worker/routes/auth.routes.ts', find: '        phone_required: isPhoneRequired(phone, createdAt),\n', replace: '', test: T, why: '카카오(세션 쿠키) 가입자에게는 창이 영영 안 뜬다.' },
  { name: '번호필수 — 소식 동의를 기록하지 않는다', file: 'src/worker/routes/auth.routes.ts', find: "await recordTermsAgreements(db, 'user', id, [{ doc_type: 'marketing', agreed: body.marketing_agreed }]);", replace: 'void 0;', test: T, why: '광고 문자를 보내도 되는 사람인지 증적이 없다.' },
]
