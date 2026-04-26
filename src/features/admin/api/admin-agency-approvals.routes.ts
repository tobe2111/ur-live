/**
 * Admin: Agency Creator Approval Routes (P0 #1)
 *
 * 에이전시가 초대한 셀러를 어드민이 심사:
 * - GET    /agency-creator-approvals         — 심사 대기 목록 (status 필터)
 * - GET    /agency-creator-approvals/:id     — 단건 상세
 * - POST   /agency-creator-approvals/:id/approve  — 승인 (sellers.status='approved')
 * - POST   /agency-creator-approvals/:id/reject   — 반려 (sellers.status='rejected')
 *
 * 참조: docs/AGENCY_BACKSTAGE_GAP_ANALYSIS.md (P0 #1)
 * 마운트: /api/admin/agency-creator-approvals
 */

import { Hono } from 'hono'
import { requireAdmin } from '@/worker/middleware/auth'
import type { Env } from '@/worker/types/env'
import { swallow } from '@/worker/utils/swallow'

const app = new Hono<{ Bindings: Env }>()

app.use('*', requireAdmin())

interface ApprovalRow {
  id: number
  seller_id: number
  agency_id: number
  business_number: string | null
  id_image_url: string | null
  status: string
  reason: string | null
  reviewed_by: number | null
  reviewed_at: string | null
  created_at: string
  // joined
  seller_name?: string | null
  seller_email?: string | null
  agency_name?: string | null
  agency_email?: string | null
}

// ── GET /agency-creator-approvals ─────────────────────────
app.get('/', async (c) => {
  const status = c.req.query('status') || 'pending'   // pending/approved/rejected/all
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200)
  const offset = parseInt(c.req.query('offset') || '0')

  let where = ''
  const binds: unknown[] = []
  if (status !== 'all') {
    where = 'WHERE acr.status = ?'
    binds.push(status)
  }
  binds.push(limit, offset)

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        acr.*,
        s.name AS seller_name,
        s.email AS seller_email,
        s.business_name AS seller_business_name,
        s.phone AS seller_phone,
        a.name AS agency_name,
        a.email AS agency_email
      FROM agency_creator_approvals acr
      LEFT JOIN sellers s ON s.id = acr.seller_id
      LEFT JOIN agencies a ON a.id = acr.agency_id
      ${where}
      ORDER BY acr.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...binds).all<ApprovalRow>()

    return c.json({ success: true, data: results || [], total: results?.length || 0 })
  } catch (err) {
    if (import.meta.env.DEV) console.error('[admin:agency-approvals:list]', err)
    return c.json({ success: false, error: 'agency_creator_approvals 테이블 미존재 — 마이그레이션 0207 적용 필요' }, 500)
  }
})

// ── GET /agency-creator-approvals/:id ─────────────────────
app.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: 'invalid id' }, 400)

  const row = await c.env.DB.prepare(`
    SELECT acr.*,
      s.name AS seller_name, s.email AS seller_email, s.business_name AS seller_business_name,
      s.phone AS seller_phone, s.status AS seller_status,
      a.name AS agency_name, a.email AS agency_email
    FROM agency_creator_approvals acr
    LEFT JOIN sellers s ON s.id = acr.seller_id
    LEFT JOIN agencies a ON a.id = acr.agency_id
    WHERE acr.id = ?
  `).bind(id).first<ApprovalRow>()

  if (!row) return c.json({ success: false, error: 'not found' }, 404)
  return c.json({ success: true, data: row })
})

// ── POST /agency-creator-approvals/:id/approve ───────────
app.post('/:id/approve', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: 'invalid id' }, 400)

  const adminId = c.get('user' as never) as { id?: number } | undefined
  const adminUserId = adminId?.id ?? null

  // 트랜잭션 대신 best-effort: approval row 먼저 조회 → seller 업데이트 → approval 업데이트
  const approval = await c.env.DB.prepare(
    'SELECT id, seller_id, status FROM agency_creator_approvals WHERE id = ?'
  ).bind(id).first<{ id: number; seller_id: number; status: string }>()

  if (!approval) return c.json({ success: false, error: 'not found' }, 404)
  if (approval.status !== 'pending') {
    return c.json({ success: false, error: `이미 ${approval.status} 처리됨` }, 409)
  }

  // 1) sellers.status = approved
  await c.env.DB.prepare(
    "UPDATE sellers SET status = 'approved', is_active = 1, updated_at = datetime('now') WHERE id = ?"
  ).bind(approval.seller_id).run()

  // 2) approval row 업데이트
  await c.env.DB.prepare(`
    UPDATE agency_creator_approvals
    SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now')
    WHERE id = ?
  `).bind(adminUserId, id).run()

  // 3) (best-effort) 에이전시에게 알림
  c.env.DB.prepare(`
    INSERT INTO agency_notifications (agency_id, type, title, message, link, created_at)
    SELECT agency_id, 'creator_approved', '셀러 승인 완료', '신규 셀러가 어드민 승인되어 활성화됐습니다.', '/agency/sellers', datetime('now')
    FROM agency_creator_approvals WHERE id = ?
  `).bind(id).run().catch(swallow('admin:agency-approval:notify'))

  return c.json({ success: true, message: '승인 처리됨', data: { approval_id: id, seller_id: approval.seller_id } })
})

// ── POST /agency-creator-approvals/:id/reject ────────────
app.post('/:id/reject', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: 'invalid id' }, 400)

  const body = await c.req.json<{ reason?: string }>().catch(() => ({} as { reason?: string }))
  const reason = (body.reason || '').trim().slice(0, 500) || '심사 반려'

  const adminId = c.get('user' as never) as { id?: number } | undefined
  const adminUserId = adminId?.id ?? null

  const approval = await c.env.DB.prepare(
    'SELECT id, seller_id, status FROM agency_creator_approvals WHERE id = ?'
  ).bind(id).first<{ id: number; seller_id: number; status: string }>()

  if (!approval) return c.json({ success: false, error: 'not found' }, 404)
  if (approval.status !== 'pending') {
    return c.json({ success: false, error: `이미 ${approval.status} 처리됨` }, 409)
  }

  // 1) sellers.status = rejected (계정은 남기되 비활성)
  await c.env.DB.prepare(
    "UPDATE sellers SET status = 'rejected', is_active = 0, updated_at = datetime('now') WHERE id = ?"
  ).bind(approval.seller_id).run()

  // 2) approval row 업데이트
  await c.env.DB.prepare(`
    UPDATE agency_creator_approvals
    SET status = 'rejected', reason = ?, reviewed_by = ?, reviewed_at = datetime('now')
    WHERE id = ?
  `).bind(reason, adminUserId, id).run()

  // 3) (best-effort) 에이전시에게 알림
  c.env.DB.prepare(`
    INSERT INTO agency_notifications (agency_id, type, title, message, link, created_at)
    SELECT agency_id, 'creator_rejected', '셀러 반려', ?, '/agency/sellers', datetime('now')
    FROM agency_creator_approvals WHERE id = ?
  `).bind(`반려 사유: ${reason}`, id).run().catch(swallow('admin:agency-rejection:notify'))

  return c.json({ success: true, message: '반려 처리됨', data: { approval_id: id, seller_id: approval.seller_id, reason } })
})

export const adminAgencyApprovalsRoutes = app
