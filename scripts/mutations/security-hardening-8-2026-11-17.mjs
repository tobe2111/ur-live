/**
 * 🔐 2026-11-17 보안 점검 8차 — 주입 매니페스트.
 * 가드: src/tests/unit/security-hardening-8-2026-11-17.test.ts
 */
const TEST = 'src/tests/unit/security-hardening-8-2026-11-17.test.ts'

export default [
  {
    name: '[sec8] 재설정 토큰을 다시 원문으로 저장한다',
    file: 'src/features/auth/api/seller.routes.ts',
    find: '.bind(seller.id, await hashToken(token), expiresAt)',
    replace: '.bind(seller.id, token, expiresAt)',
    test: TEST,
    why: 'DB 를 읽을 수 있으면 아무 사장님 계정의 비밀번호를 바꾼다.',
  },
  {
    name: '[sec8] 원문 대조가 형식 검사 없이 통과한다',
    file: 'src/features/auth/api/seller.routes.ts',
    find: ".bind(await hashToken(token), /^[0-9a-f]{32}$/.test(token) ? token : '')",
    replace: '.bind(await hashToken(token), token)',
    test: TEST,
    why: '저장된 해시를 토큰인 척 내밀면 통과한다 — 해시 저장이 무의미해진다.',
  },
]
