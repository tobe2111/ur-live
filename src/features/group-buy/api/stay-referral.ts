/**
 * 🏨 숙소 소개 적립을 이용권과 **같은 장부·같은 규칙**으로 (2026-11-03 숙소·예약 통일 ③)
 *
 * 대표: *"1,2 다 해야지"* → *"모두 해줘 … 잠금 파일도 다 허가해줄테니 순서대로 다 해줘"* → *"계속 진행해"*.
 * 결재: `docs/decisions/2026-11-03-stay-referral-unify.md`(1안).
 *
 * ## 무엇이 다른가
 * 종전 숙소: 객실 설정의 '소개 할인 %·수수료 %'(라이브 켠 곳 0) → 결제 확정 때 `affiliate_earnings` 한 줄.
 * 이용권: 사장님이 소개자와 맺은 **딜 N% 약정**(`findActiveDealPct`) + 차단·마케팅 끔·상품 소개 끔·자기 에이전시 판정
 *   → `influencer_attributions` + `influencer_balances` + 원장(`applyGroupBuyReferral`). 환불 땐 비례 회수.
 * 이 파일은 숙소가 **그 함수를 그대로** 부르게 하는 이음매다(규칙을 다시 쓰지 않는다).
 *
 * ## 스위치 없음 (2026-11-03 대표 *"그냥 너가 해줘 내가 스위치 키는거 말고, 기존 이용권이랑 형태 통일하면 되잖아 허가해줄게"*)
 * 처음엔 `stay_referral_unify_enabled`(기본 OFF) 뒤에 두고 staging 실결제 뒤 켜기로 했었다(#2153). 대표가 스위치 없이 바로
 * 이용권과 같은 길로 가라고 해서 스위치를 걷었다 — 숙소 예약은 언제나 이 길이다. 그때 라이브 숙소 예약 0건 · 옛 소개 할인 켠 곳 0곳
 * (2026-11-03 실측)이라 옮길 데이터가 없었다. 옛 금액이 남은 예약(그 전 생성분)은 옛 장부(affiliate_earnings)로만 적립된다(이중 적립 0).
 */
import { applyGroupBuyReferral } from './helpers'
import { getCommissionRates } from './commission-rates'
import { reverseAttributionLedgerShares, type AttributionShareToReverse } from '../../../worker/utils/attribution-ledger-reversal'
import { readAccountRef } from '../../../worker/utils/account-ref'

/**
 * 결제 확정된 숙소 주문에 소개 적립 — 이용권과 같은 `applyGroupBuyReferral`.
 * 멱등: 같은 주문·소개자의 attribution 이 이미 있으면 아무것도 안 한다(확정 confirm·웹훅이 둘 다 올 수 있다).
 */
export async function creditStayReferral(DB: D1Database, p: {
  orderId: number; orderNumber: string; referrerId: string; userId: string
  sellerId: number; productId: number; productName: string; totalAmount: number
}): Promise<{ influencerAmount: number; skipped?: string }> {
  if (!p.referrerId || String(p.referrerId) === String(p.userId)) return { influencerAmount: 0, skipped: 'self_or_empty' }
  if (!(p.orderId > 0) || !(p.totalAmount > 0)) return { influencerAmount: 0, skipped: 'no_order' }
  const dup = await DB.prepare('SELECT 1 AS x FROM influencer_attributions WHERE order_id = ? AND influencer_id = ? LIMIT 1')
    .bind(p.orderId, String(p.referrerId)).first().catch(() => null)
  if (dup) return { influencerAmount: 0, skipped: 'already' }
  const rates = await getCommissionRates(DB)
  const r = await applyGroupBuyReferral(DB, rates, {
    referralInfluencerId: String(p.referrerId), sellerId: p.sellerId, productId: p.productId, productName: p.productName,
    totalAmount: p.totalAmount, orderNumber: p.orderNumber, orderId: p.orderId, userId: String(p.userId),
  })
  return { influencerAmount: r.influencerAmount }
}

/**
 * 숙소 환불 → 소개 적립 비례 회수(머니 룰 ②: 적립과 같은 커밋에서 역전).
 * 몫 = 커미션 × (이번 환불액 / 주문 총액). 이미 지급된(`paid_at`) 줄은 건드리지 않는다(이용권과 같다).
 */
