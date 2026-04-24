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
import { writeAuditLog } from '@/worker/middleware/admin-security'
import { validateImageUrl } from '@/worker/utils/validation'

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

// ── 매출 리포트 CSV ──
adminToolsRoutes.get('/report/csv', async (c) => {
  const days = Number(c.req.query('days') || 30)
  const { results } = await c.env.DB.prepare(`
    SELECT date(o.created_at) AS date, s.name AS seller_name,
      COUNT(*) AS order_count,
      COALESCE(SUM(CASE WHEN o.status NOT IN ('CANCELLED','FAILED','REFUNDED') THEN o.total_amount END), 0) AS revenue
    FROM orders o
    LEFT JOIN sellers s ON o.seller_id = s.id
    WHERE o.created_at > datetime('now', '-' || ? || ' days')
    GROUP BY date(o.created_at), s.name
    ORDER BY date DESC, revenue DESC
  `).bind(days).all()

  const rows = results || []
  const csv = [
    '날짜,셀러,주문수,매출(원)',
    ...rows.map((r: any) => `${r.date},${r.seller_name || '미지정'},${r.order_count},${r.revenue}`)
  ].join('\n')

  return new Response('\uFEFF' + csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="admin-report-${days}d.csv"` },
  })
})

// ── 셀러 승인 대기 목록 ──
adminToolsRoutes.get('/sellers/pending', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT s.id, s.username, s.name, s.email, s.business_name, s.business_number, s.phone, s.created_at,
           s.linked_user_id, u.name AS linked_user_name
    FROM sellers s LEFT JOIN users u ON s.linked_user_id = u.id
    WHERE s.status = 'pending' ORDER BY s.created_at DESC
  `).all()
  return c.json({ success: true, data: results || [] })
})

adminToolsRoutes.put('/sellers/:id/approve', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare("UPDATE sellers SET status = 'approved', updated_at = datetime('now') WHERE id = ?").bind(id).run()
  // v30 FIX: admin-tools audit log 누락 보완
  await writeAuditLog(c, { action: 'seller.approve', targetType: 'seller', targetId: id })
  return c.json({ success: true })
})

adminToolsRoutes.put('/sellers/:id/reject', async (c) => {
  const id = c.req.param('id')
  const { reason } = await c.req.json<{ reason?: string }>().catch(() => ({ reason: '' }))
  await c.env.DB.prepare("UPDATE sellers SET status = 'rejected', updated_at = datetime('now') WHERE id = ?").bind(id).run()
  await writeAuditLog(c, { action: 'seller.reject', targetType: 'seller', targetId: id, after: { reason } })
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
  const { results } = await c.env.DB.prepare('SELECT id, title, image_url, link_url, description, is_active, display_order, start_date, end_date, created_at FROM banners ORDER BY display_order ASC, created_at DESC').all()
  return c.json({ success: true, data: results || [] })
})

adminToolsRoutes.post('/banners', async (c) => {
  const { title, image_url, link_url, display_order } = await c.req.json<any>()
  if (!image_url) return c.json({ success: false, error: '이미지 URL 필수' }, 400)

  // 🛡️ 2026-04-22: URL 검증 추가 (XSS/SSRF 방어)
  // 이전: admin-banners.routes.ts 는 validateImageUrl 쓰지만 여기선 검증 없었음
  const imgCheck = validateImageUrl(image_url)
  if (!imgCheck.valid) return c.json({ success: false, error: `이미지 URL: ${imgCheck.error}` }, 400)
  if (link_url && link_url !== '/') {
    const linkCheck = validateImageUrl(link_url)
    if (!linkCheck.valid) return c.json({ success: false, error: `링크 URL: ${linkCheck.error}` }, 400)
  }

  const result = await c.env.DB.prepare('INSERT INTO banners (title, image_url, link_url, display_order) VALUES (?, ?, ?, ?)')
    .bind(title || '', image_url, link_url || '/', display_order || 0).run()
  await writeAuditLog(c, {
    action: 'banner.create',
    targetType: 'banner',
    targetId: result.meta?.last_row_id,
    after: { title, image_url, link_url, display_order },
  })
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
  await writeAuditLog(c, { action: 'banner.update', targetType: 'banner', targetId: id, after: body })
  return c.json({ success: true })
})

adminToolsRoutes.delete('/banners/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM banners WHERE id = ?').bind(id).run()
  await writeAuditLog(c, { action: 'banner.delete', targetType: 'banner', targetId: id })
  return c.json({ success: true })
})

