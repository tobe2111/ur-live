/**
 * 알림톡 자동 발송 라이브러리
 * 
 * 주문 생성, 배송 시작, 배송 완료 시 자동으로 알림톡을 발송합니다.
 * 
 * 사용 예시:
 * - 주문 생성 시: sendOrderConfirmation(env, orderId)
 * - 배송 시작 시: sendShippingNotification(env, orderId)
 * - 배송 완료 시: sendDeliveryCompleted(env, orderId)
 */

import { sendAlimtalk } from './aligo'

interface Env {
  DB: D1Database
  ALIGO_API_KEY: string
  ALIGO_USER_ID: string
  ALIMTALK_SENDER_KEY?: string
}

interface Order {
  id: number
  order_number: string
  user_id: number
  seller_id: number
  total_amount: number
  status: string
  created_at: string
  buyer_name: string
  buyer_phone: string
  buyer_email: string
  shipping_address: string
  shipping_name: string
  shipping_phone: string
}

interface Product {
  name: string
  price: number
  quantity: number
}

/**
 * 주문 정보 조회
 */
async function getOrderDetails(DB: D1Database, orderId: number) {
  const order = await DB.prepare(`
    SELECT 
      o.*,
      u.name as buyer_name,
      u.phone as buyer_phone,
      u.email as buyer_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).bind(orderId).first<Order>()

  if (!order) {
    throw new Error(`Order not found: ${orderId}`)
  }

  // 주문 상품 조회
  const items = await DB.prepare(`
    SELECT 
      p.name,
      oi.price,
      oi.quantity
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).bind(orderId).all()

  return {
    order,
    products: items.results as unknown as Product[]
  }
}

/**
 * 셀러의 알림톡 계정 정보 조회
 */
async function getSellerAlimtalkAccount(DB: D1Database, sellerId: number) {
  const account = await DB.prepare(`
    SELECT
      id,
      COALESCE(sender_key, kakao_channel_id) as sender_key,
      phone_number,
      balance
    FROM alimtalk_accounts
    WHERE seller_id = ? AND status = 'active'
  `).bind(sellerId).first()

  if (!account) {
    console.warn(`No active alimtalk account for seller ${sellerId}`)
    return null
  }

  return account as { id: number; sender_key: string; phone_number: string; balance: number }
}

/**
 * 알림톡 발송 기록 저장
 */
