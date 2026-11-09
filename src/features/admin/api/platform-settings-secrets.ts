/**
 * 🔐 2026-11-09 — `platform_settings` 의 **비밀값**(Cloudflare 토큰 등)은 최고관리자만 본다.
 *
 * `GET /api/admin/tools/settings` 는 `SELECT *` 를 그대로 돌려줘서, 읽기 전용 관리자(viewer·cs·ops·finance)도
 * 인프라 토큰을 볼 수 있었다. 최고관리자가 아니면 끝 4자리만 남겨 가린다. 가린 값이 저장으로 되돌아와도
 * 진짜 값을 덮어쓰지 않게, 그리고 비밀값을 바꾸는 것도 최고관리자만 하게 한다.
 */
import type { Context } from 'hono'

const SECRET_KEY = /(?:token|secret|password|passwd|api_?key|private)/i
export const MASK_PREFIX = '••••'

export function isSecretSettingKey(key: string): boolean {
  return SECRET_KEY.test(key)
}

export function maskSecret(value: string | null | undefined): string {
  const v = String(value ?? '')
  return v ? MASK_PREFIX + v.slice(-4) : ''
}

/** 요청한 관리자가 최고관리자인가 — DB 의 admins.role 이 진실(토큰 클레임 아님). 모르면 false. */
export async function isSuperAdminRequest(c: Context): Promise<boolean> {
  const user = c.get('user') as { id?: string | number; type?: string } | undefined
  if (!user?.id || user.type !== 'admin') return false
  try {
    const row = await (c.env as { DB: D1Database }).DB
      .prepare('SELECT role FROM admins WHERE id = ?').bind(String(user.id)).first<{ role?: string | null }>()
    if (!row) return false
    return !row.role || row.role === 'super' || row.role === 'super_admin'
  } catch {
    return false
  }
}
