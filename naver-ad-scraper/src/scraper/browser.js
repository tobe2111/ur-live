import { chromium } from 'playwright';
import { getRandomUserAgent, log } from '../utils/helpers.js';

/**
 * 브라우저 풀 관리자
 * 네이버 봇 감지 회피를 위한 스텔스 설정 포함
 */
export class BrowserPool {
  constructor(options = {}) {
    this.maxBrowsers = options.maxBrowsers || 2;
    this.headless = options.headless !== false;
    this.proxyList = options.proxyList || [];
    this.browsers = [];
    this.contexts = [];
  }

  async launch() {
    for (let i = 0; i < this.maxBrowsers; i++) {
      const proxy = this.proxyList[i % this.proxyList.length];
      const browser = await chromium.launch({
        headless: this.headless,
        // 환경에 이미 설치된 Chromium 우선 사용 (별도 다운로드 불필요)
        executablePath: process.env.CHROMIUM_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
        ...(proxy && { proxy: { server: proxy } }),
      });
      this.browsers.push(browser);
    }
    log('info', `브라우저 ${this.maxBrowsers}개 실행 완료`);
  }

  async newContext(browserIndex = 0) {
    const browser = this.browsers[browserIndex % this.browsers.length];
    const context = await browser.newContext({
      userAgent: getRandomUserAgent(),
      viewport: { width: 1280 + Math.floor(Math.random() * 200), height: 720 + Math.floor(Math.random() * 200) },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      // 봇 감지 우회
      extraHTTPHeaders: {
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'DNT': '1',
      },
    });

    // navigator.webdriver 속성 제거 (봇 탐지 우회)
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US'] });
      window.chrome = { runtime: {} };
    });

    this.contexts.push(context);
    return context;
  }

  async close() {
    for (const ctx of this.contexts) {
      try { await ctx.close(); } catch {}
    }
    for (const browser of this.browsers) {
      try { await browser.close(); } catch {}
    }
    log('info', '브라우저 종료');
  }
}

/**
 * 단일 페이지 세션 (context 재사용)
 */
export class PageSession {
  constructor(context) {
    this.context = context;
    this.page = null;
  }

  async open(url, options = {}) {
    if (!this.page || this.page.isClosed()) {
      this.page = await this.context.newPage();
      // 불필요한 리소스 차단 (속도 향상)
      if (options.blockResources !== false) {
        await this.page.route('**/*', (route) => {
          const type = route.request().resourceType();
          if (['image', 'media', 'font'].includes(type)) {
            route.abort();
          } else {
            route.continue();
          }
        });
      }
    }

    try {
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: options.timeout || 15000,
      });
      return this.page;
    } catch (err) {
      log('warn', `페이지 로드 실패: ${url}`, err.message);
      throw err;
    }
  }

  async close() {
    if (this.page && !this.page.isClosed()) {
      await this.page.close();
    }
  }
}
