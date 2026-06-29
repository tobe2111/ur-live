/**
 * 🔁 2026-06-23 (대표 — 최종 이상형 #1): 환불/차지백 시 이용권 무효화 + 매장 정산 회수.
 *
 * 배경(감사): refundOrderFully 는 커미션/affiliate/쿠폰은 역전했지만 **이용권(vouchers) 자체를
 *   안 건드려** ① 사용된 이용권을 환불해도 status='used' 로 남아 7일 cron 이 매장에 그대로 정산
 *   (차지백 아니어도 새는 구멍) ② 차지백(이미 정산)된 매장 돈을 회수 못 함.
 *
 * 모든 환불 경로가 거치는 refundOrderFully 에서 호출 → 차지백(확정주문 취소는 webhook 이 거부하고
 * 환불 API=refundOrderFully 로 강제하므로 여기로 수렴) + 일반 환불 누수를 한 번에 차단.
 *
 * 멱등 + 머니룰: voucher status CAS + INSERT OR IGNORE(UNIQUE voucher_id). 돈이 이미 매장에 나간
 * (정산 completed) 건만 회수의무로 기록 — 나머지는 지급 전 차단이라 돈 이동 0.
 */
import { swallow } from './swallow'

const _ensuredClawback = new WeakSet<object>()
async function ensureClawbackTable(DB: D1Database) {
  if (_ensuredClawback.has(DB)) return
  _ensuredClawback.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS settlement_clawbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_id INTEGER NOT NULL,
      order_id INTEGER,
      seller_id INTEGER,
      settlement_id INTEGER,
      amount INTEGER NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT (datetime('now')),
      resolved_at DATETIME,
      UNIQUE(voucher_id)
    )`).run()
    await DB.prepare("CREATE INDEX IF NOT EXISTS idx_settlement_clawbacks_status ON settlement_clawbacks(status, created_at)").run()
  } catch { /* ignore */ }
}

interface VoucherRow {
  id: number
  status: string
  settlement_id: number | null
  applied_price: number | null
  product_id: number
  seller_id: number | null
  price: number | null
}

export interface ClawbackResult {
  /** 미사용/미정산 used → refunded (돈 이동 0) */
  voided: number
  /** 미지급 정산에서 차감 + detach (돈 이동 0, 지급 전 보정) */
  reclaimedPending: number
  /** 이미 지급완료 → settlement_clawbacks 회수의무 기록 (실제 돈 회수 필요) */
  clawbackOwed: number
}

/**
 * 주문의 이용권을 환불 처리하고 매장 정산을 회수한다. 멱등(refunded/expired 는 skip).
 * - unused              → status='refunded' (매장 미지급, 사후 사용 차단)
 * - used + 미정산        → status='refunded' (cron 이 status='used' 만 집음 → 매장 미지급)
 * - used + 정산(미지급)   → 정산행 금액 차감 + settlement_id detach + refunded
 * - used + 정산(completed) → settlement_clawbacks 기록(회수의무) + refunded + 경고
 */
export async function clawbackVoucherSettlementOnRefund(
  DB: D1Database,
  orderId: number,
  reason: string,
): Promise<ClawbackResult> {
  const out: ClawbackResult = { voided: 0, reclaimedPending: 0, clawbackOwed: 0 }
  const res = await DB.prepare(`
    SELECT v.id, v.status, v.settlement_id, v.applied_price, v.product_id, p.seller_id, p.price
    FROM vouchers v JOIN products p ON p.id = v.product_id
    WHERE v.order_id = ?
  `).bind(orderId).all<VoucherRow>().catch(() => ({ results: [] as VoucherRow[] }))

  for (const v of (res.results || [])) {
    if (v.status === 'refunded' || v.status === 'expired') continue // 멱등
    // 정산 매출 기준 = 실제 결제가(applied_price), 미존재 시 정가(price) — cron 합산 기준과 동일.
    const revenue = Number(v.applied_price) > 0 ? Number(v.applied_price) : Math.max(0, Number(v.price || 0))

    if (v.status === 'unused') {
      const r = await DB.prepare("UPDATE vouchers SET status='refunded' WHERE id=? AND status='unused'").bind(v.id).run().catch(() => null)
      if (r?.meta?.changes) out.voided++
      continue
    }

    if (v.status === 'used' && v.settlement_id == null) {
      const r = await DB.prepare("UPDATE vouchers SET status='refunded' WHERE id=? AND status='used' AND settlement_id IS NULL").bind(v.id).run().catch(() => null)
      if (r?.meta?.changes) out.voided++
      continue
    }

    if (v.status === 'used' && v.settlement_id != null) {
      const st = await DB.prepare(
        "SELECT id, status, commission_rate, total_revenue FROM restaurant_settlements WHERE id=?"
      ).bind(v.settlement_id).first<{ id: number; status: string; commission_rate: number | null; total_revenue: number | null }>().catch(() => null)

      if (st && st.status !== 'completed') {
        // 미지급 정산 → 이 voucher 분 차감 + detach. 돈은 아직 매장에 안 나감 → 보정만.
        // 🔒 2026-06-27 (결제 정확성 감사 Low): per-voucher round(rev×rate) 차감은 cron 의
        //   aggregate round(Σrev×rate) 과 달라 다건 정산에서 ~N원 drift + 전건 회수해도 0 미수렴.
        //   남은 revenue(total_revenue − 이 voucher)로 cron 과 동일 공식 재집계해 절대값 write → drift 0,
        //   마지막 voucher 회수 시 revenue 0 → commission/settlement 정확히 0. (revenue=cron 합산 기준 동일)
        const rate = Math.max(0, Number(st.commission_rate || 0))
        const newRevenue = Math.max(0, Number(st.total_revenue || 0) - revenue)
        const newComm = Math.round(newRevenue * rate / 100)
        const newNet = newRevenue - newComm
        await DB.prepare(`
          UPDATE restaurant_settlements
          SET total_vouchers_used = MAX(0, total_vouchers_used - 1),
              total_revenue = ?,
              commission_amount = ?,
              settlement_amount = ?
          WHERE id = ?
        `).bind(newRevenue, newComm, newNet, st.id).run().catch(swallow('clawback:settlement-dec'))
        const r = await DB.prepare("UPDATE vouchers SET status='refunded', settlement_id=NULL WHERE id=? AND status='used'").bind(v.id).run().catch(() => null)
        if (r?.meta?.changes) out.reclaimedPending++
      } else {
        // 이미 지급완료(또는 정산행 소실) → 실제 회수 필요. 회수의무 기록(멱등) + voucher refunded.
        await ensureClawbackTable(DB)
        const ins = await DB.prepare(
          "INSERT OR IGNORE INTO settlement_clawbacks (voucher_id, order_id, seller_id, settlement_id, amount, reason, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')"
        ).bind(v.id, orderId, v.seller_id, v.settlement_id, revenue, reason.slice(0, 200)).run().catch(() => null)
        if (ins?.meta?.changes) {
          out.clawbackOwed++
          // 운영 경고 — 이미 지급된 정산의 회수는 다음 정산 상계/수동 회수 필요.
          console.error('[clawback] settled voucher refunded — manual recovery needed', { voucherId: v.id, orderId, sellerId: v.seller_id, amount: revenue })
        }
        await DB.prepare("UPDATE vouchers SET status='refunded' WHERE id=? AND status='used'").bind(v.id).run().catch(() => null)
      }
    }
  }
  return out
}
