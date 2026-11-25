/**
 * 🚪 탈퇴한 계정의 남은 로그인으로는 **쓰기**를 못 한다 (2026-11-25 대표 *"나머지 빠짐없이 모두 해줘야지."*)
 *
 * 탈퇴는 그 기기의 세션 쿠키만 지운다. 다른 기기의 `ur_session`(30일)은 살아 있어서, 익명화된 행으로 이용권을 사거나
 * 가게를 만들 수 있었다 — 그 행은 30일 뒤 지워지므로 산 것이 주인 없이 남는다(시험 `auth-doors-2026-11-25`).
 *
 * 비용을 정한 방식: 읽기(GET·HEAD)는 보지 않는다. 쓰기에서만 그 유저 행을 PK 로 한 번 읽고,
 * "탈퇴 아님" 은 이 인스턴스 메모리에 5분 붙든다. 그래서 다른 인스턴스에서 탈퇴한 직후 최대 5분은 통과할 수 있다(못 막는 범위).
 * 조회가 실패하면 통과시킨다 — 인증 자체는 이미 끝났고, 여기서 막으면 DB 가 흔들릴 때 모든 손님의 쓰기가 죽는다.
 */
import type { Context } from 'hono'

const ALIVE_TTL_MS = 5 * 60_000
const alive = new Map<string, number>()

/**
 * 탈퇴한 행인가 — 탈퇴는 이메일을 `deleted_…@deleted.invalid` 로, 카카오 번호를 `deleted_…` 로 바꾼다(`delete-account.service.ts`).
 * 🩸 `users.deleted_at` 을 보지 않는다: 라이브 `users` 표에는 그 칸이 없다(넓은 표라 ALTER 가 조용히 실패해 탈퇴가 그 칸 없이 익명화한다).
 * 구글 로그인(`google-oauth.ts`)이 쓰는 판정과 같은 규칙이다.
 */
export function isDeletedUserRow(row: { email?: string | null; kakao_id?: string | null }): boolean {
  return (row.email || '').endsWith('@deleted.invalid') || (row.kakao_id || '').startsWith('deleted_')
}

/** 탈퇴 처리 직후 같은 인스턴스의 기억을 지운다(다음 쓰기부터 바로 막힌다). */
export function forgetAliveUser(userId: string | number): void {
  alive.delete(String(userId))
}

/** 탈퇴한 유저의 쓰기 요청이면 401 응답을, 아니면 null 을 준다. */
export async function rejectDeletedUserWrite(c: Context): Promise<Response | null> {
  const method = c.req.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null
  const user = c.get('user') as { id?: string | number; type?: string } | undefined
  if (!user || (user.type || 'user') !== 'user') return null
  const id = String(user.id ?? '')
  if (!/^\d+$/.test(id)) return null
  const now = Date.now()
  if ((alive.get(id) ?? 0) > now) return null
  const DB = (c.env as { DB?: D1Database } | undefined)?.DB
  if (!DB) return null
  let row: { email: string | null; kakao_id: string | null } | null
  try {
    row = await DB.prepare('SELECT email, kakao_id FROM users WHERE id = ?').bind(Number(id)).first<{ email: string | null; kakao_id: string | null }>()
  } catch {
    return null
  }
  if (row && isDeletedUserRow(row)) {
    return c.json({ success: false, error: '탈퇴한 계정이에요. 다시 로그인해 주세요.', code: 'ACCOUNT_DELETED' }, 401)
  }
  if (alive.size > 5000) alive.clear()
  alive.set(id, now + ALIVE_TTL_MS)
  return null
}
