/**
 * 🔐 2026-11-09 보안 전수조사 5차 — 주입 매니페스트.
 * 가드: src/tests/unit/security-hardening-5-2026-11-09.test.ts
 */
const TEST = 'src/tests/unit/security-hardening-5-2026-11-09.test.ts'

export default [
  {
    name: '[sec5] 후원 금액이 다시 소수를 받는다',
    file: 'src/features/points/api/points.routes.ts',
    find: '!Number.isInteger(amount) || amount < 500 || amount > 10_000_000',
    replace: '!Number.isFinite(amount) || amount < 500 || amount > 10_000_000',
    test: TEST,
    why: '500.5딜 같은 소수 금액이 원장에 들어간다.',
  },
  {
    name: '[sec5] 충전 확인 금액이 다시 소수를 받는다',
    file: 'src/features/points/api/points.routes.ts',
    find: '!Number.isInteger(amount) || amount < 1 || amount > 100_000_000',
    replace: '!Number.isFinite(amount) || amount < 1 || amount > 100_000_000',
    test: TEST,
    why: '소수 금액이 결제 확인을 지난다.',
  },
  {
    name: '[sec5] 프로모 코드 조회 횟수 제한을 뺀다',
    file: 'src/features/promo/api/promo.routes.ts',
    find: " rateLimit({ action: 'promo_preview', max: 30, windowSec: 300 }),",
    replace: '',
    test: TEST,
    why: '로그인 없이 프로모 코드를 무한히 대 본다.',
  },
  {
    name: '[sec5] 셀러 상태 응답이 비밀번호 확인 앞으로',
    file: 'src/features/auth/api/seller.routes.ts',
    find: "    // 🛡️ 2026-04-22: 계정 잠금 확인 (brute force 방어)\n",
    replace: "    if (seller.status === 'suspended') return c.json({ success: false, code: 'ACCOUNT_SUSPENDED' }, 403);\n    // 🛡️ 2026-04-22: 계정 잠금 확인 (brute force 방어)\n",
    test: TEST,
    why: '비밀번호 없이 이메일만으로 계정 존재·정지 여부를 알 수 있다.',
  },
]
