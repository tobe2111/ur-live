// Cloudflare Worker용 Discord 알림 유틸리티
/**
 * Discord Webhook으로 알림 전송
 */
export async function sendDiscordAlert(webhookUrl, alert) {
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
        };
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                embeds: [embed],
            }),
        });
        if (!response.ok) {
            console.error('❌ Discord 알림 전송 실패:', response.statusText);
        }
        else {
            console.log('✅ Discord 알림 전송 성공');
        }
    }
    catch (error) {
        console.error('❌ Discord 알림 전송 오류:', error);
    }
}
/**
 * 크리티컬 에러 알림
 */
export async function alertCriticalError(webhookUrl, error, context) {
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
    });
}
/**
 * 결제 실패 알림
 */
export async function alertPaymentFailure(webhookUrl, orderId, amount, reason) {
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
    });
}
/**
 * 재고 부족 알림
 */
export async function alertLowStock(webhookUrl, productId, productName, currentStock) {
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
    });
}
/**
 * 시스템 상태 알림
 */
export async function alertSystemStatus(webhookUrl, status, message) {
    const colors = {
        healthy: 0x00ff00, // 녹색
        degraded: 0xffff00, // 노란색
        down: 0xff0000, // 빨간색
    };
    const emojis = {
        healthy: '✅',
        degraded: '⚠️',
        down: '🔴',
    };
    await sendDiscordAlert(webhookUrl, {
        title: `${emojis[status]} 시스템 상태: ${status.toUpperCase()}`,
        description: message,
        color: colors[status],
    });
}
