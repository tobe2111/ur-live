/**
 * 💳 유어애즈 서비스몰 토스 결제 (2026-07-27 대표 "지금 토스까지 바로 붙혀줘")
 *   — 소비자 결제와 **완전 분리된 별도 배선**: ad_accounts 인증 + ad_service_orders 만 접촉.
 *   ⚠️ 잠금 준수: Toss SSOT 헬퍼(confirmTossPayment/cancelTossPayment/generateTossOrderId)를 **호출만**
 *      (toss-gateway 무수정 — CLAUDE.md 잠금 예외 "새 결제 시나리오에서 SSOT helper 호출").
 *   🔒 게이트: `ADS_TOSS_ENABLED==='true'`(기본 OFF) — **staging 실결제 검증 후에만 활성**.
 *      OFF 면 /config 가 disabled 를 반환해 클라 버튼 미노출 = 기존 계좌이체 흐름 byte-동일.
 *   🧭 마운트: 메인 워커 `/api/ads-pay/*`(고객) + `/api/admin/ads-pay/*`(어드민 환불) —
 *      TOSS_SECRET_KEY 가 메인 워커에만 있고, `/api/ads/*` 는 ur-ads 로 위임되므로 별도 네임스페이스.
 *
 *   💸 머니 룰 준수:
 *   - 금액 서버 권위: confirm 은 클라 amount 를 신뢰하지 않고 **DB total_amount** 로 승인(+게이트웨이 재검증).
 *   - Claim-before-credit: `unpaid→confirming` CAS 선점 후 승인 — 동시 confirm 은 changes=0 로 멱등 차단.
 *   - 환불 대칭: 토스 결제 주문의 환불 마킹은 cancelTossPayment 성공과 원자적으로 묶임(`paid→refunding→refunded`).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { requireAdmin } from '@/worker/middleware/auth'
import { adsAccountIdFrom } from './ads-account'
import { ensureServicesSchema } from './ad-services'
import { confirmTossPayment, cancelTossPayment, generateTossOrderId } from '@/worker/utils/toss-gateway'

const tossEnabled = (env: Env): boolean => env.ADS_TOSS_ENABLED === 'true' && !!env.TOSS_SECRET_KEY && !!env.TOSS_CLIENT_KEY

interface PayOrderRow { id: number; account_id: number; service_name: string; total_amount: number; payment_status: string; toss_order_id: string | null; toss_payment_key: string | null }
const loadOrder = (DB: D1Database, id: number) =>
  DB.prepare('SELECT id, account_id, service_name, total_amount, payment_status, toss_order_id, toss_payment_key FROM ad_service_orders WHERE id = ?')
    .bind(id).first<PayOrderRow>().catch(() => null)

export const adsPayRoutes = new Hono<{ Bindings: Env }>()

// GET /api/ads-pay/config — 게이트/클라이언트 키(활성일 때만). 버튼 노출 판단용.
adsPayRoutes.get('/config', (c) => {
  const enabled = tossEnabled(c.env)
  return c.json({ success: true, enabled, client_key: enabled ? c.env.TOSS_CLIENT_KEY : null })
})

// POST /api/ads-pay/init { order_id } — 결제 시작: toss_order_id 발급(멱등 재사용) + 위젯 파라미터 반환.
adsPayRoutes.post('/init', rateLimit({ action: 'ads-pay-init', max: 30, windowSec: 60 }), async (c) => {
  if (!tossEnabled(c.env)) return c.json({ success: false, error: '카드 결제가 아직 활성화되지 않았습니다' }, 400)
  const acct = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!acct) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await ensureServicesSchema(c.env.DB)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const order = await loadOrder(c.env.DB, Number(b.order_id))
  if (!order || order.account_id !== acct) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
  if (order.payment_status !== 'unpaid') return c.json({ success: false, error: '이미 결제되었거나 결제할 수 없는 주문입니다' }, 400)
  if (!Number.isFinite(order.total_amount) || order.total_amount <= 0) return c.json({ success: false, error: '결제 금액이 올바르지 않습니다' }, 400)
  // toss_order_id 멱등: 있으면 재사용(중복 결제창 재시도 안전), 없으면 SSOT 생성기('AD' 프리픽스)로 발급 후 저장.
  let tossOrderId = order.toss_order_id
  if (!tossOrderId) {
    tossOrderId = generateTossOrderId('AD', acct)
    await c.env.DB.prepare('UPDATE ad_service_orders SET toss_order_id = ? WHERE id = ? AND toss_order_id IS NULL')
      .bind(tossOrderId, order.id).run().catch(() => null)
    const re = await loadOrder(c.env.DB, order.id) // 동시 init 레이스 — DB 에 실제 저장된 값이 권위
    tossOrderId = re?.toss_order_id || tossOrderId
  }
  return c.json({
    success: true, toss_order_id: tossOrderId, amount: order.total_amount,
    order_name: `유어애즈 ${order.service_name}`.slice(0, 90), // Toss orderName 100자 제한 준수
    customer_key: `ads-acct-${acct}`,
  })
})

// POST /api/ads-pay/confirm { order_id, payment_key, toss_order_id } — 승인(금액은 서버 DB 권위).
adsPayRoutes.post('/confirm', rateLimit({ action: 'ads-pay-confirm', max: 20, windowSec: 60 }), async (c) => {
  if (!tossEnabled(c.env)) return c.json({ success: false, error: '카드 결제가 아직 활성화되지 않았습니다' }, 400)
  const acct = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!acct) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await ensureServicesSchema(c.env.DB)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const paymentKey = String(b.payment_key || '')
  const order = await loadOrder(c.env.DB, Number(b.order_id))
  if (!order || order.account_id !== acct) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
  if (order.payment_status === 'paid') return c.json({ success: true, already: true }) // 멱등(재리다이렉트/새로고침)
  if (!order.toss_order_id || String(b.toss_order_id || '') !== order.toss_order_id)
    return c.json({ success: false, error: '결제 정보가 주문과 일치하지 않습니다' }, 400)
  if (!paymentKey) return c.json({ success: false, error: '결제 정보가 올바르지 않습니다' }, 400)
  // 🔒 CAS 선점(unpaid→confirming) — 동시 confirm 단일 실행. 선점 실패 시 재조회로 멱등 판정.
  const claim = await c.env.DB.prepare("UPDATE ad_service_orders SET payment_status = 'confirming' WHERE id = ? AND payment_status = 'unpaid'")
    .bind(order.id).run().catch(() => null)
  if (!claim || (claim.meta?.changes || 0) === 0) {
    const re = await loadOrder(c.env.DB, order.id)
    return re?.payment_status === 'paid' ? c.json({ success: true, already: true }) : c.json({ success: false, error: '결제 확인이 진행 중입니다. 잠시 후 새로고침해주세요' }, 409)
  }
  // 승인 — SSOT 게이트웨이(금액 재검증·멱등키·서킷브레이커 내장). 금액 = DB total_amount(클라 불신).
  const r = await confirmTossPayment({ env: c.env, paymentKey, orderId: order.toss_order_id, amount: order.total_amount, idempotencyKey: `adsvc-${order.id}` })
  if (!r.ok) { // 실패 → 선점 되돌림(다시 결제 시도 가능). 게이트웨이 메시지는 사용자 안전 문구.
    await c.env.DB.prepare("UPDATE ad_service_orders SET payment_status = 'unpaid' WHERE id = ? AND payment_status = 'confirming'")
      .bind(order.id).run().catch(() => null)
    return c.json({ success: false, error: r.message || '결제 승인에 실패했습니다' }, 400)
  }
  await c.env.DB.prepare("UPDATE ad_service_orders SET payment_status = 'paid', toss_payment_key = ?, paid_at = datetime('now') WHERE id = ? AND payment_status = 'confirming'")
    .bind(paymentKey, order.id).run().catch(() => null)
  return c.json({ success: true })
})

// ── 어드민 환불(/api/admin/ads-pay) — 토스 결제 주문은 실제 취소와 원자적으로 묶어 마킹 ──
export const adminAdsPayRoutes = new Hono<{ Bindings: Env }>()
adminAdsPayRoutes.use('*', requireAdmin())

// POST /api/admin/ads-pay/refund { order_id, reason? } — 전액 환불(토스 취소 → refunded 마킹).
adminAdsPayRoutes.post('/refund', async (c) => {
  await ensureServicesSchema(c.env.DB)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const order = await loadOrder(c.env.DB, Number(b.order_id))
  if (!order) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
  if (order.payment_status !== 'paid') return c.json({ success: false, error: '결제 완료 상태의 주문만 환불할 수 있습니다' }, 400)
  if (!order.toss_payment_key) return c.json({ success: false, error: '계좌이체 주문입니다 — 접수함에서 환불 처리로 표시해주세요(입금 반환은 수동)' }, 400)
  // 🔒 CAS(paid→refunding) — 이중 환불 클릭 단일 실행.
  const claim = await c.env.DB.prepare("UPDATE ad_service_orders SET payment_status = 'refunding' WHERE id = ? AND payment_status = 'paid'")
    .bind(order.id).run().catch(() => null)
  if (!claim || (claim.meta?.changes || 0) === 0) return c.json({ success: false, error: '이미 환불 처리 중이거나 완료된 주문입니다' }, 409)
  const r = await cancelTossPayment({ env: { TOSS_SECRET_KEY: c.env.TOSS_SECRET_KEY, DB: c.env.DB }, paymentKey: order.toss_payment_key, cancelReason: String(b.reason || '유어애즈 서비스 주문 환불').slice(0, 200), idempotencyKey: `adsvc-refund-${order.id}` })
  if (!r.ok) { // 취소 실패 → paid 복원(마킹만 refunded 로 남는 불일치 방지 — status 플립 ≠ 환불 룰).
    await c.env.DB.prepare("UPDATE ad_service_orders SET payment_status = 'paid' WHERE id = ? AND payment_status = 'refunding'")
      .bind(order.id).run().catch(() => null)
    return c.json({ success: false, error: r.message || '토스 결제 취소에 실패했습니다' }, 400)
  }
  await c.env.DB.prepare("UPDATE ad_service_orders SET payment_status = 'refunded' WHERE id = ? AND payment_status = 'refunding'")
    .bind(order.id).run().catch(() => null)
  return c.json({ success: true })
})
