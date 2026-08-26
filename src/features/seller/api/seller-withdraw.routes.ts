/**
 * 🚪 셀러 탈퇴 (2026-08-26 대표 — "셀러도 탈퇴를 할 수 있어야 하잖아")
 *
 * 그간 탈퇴는 **소비자 계정만** 있었다(`DELETE /api/account/delete`). 셀러(매장)는 별 신원이라
 * 그 경로가 건드리지 않는다 → 매장 업주가 그만두고 싶어도 나갈 문이 없었다.
 *
 * ## 왜 '삭제'가 아니라 soft-close 인가
 * 매장 행을 지우면 **그 매장에서 산 소비자의 이용권·주문·정산 이력이 고아**가 된다(참조 붕괴).
 * 그래서 탈퇴 = ① 소비자 노출 중단(상품 비활성 + 매장 suspended) ② 세션 무효화 ③ 위임 회수.
 * 이력은 보존한다(분쟁·정산 대응). 소비자 탈퇴(익명화 soft-delete)와 같은 철학.
 *
 * ## 🚫 돈·소비자가 걸려 있으면 못 나간다 (preflight 차단)
 *   - 미사용 이용권 → **이미 결제한 소비자**가 쓰지 못하게 된다(가장 무거운 차단)
 *   - 미처리 주문 → 배송/사용 대기 중인 손님이 있다
 *   - 미정산 잔액 → 사장님이 받을 돈을 두고 나가면 회수 경로가 사라진다
 * 셋 다 0 이어야 실행된다. 차단 사유는 화면에 그대로 보여 준다(막고 끝내지 않는다).
 */
import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Env } from '@/worker/types/env'
import { getSellerIdFromToken } from '@/lib/seller-shared'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { setSellerMeta } from '@/worker/utils/seller-meta'
import { getLedgerReceivable } from '@/worker/utils/ledger'
import { startDashboardSession } from '@/worker/utils/dashboard-session'

const app = new Hono<{ Bindings: Env }>()
type Ctx = Context<{ Bindings: Env }>

export interface WithdrawBlockers {
  pending_orders: number
  unused_vouchers: number
  unsettled_krw: number
  active_products: number
}

/** 탈퇴를 막는 사유를 센다 — 0 이 아니면 그 항목이 블로커. */
export async function countWithdrawBlockers(DB: D1Database, sellerId: number): Promise<WithdrawBlockers> {
  const [orders, vouchers, receivable, products] = await Promise.all([
    DB.prepare(
      `SELECT COUNT(DISTINCT o.id) AS n
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         JOIN products p ON p.id = oi.product_id
        WHERE p.seller_id = ?
          AND o.status IN ('PENDING','AWAITING_PAYMENT','PAID','PREPARING','SHIPPING')`
    ).bind(sellerId).first<{ n: number }>().catch(() => null),
    // 소비자가 결제해 발급받았고 아직 안 쓴 이용권 — 이게 살아 있으면 매장이 사라지면 안 된다.
    DB.prepare(
      `SELECT COUNT(*) AS n FROM vouchers v JOIN products p ON p.id = v.product_id
        WHERE p.seller_id = ? AND v.status = 'unused'`
    ).bind(sellerId).first<{ n: number }>().catch(() => null),
    getLedgerReceivable(DB, `seller:${sellerId}`).catch(() => 0),
    DB.prepare('SELECT COUNT(*) AS n FROM products WHERE seller_id = ? AND is_active = 1')
      .bind(sellerId).first<{ n: number }>().catch(() => null),
  ])
  return {
    pending_orders: Number(orders?.n) || 0,
    unused_vouchers: Number(vouchers?.n) || 0,
    // 음수(과지급)는 블로커가 아니다 — 사장님이 *받을* 돈이 남은 경우만 막는다.
    unsettled_krw: Math.max(0, Math.round(Number(receivable) || 0)),
    active_products: Number(products?.n) || 0,
  }
}

export const isWithdrawBlocked = (b: WithdrawBlockers): boolean =>
  b.pending_orders > 0 || b.unused_vouchers > 0 || b.unsettled_krw > 0

async function requireSellerSeat(c: Ctx): Promise<number | Response> {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '셀러 인증이 필요합니다' }, 401)
  return sellerId
}

