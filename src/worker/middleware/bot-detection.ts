/**
 * Bot Detection Middleware
 * - Block suspicious automated clients (HeadlessChrome, curl, Python-requests)
 * - Allow legitimate search/social bots (Googlebot, KakaoBot, NaverBot, etc.)
 */

import type { Context, Next } from 'hono';

// Suspicious UA patterns — headless browsers, CLI tools, scripting libraries.
//
// ⚠️  Historically we also matched /okhttp/i and /Java\/\d/i, but these are
//     shipped with legitimate Android apps (including our own native client),
//     which caused production false positives. They're removed to unblock
//     real users; if scraper traffic becomes a problem, re-add them scoped
//     to specific endpoints (not globally) or behind a logging-only rule.
//
//     Similarly "Postman" is NOT in this list — developers use it to hit the
//     public API, and silently 403'ing them breaks integrations.
const SUSPICIOUS_UA_PATTERNS = [
  /HeadlessChrome/i,
  /PhantomJS/i,
  /Puppeteer/i,
  /Selenium/i,
  /python-requests/i,
  /python-urllib/i,
  /node-fetch/i,
  /Go-http-client/i,
  /libwww-perl/i,
  /Wget/i,
  /curl\//i,
  /HTTPie/i,
  /scrapy/i,
  /Apache-HttpClient/i,
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

// ---------------------------------------------------------------------------
// 🕷️ 2026-08-22 대표 지시 "크롤링도 마찬가지" — 콘텐츠 수확 봇 차단
// ---------------------------------------------------------------------------
// `SUSPICIOUS_UA_PATTERNS` 와 **일부러 분리**한다. 그쪽은 로그인/가입 같은 민감 POST 에만
// 붙어 있고 빈 UA 도 의심으로 본다 — 그 판정을 공개 콘텐츠 API 에 그대로 쓰면 UA 를 안 보내는
// 정상 클라이언트(일부 인앱 웹뷰·프록시)까지 403 이 된다.
//
// 그래서 이 목록은 **자기 이름을 밝힌 수확 봇만** 잡는다. 빈 UA 는 통과시킨다.
//   · AI 학습 크롤러 — robots.txt 로도 막지만(`public/robots.txt`), robots 는 *부탁*이라
//     지키지 않는 쪽이 실제 문제다. 헤더 차단이 그 짝이다.
//   · SEO/가격 수집 도구 — 우리 상품·가격표가 통째로 경쟁사 대시보드에 뜨는 경로.
//
// ⚠️ 검색엔진·소셜 스크랩은 절대 넣지 말 것 — `LEGIT_BOT_PATTERNS` 가 먼저 통과시키지만
//    이 목록에 넣으면 의도가 흐려진다. 네이버 Yeti/카카오 스크랩이 막히면 색인과 공유
//    미리보기가 통째로 죽는다(그게 이 서비스의 유입이다).
// ⚠️ 내부 self-fetch UA(`ur-live-ssr-prefetch/1.0`·`ur-live-cache-prewarm/1.0`)와 겹치는
//    패턴을 넣지 말 것 — SSR 0-RTT 와 예열이 조용히 멎는다.
const SCRAPER_UA_PATTERNS = [
  // AI 학습·검색 데이터 수집
  /GPTBot/i,
  /ChatGPT-User/i,
  /OAI-SearchBot/i,
  /ClaudeBot/i,
  /anthropic-ai/i,
  /Claude-Web/i,
  /CCBot/i,
  /Google-Extended/i,
  /PerplexityBot/i,
  /Perplexity-User/i,
  /Bytespider/i,
  /Amazonbot/i,
  /Applebot-Extended/i,
  /cohere-ai/i,
  /Diffbot/i,
  /Omgilibot/i,
  /Timpibot/i,
  /ImagesiftBot/i,
  /Meta-ExternalAgent/i,
  /FriendlyCrawler/i,
  // SEO·가격·콘텐츠 수확 도구
  /AhrefsBot/i,
  /SemrushBot/i,
  /MJ12bot/i,
  /DotBot/i,
  /BLEXBot/i,
  /DataForSeoBot/i,
  /SeekportBot/i,
  /serpstatbot/i,
  /PetalBot/i,
  /ZoominfoBot/i,
  /Barkrowler/i,
  /magpie-crawler/i,
  // 범용 수확 프레임워크(SUSPICIOUS 에 없는 것만)
  /HTTrack/i,
  /SiteSucker/i,
  /WebCopier/i,
  /WebZIP/i,
  /Nutch/i,
  /heritrix/i,
];

/** 자기 이름을 밝힌 수확 봇인가. 빈 UA·정상 브라우저·검색엔진은 false. */
export function isScraperUA(userAgent: string | undefined): boolean {
  if (!userAgent || userAgent.trim() === '') return false;
  for (const p of LEGIT_BOT_PATTERNS) if (p.test(userAgent)) return false;
  for (const p of SCRAPER_UA_PATTERNS) if (p.test(userAgent)) return true;
  return false;
}

/**
 * 공개 콘텐츠 API 용 수확 차단.
 *
 * `botProtection()` 과 달리 **빈 UA 를 막지 않는다** — 공개 목록은 로그인 폼과 달리
 * 정상 트래픽의 꼬리가 길다. 잡는 것은 자기 이름을 밝힌 수확 봇뿐이고, 그 대가로
 * 오탐이 구조적으로 0 이다(정상 브라우저 UA 는 이 목록 중 어느 것과도 안 겹친다).
 *
 * 사용: `app.use('/api/group-buy/products', scrapeProtection());`
 */
export function scrapeProtection() {
  return async (c: Context, next: Next) => {
    if (isScraperUA(c.req.header('user-agent'))) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    await next();
  };
}
