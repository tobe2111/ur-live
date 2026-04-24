/**
 * Agency Profile Routes (인증 필요)
 *
 *   GET  /api/agency/profile
 *   PUT  /api/agency/profile
 *   GET  /api/agency/notifications
 *   PUT  /api/agency/notifications/read-all
 */

import { createAgencyApp, ensureAgencyTables, requireAgency } from './agency-shared'
import type { AgencyCtx } from './agency-shared'

const app = createAgencyApp()
app.use('*', requireAgency as any)

// ── GET /profile ──────────────────────────────────────────────
app.get('/profile', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id } = c.get('agency') as { id: number; email: string }
  const agency = await c.env.DB.prepare(
    `SELECT id, name, contact_name, email, phone, status, commission_rate, created_at,
            bank_name, bank_account, account_holder
     FROM agencies WHERE id = ?`
  ).bind(id).first()
  if (!agency) return c.json({ success: false, error: 'Not found' }, 404)
  return c.json({ success: true, data: agency })
})

// ── PUT /profile — 에이전시 프로필 수정 ──────────────────────────
// 🛡️ 2026-04-22 배치 162: 은행 계좌 필드 추가 (정산 플로우 마비 P0 fix).
app.put('/profile', async (c) => {
  const { id } = c.get('agency') as { id: number }
  const body = await c.req.json<{
    name?: string; contact_name?: string; phone?: string;
    bank_name?: string; bank_account?: string; account_holder?: string;
  }>()

  // 입력 검증
  if (body.bank_account !== undefined && !/^[\d-]{5,30}$/.test(body.bank_account)) {
    return c.json({ success: false, error: '계좌번호는 숫자와 하이픈(-)만 허용됩니다' }, 400)
  }
  if (body.bank_name !== undefined && (body.bank_name.length < 1 || body.bank_name.length > 30)) {
    return c.json({ success: false, error: '은행명은 1~30자여야 합니다' }, 400)
  }
  if (body.account_holder !== undefined && (body.account_holder.length < 1 || body.account_holder.length > 30)) {
    return c.json({ success: false, error: '예금주는 1~30자여야 합니다' }, 400)
  }

  const updates: string[] = []
  const params: unknown[] = []
  if (body.name) { updates.push('name = ?'); params.push(body.name) }
  if (body.contact_name) { updates.push('contact_name = ?'); params.push(body.contact_name) }
  if (body.phone) { updates.push('phone = ?'); params.push(body.phone) }
  if (body.bank_name !== undefined) { updates.push('bank_name = ?'); params.push(body.bank_name) }
  if (body.bank_account !== undefined) { updates.push('bank_account = ?'); params.push(body.bank_account) }
  if (body.account_holder !== undefined) { updates.push('account_holder = ?'); params.push(body.account_holder) }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')")
    params.push(id)
    await c.env.DB.prepare(`UPDATE agencies SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run()
  }

  return c.json({ success: true })
})

// ── GET /notifications — 에이전시 알림 ────────────────────────────
app.get('/notifications', async (c) => {
  const { id: agencyId } = c.get('agency') as { id: number }

  try {
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS agency_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(() => {})

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM agency_notifications WHERE agency_id = ? ORDER BY created_at DESC LIMIT 30'
    ).bind(agencyId).all()

    const unread = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM agency_notifications WHERE agency_id = ? AND is_read = 0'
    ).bind(agencyId).first<{ cnt: number }>()

    return c.json({ success: true, data: results, unread_count: unread?.cnt || 0 })
  } catch {
    return c.json({ success: true, data: [], unread_count: 0 })
  }
})

// ── PUT /notifications/read-all ──────────────────────────────────
app.put('/notifications/read-all', async (c) => {
  const { id: agencyId } = c.get('agency') as { id: number }
  await c.env.DB.prepare('UPDATE agency_notifications SET is_read = 1 WHERE agency_id = ?').bind(agencyId).run().catch(() => {})
  return c.json({ success: true })
})

export { app as agencyProfileRoutes }
