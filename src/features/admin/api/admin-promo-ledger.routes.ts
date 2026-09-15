/**
 * 🧾 어드민 — promo/커미션 재원 원장 감사 콕핏 (read-only)
 *
 * 🔒 불변식 #44 (docs/AUDIT_INVARIANTS.md · CLAUDE.md ⭐ 커미션 재원 확정 원칙 2026-07-08):
 *   "원장 platform:revenue = 5% 전액, 성장 커미션 debit 0 — 유어딜 5% 는 어떤 커미션에도 안 쓴다."
 *   이 라우트는 그 **검증 표면** — 8월 promo flip(재원 owner 전환) *전에* 만들어 staging flip 검증이
 *   이 콕핏으로 Σ적립·원장 대칭을 눈으로 확인할 수 있게 한다. 돈 이동 0 · 정산 로직 무변경.
 *
 * 마운트: /api/admin/promo-ledger
 *   GET /summary?month=YYYY-MM — 스위치 상태 + 월 집계 + 불변식 #44 패널 데이터
 *   GET /orders?month=&page=   — order_fee_breakdown(그림자) 주문별 감사 테이블
 *   GET /order/:orderNumber    — 주문 1건 S1 판정(Σ적립 ≤ 예산) — 손으로 더하지 않게
 */
import { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { requireAdminRole } from '../../../worker/middleware/auth'
import { intParam } from '../../../shared/pagination'
import { computeCommissionBudget, DEFAULT_PG_RESERVE_PCT } from '../../../worker/utils/commission-budget'
import { findActiveDealPct } from '../../../worker/utils/influencer-deal'
import type { Env } from '../../../worker/types/env'

export const adminPromoLedgerRoutes = new Hono<{ Bindings: Env }>()

/** YYYY-MM 검증 — 불일치 시 현재 월(UTC) 폴백 */
function resolveMonth(raw: string | undefined): string {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) return raw
  return new Date().toISOString().slice(0, 7)
}

