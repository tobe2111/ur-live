/**
 * 🆕 2026-06-28 유어애즈(UR Ads) 운영 어드민 — 가입자 관리.
 *   기존 플랫폼 어드민 인증(requireAdmin) 위에서 ad_accounts 조회/잠금해제/정지.
 *   UR Ads 서비스 전용(유어딜/도매와 무관) — /api/admin/ads/*.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { ensureAdsAccountSchema } from './ads-account'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

// GET /api/admin/ads/stats — 요약
app.get('/stats', async (c) => {
  await ensureAdsAccountSchema(c.env.DB)
  const t = await c.env.DB.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN access_unlocked = 1 THEN 1 ELSE 0 END) AS unlocked,
      SUM(CASE WHEN status IS NOT NULL AND status != 'active' THEN 1 ELSE 0 END) AS suspended,
      SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS recent7
    FROM ad_accounts`).first<{ total: number; unlocked: number; suspended: number; recent7: number }>().catch(() => null)
  return c.json({ success: true, stats: { total: Number(t?.total) || 0, unlocked: Number(t?.unlocked) || 0, suspended: Number(t?.suspended) || 0, recent7: Number(t?.recent7) || 0 } })
})

// GET /api/admin/ads/accounts?q=&limit= — 가입자 목록(연동/알림 플래그 포함)
app.get('/accounts', async (c) => {
  await ensureAdsAccountSchema(c.env.DB)
  const limit = Math.min(300, Math.max(1, Number(c.req.query('limit')) || 100))
  const q = (c.req.query('q') || '').trim().toLowerCase()
  const like = `%${q}%`
  const rows = (await (q
    ? c.env.DB.prepare(`SELECT id, email, company_name, phone, status, access_unlocked, created_at, last_login_at FROM ad_accounts
        WHERE LOWER(email) LIKE ? OR LOWER(COALESCE(company_name, '')) LIKE ? ORDER BY id DESC LIMIT ?`).bind(like, like, limit)
    : c.env.DB.prepare('SELECT id, email, company_name, phone, status, access_unlocked, created_at, last_login_at FROM ad_accounts ORDER BY id DESC LIMIT ?').bind(limit)
  ).all<{ id: number; email: string; company_name: string | null; phone: string | null; status: string | null; access_unlocked: number; created_at: string; last_login_at: string | null }>().catch(() => null))?.results || []
  // 연동/알림 플래그(테이블 미존재 가능 → best-effort).
  const connSet = new Set(((await c.env.DB.prepare('SELECT DISTINCT seller_id FROM ad_searchad_tenants').all<{ seller_id: number }>().catch(() => null))?.results || []).map(r => r.seller_id))
  const alertSet = new Set(((await c.env.DB.prepare('SELECT account_id FROM ad_alert_settings WHERE enabled = 1').all<{ account_id: number }>().catch(() => null))?.results || []).map(r => r.account_id))
  const accounts = rows.map(r => ({ ...r, connected: connSet.has(r.id), alert_on: alertSet.has(r.id) }))
  return c.json({ success: true, accounts })
})

// PATCH /api/admin/ads/accounts/:id — 잠금해제(access_unlocked) / 정지(status) 변경
app.patch('/accounts/:id', async (c) => {
  await ensureAdsAccountSchema(c.env.DB)
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const sets: string[] = []
  const binds: (string | number)[] = []
  if (body.access_unlocked !== undefined) { sets.push('access_unlocked = ?'); binds.push(body.access_unlocked ? 1 : 0) }
  if (body.status !== undefined) {
    const st = String(body.status)
    if (st !== 'active' && st !== 'suspended') return c.json({ success: false, error: '상태 값이 올바르지 않습니다' }, 400)
    sets.push('status = ?'); binds.push(st)
  }
  if (!sets.length) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400)
  await c.env.DB.prepare(`UPDATE ad_accounts SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id).run().catch(() => null)
  return c.json({ success: true })
})

export { app as adminAdsRoutes }
