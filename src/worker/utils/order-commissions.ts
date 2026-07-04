/**
 * 🔐 2026-06-11 (머니 감사 Med-C): 결제 확정 시 커미션 적립 — /confirm 과 webhook 양쪽 공용.
 *   결제 확정 경로가 둘(payment.routes /confirm + webhook PAYMENT_CONFIRMED)인데 적립이
 *   /confirm 에만 있어, 브라우저가 confirm 을 못 보내고 webhook 만 도착하면 커미션 누락이었음.
 *   3종(에이전시 매장영입 / 영입자(인플) 매장영입 / 공급자 B2B)은 각각 order_id 멱등이라
 *   두 경로가 모두 와도 안전. fail-soft — 결제 흐름 막지 않음.
 *
 * 💸 2026-07-04 [INV-CB] (대표 승인 "수수료율 동결·재원 구조 수정" — 커미션 예산 아비터 승격):
 *   이 헬퍼가 플랫폼 부담 성장 커미션의 **단일 오케스트레이터**가 된다.
 *   - C1 핀 어필리에이트(intent) + C2 멀티티어 추천트리도 opts 로 이 안에 통합(/confirm 전달)
 *     → 기존에 _confirmSideFx(C1)와 _postConfirmBg(C2)가 **별개 waitUntil 로 병주하던
 *     C1↔C2 상호배타 dedup 레이스(이론상 이중지급)를 순차 실행으로 구조적 제거**.
 *   - 게이트: platform_settings.commission_budget_enabled === 'true' 일 때만 예산 배분.
 *     off(기본) = 현행과 동일 순서/동일 인자로 각 헬퍼 위임(행동 0 변화).
 *   - on: 3P 주문당 예산 = 플랫폼수수료 − PG준비금(pg_reserve_pct). 요청액(compute-only) 산출 →
 *     비례 배분(allocateCommissions) → 각 credit 에 amountOverride(축소만 가능) 전달.
 *     [INV-CB] 위반이 감지되면 **fail-closed**(그 주문의 비례 커미션 미적립 — 초과지급보다 안전).
 *   - 1P 주문(seller_id 없음)은 플랫폼 수수료 슬라이스가 없어 예산 정의 불가 → 현행 유지
 *     (C1/C2 만 해당 가능, 노출은 설계 F4 — 별도 머천다이징 결정).
 *   - 공급자(B2B 공급가)는 플랫폼 부담이 아님(별도 축) → 예산 무관, 항상 기존대로.
 *   - promo_funding_source==='owner' 면 C1 은 셀러(주인) 부담으로 이전되므로 예산 대상에서 제외.
 *   설계 SSOT: docs/design/commission-funding-restructure.md
 *   🛡️ 가드: scripts/check-commission-budget.mjs — C1~C4 적립 헬퍼의 신규 직접 호출(아비터 우회)을 차단.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { COMMISSION_DEFAULTS } from '../../shared/constants/policy'
import {
  computeCommissionBudget,
  allocateCommissions,
  assertCommissionBudgetInvariants,
  DEFAULT_PG_RESERVE_PCT,
  type CommissionRequest,
} from './commission-budget'

type OrderLike = { id: number; seller_id?: number | null; total_amount?: number | null }

/** 커미션 축 식별 키 — opts.only 필터용. */
export type CommissionAxis = 'affiliate' | 'multi_tier' | 'influencer_intro' | 'agency_intro' | 'supplier'

export interface CreditOrderCommissionsOpts {
  /** system-push 등 side-effect 용 env (affiliate 알림). 미전달 시 push 만 생략됨. */
  env?: unknown
  /** C2 멀티티어 — 구매자 user id. /confirm 만 전달(웹훅은 현행대로 미실행). */
  buyerUserId?: string | null
  /** C1 핀 어필리에이트 intent 소비 — /confirm 만 true. */
  withAffiliate?: boolean
  /**
   * 💸 2026-07-04 (F7): 실행할 축 제한 — 미전달=전체(현행). 공구 딜결제(group-buy.routes)처럼
   * 역사적으로 agency 만 적립하던 경로가 **행동 불변**으로 아비터(예산 캡)를 경유하기 위한 필터.
   * 새 축을 여기 없이 추가하면 안 됨(전체 실행이 기본).
   */
  only?: CommissionAxis[]
}

function axisOn(opts: CreditOrderCommissionsOpts | undefined, axis: CommissionAxis): boolean {
  return !opts?.only || opts.only.includes(axis)
}

async function readSetting(DB: D1Database, key: string): Promise<string | null> {
  try {
    const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(key).first<{ value: string }>()
    return row?.value ?? null
  } catch {
    return null
  }
}

