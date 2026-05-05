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
import { swallow } from '@/worker/utils/swallow'

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
  )`).run().catch(swallow('admin-notification-settings:create-table'))

  // 기본 시드 (existing 행 안 덮어쓰고 추가만) — 모든 트리거 망라
  const seeds = [
    // 가입·승인
    ['seller_registered',      1, 1, 0, 1, '[어드민] 셀러 가입 신청'],
    ['seller_approved',        1, 1, 1, 1, '[셀러] 가입 승인 (알림톡 권장)'],
    ['seller_rejected',        1, 1, 0, 0, '[셀러] 가입 거절'],
    ['agency_registered',      1, 1, 0, 1, '[어드민] 에이전시 가입 신청'],
    ['agency_approved',        1, 1, 1, 1, '[에이전시] 가입 승인 (알림톡 권장)'],
    // 주문·배송
    ['new_order',              1, 0, 1, 1, '[셀러] 새 주문 (즉시 알림 권장)'],
    ['order_delivered',        1, 0, 0, 1, '[셀러+어드민] 배송 완료'],
    ['purchase_confirmed',     1, 0, 0, 1, '[셀러] 구매 확정 (정산 가능)'],
    ['return_request',         1, 1, 0, 1, '[셀러+어드민] 반품 신청'],
    ['order_cancelled',        1, 0, 0, 1, '[셀러+어드민] 주문 취소'],
    ['deal_payment',           1, 0, 0, 1, '[어드민] 딜 결제'],
    // 정산
    ['settlement_completed',   1, 1, 0, 1, '[셀러] 정산 완료'],
    ['settlement_request',     1, 0, 0, 1, '[어드민] 셀러 정산 신청'],
    ['agency_settlement',      1, 0, 0, 1, '[어드민] 에이전시 정산 신청'],
    // 후원·리뷰
    ['donation_received',      1, 0, 1, 1, '[셀러] 후원 받음 (라이브)'],
    ['new_review',             1, 0, 0, 1, '[셀러] 새 리뷰 등록'],
    // 경매
    ['auction_won',            1, 0, 0, 1, '[user] 경매 낙찰 (결제 안내)'],
    ['auction_outbid',         0, 0, 0, 1, '[user] 더 높은 입찰자 등장 (push 권장)'],
    ['auction_promoted',       1, 0, 0, 1, '[user] 차순위 승격 낙찰'],
    // 재고·딜
    ['low_stock',              1, 0, 0, 1, '[셀러] 재고 부족 (5개 이하)'],
    ['deal_charged',           1, 0, 0, 0, '[어드민] 딜 충전'],
    // 선물
    ['gift_received',          0, 1, 1, 0, '[recipient] 선물 수신 (외부 사용자)'],
    ['gift_refunded',          0, 1, 1, 0, '[sender] 선물 만료 환불'],
    // 셀러 부가 서비스
    ['supply_registered',      1, 0, 0, 1, '[어드민] 공급 상품 등록'],
    ['sample_request',         1, 0, 0, 1, '[어드민] 샘플 신청'],
    ['youtube_growth_request', 1, 0, 0, 1, '[어드민] 유튜브 성장 신청'],
    ['youtube_growth_update',  1, 1, 0, 1, '[셀러] 유튜브 성장 진행 업데이트'],
    // 사용자 지향 (확장 가능)
    ['order_paid',             0, 1, 0, 1, '[user] 결제 완료 영수증'],
    ['order_shipped',          0, 1, 0, 1, '[user] 배송 시작'],
    ['live_starting',          0, 0, 0, 1, '[user] 관심 셀러 라이브 시작'],
    ['wishlist_price_drop',    0, 1, 0, 1, '[user] 위시리스트 가격 인하'],
    ['coupon_expiring',        0, 0, 0, 1, '[user] 쿠폰 만료 임박'],
    ['password_reset',         0, 1, 0, 0, '[user] 비밀번호 재설정 요청'],
    ['welcome',                0, 1, 0, 1, '[user] 가입 환영'],
    // 운영
    ['system_alert',           1, 1, 0, 0, '[어드민] 시스템 에러/장애'],
    ['payment_failed',         1, 0, 0, 1, '[어드민] 결제 실패'],
    ['inactive_seller',        1, 1, 0, 0, '[어드민] 부진 셀러 detect'],
    ['inactive_agency',        1, 1, 0, 0, '[어드민] 부진 에이전시 detect'],
  ] as const
  await db.batch(seeds.map(([type, dash, email, alim, push, desc]) =>
    db.prepare(
      `INSERT OR IGNORE INTO notification_channel_settings
       (notification_type, dashboard_enabled, email_enabled, alimtalk_enabled, push_enabled, description)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(type, dash, email, alim, push, desc)
  )).catch(swallow('admin-notification-settings:upsert-batch'))
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