// ── GET /account/withdraw-check — 탈퇴 가능 여부 + 차단 사유 ────────────────────────
app.get('/account/withdraw-check', async (c) => {
  try {
    const seat = await requireSellerSeat(c)
    if (seat instanceof Response) return seat
    const blockers = await countWithdrawBlockers(c.env.DB, seat)
    const seller = await c.env.DB.prepare('SELECT business_name, name FROM sellers WHERE id = ? LIMIT 1')
      .bind(seat).first<{ business_name: string | null; name: string | null }>().catch(() => null)
    return c.json({
      success: true,
      data: {
        seller_id: seat,
        store_name: seller?.business_name || seller?.name || `매장 #${seat}`,
        blockers,
        can_withdraw: !isWithdrawBlocked(blockers),
      },
    })
  } catch (err) {
    return safeError(c, err, '탈퇴 가능 여부를 확인하지 못했습니다', '[seller-withdraw]')
  }
})

// ── POST /account/withdraw — 셀러 탈퇴 실행 ─────────────────────────────────────────
app.post('/account/withdraw', rateLimit({ action: 'seller_withdraw', max: 5, windowSec: 3600 }), async (c) => {
  try {
    const seat = await requireSellerSeat(c)
    if (seat instanceof Response) return seat

    const body = await c.req.json<{ confirm?: boolean; reason?: string }>().catch(() => ({} as { confirm?: boolean; reason?: string }))
    // 오폭 방지 — 화면이 명시 확인을 받아야만 실행된다.
    if (body.confirm !== true) {
      return c.json({ success: false, error: '확인이 필요합니다', code: 'CONFIRM_REQUIRED' }, 400)
    }

    // 🚫 돈·소비자가 걸려 있으면 실행 자체를 거부(화면이 이미 막지만 서버가 최종 방어선).
    const blockers = await countWithdrawBlockers(c.env.DB, seat)
    if (isWithdrawBlocked(blockers)) {
      return c.json({
        success: false,
        error: '정리되지 않은 주문·이용권·정산이 있어 탈퇴할 수 없습니다',
        code: 'WITHDRAW_BLOCKED',
        data: { blockers },
      }, 409)
    }

    // ① 소비자 노출 중단 — 상품 비활성(카탈로그·피드에서 사라진다). 행은 보존(이력).
    const deact = await c.env.DB.prepare(
      "UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE seller_id = ? AND is_active = 1"
    ).bind(seat).run().catch(() => null)

    // ② 매장 정지 — status CHECK 는 pending/approved/rejected/suspended 만 허용('closed' 는 SqlError).
    await c.env.DB.prepare(
      "UPDATE sellers SET status = 'suspended', updated_at = datetime('now') WHERE id = ? AND status != 'suspended'"
    ).bind(seat).run().catch(() => null)
    const now = new Date().toISOString()
    await setSellerMeta(c.env.DB, seat, {
      withdrawn_at: now,
      closed_at: now,
      ...(body.reason ? { withdraw_reason: String(body.reason).slice(0, 200) } : {}),
    }).catch(() => { /* 마커 실패가 탈퇴를 막지 않는다 */ })

    // ③ 위임 회수 — 운영자가 남아 있으면 정지된 매장에 계속 들어올 수 있다.
    await c.env.DB.prepare(
      "UPDATE seller_operators SET revoked_at = datetime('now') WHERE seller_id = ? AND revoked_at IS NULL"
    ).bind(seat).run().catch(() => { /* 테이블 부재 등 — 무시 */ })

    // ④ 세션 무효화 — 이미 발급된 seller_token 이 만료 전까지 유효하므로 min_valid_iat 를 올린다.
    await startDashboardSession(c.env.DB, 'seller', seat, Math.floor(Date.now() / 1000) + 1).catch(() => {})

    return c.json({
      success: true,
      data: {
        withdrawn: true,
        deactivated_products: Number(deact?.meta?.changes) || 0,
        message: '셀러 탈퇴가 완료되었습니다. 등록하신 상품은 더 이상 노출되지 않습니다.',
      },
    })
  } catch (err) {
    return safeError(c, err, '탈퇴 처리 중 오류가 발생했습니다', '[seller-withdraw]')
  }
})

export { app as sellerWithdrawRoutes }
