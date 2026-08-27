/**
 * 🛡️ 2026-06-01 영입자(크리에이터) 매장 영입 commission.
 *
 * 에이전시 입점 commission(agency-store-intro-commission.ts)의 인플루언서 버전.
 * 크리에이터가 매장을 영입(seller_prospects → sellers.introduced_by_influencer_id)하면,
 * 그 매장의 매 결제마다 영입자에게 매출의 N%(platform_settings.influencer_store_intro_pct, default 2%)를 적립.
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
import { COMMISSION_DEFAULTS } from '../../shared/constants/policy'
import { parseUTCDate } from '../../utils/date'

// 🔒 2026-06-27 (감사 #7): 매장영입 기본율 SSOT(policy.ts) — 흩어진 매직넘버 통일. 2026-08-27 대표 확정으로 값 1.5 → 2.0.
const DEFAULT_STORE_INTRO_PCT = COMMISSION_DEFAULTS.INFLUENCER_STORE_INTRO_PCT
const REFUND_WINDOW_DAYS = 7
// ⏳ 2026-08-27 대표: 영입 커미션 유효기간 1년. 어드민 조정은 platform_settings.influencer_store_intro_months.
const DEFAULT_STORE_INTRO_MONTHS = COMMISSION_DEFAULTS.INFLUENCER_STORE_INTRO_MONTHS

/**
 * ⏳ 2026-08-27 대표 확정 — **매장 영입 2% 의 유효기간은 1년**("2%의 유효기간 1년으로 하자").
 *
 * 그 전까지 이 축엔 **만료 검사가 아예 없어 무기한**이었다. 에이전시 영입(1%)은
 * `ledger.ts:243` 에서 `referral_bonus_until` 을 검사하는데 인플루언서 쪽만 빠져 있었다 —
 * 비대칭이 의도된 게 아니라는 증거가 스키마에 있다: `repair-schema` 의 백필이
 * **에이전시와 인플루언서 매장을 똑같이 `introduced_at + 12개월`로** 채운다
 * (`column-repairs.ts:900`). 즉 데이터는 1년을 전제하고 있었고 적립 코드만 그걸 안 봤다.
 *
 * 판정 순서 — **컬럼이 채워져 있는지에 의존하지 않는다**:
 *   1. `referral_bonus_until` 이 있으면 그 값(어드민이 매장별로 조정한 값 = 명시적 override)
 *   2. 없으면 `introduced_at + N개월` 로 **계산**
 *   3. `introduced_at` 도 없으면(레거시 행) `created_at` — 백필의 COALESCE 와 같은 순서
 *   4. 셋 다 없으면 **만료로 보지 않는다**(기준 시각을 모르는데 끊으면 미지급 사고)
 *
 * ⚠️ 기준 시각 문자열은 D1 이 `Z` 없는 UTC(`2026-08-27 03:00:00`)로 준다 —
 * `new Date()` 에 그대로 넣으면 로컬(KST)로 오해석돼 9시간 어긋난다. `parseUTCDate` SSOT 경유.
 */
export function isStoreIntroExpired(
  row: { referral_bonus_until?: string | null; introduced_at?: string | null; created_at?: string | null } | null | undefined,
  months: number,
  now: Date = new Date(),
): boolean {
  if (!row) return false
  const explicit = row.referral_bonus_until
  if (explicit) {
    const d = parseUTCDate(explicit)
    return Number.isFinite(d.getTime()) && d < now
  }
  const anchorStr = row.introduced_at || row.created_at
  if (!anchorStr) return false // 기준 시각 불명 → 끊지 않는다(미지급보다 안전)
  const anchor = parseUTCDate(anchorStr)
  if (!Number.isFinite(anchor.getTime())) return false
  const until = new Date(anchor.getTime())
  until.setUTCMonth(until.getUTCMonth() + months)
  return until < now
}

async function getStoreIntroMonths(DB: D1Database): Promise<number> {
  const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'influencer_store_intro_months'")
    .first<{ value: string }>().catch(() => null)
  const m = Number(row?.value ?? DEFAULT_STORE_INTRO_MONTHS)
  return Number.isFinite(m) && m > 0 ? m : DEFAULT_STORE_INTRO_MONTHS
}

async function getStoreIntroPct(DB: D1Database): Promise<number> {
  const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'influencer_store_intro_pct'")
    .first<{ value: string }>().catch(() => null)
  const pct = Number(row?.value ?? DEFAULT_STORE_INTRO_PCT)
  return Number.isFinite(pct) && pct > 0 ? pct : DEFAULT_STORE_INTRO_PCT
}

/**
 * 💸 2026-07-04 [INV-CB] (커미션 예산 아비터 — docs/design/commission-funding-restructure.md):
 *   적립 없이 "이 주문에서 적립될 금액"만 계산(read-only). 오케스트레이터(order-commissions.ts)가
 *   예산 배분 전에 요청액을 산출할 때 사용. 적립 로직(credit)과 동일 판정 — 부적격/0원이면 0.
 *   ⚠️ 일시 오류 시 0 반환(fail-soft) → 예산 미배정 → credit 의 amountOverride=0 → 미적립.
 *   미지급 방향 안전(초과지급 불가) — cron 재집계/보정 대상 아님(주문당 1회성).
 */
