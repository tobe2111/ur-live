// Cloudflare Worker용 Discord 알림 유틸리티
import { logError } from './logger'

export interface DiscordAlert {
  title: string
  description: string
  color?: number
  fields?: Array<{
    name: string
    value: string
    inline?: boolean
  }>
  timestamp?: string
}

/**
 * Discord Webhook으로 알림 전송
 */
export async function sendDiscordAlert(
  webhookUrl: string,
  alert: DiscordAlert
): Promise<void> {
  try {
    const embed = {
      title: alert.title,
      description: alert.description,
      color: alert.color || 0xff0000, // 기본: 빨간색
      fields: alert.fields || [],
      timestamp: alert.timestamp || new Date().toISOString(),
      footer: {
        text: 'UR Live 모니터링',
      },
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    })

    if (!response.ok) {
      logError('discord.alert.send_failed', { error: response.statusText })
    } else {
      // Discord notification sent successfully
    }
  } catch (error) {
    logError('discord.alert.send_error', { error: (error as Error)?.message })
  }
}

/**
 * 크리티컬 에러 알림
 */
export async function alertCriticalError(
  webhookUrl: string,
  error: Error,
  context: {
    userId?: string
    url?: string
    userAgent?: string
  }
): Promise<void> {
  await sendDiscordAlert(webhookUrl, {
    title: '🚨 크리티컬 에러 발생',
    description: error.message,
    color: 0xff0000, // 빨간색
    fields: [
      {
        name: 'Error Type',
        value: error.name,
        inline: true,
      },
      {
        name: 'User ID',
        value: context.userId || 'Anonymous',
        inline: true,
      },
      {
        name: 'URL',
        value: context.url || 'Unknown',
        inline: false,
      },
      {
        name: 'User Agent',
        value: context.userAgent || 'Unknown',
        inline: false,
      },
      {
        name: 'Stack Trace',
        value: error.stack?.substring(0, 500) || 'No stack trace',
        inline: false,
      },
    ],
  })
}

/**
 * 결제 실패 알림
 */
export async function alertPaymentFailure(
  webhookUrl: string,
  orderId: string,
  amount: number,
  reason: string
): Promise<void> {
  await sendDiscordAlert(webhookUrl, {
    title: '💳 결제 실패',
    description: `주문 ${orderId}의 결제가 실패했습니다.`,
    color: 0xffa500, // 주황색
    fields: [
      {
        name: 'Order ID',
        value: orderId,
        inline: true,
      },
      {
        name: 'Amount',
        value: `${amount.toLocaleString()}원`,
        inline: true,
      },
      {
        name: 'Reason',
        value: reason,
        inline: false,
      },
    ],
  })
}

/**
 * 재고 부족 알림
 */
export async function alertLowStock(
  webhookUrl: string,
  productId: string,
  productName: string,
  currentStock: number
): Promise<void> {
  await sendDiscordAlert(webhookUrl, {
    title: '📦 재고 부족 경고',
    description: `상품 "${productName}"의 재고가 부족합니다.`,
    color: 0xffff00, // 노란색
    fields: [
      {
        name: 'Product ID',
        value: productId,
        inline: true,
      },
      {
        name: 'Current Stock',
        value: `${currentStock}개`,
        inline: true,
      },
    ],
  })
}

/**
 * 시스템 상태 알림
 */
export async function alertSystemStatus(
  webhookUrl: string,
  status: 'healthy' | 'degraded' | 'down',
  message: string
): Promise<void> {
  const colors = {
    healthy: 0x00ff00,   // 녹색
    degraded: 0xffff00,  // 노란색
    down: 0xff0000,      // 빨간색
  }

  const emojis = {
    healthy: '✅',
    degraded: '⚠️',
    down: '🔴',
  }

  await sendDiscordAlert(webhookUrl, {
    title: `${emojis[status]} 시스템 상태: ${status.toUpperCase()}`,
    description: message,
    color: colors[status],
  })
}