// ── 공지사항 발송 ──
adminToolsRoutes.post('/notices', async (c) => {
  const body = await c.req.json<{ title: string; message: string; target: 'all' | 'sellers' | 'users' }>()
  const { target } = body
  let { title, message } = body

  if (!title || !message) return c.json({ success: false, error: '제목과 내용 필수' }, 400)

  // 🛡️ 2026-04-22: 입력 검증 + XSS 방어
  if (typeof title !== 'string' || title.length > 200) {
    return c.json({ success: false, error: '제목은 200자 이하' }, 400)
  }
  if (typeof message !== 'string' || message.length > 5000) {
    return c.json({ success: false, error: '내용은 5000자 이하' }, 400)
  }
  if (!['all', 'sellers', 'users'].includes(target)) {
    return c.json({ success: false, error: 'target 은 all/sellers/users 중 하나' }, 400)
  }
  // HTML 태그 제거 (특히 <script>)
  title = title.replace(/<[^>]*>/g, '').slice(0, 200)
  message = message.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<[^>]*on\w+=/gi, '<').slice(0, 5000)

  let totalSent = 0
  if (target === 'sellers' || target === 'all') {
    const { results: sellers } = await c.env.DB.prepare("SELECT id FROM sellers WHERE status = 'approved'").all<{ id: number }>()
    if (sellers?.length) {
      const stmts = sellers.map(s =>
        c.env.DB.prepare("INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, created_at) VALUES ('seller', ?, 'admin_notice', ?, ?, datetime('now'))")
          .bind(String(s.id), title, message))
      for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50))
      totalSent += sellers.length
    }
  }
  if (target === 'users' || target === 'all') {
    const { results: users } = await c.env.DB.prepare("SELECT id FROM users ORDER BY id LIMIT 1000").all<{ id: string }>()
    if (users?.length) {
      const stmts = users.map(u =>
        c.env.DB.prepare("INSERT INTO user_notifications (user_id, type, title, message, created_at) VALUES (?, 'admin_notice', ?, ?, datetime('now'))")
          .bind(u.id, title, message))
      for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50))
      totalSent += users.length
    }
  }

  // 🛡️ Audit log — 누가 언제 어떤 공지를 얼마나 발송했는지 추적
  await writeAuditLog(c, {
    action: 'notices.broadcast',
    targetType: 'notifications',
    after: { title, target, recipientCount: totalSent }
  })

  return c.json({ success: true, message: `공지 발송 완료 (${totalSent}명)` })
})

// ── 정산 일괄 처리 ──
adminToolsRoutes.get('/settlements/pending', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT s.id AS seller_id, s.name AS seller_name, s.business_name,
      COALESCE(s.commission_rate, 10) AS commission_rate,
      COUNT(DISTINCT o.id) AS order_count,
      COALESCE(SUM(o.total_amount), 0) AS total_amount,
      COALESCE(SUM(o.total_amount * COALESCE(s.commission_rate, 10) / 100.0), 0) AS commission
    FROM orders o JOIN sellers s ON o.seller_id = s.id
    WHERE o.status IN ('DELIVERED', 'delivered') AND COALESCE(o.settlement_status, 'pending') = 'pending'
    GROUP BY s.id ORDER BY total_amount DESC
  `).all()
  return c.json({ success: true, data: results || [] })
})

adminToolsRoutes.post('/settlements/process', async (c) => {
  const { seller_ids } = await c.req.json<{ seller_ids: number[] }>()
  if (!seller_ids?.length) return c.json({ success: false, error: '셀러를 선택해주세요' }, 400)

  // 🛡️ 2026-04-22: 입력 검증 + 감사 로그 추가
  // 이전: seller_ids 배열 크기/타입 검증 없음, audit 없음
  if (seller_ids.length > 100) {
    return c.json({ success: false, error: '한 번에 최대 100명 처리 가능' }, 400)
  }
  const validIds = seller_ids.filter((id) => Number.isFinite(id) && id > 0)
  if (validIds.length !== seller_ids.length) {
    return c.json({ success: false, error: '유효하지 않은 seller_id 포함' }, 400)
  }

  let affectedOrders = 0
  const batchResults = await c.env.DB.batch(
    validIds.map(sid => c.env.DB.prepare(`
      UPDATE orders SET settlement_status = 'settled', updated_at = datetime('now')
      WHERE seller_id = ? AND status IN ('DELIVERED', 'delivered') AND COALESCE(settlement_status, 'pending') = 'pending'
    `).bind(sid))
  )
  for (const r of batchResults) affectedOrders += r.meta?.changes || 0

  // 감사 로그 — 누가 언제 몇 명 정산 처리했는지
  await writeAuditLog(c, {
    action: 'settlements.process',
    targetType: 'settlement',
    after: { sellerCount: validIds.length, affectedOrders, sellerIds: validIds }
  })

  return c.json({ success: true, message: `${validIds.length}명 / ${affectedOrders}건 정산 처리 완료` })
})

// ── 신고/차단 관리 ──
adminToolsRoutes.get('/reports', async (c) => {
  try { await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS user_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id TEXT, target_type TEXT, target_id TEXT,
      reason TEXT, status TEXT DEFAULT 'pending', admin_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, resolved_at DATETIME
    )`).run() } catch {}
  const { results } = await c.env.DB.prepare('SELECT id, reporter_id, target_type, target_id, reason, status, admin_note, created_at, resolved_at FROM user_reports ORDER BY created_at DESC LIMIT 50').all()
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
  const { results } = await c.env.DB.prepare('SELECT key, value, description, updated_at FROM platform_settings').all()
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
