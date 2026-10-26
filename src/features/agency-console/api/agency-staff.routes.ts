/**
 * 🏢 에이전시 직원 — 목록 · 초대 · 다시 보내기 · 내보내기 · 초대 수락 · 에이전시 정보 수정.
 *   마운트: app.route('/api/agency-console', agencyStaffRoutes)  (가입/로그인 라우터와 같은 접두사)
 *
 * 대표(2026-10-11): 회사 안에서 컴퓨터 여러 대를 각 직원이 쓴다 → 직원마다 자기 이메일 로그인.
 *   관리자 = 정산·직원·조건 관리 / 직원 = 매장 운영만. 내보내면 그 순간부터 못 들어온다.
 *
 * 내보내기는 행을 지우지 않는다(`status='removed'`) — 누가 무엇을 했는지 남겨야 하고,
 * 같은 사람을 다시 초대할 때 같은 행이 살아난다.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { hashPassword, hashToken, validatePasswordComplexity } from '@/lib/password'
import { buildSystemEmailHtml, sendSystemEmail } from '@/lib/system-email'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { safeError } from '@/worker/utils/safe-error'
import { swallow } from '@/worker/utils/swallow'
import { invalidateStoreSeatCache } from '@/worker/utils/store-seat-guard'
import { ensureAgencyConsoleTables, AGENCY_NAME_MAX, STAFF_NAME_MAX, type StaffRole } from './agency-schema'
import { requireAgencyStaff, issueAgencyStaffToken, type AgencyStaffContext } from './agency-session'
import { isKakaoOnlyStaffEmail, KAKAO_SOLO_NOTICE } from '@/shared/agency-kakao'
import { agencyKakaoRoutes } from './agency-kakao.routes'
import { AGENCY_MAIL_DOWN, agencyMailReady, consumeLinkToken, frontendBase, issueLinkToken, normalizeBusinessNumber, normalizeEmail } from './agency-auth.routes'

type Bindings = {
  DB: D1Database; JWT_SECRET: string
  RESEND_API_KEY?: string; RESEND_FROM?: string; FRONTEND_URL?: string
}
type Vars = { agencyStaff: AgencyStaffContext }

export const agencyStaffRoutes = new Hono<{ Bindings: Bindings; Variables: Vars }>()
// 🟡 카카오로 만든 에이전시(2026-10-26) — 같은 접두사에 끼운다(`worker/index.ts` 마운트를 늘리지 않는다).
agencyStaffRoutes.route('/', agencyKakaoRoutes)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// ── 직원 목록 (모든 직원이 볼 수 있다 — 누가 같이 일하는지는 직원도 안다) ───────────────
agencyStaffRoutes.get('/staff', requireAgencyStaff(), async (c) => {
  const me = c.get('agencyStaff')
  const { results } = await c.env.DB.prepare(
    `SELECT st.id, st.email, st.name, st.role, st.is_owner, st.status, st.last_login_at, st.created_at, st.store_scope,
            (SELECT COUNT(*) FROM agency_staff_stores x
               JOIN agency_store_links l ON l.seller_id = x.seller_id AND l.agency_id = x.agency_id AND l.status = 'active'
              WHERE x.staff_id = st.id) AS assigned_count
       FROM agency_staff st WHERE st.agency_id = ? AND st.status IN ('active','invited')
      ORDER BY st.is_owner DESC, st.role = 'admin' DESC, st.id ASC`,
  ).bind(me.agencyId).all<{
    id: number; email: string; name: string | null; role: string; is_owner: number
    status: string; last_login_at: string | null; created_at: string; store_scope: string | null; assigned_count: number
  }>()
  return c.json({
    success: true,
    staff: (results || []).map((r) => ({
      id: r.id, email: r.email, name: r.name, role: r.role === 'admin' ? 'admin' : 'staff',
      isOwner: r.is_owner === 1, status: r.status, lastLoginAt: r.last_login_at, isMe: r.id === me.staffId,
      // 👥 관리자는 언제나 전체 — 배정은 직원에게만 걸린다(`agency-staff-stores.ts`).
      storeScope: r.role !== 'admin' && r.store_scope === 'assigned' ? 'assigned' : 'all',
      assignedCount: Number(r.assigned_count) || 0,
    })),
    canManage: me.role === 'admin',
  })
})

async function sendInviteMail(env: Bindings, email: string, agencyName: string, raw: string) {
  await sendSystemEmail(env, email, {
    subject: `[유어딜] ${agencyName} 에이전시에서 초대했어요`,
    html: buildSystemEmailHtml({
      title: `${agencyName}에 합류해 주세요`,
      greeting: '안녕하세요.',
      body: `${agencyName} 에이전시가 맡은 매장을 함께 운영하도록 초대했어요.\n아래 버튼을 눌러 이름과 비밀번호를 정하면 바로 들어올 수 있어요. 링크는 7일 동안 쓸 수 있어요.`,
      actionLabel: '합류하기',
      actionUrl: `${frontendBase(env)}/agency/invite?token=${raw}`,
    }),
  }, { ignorePreference: true }).catch(swallow('agency-console:invite-mail'))
}

// ── 직원 초대 (관리자) ───────────────────────────────────────────────────────
agencyStaffRoutes.post('/staff/invite', cors(), requireAgencyStaff({ adminOnly: true }),
  rateLimit({ action: 'agency_staff_invite', max: 30, windowSec: 3600 }), async (c) => {
    try {
      const me = c.get('agencyStaff')
      const body = await c.req.json<{ email?: string; role?: string }>().catch(() => ({} as { email?: string; role?: string }))
      const email = normalizeEmail(body.email)
      const role: StaffRole = body.role === 'admin' ? 'admin' : 'staff'
      // 🟡 카카오로 만든 에이전시는 혼자 쓰는 계정이다(2026-10-26 대표) — 이메일 계정으로 옮긴 뒤에 초대가 열린다.
      if (isKakaoOnlyStaffEmail(me.email)) return c.json({ success: false, code: 'KAKAO_SOLO', error: KAKAO_SOLO_NOTICE }, 409)
      if (!EMAIL_RE.test(email) || email.length > 254) return c.json({ success: false, error: '이메일 형식을 확인해 주세요.' }, 400)
      if (!agencyMailReady(c.env)) return c.json(AGENCY_MAIL_DOWN, 503)
      const { DB } = c.env
      await ensureAgencyConsoleTables(DB)
      const found = await DB.prepare('SELECT id, agency_id, status FROM agency_staff WHERE LOWER(email) = ? LIMIT 1')
        .bind(email).first<{ id: number; agency_id: number; status: string }>()
      let staffId: number
      if (found) {
        if (found.agency_id !== me.agencyId) {
          return c.json({ success: false, code: 'EMAIL_IN_OTHER_AGENCY', error: '이 이메일은 다른 에이전시 계정으로 쓰이고 있어요. 다른 이메일로 초대해 주세요.' }, 409)
        }
        if (found.status === 'active') return c.json({ success: false, code: 'ALREADY_STAFF', error: '이미 함께 일하는 직원이에요.' }, 409)
        // 초대 중이거나 내보냈던 사람 — 같은 행을 초대 상태로 되살린다.
        await DB.prepare(
          "UPDATE agency_staff SET status = 'invited', role = ?, invited_by_staff_id = ?, updated_at = datetime('now') WHERE id = ? AND agency_id = ? AND status IN ('invited','removed')",
        ).bind(role, me.staffId, found.id, me.agencyId).run()
        staffId = found.id
      } else {
        const ins = await DB.prepare(
          "INSERT OR IGNORE INTO agency_staff (agency_id, email, role, status, invited_by_staff_id) VALUES (?, ?, ?, 'invited', ?)",
        ).bind(me.agencyId, email, role, me.staffId).run()
        if ((ins.meta?.changes ?? 0) === 0) return c.json({ success: false, error: '잠시 뒤 다시 시도해 주세요.' }, 409)
        staffId = Number(ins.meta?.last_row_id)
      }
      const agency = await DB.prepare('SELECT name FROM agency_accounts WHERE id = ? LIMIT 1').bind(me.agencyId).first<{ name: string }>()
      const raw = await issueLinkToken(DB, staffId, 'invite')
      await sendInviteMail(c.env, email, agency?.name || '에이전시', raw)
      return c.json({ success: true, message: `${email} 로 초대 메일을 보냈어요.` })
    } catch (err) {
      return safeError(c, err, '초대 중 오류가 발생했어요', '[agency-console:invite]')
    }
  })

// ── 초대 메일 다시 보내기 (관리자) ────────────────────────────────────────────
agencyStaffRoutes.post('/staff/:id/resend', cors(), requireAgencyStaff({ adminOnly: true }),
  rateLimit({ action: 'agency_staff_resend', max: 20, windowSec: 3600 }), async (c) => {
    const me = c.get('agencyStaff')
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id) || id <= 0) return c.json({ success: false, error: '잘못된 요청이에요.' }, 400)
    if (!agencyMailReady(c.env)) return c.json(AGENCY_MAIL_DOWN, 503)
    const s = await c.env.DB.prepare("SELECT id, email FROM agency_staff WHERE id = ? AND agency_id = ? AND status = 'invited' LIMIT 1")
      .bind(id, me.agencyId).first<{ id: number; email: string }>()
    if (!s) return c.json({ success: false, error: '초대 중인 직원이 아니에요.' }, 404)
    const agency = await c.env.DB.prepare('SELECT name FROM agency_accounts WHERE id = ? LIMIT 1').bind(me.agencyId).first<{ name: string }>()
    const raw = await issueLinkToken(c.env.DB, s.id, 'invite')
    await sendInviteMail(c.env, s.email, agency?.name || '에이전시', raw)
    return c.json({ success: true, message: '초대 메일을 다시 보냈어요.' })
  })

// ── 내보내기 (관리자) — 대표 계정과 자기 자신은 못 내보낸다 ─────────────────────────
agencyStaffRoutes.post('/staff/:id/remove', cors(), requireAgencyStaff({ adminOnly: true }), async (c) => {
  try {
    const me = c.get('agencyStaff')
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id) || id <= 0) return c.json({ success: false, error: '잘못된 요청이에요.' }, 400)
    if (id === me.staffId) return c.json({ success: false, error: '자기 자신은 내보낼 수 없어요.' }, 400)
    const nowSec = Math.floor(Date.now() / 1000)
    // is_owner = 0 조건을 UPDATE 안에 둔다 — 대표 계정은 어떤 경로로도 안 빠진다.
    const r = await c.env.DB.prepare(
      `UPDATE agency_staff SET status = 'removed', tokens_valid_after = ?, updated_at = datetime('now')
        WHERE id = ? AND agency_id = ? AND is_owner = 0 AND status IN ('active','invited')`,
    ).bind(nowSec, id, me.agencyId).run()
    if ((r.meta?.changes ?? 0) === 0) return c.json({ success: false, error: '내보낼 수 없는 직원이에요.' }, 404)
    await c.env.DB.prepare("DELETE FROM agency_tokens WHERE staff_id = ? AND used_at IS NULL").bind(id).run().catch(swallow('agency-console:remove-tokens'))
    // 이 직원이 열어 둔 매장 좌석도 지금 끊는다(같은 isolate 즉시 · 다른 isolate 는 15초 안에).
    invalidateStoreSeatCache(c.env.DB)
    return c.json({ success: true, message: '내보냈어요. 이 직원은 지금부터 들어올 수 없어요.' })
  } catch (err) {
    return safeError(c, err, '처리 중 오류가 발생했어요', '[agency-console:remove]')
  }
})

// ── 초대 링크 열기 — 합류 화면에 보여 줄 것만 (에이전시 이름 · 이메일) ─────────────────
agencyStaffRoutes.get('/invite/lookup', rateLimit({ action: 'agency_invite_lookup', max: 30, windowSec: 600 }), async (c) => {
  const raw = c.req.query('token') || ''
  if (!/^[0-9a-f]{64}$/.test(raw)) return c.json({ success: false, code: 'LINK_INVALID', error: '잘못된 링크예요.' }, 400)
  const { DB } = c.env
  await ensureAgencyConsoleTables(DB)
  const row = await DB.prepare(
    `SELECT t.expires_at, t.used_at, s.email, s.status, a.name AS agency_name
       FROM agency_tokens t JOIN agency_staff s ON s.id = t.staff_id JOIN agency_accounts a ON a.id = s.agency_id
      WHERE t.token_hash = ? AND t.kind = 'invite' LIMIT 1`,
  ).bind(await hashToken(raw)).first<{ expires_at: string; used_at: string | null; email: string; status: string; agency_name: string }>()
  if (!row || row.used_at || row.status !== 'invited') return c.json({ success: false, code: 'LINK_INVALID', error: '이미 쓴 링크이거나 취소된 초대예요.' }, 400)
  if (Date.parse(row.expires_at) < Date.now()) return c.json({ success: false, code: 'LINK_EXPIRED', error: '초대 링크가 만료됐어요. 관리자에게 다시 보내 달라고 해 주세요.' }, 400)
  return c.json({ success: true, email: row.email, agencyName: row.agency_name })
})

// ── 초대 수락 → 바로 로그인 ───────────────────────────────────────────────────
agencyStaffRoutes.post('/invite/accept', cors(), rateLimit({ action: 'agency_invite_accept', max: 10, windowSec: 600 }), async (c) => {
  try {
    const body = await c.req.json<{ token?: string; name?: string; password?: string }>().catch(() => ({} as { token?: string; name?: string; password?: string }))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > STAFF_NAME_MAX) return c.json({ success: false, error: `이름을 ${STAFF_NAME_MAX}자 안으로 적어 주세요.` }, 400)
    const pw = validatePasswordComplexity(body.password || '')
    if (!pw.ok) return c.json({ success: false, error: pw.error }, 400)
    const { DB } = c.env
    await ensureAgencyConsoleTables(DB)
    const r = await consumeLinkToken(DB, body.token || '', 'invite')
    if ('error' in r) {
      return c.json({ success: false, code: r.error === 'expired' ? 'LINK_EXPIRED' : 'LINK_INVALID', error: '초대 링크가 만료됐거나 이미 쓴 링크예요.' }, 400)
    }
    const hash = await hashPassword(body.password as string)
    const up = await DB.prepare(
      "UPDATE agency_staff SET status = 'active', name = ?, password_hash = ?, updated_at = datetime('now') WHERE id = ? AND status = 'invited'",
    ).bind(name, hash, r.staffId).run()
    if ((up.meta?.changes ?? 0) === 0) return c.json({ success: false, code: 'LINK_INVALID', error: '취소된 초대예요.' }, 400)
    const s = await DB.prepare(
      `SELECT s.id, s.agency_id, s.email, s.name, s.role, s.is_owner, a.name AS agency_name, a.kind AS agency_kind, a.status AS agency_status
         FROM agency_staff s JOIN agency_accounts a ON a.id = s.agency_id WHERE s.id = ? LIMIT 1`,
    ).bind(r.staffId).first<{
      id: number; agency_id: number; email: string; name: string | null; role: string; is_owner: number
      agency_name: string; agency_kind: string; agency_status: string
    }>()
    if (!s || s.agency_status !== 'active') return c.json({ success: false, error: '지금은 이 에이전시에 들어올 수 없어요.' }, 403)
    const { token, expiresAt } = await issueAgencyStaffToken(c.env.JWT_SECRET, s)
    await DB.prepare("UPDATE agency_staff SET last_login_at = datetime('now') WHERE id = ?").bind(s.id).run().catch(swallow('agency-console:accept-login'))
    return c.json({
      success: true, token, expiresAt,
      staff: { id: s.id, email: s.email, name: s.name, role: s.role === 'admin' ? 'admin' : 'staff', isOwner: s.is_owner === 1 },
      agency: { id: s.agency_id, name: s.agency_name, kind: s.agency_kind === 'individual' ? 'individual' : 'business' },
    })
  } catch (err) {
    return safeError(c, err, '합류 처리 중 오류가 발생했어요', '[agency-console:accept]')
  }
})

// ── 에이전시 정보 수정 (관리자) ───────────────────────────────────────────────
agencyStaffRoutes.patch('/account', cors(), requireAgencyStaff({ adminOnly: true }), async (c) => {
  const me = c.get('agencyStaff')
  const body = await c.req.json<{ name?: string; business_number?: string }>().catch(() => ({} as { name?: string; business_number?: string }))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > AGENCY_NAME_MAX) return c.json({ success: false, error: `에이전시 이름을 ${AGENCY_NAME_MAX}자 안으로 적어 주세요.` }, 400)
  const acc = await c.env.DB.prepare('SELECT kind FROM agency_accounts WHERE id = ? LIMIT 1').bind(me.agencyId).first<{ kind: string }>()
  let bn: string | null = null
  if (acc?.kind === 'business') {
    bn = normalizeBusinessNumber(body.business_number)
    if (!bn) return c.json({ success: false, error: '사업자등록번호 10자리를 적어 주세요.' }, 400)
  }
  await c.env.DB.prepare("UPDATE agency_accounts SET name = ?, business_number = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(name, bn, me.agencyId).run()
  return c.json({ success: true, message: '저장했어요.' })
})
