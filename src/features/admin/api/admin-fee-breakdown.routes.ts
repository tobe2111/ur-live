/**
 * 🆕 2026-06-29 fee-resolver 검증 도구 — 그림자 기록(order_fee_breakdown) ↔ 현행 실제 정산 **나란히 비교**.
 *
 *   목적: authoritative 전환(리졸버가 실제 정산을 대체) **전에** 대표가 스테이징/운영에서
 *   "새 규칙이 현행과 얼마나 다른가"를 주문별·합계로 눈으로 확인하기 위한 **읽기 전용** 화면.
 *   이 라우트는 어떤 돈도 적립/이동하지 않음 — SELECT 만.
 *
 *   배경: fee-resolver 그림자 배선(2026-06-27, payment.routes `_confirmSideFx`)이
 *   FEE_RESOLVER_ENABLED='true' 일 때 새 분배(플랫폼 5%/0% · 에이전시 1%/24mo)를
 *   order_fee_breakdown 에 *계산만 기록*. 현행 정산(셀러 커미션 + 에이전시 매장영입 2%+₩30k +
 *   영입자 1.5% + 공급가)은 별개 테이블에 그대로. 이 엔드포인트가 둘을 order_id 로 조인해 비교.
 *
 *   ⚠️ 그림자 기록의 한계(현 시점): recordOrderFeeBreakdown 는 supplyCost/promo 를 안 넘겨
 *   new_supply/new_promo 는 항상 0. 즉 *플랫폼+에이전시* 슬라이스가 검증의 핵심. supply 는
 *   현행(supplier_settlements)만 참고로 표시.
 *
 * Endpoints (전부 requireAdmin, read-only):
 *   GET /api/admin/fee-breakdown/compare?limit=N — 그림자 기록 있는 주문별 현행 vs 새 규칙 + 합계
 */
import { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { requireAdmin } from '../../../worker/middleware/auth'
import { DEFAULT_COMMISSION_RATE } from '@/shared/constants'
import type { Env } from '../../../worker/types/env'

export const adminFeeBreakdownRoutes = new Hono<{ Bindings: Env }>()

interface CompareRow {
  order_id: number
  order_number: string | null
  seller_id: number | null
  seller_name: string | null
  ownership: string
  order_total: number
  created_at: string | null
  // 새 규칙(그림자 기록 — order_fee_breakdown)
  new_platform: number
  new_agency: number
  new_platform_net: number
  new_promo: number
  new_supply: number
  new_owner_net: number
  // 현행(실제 적립/정산 — 라이브 쿼리)
  cur_commission_rate: number
  cur_platform: number
  cur_agency: number
  cur_influencer: number
  cur_supply: number
  cur_affiliate: number
}

adminFeeBreakdownRoutes.get('/admin/fee-breakdown/compare', requireAdmin(), async (c) => {
  const { DB } = c.env
  try {
    const limRaw = Number(c.req.query('limit'))
    const limit = Number.isFinite(limRaw) && limRaw > 0 && limRaw <= 2000 ? Math.floor(limRaw) : 500

    // 그림자 기록 테이블이 아직 없으면(리졸버 한 번도 안 켜짐) — 빈 결과 + 상태 안내.
    const tableExists = await DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='order_fee_breakdown'"
    ).first<{ name: string }>().catch(() => null)

    const resolverOn = c.env.FEE_RESOLVER_ENABLED === 'true'

    if (!tableExists) {
      return c.json({
        success: true,
        resolver_enabled: resolverOn,
        shadow_table_exists: false,
        rows: [],
        totals: emptyTotals(),
        note: resolverOn
          ? '리졸버는 켜졌으나 아직 그림자 기록이 없습니다(결제 발생 시 쌓입니다).'
          : 'FEE_RESOLVER_ENABLED 가 꺼져 있어 그림자 기록이 쌓이지 않습니다. 스테이징에서 켜고 결제를 발생시키세요.',
      })
    }

    // 그림자 기록 있는 주문 ← 현행 정산 4종을 order_id 로 조인(읽기 전용).
    //   cur_platform: 정산페이지와 동일 계산(COALESCE(o.commission_rate, s.commission_rate, 기본)).
    //   cur_agency/influencer/supply: cancelled/clawed_back 제외(실제 유효 적립분만).
    const rows = await DB.prepare(`
      SELECT
        b.order_id                                    AS order_id,
        o.order_number                                AS order_number,
        o.seller_id                                   AS seller_id,
        COALESCE(s.name, s.business_name, '')         AS seller_name,
        b.ownership                                   AS ownership,
        COALESCE(o.total_amount, b.amount)            AS order_total,
        b.created_at                                  AS created_at,
        b.platform                                    AS new_platform,
        b.agency                                      AS new_agency,
        b.platform_net                                AS new_platform_net,
        b.promo                                       AS new_promo,
        b.supply                                      AS new_supply,
        b.owner_net                                   AS new_owner_net,
        COALESCE(o.commission_rate, s.commission_rate, ${DEFAULT_COMMISSION_RATE}) AS cur_commission_rate,
        CAST(COALESCE(o.total_amount, b.amount) * COALESCE(o.commission_rate, s.commission_rate, ${DEFAULT_COMMISSION_RATE}) / 100 AS INTEGER) AS cur_platform,
        COALESCE((SELECT SUM(commission_amount) FROM agency_store_intro_commissions a
                   WHERE a.order_id = b.order_id AND COALESCE(a.status,'pending') <> 'cancelled'), 0) AS cur_agency,
        COALESCE((SELECT SUM(commission_amount) FROM influencer_attributions i
                   WHERE i.order_id = b.order_id AND i.source = 'store_intro'
                     AND COALESCE(i.status,'pending') IN ('pending','available','paid')), 0) AS cur_influencer,
        COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements ss
                   WHERE ss.order_id = b.order_id AND COALESCE(ss.source,'consumer') = 'consumer'
                     AND COALESCE(ss.status,'pending') IN ('pending','available','paid')), 0) AS cur_supply,
        COALESCE((SELECT SUM(commission) FROM affiliate_earnings af
                   WHERE af.order_id = b.order_id
                     AND COALESCE(af.status,'pending') IN ('pending','holding','granted')), 0) AS cur_affiliate
      FROM order_fee_breakdown b
      LEFT JOIN orders o ON o.id = b.order_id
      LEFT JOIN sellers s ON s.id = o.seller_id
      ORDER BY b.created_at DESC
      LIMIT ?
    `).bind(limit).all<CompareRow>().catch(() => ({ results: [] as CompareRow[] }))

    const list = (rows.results || []).map((r) => {
      const order_total = num(r.order_total)
      const cur_platform = num(r.cur_platform)
      const cur_agency = num(r.cur_agency)
      const cur_influencer = num(r.cur_influencer)
      const new_platform = num(r.new_platform)
      const new_agency = num(r.new_agency)
      // 플랫폼 순이익(영입 인센티브 지급 후) — 모델별 의미 차이 주석은 응답 note 참조.
      //   현행: 플랫폼이 셀러커미션을 받고, 거기서 에이전시(2%+₩30k)+영입자(1.5%)를 *별도 비용*으로 지급.
      //   새 규칙: 에이전시(1%)는 플랫폼 5% *안에서* 분배(platform_net = platform - agency). 영입자는
      //           새 모델에서 '주인 자율 promo'라 플랫폼 비용 아님 → platform_net 그대로.
      const cur_platform_net = cur_platform - cur_agency - cur_influencer
      const new_platform_net = num(r.new_platform_net)
      return {
        order_id: r.order_id,
        order_number: r.order_number || `#${r.order_id}`,
        seller_id: r.seller_id,
        seller_name: r.seller_name || (r.seller_id ? `셀러#${r.seller_id}` : '유어딜(1P)'),
        ownership: r.ownership,
        order_total,
        created_at: r.created_at,
        new_platform,
        new_agency,
        new_platform_net,
        new_promo: num(r.new_promo),
        new_supply: num(r.new_supply),
        new_owner_net: num(r.new_owner_net),
        cur_commission_rate: num(r.cur_commission_rate),
        cur_platform,
        cur_agency,
        cur_influencer,
        cur_supply: num(r.cur_supply),
        cur_affiliate: num(r.cur_affiliate),
        cur_platform_net,
        // 주문별 차이(새 − 현행). 양수 = 새 규칙이 더 많이 가져감/지급.
        delta_platform: new_platform - cur_platform,
        delta_agency: new_agency - cur_agency,
        delta_platform_net: new_platform_net - cur_platform_net,
      }
    })

    // 합계.
    const totals = list.reduce((acc, r) => {
      acc.order_count += 1
      acc.order_total += r.order_total
      acc.new_platform += r.new_platform
      acc.new_agency += r.new_agency
      acc.new_platform_net += r.new_platform_net
      acc.new_supply += r.new_supply
      acc.new_owner_net += r.new_owner_net
      acc.cur_platform += r.cur_platform
      acc.cur_agency += r.cur_agency
      acc.cur_influencer += r.cur_influencer
      acc.cur_supply += r.cur_supply
      acc.cur_affiliate += r.cur_affiliate
      acc.cur_platform_net += r.cur_platform_net
      return acc
    }, emptyTotals())
    totals.delta_platform = totals.new_platform - totals.cur_platform
    totals.delta_agency = totals.new_agency - totals.cur_agency
    totals.delta_platform_net = totals.new_platform_net - totals.cur_platform_net

    return c.json({
      success: true,
      resolver_enabled: resolverOn,
      shadow_table_exists: true,
      rows: list,
      totals,
      note: '읽기 전용 비교. 새 규칙은 그림자 기록(order_fee_breakdown), 현행은 실제 정산 테이블 라이브 조회. 영입자(인플) 인센티브는 현행=플랫폼 비용 / 새 모델=주인 자율 promo 라 platform_net 산식이 다름(주문별 cur_platform_net = 셀러커미션 − 에이전시 − 영입자). new_supply/new_promo 는 그림자 미모델링이라 0.',
    })
  } catch (err) {
    return safeError(c, err, '비교 데이터 조회 중 오류가 발생했습니다', '[fee-breakdown]')
  }
})

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function emptyTotals() {
  return {
    order_count: 0,
    order_total: 0,
    new_platform: 0,
    new_agency: 0,
    new_platform_net: 0,
    new_supply: 0,
    new_owner_net: 0,
    cur_platform: 0,
    cur_agency: 0,
    cur_influencer: 0,
    cur_supply: 0,
    cur_affiliate: 0,
    cur_platform_net: 0,
    delta_platform: 0,
    delta_agency: 0,
    delta_platform_net: 0,
  }
}

export default adminFeeBreakdownRoutes
