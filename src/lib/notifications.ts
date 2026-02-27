/**
 * Notification Helper Functions
 * 
 * Centralized notification creation for consistent behavior across the app
 */

export interface CreateNotificationParams {
  userId: number
  type: string
  title: string
  message: string
  linkUrl?: string
}

/**
 * Create a notification in the database
 */
export async function createNotification(
  db: D1Database,
  params: CreateNotificationParams
): Promise<{ success: boolean; error?: string; id?: number }> {
  const { userId, type, title, message, linkUrl } = params
  
  try {
    const result = await db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link_url, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(userId, type, title, message, linkUrl || null).run()
    
    console.log(`[Notification] Created for user ${userId}: ${type} - ${title}`)
    
    return {
      success: true,
      id: result.meta.last_row_id as number
    }
  } catch (error) {
    console.error('[Notification] Failed to create:', error)
    return {
      success: false,
      error: (error as Error).message
    }
  }
}

/**
 * Notification Types & Templates
 */
export const NotificationTemplates = {
  // Seller notifications
  seller_approved: (sellerName: string) => ({
    title: '🎉 판매자 승인 완료',
    message: `${sellerName}님, 축하합니다! 리스터코퍼레이션 판매자로 승인되었습니다.`,
    linkUrl: '/seller'
  }),
  
  seller_rejected: (reason: string) => ({
    title: '판매자 승인 거부',
    message: `죄송합니다. 판매자 승인이 거부되었습니다. 사유: ${reason}`,
    linkUrl: '/seller/register'
  }),
  
  // Order notifications
  order_complete: (orderNumber: string) => ({
    title: '주문 완료',
    message: `주문번호 ${orderNumber}의 주문이 접수되었습니다.`,
    linkUrl: `/orders/${orderNumber}`
  }),
  
  order_shipped: (orderNumber: string) => ({
    title: '배송 시작',
    message: `주문번호 ${orderNumber}의 상품이 배송 시작되었습니다.`,
    linkUrl: `/orders/${orderNumber}`
  }),
  
  order_delivered: (orderNumber: string) => ({
    title: '배송 완료',
    message: `주문번호 ${orderNumber}의 상품이 배송 완료되었습니다.`,
    linkUrl: `/orders/${orderNumber}`
  }),
  
  // Refund notifications
  refund_requested: (orderNumber: string) => ({
    title: '환불 요청 접수',
    message: `주문번호 ${orderNumber}의 환불이 접수되었습니다.`,
    linkUrl: `/orders/${orderNumber}`
  }),
  
  refund_complete: (orderNumber: string, amount: number) => ({
    title: '환불 완료',
    message: `주문번호 ${orderNumber}의 환불(₩${amount.toLocaleString()})이 완료되었습니다.`,
    linkUrl: `/orders/${orderNumber}`
  }),
  
  // Product notifications (for sellers)
  product_low_stock: (productName: string, stock: number) => ({
    title: '⚠️ 재고 부족 알림',
    message: `${productName}의 재고가 ${stock}개 남았습니다.`,
    linkUrl: '/seller/products'
  }),
  
  product_sold_out: (productName: string) => ({
    title: '❌ 품절 알림',
    message: `${productName}이(가) 품절되었습니다.`,
    linkUrl: '/seller/products'
  })
}
