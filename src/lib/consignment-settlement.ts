/**
 * 🛡️ 2026-04-28: MD 위탁 판매 정산 헬퍼.
 *
 * 셀러 정산 계산 시 호출 (settlement-automation 의 calculateSellerSettlement 보강용).
 * order_items.consignment_id 가 있는 주문건은 host/owner 분배 필요.
 *
 * MVP: 별도 함수 — 기존 정산 흐름은 변경 없이, 어드민/통계 페이지에서 조회 가능.
 * 정식 자동 분배는 후속 PR (settlement-automation 호출부 변경 + consignment_settlements 기록).
 */
import { calcConsignmentSplit } from './consignment-split'

export interface ConsignmentSettlementItem {
  order_id: number
  order_item_id: number
  product_id: number
  product_name: string
  total_amount: number
  host_amount: number
  owner_amount: number
  platform_amount: number
  rate_snapshot: number
  partnership_id: number
  counterparty_seller_id: number
  counterparty_seller_name: string | null
  created_at: string
}

export interface ConsignmentSettlementResult {
  as_host: ConsignmentSettlementItem[]   // 내가 host (받은 상품 팔아서 수수료 받음)
  as_owner: ConsignmentSettlementItem[]  // 내가 owner (내 상품 빌려줘서 매출의 일부)
  host_total: number                      // 받을 총합
  owner_total: number                     // 받을 총합 (내 매출 분)
  platform_total: number
}

interface RawRow {
  order_id: number
  order_item_id: number
  product_id: number
  product_name: string
  unit_price: number
  quantity: number
  total_amount: number
  partnership_id: number
  host_seller_id: number
  owner_seller_id: number
  host_commission_rate: number
  host_seller_name: string | null
  owner_seller_name: string | null
  created_at: string
}

const PLATFORM_RATE = 10

export async function getConsignmentSettlementsForSeller(
  db: D1Database,
  sellerId: number,
  periodFrom: string,
  periodTo: string,
): Promise<ConsignmentSettlementResult> {
  const empty: ConsignmentSettlementResult = {
    as_host: [], as_owner: [], host_total: 0, owner_total: 0, platform_total: 0,
  }

  let rows: RawRow[] = []
  try {
    const { results } = await db.prepare(`
      SELECT
        oi.order_id,
        oi.id as order_item_id,
        oi.product_id,
        oi.product_name,
        oi.price as unit_price,
        oi.quantity,
        (oi.price * oi.quantity) as total_amount,
        cp.id as partnership_id,
        cp.host_seller_id,
        cp.owner_seller_id,
        cp.host_commission_rate,
        hs.name as host_seller_name,
        os.name as owner_seller_name,
        o.created_at
      FROM order_items oi
      INNER JOIN consignment_partnerships cp ON cp.id = oi.consignment_id
      INNER JOIN orders o ON o.id = oi.order_id
      LEFT JOIN sellers hs ON hs.id = cp.host_seller_id
      LEFT JOIN sellers os ON os.id = cp.owner_seller_id
      WHERE (cp.host_seller_id = ? OR cp.owner_seller_id = ?)
        AND o.status IN ('PAID', 'DONE', 'PREPARING', 'SHIPPING', 'DELIVERED')
        AND o.created_at >= ? AND o.created_at <= ?
      ORDER BY o.created_at DESC
    `).bind(sellerId, sellerId, periodFrom, periodTo).all<RawRow>()
    rows = results ?? []
  } catch {
    // 테이블 미존재 또는 쿼리 실패 → 빈 결과 (기존 정산은 영향 없음)
    return empty
  }

  const result: ConsignmentSettlementResult = { ...empty }

  for (const row of rows) {
    const split = calcConsignmentSplit({
      total_amount: row.total_amount,
      host_rate: row.host_commission_rate,
      platform_rate: PLATFORM_RATE,
    })

    const item: ConsignmentSettlementItem = {
      order_id: row.order_id,
      order_item_id: row.order_item_id,
      product_id: row.product_id,
      product_name: row.product_name,
      total_amount: split.total_amount,
      host_amount: split.host_amount,
      owner_amount: split.owner_amount,
      platform_amount: split.platform_amount,
      rate_snapshot: split.rate_snapshot,
      partnership_id: row.partnership_id,
      counterparty_seller_id: row.host_seller_id === sellerId ? row.owner_seller_id : row.host_seller_id,
      counterparty_seller_name: row.host_seller_id === sellerId ? row.owner_seller_name : row.host_seller_name,
      created_at: row.created_at,
    }

    if (row.host_seller_id === sellerId) {
      result.as_host.push(item)
      result.host_total += item.host_amount
    } else if (row.owner_seller_id === sellerId) {
      result.as_owner.push(item)
      result.owner_total += item.owner_amount
    }
    result.platform_total += item.platform_amount
  }

  return result
}
