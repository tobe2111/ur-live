/**
 * 🏢 어드민 — 에이전시 계정 목록 · 정지/해제 (2026-10-11 대표 "모두 다 하자")
 *   마운트: adminApp.route('/', agencyAdminRoutes) → `/api/admin/agency-accounts*`
 *   (adminApp 이 이미 requireAdmin · IP 화이트리스트 · 감사 로그를 건다.)
 *
 * 왜 필요한가: 정지(`agency_accounts.status='suspended'`)하면 직원 로그인·매장 좌석·초대 링크가 전부 막히게
 * 만들어 뒀는데(`requireAgencyStaff`·`store-seat-guard`·`store-agency-invite`), **정지할 버튼이 없었다.**
 * 옛 에이전시(`agencies`, 2026-09-04 일몰)와 다른 테이블이다 — 이 파일은 `agency_accounts` 만 읽는다.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdminRole } from '@/worker/middleware/auth'
import { safeError } from '@/worker/utils/safe-error'
import { invalidateStoreSeatCache } from '@/worker/utils/store-seat-guard'
import { ensureAgencyConsoleTables } from './agency-schema'
import { registerAdminAgencyPayoutRoutes } from './agency-payout.routes'

export const agencyAdminRoutes = new Hono<{ Bindings: Env }>()
// 💸 2026-11-01 — 지급 신청 처리 · 옛 중개 매장 이전(dry_run 기본). 쓰기는 super·finance(이전은 super)만.
agencyAdminRoutes.use('/agency-payouts/*', requireAdminRole('super', 'finance'))
agencyAdminRoutes.use('/agency-accounts/migrate-broker', requireAdminRole('super'))
registerAdminAgencyPayoutRoutes(agencyAdminRoutes)

agencyAdminRoutes.get('/agency-accounts', async (c) => {
  try {
    const DB = c.env.DB
    await ensureAgencyConsoleTables(DB)
    const { results } = await DB.prepare(
      `SELECT a.id, a.name, a.kind, a.business_number, a.business_status, a.status, a.created_at,
              (SELECT email FROM agency_staff s WHERE s.agency_id = a.id AND s.is_owner = 1 LIMIT 1) AS owner_email,
              (SELECT COUNT(*) FROM agency_staff s WHERE s.agency_id = a.id AND s.status = 'active') AS staff_count,
              (SELECT COUNT(*) FROM agency_store_links l WHERE l.agency_id = a.id AND l.status = 'active') AS store_count,
              (SELECT COUNT(*) FROM agency_store_links l WHERE l.agency_id = a.id AND l.status = 'pending') AS pending_count
         FROM agency_accounts a
        ORDER BY CASE a.status WHEN 'active' THEN 0 WHEN 'suspended' THEN 1 ELSE 2 END, a.id DESC
        LIMIT 500`,
    ).all<{
      id: number; name: string; kind: string; business_number: string | null; business_status: string | null; status: string; created_at: string
      owner_email: string | null; staff_count: number; store_count: number; pending_count: number
    }>()
    return c.json({ success: true, data: results || [] })
  } catch (err) {
    return safeError(c, err, '에이전시 목록을 불러오지 못했어요', '[admin:agency-accounts]')
  }
})

agencyAdminRoutes.get('/agency-accounts/:id/stores', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id) || id <= 0) return c.json({ success: false, error: '잘못된 요청이에요.' }, 400)
    await ensureAgencyConsoleTables(c.env.DB)
    const { results } = await c.env.DB.prepare(
      `SELECT l.seller_id, l.status, l.created_at, l.accepted_at, l.ended_at, l.ended_by,
              s.business_name, s.name AS seller_name
         FROM agency_store_links l LEFT JOIN sellers s ON s.id = l.seller_id
        WHERE l.agency_id = ? ORDER BY l.id DESC LIMIT 200`,
    ).bind(id).all()
    return c.json({ success: true, data: results || [] })
  } catch (err) {
    return safeError(c, err, '맡은 매장을 불러오지 못했어요', '[admin:agency-accounts]')
  }
})

async function setStatus(DB: D1Database, id: number, from: string, to: string): Promise<boolean> {
  const r = await DB.prepare(
    "UPDATE agency_accounts SET status = ?, updated_at = datetime('now') WHERE id = ? AND status = ?",
  ).bind(to, id, from).run()
  return (r.meta?.changes ?? 0) > 0
}

agencyAdminRoutes.post('/agency-accounts/:id/suspend', requireAdminRole('super', 'ops'), async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id) || id <= 0) return c.json({ success: false, error: '잘못된 요청이에요.' }, 400)
    await ensureAgencyConsoleTables(c.env.DB)
    if (!(await setStatus(c.env.DB, id, 'active', 'suspended'))) return c.json({ success: false, error: '이용 중인 에이전시가 아니에요.' }, 409)
    // 직원들이 열어 둔 매장 좌석을 지금 끊는다(같은 isolate 즉시 · 다른 isolate 는 15초 안에).
    invalidateStoreSeatCache(c.env.DB)
    return c.json({ success: true, message: '정지했어요. 이 에이전시 직원은 지금부터 로그인·매장 운영을 할 수 없어요.' })
  } catch (err) {
    return safeError(c, err, '정지하지 못했어요', '[admin:agency-accounts]')
  }
})

agencyAdminRoutes.post('/agency-accounts/:id/unsuspend', requireAdminRole('super', 'ops'), async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id) || id <= 0) return c.json({ success: false, error: '잘못된 요청이에요.' }, 400)
    await ensureAgencyConsoleTables(c.env.DB)
    if (!(await setStatus(c.env.DB, id, 'suspended', 'active'))) return c.json({ success: false, error: '정지된 에이전시가 아니에요.' }, 409)
    invalidateStoreSeatCache(c.env.DB)
    return c.json({ success: true, message: '정지를 풀었어요.' })
  } catch (err) {
    return safeError(c, err, '처리하지 못했어요', '[admin:agency-accounts]')
  }
})