async function saveAlimtalkMessage(
  DB: D1Database,
  data: {
    account_id: number
    recipient_phone: string
    message_content: string
    cost: number
    status: string
    order_id?: number
  }
) {
  // template_id는 자동 발송이라 0 (미등록 템플릿)
  await DB.prepare(`
    INSERT INTO alimtalk_messages
    (account_id, template_id, recipient_phone, message_content, cost, status, order_id, sent_at, created_at)
    VALUES (?, 0, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(
    data.account_id,
    data.recipient_phone,
    data.message_content,
    data.cost,
    data.status,
    data.order_id || null
  ).run()
}

/**
 * 셀러 알림톡 잔액 차감
 */
async function deductBalance(DB: D1Database, sellerId: number, amount: number) {
  await DB.prepare(`
    UPDATE alimtalk_accounts
    SET balance = balance - ?, updated_at = datetime('now')
    WHERE seller_id = ? AND balance >= ?
  `).bind(amount, sellerId, amount).run()
}

/**
 * 1. 주문 확인 알림톡 발송
 * 
 * 주문이 생성되었을 때 고객에게 발송
 */
export async function sendOrderConfirmation(env: Env, orderId: number) {
  try {
    const { order, products } = await getOrderDetails(env.DB, orderId)
    const account = await getSellerAlimtalkAccount(env.DB, order.seller_id)

    // senderKey: 계정 발신키 → 환경변수 기본 발신키 순으로 사용
    const senderKey = account?.sender_key || env.ALIMTALK_SENDER_KEY
    if (!senderKey) {
      console.warn(`Skipping alimtalk for order ${orderId}: no sender key`)
      return { success: false, reason: 'no_sender_key' }
    }

    // 잔액 확인 (건당 15원 가정) - 계정이 있는 경우만
    const cost = 15
    if (account && account.balance < cost) {
      console.warn(`Skipping alimtalk for order ${orderId}: insufficient balance`)
      return { success: false, reason: 'insufficient_balance' }
    }

    // 상품 목록 생성
    const productList = products.map(p => 
      `${p.name} ${p.quantity}개 (${p.price.toLocaleString()}원)`
    ).join('\n')

    // 메시지 생성
    const message = `[주문 확인]

주문번호: ${order.order_number}
주문일시: ${new Date(order.created_at).toLocaleString('ko-KR')}

주문 상품:
${productList}

총 결제금액: ${order.total_amount.toLocaleString()}원

배송지: ${order.shipping_address}
수령인: ${order.shipping_name}
연락처: ${order.shipping_phone}

주문해 주셔서 감사합니다!`

    // 알리고 API로 발송
    const result = await sendAlimtalk(env, {
      senderKey,
      templateCode: 'order_confirm',
      to: order.buyer_phone,
      message: message
    })

    if (result.success) {
      // 잔액 차감 (계정이 있는 경우만)
      if (account) await deductBalance(env.DB, order.seller_id, cost)

      // 발송 기록 저장
      await saveAlimtalkMessage(env.DB, {
        account_id: account?.id ?? 0,
        recipient_phone: order.buyer_phone,
        message_content: message,
        cost: cost,
        status: 'sent',
        order_id: orderId
      })

      console.log(`Order confirmation sent for order ${orderId}`)
      return { success: true }
    } else {
      // 실패 기록
      await saveAlimtalkMessage(env.DB, {
        account_id: account?.id ?? 0,
        recipient_phone: order.buyer_phone,
        message_content: message,
        cost: 0,
        status: 'failed',
        order_id: orderId
      })

      console.error(`Failed to send order confirmation for order ${orderId}:`, result.error)
      return { success: false, error: result.error }
    }
  } catch (error) {
    console.error(`Error sending order confirmation for order ${orderId}:`, error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * 2. 배송 시작 알림톡 발송
 * 
 * 운송장 번호가 등록되었을 때 고객에게 발송
 */
export async function sendShippingNotification(
  env: Env, 
  orderId: number,
  carrier: string,
  trackingNumber: string
) {
  try {
    const { order } = await getOrderDetails(env.DB, orderId)
    const account = await getSellerAlimtalkAccount(env.DB, order.seller_id)

    const senderKey = account?.sender_key || env.ALIMTALK_SENDER_KEY
    if (!senderKey) return { success: false, reason: 'no_sender_key' }

    const cost = 15
    if (account && account.balance < cost) {
      return { success: false, reason: 'insufficient_balance' }
    }

    // 택배사별 조회 URL
    const trackingUrls: Record<string, string> = {
      'CJ대한통운': `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${trackingNumber}`,
      '우체국택배': `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${trackingNumber}`,
      '로젠택배': `https://www.ilogen.com/web/personal/trace/${trackingNumber}`,
      '한진택배': `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${trackingNumber}`
    }

    const trackingUrl = trackingUrls[carrier] || '#'

    const message = `[배송 시작]

주문번호: ${order.order_number}

배송이 시작되었습니다!

택배사: ${carrier}
운송장번호: ${trackingNumber}

배송조회: ${trackingUrl}

배송지: ${order.shipping_address}
수령인: ${order.shipping_name}

빠른 배송을 위해 최선을 다하겠습니다.`

    const result = await sendAlimtalk(env, {
      senderKey,
      templateCode: 'shipping_start',
      to: order.buyer_phone,
      message: message
    })

    if (result.success) {
      if (account) await deductBalance(env.DB, order.seller_id, cost)
      await saveAlimtalkMessage(env.DB, {
        account_id: account?.id ?? 0,
        recipient_phone: order.buyer_phone,
        message_content: message,
        cost: cost,
        status: 'sent',
        order_id: orderId
      })

      console.log(`Shipping notification sent for order ${orderId}`)
      return { success: true }
    } else {
      await saveAlimtalkMessage(env.DB, {
        account_id: account?.id ?? 0,
        recipient_phone: order.buyer_phone,
        message_content: message,
        cost: 0,
        status: 'failed',
        order_id: orderId
      })

      return { success: false, error: result.error }
    }
  } catch (error) {
    console.error(`Error sending shipping notification for order ${orderId}:`, error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * 3. 배송 완료 알림톡 발송
 * 
 * 배송이 완료되었을 때 고객에게 발송
 */
export async function sendDeliveryCompleted(env: Env, orderId: number) {
  try {
    const { order } = await getOrderDetails(env.DB, orderId)
    const account = await getSellerAlimtalkAccount(env.DB, order.seller_id)

    const senderKey = account?.sender_key || env.ALIMTALK_SENDER_KEY
    if (!senderKey) return { success: false, reason: 'no_sender_key' }

    const cost = 15
    if (account && account.balance < cost) {
      return { success: false, reason: 'insufficient_balance' }
    }

    const message = `[배송 완료]

주문번호: ${order.order_number}

상품이 배송 완료되었습니다!

배송지: ${order.shipping_address}
수령인: ${order.shipping_name}

구매해 주셔서 감사합니다.
만족스러운 쇼핑이셨기를 바랍니다.

리뷰를 남겨주시면 다음 쇼핑 시 혜택을 드립니다!`

    const result = await sendAlimtalk(env, {
      senderKey,
      templateCode: 'delivery_completed',
      to: order.buyer_phone,
      message: message
    })

    if (result.success) {
      if (account) await deductBalance(env.DB, order.seller_id, cost)
      await saveAlimtalkMessage(env.DB, {
        account_id: account?.id ?? 0,
        recipient_phone: order.buyer_phone,
        message_content: message,
        cost: cost,
        status: 'sent',
        order_id: orderId
      })

      console.log(`Delivery completion notification sent for order ${orderId}`)
      return { success: true }
    } else {
      await saveAlimtalkMessage(env.DB, {
        account_id: account?.id ?? 0,
        recipient_phone: order.buyer_phone,
        message_content: message,
        cost: 0,
        status: 'failed',
        order_id: orderId
      })

      return { success: false, error: result.error }
    }
  } catch (error) {
    console.error(`Error sending delivery completion for order ${orderId}:`, error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * 4. 재고 부족 알림 (셀러에게)
 * 
 * 상품 재고가 임계값 이하로 떨어졌을 때 셀러에게 발송
 */
export async function sendLowStockAlert(
  env: Env, 
  sellerId: number,
  productName: string,
  currentStock: number,
  threshold: number
) {
  try {
    const seller = await env.DB.prepare(`
      SELECT phone FROM sellers WHERE id = ?
    `).bind(sellerId).first<{ phone: string }>()

    if (!seller || !seller.phone) {
      return { success: false, reason: 'no_seller_phone' }
    }

    const account = await getSellerAlimtalkAccount(env.DB, sellerId)
    const senderKey = account?.sender_key || env.ALIMTALK_SENDER_KEY
    if (!senderKey) return { success: false, reason: 'no_sender_key' }

    const cost = 15
    if (account && account.balance < cost) {
      return { success: false, reason: 'insufficient_balance' }
    }

    const message = `[재고 부족 알림]

상품명: ${productName}
현재 재고: ${currentStock}개
권장 재고: ${threshold}개 이상

재고가 부족합니다.
빠른 시일 내에 재고를 보충해주세요.`

    const result = await sendAlimtalk(env, {
      senderKey,
      templateCode: 'low_stock_alert',
      to: seller.phone,
      message: message
    })

    if (result.success) {
      if (account) await deductBalance(env.DB, sellerId, cost)
      await saveAlimtalkMessage(env.DB, {
        account_id: account?.id ?? 0,
        recipient_phone: seller.phone,
        message_content: message,
        cost: cost,
        status: 'sent'
      })

      return { success: true }
    } else {
      return { success: false, error: result.error }
    }
  } catch (error) {
    console.error(`Error sending low stock alert:`, error)
    return { success: false, error: (error as Error).message }
  }
}
