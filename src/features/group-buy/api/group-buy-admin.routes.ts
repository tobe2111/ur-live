/**
 * 🛡️ 2026-05-15 (TD-G01): 어드민 endpoint sub-router — group-buy.routes.ts 분리 1단계.
 *
 * 마운트: groupBuyRoutes.route('/admin', groupBuyAdminRoutes)
 * 결과: /api/group-buy/admin/* (기존 경로와 동일)
 *
 * 포함:
 *   - GET  /analytics            카테고리별 funnel + top GMV + 일별 추이
 *   - GET  /list                 전체 공구 현황 (status / unsuccessful 필터)
 *   - POST /force-refund/:productId  어드민 강제 환불 (require2FA + audit_log)
 */

import { Hono } from 'hono'
import { requireAdmin, getCurrentUser } from '@/worker/middleware/auth'
import { auditLog } from '@/worker/middleware/audit-log'
import { require2FA } from '@/worker/middleware/require-2fa'
import type { Env } from '@/worker/types/env'

const groupBuyAdminRoutes = new Hono<{ Bindings: Env }>()

// ── GET /admin/analytics — 카테고리별 funnel + top groups ──
// 🛡️ 2026-05-15: 공구 의사결정 데이터 — 카테고리별 진행/달성률, 매출 top, 평균 참여율
groupBuyAdminRoutes.get('/analytics', requireAdmin(), async (c) => {
  const { DB } = c.env
  try {
    // 카테고리별 통계
    const { results: byCategory } = await DB.prepare(`
      SELECT
        category,
        COUNT(*) AS total_groups,
        SUM(CASE WHEN group_buy_status = 'achieved' THEN 1 ELSE 0 END) AS achieved,
        SUM(CASE WHEN group_buy_status = 'expired' AND group_buy_current < group_buy_target THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN group_buy_status = 'active' THEN 1 ELSE 0 END) AS active,
        SUM(group_buy_current) AS total_participants,
        SUM(group_buy_current * price) AS total_gmv
      FROM products
      WHERE category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')
        AND group_buy_target > 0
      GROUP BY category
      ORDER BY total_gmv DESC
    `).all().catch(() => ({ results: [] }))

    // GMV top 10
    const { results: topGroups } = await DB.prepare(`
      SELECT p.id, p.name, p.category, p.group_buy_current, p.group_buy_target, p.group_buy_status,
             p.price, (p.group_buy_current * p.price) AS gmv,
             s.name AS seller_name
      FROM products p
      LEFT JOIN sellers s ON s.id = p.seller_id
      WHERE p.category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')
        AND p.group_buy_target > 0
        AND p.group_buy_current > 0
      ORDER BY gmv DESC
      LIMIT 10
    `).all().catch(() => ({ results: [] }))

    // 일별 참여 추이 (최근 30일)
    const { results: daily } = await DB.prepare(`
      SELECT DATE(o.created_at) AS day,
             COUNT(DISTINCT o.id) AS orders,
             COUNT(DISTINCT v.id) AS vouchers_issued,
             SUM(o.total_amount) AS gmv
      FROM orders o
      LEFT JOIN vouchers v ON v.order_id = o.id
      WHERE o.order_number LIKE 'GB-%'
        AND o.created_at >= datetime('now', '-30 days')
        AND o.status = 'PAID'
      GROUP BY DATE(o.created_at)
      ORDER BY day DESC
    `).all().catch(() => ({ results: [] }))

    // 전체 합계
    const totals = await DB.prepare(`
      SELECT
        COUNT(*) AS total_groups,
        SUM(CASE WHEN group_buy_status = 'achieved' THEN 1 ELSE 0 END) AS achieved_groups,
        SUM(CASE WHEN group_buy_status = 'active' THEN 1 ELSE 0 END) AS active_groups,
        SUM(group_buy_current) AS total_participants
      FROM products
      WHERE category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')
        AND group_buy_target > 0
    `).first().catch(() => null)

    return c.json({
      success: true,
      data: { totals, by_category: byCategory ?? [], top_groups: topGroups ?? [], daily: daily ?? [] }
    })
  } catch (err) {
    console.error('[admin gb analytics]', err)
    return c.json({ success: false, error: '집계 실패' }, 500)
  }
})