// ─── GET /summary — 스위치 + 월 집계 + 불변식 #44 패널 ─────────────────────
adminPromoLedgerRoutes.get('/summary', requireAdminRole('finance'), async (c) => {
  const { DB } = c.env
  try {
    const month = resolveMonth(c.req.query('month'))

    // ① 재원/게이트 스위치 (platform_settings — 어드민 조정 대상 값)
    const settingRows = await DB.prepare(
      `SELECT key, value FROM platform_settings
        WHERE key IN ('promo_funding_source', 'commission_budget_enabled', 'pg_reserve_pct', 'seller_promo_field_enabled')`
    ).all<{ key: string; value: string }>().catch(() => ({ results: [] as { key: string; value: string }[] }))
    const settings: Record<string, string> = {}
    for (const r of settingRows.results || []) settings[r.key] = r.value
    const switches = {
      promo_funding_source: settings.promo_funding_source || 'platform',
      commission_budget_enabled: settings.commission_budget_enabled || 'false',
      pg_reserve_pct: settings.pg_reserve_pct ?? null,
      seller_promo_field_enabled: settings.seller_promo_field_enabled || 'false',
    }

    // ② 월 주문 집계 — status 값은 admin-tax.routes.ts 월간과 동일(DONE/PAID/DELIVERED)
    const orders = await DB.prepare(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS amount
         FROM orders
        WHERE status IN ('DONE', 'PAID', 'DELIVERED')
          AND strftime('%Y-%m', created_at) = ?`
    ).bind(month).first<{ cnt: number; amount: number }>().catch(() => null)

    // ③ 월 affiliate promo(소개비) 합 — 라이브 적립 경로 유효분(holding/granted)
    const promo = await DB.prepare(
      `SELECT COALESCE(SUM(commission), 0) AS total, COUNT(*) AS cnt
         FROM affiliate_earnings
        WHERE COALESCE(status, '') IN ('holding', 'granted')
          AND strftime('%Y-%m', created_at) = ?`
    ).bind(month).first<{ total: number; cnt: number }>().catch(() => null)

    // ④ 그림자(order_fee_breakdown) 월 집계 — fee-resolver 기록 전용(실정산 아님)
    const shadow = await DB.prepare(
      `SELECT COUNT(*) AS cnt,
              COALESCE(SUM(platform), 0) AS platform_sum,
              COALESCE(SUM(promo), 0) AS promo_sum,
              COALESCE(SUM(agency), 0) AS agency_sum,
              COALESCE(SUM(owner_net), 0) AS owner_net_sum
         FROM order_fee_breakdown
        WHERE strftime('%Y-%m', created_at) = ?`
    ).bind(month).first<{
      cnt: number; platform_sum: number; promo_sum: number; agency_sum: number; owner_net_sum: number
    }>().catch(() => null)

    // ⑤ 불변식 #44 패널 — platform:revenue 원장 대칭.
    //   기대: credit = 5% 수수료 전액(+ owner-promo 회수 promo_fee credit),
    //         debit  = 정산/환불 역전 계열만. "위반" = 성장 커미션(agency/influencer/referral/passthrough 등
    //   commission-ish event_type)이 platform:revenue 를 debit 하는 것 — flip 후엔 0 이어야 함.
    //   (현행 모델(flip 전)은 agency_commission 등이 플랫폼 부담이라 suspect 에 잡히는 게 정상 — flip 검증용 지표.)
    const revCredit = await DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt
         FROM ledger_entries
        WHERE credit_account = 'platform:revenue'
          AND strftime('%Y-%m', created_at) = ?`
    ).bind(month).first<{ total: number; cnt: number }>().catch(() => null)
    const revDebit = await DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt
         FROM ledger_entries
        WHERE debit_account = 'platform:revenue'
          AND strftime('%Y-%m', created_at) = ?`
    ).bind(month).first<{ total: number; cnt: number }>().catch(() => null)

    // 성장 커미션 의심 debit — event_type 이 커미션 계열(환불 역전 promo_fee_reversal 은 대칭 정상이라 제외)
    const suspects = await DB.prepare(
      `SELECT id, event_type, amount, reference_id, created_at
         FROM ledger_entries
        WHERE debit_account = 'platform:revenue'
          AND strftime('%Y-%m', created_at) = ?
          AND event_type != 'promo_fee_reversal'
          AND (event_type LIKE '%commission%' OR event_type LIKE '%intro%'
               OR event_type LIKE '%referral%' OR event_type LIKE '%passthrough%'
               OR event_type LIKE '%affiliate%')
        ORDER BY created_at DESC
        LIMIT 20`
    ).bind(month).all<{
      id: number; event_type: string; amount: number; reference_id: string | null; created_at: string
    }>().catch(() => ({ results: [] as never[] }))
    const suspectCount = await DB.prepare(
      `SELECT COUNT(*) AS cnt FROM ledger_entries
        WHERE debit_account = 'platform:revenue'
          AND strftime('%Y-%m', created_at) = ?
          AND event_type != 'promo_fee_reversal'
          AND (event_type LIKE '%commission%' OR event_type LIKE '%intro%'
               OR event_type LIKE '%referral%' OR event_type LIKE '%passthrough%'
               OR event_type LIKE '%affiliate%')`
    ).bind(month).first<{ cnt: number }>().catch(() => null)

    // ⑥ 🎬 WP-A 비정산 마킹 — 0원 체험권 발급(매장 자기부담 제공). payment_method='experience'
    //   0원 order 는 정산/커미션/원장(amount>0 게이트)을 구조적으로 우회 → 여기 '비정산'으로만 가시화.
    //   sum_amount 는 항상 0 이어야 함(0 아니면 발급 경로 회귀 — 감사 신호).
    const experience = await DB.prepare(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS sum_amount
         FROM orders
        WHERE payment_method = 'experience'
          AND strftime('%Y-%m', created_at) = ?`
    ).bind(month).first<{ cnt: number; sum_amount: number }>().catch(() => null)

    return c.json({
      success: true,
      data: {
        month,
        switches,
        orders: { count: Number(orders?.cnt) || 0, amount: Number(orders?.amount) || 0 },
        affiliate_promo: { sum: Number(promo?.total) || 0, count: Number(promo?.cnt) || 0 },
        experience_noncash: {
          count: Number(experience?.cnt) || 0,
          sum_amount: Number(experience?.sum_amount) || 0,
          note: '비정산 (매장 자기부담 0원 체험권) — 정산·커미션·유어딜 5% 무관. sum_amount 는 0 이어야 정상.',
        },
        fee_breakdown: {
          count: Number(shadow?.cnt) || 0,
          platform_sum: Number(shadow?.platform_sum) || 0,
          promo_sum: Number(shadow?.promo_sum) || 0,
          agency_sum: Number(shadow?.agency_sum) || 0,
          owner_net_sum: Number(shadow?.owner_net_sum) || 0,
        },
        invariant_44: {
          platform_revenue_credit_sum: Number(revCredit?.total) || 0,
          platform_revenue_credit_count: Number(revCredit?.cnt) || 0,
          platform_revenue_debit_sum: Number(revDebit?.total) || 0,
          platform_revenue_debit_count: Number(revDebit?.cnt) || 0,
          suspect_commission_debit_count: Number(suspectCount?.cnt) || 0,
          suspect_commission_debits: suspects.results || [],
          note: 'flip 후 목표: suspect_commission_debit_count = 0 (성장 커미션은 매장 promo 재원 — 유어딜 5% 불변)',
        },
      },
    })
  } catch (err) {
    return safeError(c, err, 'promo 원장 요약 조회 중 오류가 발생했습니다', '[admin-promo-ledger]')
  }
})