/** 주문의 플랫폼 수수료(원) — order-ledger-credit 와 동일 규칙(orders.commission_rate ?? 기본 5%). */
async function resolveOrderPlatformFeeKrw(DB: D1Database, order: OrderLike): Promise<number> {
  const total = Number(order.total_amount || 0)
  if (!(total > 0)) return 0
  let rate = COMMISSION_DEFAULTS.PLATFORM_FEE_PCT
  try {
    const row = await DB.prepare('SELECT COALESCE(commission_rate, ?) AS rate FROM orders WHERE id = ?')
      .bind(COMMISSION_DEFAULTS.PLATFORM_FEE_PCT, order.id).first<{ rate: number }>()
    const r = Number(row?.rate)
    if (Number.isFinite(r) && r >= 0 && r <= 100) rate = r
  } catch { /* 기본율 폴백 */ }
  return Math.max(0, Math.round((total * rate) / 100))
}

/** 게이트 OFF — 현행과 동일한 순서/인자로 위임 (2026-07-04 이전 동작 보존). */
async function legacyCredit(DB: D1Database, orders: OrderLike[], opts?: CreditOrderCommissionsOpts): Promise<void> {
  if (opts?.withAffiliate && axisOn(opts, 'affiliate')) {
    try {
      const { creditAffiliateFromIntent } = await import('./affiliate-credit')
      for (const o of orders) {
        await creditAffiliateFromIntent(DB, opts?.env, Number(o.id)).catch(() => {})
      }
    } catch { /* fail-soft */ }
  }
  if (axisOn(opts, 'agency_intro')) try {
    const { creditAgencyStoreIntroCommission } = await import('./agency-store-intro-commission')
    for (const o of orders) {
      await creditAgencyStoreIntroCommission(DB, { id: Number(o.id), seller_id: o.seller_id ?? null, total_amount: o.total_amount ?? null })
    }
  } catch { /* fail-soft */ }
  if (axisOn(opts, 'influencer_intro')) try {
    const { creditInfluencerStoreIntroCommission } = await import('./influencer-store-intro-commission')
    for (const o of orders) {
      await creditInfluencerStoreIntroCommission(DB, { id: Number(o.id), seller_id: o.seller_id ?? null, total_amount: o.total_amount ?? null })
    }
  } catch { /* fail-soft */ }
  if (axisOn(opts, 'supplier')) try {
    const { creditSupplierOnOrder } = await import('../../features/supply/api/supply-settlement')
    for (const o of orders) {
      await creditSupplierOnOrder(DB, Number(o.id))
    }
  } catch { /* fail-soft */ }
  if (opts?.buyerUserId && axisOn(opts, 'multi_tier')) {
    try {
      const { calculateMultiTierCommission } = await import('../../features/referral/api/referral-tree.routes')
      for (const o of orders) {
        const oid = Number(o.id)
        if (oid && o.total_amount) {
          await calculateMultiTierCommission(DB, oid, Number(o.total_amount), String(opts.buyerUserId)).catch(() => {})
        }
      }
    } catch { /* fail-soft */ }
  }
}

