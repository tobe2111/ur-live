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
import { sendBuyerVoucherUsedAlimtalk } from './helpers'
import { ensureTables, clawbackVoucherCommission, sendRefundAlimtalk } from './helpers'
// 🛡️ 2026-05-21: 카테고리 라벨 동적 (이용권 hardcode 제거).
import { getVoucherShortLabel } from '@/shared/constants/voucher-categories'

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

      // 🛡️ 2026-05-16: 사용자에게 사용 완료 알림톡 + 사장님 화면용 attribution 정보 수집
      let responseMeta: { product_name: string; restaurant_name: string | null; influencer_id?: string | null; influencer_commission?: number } = {
        product_name: '이용권', restaurant_name: null,
      }
      try {
        const meta = await DB.prepare(
          `SELECT v.id AS voucher_id, v.order_id, v.user_id, v.applied_price, u.phone,
                  p.name AS product_name, p.restaurant_name, p.category,
                  p.seller_id, p.consigned_from_seller_id
           FROM vouchers v
           LEFT JOIN users u ON u.id = v.user_id
           LEFT JOIN products p ON p.id = v.product_id
           WHERE v.code = ?`
        ).bind(code).first<{ voucher_id: number; order_id: number | null; user_id: string; applied_price: number | null; phone: string | null; product_name: string; restaurant_name: string | null; category: string | null; seller_id: number | null; consigned_from_seller_id: number | null }>()
        if (meta) {
          responseMeta = { product_name: meta.product_name, restaurant_name: meta.restaurant_name }
          // 🛡️ 2026-05-21 Phase C: voucher 사용 시점 자동 정산 ledger entries 3개 기록.
          //   merchant (가게) + seller (위탁 판매 셀러, optional) + platform fee 분배.
          //   멱등 — voucher_id 별 1회만 실행 (내부에서 SELECT 중복 체크).
          //   waitUntil 비동기 — 응답 지연 0.
          c.executionCtx?.waitUntil((async () => {
            try {
              const { recordVoucherUsedLedger, recordAgencyCommissionShare, recordIntroductionCommissionShare } = await import('../../../worker/utils/ledger')
              const merchantId = meta.consigned_from_seller_id ?? meta.seller_id ?? 0
              const sellerId = meta.consigned_from_seller_id ? meta.seller_id : null
              const amount = meta.applied_price || 0
              if (merchantId && amount > 0) {
                const result = await recordVoucherUsedLedger(DB, {
                  voucher_id: meta.voucher_id,
                  order_amount: amount,
                  merchant_id: merchantId,
                  seller_id: sellerId,
                })
                // 🛡️ Phase D: 에이전시 commission 자동 분배 (introduced_by_agency_id 있을 시).
                await recordAgencyCommissionShare(DB, {
                  voucher_id: meta.voucher_id,
                  merchant_id: merchantId,
                  platform_fee: result.platform_amount,
                })
                // 🛡️ Phase D-6: 인플루언서 입점 유치 commission (별도 영구 분배)
                await recordIntroductionCommissionShare(DB, {
                  voucher_id: meta.voucher_id,
                  merchant_id: merchantId,
                  platform_fee: result.platform_amount,
                })
              }
            } catch (e) { if (import.meta.env?.DEV) console.warn('[voucher-used-ledger]', e) }
            // 🆕 2026-06-17 (대표 결정 "예정→사용 시 확정"): 이 교환권 주문의 holding 추천적립(링크샵/추천)을
            //   '사용한 바로 이 시점'에 확정(granted)+딜 잔액 적립. 멱등(CAS) — 성숙 cron 안전망과 충돌 없음.
            try {
              if (meta.order_id) {
                const { matureAffiliateForOrder } = await import('../../../worker/utils/affiliate-credit')
                await matureAffiliateForOrder(DB, c.env, Number(meta.order_id))
              }
            } catch (e) { if (import.meta.env?.DEV) console.warn('[voucher-used-affiliate]', e) }
          })())
          // 🛡️ 2026-05-16: 어느 인플이 데려온 손님인지 attribution 조회 (사장님 화면 표시용)
          try {
            const attr = await DB.prepare(
              `SELECT influencer_id, commission_amount FROM influencer_attributions
               WHERE voucher_id = ? AND status != 'clawed_back' LIMIT 1`
            ).bind(meta.voucher_id).first<{ influencer_id: string; commission_amount: number }>()
            if (attr) {
              responseMeta.influencer_id = attr.influencer_id
              responseMeta.influencer_commission = attr.commission_amount
            }
          } catch { /* graceful */ }
          if (meta.phone) {
            c.executionCtx.waitUntil(
              sendBuyerVoucherUsedAlimtalk(
                c.env as { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string },
                meta.phone,
                { restaurantName: meta.restaurant_name || '매장', productName: meta.product_name, usedAt: new Date().toISOString(), categoryLabel: getVoucherShortLabel(meta.category) },
              )
            )
          }
        }
      } catch { /* graceful */ }

      return c.json({
        success: true,
        message: '이용권이 사용 처리되었습니다! 맛있게 드세요 🍽️',
        data: responseMeta,
      })
    }
  )

  // ── POST /:code/use-by-seller — 매장 사장님이 본인 매장 voucher 사용 (PIN 없이, seller JWT) ──
  // 🛡️ 2026-05-16: 기본 카메라 스캔으로 진입한 사장님이 1탭 사용 처리 가능하게.
  //   PIN 입력 없이 seller token 만으로 product 소유권 검증 후 atomic CAS.
  router.post(
    '/:code/use-by-seller',
    rateLimit({ action: 'voucher_use_seller', max: 30, windowSec: 60 }),
    requireAuth(),
    async (c) => {
      const user = getCurrentUser(c)
      if (!user || (user.type !== 'seller' && user.type !== 'admin')) {
        return c.json({ success: false, error: '셀러/어드민만 가능' }, 403)
      }
      const code = c.req.param('code')
      if (!code || !/^[A-Za-z0-9-]{4,64}$/.test(code)) {
        return c.json({ success: false, error: '잘못된 바우처 코드' }, 400)
      }
      const { DB } = c.env

      // 만료 차단
      try {
        await DB.prepare(
          "UPDATE vouchers SET status = 'expired' WHERE code = ? AND status = 'unused' AND expires_at IS NOT NULL AND expires_at < datetime('now')"
        ).bind(code).run()
      } catch { /* ignore */ }

      // voucher + product seller 검증
      const voucher = await DB.prepare(
        `SELECT v.id, v.status, v.user_id, v.product_id, v.applied_price,
                p.seller_id, p.consigned_from_seller_id, p.name AS product_name, p.restaurant_name, p.category
         FROM vouchers v LEFT JOIN products p ON p.id = v.product_id
         WHERE v.code = ?`
      ).bind(code).first<{ id: number; status: string; user_id: string; product_id: number; applied_price: number | null; seller_id: number; consigned_from_seller_id: number | null; product_name: string; restaurant_name: string | null; category: string | null }>()
      if (!voucher) return c.json({ success: false, error: '바우처를 찾을 수 없습니다' }, 404)
      if (user.type === 'seller' && Number(voucher.seller_id) !== Number(user.id)) {
        return c.json({ success: false, error: '본인 매장의 voucher 가 아닙니다' }, 403)
      }
      if (voucher.status === 'used') return c.json({ success: false, error: '이미 사용된 바우처입니다' }, 400)
      if (voucher.status === 'expired') return c.json({ success: false, error: '만료된 바우처입니다' }, 400)
      if (voucher.status === 'refunded') return c.json({ success: false, error: '환불된 바우처입니다' }, 400)

      // atomic CAS
      const result = await DB.prepare(
        "UPDATE vouchers SET status = 'used', used_at = datetime('now') WHERE id = ? AND status = 'unused'"
      ).bind(voucher.id).run()
      if (!result.meta?.changes) return c.json({ success: false, error: '동시성 충돌 — 다시 시도해주세요' }, 409)

      // 🛡️ 2026-05-21 Phase C: 정산 ledger entries 3개 자동 기록 (멱등).
      c.executionCtx?.waitUntil((async () => {
        try {
          const { recordVoucherUsedLedger, recordAgencyCommissionShare, recordIntroductionCommissionShare } = await import('../../../worker/utils/ledger')
          const merchantId = voucher.consigned_from_seller_id ?? voucher.seller_id
          const sellerForCommission = voucher.consigned_from_seller_id ? voucher.seller_id : null
          const amount = voucher.applied_price || 0
          if (merchantId && amount > 0) {
            const result = await recordVoucherUsedLedger(DB, {
              voucher_id: voucher.id,
              order_amount: amount,
              merchant_id: merchantId,
              seller_id: sellerForCommission,
            })
            await recordAgencyCommissionShare(DB, {
              voucher_id: voucher.id,
              merchant_id: merchantId,
              platform_fee: result.platform_amount,
            })
            await recordIntroductionCommissionShare(DB, {
              voucher_id: voucher.id,
              merchant_id: merchantId,
              platform_fee: result.platform_amount,
            })
          }
        } catch (e) { if (import.meta.env?.DEV) console.warn('[voucher-used-ledger]', e) }
      })())

      // attribution + 사용자 알림톡
      let attribution: { influencer_id?: string; influencer_commission?: number } = {}
      try {
        const attr = await DB.prepare(
          `SELECT influencer_id, commission_amount FROM influencer_attributions
           WHERE voucher_id = ? AND status != 'clawed_back' LIMIT 1`
        ).bind(voucher.id).first<{ influencer_id: string; commission_amount: number }>()
        if (attr) {
          attribution = { influencer_id: attr.influencer_id, influencer_commission: attr.commission_amount }
        }
      } catch { /* graceful */ }

      try {
        const userPhone = await DB.prepare("SELECT phone FROM users WHERE id = ?").bind(voucher.user_id).first<{ phone: string | null }>()
        if (userPhone?.phone) {
          c.executionCtx.waitUntil(
            sendBuyerVoucherUsedAlimtalk(
              c.env as { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string },
              userPhone.phone,
              { restaurantName: voucher.restaurant_name || '매장', productName: voucher.product_name, usedAt: new Date().toISOString(), categoryLabel: getVoucherShortLabel(voucher.category) },
            )
          )
        }
      } catch { /* graceful */ }

      return c.json({
        success: true,
        message: `✅ 메뉴 제공: ${voucher.product_name}`,
        data: {
          product_name: voucher.product_name,
          restaurant_name: voucher.restaurant_name,
          ...attribution,
        },
      })
    }
  )

  // ── POST /voucher/:code/cancel — 사용자 본인 구매 취소 / 청약철회 (미사용 + 7일 이내) ──
  // 🛡️ 2026-05-30: 즉시판매 단일가 모델 — 결제 즉시 교환권 확정 발급이라 사용자 셀프 취소 경로 필요.
  //   전자상거래법 청약철회(7일). 본인 voucher + status='unused' + 발급 7일 이내만.
  //   환불은 셀러 /refund 패턴 mirror: deal→지갑 즉시, toss→cancelTossPayment(영업일 3~5일).
  //   idempotencyKey 는 voucher-${id}-refund (셀러/만료 cron 과 공유 → 동일 voucher 이중환불 방어).
  //   인플루언서 commission clawback + 환불 알림톡 통합 헬퍼 호출 (helpers.ts).
  router.post(
    '/voucher/:code/cancel',
    rateLimit({ action: 'voucher_self_cancel', max: 10, windowSec: 600 }),
    requireAuth(),
    auditLog('group_buy.voucher.self_cancel'),
    async (c) => {
      const { DB } = c.env
      const user = getCurrentUser(c)
      if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

      const code = c.req.param('code') || ''
      if (!/^[A-Za-z0-9-]{4,64}$/.test(code)) {
        return c.json({ success: false, error: '잘못된 바우처 코드입니다' }, 400)
      }

      try {
        const voucher = await DB.prepare(`
          SELECT v.id, v.user_id, v.order_id, v.product_id, v.status, v.applied_price, v.created_at,
                 o.payment_method, o.payment_key,
                 p.price AS product_price, p.name AS product_name
          FROM vouchers v
          LEFT JOIN orders o ON o.id = v.order_id
          LEFT JOIN products p ON p.id = v.product_id
          WHERE v.code = ?
        `).bind(code).first<{
          id: number; user_id: string; order_id: number; product_id: number; status: string
          applied_price: number | null; created_at: string
          payment_method: string | null; payment_key: string | null
          product_price: number; product_name: string
        }>()

        if (!voucher) return c.json({ success: false, error: '교환권을 찾을 수 없습니다' }, 404)

        // 🛡️ IDOR: 본인 교환권만
        if (String(voucher.user_id) !== String((user as { id: number | string }).id)) {
          return c.json({ success: false, error: '본인 교환권만 취소할 수 있습니다' }, 403)
        }
        if (voucher.status !== 'unused') {
          const label = voucher.status === 'used' ? '사용' : voucher.status === 'refunded' ? '환불' : '만료'
          return c.json({ success: false, error: `이미 ${label}된 교환권입니다`, code: 'NOT_CANCELLABLE' }, 400)
        }

        // 🛡️ 청약철회 7일 — created_at 기준. CAS 에 created_at 가드 동시 적용 (race + window 동시 방어).
        const casRes = await DB.prepare(
          "UPDATE vouchers SET status = 'refunded' WHERE id = ? AND status = 'unused' AND created_at > datetime('now', '-7 days')"
        ).bind(voucher.id).run()
        if ((casRes.meta?.changes ?? 0) === 0) {
          return c.json({ success: false, error: '구매 후 7일이 지나 취소할 수 없습니다. 사용처에 직접 문의해주세요', code: 'WINDOW_EXPIRED' }, 400)
        }

        const refundAmount = Number(voucher.applied_price) > 0 ? Number(voucher.applied_price) : Number(voucher.product_price || 0)

        // 💳 결제 역전 — CAS 로 voucher 를 선점(refunded)한 뒤, 실제 환불이 성공해야만
        //   재고/정산/알림 side-effect 를 진행한다. 카드 Toss 취소가 실패하면 voucher 를
        //   unused 로 되돌려(선점 해제) 유저가 재시도 가능 → "이용권도 잃고 환불도 못 받는" 갭 차단.
        // 딜 결제 — 즉시 지갑 환불 (동기)
        if (voucher.payment_method === 'deal_points' && refundAmount > 0) {
          await DB.prepare('UPDATE user_points SET balance = balance + ? WHERE user_id = ?')
            .bind(refundAmount, voucher.user_id).run()
          await DB.prepare(
            "INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description) VALUES (?, 'refund', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?)"
          ).bind(voucher.user_id, refundAmount, refundAmount, voucher.user_id, `구매 취소 환불: ${voucher.product_name}`).run()
        }
        // 토스 카드 결제 — 동기 취소. 실패 시 선점 원복 + 에러(재고/정산/알림 미실행).
        //   (이전: waitUntil fire-and-forget → 취소 실패해도 voucher='refunded' 확정 + 미환불.)
        else if ((voucher.payment_method === 'toss' || voucher.payment_method === 'CARD') && voucher.order_id) {
          let cancelOk = false
          try {
            if (voucher.payment_key) {
              const { tossCancelPayment } = await import('../../../worker/utils/toss-refund')
              const result = await tossCancelPayment(c.env as unknown as { TOSS_SECRET_KEY?: string; DB?: D1Database }, voucher.payment_key, {
                reason: `구매 취소(청약철회): ${voucher.product_name}`,
                amount: refundAmount,
                idempotencyKey: `voucher-${voucher.id}-refund`,
              })
              cancelOk = !!result.ok
            }
          } catch (e) { if (import.meta.env?.DEV) console.warn('[voucher self-cancel toss]', e) }
          if (!cancelOk) {
            // 선점 해제 — 이 요청이 refunded 로 바꾼 것만 되돌림(멱등). 유저 이용권 보존.
            await DB.prepare("UPDATE vouchers SET status = 'unused' WHERE id = ? AND status = 'refunded'").bind(voucher.id).run().catch(() => null)
            return c.json({ success: false, error: '카드 취소 처리에 실패했습니다. 잠시 후 다시 시도해주세요', code: 'REFUND_FAILED' }, 502)
          }
          await DB.prepare("UPDATE orders SET status = 'REFUNDED', payment_status = 'refunded' WHERE id = ?").bind(voucher.order_id).run().catch(() => null)
        }

        // 재고/참여수 원복 — 환불 성공 후에만 (카드 실패는 위에서 early-return). clamp 로 음수 방어.
        await DB.prepare(
          "UPDATE products SET stock = stock + 1, group_buy_current = MAX(0, group_buy_current - 1), updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(voucher.product_id).run().catch(() => null)

        // ledger reverse entry (멱등)
        c.executionCtx?.waitUntil((async () => {
          try {
            const { recordRefundLedger } = await import('../../../worker/utils/ledger')
            await recordRefundLedger(DB, { voucher_id: voucher.id, reason: '사용자 구매 취소(청약철회)', amount: refundAmount })
          } catch (e) { if (import.meta.env?.DEV) console.warn('[self-cancel ledger]', e) }
        })())

        // 인플루언서 commission clawback (환불된 매출의 미지급 커미션 회수)
        c.executionCtx?.waitUntil((async () => {
          try { await clawbackVoucherCommission(DB, voucher.id, 'self_cancel') }
          catch (e) { if (import.meta.env?.DEV) console.warn('[self-cancel clawback]', e) }
        })())

        // 환불 완료 알림톡 (통합 헬퍼)
        c.executionCtx?.waitUntil(
          sendRefundAlimtalk(c.env as unknown as Record<string, unknown>, DB, voucher.user_id, voucher.product_name, refundAmount)
        )

        return c.json({
          success: true,
          data: { refunded: refundAmount, method: voucher.payment_method === 'deal_points' ? 'deal' : 'card' },
          message: voucher.payment_method === 'deal_points'
            ? `${refundAmount.toLocaleString('ko-KR')}딜이 즉시 환불되었습니다`
            : `${refundAmount.toLocaleString('ko-KR')}원이 환불 처리됩니다 (카드 영업일 기준 3~5일 소요)`,
        })
      } catch (err) {
        console.error('[voucher self-cancel]', err)
        return c.json({ success: false, error: '취소 처리 중 오류가 발생했습니다' }, 500)
      }
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
               p.price AS product_price, p.seller_id, p.name AS product_name
        FROM vouchers v
        LEFT JOIN products p ON p.id = v.product_id
        WHERE v.code = ?
      `).bind(code).first<{ id: number; user_id: string; product_id: number; status: string; applied_price: number | null; product_price: number; seller_id: number; product_name: string }>()
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
          // 🏁 2026-06-11 (응답 경로 부수효과 전수조사): 외부 푸시 호출 — 응답 후 실행(waitUntil).
          //   블록 내용/에러처리 불변 — 실행 시점만 이동. ctx 없으면(테스트) 기존처럼 동기 실행.
          {
            const _bg = async () => {
            try {
              const { sendSystemPush } = await import('../../../lib/system-push')
              await sendSystemPush(c.env, 'user', voucher.user_id, {
                title: '부분 환불 완료',
                body: `사용 ${usedAmount.toLocaleString()}원 / 환불 ${refundAmount.toLocaleString()}딜`,
                url: '/user/profile', tag: `partial-refund-${voucher.id}`,
              })
            } catch { /* ignore */ }
            }
            let _deferred = false
            try { if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(_bg()); _deferred = true } } catch { /* no ctx */ }
            if (!_deferred) await _bg()
          }

          // 환불 완료 알림톡 (통합 헬퍼 — 취소/부분환불 공통)
          c.executionCtx?.waitUntil(
            sendRefundAlimtalk(c.env as unknown as Record<string, unknown>, DB, voucher.user_id, voucher.product_name, refundAmount)
          )
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
