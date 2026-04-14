/**
 * Admin Tools API
 * - 매출 통계 차트
 * - 셀러 승인
 * - 배너 관리
 * - 공지사항
 * - 정산 일괄
 * - 신고/차단
 * - 플랫폼 설정
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'

export const adminToolsRoutes = new Hono<{ Bindings: Env }>()

// ── 매출 통계 차트 ──
adminToolsRoutes.get('/chart/revenue', async (c) => {
  const days = Number(c.req.query('days') || 30)
  const { results } = await c.env.DB.prepare(`
    SELECT date(created_at) AS date,
      COUNT(*) AS orders,
      COALESCE(SUM(CASE WHEN status NOT IN ('CANCELLED','FAILED','REFUNDED') THEN total_amount END), 0) AS revenue
    FROM orders WHERE created_at > datetime('now', '-' || ? || ' days')
    GROUP BY date(created_at) ORDER BY date
  `).bind(days).all()
  return c.json({ success: true, data: results || [] })
})

// ── 셀러 승인 대기 목록 ──
adminToolsRoutes.get('/sellers/pending', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT id, username, name, email, business_name, business_number, phone, created_at
    FROM sellers WHERE status = 'pending' ORDER BY created_at DESC
  `).all()
  return c.json({ success: true, data: results || [] })
})

adminToolsRoutes.put('/sellers/:id/approve', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare("UPDATE sellers SET status = 'approved', updated_at = datetime('now') WHERE id = ?").bind(id).run()
  return c.json({ success: true })
})

adminToolsRoutes.put('/sellers/:id/reject', async (c) => {
  const id = c.req.param('id')
  const { reason } = await c.req.json<{ reason?: string }>().catch(() => ({ reason: '' }))
  await c.env.DB.prepare("UPDATE sellers SET status = 'rejected', updated_at = datetime('now') WHERE id = ?").bind(id).run()
  return c.json({ success: true })
})

// ── 배너 관리 ──
adminToolsRoutes.get('/banners', async (c) => {
  try { await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, image_url TEXT NOT NULL, link_url TEXT,
      display_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1,
      start_date DATETIME, end_date DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run() } catch {}
  const { results } = await c.env.DB.prepare('SELECT * FROM banners ORDER BY display_order ASC, created_at DESC').all()
  return c.json({ success: true, data: results || [] })
})

adminToolsRoutes.post('/banners', async (c) => {
  const { title, image_url, link_url, display_order } = await c.req.json<any>()
  if (!image_url) return c.json({ success: false, error: '이미지 URL 필수' }, 400)
  await c.env.DB.prepare('INSERT INTO banners (title, image_url, link_url, display_order) VALUES (?, ?, ?, ?)')
    .bind(title || '', image_url, link_url || '/', display_order || 0).run()
  return c.json({ success: true })
})

adminToolsRoutes.put('/banners/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<any>()
  const sets: string[] = []; const vals: any[] = []
  if (body.title !== undefined) { sets.push('title = ?'); vals.push(body.title) }
  if (body.image_url) { sets.push('image_url = ?'); vals.push(body.image_url) }
  if (body.link_url !== undefined) { sets.push('link_url = ?'); vals.push(body.link_url) }
  if (body.display_order !== undefined) { sets.push('display_order = ?'); vals.push(body.display_order) }
  if (body.is_active !== undefined) { sets.push('is_active = ?'); vals.push(body.is_active ? 1 : 0) }
  if (!sets.length) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400)
  vals.push(id)
  await c.env.DB.prepare(`UPDATE banners SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run()
  return c.json({ success: true })
})

adminToolsRoutes.delete('/banners/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM banners WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// ── 공지사항 발송 ──
adminToolsRoutes.post('/notices', async (c) => {
  const { title, message, target } = await c.req.json<{ title: string; message: string; target: 'all' | 'sellers' | 'users' }>()
  if (!title || !message) return c.json({ success: false, error: '제목과 내용 필수' }, 400)

  if (target === 'sellers' || target === 'all') {
    const { results: sellers } = await c.env.DB.prepare("SELECT id FROM sellers WHERE status = 'approved'").all<{ id: number }>()
    if (sellers?.length) {
      const stmts = sellers.map(s =>
        c.env.DB.prepare("INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, created_at) VALUES ('seller', ?, 'admin_notice', ?, ?, datetime('now'))")
          .bind(String(s.id), title, message))
      for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50))
    }
  }
  if (target === 'users' || target === 'all') {
    const { results: users } = await c.env.DB.prepare("SELECT id FROM users LIMIT 1000").all<{ id: string }>()
    if (users?.length) {
      const stmts = users.map(u =>
        c.env.DB.prepare("INSERT INTO user_notifications (user_id, type, title, message, created_at) VALUES (?, 'admin_notice', ?, ?, datetime('now'))")
          .bind(u.id, title, message))
      for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50))
    }
  }
  return c.json({ success: true, message: '공지 발송 완료' })
})

// ── 정산 일괄 처리 ──
adminToolsRoutes.get('/settlements/pending', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT s.id AS seller_id, s.name AS seller_name, s.business_name,
      COUNT(DISTINCT o.id) AS order_count,
      COALESCE(SUM(o.total_amount), 0) AS total_amount,
      COALESCE(SUM(o.total_amount * 0.05), 0) AS commission
    FROM orders o JOIN sellers s ON o.seller_id = s.id
    WHERE o.status IN ('DELIVERED', 'delivered') AND COALESCE(o.settlement_status, 'pending') = 'pending'
    GROUP BY s.id ORDER BY total_amount DESC
  `).all()
  return c.json({ success: true, data: results || [] })
})

adminToolsRoutes.post('/settlements/process', async (c) => {
  const { seller_ids } = await c.req.json<{ seller_ids: number[] }>()
  if (!seller_ids?.length) return c.json({ success: false, error: '셀러를 선택해주세요' }, 400)

  for (const sid of seller_ids) {
    await c.env.DB.prepare(`
      UPDATE orders SET settlement_status = 'settled', updated_at = datetime('now')
      WHERE seller_id = ? AND status IN ('DELIVERED', 'delivered') AND COALESCE(settlement_status, 'pending') = 'pending'
    `).bind(sid).run()
  }
  return c.json({ success: true, message: `${seller_ids.length}명 정산 처리 완료` })
})

// ── 신고/차단 관리 ──
adminToolsRoutes.get('/reports', async (c) => {
  try { await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS user_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id TEXT, target_type TEXT, target_id TEXT,
      reason TEXT, status TEXT DEFAULT 'pending', admin_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, resolved_at DATETIME
    )`).run() } catch {}
  const { results } = await c.env.DB.prepare('SELECT * FROM user_reports ORDER BY created_at DESC LIMIT 50').all()
  return c.json({ success: true, data: results || [] })
})

adminToolsRoutes.put('/reports/:id/resolve', async (c) => {
  const id = c.req.param('id')
  const { action, note } = await c.req.json<{ action: 'dismiss' | 'warn' | 'suspend'; note?: string }>()
  await c.env.DB.prepare("UPDATE user_reports SET status = ?, admin_note = ?, resolved_at = datetime('now') WHERE id = ?")
    .bind(action, note || '', id).run()

  if (action === 'suspend') {
    const report = await c.env.DB.prepare('SELECT target_type, target_id FROM user_reports WHERE id = ?').bind(id).first<any>()
    if (report?.target_type === 'seller') {
      await c.env.DB.prepare("UPDATE sellers SET status = 'suspended' WHERE id = ?").bind(report.target_id).run()
    }
  }
  return c.json({ success: true })
})

// ── 플랫폼 설정 ──
adminToolsRoutes.get('/settings', async (c) => {
  try { await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run() } catch {}
  const { results } = await c.env.DB.prepare('SELECT * FROM platform_settings').all()
  const settings: Record<string, string> = {}
  ;(results || []).forEach((r: any) => { settings[r.key] = r.value })
  return c.json({ success: true, data: settings })
})

adminToolsRoutes.put('/settings', async (c) => {
  const body = await c.req.json<Record<string, string>>()
  try { await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run() } catch {}
  for (const [key, value] of Object.entries(body)) {
    await c.env.DB.prepare('INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime(\'now\')')
      .bind(key, String(value)).run()
  }
  return c.json({ success: true })
})
