/**
 * Discord Webhook Error Monitoring
 * 
 * 무료 에러 모니터링 시스템 (Sentry 대체)
 * Discord Webhook을 통해 실시간 에러 알림 전송
 * 
 * 설정: DISCORD_WEBHOOK_URL 환경변수 필요
 * 비용: $0 (Discord 무료)
 */

interface RequestContext {
  method?: string;
  path?: string;
  userId?: string | number;
  userType?: string;
  ip?: string;
  userAgent?: string;
}

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp: string;
  footer?: {
    text: string;
  };
}

/**
 * Discord Webhook으로 에러 알림 전송
 */
export async function sendDiscordAlert(
  webhookUrl: string,
  error: Error,
  context?: RequestContext
): Promise<void> {
  if (!webhookUrl) {
    // Webhook URL not configured
    return;
  }

  try {
    const embed: DiscordEmbed = {
      title: '🚨 서버 에러 발생',
      description: `\`\`\`\n${error.message || 'Unknown error'}\n\`\`\``,
      color: 15158332, // 빨간색
      fields: [],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'UR LIVE Error Monitor'
      }
    };

    // 에러 타입 추가
    if (error.name) {
      embed.fields.push({
        name: '에러 타입',
        value: error.name,
        inline: true
      });
    }

    // 요청 컨텍스트 추가
    if (context?.method && context?.path) {
      embed.fields.push({
        name: '요청',
        value: `${context.method} ${context.path}`,
        inline: false
      });
    }

    // 사용자 정보 추가
    if (context?.userId) {
      embed.fields.push({
        name: '사용자',
        value: `ID: ${context.userId} (${context.userType || 'unknown'})`,
        inline: true
      });
    }

    // IP 추가
    if (context?.ip) {
      embed.fields.push({
        name: 'IP',
        value: context.ip,
        inline: true
      });
    }

    // 스택 트레이스 추가 (최대 1000자)
    if (error.stack) {
      const stackTrace = error.stack.slice(0, 1000);
      embed.fields.push({
        name: '스택 트레이스',
        value: `\`\`\`\n${stackTrace}\n\`\`\``,
        inline: false
      });
    }

    // Discord Webhook 요청
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
      console.error('[Discord] Webhook failed:', response.status, await response.text());
    } else {
      // Error alert sent
    }
  } catch (webhookError) {
    // Webhook 실패는 조용히 로깅만
    console.error('[Discord] Failed to send alert:', webhookError);
  }
}

/**
 * Discord Webhook으로 성공 알림 전송 (선택적)
 */
export async function sendDiscordSuccess(
  webhookUrl: string,
  title: string,
  message: string,
  context?: Record<string, any>
): Promise<void> {
  if (!webhookUrl) {
    return;
  }

  try {
    const embed: DiscordEmbed = {
      title: `✅ ${title}`,
      description: message,
      color: 3066993, // 초록색
      fields: [],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'UR LIVE Monitor'
      }
    };

    // 컨텍스트 정보 추가
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        embed.fields.push({
          name: key,
          value: String(value),
          inline: true
        });
      }
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });
  } catch (error) {
    console.error('[Discord] Failed to send success alert:', error);
  }
}

/**
 * Discord Webhook으로 경고 알림 전송
 */
export async function sendDiscordWarning(
  webhookUrl: string,
  title: string,
  message: string,
  context?: Record<string, any>
): Promise<void> {
  if (!webhookUrl) {
    return;
  }

  try {
    const embed: DiscordEmbed = {
      title: `⚠️ ${title}`,
      description: message,
      color: 16776960, // 노란색
      fields: [],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'UR LIVE Monitor'
      }
    };

    if (context) {
      for (const [key, value] of Object.entries(context)) {
        embed.fields.push({
          name: key,
          value: String(value),
          inline: true
        });
      }
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });
  } catch (error) {
    console.error('[Discord] Failed to send warning alert:', error);
  }
}

/**
 * KV 사용량 경고 (50% 이상)
 */
export async function sendKVUsageWarning(
  webhookUrl: string,
  readPercent: number,
  writePercent: number
): Promise<void> {
  if (!webhookUrl) {
    return;
  }

  try {
    const message = [
      `📊 **KV 사용량 경고**`,
      ``,
      `현재 사용량:`,
      `• 읽기: ${readPercent.toFixed(1)}%`,
      `• 쓰기: ${writePercent.toFixed(1)}%`,
      ``,
      `50% 이상 사용 중입니다. 유료 플랜 업그레이드를 고려하세요.`,
      `https://dash.cloudflare.com`
    ].join('\n');

    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message,
      }),
    });
  } catch (error) {
    console.error('[Discord] Failed to send KV warning:', error);
  }
}
