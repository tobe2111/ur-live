/**
 * 🔐 2026-11-09 보안 전수조사 2차 — 주입 매니페스트.
 * 가드: src/tests/unit/security-hardening-2-2026-11-09.test.ts
 */
const TEST = 'src/tests/unit/security-hardening-2-2026-11-09.test.ts'

export default [
  {
    name: '[sec2] 재발급 토큰을 로그인 키로 서명한다',
    file: 'src/worker/utils/refresh-token-key.ts',
    find: "  return sign({ ...payload, token_use: REFRESH_TOKEN_USE }, refreshSigningKey(jwtSecret))",
    replace: "  return sign({ ...payload, token_use: REFRESH_TOKEN_USE }, jwtSecret)",
    test: TEST,
    why: '재발급 토큰(최대 90일)이 로그인 토큰으로 통한다 — 토큰을 직접 확인하는 30곳 전부에서.',
  },
  {
    name: '[sec2] 재발급 주소가 옛 키 토큰을 안 받는다 (강제 로그아웃)',
    file: 'src/worker/utils/refresh-token-key.ts',
    find: "    return (await verify(token, jwtSecret, 'HS256')) as Record<string, unknown> // 이행기",
    replace: "    throw new Error('legacy') // 이행기",
    test: TEST,
    why: '이미 로그인한 관리자·셀러가 다음 재발급 때 전부 로그아웃된다.',
  },
  {
    name: '[sec2] token_use:refresh 거부를 뺀다',
    file: 'src/worker/middleware/auth.ts',
    find: "    if (payload && (payload as { token_use?: unknown }).token_use === 'refresh') return null; // 재발급 토큰은 로그인 토큰이 아니다\n",
    replace: '',
    test: TEST,
    why: '같은 키로 서명된 옛 재발급 토큰(에이전시)이 로그인으로 통한다.',
  },
  {
    name: '[sec2] 관리자 재발급 토큰을 다시 로그인 키로',
    file: 'src/features/auth/api/admin.routes.ts',
    find: '    const newRefreshToken = await signRefreshToken(newRefreshPayload, JWT_SECRET);',
    replace: '    const newRefreshToken = await sign(newRefreshPayload, JWT_SECRET);',
    test: TEST,
    why: '재발급할 때마다 로그인 토큰으로 쓸 수 있는 30일짜리 토큰이 다시 나온다.',
  },
  {
    name: '[sec2] 관리자 PIN 실패를 잠금에 안 센다',
    file: 'src/features/auth/api/admin.routes.ts',
    find: "          await recordFailure(DB, 'admin', String(admin.id)); // 🔐 2026-11-09 PIN 실패도 계정 잠금에 센다\n",
    replace: '',
    test: TEST,
    why: '비밀번호를 아는 사람이 6자리 PIN 을 IP 를 바꿔 가며 무한히 시도한다.',
  },
]
