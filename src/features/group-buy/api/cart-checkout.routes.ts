/**
 * 🧺 이용권 장바구니 결제 — 한 번 결제하고 여러 이용권을 받는다 (2026-09-15)
 *
 * 대표: *"장바구니쪽도 진행해줘. 끝까지 모두 다. 이용권 결제 플로우에 문제 없도록"*
 *
 * ## 이 레일을 고른 이유 (설명은 `cart-lines.ts` 머리말)
 * 발급(`INSERT INTO vouchers`)은 공구 레일에만 있다. 그래서 장바구니도 공구 레일에서 결제한다 —
 * **Toss 감사-잠금 파일은 한 글자도 안 건드린다**(SSOT helper `confirmTossPayment` 를 *호출*만 한다,
 * 잠금표 예외 절이 명시적으로 허용하는 그 형태다).
 *
 * ## 단일 구매와 다른 점은 셋뿐이다
 *   ① 줄이 여러 개다 → 게이트를 줄마다 돌리고 **하나라도 막히면 전체를 막는다**
 *   ② `orders` 는 **한 행**이다(`order_number` = 토스 orderId — 웹훅이 이 값으로 주문을 찾는다).
 *      셀러가 여럿이면 `orders.seller_id` 는 null 이다. ⚠️ 그래도 정산은 안 깨진다 —
 *      정산 근거는 `donations.seller_id` · `ledger_entries` · `vouchers→products.seller_id` 이고
 *      **셋 다 줄 단위**다(환불 회수 `voucher-settlement-clawback` 도 `p.seller_id` 로 판단한다 — 실측).
 *   ③ 재고·딜은 **전부 되거나 전부 안 되거나**다. 한 줄이 실패하면 앞서 잡은 재고를 되돌리고
 *      결제를 통째로 취소한다(부분 구매를 만들지 않는다).
 *
 * ## 🚦 게이트 — 기본 OFF
 * `platform_settings.voucher_cart_enabled = 'true'` 라야 열린다. 머니 경로라 **staging 실결제 전에는
 * 켜지 않는다**(CLAUDE.md). 꺼져 있으면 이 레일은 존재하지 않는 것과 같고, 단일 구매는 무영향이다.
 */
import { Hono } from 'hono'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { recordLedger, sellerLedgerAccount } from '@/worker/utils/ledger'
import { resolveUserIdString } from '@/worker/utils/resolve-user-id'
import { getCommissionRates } from './commission-rates'
import { getSellerCommissionRate, generateUniqueVoucherCode, applyGroupBuyReferral } from './helpers'
import { getVoucherShortLabel } from '@/shared/constants/voucher-categories'
import { resolveGbOrderNumber, guardAwaitingDeposit } from './gb-purchase-guards'
import { resolvePartialDealPlan, derivePartialDeal, spendPartialDeal, recordOrderDealUsed, restorePartialDeal } from './partial-deal'
import { normalizeCartLines, priceCartLines, cartOrderName, type PricedLine } from './cart-lines'
import { saveCartIntent, loadCartIntent, markCartIntentConsumed } from './cart-intent'
import type { Env } from '@/worker/types/env'

const cartCheckoutRoutes = new Hono<{ Bindings: Env }>()

const GATE_KEY = 'voucher_cart_enabled'

/** 게이트. 조회 실패는 **꺼진 것으로** 본다 — 머니 경로에서 fail-open 은 안 된다. */
async function cartEnabled(DB: D1Database): Promise<boolean> {
  try {
    const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(GATE_KEY).first<{ value: string }>()
    return String(row?.value ?? '').toLowerCase() === 'true'
  } catch { return false }
}

const GATE_OFF = { success: false, error: '장바구니 결제는 아직 준비 중입니다', code: 'CART_CHECKOUT_DISABLED' } as const

