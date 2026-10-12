/**
 * 🏢 에이전시 콘솔 — 맡은 매장의 **오늘 숫자** (2026-10-12, 셀러 대시보드 제거 2단계 · 대표 확정 안 A)
 *   대표: *"A안으로 해줘. 이건 PC버전도 중요해"*
 *
 * 콘솔이 마이와 같은 판(오늘 · 사용처리 · 이용권 · 주문 · 정산 · 전체 도구)을 그린다. 그 판 머리의
 * 숫자를 **좌석 없이** 보여 주려고 목록 응답에 같이 싣는다 — 좌석은 사람이 도구를 누를 때만 받는다
 * (마이와 같은 규칙: 화면을 여는 것만으로 토큰을 발급하지 않는다).
 *
 * ## 🔴 규칙은 마이와 **같아야** 한다
 * 판정은 `seller-operators.routes.ts` `/my-stores/summary` 와 같은 세 문장이다 —
 * 오늘 = PAID/DONE · `DATE(created_at,'+9 hours')` · 처리 대기 = 배송 주문(`shippingOrderSql`) 최근 30일 ·
 * 판매 중 = `is_active = 1` + 삭제 제외. 같은 매장을 사장님은 마이에서, 에이전시는 콘솔에서 본다 —
 * 둘이 다른 숫자를 말하면 에러 없이 서로를 의심하게 된다. 시험이 두 파일의 문장을 대조한다.
 *
 * 💰 읽기 전용 집계다. 권한은 호출부가 이미 판정한 매장 id 집합(우리 에이전시 · 직원 배정) 안에서만 센다.
 */
import { shippingOrderSql } from '@/shared/db/shipping-order-sql'

export interface StoreToday {
  todayRevenue: number
  todayOrders: number
  pending: number
  activeProducts: number
}

/** 한 번에 세는 매장 수 상한 — D1 바인딩 한도(100) 안에서 넉넉히. 목록은 이미 200 으로 잘린다. */
export const TODAY_STATS_MAX_STORES = 60

export async function agencyStoreToday(DB: D1Database, sellerIds: number[]): Promise<Map<number, StoreToday>> {
  const ids = [...new Set(sellerIds.filter((n) => Number.isInteger(n) && n > 0))].slice(0, TODAY_STATS_MAX_STORES)
  const out = new Map<number, StoreToday>()
  if (ids.length === 0) return out
  const marks = ids.map(() => '?').join(',')
  const todayKst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  type N = { seller_id: number; n: number }
  const empty = { results: [] as never[] }
  const [today, pending, active] = await Promise.all([
    DB.prepare(
      `SELECT seller_id, COUNT(*) AS n, COALESCE(SUM(total_amount), 0) AS rev
         FROM orders
        WHERE seller_id IN (${marks}) AND status IN ('PAID','DONE') AND DATE(created_at, '+9 hours') = ?
        GROUP BY seller_id`,
    ).bind(...ids, todayKst).all<N & { rev: number }>().catch(() => empty),
    DB.prepare(
      `SELECT o.seller_id, COUNT(*) AS n
         FROM orders o
        WHERE o.seller_id IN (${marks}) AND o.status IN ('PAID','DONE','PAY_COMPLETE') AND o.created_at >= datetime('now', '-30 days')
          AND ${shippingOrderSql('o')}
        GROUP BY o.seller_id`,
    ).bind(...ids).all<N>().catch(() => empty),
    DB.prepare(
      `SELECT seller_id, COUNT(*) AS n
         FROM products
        WHERE seller_id IN (${marks}) AND is_active = 1 AND COALESCE(status, '') != 'DELETED'
        GROUP BY seller_id`,
    ).bind(...ids).all<N>().catch(() => empty),
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
