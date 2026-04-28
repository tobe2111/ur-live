/**
 * 🛡️ 2026-04-28: 어드민 알림 채널 설정 API.
 *
 * - GET  /api/admin/notification-settings — 모든 type 별 설정 조회
 * - PUT  /api/admin/notification-settings/:type — 특정 type 의 채널 토글
 *
 * 마운트: app.route('/api/admin/notification-settings', adminNotificationSettingsRoutes)
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

interface SettingRow {
  notification_type: string
  dashboard_enabled: number
  email_enabled: number
  alimtalk_enabled: number
  push_enabled: number
  description: string | null
  updated_at: string
}

async function ensureTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS notification_channel_settings (
    notification_type TEXT PRIMARY KEY,
    dashboard_enabled INTEGER NOT NULL DEFAULT 1,
    email_enabled INTEGER NOT NULL DEFAULT 0,
    alimtalk_enabled INTEGER NOT NULL DEFAULT 0,
    push_enabled INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run().catch(() => {})

  // 기본 시드 (existing 행 안 덮어쓰고 추가만)
  const seeds = [
    ['seller_registered',    1, 1, 0, 1, '셀러 가입 신청'],
    ['seller_approved',      1, 1, 1, 1, '셀러 승인 (알림톡 권장)'],
    ['seller_rejected',      1, 1, 0, 0, '셀러 거절'],
    ['agency_registered',    1, 1, 0, 1, '에이전시 가입 신청'],
    ['agency_approved',      1, 1, 1, 1, '에이전시 승인 (알림톡 권장)'],
    ['new_order',            1, 0, 1, 1, '새 주문 (셀러에게 즉시 알림)'],
    ['order_delivered',      1, 0, 0, 1, '배송 완료'],
    ['gift_received',        0, 1, 1, 0, '선물 수신 (recipient 에게)'],
    ['gift_refunded',        0, 1, 1, 0, '선물 만료 환불'],
    ['settlement_completed', 1, 1, 0, 1, '정산 완료'],
    ['low_stock',            1, 0, 0, 1, '재고 부족'],
    ['settlement_request',   1, 0, 0, 1, '정산 신청 (어드민)'],
  ]
  for (const [type, dash, email, alim, push, desc] of seeds) {
    await db.prepare(
      `INSERT OR IGNORE INTO notification_channel_settings
       (notification_type, dashboard_enabled, email_enabled, alimtalk_enabled, push_enabled, description)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(type, dash, email, alim, push, desc).run().catch(() => {})
  }
}

app.get('/', async (c) => {
  await ensureTable(c.env.DB)
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM notification_channel_settings ORDER BY notification_type ASC`
    ).all<SettingRow>()
    return c.json({ success: true, data: results || [] })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

app.put('/:type', async (c) => {
  try {
    await ensureTable(c.env.DB)
    const type = c.req.param('type')
    const body = await c.req.json<{
      dashboard_enabled?: boolean
      email_enabled?: boolean
      alimtalk_enabled?: boolean
      push_enabled?: boolean
      description?: string
    }>()

    // 0/1 변환
    const sets: string[] = []
    const params: (number | string)[] = []
    for (const [k, v] of Object.entries(body)) {
      if (k === 'description') {
        if (typeof v === 'string') {
          sets.push('description = ?')
          params.push(v)
        }
        continue
      }
      if (typeof v === 'boolean') {
        sets.push(`${k} = ?`)
        params.push(v ? 1 : 0)
      }
    }
    if (sets.length === 0) {
      return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400)
    }
    sets.push("updated_at = datetime('now')")
    params.push(type)

    // 행 없으면 INSERT
    const existing = await c.env.DB.prepare(
      'SELECT 1 FROM notification_channel_settings WHERE notification_type = ?'
    ).bind(type).first()

    if (!existing) {
      await c.env.DB.prepare(
        `INSERT INTO notification_channel_settings
         (notification_type, dashboard_enabled, email_enabled, alimtalk_enabled, push_enabled, description)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        type,
        body.dashboard_enabled === false ? 0 : 1,
        body.email_enabled ? 1 : 0,
        body.alimtalk_enabled ? 1 : 0,
        body.push_enabled === false ? 0 : 1,
        body.description ?? null,
      ).run()
    } else {
      await c.env.DB.prepare(
        `UPDATE notification_channel_settings SET ${sets.join(', ')} WHERE notification_type = ?`
      ).bind(...params).run()
    }

    return c.json({ success: true })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

export { app as adminNotificationSettingsRoutes }
