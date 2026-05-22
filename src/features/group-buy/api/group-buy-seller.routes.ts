/**
 * 🛡️ 2026-05-15 (TD-G01 2단계): 셀러 endpoints — group-buy.routes.ts 분리.
 *
 * 패턴: register 함수로 main router 에 endpoints 추가 — path 보존.
 *
 * 호출:
 *   import { registerSellerEndpoints } from './group-buy-seller.routes'
 *   registerSellerEndpoints(groupBuyRoutes)
 *
 * 포함:
 *   - POST /refund/:productId         (마감된 미달성 공구 환불, 셀러 본인 product 만)
 *   - GET  /seller-voucher-stats      (본인 상품 voucher 통계)
 *   - GET  /voucher-logs              (본인 가게 voucher 사용 시도 로그)
 */

import type { Hono } from 'hono'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import { auditLog } from '@/worker/middleware/audit-log'
import { rateLimit } from '@/worker/middleware/rate-limit'
import type { Env } from '@/worker/types/env'
import type { GroupBuyProductRow } from '@/shared/db/group-buy-types'

interface RefundVoucherRow {
  id: number
  user_id: string | null
  total_amount: number
  payment_method: string | null
}

export function registerSellerEndpoints(router: Hono<{ Bindings: Env }>): void {
  // ── POST /refund/:productId — 마감된 미달성 공구 환불 ──
  router.post('/refund/:productId', rateLimit({ action: 'group_buy_seller_refund', max: 10, windowSec: 3600 }), requireAuth(), auditLog('group_buy.seller.refund'), async (c) => {
    const { DB } = c.env
    const productIdRaw = c.req.param('productId')
    const productIdNum = Number(productIdRaw)
    if (!Number.isFinite(productIdNum) || productIdNum <= 0 || !Number.isInteger(productIdNum)) {
      return c.json({ success: false, error: '잘못된 상품 ID 입니다' }, 400)
    }
    const productId = productIdNum

    try {
      const product = await DB.prepare(
        "SELECT * FROM products WHERE id = ? AND category = 'meal_voucher'"
      ).bind(productId).first<GroupBuyProductRow>()

      if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

      // ✅ OWNERSHIP FIX: Only the product's seller (or admin) can refund
      const authUser = getCurrentUser(c)
      if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401)
      if (authUser.type !== 'admin') {
        if (authUser.type !== 'seller' || Number(product.seller_id) !== Number(authUser.id)) {
          return c.json({ success: false, error: 'forbidden — not your product' }, 403)
        }
      }

      if (product.group_buy_status !== 'expired') return c.json({ success: false, error: '마감된 공동구매만 환불 가능합니다' }, 400)
      if (product.group_buy_current >= product.group_buy_target) return c.json({ success: false, error: '목표 달성된 공동구매는 환불 불가' }, 400)

      // 미사용 바우처 환불 처리
      const { results: vouchers } = await DB.prepare(
        "SELECT v.id, o.user_id, o.total_amount, o.payment_method FROM vouchers v LEFT JOIN orders o ON v.order_id = o.id WHERE v.product_id = ? AND v.status = 'unused'"
      ).bind(productId).all<RefundVoucherRow>()

      let refundCount = 0
      for (const v of (vouchers || [])) {
        // CAS voucher status unused → refunded (멱등 + double-refund 방어)
        const casRes = await DB.prepare(
          "UPDATE vouchers SET status = 'refunded' WHERE id = ? AND status = 'unused'"
        ).bind(v.id).run()
        if ((casRes.meta?.changes ?? 0) === 0) continue

        // 🛡️ 2026-05-21 Phase D-3: 환불 시 ledger reverse entry 자동 (멱등).
        //   기존 voucher_used entry 가 있어도 없어도 OK (미사용 voucher 도 entry 0).
        //   환불 amount 는 product.price (BUG #45 패턴 — total_amount 아님).
        c.executionCtx?.waitUntil((async () => {
          try {
            const { recordRefundLedger } = await import('../../../worker/utils/ledger')
            await recordRefundLedger(DB, {
              voucher_id: v.id,
              reason: '셀러/어드민 환불 (group-buy cancellation)',
              amount: product.price,
            })
          } catch (e) { if (import.meta.env?.DEV) console.warn('[refund ledger]', e) }
        })())

        // 🛡️ 2026-05-21 Phase D-4: 환불 사용자 알림톡 (waitUntil 비동기).
        c.executionCtx?.waitUntil((async () => {
          try {
            if (!v.user_id) return
            const user = await DB.prepare("SELECT phone FROM users WHERE id = ?").bind(v.user_id).first<{ phone: string }>()
            if (!user?.phone) return
            const { sendSystemAlimtalk } = await import('../../../lib/system-alimtalk')
            const amount = product.price.toLocaleString('ko-KR')
            const msg = `[유어딜] 환불 완료 — ${product.name}\n${amount}원이 환불 처리되었습니다.\n(딜 결제건은 즉시 잔액 반영, 카드 결제건은 영업일 기준 3~5일 소요)`
            await sendSystemAlimtalk(c.env as unknown as Record<string, unknown>, user.phone, 'voucher_refunded', msg)
          } catch (e) { if (import.meta.env?.DEV) console.warn('[refund alimtalk]', e) }
        })())

        // 딜 결제건 1 voucher 당 product.price 환불 (BUG #45: total_amount 사용 시 N배 환불 위험)
        if (v.payment_method === 'deal_points' && v.user_id) {
          const amount = product.price
          await DB.prepare('UPDATE user_points SET balance = balance + ? WHERE user_id = ?')
            .bind(amount, v.user_id).run()
          await DB.prepare(
            "INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description) VALUES (?, 'refund', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?)"
          ).bind(v.user_id, amount, amount, v.user_id, `공동구매 미달성 환불: ${product.name}`).run()
        }
        refundCount++
      }

      await DB.prepare("UPDATE products SET group_buy_status = 'cancelled' WHERE id = ?").bind(productId).run()

      return c.json({ success: true, data: { refunded: refundCount }, message: `${refundCount}건 환불 처리 완료` })
    } catch (err) {
      console.error('[group-buy refund]', err)
      return c.json({ success: false, error: '환불 처리 중 오류' }, 500)
    }
  })

  // ── GET /seller-voucher-stats — 본인 상품 voucher 통계 ──
  // 🛡️ 2026-05-13 (공구 UX #2): 셀러 본인 상품의 바우처 통계 (사용/미사용/만료/환불)
  router.get('/seller-voucher-stats', requireAuth(), async (c) => {
    const user = getCurrentUser(c)
    if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
    const userAsAny = user as unknown as { id: number | string; type?: string; role?: string }
    const isSeller = userAsAny.type === 'seller' || userAsAny.role === 'seller'
    if (!isSeller) return c.json({ success: false, error: '셀러만 접근 가능' }, 403)

    const idsRaw = c.req.query('product_ids') || ''
    const ids = idsRaw.split(',').map(s => parseInt(s.trim())).filter(n => Number.isFinite(n) && n > 0)
    if (ids.length === 0) return c.json({ success: true, data: [] })

    try {
      const placeholders = ids.map(() => '?').join(',')
      // 셀러 본인 상품 검증
      const { results: owned } = await c.env.DB.prepare(
        `SELECT id FROM products WHERE seller_id = ? AND id IN (${placeholders})`
      ).bind(user.id, ...ids).all<{ id: number }>()
      const ownedIds = (owned ?? []).map(r => r.id)
      if (ownedIds.length === 0) return c.json({ success: true, data: [] })

      const ownedPlaceholders = ownedIds.map(() => '?').join(',')
      const { results } = await c.env.DB.prepare(`
        SELECT product_id,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as used,
          SUM(CASE WHEN status = 'unused' THEN 1 ELSE 0 END) as unused,
          SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
          SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) as refunded
        FROM vouchers
        WHERE product_id IN (${ownedPlaceholders})
        GROUP BY product_id
      `).bind(...ownedIds).all()
      return c.json({ success: true, data: results ?? [] })
    } catch (err) {
      console.error('[seller-voucher-stats]', err)
      return c.json({ success: true, data: [] })
    }
  })

  // ── GET /voucher-logs — 본인 가게 voucher 사용 시도 로그 ──
  // 🛡️ 2026-05-13 (운영 안정성 #3): 셀러가 PIN 오류 / 만료 / 사용 빈도 확인 → 가게 문제 자가 진단.
  router.get('/voucher-logs', requireAuth(), async (c) => {
    const user = getCurrentUser(c)
    if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const userAsAny = user as unknown as { id: number | string; type?: string; role?: string }
    const isSeller = userAsAny.type === 'seller' || userAsAny.role === 'seller'
    if (!isSeller) return c.json({ success: false, error: '셀러만 접근 가능합니다' }, 403)

    const { DB } = c.env
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50')))
    try {
      const { results } = await DB.prepare(`
        SELECT l.id, l.code, l.product_id, l.success, l.reason, l.created_at,
               p.name as product_name, p.restaurant_name
        FROM voucher_use_logs l
        LEFT JOIN products p ON p.id = l.product_id
        WHERE l.seller_id = ?
        ORDER BY l.created_at DESC
        LIMIT ?
      `).bind(user.id, limit).all()

      // 요약 통계
      const summary = await DB.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN reason = 'pin_mismatch' THEN 1 ELSE 0 END) as pin_errors,
          SUM(CASE WHEN reason = 'expired' THEN 1 ELSE 0 END) as expired_errors,
          SUM(CASE WHEN reason = 'already_used' THEN 1 ELSE 0 END) as already_used_errors
        FROM voucher_use_logs
        WHERE seller_id = ? AND created_at >= datetime('now', '-7 days')
      `).bind(user.id).first()

      return c.json({ success: true, data: { logs: results ?? [], summary } })
    } catch (err) {
      console.error('[voucher-logs]', err)
      return c.json({ success: true, data: { logs: [], summary: { total: 0 } } })  // fail-soft
    }
  })
}
