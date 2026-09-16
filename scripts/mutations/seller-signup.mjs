/**
 * 📱 사업자 유저 가입 폼 개편 (2026-09-15) — 주입 매니페스트.
 * 가드: src/tests/unit/seller-signup-2026-09-15.test.ts
 */
const TEST = 'src/tests/unit/seller-signup-2026-09-15.test.ts'

export default [
  {
    name: '📱 가입 폼 입력이 14px 로 돌아간다 (iOS 가 탭마다 화면을 확대한다)',
    file: 'src/pages/seller-register/RegisterFields.tsx',
    find: "px-3.5 text-[16px] text-gray-900",
    replace: "px-3.5 text-[14px] text-gray-900",
    test: TEST,
    why: 'iOS Safari 는 16px 미만 입력에 포커스하면 자동 확대한다 — 그 확대가 "폼이 흔들린다" 신고의 실체다.',
  },
  {
    name: '📱 가입 검증이 첫 오류 칸으로 안 간다 (오류가 화면 밖에 남는다)',
    file: 'src/pages/SellerRegisterSupplierPage.tsx',
    find: "      const el = document.getElementById(`f-${first}`)\n",
    replace: "      const el = null as HTMLElement | null\n",
    test: TEST,
    why: '긴 폼에서 오류 칸이 화면 밖이면 사장님은 "왜 안 되지" 상태로 멈춘다 — 스크롤+포커스가 이 개편의 핵심 하나.',
  },
  {
    name: '📱 가입 제출 payload 에서 개업일이 빠진다 (국세청 진위확인 실패 → 자동 승인 0)',
    file: 'src/pages/SellerRegisterSupplierPage.tsx',
    find: "        business_start_date: form.business_start_date || undefined,\n",
    replace: "",
    test: TEST,
    why: '화면을 다시 짜면서 서버 계약을 흘리기 쉽다 — 개업일이 빠지면 모든 가입이 수동 심사로 떨어진다.',
  },
]