/** 소개(ref) 정규화 — 단일 경로와 같은 형식 검증. 본인 귀속은 `applyGroupBuyReferral` 이 거른다. */
async function normalizeRef(DB: D1Database, raw: unknown, userId: string): Promise<string> {
  const s = raw ? String(raw).trim() : ''
  if (!s || !/^[a-zA-Z0-9_\-:]{1,64}$/.test(s) || s === userId) return ''
  const exists = await DB.prepare(
    'SELECT 1 FROM sellers WHERE id = ? UNION ALL SELECT 1 FROM users WHERE id = ? LIMIT 1',
  ).bind(s, s).first().catch(() => null)
  return exists ? s : ''
}

/* ────────────────────────────────────────────────────────────────────────────
 * ① 결제 시작 — 금액은 **서버가 정한다**(클라가 보낸 값은 쓰지 않는다)
 * ──────────────────────────────────────────────────────────────────────────── */
cartCheckoutRoutes.post('/cart/init', rateLimit({ action: 'gb_cart_init', max: 10, windowSec: 60 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  if (!await cartEnabled(DB)) return c.json(GATE_OFF, 403)

  const userId = await resolveUserIdString(DB, user.id, user.isDbId)
  type InitBody = { items?: unknown; ref?: string; deal_use?: number | null }
  const body: InitBody = await c.req.json<InitBody>().catch(() => ({} as InitBody))

  const lines = normalizeCartLines(body.items)
  if (!lines) return c.json({ success: false, error: '장바구니 정보가 올바르지 않습니다', code: 'BAD_ITEMS' }, 400)

  const priced = await priceCartLines(DB, userId, lines)
  if (!priced.ok) return c.json({ success: false, error: priced.error, code: priced.code, productId: priced.productId }, 400)

  const { decideTossFlow, generateTossOrderId } = await import('../../../worker/utils/toss-gateway')
  const tossKey = (c.env as { TOSS_CLIENT_KEY?: string }).TOSS_CLIENT_KEY || ''
  const { flow, flowReason } = decideTossFlow(tossKey)
  if (flow === 'invalid') {
    return c.json({ success: false, error: '결제 시스템이 설정되지 않았습니다. 관리자에게 문의해주세요.', code: 'PAYMENT_KEY_INVALID', _debug: flowReason }, 503)
  }

  // 🪙 부분결제 — 딜 **차감은 여기서 하지 않는다**(아직 아무것도 청구되지 않았다). 단일 경로와 동일.
  const dealPlan = await resolvePartialDealPlan(DB, { userId, totalAmount: priced.totalAmount, requested: body.deal_use })

  // 🧾 **무엇을 사기로 했는지는 서버가 기억한다.** 복귀 URL 로 품목을 돌려받으면 총액이 같은 다른
  //    상품으로 바꿔치기가 통과한다(설명은 `cart-intent.ts`). 여기 적어 두고 확정 때 이것만 읽는다.
  const tossOrderId = generateTossOrderId('GB', userId)
  const saved = await saveCartIntent(DB, tossOrderId, userId, lines, priced.totalAmount)
  if (!saved) {
    return c.json({ success: false, error: '결제를 시작하지 못했습니다. 잠시 후 다시 시도해주세요', code: 'INTENT_SAVE_FAILED' }, 500)
  }

  return c.json({
    success: true,
    data: {
      orderId: tossOrderId,
      amount: dealPlan.cardAmount,
      dealUsed: dealPlan.dealUsed,
      totalAmount: dealPlan.totalAmount,
      orderName: cartOrderName(priced.lines),
      clientKey: tossKey,
      flow,
      items: priced.lines.map(l => ({ productId: l.productId, qty: l.qty, unitPrice: l.unitPrice, subtotal: l.subtotal, name: l.name })),
      ref: await normalizeRef(DB, body.ref, userId) || null,
    },
  })
})

/* ────────────────────────────────────────────────────────────────────────────
 * ② 결제 확정 — 여기서부터 돈이 움직인다
 * ──────────────────────────────────────────────────────────────────────────── */
cartCheckoutRoutes.post('/cart/confirm-toss', rateLimit({ action: 'gb_cart_confirm', max: 10, windowSec: 60 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  if (!await cartEnabled(DB)) return c.json(GATE_OFF, 403)

  const userId = await resolveUserIdString(DB, user.id, user.isDbId)
  /** ⚠️ `items` 가 없다 — 품목은 서버 기록에서 온다(`cart-intent.ts`). 클라가 못 고친다. */
  type ConfirmBody = { paymentKey?: string; orderId?: string; amount?: number; ref?: string }
  const body: ConfirmBody = await c.req.json<ConfirmBody>().catch(() => ({} as ConfirmBody))
  const { paymentKey, orderId } = body
  if (!paymentKey || !orderId || !body.amount) {
    return c.json({ success: false, error: '결제 정보가 올바르지 않습니다' }, 400)
  }

  // 🧾 품목은 **클라가 아니라 서버 기록**에서 온다(`body.items` 는 읽지 않는다 — `cart-intent.ts`).
  //    이게 없으면 총액이 같은 다른 상품으로 바꿔치기가 통과한다.
  const intent = await loadCartIntent(DB, orderId, userId)
  if (!intent) return c.json({ success: false, error: '결제 정보를 찾을 수 없습니다. 장바구니에서 다시 시도해주세요', code: 'INTENT_NOT_FOUND' }, 400)

  // 🎯 **과금 직전 재검증.** 결제창을 띄워 둔 사이 다른 탭에서 한도를 채우거나 상품이 내려갈 수 있다.
  //    승인 전 400 이라 Toss 측이 자동 만료시킨다(환불 불필요 — 단일 경로와 같은 패턴).
  const priced = await priceCartLines(DB, userId, intent.items)
  if (!priced.ok) return c.json({ success: false, error: priced.error, code: priced.code, productId: priced.productId }, 400)
  const expectedAmount = priced.totalAmount

  // 🪙 딜 사용액은 **청구액에서 역산**한다(설명은 partial-deal.ts).
  const chargedAmount = Math.round(Number(body.amount))
  const derived = await derivePartialDeal(DB, { userId, expectedAmount, chargedAmount })
  if (!derived.ok) return c.json({ success: false, error: derived.error, code: derived.code }, 400)
  const dealUsed = derived.dealUsed

  const referralInfluencerId = await normalizeRef(DB, body.ref, userId)

  // ── Toss 승인 (SSOT helper 호출만 — helper 자체는 무수정) ────────────────────
  const { confirmTossPayment } = await import('../../../worker/utils/toss-gateway')
  const tossResult = await confirmTossPayment({
    env: c.env as { TOSS_SECRET_KEY?: string }, paymentKey, orderId, amount: chargedAmount,
  })
  if (!tossResult.ok) {
    return c.json({ success: false, error: tossResult.message, code: tossResult.code }, tossResult.status === 'CIRCUIT_OPEN' ? 503 : 400)
  }
  const orderNumber = resolveGbOrderNumber(tossResult.data?.orderId, orderId, userId)

  // 🏦 가상계좌는 **입금 전**이라 발급 금지 + 자동 취소. 웹훅에 공구 발급이 없어서(실측) 기다릴 수 없다.
  const vaBlock = await guardAwaitingDeposit(c.env, tossResult.data, {
    paymentKey, orderNumber, userId,
    productId: priced.lines[0]!.productId,
    sellerId: priced.lines.length === 1 ? priced.lines[0]!.sellerId : null,
    amount: chargedAmount,
  })
  if (vaBlock) return c.json({ success: false, error: vaBlock.error, code: vaBlock.code }, 400)

  // ── 멱등: 같은 paymentKey 로 이미 발급됐으면 재발급 금지 ──────────────────────
  const existingOrder = await DB.prepare('SELECT id, order_number FROM orders WHERE payment_key = ? LIMIT 1')
    .bind(paymentKey).first<{ id: number; order_number: string }>().catch(() => null)
  if (existingOrder) {
    const issued = await DB.prepare('SELECT COUNT(*) AS n FROM vouchers WHERE order_id = ?')
      .bind(existingOrder.id).first<{ n: number }>().catch(() => null)
    return c.json({ success: true, data: { order_number: existingOrder.order_number, qty: issued?.n ?? 0, amount: expectedAmount, idempotent: true } })
  }

  // ── 재고 예약: 전부 아니면 전부 ──────────────────────────────────────────────
  const reserved: PricedLine[] = []
  const rollbackStock = async () => {
    for (const l of reserved) {
      await DB.prepare('UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(l.qty, l.productId).run().catch(() => null)
    }
  }
  for (const l of priced.lines) {
    const r = await DB.prepare('UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock >= ?')
      .bind(l.qty, l.productId, l.qty).run().catch(() => null)
    if (!r?.meta?.changes) {
      await rollbackStock()
      try {
        const { cancelTossPayment } = await import('../../../worker/utils/toss-gateway')
        await cancelTossPayment({ env: c.env as unknown as { TOSS_SECRET_KEY?: string }, paymentKey, cancelReason: '재고 부족 자동 환불', idempotencyKey: `cartstock-${paymentKey}` })
      } catch (e) { if (import.meta.env?.DEV) console.warn('[cart oversold refund]', e) }
      return c.json({ success: false, error: `${l.name}의 재고가 부족하여 결제가 자동 취소되었습니다`, code: 'OUT_OF_STOCK', productId: l.productId }, 409)
    }
    reserved.push(l)
  }

  // ── 딜 차감(원자 CAS). 실패하면 재고를 되돌리고 결제를 통째로 취소한다 ──────────
  if (dealUsed > 0) {
    const spent = await spendPartialDeal(DB, c.env as unknown as { TOSS_SECRET_KEY?: string }, {
      userId, dealUsed, orderNumber, paymentKey,
      productId: priced.lines[0]!.productId,
      qty: priced.lines.reduce((s, l) => s + l.qty, 0),
      productName: cartOrderName(priced.lines),
    })
    if (!spent.ok) {
      await rollbackStock()
      return c.json({ success: false, error: '딜 잔액이 부족하여 결제가 자동 취소되었습니다', code: 'INSUFFICIENT_DEAL' }, 400)
    }
  }

  const sellerIds = [...new Set(priced.lines.map(l => l.sellerId))]
  const singleSeller = sellerIds.length === 1 ? sellerIds[0]! : null

  try {
    // ── 주문 한 행 ─────────────────────────────────────────────────────────────
    const orderInsert = await DB.prepare(`
      INSERT INTO orders (order_number, user_id, seller_id, subtotal, shipping_fee, discount_amount, total_amount, currency, status, payment_status, payment_method, payment_key, idempotency_key)
      VALUES (?, ?, ?, ?, 0, 0, ?, 'KRW', 'PAID', 'approved', 'toss', ?, ?)
      RETURNING id
    `).bind(orderNumber, userId, singleSeller, expectedAmount, expectedAmount, paymentKey, paymentKey).first<{ id: number }>()
    const newOrderId = orderInsert?.id ?? null
    if (!newOrderId) throw new Error('order insert returned no id')

    // 🪙 환불 역전이 이 값 하나에 걸려 있다(머니 룰 #2).
    if (dealUsed > 0) await recordOrderDealUsed(DB, newOrderId, dealUsed)

    // ── order_items + vouchers 를 **한 batch** 로 — 부분 발급이 구조적으로 불가능하다 ──
    const { resolveVoucherIntroStamp } = await import('../../../worker/utils/voucher-intro-stamp')
    const stmts: D1PreparedStatement[] = []
    for (const l of priced.lines) {
      stmts.push(DB.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, unit_price, price, quantity, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(newOrderId, l.productId, l.name, l.unitPrice, l.unitPrice, l.qty, l.subtotal))
      // 🤝 판 시점의 영입자를 도장 찍는다 — 매장마다 다르므로 줄마다 조회한다.
      const stamp = await resolveVoucherIntroStamp(DB, l.sellerId)
      const codes = await Promise.all(Array.from({ length: l.qty }, () => generateUniqueVoucherCode(DB)))
      for (const code of codes) {
        stmts.push(DB.prepare(`
          INSERT INTO vouchers (order_id, product_id, user_id, code, expires_at, applied_discount_pct, applied_price, introduced_by_influencer_id, intro_stamped_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(newOrderId, l.productId, userId, code, l.voucherExpiry, l.discountPct, l.unitPrice, stamp.introducerId, stamp.stampedAt))
      }
      stmts.push(DB.prepare('UPDATE products SET group_buy_current = COALESCE(group_buy_current, 0) + ? WHERE id = ?').bind(l.qty, l.productId))
    }
    await DB.batch(stmts)

    // ── 셀러별 정산 기록 ───────────────────────────────────────────────────────
    //    ⚠️ 셀러가 섞여 있어도 여기서 갈라 적는다 — `orders.seller_id` 가 null 이어도 정산이 안 깨지는 이유.
    const rates = await getCommissionRates(DB)
    for (const sid of sellerIds) {
      const mine = priced.lines.filter(l => l.sellerId === sid)
      const amount = mine.reduce((s, l) => s + l.subtotal, 0)
      const commissionRate = await getSellerCommissionRate(DB, Number(sid))
      const commissionAmount = Math.round(amount * commissionRate)
      const { influencerAmount, userBonusAmount } = await applyGroupBuyReferral(DB, rates, {
        referralInfluencerId,
        sellerId: Number(sid),
        productId: mine[0]!.productId,
        productName: mine[0]!.name,
        totalAmount: amount,
        orderNumber,
        orderId: newOrderId,
        userId,
        productReferralDisabled: false,
      })
      const sellerAmount = amount - commissionAmount - influencerAmount - userBonusAmount
      try {
        await recordLedger(DB, {
          event_type: 'group_buy_join',
          reference_id: orderNumber,
          amount,
          debit_account: `user:${userId}`,
          credit_account: sellerLedgerAccount(sid),
          fee_amount: commissionAmount,
          fee_account: 'platform:commission',
          metadata: { cart: true, order_id: newOrderId, product_ids: mine.map(l => l.productId), payment_method: 'toss' },
        })
      } catch (e) { if (import.meta.env?.DEV) console.warn('[cart ledger]', e) }
      try {
        await DB.prepare(`
          INSERT INTO donations (live_stream_id, seller_id, donor_user_id, donor_name, amount,
            commission_amount, credit_amount, commission_rate, order_id, payment_status, message)
          VALUES (0, ?, ?, '공동구매', ?, ?, ?, ?, ?, 'completed', ?)
        `).bind(sid, userId, amount, commissionAmount, sellerAmount, commissionRate, orderNumber,
          `${getVoucherShortLabel(mine[0]!.category)} 장바구니(카드): ${mine.map(l => l.name).join(', ')}`.slice(0, 500)).run()
      } catch { /* donations 테이블 없으면 무시 */ }
    }

    // ── 응답 후 부수효과 ───────────────────────────────────────────────────────
    const totalQty = priced.lines.reduce((s, l) => s + l.qty, 0)
    const _fx = async () => {
      try {
        const { createDashboardNotification } = await import('../../notifications/api/dashboard-notifications.routes')
        for (const sid of sellerIds) {
          const mine = priced.lines.filter(l => l.sellerId === sid)
          await createDashboardNotification(
            DB, 'seller', String(sid), 'voucher_sold', '🎟️ 이용권 판매(카드)',
            `${mine.map(l => `${l.name} ×${l.qty}`).join(', ')} — ₩${mine.reduce((s, l) => s + l.subtotal, 0).toLocaleString('ko-KR')}`,
            '/seller/group-buy',
          ).catch(() => {})
        }
      } catch { /* fail-soft */ }
      // 아래 셋은 **주문당 1회**다(멱등이라 중복 지급 0 — 줄마다 부르면 안 된다).
      try {
        const { grantInviteRewardForFirstPurchase } = await import('../../../worker/utils/invite-reward')
        await grantInviteRewardForFirstPurchase(DB, String(userId))
      } catch { /* fail-soft */ }
      try {
        const { markAcquisitionFirstPurchase } = await import('../../../worker/utils/acquisition')
        await markAcquisitionFirstPurchase(DB, String(userId), orderNumber)
      } catch { /* fail-soft */ }
      try {
        const { grantVisitRewardOnPurchase } = await import('../../../worker/utils/visit-reward')
        for (const l of priced.lines) {
          await grantVisitRewardOnPurchase(DB, { userId: String(userId), productId: l.productId, orderRef: orderNumber })
        }
      } catch { /* fail-soft */ }
      try {
        await DB.prepare(
          `INSERT INTO user_notifications (user_id, type, title, message, link)
           VALUES (?, 'voucher_issued', ?, ?, '/my-vouchers')`,
        ).bind(String(userId), '🎟️ 이용권이 발급됐어요', `${cartOrderName(priced.lines)} — 지갑에서 확인하세요`).run()
      } catch { /* ignore */ }
      try {
        const { markFcfsPaid } = await import('../../../worker/utils/fcfs-gate')
        for (const l of priced.lines) await markFcfsPaid(DB, l.productId, userId)
      } catch { /* fail-soft */ }
    }
    let deferred = false
    try { if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(_fx()); deferred = true } } catch { /* no ctx */ }
    if (!deferred) await _fx()

    await markCartIntentConsumed(DB, orderId)
    // `product_ids` — 완료 화면이 한 상품이면 기존 티켓을, 여럿이면 묶음 안내를 고르는 데 쓴다.
    return c.json({ success: true, data: { order_number: orderNumber, order_id: newOrderId, qty: totalQty, amount: expectedAmount, product_ids: priced.lines.map(l => l.productId) } })
  } catch (err) {
    // ── 결제는 됐는데 발급이 실패했다 — 되돌릴 수 있는 건 전부 되돌리고 환불한다 ──
    await rollbackStock()
    if (String(err).includes('UNIQUE')) {
      const existing = await DB.prepare('SELECT id, order_number FROM orders WHERE payment_key = ? LIMIT 1')
        .bind(paymentKey).first<{ id: number; order_number: string }>().catch(() => null)
      if (existing) {
        const issued = await DB.prepare('SELECT COUNT(*) AS n FROM vouchers WHERE order_id = ?')
          .bind(existing.id).first<{ n: number }>().catch(() => null)
        return c.json({ success: true, data: { order_number: existing.order_number, qty: issued?.n ?? 0, amount: expectedAmount, idempotent: true } })
      }
    }
    console.error('[gb:cart-confirm] post-payment failed', err)
    if (dealUsed > 0) await restorePartialDeal(DB, { userId, dealUsed, orderNumber })
    let autoRefunded = false
    try {
      const { cancelTossPayment } = await import('../../../worker/utils/toss-gateway')
      await cancelTossPayment({ env: c.env as unknown as { TOSS_SECRET_KEY?: string }, paymentKey, cancelReason: '이용권 발급 실패 자동 환불', idempotencyKey: `cartfail-${paymentKey}` })
      autoRefunded = true
    } catch (cancelErr) {
      console.error('[gb:cart-confirm] 자동 환불도 실패 — 수동 개입 필요', cancelErr)
      try {
        const { createDashboardNotification } = await import('../../notifications/api/dashboard-notifications.routes')
        await createDashboardNotification(DB, 'admin', null, 'payment_orphan',
          '🚨 장바구니 결제됨+발급실패+자동환불실패 — 수동 환불 필요',
          `paymentKey=${paymentKey} / 금액 ${expectedAmount}`, '/admin/orders')
      } catch { /* best-effort */ }
    }
    return c.json({
      success: false,
      error: autoRefunded
        ? '일시적인 오류로 발급에 실패해 결제를 자동 취소했습니다. 잠시 후 다시 시도해주세요.'
        : '결제는 완료됐으나 발급에 실패했습니다. 환불 처리를 위해 고객센터로 문의해주세요.',
      code: autoRefunded ? 'ISSUE_FAILED_REFUNDED' : 'POST_PAYMENT_FAILURE',
      data: { paymentKey, orderId },
    }, 500)
  }
})

export { cartCheckoutRoutes }
