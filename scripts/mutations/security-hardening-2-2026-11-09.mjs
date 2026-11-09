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
  {
    name: '[sec2] 이용권 전체 잠금을 다시 모두에게 건다',
    file: 'src/worker/utils/voucher-code-guard.ts',
    find: '(all >= LOOKUP_MISS_GLOBAL.max && mine >= 1)',
    replace: 'all >= LOOKUP_MISS_GLOBAL.max',
    test: TEST,
    why: '한 사람이 없는 번호 300개를 보내면 모든 손님의 이용권 조회가 한 시간 막힌다.',
  },
  {
    name: '[sec2] 이용권 전체 잠금을 없앤다',
    file: 'src/worker/utils/voucher-code-guard.ts',
    find: '(all >= LOOKUP_MISS_GLOBAL.max && mine >= 1)',
    replace: 'false',
    test: TEST,
    why: 'IP 를 바꿔 가며 6자리 번호를 무제한 대 볼 수 있다.',
  },
  {
    name: '[sec2] 관리자 삭제 때 동시 로그인 허용을 안 끈다',
    file: 'src/features/admin/api/admin-accounts.routes.ts',
    find: "UPDATE dashboard_sessions SET multi_session = 0 WHERE account_type = 'admin' AND account_id = ?",
    replace: "SELECT 1 WHERE ? IS NOT NULL",
    test: TEST,
    why: '삭제한 자동화 관리자 계정의 토큰이 24시간 더 살아 있다.',
  },
  {
    name: '[sec2] 비밀 비교가 길이만 같으면 통과',
    file: 'src/worker/utils/secret-compare.ts',
    find: '  return diff === 0\n',
    replace: '  return (a.length ^ b.length) === 0\n',
    test: TEST,
    why: '같은 길이의 아무 문자열로 응급 토큰을 통과한다.',
  },
  {
    name: '[sec2] 응급 재설정 role 을 표 이름으로 그대로',
    file: 'src/worker/routes/internal-admin-tools.routes.ts',
    find: "  const targets = role === 'all' ? ['admins', 'sellers', 'agencies'] : [ROLE_TABLE[role]];",
    replace: "  const targets = role === 'all' ? ['admins', 'sellers', 'agencies'] : [`${role}s`];",
    test: TEST,
    why: '토큰을 가진 쪽이 role 로 임의 표 이름(SQL)을 넣는다.',
  },
  {
    name: '[sec2] cron 토큰을 다시 !== 로 비교',
    file: 'src/worker/routes/kakao-skill-webhook.routes.ts',
    find: "  if (!secretEquals(secret, c.req.header('x-skill-secret'))) {",
    replace: "  if (c.req.header('x-skill-secret') !== secret) {",
    test: TEST,
    why: '응답 시간으로 비밀의 일치 길이가 샌다.',
  },
]
