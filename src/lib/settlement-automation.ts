/**
 * 정산 자동화 라이브러리
 * 
 * 기능:
 * - 자동 정산 계산
 * - 정산 보고서 생성
 * - 셀러별 수수료 정산
 * - 배송비 정산
 * - Cron Triggers 연동
 */

interface Env {
  DB: D1Database
}

interface SettlementPeriod {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
}

interface SellerSettlement {
  seller_id: number
  seller_name: string
  total_sales: number // 총 매출
  total_orders: number // 총 주문 건수
  platform_fee: number // 플랫폼 수수료
  shipping_fee: number // 배송비 수입
  refund_amount: number // 환불 금액
  settlement_amount: number // 정산 금액 (매출 - 수수료 - 환불)
  orders: SettlementOrder[]
}

interface SettlementOrder {
  order_id: number
  order_number: string
  order_date: string
  product_name: string
  quantity: number
  price: number
  shipping_fee: number
  platform_fee: number
  status: string
}

interface SettlementReport {
  period: SettlementPeriod
  generated_at: string
  total_sales: number
  total_platform_fee: number
  total_settlement: number
  sellers: SellerSettlement[]
}

/**
 * 플랫폼 수수료 계산 (기본 10%)
 */
function calculatePlatformFee(amount: number, feeRate: number = 0.10): number {
  return Math.floor(amount * feeRate)
}

/**
 * 정산 기간 생성 (이번 달)
 */
export function getCurrentSettlementPeriod(): SettlementPeriod {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  
  return {
    startDate: `${year}-${month}-01`,
    endDate: `${year}-${month}-${new Date(year, now.getMonth() + 1, 0).getDate()}`
  }
}

/**
 * 정산 기간 생성 (지난 달)
 */
export function getLastMonthSettlementPeriod(): SettlementPeriod {
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const year = lastMonth.getFullYear()
  const month = String(lastMonth.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(year, lastMonth.getMonth() + 1, 0).getDate()
  
  return {
    startDate: `${year}-${month}-01`,
    endDate: `${year}-${month}-${lastDay}`
  }
}

/**
 * 셀러별 정산 계산
 */
async function calculateSellerSettlement(
  DB: D1Database,
  sellerId: number,
  period: SettlementPeriod
): Promise<SellerSettlement | null> {
  try {
    // 셀러 정보 조회 (수수료율 포함)
    const seller = await DB.prepare(`
      SELECT id, business_name, COALESCE(commission_rate, 10) AS commission_rate FROM sellers WHERE id = ?
    `).bind(sellerId).first<{ id: number; business_name: string; commission_rate: number }>()

    if (!seller) {
      return null
    }

    // 정산 대상 주문 조회 (배송 완료 또는 구매 확정 주문만)
    const orders = await DB.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.created_at,
        o.total_amount,
        o.shipping_fee,
        o.status,
        GROUP_CONCAT(p.name, ', ') as product_names,
        SUM(oi.quantity) as total_quantity
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.seller_id = ?
        AND DATE(o.created_at) BETWEEN ? AND ?
        AND o.status IN ('delivered', 'confirmed')
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `).bind(sellerId, period.startDate, period.endDate).all()

    if (!orders.results || orders.results.length === 0) {
      return {
        seller_id: sellerId,
        seller_name: seller.business_name,
        total_sales: 0,
        total_orders: 0,
        platform_fee: 0,
        shipping_fee: 0,
        refund_amount: 0,
        settlement_amount: 0,
        orders: []
      }
    }

    // 주문별 정산 계산
    const settlementOrders: SettlementOrder[] = []
    let totalSales = 0
    let totalShippingFee = 0
    let totalPlatformFee = 0

    for (const order of orders.results as any[]) {
      const orderAmount = order.total_amount - order.shipping_fee // 상품 금액만
      const platformFee = calculatePlatformFee(orderAmount, seller.commission_rate / 100)

      settlementOrders.push({
        order_id: order.id,
        order_number: order.order_number,
        order_date: order.created_at,
        product_name: order.product_names || '',
        quantity: order.total_quantity || 1,
        price: orderAmount,
        shipping_fee: order.shipping_fee || 0,
        platform_fee: platformFee,
        status: order.status
      })

      totalSales += orderAmount
      totalShippingFee += order.shipping_fee || 0
      totalPlatformFee += platformFee
    }

    // 환불 금액 조회
    const refunds = await DB.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as refund_amount
      FROM orders
      WHERE seller_id = ?
        AND DATE(created_at) BETWEEN ? AND ?
        AND status = 'refunded'
    `).bind(sellerId, period.startDate, period.endDate).first<{ refund_amount: number }>()

    const refundAmount = refunds?.refund_amount || 0

    // 정산 금액 = 매출 - 수수료 - 환불 + 배송비
    const settlementAmount = totalSales - totalPlatformFee - refundAmount + totalShippingFee

    return {
      seller_id: sellerId,
      seller_name: seller.business_name,
      total_sales: totalSales,
      total_orders: settlementOrders.length,
      platform_fee: totalPlatformFee,
      shipping_fee: totalShippingFee,
      refund_amount: refundAmount,
      settlement_amount: settlementAmount,
      orders: settlementOrders
    }
  } catch (error) {
    console.error(`Failed to calculate settlement for seller ${sellerId}:`, error)
    return null
  }
}

