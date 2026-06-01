/**
 * 🛡️ 2026-06-01 영입자(크리에이터) 매장 영입 commission.
 *
 * 에이전시 입점 commission(agency-store-intro-commission.ts)의 인플루언서 버전.
 * 크리에이터가 매장을 영입(seller_prospects → sellers.introduced_by_influencer_id)하면,
 * 그 매장의 매 결제마다 영입자에게 매출의 N%(platform_settings.influencer_store_intro_pct, default 1.5%)를 적립.
 *
 * 적립 경로 = 기존 인플루언서 정산 파이프라인 재사용 (새 시스템 X):
 *   influencer_attributions(source='store_intro', status='pending', available_at=+환불창) 1행
 *   → influencer-payout cron 이 T+7 성숙(pending→available) + influencer_balances 재집계
 *   → 사업자번호 有 3.3% / 無 8.8% 원천징수 후 현금 송금 (또는 딜).
 * 즉 "사업자면 현금, 아니면 딜" 분기는 기존 payout cron 이 처리 — 여기선 적립만.
 *
 * 멱등: (influencer_id, order_id, source='store_intro') 이미 있으면 skip.
 * Fail-soft: 실패해도 결제 흐름 막지 않음.
 */
const DEFAULT_STORE_INTRO_PCT = 1.5
const REFUND_WINDOW_DAYS = 7

async function getStoreIntroPct(DB: D1Database): Promise<number> {
  const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'influencer_store_intro_pct'")
    .first<{ value: string }>().catch(() => null)
  const pct = Number(row?.value ?? DEFAULT_STORE_INTRO_PCT)
  return Number.isFinite(pct) && pct > 0 ? pct : DEFAULT_STORE_INTRO_PCT
}

export async function creditInfluencerStoreIntroCommission(
  DB: D1Database,
  order: { id: number; seller_id?: number | null; total_amount?: number | null },
): Promise<void> {
  try {
    if (!order.id || !order.seller_id || !order.total_amount || order.total_amount <= 0) return

    // 1. 매장의 영입 인플루언서 (introduced_by_influencer_id = 영입자 user.id).
    const sellerRow = await DB.prepare(
      `SELECT introduced_by_influencer_id FROM sellers WHERE id = ?`
    ).bind(order.seller_id).first<{ introduced_by_influencer_id: number | string | null }>().catch(() => null)
    const influencerId = sellerRow?.introduced_by_influencer_id
    if (influencerId === null || influencerId === undefined || String(influencerId).trim() === '') return
    const influencerIdStr = String(influencerId)

    // 2. 영입자가 블록되었거나(seller_blocked_influencers) self-매장이면 skip.
    const blocked = await DB.prepare(
      "SELECT 1 FROM seller_blocked_influencers WHERE seller_id = ? AND influencer_id = ? AND unblocked_at IS NULL LIMIT 1"
    ).bind(order.seller_id, influencerIdStr).first().catch(() => null)
    if (blocked) return

    // 3. 멱등 — 같은 주문의 store_intro 적립 이미 있으면 skip.
    const existing = await DB.prepare(
      "SELECT 1 FROM influencer_attributions WHERE order_id = ? AND influencer_id = ? AND source = 'store_intro' LIMIT 1"
    ).bind(order.id, influencerIdStr).first().catch(() => null)
    if (existing) return

    // 4. commission 계산.
    const pct = await getStoreIntroPct(DB)
    const commission = Math.floor((Number(order.total_amount) * pct) / 100)
    if (commission <= 0) return

    const availableAt = new Date(Date.now() + REFUND_WINDOW_DAYS * 86400_000).toISOString()

    // 5. attribution 1행 — 기존 payout cron 이 성숙/세무/송금 처리.
    await DB.prepare(
      `INSERT INTO influencer_attributions (influencer_id, order_id, seller_id, commission_amount, status, available_at, source)
       VALUES (?, ?, ?, ?, 'pending', ?, 'store_intro')`
    ).bind(influencerIdStr, order.id, order.seller_id, commission, availableAt).run()

    // 6. 즉시 가시성 — balance pending 반영 (cron 이 SUM 으로 재집계하므로 중복 안전).
    await DB.prepare(
      `INSERT INTO influencer_balances (influencer_id, pending_amount, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(influencer_id) DO UPDATE SET pending_amount = pending_amount + excluded.pending_amount, updated_at = datetime('now')`
    ).bind(influencerIdStr, commission).run().catch(() => { /* balance best-effort — cron 재집계로 보정 */ })
  } catch {
    // fail-soft — 결제 흐름 막지 않음.
  }
}

/**
 * 환불 시 store_intro commission 역전 (pending/available 만, paid 제외).
 * @returns 역전된 행 수
 */
export async function reverseInfluencerStoreIntroOnRefund(
  DB: D1Database,
  orderId: number,
  reason: string,
): Promise<number> {
  if (!orderId) return 0
  const rows = await DB.prepare(
    "SELECT id, influencer_id, commission_amount, status FROM influencer_attributions WHERE order_id = ? AND source = 'store_intro' AND status IN ('pending','available') AND paid_at IS NULL"
  ).bind(orderId).all<{ id: number; influencer_id: string; commission_amount: number; status: string }>().catch(() => ({ results: [] as { id: number; influencer_id: string; commission_amount: number; status: string }[] }))

  let reversed = 0
  for (const a of rows.results || []) {
    await DB.prepare(
      "UPDATE influencer_attributions SET status = 'clawed_back', commission_amount = 0, clawback_reason = ? WHERE id = ?"
    ).bind(reason, a.id).run()
    const col = a.status === 'pending' ? 'pending_amount' : 'available_amount'
    await DB.prepare(
      `UPDATE influencer_balances SET ${col} = MAX(0, ${col} - ?), updated_at = datetime('now') WHERE influencer_id = ?`
    ).bind(a.commission_amount, a.influencer_id).run().catch(() => { /* best-effort — cron 재집계로 보정 */ })
    reversed++
  }
  return reversed
}