// ── GET /admin/list — 전체 공구 현황 ──
// 🛡️ 2026-05-15: 어드민이 진행중/만료/취소 전부 조회 + 미달성 공구 필터
groupBuyAdminRoutes.get('/list', requireAdmin(), async (c) => {
  const { DB } = c.env
  const status = c.req.query('status') || 'all'
  const filter = c.req.query('filter') || ''
  try {
    let sql = `
      SELECT p.id, p.name, p.price, p.image_url, p.category,
             p.group_buy_target, p.group_buy_current, p.group_buy_status, p.group_buy_deadline,
             p.seller_id, s.name AS seller_name, s.profile_image AS seller_avatar,
             p.created_at, p.updated_at
      FROM products p
      LEFT JOIN sellers s ON s.id = p.seller_id
      WHERE p.category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')
    `
    const binds: unknown[] = []
    if (status !== 'all') { sql += ` AND p.group_buy_status = ?`; binds.push(status) }
    if (filter === 'unsuccessful') {
      sql += ` AND p.group_buy_status IN ('expired','cancelled') AND p.group_buy_target > 0 AND p.group_buy_current < p.group_buy_target`
    }
    sql += ` ORDER BY p.created_at DESC LIMIT 200`
    const { results } = await DB.prepare(sql).bind(...binds).all()
    return c.json({ success: true, data: results ?? [] })
  } catch (err) {
    console.error('[admin gb list]', err)
    return c.json({ success: false, error: '조회 실패' }, 500)
  }
})