// ─── GET /orders — 그림자 주문별 감사 테이블 (read-only) ─────────────────────
adminPromoLedgerRoutes.get('/orders', requireAdminRole('finance'), async (c) => {
  const { DB } = c.env
  try {
    const month = resolveMonth(c.req.query('month'))
    const page = Math.max(1, intParam(c.req.query('page'), 1))
    const limit = 50
    const offset = (page - 1) * limit

    const rows = await DB.prepare(
      `SELECT ofb.order_id, o.order_number, o.seller_id, o.status,
              ofb.amount, ofb.ownership, ofb.platform, ofb.agency,
              ofb.platform_net, ofb.promo, ofb.supply, ofb.owner_net, ofb.created_at
         FROM order_fee_breakdown ofb
         JOIN orders o ON o.id = ofb.order_id
        WHERE strftime('%Y-%m', ofb.created_at) = ?
        ORDER BY ofb.created_at DESC
        LIMIT ? OFFSET ?`
    ).bind(month, limit, offset).all<Record<string, unknown>>()
      .catch(() => ({ results: [] as Record<string, unknown>[] }))

    const total = await DB.prepare(
      `SELECT COUNT(*) AS cnt FROM order_fee_breakdown WHERE strftime('%Y-%m', created_at) = ?`
    ).bind(month).first<{ cnt: number }>().catch(() => null)

    return c.json({
      success: true,
      data: {
        month,
        page,
        limit,
        total: Number(total?.cnt) || 0,
        rows: rows.results || [],
      },
    })
  } catch (err) {
    return safeError(c, err, 'promo 원장 주문 목록 조회 중 오류가 발생했습니다', '[admin-promo-ledger]')
  }
})

// ─── GET /order/:orderNumber — 주문 1건 S1 판정 패널 (read-only) ──────────────
/**
 * 🔍 **주문 하나를 두고 "예산 아비터를 켜도 되는가"를 판정한다.**
 *
 * 왜 필요한가: S1(`commission_budget_enabled`)의 통과 기준은 *"Σ적립 ≤ 주문당 예산"* 인데,
 * 그걸 보려면 `affiliate_earnings` · `referral_commissions` · `influencer_attributions` ·
 * `agency_store_intro_commissions` · `ledger_entries` 를 **손으로 조회해 더해야** 했다.
 * **손으로 더해야 하는 검증은 아무도 안 한다** — 그래서 이 게이트가 2026-07-04 배선 이후
 * 두 달 넘게 미검증으로 남았다. 여기서 한 화면에 답이 나오면 실결제 1건으로 판정된다.
 *
 * 🔑 **예산은 요율을 다시 계산하지 않는다** — 이 주문의 `ledger_entries.fee_amount`(실제로
 * 찍힌 수수료)를 진실로 삼는다. 여기서 다시 계산하면 실제 청구와 갈릴 수 있고, **갈리는 것이
 * 이 레포의 단골 사고다**(채널 요율 표시가 실제 청구와 달랐던 건과 같은 클래스).
 *
 * ⚠️ **`platform_revenue.debit_krw > 0` 은 결함이 아니다.** 2026-09-07 결재 Q4-2 로
 * *"유어딜 5% 는 어떤 커미션에도 안 쓴다"*(2026-07-08 원칙)가 **폐기**됐다 — 성장 커미션은
 * 플랫폼 수수료 안에서 부담하되 **총합이 예산을 못 넘게 아비터가 강제**하는 쪽으로 갔다.
 * 그래서 S1 의 합격선은 `verdict.within_budget` **하나**이고, 원장 debit 은 판정이 아니라
 * 참고 수치다(전 축 owner-promo flip 은 추진하지 않는다).
 *
 * 돈 이동 0 · 정산 로직 무접촉 — 조회만 한다.
 */
