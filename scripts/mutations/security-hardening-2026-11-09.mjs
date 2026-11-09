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
]
