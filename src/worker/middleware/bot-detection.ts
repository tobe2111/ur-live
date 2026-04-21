/**
 * Bot Detection Middleware
 * - Block suspicious automated clients (HeadlessChrome, curl, Python-requests)
 * - Allow legitimate search/social bots (Googlebot, KakaoBot, NaverBot, etc.)
 */

import type { Context, Next } from 'hono';

// Suspicious UA patterns — headless browsers, CLI tools, scripting libraries
const SUSPICIOUS_UA_PATTERNS = [
  /HeadlessChrome/i,
  /PhantomJS/i,
  /Puppeteer/i,
  /Selenium/i,
  /python-requests/i,
  /python-urllib/i,
  /node-fetch/i,
  /Go-http-client/i,
  /Java\/\d/i,
  /libwww-perl/i,
  /Wget/i,
  /curl\//i,
  /HTTPie/i,
  /scrapy/i,
  /Apache-HttpClient/i,
  /okhttp/i,
];

// Legitimate bots that should always be allowed through
const LEGIT_BOT_PATTERNS = [
  /Googlebot/i,
  /Bingbot/i,
  /baiduspider/i,
  /YandexBot/i,
  /NaverBot/i,
  /Yeti\//i,          // Naver Yeti
  /DaumOA/i,
  /Daum\/\d/i,
  /KakaoBot/i,
  /KakaoTalk/i,
  /kakaostory/i,
  /facebookexternalhit/i,
  /Twitterbot/i,
  /LinkedInBot/i,
  /Slackbot/i,
  /TelegramBot/i,
  /Discordbot/i,
  /WhatsApp/i,
  /Applebot/i,
  /PinterestBot/i,
  /Embedly/i,
];

export interface BotDetectionResult {
  isBot: boolean;
  isSuspicious: boolean;
  isLegitBot: boolean;
  matchedPattern?: string;
}

/**
 * Detect whether a request comes from a bot, and whether it's legitimate or suspicious.
 */
export function detectBot(userAgent: string | undefined): BotDetectionResult {
  if (!userAgent || userAgent.trim() === '') {
    return { isBot: true, isSuspicious: true, isLegitBot: false, matchedPattern: 'empty-ua' };
  }

  // Check legit bots first (they take priority)
  for (const pattern of LEGIT_BOT_PATTERNS) {
    if (pattern.test(userAgent)) {
      return { isBot: true, isSuspicious: false, isLegitBot: true, matchedPattern: pattern.source };
    }
  }

  // Check suspicious patterns
  for (const pattern of SUSPICIOUS_UA_PATTERNS) {
    if (pattern.test(userAgent)) {
      return { isBot: true, isSuspicious: true, isLegitBot: false, matchedPattern: pattern.source };
    }
  }

  return { isBot: false, isSuspicious: false, isLegitBot: false };
}

/**
 * Hono middleware — blocks suspicious bots on API endpoints.
 * Legitimate bots and normal browsers pass through.
 *
 * Usage:
 *   app.use('/api/*', botProtection());
 */
export function botProtection() {
  return async (c: Context, next: Next) => {
    const ua = c.req.header('user-agent');
    const result = detectBot(ua);

    if (result.isSuspicious) {
      // Allow health checks even from curl (useful for monitoring)
      const path = new URL(c.req.url).pathname;
      if (path === '/api/health' || path === '/health') {
        await next();
        return;
      }

      return c.json(
        { success: false, error: 'Forbidden' },
        403
      );
    }

    await next();
  };
}
