/**
 * 🧬 주입 — 거래성 메일 판정 (2026-10-12). 되돌리면 조용하다: 유어딜엔 Resend 키가 없어 메일이 한 통도 안 나간다.
 */
const T = 'src/tests/unit/transactional-mail-ready-2026-10-12.test.ts'
export default [
  {
    name: '메일판정 — SENS 를 수단으로 안 친다',
    file: 'src/lib/ncp-sens-mail.ts',
    find: '  return !!env.RESEND_API_KEY || sensMailConfigured(env)',
    replace: '  return !!env.RESEND_API_KEY',
    test: T,
    why: 'Resend 키가 없는 유어딜에서 거래성 메일 전부가 조용히 건너뛰어진다.',
  },
  {
    name: '메일판정 — 시스템 메일이 Resend 키만 본다',
    file: 'src/lib/system-email.ts',
    find: '  if (!transactionalMailReady(env)) return { success: false, skipped: true };',
    replace: '  if (!apiKey) return { success: false, skipped: true };',
    test: T,
    why: '이용권 영수증·에이전시 초대 등 sendSystemEmail 경로 전부가 안 나간다.',
  },
  {
    name: '메일판정 — 에이전시 메일이 SENS 를 무시한다',
    file: 'src/features/agency-console/api/agency-auth.routes.ts',
    find: '  return (!!env.RESEND_API_KEY && !!env.RESEND_FROM) || sensMailConfigured(env as Record<string, unknown>)',
    replace: '  return !!env.RESEND_API_KEY && !!env.RESEND_FROM',
    test: T,
    why: '에이전시 가입·초대·비밀번호 찾기가 "메일 발송 불가" 503 으로 막힌다.',
  },
  {
    name: '메일판정 — 셀러 비밀번호 찾기가 Resend 키만 본다',
    file: 'src/features/auth/api/seller.routes.ts',
    find: '      if (transactionalMailReady(c.env)) { // 📮',
    replace: '      if (RESEND_API_KEY) { // 📮',
    test: T,
    why: '비밀번호 재설정 메일이 안 나가 셀러가 계정을 못 되찾는다.',
  },
]
