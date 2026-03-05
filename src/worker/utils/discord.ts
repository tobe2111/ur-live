/**
 * 🔔 Discord Webhook Alerts for Critical Errors
 * 
 * Purpose:
 * - Send real-time alerts to Discord when critical errors occur
 * - Notify team of production issues immediately
 * - Include actionable context (stack trace, user info, request details)
 * 
 * Features:
 * - Rich embeds with error details
 * - Color-coded severity levels
 * - Rate limiting to prevent spam
 * - Batching for multiple errors
 * - Mention @here for critical errors
 */

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp?: string;
  footer?: {
    text: string;
  };
}

interface DiscordMessage {
  content?: string;
  embeds: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

interface AlertOptions {
  level: 'critical' | 'error' | 'warning' | 'info';
  error?: Error;
  request?: Request;
  user?: { id?: string; email?: string };
  extra?: Record<string, any>;
  mentionEveryone?: boolean;
}

// Color codes for different severity levels
const COLORS = {
  critical: 0xff0000, // Red
  error: 0xff6b6b,    // Light red
  warning: 0xffa500,  // Orange
  info: 0x4a90e2,     // Blue
};

// Emoji for severity levels
const EMOJIS = {
  critical: '🚨',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

class DiscordAlerter {
  private webhookUrl: string;
  private environment: string;
  private region: 'KR' | 'WORLD';
  private enabled: boolean;
  private lastAlertTime: Map<string, number> = new Map();
  private rateLimitMs: number = 60000; // 1 minute between duplicate alerts

  constructor(config: {
    webhookUrl: string;
    environment: string;
    region: 'KR' | 'WORLD';
    enabled?: boolean;
    rateLimitMs?: number;
  }) {
    this.webhookUrl = config.webhookUrl;
    this.environment = config.environment;
    this.region = config.region;
    this.enabled = config.enabled !== false;
    if (config.rateLimitMs) {
      this.rateLimitMs = config.rateLimitMs;
    }
  }

  /**
   * Send alert to Discord
   */
  async sendAlert(message: string, options: AlertOptions): Promise<void> {
    if (!this.enabled || !this.webhookUrl) {
      console.log('[Discord] Disabled or missing webhook URL, skipping alert');
      return;
    }

    // Rate limiting - prevent duplicate alerts
    const alertKey = this.getAlertKey(message, options);
    const lastAlert = this.lastAlertTime.get(alertKey);
    const now = Date.now();
    
    if (lastAlert && now - lastAlert < this.rateLimitMs) {
      console.log('[Discord] Rate limited, skipping duplicate alert');
      return;
    }

    try {
      const embed = this.buildEmbed(message, options);
      const discordMessage: DiscordMessage = {
        embeds: [embed],
        username: `UR-Live Alert [${this.region}]`,
      };

      // Add @here mention for critical errors
      if (options.level === 'critical' || options.mentionEveryone) {
        discordMessage.content = '@here';
      }

      await this.sendToWebhook(discordMessage);
      
      this.lastAlertTime.set(alertKey, now);
      console.log('[Discord] ✅ Alert sent:', message);
    } catch (error) {
      console.error('[Discord] ❌ Failed to send alert:', error);
    }
  }

  /**
   * Build Discord embed from alert data
   */
  private buildEmbed(message: string, options: AlertOptions): DiscordEmbed {
    const emoji = EMOJIS[options.level];
    const color = COLORS[options.level];

    const embed: DiscordEmbed = {
      title: `${emoji} ${options.level.toUpperCase()}: ${message}`,
      color,
      timestamp: new Date().toISOString(),
      footer: {
        text: `Environment: ${this.environment} | Region: ${this.region}`,
      },
      fields: [],
    };

    // Add error details
    if (options.error) {
      embed.fields?.push({
        name: '🐛 Error',
        value: `\`\`\`${options.error.name}: ${options.error.message}\`\`\``,
        inline: false,
      });

      // Add stack trace (truncated to 1024 chars for Discord limit)
      if (options.error.stack) {
        const stack = options.error.stack.slice(0, 1000);
        embed.fields?.push({
          name: '📚 Stack Trace',
          value: `\`\`\`${stack}${options.error.stack.length > 1000 ? '\n...' : ''}\`\`\``,
          inline: false,
        });
      }
    }

    // Add request details
    if (options.request) {
      const url = new URL(options.request.url);
      embed.fields?.push({
        name: '🌐 Request',
        value: `**Method:** ${options.request.method}\n**URL:** ${url.pathname}${url.search}`,
        inline: false,
      });

      // Add user IP
      const ip = options.request.headers.get('cf-connecting-ip') || 
                 options.request.headers.get('x-forwarded-for');
      if (ip) {
        embed.fields?.push({
          name: '📍 IP Address',
          value: ip,
          inline: true,
        });
      }

      // Add user agent
      const userAgent = options.request.headers.get('user-agent');
      if (userAgent) {
        const truncated = userAgent.slice(0, 100);
        embed.fields?.push({
          name: '💻 User Agent',
          value: truncated + (userAgent.length > 100 ? '...' : ''),
          inline: false,
        });
      }
    }

    // Add user info
    if (options.user?.id) {
      embed.fields?.push({
        name: '👤 User',
        value: `**ID:** ${options.user.id}${options.user.email ? `\n**Email:** ${options.user.email}` : ''}`,
        inline: true,
      });
    }

    // Add extra context
    if (options.extra) {
      const extraText = Object.entries(options.extra)
        .map(([key, value]) => `**${key}:** ${JSON.stringify(value)}`)
        .join('\n');
      
      if (extraText.length > 0) {
        embed.fields?.push({
          name: '📋 Additional Context',
          value: extraText.slice(0, 1000),
          inline: false,
        });
      }
    }

    return embed;
  }

  /**
   * Send message to Discord webhook
   */
  private async sendToWebhook(message: DiscordMessage): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Discord webhook error ${response.status}: ${text}`);
    }
  }

  /**
   * Generate unique key for rate limiting
   */
  private getAlertKey(message: string, options: AlertOptions): string {
    const parts = [
      message,
      options.level,
      options.error?.name,
      options.request?.url,
    ].filter(Boolean);
    
    return parts.join('|');
  }

  /**
   * Send deployment notification
   */
  async sendDeploymentNotification(version: string, commit?: string): Promise<void> {
    if (!this.enabled) return;

    const embed: DiscordEmbed = {
      title: '🚀 New Deployment',
      description: `Version **${version}** deployed to **${this.environment}**`,
      color: 0x00ff00, // Green
      timestamp: new Date().toISOString(),
      fields: [],
      footer: {
        text: `Region: ${this.region}`,
      },
    };

    if (commit) {
      embed.fields?.push({
        name: '📝 Commit',
        value: `\`${commit}\``,
        inline: true,
      });
    }

    const message: DiscordMessage = {
      embeds: [embed],
      username: `UR-Live Deploy [${this.region}]`,
    };

    try {
      await this.sendToWebhook(message);
      console.log('[Discord] ✅ Deployment notification sent');
    } catch (error) {
      console.error('[Discord] ❌ Failed to send deployment notification:', error);
    }
  }

  /**
   * Send performance warning
   */
  async sendPerformanceWarning(metric: string, value: number, threshold: number): Promise<void> {
    await this.sendAlert(`Performance Warning: ${metric}`, {
      level: 'warning',
      extra: {
        metric,
        value: `${value}ms`,
        threshold: `${threshold}ms`,
        exceeded: `${((value / threshold - 1) * 100).toFixed(1)}%`,
      },
    });
  }
}

// Singleton instance
let discordInstance: DiscordAlerter | null = null;

/**
 * Initialize Discord alerter
 */
export function initDiscord(config: {
  webhookUrl: string;
  environment: string;
  region: 'KR' | 'WORLD';
  enabled?: boolean;
  rateLimitMs?: number;
}): DiscordAlerter {
  discordInstance = new DiscordAlerter(config);
  return discordInstance;
}

/**
 * Get Discord instance
 */
export function getDiscord(): DiscordAlerter | null {
  return discordInstance;
}

/**
 * Send alert helper
 */
export async function sendAlert(message: string, options: AlertOptions): Promise<void> {
  if (discordInstance) {
    await discordInstance.sendAlert(message, options);
  }
}

/**
 * Send critical alert (with @here mention)
 */
export async function sendCriticalAlert(
  message: string,
  error: Error,
  request?: Request
): Promise<void> {
  if (discordInstance) {
    await discordInstance.sendAlert(message, {
      level: 'critical',
      error,
      request,
      mentionEveryone: true,
    });
  }
}

export default {
  initDiscord,
  getDiscord,
  sendAlert,
  sendCriticalAlert,
};
