/**
 * 🏢 2026-10-11 (대표 확정 안 A) — 손님 이메일 로그인에 에이전시 이메일을 넣은 사람을 에이전시 로그인으로 보낸다.
 * 에이전시 계정은 손님 계정과 **다른 계정**이라 손님 로그인으로는 절대 들어가지 않는다 — 이 함수는 안내만 한다.
 * 테이블이 아직 없으면(첫 배포 직후) 조용히 false.
 */
export const AGENCY_ACCOUNT_HINT = {
  success: false,
  code: 'AGENCY_ACCOUNT',
  error: '에이전시 계정이에요. 아래 에이전시 로그인으로 들어와 주세요.',
} as const

export async function isAgencyStaffEmail(DB: D1Database, email: string): Promise<boolean> {
  const row = await DB.prepare(
    "SELECT 1 AS hit FROM agency_staff WHERE LOWER(email) = LOWER(?) AND status IN ('active','pending') LIMIT 1",
  ).bind(email).first<{ hit: number }>().catch(() => null)
  return !!row
}
