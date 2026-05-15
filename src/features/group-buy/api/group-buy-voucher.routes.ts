/**
 * 🛡️ 2026-05-15 (TD-G01 3단계): Voucher endpoints — group-buy.routes.ts 분리.
 *
 * register 패턴 — path 보존.
 *
 * 포함:
 *   - POST /:code/use                           voucher 사용 처리 (PIN, atomic CAS, log)
 *   - POST /voucher/:code/partial-refund        부분 환불 (used + ledger reverse)
 *   - POST /store-stats/:productId              사장님 통계 (PIN/Magic Link)
 */

import type { Hono } from 'hono'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { auditLog } from '@/worker/middleware/audit-log'
import type { Env } from '@/worker/types/env'
import { recordLedger } from '@/worker/utils/ledger'
import type { GroupBuyProductRow } from '@/shared/db/group-buy-types'
import { ensureTables } from './helpers'

export function registerVoucherEndpoints(router: Hono<{ Bindings: Env }>): void {
  // ── POST /:code/use — voucher 사용 (PIN 검증) ──
  // ✅ rate limit (brute-force 차단) + atomic CAS (race condition 차단).
  //    6자리 PIN 은 IP 당 5회/분으로 제한하여 단시간 무차별 대입 방지.
  router.post(
    '/:code/use',
    rateLimit({ action: 'voucher_use', max: 5, windowSec: 60 }),
    async (c) => {
      const { DB } = c.env
      const code = c.req.param('code')
      if (!code || typeof code !== 'string' || code.length < 4 || code.length > 64 || !/^[A-Za-z0-9-]+$/.test(code)) {
        return c.json({ success: false, error: '잘못된 바우처 코드입니다' }, 400)
      }
      const { pin } = await c.req.json<{ pin?: string }>().catch(() => ({ pin: undefined }))

      if (!pin || typeof pin !== 'string' || pin.length > 64) {
        return c.json({ success: false, error: '비밀번호를 입력해주세요' }, 400)
      }

      // 만료된 바우처 선차단: 만료 기한이 지났다면 상태를 전이시킨 뒤 400 응답.
      // (CAS 조건에 만료 체크를 묶으면 만료 자체가 "PIN 오류"로 혼동될 수 있어 분리)
      try {
        await DB.prepare(
          "UPDATE vouchers SET status = 'expired' WHERE code = ? AND status = 'unused' AND expires_at IS NOT NULL AND expires_at < datetime('now')"
        ).bind(code).run()
      } catch { /* ignore */ }

      // CAS: code + pin + status='unused' 세 조건을 원자적으로 검증/갱신.
      // 중간 SELECT 없이 단일 UPDATE 로 경쟁 조건과 PIN 타이밍 공격을 동시에 차단.
      const result = await DB.prepare(
        `UPDATE vouchers
           SET status = 'used', used_at = datetime('now')
         WHERE code = ?
           AND status = 'unused'
           AND (expires_at IS NULL OR expires_at > datetime('now'))
           AND product_id IN (
             SELECT id FROM products
             WHERE id = vouchers.product_id
               AND (store_verify_pin IS NULL OR store_verify_pin = ?)
           )`
      ).bind(code, pin).run()

      // 🛡️ 모든 사용 시도 로그 — 셀러가 사용 흐름 추적.
      //   PIN 정답 여부는 노출하지 않지만, 셀러 본인은 자기 가게의 PIN 오류 빈도 알 필요 있음.
      try {
        await DB.prepare(`
          CREATE TABLE IF NOT EXISTS voucher_use_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL,
            product_id INTEGER,
            seller_id INTEGER,
            success INTEGER NOT NULL,
            reason TEXT,
            ip_hash TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run()
        await DB.prepare(`
          CREATE INDEX IF NOT EXISTS idx_voucher_use_logs_seller ON voucher_use_logs(seller_id, created_at DESC)
        `).run()
      } catch { /* ignore */ }

      const success = (result.meta?.changes ?? 0) > 0
      let failReason: string | null = null
      let voucherRecord: { status: string; expires_at: string | null; product_id: number } | null = null
      if (!success) {
        voucherRecord = await DB.prepare(
          "SELECT status, expires_at, product_id FROM vouchers WHERE code = ?"
        ).bind(code).first()
        if (!voucherRecord) failReason = 'not_found'
        else if (voucherRecord.status === 'used') failReason = 'already_used'
        else if (voucherRecord.status === 'expired') failReason = 'expired'
        else if (voucherRecord.status === 'refunded') failReason = 'refunded'
        else failReason = 'pin_mismatch'
      }
      // 로그 INSERT (best-effort) — seller_id 는 product 에서 조회
      try {
        const productId = voucherRecord?.product_id ?? (success
          ? (await DB.prepare("SELECT product_id FROM vouchers WHERE code = ?").bind(code).first<{ product_id: number }>())?.product_id
          : null)
        const sellerId = productId
          ? (await DB.prepare("SELECT seller_id FROM products WHERE id = ?").bind(productId).first<{ seller_id: number }>())?.seller_id
          : null
        const ipRaw = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || ''
        // IP 해시 (개인정보 직접 저장 X)
        const ipHash = ipRaw ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ipRaw + (c.env.JWT_SECRET || '')))))
          .slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('') : null
        await DB.prepare(`
          INSERT INTO voucher_use_logs (code, product_id, seller_id, success, reason, ip_hash)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(code, productId ?? null, sellerId ?? null, success ? 1 : 0, failReason, ipHash).run()
      } catch (e) {
        if (import.meta.env?.DEV) console.warn('[voucher use log]', e)
      }

      if (!success) {
        if (failReason === 'not_found') return c.json({ success: false, error: '바우처를 찾을 수 없습니다' }, 404)
        if (failReason === 'already_used') return c.json({ success: false, error: '이미 사용된 바우처입니다' }, 400)
        if (failReason === 'expired') return c.json({ success: false, error: '만료된 바우처입니다' }, 400)
        if (failReason === 'refunded') return c.json({ success: false, error: '환불된 바우처입니다' }, 400)
        return c.json({ success: false, error: '이미 사용되었거나 PIN이 틀립니다.' }, 400)
      }

      return c.json({ success: true, message: '식사권이 사용 처리되었습니다! 맛있게 드세요 🍽️' })
    }
  )

  // ── POST /voucher/:code/partial-refund — 부분 사용 후 잔여 환불 ──
  // 🛡️ 1만원 voucher 중 5천원만 사용 → 5천원 자동 환불.
  //   유스케이스: 음식 가격이 voucher 가격보다 싸면 차액 환불.
  //   sellers / admins 만 호출 가능 (본인 product 의 voucher 만).
  router.post(
    '/voucher/:code/partial-refund',
    rateLimit({ action: 'voucher_partial_refund', max: 30, windowSec: 300 }),
    requireAuth(),
    auditLog('group_buy.partial_refund'),
    async (c) => {
      const user = getCurrentUser(c)
      if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
      const userAsAny = user as unknown as { id?: number | string; type?: string }
      if (userAsAny.type !== 'seller' && userAsAny.type !== 'admin') {
        return c.json({ success: false, error: '셀러/어드민만 가능' }, 403)
      }

      const code = c.req.param('code') || ''
      if (!/^[A-Za-z0-9-]{4,64}$/.test(code)) {
        return c.json({ success: false, error: '잘못된 voucher 코드' }, 400)
      }

      let body: { used_amount?: number; refund_reason?: string }
      try { body = await c.req.json() } catch { return c.json({ success: false, error: 'JSON 형식 오류' }, 400) }

      const usedAmount = Number(body.used_amount)
      if (!Number.isFinite(usedAmount) || !Number.isInteger(usedAmount) || usedAmount <= 0 || usedAmount > 100_000_000) {
        return c.json({ success: false, error: '사용 금액(원)을 0보다 큰 정수로 입력해주세요' }, 400)
      }
      const reason = (body.refund_reason || '').toString().slice(0, 500)

      const { DB } = c.env

      // voucher 조회 + 셀러 본인 product 검증
      const voucher = await DB.prepare(`
        SELECT v.id, v.user_id, v.product_id, v.status, v.applied_price,
               p.price AS product_price, p.seller_id
        FROM vouchers v
        LEFT JOIN products p ON p.id = v.product_id
        WHERE v.code = ?
      `).bind(code).first<{ id: number; user_id: string; product_id: number; status: string; applied_price: number | null; product_price: number; seller_id: number }>()
      if (!voucher) return c.json({ success: false, error: 'voucher 없음' }, 404)
      if (voucher.status !== 'unused') {
        return c.json({ success: false, error: `이미 ${voucher.status} 상태` }, 400)
      }
      // 셀러 권한 — 본인 product 만
      if (userAsAny.type === 'seller' && Number(voucher.seller_id) !== Number(userAsAny.id)) {
        return c.json({ success: false, error: '본인 product 의 voucher 만 처리 가능' }, 403)
      }

      const voucherValue = Number(voucher.applied_price ?? voucher.product_price)
      if (usedAmount > voucherValue) {
        return c.json({ success: false, error: `사용 금액(${usedAmount}원)이 voucher 가치(${voucherValue}원) 초과` }, 400)
      }

      const refundAmount = voucherValue - usedAmount
      if (refundAmount === 0) {
        // 전액 사용 — 일반 use 와 동일
        const useResult = await DB.prepare(`UPDATE vouchers SET status = 'used', used_at = datetime('now') WHERE id = ? AND status = 'unused'`).bind(voucher.id).run()
        if (!useResult.meta?.changes) return c.json({ success: false, error: '동시성 충돌' }, 409)
        return c.json({ success: true, data: { used: usedAmount, refunded: 0, message: '전액 사용 처리' } })
      }

      // CAS: unused → used (status atomic)
      const useResult = await DB.prepare(`
        UPDATE vouchers SET status = 'used', used_at = datetime('now')
        WHERE id = ? AND status = 'unused'
      `).bind(voucher.id).run()
      if (!useResult.meta?.changes) return c.json({ success: false, error: '동시성 충돌' }, 409)

      // 부분 환불 — 유저 user_points 에 차액 환불 + ledger reverse entry
      try {
        const order = await DB.prepare("SELECT payment_method FROM orders o JOIN vouchers v ON v.order_id = o.id WHERE v.id = ?").bind(voucher.id).first<{ payment_method: string }>()
        if (order?.payment_method === 'deal_points' && voucher.user_id) {
          await DB.prepare("UPDATE user_points SET balance = balance + ? WHERE user_id = ?").bind(refundAmount, voucher.user_id).run()
          await DB.prepare(
            "INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description) VALUES (?, 'refund', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?)"
          ).bind(voucher.user_id, refundAmount, refundAmount, voucher.user_id, `부분 환불 (사용 ${usedAmount}원/${voucherValue}원): ${reason || code}`).run()

          // 🛡️ 2026-05-15 (TD-G05): ledger reverse entry — 셀러 receivable 차감, 유저 wallet 환불
          try {
            await recordLedger(DB, {
              event_type: 'partial_refund',
              reference_id: `voucher-${voucher.id}`,
              amount: refundAmount,
              debit_account: `seller:${voucher.seller_id}`,  // 셀러 receivable 차감
              credit_account: `user:${voucher.user_id}`,     // 유저 wallet 환불
              metadata: { voucher_id: voucher.id, code, used_amount: usedAmount, total_value: voucherValue, reason: reason || null },
            })
          } catch (e) { if (import.meta.env?.DEV) console.warn('[partial-refund ledger]', e) }

          // 유저 push
          try {
            const { sendSystemPush } = await import('../../../lib/system-push')
            await sendSystemPush(c.env, 'user', voucher.user_id, {
              title: '부분 환불 완료',
              body: `사용 ${usedAmount.toLocaleString()}원 / 환불 ${refundAmount.toLocaleString()}딜`,
              url: '/user/profile', tag: `partial-refund-${voucher.id}`,
            })
          } catch { /* ignore */ }
        }
      } catch (e) { console.error('[partial-refund]', e) }

      return c.json({
        success: true,
        data: { used: usedAmount, refunded: refundAmount, message: `${usedAmount}원 사용, ${refundAmount}원 환불` },
      })
    }
  )

  // ── POST /store-stats/:productId — 사장님 통계 (PIN/Magic Link 인증) ──
  // 🛡️ 조회 전 PIN 검증 필수 + rate limit (PIN brute force 방어).
  // 🛡️ Magic Link 토큰(?t=...) 도 허용 — 사장님이 알림톡 링크로 무인증 진입.
  router.post(
    '/store-stats/:productId',
    rateLimit({ action: 'store_stats_pin', max: 5, windowSec: 300 }),
    async (c) => {
      const { DB } = c.env
      await ensureTables(DB)
      const productIdRaw = c.req.param('productId')
      const productIdNum = Number(productIdRaw)
      if (!Number.isFinite(productIdNum) || productIdNum <= 0 || !Number.isInteger(productIdNum)) {
        return c.json({ success: false, error: '잘못된 상품 ID 입니다' }, 400)
      }
      const productId = productIdNum
      const tokenFromQuery = c.req.query('t')?.trim() || ''
      let pin = ''
      try {
        const body = await c.req.json<{ pin?: string }>()
        pin = (body?.pin || '').trim()
      } catch { /* GET-style 호환: body 없을 수 있음 */ }

      // 인증 방식: token 우선, 없으면 PIN
      if (!tokenFromQuery && (!pin || pin.length < 4)) {
        return c.json({ success: false, error: '인증 토큰 또는 PIN(4자 이상)이 필요합니다' }, 400)
      }

      try {
        // 🛡️ CAS 패턴: token/PIN 검증과 조회를 한 번에 (timing attack 방어)
        type StoreStatsProduct = Pick<GroupBuyProductRow, 'id' | 'name' | 'restaurant_name' | 'group_buy_target' | 'group_buy_current'>
        const product = tokenFromQuery
          ? await DB.prepare(
              "SELECT id, name, restaurant_name, group_buy_target, group_buy_current FROM products WHERE id = ? AND category = 'meal_voucher' AND store_owner_token = ?"
            ).bind(productId, tokenFromQuery).first<StoreStatsProduct>()
          : await DB.prepare(
              "SELECT id, name, restaurant_name, group_buy_target, group_buy_current FROM products WHERE id = ? AND category = 'meal_voucher' AND store_verify_pin = ?"
            ).bind(productId, pin).first<StoreStatsProduct>()

        if (!product) {
          // 상품 없음 vs 인증 실패 구분하지 않음 (enumeration 방어)
          return c.json({ success: false, error: '상품을 찾을 수 없거나 인증이 올바르지 않습니다' }, 403)
        }

        // 바우처 통계
        const stats = await DB.prepare(`
          SELECT
            COUNT(*) as total_vouchers,
            SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as used,
            SUM(CASE WHEN status = 'unused' THEN 1 ELSE 0 END) as unused,
            SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired
          FROM vouchers WHERE product_id = ?
        `).bind(productId).first<{ total_vouchers: number; used: number; unused: number; expired: number }>()

        return c.json({
          success: true,
          data: {
            product_name: product.name,
            restaurant_name: product.restaurant_name,
            total_vouchers: stats?.total_vouchers || 0,
            used: stats?.used || 0,
            unused: stats?.unused || 0,
            expired: stats?.expired || 0,
            group_buy_current: product.group_buy_current || 0,
            group_buy_target: product.group_buy_target || 0,
          },
        })
      } catch {
        return c.json({ success: false, error: '통계 조회 실패' }, 500)
      }
    }
  )
}
