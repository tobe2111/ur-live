import type { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { safeError } from '../../../../worker/utils/safe-error'

export function registerVoucherOrders(r: Hono<{ Bindings: Env }>) {
  // 🛡️ 2026-05-23: KT Alpha 발송 추적 페이지용 API
  // GET /admin/voucher-orders?hours=24&status=failed&limit=500
  r.get('/voucher-orders', cors(), async (c) => {
    const hours = Math.min(Math.max(1, Number(c.req.query('hours') || '24')), 168)
    const limit = Math.min(Math.max(1, Number(c.req.query('limit') || '500')), 1000)
    const status = c.req.query('status')
    try {
      const statusFilter = status && ['processing', 'sent', 'failed'].includes(status)
        ? `AND status = '${status}'` : ''
      // 🛡️ 2026-06-17: 발송 실패는 '기간 무관 전체' 표시 — 오래된 미해결 실패가 시간창(기본 24h/최대 7일)에
      //   가려져 "실패했다는데 목록에 안 보임" 신고 발생(대시보드 failed 카운트는 기간 무관 전체라 불일치).
      //   failed 필터 시 created_at 조건 제거 → 모든 실패 건이 항상 보이고 재발송 가능.
      const timeFilter = status === 'failed' ? '' : `AND created_at >= datetime('now', '-${hours} hours')`
      // 🎫 2026-06-17: retry_count(자동 재시도 횟수) 노출 — COALESCE 로 컬럼 미적용 환경(NULL) graceful.
      const rows = await c.env.DB.prepare(
        `SELECT id, goods_name, recipient_phone, unit_price, quantity, status,
                external_order_id, sent_at, failure_reason, created_at, updated_at,
                COALESCE(retry_count, 0) AS retry_count
           FROM voucher_orders
          WHERE source = 'kt_alpha'
            ${timeFilter}
            ${statusFilter}
          ORDER BY created_at DESC LIMIT ?`
      ).bind(limit).all().catch(() => ({ results: [] }))

      const stats = await c.env.DB.prepare(
        `SELECT
           SUM(CASE WHEN status='processing' AND created_at >= datetime('now', '-${hours} hours') THEN 1 ELSE 0 END) AS processing,
           SUM(CASE WHEN status='sent'       AND created_at >= datetime('now', '-${hours} hours') THEN 1 ELSE 0 END) AS sent,
           SUM(CASE WHEN status='failed'     AND created_at >= datetime('now', '-${hours} hours') THEN 1 ELSE 0 END) AS failed,
           SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed_all
         FROM voucher_orders WHERE source = 'kt_alpha'`
      ).first<{ processing: number; sent: number; failed: number; failed_all: number }>().catch(() => null)

      // 🎫 2026-06-17: 실패 사유 집계 (기간 무관) — 운영자가 패턴(전화번호 없음 / API 에러 등) 한눈에 파악.
      const failureSummary = await c.env.DB.prepare(
        `SELECT failure_reason AS reason, COUNT(*) AS cnt
           FROM voucher_orders
          WHERE source = 'kt_alpha' AND status = 'failed' AND failure_reason IS NOT NULL
          GROUP BY failure_reason ORDER BY cnt DESC LIMIT 10`
      ).all<{ reason: string; cnt: number }>().catch(() => ({ results: [] as { reason: string; cnt: number }[] }))

      return c.json({
        success: true,
        data: rows.results || [],
        stats: stats || { processing: 0, sent: 0, failed: 0, failed_all: 0 },
        failure_summary: failureSummary.results || [],
      })
    } catch (err) {
      return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
    }
  })

  // POST /admin/voucher-orders/:id/resend — failed voucher 재발송
  r.post('/voucher-orders/:id/resend', cors(), async (c) => {
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
    try {
      const vo = await c.env.DB.prepare(
        "SELECT id, goods_code, goods_name, recipient_phone, unit_price, status FROM voucher_orders WHERE id = ?"
      ).bind(id).first<{ id: number; goods_code: string; goods_name: string; recipient_phone: string; unit_price: number; status: string }>()
      if (!vo) return c.json({ success: false, error: 'voucher_order 없음' }, 404)
      if (vo.status === 'sent') return c.json({ success: false, error: '이미 발송됨' }, 400)

      const settings = await c.env.DB.prepare(
        "SELECT key, value FROM platform_settings WHERE key IN ('kt_alpha_user_id','kt_alpha_callback_no','kt_alpha_template_id','kt_alpha_banner_id')"
      ).all<{ key: string; value: string }>().catch(() => ({ results: [] }))
      const sMap: Record<string, string> = {}
      for (const r of (settings.results || [])) sMap[r.key] = r.value
      if (!sMap.kt_alpha_user_id || !sMap.kt_alpha_callback_no) {
        return c.json({ success: false, error: 'kt_alpha_user_id/callback_no 설정 누락' }, 503)
      }

      await c.env.DB.prepare(
        "UPDATE voucher_orders SET status = 'processing', failure_reason = NULL, updated_at = datetime('now') WHERE id = ?"
      ).bind(id).run()

      const { sendCoupon } = await import('../../../../worker/utils/giftishow-api')
      // 🛡️ 2026-05-25: KT Alpha TRID 20자 제한 (ERR0807). base36 단축.
      const trId = `r${id}-${Date.now().toString(36)}`
      try {
        const res = await sendCoupon(c.env as unknown as Parameters<typeof sendCoupon>[0], {
          goodsCode: vo.goods_code,
          phoneNo: vo.recipient_phone,
          callbackNo: sMap.kt_alpha_callback_no,
          mmsTitle: `[유어딜] ${vo.goods_name}`.slice(0, 30),
          mmsMsg: `${vo.goods_name} 교환권이 도착했습니다. 30일 이내 사용해주세요.`,
          trId,
          userId: sMap.kt_alpha_user_id,
          orderNo: `r-${id}`,
          gubun: 'N',
          templateId: sMap.kt_alpha_template_id || undefined,
          bannerId: sMap.kt_alpha_banner_id || undefined,
        })
        await c.env.DB.prepare(
          "UPDATE voucher_orders SET status = 'sent', external_order_id = ?, sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
        ).bind(res.orderNo || trId, id).run()
        return c.json({ success: true, data: { external_order_id: res.orderNo || trId } })
      } catch (sendErr) {
        const msg = (sendErr as Error).message.slice(0, 500)
        await c.env.DB.prepare(
          "UPDATE voucher_orders SET status = 'failed', failure_reason = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(msg, id).run()
        return c.json({ success: false, error: msg }, 500)
      }
    } catch (err) {
      return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
    }
  })

  // 🔁 2026-06-17 (사용자 요청): failed KT Alpha 발송 일괄 재발송 — 옛 ERR0807(거래ID 20자 초과) backlog 등
  //   '결제됐는데 안 옴' 건을 새 짧은 trId 로 한 번에 재시도. 운영자 트리거(비즈머니 통제).
  //   안전: status='failed' + 유효 폰만 / CAS(failed→processing) 선점으로 동시·중복 발송 차단 /
  //   성공분만 'sent' 전환(재실행해도 멱등) / limit·days 상한.
  r.post('/voucher-orders/resend-failed', cors(), async (c) => {
    try {
      const body = await c.req.json<{ limit?: number; days?: number }>().catch(() => ({} as { limit?: number; days?: number }))
      const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 200)
      const days = Math.min(Math.max(Number(body.days) || 90, 1), 365)

      const settings = await c.env.DB.prepare(
        "SELECT key, value FROM platform_settings WHERE key IN ('kt_alpha_user_id','kt_alpha_callback_no','kt_alpha_template_id','kt_alpha_banner_id')"
      ).all<{ key: string; value: string }>().catch(() => ({ results: [] }))
      const sMap: Record<string, string> = {}
      for (const r of (settings.results || [])) sMap[r.key] = r.value
      if (!sMap.kt_alpha_user_id || !sMap.kt_alpha_callback_no) {
        return c.json({ success: false, error: 'kt_alpha_user_id/callback_no 설정 누락' }, 503)
      }

      const failed = await c.env.DB.prepare(
        `SELECT id, goods_code, goods_name, recipient_phone
           FROM voucher_orders
          WHERE source = 'kt_alpha' AND status = 'failed'
            AND recipient_phone IS NOT NULL AND recipient_phone != ''
            AND created_at >= datetime('now', ?)
          ORDER BY created_at DESC LIMIT ?`
      ).bind(`-${days} days`, limit).all<{ id: number; goods_code: string; goods_name: string; recipient_phone: string }>().catch(() => ({ results: [] }))

      const orders = failed.results || []
      const { sendCoupon } = await import('../../../../worker/utils/giftishow-api')
      let resent = 0
      let stillFailed = 0
      const errors: string[] = []

      for (const vo of orders) {
        const phone = String(vo.recipient_phone || '').replace(/\D/g, '')
        if (!/^01\d{8,9}$/.test(phone)) { stillFailed++; continue }
        // 💰 CAS 선점 — failed→processing 원자 전환. 다른 발송/재발송이 이미 잡았으면 changes=0 → skip(이중발송 차단).
        const claim = await c.env.DB.prepare(
          "UPDATE voucher_orders SET status='processing', failure_reason=NULL, updated_at=datetime('now') WHERE id=? AND status='failed'"
        ).bind(vo.id).run().catch(() => null)
        if (!claim?.meta?.changes) continue
        const trId = `r${vo.id}-${Date.now().toString(36)}`
        try {
          const res = await sendCoupon(c.env as unknown as Parameters<typeof sendCoupon>[0], {
            goodsCode: vo.goods_code,
            phoneNo: phone,
            callbackNo: sMap.kt_alpha_callback_no,
            mmsTitle: '유어딜 교환권',
            mmsMsg: `${vo.goods_name} 교환권이 도착했습니다. 30일 이내 사용해주세요.`,
            trId,
            userId: sMap.kt_alpha_user_id,
            orderNo: `r-${vo.id}`,
            gubun: 'N',
            templateId: sMap.kt_alpha_template_id || undefined,
            bannerId: sMap.kt_alpha_banner_id || undefined,
          })
          await c.env.DB.prepare(
            "UPDATE voucher_orders SET status='sent', external_order_id=?, sent_at=datetime('now'), updated_at=datetime('now') WHERE id=?"
          ).bind(res.orderNo || trId, vo.id).run()
          resent++
        } catch (sendErr) {
          const msg = (sendErr as Error).message.slice(0, 500)
          await c.env.DB.prepare(
            "UPDATE voucher_orders SET status='failed', failure_reason=?, updated_at=datetime('now') WHERE id=?"
          ).bind(msg, vo.id).run().catch(() => null)
          stillFailed++
          if (errors.length < 5) errors.push(`#${vo.id}: ${msg.slice(0, 120)}`)
        }
      }

      return c.json({ success: true, data: { scanned: orders.length, resent, stillFailed, errors } })
    } catch (err) {
      return safeError(c, err, '일괄 재발송 중 오류가 발생했습니다', '[kt-alpha-resend-failed]')
    }
  })
}
