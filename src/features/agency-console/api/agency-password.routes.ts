/**
 * 🔑 에이전시 직원 — 로그인한 채로 비밀번호 바꾸기 (2026-11-04 대표 *"남은 1,2,3도 다 해줘"*).
 *   종전엔 '비밀번호 찾기' 메일(`/forgot-password`)이 유일한 길이라, 메일이 막히면(2026-11-04 SENS 서명 꺼짐)
 *   비밀번호를 바꿀 방법이 없었다.
 *   마운트: agencyStaffRoutes.route('/', agencyPasswordRoutes) → `POST /api/agency-console/me/password`
 *
 * - 지금 비밀번호를 확인한다 — 열어 둔 화면을 남이 쓰는 경우를 막는다. 틀리면 로그인과 **같은 잠금**을 센다.
 * - 바꾸면 다른 컴퓨터에 남은 로그인은 전부 끊고(`tokens_valid_after`), **지금 화면에는 새 토큰**을 돌려준다.
 * - 카카오로 만든 계정은 비밀번호가 없다 → 409.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { hashPassword, verifyPassword, validatePasswordComplexity } from '@/lib/password'
import { checkLockout, recordFailure, clearFailures } from '@/worker/utils/account-lockout'
import { safeError } from '@/worker/utils/safe-error'
import { swallow } from '@/worker/utils/swallow'
import { isKakaoOnlyStaffEmail } from '@/shared/agency-kakao'
import { requireAgencyStaff, type AgencyStaffContext } from './agency-session'
import { loginPayload } from './agency-auth.routes'

type Bindings = { DB: D1Database; JWT_SECRET: string }
type Vars = { agencyStaff: AgencyStaffContext }

export const agencyPasswordRoutes = new Hono<{ Bindings: Bindings; Variables: Vars }>()

agencyPasswordRoutes.post('/me/password', cors(), requireAgencyStaff(), async (c) => {
  try {
    const me = c.get('agencyStaff')
    const body = await c.req.json<{ current_password?: unknown; new_password?: unknown }>().catch(() => ({} as Record<string, unknown>))
    const current = typeof body.current_password === 'string' ? body.current_password : ''
    const next = typeof body.new_password === 'string' ? body.new_password : ''
    if (!current || !next) return c.json({ success: false, error: '지금 비밀번호와 새 비밀번호를 적어 주세요.' }, 400)
    const pw = validatePasswordComplexity(next)
    if (!pw.ok) return c.json({ success: false, error: pw.error }, 400)
    if (next === current) return c.json({ success: false, error: '지금과 다른 비밀번호로 정해 주세요.' }, 400)

    const { DB } = c.env
    const row = await DB.prepare('SELECT id, email, password_hash FROM agency_staff WHERE id = ? AND status = ? LIMIT 1')
      .bind(me.staffId, 'active').first<{ id: number; email: string; password_hash: string | null }>()
    if (!row) return c.json({ success: false, error: '계정을 찾지 못했어요.' }, 404)
    if (isKakaoOnlyStaffEmail(row.email) || !row.password_hash) {
      return c.json({ success: false, code: 'KAKAO_ACCOUNT', error: '카카오로 만든 계정은 비밀번호가 없어요. 카카오로 로그인해 주세요.' }, 409)
    }

    const lockKey = `staff:${row.id}`
    const lock = await checkLockout(DB, 'agency', lockKey)
    if (lock.locked) return c.json({ success: false, code: 'ACCOUNT_LOCKED', error: '여러 번 틀려서 잠시 잠겼어요. 조금 뒤에 다시 시도해 주세요.' }, 429)
    const ok = await verifyPassword(current, row.password_hash)
    if (!ok.valid) {
      await recordFailure(DB, 'agency', lockKey).catch(swallow('agency-console:pw-lockout'))
      return c.json({ success: false, code: 'WRONG_PASSWORD', error: '지금 비밀번호가 맞지 않아요.' }, 400)
    }

    const hash = await hashPassword(next)
    await DB.prepare(
      "UPDATE agency_staff SET password_hash = ?, tokens_valid_after = ?, updated_at = datetime('now') WHERE id = ? AND status = 'active'",
    ).bind(hash, Math.floor(Date.now() / 1000), row.id).run()
    await clearFailures(DB, 'agency', lockKey)
    const payload = await loginPayload(c.env, row.id)
    if (!payload) return c.json({ success: false, error: '계정을 찾지 못했어요.' }, 404)
    return c.json({ success: true, message: '비밀번호를 바꿨어요. 다른 기기의 로그인은 끊겼어요.', ...payload })
  } catch (err) {
    return safeError(c, err, '비밀번호를 바꾸지 못했어요', '[agency-console:change-password]')
  }
})
