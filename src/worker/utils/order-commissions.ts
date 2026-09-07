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
// 🛑 2026-08-31: 'agency_intro'(에이전시 매장영입 1%) 폐지 — 타입에서 뺐으므로 호출부가 컴파일로 막힌다.
export type CommissionAxis = 'affiliate' | 'multi_tier' | 'influencer_intro' | 'supplier'

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

// 📊 2026-07-05 (운영 감사 Q10 — 캡 관측성): 캡이 실제로 깎은 주문을 영구 기록.
//   "캡이 발동했는가/누가 얼마 깎였는가"가 로그 없이는 어드민이 알 수 없어(적립액만 보임)
//   요율 조정·에이전시 소명 대응이 불가했음. 발동(Σ요청>예산) 시에만 1행 — 평시 write 0.
const _capLogEnsured = new WeakSet<object>()
async function ensureCapLogTable(DB: D1Database): Promise<void> {
  if (_capLogEnsured.has(DB)) return
  _capLogEnsured.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS commission_budget_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      budget_krw INTEGER NOT NULL,
      requested_krw INTEGER NOT NULL,
      granted_krw INTEGER NOT NULL,
      detail TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    )`).run()
    await DB.prepare('CREATE INDEX IF NOT EXISTS idx_cb_logs_order ON commission_budget_logs(order_id)').run()
    await DB.prepare('CREATE INDEX IF NOT EXISTS idx_cb_logs_created ON commission_budget_logs(created_at)').run()
  } catch { /* fail-soft */ }
}

/** 주문의 플랫폼 수수료(원) — order-ledger-credit 와 동일 규칙(orders.commission_rate ?? 기본 5%). */
async function resolveOrderPlatformFeeKrw(DB: D1Database, order: OrderLike): Promise<number> {
  const total = Number(order.total_amount || 0)
  if (!(total > 0)) return 0
  let rate: number = COMMISSION_DEFAULTS.PLATFORM_FEE_PCT  // as-const 리터럴(5) 추론 방지 — 재대입 number
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
  // 🛑 2026-08-31 대표 *"1%짜리는 아예 없애줘"* — **에이전시 매장영입 1% 폐지.**
  //
  //   같은 행위(매장을 데려온다)에 신분별로 다른 보상이 붙어 있었다:
  //     사람이 데려오면 2%·1년(`influencer_intro`) / 에이전시가 데려오면 1%·24개월(`agency_intro`)
  //   그래서 "영입자와 대행사의 경계"가 모호했다(대표 지적). 행위가 하나면 보상도 하나여야 한다.
  //
  //   대행사는 **채널 요율로 이미 보상받는다** — 대행 경유 매장은 유어딜이 5%만 떼므로
  //   그 차액(10%−5%)이 대행사 몫이다. 거기에 1% 를 더 얹을 이유가 없다.
  //
  //   ⚠️ **적립만 없앴다.** `reverseAgencyStoreIntroOnRefund`(환불 역전)와 정산/원장 읽기는
  //   그대로 둔다 — 새 적립이 0 이라 무해하고, 역전만 먼저 지우면 비대칭이 된다.
  //   폐지 시점 라이브 실측: `agency_store_intro_commissions` **0행**(잃는 데이터 없음).
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
  priorityKeys: string[],
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
    // 💸 2026-07-12 (S4a per-axis owner-redirect): owner-펀딩이면 C2 도 C1 처럼 셀러(promo) 부담 →
    //   플랫폼 예산 대상 아님(push 안 함, 아래에서 전액 적립). owner 되갚기는 debitOwnerPromoForOrder.
    if (mtReq > 0 && !promoOwnerFunded) requests.push({ key: 'multi_tier', amountKrw: mtReq })
  }
  const infReq = axisOn(opts, 'influencer_intro') ? await computeInfluencerStoreIntroRequest(DB, order) : 0
  if (infReq > 0 && !promoOwnerFunded) requests.push({ key: 'influencer_intro', amountKrw: infReq })
  // 🛑 2026-08-31 폐지(위 주석) — 예산 요청에서도 제외한다. 남겨 두면 예산을 잡아만 두고
  //   적립은 0 이라, 다른 축이 받을 수 있었던 몫이 사라진다(가장 조용한 손실).

  // ── 예산 배분 ([INV-CB]) ────────────────────────────────────────────────
  const platformFeeKrw = await resolveOrderPlatformFeeKrw(DB, order)
  const budget = computeCommissionBudget({ amountKrw: total, platformFeeKrw, pgReservePct })
  // 🥇 Q10: 에이전시 매장영입 1% 는 계약 기반(24개월 약속) — 캡 발동 시에도 최우선 보전.
  const grants = allocateCommissions(requests, budget, { priorityKeys })
  // 📊 Q10 관측성: 캡이 실제 깎은 주문만 기록(Σ요청 > 예산) — 평시 write 0, fail-soft.
  const requestedSum = requests.reduce((s, r) => s + r.amountKrw, 0)
  if (requestedSum > budget) {
    try {
      await ensureCapLogTable(DB)
      const grantedSum = grants.reduce((s, g) => s + g.grantedKrw, 0)
      await DB.prepare(
        'INSERT INTO commission_budget_logs (order_id, budget_krw, requested_krw, granted_krw, detail) VALUES (?, ?, ?, ?, ?)'
      ).bind(oid, budget, requestedSum, grantedSum, JSON.stringify(grants)).run()
    } catch { /* 로그 실패가 적립을 막지 않음 */ }
  }
  try {
    assertCommissionBudgetInvariants(grants, budget)
  } catch {
    // fail-closed: 불변식 위반(코드 버그) 시 이 주문의 비례 커미션을 적립하지 않음 —
    // 초과지급(회수 곤란)보다 미지급(보정 가능)이 안전.
    // 🛑 2026-08-31: 여기서 signup 보너스를 통과시키던 호출도 함께 제거(에이전시 영입 폐지).
    return
  }
  const granted = (key: string) => grants.find(g => g.key === key)?.grantedKrw ?? 0

  // ── 적립 (C1 → C2 → C3 → C4 순차 — 상호배타 dedup 레이스 제거) ─────────
  if (affReq > 0) {
    // owner-펀딩이면 전액(현행 — 셀러 부담이라 캡 비대상), 아니면 배분액.
    await creditAffiliateFromIntent(DB, opts?.env, oid, promoOwnerFunded ? undefined : { amountOverride: granted('affiliate') }).catch(() => {})
  }
  if (mtReq > 0 && opts?.buyerUserId) {
    // owner-펀딩이면 전액(셀러 부담 — 예산 캡 비대상), 아니면 배분액.
    await calculateMultiTierCommission(DB, oid, total, String(opts.buyerUserId), { totalCapKrw: promoOwnerFunded ? mtReq : granted('multi_tier') }).catch(() => {})
  }
  // C3/C4 는 요청 0(부적격)이어도 호출 — helper 자체가 안전 skip 하고, C4 는 signup 보너스
  // (월예산 캡, 거래 예산 밖 정액)를 독립 처리해야 하므로 항상 통과시킨다.
  // 💸 owner-펀딩이면 amountOverride 미전달=전액(셀러 promo 부담, C1 과 동일 패턴). 되갚기는 debitOwnerPromoForOrder.
  if (axisOn(opts, 'influencer_intro')) await creditInfluencerStoreIntroCommission(DB, order, promoOwnerFunded ? undefined : { amountOverride: granted('influencer_intro') }).catch(() => {})
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
  // 🥇 Q10 기본: 우선 보전 축. agency_intro(에이전시 1%)가 기본이었으나 2026-08-31 폐지되어 비운다.
  //   platform_settings 로 조정 가능(빈 배열 = 모든 축 동등 비례 배분).
  let priorityKeys: string[] = []
  // 💸 2026-07-12 파일럿 매장 스코프 — 전역 스위치 OFF 여도 지정 매장 주문만 flip 검증(프로덕션 실카드).
  let pilotIds = new Set<number>()
  try {
    gateOn = (await readSetting(DB, 'commission_budget_enabled')) === 'true'
    const { readFlipPilotSellerIds } = await import('./flip-pilot')
    pilotIds = await readFlipPilotSellerIds(DB)
    // 전역 ON 또는 파일럿 존재 시에만 flip 파라미터 조회(그 외 = 현행 경로).
    if (gateOn || pilotIds.size > 0) {
      const pg = Number(await readSetting(DB, 'pg_reserve_pct'))
      if (Number.isFinite(pg) && pg >= 0 && pg <= 100) pgReservePct = pg
      promoOwnerFunded = (await readSetting(DB, 'promo_funding_source')) === 'owner'
      const prioRaw = await readSetting(DB, 'commission_priority_axes')
      if (prioRaw !== null) {
        // CSV — 빈 문자열이면 '우선 없음(전 축 비례)' 의도로 존중.
        priorityKeys = prioRaw.split(',').map(s => s.trim()).filter(Boolean)
      }
    }
  } catch {
    gateOn = false // 설정 조회 실패 → 현행 경로(안전)
  }

  const isPilot = (o: OrderLike): boolean => o.seller_id != null && pilotIds.has(Number(o.seller_id))

  // 전역 OFF + 파일럿 해당 없음 = 완전 현행(byte-동일).
  if (!gateOn && !orders.some(isPilot)) {
    await legacyCredit(DB, orders, opts)
    return
  }

  // 주문별 라우팅: 전역 ON 또는 파일럿 매장 → 예산 아비터(파일럿은 owner 펀딩 강제). 그 외 → 현행.
  const legacyOrders: OrderLike[] = []
  for (const o of orders) {
    if (gateOn || isPilot(o)) {
      const ownerFunded = isPilot(o) ? true : promoOwnerFunded
      await budgetedCreditForOrder(DB, o, pgReservePct, ownerFunded, priorityKeys, opts).catch(() => { /* fail-soft — 다음 주문 계속 */ })
    } else {
      legacyOrders.push(o)
    }
  }
  if (legacyOrders.length) await legacyCredit(DB, legacyOrders, opts) // supplier 포함
  // 공급자(B2B) 정산 — budgeted 경로 주문분(legacyCredit 은 legacyOrders 만 처리). 플랫폼 부담 아님(예산 무관).
  if (axisOn(opts, 'supplier')) try {
    const { creditSupplierOnOrder } = await import('../../features/supply/api/supply-settlement')
    for (const o of orders) {
      if (gateOn || isPilot(o)) await creditSupplierOnOrder(DB, Number(o.id))
    }
  } catch { /* fail-soft */ }
}