export async function computeInfluencerStoreIntroRequest(
  DB: D1Database,
  order: { id: number; seller_id?: number | null; total_amount?: number | null },
): Promise<number> {
  try {
    if (!order.id || !order.seller_id || !order.total_amount || order.total_amount <= 0) return 0
    const sellerRow = await DB.prepare(
      `SELECT introduced_by_influencer_id, referral_bonus_until, introduced_at, created_at FROM sellers WHERE id = ?`
    ).bind(order.seller_id).first<{ introduced_by_influencer_id: number | string | null; referral_bonus_until: string | null; introduced_at: string | null; created_at: string | null }>().catch(() => null)
    const influencerId = sellerRow?.introduced_by_influencer_id
    if (influencerId === null || influencerId === undefined || String(influencerId).trim() === '') return 0
    const influencerIdStr = String(influencerId)
    // ⏳ 유효기간(기본 1년) 경과 → 적립 종료. compute/credit 동일 판정(isStoreIntroExpired).
    if (isStoreIntroExpired(sellerRow, await getStoreIntroMonths(DB))) return 0
    const blocked = await DB.prepare(
      "SELECT 1 FROM seller_blocked_influencers WHERE seller_id = ? AND influencer_id = ? AND unblocked_at IS NULL LIMIT 1"
    ).bind(order.seller_id, influencerIdStr).first().catch(() => null)
    if (blocked) return 0
    // 🛡️ 2026-07-12 (§0-2 본인구매 가드 — credit 쪽과 동일 미러): 구매자==영입자면 요청액 0.
    const buyer = await DB.prepare('SELECT user_id FROM orders WHERE id = ?')
      .bind(order.id).first<{ user_id: string | number | null }>().catch(() => null)
    if (buyer?.user_id != null && String(buyer.user_id) === influencerIdStr) return 0
    const existing = await DB.prepare(
      "SELECT 1 FROM influencer_attributions WHERE order_id = ? AND influencer_id = ? AND source = 'store_intro' LIMIT 1"
    ).bind(order.id, influencerIdStr).first().catch(() => null)
    if (existing) return 0
    const pct = await getStoreIntroPct(DB)
    const commission = Math.floor((Number(order.total_amount) * pct) / 100)
    return commission > 0 ? commission : 0
  } catch {
    return 0
  }
}

export async function creditInfluencerStoreIntroCommission(
  DB: D1Database,
  order: { id: number; seller_id?: number | null; total_amount?: number | null },
  opts?: { amountOverride?: number },
): Promise<void> {
  try {
    if (!order.id || !order.seller_id || !order.total_amount || order.total_amount <= 0) return

    // 1. 매장의 영입 인플루언서 (introduced_by_influencer_id = 영입자 user.id).
    const sellerRow = await DB.prepare(
      `SELECT introduced_by_influencer_id, referral_bonus_until, introduced_at, created_at FROM sellers WHERE id = ?`
    ).bind(order.seller_id).first<{ introduced_by_influencer_id: number | string | null; referral_bonus_until: string | null; introduced_at: string | null; created_at: string | null }>().catch(() => null)
    const influencerId = sellerRow?.introduced_by_influencer_id
    if (influencerId === null || influencerId === undefined || String(influencerId).trim() === '') return
    const influencerIdStr = String(influencerId)
    // ⏳ 유효기간(기본 1년) 경과 → 적립 종료. compute/credit 동일 판정(isStoreIntroExpired).
    if (isStoreIntroExpired(sellerRow, await getStoreIntroMonths(DB))) return

    // 2. 영입자가 블록되었거나(seller_blocked_influencers) self-매장이면 skip.
    const blocked = await DB.prepare(
      "SELECT 1 FROM seller_blocked_influencers WHERE seller_id = ? AND influencer_id = ? AND unblocked_at IS NULL LIMIT 1"
    ).bind(order.seller_id, influencerIdStr).first().catch(() => null)
    if (blocked) return

    // 2.5 🛡️ 2026-07-12 (§0-2 본인구매 가드 — 대표 [UNLOCK], pre-flip-risk-audit §③-3):
    //   위 주석의 "self-매장 skip" 약속과 달리 **구매자==영입 인플 체크가 코드에 없어**, 영입자가
    //   자기 영입 매장에서 본인 구매하면 매출 2% 를 스스로에게 적립할 수 있었음(자가 커미션 루프 —
    //   promo flip 후 %가 커지면 기대수익 양수). 구매자 user_id 가 영입자면 skip + 어뷰즈 기록.
    const buyer = await DB.prepare('SELECT user_id FROM orders WHERE id = ?')
      .bind(order.id).first<{ user_id: string | number | null }>().catch(() => null)
    if (buyer?.user_id != null && String(buyer.user_id) === influencerIdStr) {
      await DB.prepare(
        `INSERT INTO abuse_detections (pattern, user_id, ref_type, ref_id, evidence, severity)
         VALUES ('self_store_intro_purchase', ?, 'order', ?, ?, 'medium')`
      ).bind(influencerIdStr, String(order.id), JSON.stringify({ seller_id: order.seller_id })).run().catch(() => {})
      return
    }

    // 3. 멱등 — 같은 주문의 store_intro 적립 이미 있으면 skip.
    const existing = await DB.prepare(
      "SELECT 1 FROM influencer_attributions WHERE order_id = ? AND influencer_id = ? AND source = 'store_intro' LIMIT 1"
    ).bind(order.id, influencerIdStr).first().catch(() => null)
    if (existing) return

    // 4. commission 계산.
    //    💸 [INV-CB] amountOverride: 예산 아비터(order-commissions.ts)가 배분한 상한 —
    //    계산값보다 절대 커질 수 없음(min clamp = 축소만 가능, 안전 방향). 미전달 시 현행 동일.
    const pct = await getStoreIntroPct(DB)
    const computed = Math.floor((Number(order.total_amount) * pct) / 100)
    const commission = opts?.amountOverride != null
      ? Math.min(Math.max(0, Math.floor(opts.amountOverride)), computed)
      : computed
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
