/**
 * 🏢 에이전시 콘솔 — 맡은 매장의 **오늘 숫자** (2026-10-12, 셀러 대시보드 제거 2단계 · 대표 확정 안 A)
 *   대표: *"A안으로 해줘. 이건 PC버전도 중요해"*
 *
 * 콘솔이 마이와 같은 판(오늘 · 사용처리 · 이용권 · 주문 · 정산 · 전체 도구)을 그린다. 그 판 머리의
 * 숫자를 **좌석 없이** 보여 주려고 목록 응답에 같이 싣는다 — 좌석은 사람이 도구를 누를 때만 받는다
 * (마이와 같은 규칙: 화면을 여는 것만으로 토큰을 발급하지 않는다).
 *
 * ## 🔴 규칙은 마이와 **같아야** 한다 — 단, 2026-10-24 부터 **이 에이전시 이용권만** 센다(아래 함수 주석)
 * 판정은 `seller-operators.routes.ts` `/my-stores/summary` 와 같은 세 문장이다 —
 * 오늘 = PAID/DONE · `DATE(created_at,'+9 hours')` · 처리 대기 = 배송 주문(`shippingOrderSql`) 최근 30일 ·
 * 판매 중 = `is_active = 1` + 삭제 제외. 같은 매장을 사장님은 마이에서, 에이전시는 콘솔에서 본다 —
 * 둘이 다른 숫자를 말하면 에러 없이 서로를 의심하게 된다. 시험이 두 파일의 문장을 대조한다.
 *
 * 💰 읽기 전용 집계다. 권한은 호출부가 이미 판정한 매장 id 집합(우리 에이전시 · 직원 배정) 안에서만 센다.
 */
import { shippingOrderSql } from '@/shared/db/shipping-order-sql'
import { periodMatchSql } from './channel-sales'
import { ensureAgencyConsoleTables } from './agency-schema'

export interface StoreToday {
  todayRevenue: number
  todayOrders: number
  pending: number
  activeProducts: number
}

/** 한 번에 세는 매장 수 상한 — D1 바인딩 한도(100) 안에서 넉넉히. 목록은 이미 200 으로 잘린다. */
export const TODAY_STATS_MAX_STORES = 60

export async function agencyStoreToday(DB: D1Database, sellerIds: number[], agencyId: number): Promise<Map<number, StoreToday>> {
  const ids = [...new Set(sellerIds.filter((n) => Number.isInteger(n) && n > 0))].slice(0, TODAY_STATS_MAX_STORES)
  const out = new Map<number, StoreToday>()
  if (ids.length === 0 || !(Number.isInteger(agencyId) && agencyId > 0)) return out
  const marks = ids.map(() => '?').join(',')
  const todayKst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  type N = { seller_id: number; n: number }
  const empty = { results: [] as never[] }
  // 🤝 2026-10-24 — **이 에이전시가 맡은 이용권만** 센다(대표 확정: 한 매장 · 여러 에이전시 · 성과는 이용권 단위).
  //   매장 전체 숫자를 주면 같은 매장의 다른 에이전시·사장님 매출이 보인다. 판정 문장(상태·KST 날짜·배송 판정·
  //   판매 중)은 마이와 같고, 거기에 `agency_products` 조인 하나가 더해질 뿐이다. 매출은 주문 총액이 아니라
  //   **그 이용권 줄의 금액**이다(한 주문에 남의 상품이 섞여도 자기 몫만).
  //   📊 귀속은 **맡은 기간**으로 판정한다(`channel-sales.ts` `periodMatchSql` — 사장님 성과표와 같은 문장).
  const mine = `JOIN agency_product_periods pr ON ${periodMatchSql('pr', 'oi.product_id', 'o.seller_id')} AND pr.agency_id = ?`
  const [today, pending, active] = await Promise.all([
    DB.prepare(
      `SELECT o.seller_id, COUNT(DISTINCT o.id) AS n,
              COALESCE(SUM(COALESCE(NULLIF(oi.subtotal, 0), oi.price * oi.quantity)), 0) AS rev
         FROM orders o JOIN order_items oi ON oi.order_id = o.id ${mine}
        WHERE o.seller_id IN (${marks}) AND o.status IN ('PAID','DONE') AND DATE(o.created_at, '+9 hours') = ?
        GROUP BY o.seller_id`,
    ).bind(agencyId, ...ids, todayKst).all<N & { rev: number }>().catch(() => empty),
    DB.prepare(
      `SELECT o.seller_id, COUNT(DISTINCT o.id) AS n
         FROM orders o JOIN order_items oi ON oi.order_id = o.id ${mine}
        WHERE o.seller_id IN (${marks}) AND o.status IN ('PAID','DONE','PAY_COMPLETE') AND o.created_at >= datetime('now', '-30 days')
          AND ${shippingOrderSql('o')}
        GROUP BY o.seller_id`,
    ).bind(agencyId, ...ids).all<N>().catch(() => empty),
    DB.prepare(
      `SELECT p.seller_id, COUNT(*) AS n
         FROM products p JOIN agency_products ap ON ap.product_id = p.id AND ap.agency_id = ? AND ap.seller_id = p.seller_id
        WHERE p.seller_id IN (${marks}) AND p.is_active = 1 AND COALESCE(p.status, '') != 'DELETED'
        GROUP BY p.seller_id`,
    ).bind(agencyId, ...ids).all<N>().catch(() => empty),
  ])
  const t = new Map((today.results || []).map((r) => [Number(r.seller_id), r]))
  const p = new Map((pending.results || []).map((r) => [Number(r.seller_id), Number(r.n) || 0]))
  const a = new Map((active.results || []).map((r) => [Number(r.seller_id), Number(r.n) || 0]))
  for (const id of ids) {
    const row = t.get(id)
    out.set(id, {
      todayRevenue: Number(row?.rev) || 0,
      todayOrders: Number(row?.n) || 0,
      pending: p.get(id) || 0,
      activeProducts: a.get(id) || 0,
    })
  }
  return out
}

/**
 * 🤝 마이·콘솔의 매장 요약(`/my-stores/summary`)을 **에이전시 좌석**이 부를 때의 응답 — 그 에이전시 이용권 숫자만.
 * 응답 모양은 사람 기준 요약과 같다(화면이 하나의 모양만 읽게). 매장 전체 숫자는 여기서 절대 나가지 않는다.
 */
export async function agencySummary(
  DB: D1Database,
  stores: { seller_id: number; business_name?: string | null; name?: string | null; status?: string | null; role: string }[],
  agencyId: number,
  currentSellerId: number | null,
) {
  await ensureAgencyConsoleTables(DB) // 맡은 기간 표가 없으면 아래 집계가 조용히 0 이 된다
  const t = await agencyStoreToday(DB, stores.map((s) => s.seller_id), agencyId)
  const rows = stores.map((s) => {
    const x = t.get(s.seller_id)
    return {
      seller_id: s.seller_id,
      name: s.business_name || s.name || `매장 #${s.seller_id}`,
      role: s.role,
      status: s.status || null,
      cert_status: null,
      today_revenue: x?.todayRevenue || 0,
      today_orders: x?.todayOrders || 0,
      pending: x?.pending || 0,
      active_products: x?.activeProducts || 0,
    }
  })
  const totals = rows.reduce((a, r) => ({ today_revenue: a.today_revenue + r.today_revenue, today_orders: a.today_orders + r.today_orders, pending: a.pending + r.pending }), { today_revenue: 0, today_orders: 0, pending: 0 })
  return { stores: rows, totals, current_seller_id: currentSellerId }
}