/**
 * 전체 정산 보고서 생성
 */
export async function generateSettlementReport(
  DB: D1Database,
  period: SettlementPeriod
): Promise<SettlementReport> {
  console.log(`[Settlement] Generating report for ${period.startDate} ~ ${period.endDate}`)

  // 정산 대상 셀러 목록 조회
  const sellers = await DB.prepare(`
    SELECT DISTINCT s.id
    FROM sellers s
    JOIN orders o ON s.id = o.seller_id
    WHERE DATE(o.created_at) BETWEEN ? AND ?
      AND o.status IN ('delivered', 'confirmed', 'refunded')
  `).bind(period.startDate, period.endDate).all()

  // 셀러별 정산 계산
  const sellerSettlements: SellerSettlement[] = []
  let totalSales = 0
  let totalPlatformFee = 0
  let totalSettlement = 0

  for (const seller of (sellers.results as any[])) {
    const settlement = await calculateSellerSettlement(DB, seller.id, period)
    
    if (settlement) {
      sellerSettlements.push(settlement)
      totalSales += settlement.total_sales
      totalPlatformFee += settlement.platform_fee
      totalSettlement += settlement.settlement_amount
    }
  }

  const report: SettlementReport = {
    period,
    generated_at: new Date().toISOString(),
    total_sales: totalSales,
    total_platform_fee: totalPlatformFee,
    total_settlement: totalSettlement,
    sellers: sellerSettlements
  }

  console.log(`[Settlement] Report generated: ${sellerSettlements.length} sellers, ${totalSales.toLocaleString()}원`)

  return report
}

/**
 * 정산 보고서 저장
 */
export async function saveSettlementReport(
  DB: D1Database,
  report: SettlementReport
): Promise<void> {
  // 정산 마스터 저장
  const result = await DB.prepare(`
    INSERT INTO settlements 
    (period_start, period_end, total_sales, total_platform_fee, total_settlement, generated_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).bind(
    report.period.startDate,
    report.period.endDate,
    report.total_sales,
    report.total_platform_fee,
    report.total_settlement,
    report.generated_at
  ).run()

  const settlementId = result.meta.last_row_id

  // 셀러별 정산 세부 저장
  for (const seller of report.sellers) {
    await DB.prepare(`
      INSERT INTO settlement_details 
      (settlement_id, seller_id, total_sales, total_orders, platform_fee, shipping_fee, refund_amount, settlement_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      settlementId,
      seller.seller_id,
      seller.total_sales,
      seller.total_orders,
      seller.platform_fee,
      seller.shipping_fee,
      seller.refund_amount,
      seller.settlement_amount
    ).run()
  }

  console.log(`[Settlement] Report saved: ID ${settlementId}`)
}

/**
 * 정산 보고서 조회
 */
export async function getSettlementReport(
  DB: D1Database,
  settlementId: number
): Promise<SettlementReport | null> {
  const settlement = await DB.prepare(`
    SELECT * FROM settlements WHERE id = ?
  `).bind(settlementId).first<any>()

  if (!settlement) {
    return null
  }

  const details = await DB.prepare(`
    SELECT 
      sd.*,
      s.business_name as seller_name
    FROM settlement_details sd
    JOIN sellers s ON sd.seller_id = s.id
    WHERE sd.settlement_id = ?
  `).bind(settlementId).all()

  const sellers: SellerSettlement[] = (details.results as any[]).map(d => ({
    seller_id: d.seller_id,
    seller_name: d.seller_name,
    total_sales: d.total_sales,
    total_orders: d.total_orders,
    platform_fee: d.platform_fee,
    shipping_fee: d.shipping_fee,
    refund_amount: d.refund_amount,
    settlement_amount: d.settlement_amount,
    orders: []
  }))

  return {
    period: {
      startDate: settlement.period_start,
      endDate: settlement.period_end
    },
    generated_at: settlement.generated_at,
    total_sales: settlement.total_sales,
    total_platform_fee: settlement.total_platform_fee,
    total_settlement: settlement.total_settlement,
    sellers
  }
}

/**
 * Cron Trigger: 매월 1일 자동 정산
 */
export async function runMonthlySettlement(env: Env): Promise<void> {
  try {
    console.log('[Settlement Cron] Starting monthly settlement...')

    // 지난 달 정산
    const period = getLastMonthSettlementPeriod()
    
    // 정산 보고서 생성
    const report = await generateSettlementReport(env.DB, period)
    
    // 저장
    await saveSettlementReport(env.DB, report)

    console.log('[Settlement Cron] Monthly settlement completed successfully')
  } catch (error) {
    console.error('[Settlement Cron] Failed:', error)
    throw error
  }
}