adminPromoLedgerRoutes.get('/order/:orderNumber', requireAdminRole('finance'), async (c) => {
  const { DB } = c.env
  try {
    const orderNumber = String(c.req.param('orderNumber') || '').trim()
    if (!orderNumber || orderNumber.length > 64) {
      return c.json({ success: false, error: '주문번호가 올바르지 않습니다' }, 400)
    }

    // 한 주문번호에 주문 행이 여럿일 수 있다(셀러별 분할) — 전부 묶어서 판정한다.
    const orders = await DB.prepare(
      `SELECT id, order_number, seller_id, status, total_amount, COALESCE(deal_used, 0) AS deal_used, created_at
         FROM orders WHERE order_number = ?`
    ).bind(orderNumber).all<{
      id: number; order_number: string; seller_id: number | null; status: string
      total_amount: number; deal_used: number; created_at: string
    }>().catch(() => ({ results: [] as { id: number; order_number: string; seller_id: number | null; status: string; total_amount: number; deal_used: number; created_at: string }[] }))
    const orderRows = orders.results || []
    if (orderRows.length === 0) {
      return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
    }
    const orderIds = orderRows.map((o) => Number(o.id))
    const idPh = orderIds.map(() => '?').join(', ')
    const refs = orderIds.map((id) => `order:${id}`)
    const refPh = refs.map(() => '?').join(', ')
    const amountKrw = orderRows.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)

    // ① 예산 = max(0, 플랫폼 수수료 − PG 준비금). 수수료는 이 주문의 원장 fee 가 진실.
    const feeRow = await DB.prepare(
      `SELECT COALESCE(SUM(fee_amount), 0) AS fee FROM ledger_entries
        WHERE credit_account = 'platform:revenue' AND reference_id IN (${refPh})`
    ).bind(...refs).first<{ fee: number }>().catch(() => null)
    const settingRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'pg_reserve_pct'")
      .first<{ value: string | null }>().catch(() => null)
    const pgReserveRaw = Number(settingRow?.value ?? NaN)
    const pgReservePct = Number.isFinite(pgReserveRaw) ? pgReserveRaw : DEFAULT_PG_RESERVE_PCT
    const platformFeeKrw = Math.max(0, Math.round(Number(feeRow?.fee ?? 0)))
    const budgetKrw = computeCommissionBudget({ amountKrw, platformFeeKrw, pgReservePct })

    // ② 이 주문에 붙은 성장 커미션 적립 — 축마다 사는 테이블이 다르다.
    const grants: Array<{ axis: string; amount: number; rows: number }> = []
    const collect = async (axis: string, sql: string) => {
      const r = await DB.prepare(sql).bind(...orderIds)
        .first<{ total: number; cnt: number }>().catch(() => null)
      grants.push({ axis, amount: Math.round(Number(r?.total ?? 0)), rows: Number(r?.cnt ?? 0) })
    }
    await collect('affiliate',
      `SELECT COALESCE(SUM(commission), 0) AS total, COUNT(*) AS cnt FROM affiliate_earnings
        WHERE order_id IN (${idPh}) AND COALESCE(status, '') IN ('holding', 'granted')`)
    await collect('multi_tier',
      `SELECT COALESCE(SUM(commission_amount), 0) AS total, COUNT(*) AS cnt FROM referral_commissions
        WHERE order_id IN (${idPh}) AND COALESCE(status, '') != 'withdrawn'`)
    await collect('influencer_store_intro',
      `SELECT COALESCE(SUM(commission_amount), 0) AS total, COUNT(*) AS cnt FROM influencer_attributions
        WHERE order_id IN (${idPh}) AND COALESCE(source, '') = 'store_intro'`)
    // 🌇 에이전시 축은 2026-08-31 폐지(라이브 0행) — 그래도 **0 임을 보여 주려고** 남긴다.
    //    빼 버리면 "안 센 것"과 "0 인 것"을 화면에서 구분할 수 없다.
    await collect('agency_store_intro',
      `SELECT COALESCE(SUM(commission_amount), 0) AS total, COUNT(*) AS cnt FROM agency_store_intro_commissions
        WHERE order_id IN (${idPh})`)
    const grantedTotal = grants.reduce((s, g) => s + g.amount, 0)

    // ③ platform:revenue 원장 — 참고 수치(판정 아님, 위 주석 참조).
    const credit = await DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM ledger_entries
        WHERE credit_account = 'platform:revenue' AND reference_id IN (${refPh})`
    ).bind(...refs).first<{ total: number }>().catch(() => null)
    const debits = await DB.prepare(
      `SELECT event_type, amount, reference_id FROM ledger_entries
        WHERE debit_account = 'platform:revenue' AND reference_id IN (${refPh})
        ORDER BY id DESC LIMIT 20`
    ).bind(...refs).all<{ event_type: string; amount: number; reference_id: string | null }>()
      .catch(() => ({ results: [] as { event_type: string; amount: number; reference_id: string | null }[] }))
    const debitRows = debits.results || []
    const debitTotal = debitRows.reduce((s, d) => s + (Number(d.amount) || 0), 0)

    const gateRows = await DB.prepare(
      `SELECT key, value FROM platform_settings
        WHERE key IN ('commission_budget_enabled', 'promo_funding_source',
                      'pickup_unclaimed_policy_enabled', 'partial_refund_enabled')`
    ).all<{ key: string; value: string }>().catch(() => ({ results: [] as { key: string; value: string }[] }))
    const settingsForGates: Record<string, string> = {}
    for (const r of gateRows.results || []) settingsForGates[r.key] = r.value
    const gateRow = { value: settingsForGates.commission_budget_enabled ?? null }

    // ─── S4 · 그림자 수수료 기록 / S5 · 미수령 몰수 / S6 · 부분환불 저장액 ──────
    /**
     * 🧾 셋 다 *"주문 하나를 두고 무엇이 몇 건 찍혔나"* 다. 손으로 보려면 표를 세 개 열어야 했다.
     *
     *   S4 `FEE_RESOLVER_ENABLED` — `order_fee_breakdown` 에 **주문당 1행**(그림자 기록, 정산 무영향)
     *   S5 `pickup_unclaimed_policy_enabled` — 깎은 만큼 `unclaimed_forfeit` **1행**(cron 2회 실행에도 이중 0)
     *   S6 `partial_refund_enabled` — 사람이 정한 환불액이 **결제액을 안 넘는지**
     *
     * ⚠️ S5 의 원장 키는 주문이 아니라 **교환권**(`voucher:{id}`)이라, 이 주문의 교환권을 먼저 찾는다.
     *    교환권이 없는 주문이면 대상 자체가 없다(`vouchers: 0`) — 0건을 통과로 읽지 말 것.
     * ⚠️ 조회 실패는 전부 `readable: false` 로 내린다 — 실패를 0 으로 읽으면 "이중 없음"이 조용히 참이 된다.
     */
    const s4Row = await DB.prepare(
      `SELECT COUNT(*) AS rows, COALESCE(SUM(platform), 0) AS platform_krw,
              COALESCE(SUM(agency), 0) AS agency_krw, COALESCE(SUM(owner_net), 0) AS owner_net_krw
         FROM order_fee_breakdown WHERE order_id IN (${idPh})`
    ).bind(...orderIds).first<{ rows: number; platform_krw: number; agency_krw: number; owner_net_krw: number }>()
      .catch(() => null)
    const s4 = s4Row === null
      ? { readable: false as const, note: 'order_fee_breakdown 조회 실패 — 판정 불가(통과 아님)' }
      : {
          readable: true as const,
          gate_on: String(c.env.FEE_RESOLVER_ENABLED || '') === 'true',
          rows: Number(s4Row.rows) || 0,
          one_row_per_order: (Number(s4Row.rows) || 0) === orderIds.length,
          platform_krw: Number(s4Row.platform_krw) || 0,
          agency_krw: Number(s4Row.agency_krw) || 0,
          owner_net_krw: Number(s4Row.owner_net_krw) || 0,
          // 그림자는 기록만 한다 — 이 값이 실제 정산과 같은지는 사람이 비교한다(그게 S4 의 목적).
          note: '게이트 OFF 면 rows 0 이 정상. 기록된 분배 vs 현행 정산 비교는 사람이 한다 — 그것이 authoritative 전환의 전제',
        }

    const s5Row = await DB.prepare(
      `SELECT
          (SELECT COUNT(*) FROM vouchers WHERE order_id IN (${idPh})) AS vouchers,
          (SELECT COUNT(*) FROM ledger_entries
            WHERE event_type = 'unclaimed_forfeit'
              AND reference_id IN (SELECT 'voucher:' || id FROM vouchers WHERE order_id IN (${idPh}))) AS forfeits,
          (SELECT COALESCE(SUM(amount), 0) FROM ledger_entries
            WHERE event_type = 'unclaimed_forfeit'
              AND reference_id IN (SELECT 'voucher:' || id FROM vouchers WHERE order_id IN (${idPh}))) AS forfeit_krw`
    ).bind(...orderIds, ...orderIds, ...orderIds)
      .first<{ vouchers: number; forfeits: number; forfeit_krw: number }>().catch(() => null)
    const s5 = s5Row === null
      ? { readable: false as const, note: '교환권·원장 조회 실패 — 판정 불가(통과 아님)' }
      : {
          readable: true as const,
          gate_on: settingsForGates.pickup_unclaimed_policy_enabled === 'true',
          vouchers: Number(s5Row.vouchers) || 0,
          forfeits: Number(s5Row.forfeits) || 0,
          forfeit_krw: Number(s5Row.forfeit_krw) || 0,
          // cron 이 두 번 돌아도 한 교환권에 한 행이어야 한다(CAS). 교환권보다 많으면 이중 몰수다.
          no_double_forfeit: (Number(s5Row.forfeits) || 0) <= (Number(s5Row.vouchers) || 0),
          note: '게이트 OFF 면 forfeits 0 이 정상(전액 환불). 교환권이 없는 주문이면 vouchers 0 — 대상 자체가 없다',
        }

    const s6Row = await DB.prepare(
      `SELECT COUNT(*) AS rows, COALESCE(SUM(COALESCE(refund_amount, 0)), 0) AS set_krw,
              SUM(CASE WHEN refund_amount IS NOT NULL THEN 1 ELSE 0 END) AS amount_set
         FROM returns WHERE order_id IN (${idPh})`
    ).bind(...orderIds).first<{ rows: number; set_krw: number; amount_set: number }>().catch(() => null)
    const s6 = s6Row === null
      ? { readable: false as const, note: 'returns 조회 실패 — 판정 불가(통과 아님)' }
      : {
          readable: true as const,
          gate_on: settingsForGates.partial_refund_enabled === 'true',
          returns: Number(s6Row.rows) || 0,
          amount_set: Number(s6Row.amount_set) || 0,
          set_krw: Number(s6Row.set_krw) || 0,
          // 사람이 정한 값이라 초과 입력이 가장 무서운 실수다. 서버 클램프가 살아 있으면 여기서 참이다.
          within_paid: (Number(s6Row.set_krw) || 0) <= amountKrw,
          note: '반품이 없으면 returns 0 이 정상. 초과 입력은 서버가 클램프해야 한다 — within_paid 가 그 판정',
        }

    // ─── S8 · 소개자 몫 = 매장이 합의한 딜 % 뿐인가 ───────────────────────────
    /**
     * 🤝 **이 게이트만 게이트가 없다 — 머지 즉시 라이브다**(`STAGING_CHECKLIST` §S8).
     *
     * 2026-08-30 대표 *"자동분은 빼줘"* 로 `calcInfluencerCommissionPct` 가 **딜 % 하나만** 돌려주게 됐다.
     * 그전엔 `max(자동분, 딜)` 이었고 자동분(영입 1%)은 **매장 지갑에서** 나갔다 — 매장이 동의한 적 없는 몫이다.
     * 나머지 게이트는 꺼져 있어 안 도는 코드지만, **이건 지금 돈이 그 규칙으로 흐르고 있는데 미검증이다.**
     *
     * 🔑 **딜 %를 설정에서 다시 계산하지 않는다** — 결제가 쓴 것과 **같은 SSOT**(`findActiveDealPct`)로 묻는다.
     * 여기서 조건을 베껴 쓰면 화면은 "N% 받는다"인데 정산은 0 이 되는, 그 파일이 막으려던 드리프트가 난다.
     *
     * 판정 둘:
     *   ① 딜이 있으면 적립 = `floor(결제액 × 딜%)` — **2%로 잘리지 않는다**(옛 clamp 부활 감지)
     *   ② 딜이 없으면 적립 **0원** — 자동 1%가 되살아나면 여기서 잡힌다
     * ⚠️ **못 보는 것**: ③매장 정산액 증가분과 ④`payout_method='deal'` 소개자의 지급대기 노출은
     *    주문 한 건으로 판정되지 않는다(정산·지급 화면의 몫). 그건 아래 `note` 에 적어 내린다.
     */
    type AttrRow = { influencer_id: string; seller_id: number; amount: number }
    // 🔴 **조회 실패를 "적립 0" 으로 읽으면 안 된다.** 그러면 판정이 조용히 `true` 가 되고,
    //   이 레포가 반복해 당한 "검사가 실패할 수 없음" 이 하필 머니 게이트 앞에서 난다.
    //   `source` 는 base CREATE 에 없고 repair-schema 가 붙이는 컬럼이라, 없으면 쿼리 자체가 죽는다.
    //   ⇒ 없으면 그 조건만 빼고 한 번 더 묻고, 그것도 실패하면 **판정 불가**로 내린다.
    let attrs: AttrRow[] | null = null
    for (const withSource of [true, false]) {
      const cond = withSource ? " AND COALESCE(source, '') != 'store_intro'" : ''
      const r = await DB.prepare(
        `SELECT influencer_id, seller_id, COALESCE(commission_amount, 0) AS amount
           FROM influencer_attributions
          WHERE order_id IN (${idPh})${cond}`
      ).bind(...orderIds).all<AttrRow>().catch(() => null)
      if (r) { attrs = r.results || []; break }
    }
    const introducerTotal = (attrs ?? []).reduce((s2, a) => s2 + (Number(a.amount) || 0), 0)

    // 딜은 (매장 × 소개자) 짝마다 다르다. 적립이 없으면 주문의 셀러로 물어 "딜이 있는데 0인가"도 본다.
    const pairs = (attrs ?? []).map((a) => ({ sellerId: Number(a.seller_id), influencerId: String(a.influencer_id) }))
    const dealChecks: Array<{ influencer_id: string; seller_id: number; deal_pct: number | null; expected_krw: number; actual_krw: number; ok: boolean }> = []
    for (const p2 of pairs) {
      const pct = await findActiveDealPct(DB, p2.sellerId, p2.influencerId).catch(() => null)
      const actual = (attrs ?? [])
        .filter((a) => String(a.influencer_id) === p2.influencerId && Number(a.seller_id) === p2.sellerId)
        .reduce((s2, a) => s2 + (Number(a.amount) || 0), 0)
      const expected = pct === null ? 0 : Math.floor((amountKrw * pct) / 100)
      dealChecks.push({
        influencer_id: p2.influencerId, seller_id: p2.sellerId,
        deal_pct: pct, expected_krw: expected, actual_krw: actual, ok: actual === expected,
      })
    }
    // ─── S2 · S3 · 원장 한 쌍 판정 (정확히 1회 + 환불 시 역전 대칭) ──────────────
    /**
     * 🧾 **두 게이트가 같은 모양이라 한 함수로 판정한다.**
     *   S2 `promo_funding_source='owner'` — 이용권 사용 시 매장 원장 promo debit **정확히 1회**, 환불 시 복원
     *   S3 `SHOPPING_LEDGER_ENABLED`     — 쇼핑 주문 셀러 net 크레딧 **정확히 1회**, 환불 시 역전
     *
     * 둘 다 통과선이 *"한 번만 찍혔나 · 환불하면 되돌았나"* 다. 손으로 보려면 `ledger_entries` 를
     * event_type 별로 세어야 했고, **세는 일은 아무도 안 한다** — 그래서 2026-07-04/07-01 배선 이후 미검증이다.
     *
     * 🔑 **0건과 조회실패를 구분한다.** 실패를 0 으로 읽으면 "이중적립 없음" 이 조용히 참이 된다.
     * 게이트가 꺼져 있으면 0건이 **정상**이므로, 판정은 `게이트 상태와 함께` 읽어야 한다(`gate_on` 동봉).
     */
    async function ledgerPair(eventType: string, reversalType: string, refSuffix = '') {
      const refs2 = orderIds.map((id) => `order:${id}${refSuffix}`)
      const ph = refs2.map(() => '?').join(', ')
      const row = await DB.prepare(
        `SELECT
            SUM(CASE WHEN event_type = ? THEN 1 ELSE 0 END) AS credits,
            SUM(CASE WHEN event_type = ? THEN 1 ELSE 0 END) AS reversals,
            COALESCE(SUM(CASE WHEN event_type = ? THEN amount ELSE 0 END), 0) AS credit_krw,
            COALESCE(SUM(CASE WHEN event_type = ? THEN amount ELSE 0 END), 0) AS reversal_krw
           FROM ledger_entries WHERE reference_id IN (${ph})`
      ).bind(eventType, reversalType, eventType, reversalType, ...refs2)
        .first<{ credits: number; reversals: number; credit_krw: number; reversal_krw: number }>()
        .catch(() => null)
      if (!row) return { readable: false as const, note: '원장 조회 실패 — 판정 불가(통과 아님)' }
      const credits = Number(row.credits) || 0
      const reversals = Number(row.reversals) || 0
      return {
        readable: true as const,
        credits, reversals,
        credit_krw: Number(row.credit_krw) || 0,
        reversal_krw: Number(row.reversal_krw) || 0,
        // 두 번 찍히면 이중적립이다. 0건은 "게이트 OFF" 일 수도 있어 판정이 아니라 사실로 내린다.
        exactly_once: credits === 1,
        reversal_symmetric: reversals === 0 || (reversals === credits && Number(row.reversal_krw) === Number(row.credit_krw)),
      }
    }
    const s2 = {
      gate_on: settingsForGates.promo_funding_source === 'owner',
      ...(await ledgerPair('promo_fee', 'promo_fee_reversal', ':promo')),
      note: '게이트 OFF 면 credits 0 이 정상이다 — 0건을 통과로 읽지 말 것',
    }
    const s3 = {
      gate_on: String(c.env.SHOPPING_LEDGER_ENABLED || '') === 'true',
      ...(await ledgerPair('order_paid', 'order_paid_refund')),
      note: '이용권·공구 주문은 애초에 skip 된다(이중적립 방지) — 그 주문은 credits 0 이 정상',
    }

    const s8 = attrs === null
      ? {
          // 조회 자체가 안 됐다. `true` 도 `false` 도 말할 수 없다 — 모른다고 말한다.
          matches_deal_pct: null,
          introducer_total_krw: null,
          checks: [],
          note: 'influencer_attributions 조회 실패 — **판정 불가**(통과 아님). repair-schema 로 스키마를 맞춘 뒤 다시 볼 것',
        }
      : {
          // 적립이 0 이면 ②(딜 없으면 0)를 만족한 것. 딜이 있는데 0 이면 아래 checks 가 잡는다.
          introducer_total_krw: introducerTotal,
          checks: dealChecks,
          matches_deal_pct: dealChecks.every((d) => d.ok),
          note: '③매장 정산액 증가분·④payout_method=deal 소개자의 지급대기 노출은 주문 한 건으로 판정되지 않는다 — /admin/payout-center 에서 본다',
        }

    return c.json({
      success: true,
      data: {
        order: { order_number: orderNumber, rows: orderRows, amount_krw: amountKrw },
        gate: { commission_budget_enabled: gateRow?.value || 'false' },
        budget: { platform_fee_krw: platformFeeKrw, pg_reserve_pct: pgReservePct, budget_krw: budgetKrw },
        grants,
        granted_total_krw: grantedTotal,
        platform_revenue: {
          credit_krw: Math.round(Number(credit?.total ?? 0)),
          debit_krw: debitTotal,
          debit_rows: debitRows,
          note: 'debit > 0 은 정상 — 2026-09-07 결재 Q4-2 로 성장 커미션은 플랫폼 수수료 안에서 부담한다(판정 아님)',
        },
        // 👇 이 두 줄이 S1 판정이다. 손으로 더할 필요가 없게.
        verdict: {
          within_budget: grantedTotal <= budgetKrw,
          over_by_krw: Math.max(0, grantedTotal - budgetKrw),
        },
        // 🚦 게이트별 판정 — 결제 한 번 하고 이 주문번호 하나만 넣으면 답이 나오게 쌓는다.
        gates: { s2, s3, s4, s5, s6, s8 },
      },
    })
  } catch (err) {
    return safeError(c, err, '주문 커미션 판정 조회 중 오류가 발생했습니다', '[admin-promo-ledger]')
  }
})
