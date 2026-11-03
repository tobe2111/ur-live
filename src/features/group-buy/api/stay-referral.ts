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
 * ## 스위치 — 기본 꺼짐
 * `platform_settings.stay_referral_unify_enabled === 'true'` 일 때만 새 길. 꺼져 있으면 종전 그대로(돈 흐름 0 변화).
 * **켜는 것은 staging 실결제 4건 뒤 대표가 한다**(소개 링크 결제 → 적립 · 손님 취소 → 회수 · 체크인 날 부분 환불 → 비례 회수 ·
 *
 * 어드민 환불 → 회수). 결제 확정 시점의 스위치 값이 그 주문의 장부를 정한다. 회수는 두 장부를 **다** 되돌린다
 * (스위치를 껐다 켜도 어느 장부에 쌓였든 환불이 새지 않게).
 */
import { applyGroupBuyReferral } from './helpers'
import { getCommissionRates } from './commission-rates'
import { reverseAttributionLedgerShares, type AttributionShareToReverse } from '../../../worker/utils/attribution-ledger-reversal'

export const STAY_REFERRAL_UNIFY_KEY = 'stay_referral_unify_enabled'

export async function isStayReferralUnified(DB: D1Database): Promise<boolean> {
  const r = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STAY_REFERRAL_UNIFY_KEY)
    .first<{ value: string | null }>().catch(() => null)
  return String(r?.value ?? '').trim() === 'true'
}

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
 * 예약 생성 때 소개자 판정 — 스위치 ON 이면 `{ on: true, id }`(자기 자신·없는 유저는 id=null), OFF 면 `{ on: false }`.
 * ON 일 때는 옛 객실별 '소개 할인·수수료' 를 쓰지 않는다(이용권처럼 손님 할인 없이 소개자만 기록, 적립은 결제 확정 때).
 */
export async function unifiedStayReferrer(DB: D1Database, raw: unknown, userId: unknown): Promise<{ on: boolean; id: string | null }> {
  if (!(await isStayReferralUnified(DB))) return { on: false, id: null }
  const id = raw == null ? '' : String(raw).trim()
  if (!id || id === String(userId)) return { on: true, id: null }
  const u = await DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first<{ id: string }>().catch(() => null)
  return { on: true, id: u ? String(u.id) : null }
}