// ── POST /admin/seller-closure/:sellerId — 매장 폐업 시 모든 미사용 voucher 일괄 환불 (require2FA) ──
// 🛡️ 2026-05-16: 매장이 폐업/계약 해지된 경우 어드민이 한 번에 모든 미사용 voucher 환불 처리.
//   처리: voucher.status='unused' AND product.seller_id = ? → 환불 + clawback + 매장 receivable 차감
groupBuyAdminRoutes.post('/seller-closure/:sellerId', requireAdmin(), require2FA(), auditLog('group_buy.admin.seller_closure'), async (c) => {
  const sellerId = Number(c.req.param('sellerId'))
  const body = await c.req.json<{ reason: string }>().catch(() => ({ reason: '' }))
  const reason = String(body.reason || '').trim().slice(0, 500)
  if (!Number.isFinite(sellerId) || sellerId <= 0) return c.json({ success: false, error: 'invalid seller_id' }, 400)
  if (!reason || reason.length < 10) return c.json({ success: false, error: '폐업 사유 10자 이상 필수' }, 400)

  const DB = c.env.DB
  const { results: vouchers } = await DB.prepare(
    `SELECT v.id, v.user_id, v.product_id, v.applied_price, p.name AS product_name
     FROM vouchers v JOIN products p ON p.id = v.product_id
     WHERE v.status = 'unused' AND p.seller_id = ?`
  ).bind(sellerId).all<{ id: number; user_id: string; product_id: number; applied_price: number; product_name: string }>().catch(() => ({ results: [] as any[] }))

  let refundCount = 0
  let refundTotal = 0
  for (const v of (vouchers || [])) {
    const cas = await DB.prepare(
      "UPDATE vouchers SET status = 'refunded' WHERE id = ? AND status = 'unused'"
    ).bind(v.id).run().catch(() => ({ meta: { changes: 0 } }))
    if (!cas.meta?.changes) continue

    const amount = v.applied_price || 0
    // 사용자 환불
    if (amount > 0 && v.user_id) {
      try {
        await DB.prepare("UPDATE user_points SET balance = balance + ? WHERE user_id = ?").bind(amount, v.user_id).run()
        await DB.prepare(
          "INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description) VALUES (?, 'refund', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?)"
        ).bind(v.user_id, amount, amount, v.user_id, `[매장 폐업 환불] ${v.product_name}: ${reason}`).run()
      } catch (e) { console.error('[seller-closure refund]', e) }
    }
    // 인플 clawback
    try {
      const { results: attrs } = await DB.prepare(
        `SELECT id, influencer_id, commission_amount, status FROM influencer_attributions
         WHERE voucher_id = ? AND status IN ('pending', 'available') AND paid_at IS NULL`
      ).bind(v.id).all<{ id: number; influencer_id: string; commission_amount: number; status: string }>()
      for (const a of (attrs || [])) {
        await DB.prepare("UPDATE influencer_attributions SET status = 'clawed_back', clawback_reason = 'seller_closure' WHERE id = ?").bind(a.id).run()
        if (a.status === 'pending') {
          await DB.prepare("UPDATE influencer_balances SET pending_amount = MAX(0, pending_amount - ?), updated_at = datetime('now') WHERE influencer_id = ?")
            .bind(a.commission_amount, a.influencer_id).run()
        } else if (a.status === 'available') {
          await DB.prepare("UPDATE influencer_balances SET available_amount = MAX(0, available_amount - ?), updated_at = datetime('now') WHERE influencer_id = ?")
            .bind(a.commission_amount, a.influencer_id).run()
        }
      }
    } catch (e) { if (import.meta.env?.DEV) console.warn('[seller-closure clawback]', e) }
    refundCount++
    refundTotal += amount
  }

  // 매장 모든 product is_active=0
  try {
    await DB.prepare("UPDATE products SET is_active = 0, group_buy_status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE seller_id = ?").bind(sellerId).run()
    // 🛡️ 2026-05-17: sellers.status CHECK(IN 'pending','approved','rejected','suspended') —
    //   'closed' 는 허용값 아님 → CHECK 위반 silent fail. '폐업' 의미상 'suspended' (영업 정지) 가 가장 가깝다.
    await DB.prepare("UPDATE sellers SET status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(sellerId).run().catch(() => {})
  } catch { /* graceful */ }

  return c.json({ success: true, refund_count: refundCount, refund_total: refundTotal })
})

// ── POST /admin/force-refund/:productId — 강제 환불 (require2FA + audit_log) ──
// 🛡️ 2026-05-15: status 와 무관하게 미사용 voucher 일괄 환불 + audit_logs 기록.
//   기존 /refund/:productId 는 status='expired' 필요. 분쟁/긴급 케이스에 어드민 직접 개입.
groupBuyAdminRoutes.post('/force-refund/:productId', requireAdmin(), require2FA(), auditLog('group_buy.admin.force_refund'), async (c) => {
  const { DB } = c.env
  const adminUser = getCurrentUser(c)
  const productIdRaw = c.req.param('productId')
  const productIdNum = Number(productIdRaw)
  if (!Number.isFinite(productIdNum) || productIdNum <= 0 || !Number.isInteger(productIdNum)) {
    return c.json({ success: false, error: '잘못된 상품 ID 입니다' }, 400)
  }
  const productId = productIdNum
  let body: { reason?: string } = {}
  try { body = await c.req.json() } catch { /* allow empty */ }
  const reason = (body?.reason || '').toString().slice(0, 500)
  if (!reason || reason.length < 5) {
    return c.json({ success: false, error: '환불 사유(5자 이상)를 입력해주세요' }, 400)
  }

  try {
    const product = await DB.prepare(
      "SELECT id, name, price, seller_id, group_buy_status FROM products WHERE id = ?"
    ).bind(productId).first<{ id: number; name: string; price: number; seller_id: number; group_buy_status: string }>()
    if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

    const { results: vouchers } = await DB.prepare(
      "SELECT v.id, v.user_id, o.payment_method FROM vouchers v LEFT JOIN orders o ON v.order_id = o.id WHERE v.product_id = ? AND v.status = 'unused'"
    ).bind(productId).all<{ id: number; user_id: string; payment_method: string | null }>()

    let refundCount = 0
    const refundedUsers = new Set<string>()
    for (const v of vouchers ?? []) {
      const cas = await DB.prepare(
        "UPDATE vouchers SET status = 'refunded' WHERE id = ? AND status = 'unused'"
      ).bind(v.id).run()
      if ((cas.meta?.changes ?? 0) === 0) continue
      if (v.payment_method === 'deal_points' && v.user_id) {
        const amount = product.price
        try {
          await DB.prepare("UPDATE user_points SET balance = balance + ? WHERE user_id = ?")
            .bind(amount, v.user_id).run()
          await DB.prepare(
            "INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description) VALUES (?, 'refund', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?)"
          ).bind(v.user_id, amount, amount, v.user_id, `[어드민 환불] ${product.name}: ${reason}`).run()
        } catch (e) { console.error('[admin force-refund credit]', e) }
      }
      if (v.user_id) refundedUsers.add(v.user_id)
      refundCount++

      // 🛡️ 2026-05-16: 인플 commission clawback (강제 환불 시)
      try {
        const { results: attrs } = await DB.prepare(
          `SELECT id, influencer_id, commission_amount, status
           FROM influencer_attributions
           WHERE voucher_id = ? AND status IN ('pending', 'available') AND paid_at IS NULL`
        ).bind(v.id).all<{ id: number; influencer_id: string; commission_amount: number; status: string }>()
        for (const a of (attrs || [])) {
          await DB.prepare(
            "UPDATE influencer_attributions SET status = 'clawed_back', clawback_reason = 'admin_force_refund' WHERE id = ?"
          ).bind(a.id).run()
          if (a.status === 'pending') {
            await DB.prepare("UPDATE influencer_balances SET pending_amount = MAX(0, pending_amount - ?), updated_at = datetime('now') WHERE influencer_id = ?")
              .bind(a.commission_amount, a.influencer_id).run()
          } else if (a.status === 'available') {
            await DB.prepare("UPDATE influencer_balances SET available_amount = MAX(0, available_amount - ?), updated_at = datetime('now') WHERE influencer_id = ?")
              .bind(a.commission_amount, a.influencer_id).run()
          }
        }
      } catch (e) { if (import.meta.env?.DEV) console.warn('[force-refund clawback]', e) }
    }

    await DB.prepare("UPDATE products SET group_buy_status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(productId).run()

    // audit log (auditLog middleware 도 자동 기록하지만 metadata 풍부)
    try {
      await DB.prepare(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          actor_type TEXT, actor_id TEXT,
          action TEXT NOT NULL, target_type TEXT, target_id TEXT,
          metadata TEXT, ip_hash TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run()
      await DB.prepare(
        "INSERT INTO audit_logs (actor_type, actor_id, action, target_type, target_id, metadata) VALUES ('admin', ?, 'group_buy.force_refund', 'product', ?, ?)"
      ).bind(String(adminUser?.id ?? ''), String(productId), JSON.stringify({ reason, refundCount, productName: product.name })).run()
    } catch { /* table missing — skip */ }

    // 환불받은 유저 + 셀러에게 푸시
    try {
      const { sendSystemPush } = await import('../../../lib/system-push')
      for (const uid of refundedUsers) {
        try {
          await DB.prepare(
            `INSERT INTO user_notifications (user_id, type, title, message, link)
             VALUES (?, 'group_buy_refunded', ?, ?, ?)`
          ).bind(uid, '공구 환불 완료', `${product.name} 보증금이 환불됐어요`, '/user/profile').run()
        } catch { /* ignore */ }
        try {
          await sendSystemPush(c.env, 'user', uid, {
            title: '공구 환불 완료',
            body: `${product.name} 환불됐어요`,
            url: '/user/profile',
            tag: `gb-refunded-${productId}`,
          })
        } catch { /* ignore */ }
      }
      // 셀러 dashboard notification
      try {
        // 🛡️ 2026-05-17: notifications 스키마 fix — (user_type, message) 누락 시 silent fail.
        await DB.prepare(
          `INSERT INTO notifications (user_id, user_type, type, title, message, link, created_at)
           VALUES ((SELECT user_id FROM sellers WHERE id = ?), 'seller', 'group_buy_admin_refund', ?, ?, '/seller/group-buy', CURRENT_TIMESTAMP)`
        ).bind(product.seller_id, '관리자 환불 처리', `${product.name} 공구가 어드민에 의해 환불 처리됐습니다 (${refundCount}건). 사유: ${reason}`).run()
      } catch { /* notifications table may not exist */ }
    } catch (e) { console.error('[admin force-refund notify]', e) }

    return c.json({ success: true, data: { refunded: refundCount }, message: `${refundCount}건 환불 처리 완료` })
  } catch (err) {
    console.error('[admin gb force-refund]', err)
    return c.json({ success: false, error: '환불 처리 중 오류' }, 500)
  }
})

export { groupBuyAdminRoutes }