export async function clawbackStayReferral(DB: D1Database, p: {
  orderId: number; bookingId: number; reason: string
  /** 전액 환불이면 true(오버부킹 자동 환불 등). 아니면 refundAmount ÷ 주문 총액 비율로 회수. */
  full?: boolean; refundAmount?: number
}): Promise<number> {
  if (!(p.orderId > 0)) return 0
  let ratio = 1
  if (!p.full) {
    const o = await DB.prepare('SELECT total_amount FROM orders WHERE id = ?').bind(p.orderId).first<{ total_amount: number | null }>().catch(() => null)
    const total = Number(o?.total_amount) || 0
    if (!(Number(p.refundAmount) > 0) || !(total > 0)) return 0
    ratio = Math.min(1, Number(p.refundAmount) / total)
  }
  const rows = await DB.prepare(
    `SELECT id, influencer_id, commission_amount, status, source FROM influencer_attributions
      WHERE order_id = ? AND order_id != 0 AND status IN ('pending', 'available') AND paid_at IS NULL`,
  ).bind(p.orderId).all<{ id: number; influencer_id: string; commission_amount: number; status: string; source: string | null }>()
    .catch(() => ({ results: [] as { id: number; influencer_id: string; commission_amount: number; status: string; source: string | null }[] }))
  const stmts: D1PreparedStatement[] = []
  const shares: AttributionShareToReverse[] = []
  for (const a of rows.results || []) {
    const share = ratio >= 1 ? a.commission_amount : Math.min(a.commission_amount, Math.max(1, Math.floor(a.commission_amount * ratio)))
    if (!(share > 0)) continue
    const col = a.status === 'available' ? 'available_amount' : 'pending_amount'
    stmts.push(DB.prepare(`UPDATE influencer_balances SET ${col} = MAX(0, ${col} - ?), updated_at = datetime('now') WHERE influencer_id = ?`).bind(share, a.influencer_id))
    const remaining = a.commission_amount - share
    stmts.push(remaining <= 0
      ? DB.prepare("UPDATE influencer_attributions SET status = 'clawed_back', commission_amount = 0, clawback_reason = ? WHERE id = ?").bind(p.reason, a.id)
      : DB.prepare('UPDATE influencer_attributions SET commission_amount = ?, clawback_reason = ? WHERE id = ?').bind(remaining, p.reason, a.id))
    shares.push({ attributionId: a.id, influencerId: a.influencer_id, source: a.source ?? null, share })
  }
  if (stmts.length) await DB.batch(stmts)
  // 원장도 같은 몫만큼 되돌린다 — 안 되돌리면 환불된 숙소의 소개비를 매장이 영구 부담한다. 중복 방지 키에 예약 id 를 쓴다.
  await reverseAttributionLedgerShares(DB, { orderId: p.orderId, voucherId: p.bookingId, reason: p.reason, shares }).catch(() => null)
  return shares.length
}

/**
 * 예약 생성 때 소개자 판정 — 언제나 `{ on: true, id }`(자기 자신·없는 유저는 id=null).
 * 옛 객실별 '소개 할인·수수료' 는 쓰지 않는다(이용권처럼 손님 할인 없이 소개자만 기록, 적립은 결제 확정 때).
 * `on` 은 호출부가 옛 객실 할인 분기를 건너뛰는 표시로 남겨 둔다.
 */
export async function unifiedStayReferrer(DB: D1Database, raw: unknown, userId: unknown): Promise<{ on: boolean; id: string | null }> {
  // 🔗 2026-11-12 결재(account-ref-cross-device): 계정이 기억하는 마지막 소개(기기 무관)가 있으면 그것 — 이용권 결제와 같은 규칙.
  const acc = await readAccountRef(DB, userId == null ? null : String(userId)).catch(() => '')
  const id = acc || (raw == null ? '' : String(raw).trim())
  if (!id || id === String(userId)) return { on: true, id: null }
  const u = await DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first<{ id: string }>().catch(() => null)
  return { on: true, id: u ? String(u.id) : null }
}