/** 게이트 ON — 주문 1건의 예산 배분 + 적립. */
async function budgetedCreditForOrder(
  DB: D1Database,
  order: OrderLike,
  pgReservePct: number,
  promoOwnerFunded: boolean,
  opts?: CreditOrderCommissionsOpts,
): Promise<void> {
  const total = Number(order.total_amount || 0)
  const oid = Number(order.id)
  if (!oid || !(total > 0)) return

  // 1P(플랫폼 직판): 수수료 슬라이스 없음 → 예산 정의 불가 → 현행 유지(C1/C2 만 해당 가능).
  if (!order.seller_id) {
    if (opts?.withAffiliate && axisOn(opts, 'affiliate')) {
      const { creditAffiliateFromIntent } = await import('./affiliate-credit')
      await creditAffiliateFromIntent(DB, opts?.env, oid).catch(() => {})
    }
    if (opts?.buyerUserId && axisOn(opts, 'multi_tier')) {
      const { calculateMultiTierCommission } = await import('../../features/referral/api/referral-tree.routes')
      await calculateMultiTierCommission(DB, oid, total, String(opts.buyerUserId)).catch(() => {})
    }
    return
  }

  const { creditAffiliateFromIntent, peekAffiliateIntentRequest } = await import('./affiliate-credit')
  const { calculateMultiTierCommission, computeMultiTierEntries } = await import('../../features/referral/api/referral-tree.routes')
  const { creditInfluencerStoreIntroCommission, computeInfluencerStoreIntroRequest } = await import('./influencer-store-intro-commission')
  const { creditAgencyStoreIntroCommission, computeAgencyStoreIntroRequest } = await import('./agency-store-intro-commission')

  // ── 요청액 산출 (compute-only, read-only) ───────────────────────────────
  const requests: CommissionRequest[] = []
  let affReq = 0
  if (opts?.withAffiliate && axisOn(opts, 'affiliate')) {
    affReq = await peekAffiliateIntentRequest(DB, oid).catch(() => 0)
    // promo owner-펀딩이면 C1 은 셀러 부담(promo 슬라이스) → 플랫폼 예산 대상 아님.
    if (affReq > 0 && !promoOwnerFunded) requests.push({ key: 'affiliate', amountKrw: affReq })
  }
  let mtReq = 0
  if (opts?.buyerUserId && affReq === 0 && axisOn(opts, 'multi_tier')) {
    // C1↔C2 상호배타(기존 dedup 규칙 계승) — C1 요청이 있으면 C2 는 시도 자체를 안 함.
    try {
      const entries = await computeMultiTierEntries(DB, oid, total, String(opts.buyerUserId))
      mtReq = entries.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    } catch { mtReq = 0 }
    if (mtReq > 0) requests.push({ key: 'multi_tier', amountKrw: mtReq })
  }
  const infReq = axisOn(opts, 'influencer_intro') ? await computeInfluencerStoreIntroRequest(DB, order) : 0
  if (infReq > 0) requests.push({ key: 'influencer_intro', amountKrw: infReq })
  const agReq = axisOn(opts, 'agency_intro') ? await computeAgencyStoreIntroRequest(DB, order) : 0
  if (agReq > 0) requests.push({ key: 'agency_intro', amountKrw: agReq })

  // ── 예산 배분 ([INV-CB]) ────────────────────────────────────────────────
  const platformFeeKrw = await resolveOrderPlatformFeeKrw(DB, order)
  const budget = computeCommissionBudget({ amountKrw: total, platformFeeKrw, pgReservePct })
  const grants = allocateCommissions(requests, budget)
  try {
    assertCommissionBudgetInvariants(grants, budget)
  } catch {
    // fail-closed: 불변식 위반(코드 버그) 시 이 주문의 비례 커미션을 적립하지 않음 —
    // 초과지급(회수 곤란)보다 미지급(보정 가능)이 안전. signup 보너스(정액·월예산 캡)만 통과.
    await creditAgencyStoreIntroCommission(DB, order, { amountOverride: 0 }).catch(() => {})
    return
  }
  const granted = (key: string) => grants.find(g => g.key === key)?.grantedKrw ?? 0

  // ── 적립 (C1 → C2 → C3 → C4 순차 — 상호배타 dedup 레이스 제거) ─────────
  if (affReq > 0) {
    // owner-펀딩이면 전액(현행 — 셀러 부담이라 캡 비대상), 아니면 배분액.
    await creditAffiliateFromIntent(DB, opts?.env, oid, promoOwnerFunded ? undefined : { amountOverride: granted('affiliate') }).catch(() => {})
  }
  if (mtReq > 0 && opts?.buyerUserId) {
    await calculateMultiTierCommission(DB, oid, total, String(opts.buyerUserId), { totalCapKrw: granted('multi_tier') }).catch(() => {})
  }
  // C3/C4 는 요청 0(부적격)이어도 호출 — helper 자체가 안전 skip 하고, C4 는 signup 보너스
  // (월예산 캡, 거래 예산 밖 정액)를 독립 처리해야 하므로 항상 통과시킨다.
  if (axisOn(opts, 'influencer_intro')) await creditInfluencerStoreIntroCommission(DB, order, { amountOverride: granted('influencer_intro') }).catch(() => {})
  if (axisOn(opts, 'agency_intro')) await creditAgencyStoreIntroCommission(DB, order, { amountOverride: granted('agency_intro') }).catch(() => {})
}

export async function creditOrderCommissions(
  DB: D1Database,
  orders: OrderLike[],
  opts?: CreditOrderCommissionsOpts,
): Promise<void> {
  if (!orders?.length) return

  let gateOn = false
  let pgReservePct = DEFAULT_PG_RESERVE_PCT
  let promoOwnerFunded = false
  try {
    gateOn = (await readSetting(DB, 'commission_budget_enabled')) === 'true'
    if (gateOn) {
      const pg = Number(await readSetting(DB, 'pg_reserve_pct'))
      if (Number.isFinite(pg) && pg >= 0 && pg <= 100) pgReservePct = pg
      promoOwnerFunded = (await readSetting(DB, 'promo_funding_source')) === 'owner'
    }
  } catch {
    gateOn = false // 설정 조회 실패 → 현행 경로(안전)
  }

  if (!gateOn) {
    await legacyCredit(DB, orders, opts)
    return
  }

  for (const o of orders) {
    await budgetedCreditForOrder(DB, o, pgReservePct, promoOwnerFunded, opts).catch(() => { /* fail-soft — 다음 주문 계속 */ })
  }
  // 공급자(B2B) 정산 — 플랫폼 부담 아님(예산 무관), 기존대로 항상(only 필터만 존중).
  if (axisOn(opts, 'supplier')) try {
    const { creditSupplierOnOrder } = await import('../../features/supply/api/supply-settlement')
    for (const o of orders) {
      await creditSupplierOnOrder(DB, Number(o.id))
    }
  } catch { /* fail-soft */ }
}
