import {
  NAVER_SEARCH_URL,
  DEFAULT_DELAY,
  MAX_PAGES_PER_KEYWORD,
  MAX_URLS_PER_KEYWORD,
} from '../utils/constants.js';
import { sleep, randomDelay, log } from '../utils/helpers.js';

/**
 * 네이버 파워링크 광고 스크레이퍼 (개선판)
 *
 * 핵심 변경:
 *  - Cheerio 정적 파싱 제거 → Playwright page.evaluate()로 실제 DOM 직접 접근
 *  - nclk.naver.com 리다이렉트 URL은 page.goto()로 클릭 흉내내어 최종 URL 확보
 *  - 광고 판별: 'data-cr-gdid' 속성 또는 '광고' 텍스트 배지 기준
 */
export class NaverAdScraper {
  constructor(pageSession) {
    this.session = pageSession;
  }

  async scrapeKeyword(keyword) {
    const results = [];
    const seen = new Set();

    for (let pageNum = 1; pageNum <= MAX_PAGES_PER_KEYWORD; pageNum++) {
      try {
        const pageResults = await this._scrapePage(keyword, pageNum);
        for (const r of pageResults) {
          const key = r.advertiserUrl;
          if (key && !seen.has(key)) {
            seen.add(key);
            results.push(r);
          }
        }
        if (results.length >= MAX_URLS_PER_KEYWORD) break;
        if (pageResults.length === 0) break;
        await sleep(randomDelay(...DEFAULT_DELAY.betweenPages));
      } catch (err) {
        log('warn', `"${keyword}" ${pageNum}p 실패`, err.message);
        break;
      }
    }

    log('info', `"${keyword}": 광고주 ${results.length}개`);
    return results.slice(0, MAX_URLS_PER_KEYWORD);
  }

  async _scrapePage(keyword, pageNum) {
    const searchUrl = `${NAVER_SEARCH_URL}?query=${encodeURIComponent(keyword)}&start=${(pageNum - 1) * 10 + 1}`;
    log('debug', `검색: "${keyword}" ${pageNum}p`);

    const page = await this.session.open(searchUrl);

    const title = await page.title();
    if (/차단|blocked|robot/i.test(title)) {
      await sleep(randomDelay(...DEFAULT_DELAY.afterBlock));
      throw new Error('봇 차단 감지');
    }

    // 광고 로딩 대기 (파워링크는 별도 XHR로 로드될 수 있음)
    await page.waitForTimeout(2000);
    await this._humanScroll(page);

    // ★ "더보기" 버튼 클릭 → 숨겨진 파워링크 광고 추가 로드
    await this._clickMoreButtons(page);

    // ── 핵심: Playwright evaluate()로 실제 DOM에서 광고 추출 ──────
    const rawAds = await page.evaluate(() => {
      const ads = [];

      // 방법 1: data-cr-gdid 속성 (네이버 광고 고유 식별자)
      // 파워링크 광고 아이템에는 이 속성이 붙음
      const byCrGdid = document.querySelectorAll('[data-cr-gdid]');
      byCrGdid.forEach(el => {
        const linkEl = el.querySelector('a.lnk_tit, a[class*="tit"], a[class*="link"]') || el.querySelector('a');
        const urlEl  = el.querySelector('[class*="url"], [class*="dsc_url"]');
        const dscEl  = el.querySelector('[class*="dsc"], [class*="desc"]');
        if (!linkEl) return;

        ads.push({
          title:      linkEl.textContent.trim(),
          nclkUrl:    linkEl.href,          // nclk.naver.com/... 형태
          displayUrl: urlEl?.textContent.trim() || '',
          description:dscEl?.textContent.trim() || '',
          gdid:       el.dataset.crGdid,
        });
      });

      if (ads.length > 0) return ads;

      // 방법 2: 광고 배지('광고' 텍스트)를 포함한 부모 컨테이너
      const adBadges = Array.from(document.querySelectorAll('*')).filter(
        el => el.childElementCount === 0 && el.textContent.trim() === '광고'
      );
      adBadges.forEach(badge => {
        // 광고 배지의 조상 컨테이너 탐색 (최대 5레벨)
        let container = badge.parentElement;
        for (let i = 0; i < 5; i++) {
          if (!container) break;
          const linkEl = container.querySelector('a[href*="nclk.naver.com"], a[href*="lavad.naver.com"]');
          if (linkEl) {
            const urlEl = container.querySelector('[class*="url"]');
            const dscEl = container.querySelector('[class*="dsc"], [class*="desc"]');
            ads.push({
              title:      linkEl.textContent.trim(),
              nclkUrl:    linkEl.href,
              displayUrl: urlEl?.textContent.trim() || '',
              description:dscEl?.textContent.trim() || '',
              gdid:       null,
            });
            break;
          }
          container = container.parentElement;
        }
      });

      return ads;
    });

    if (rawAds.length === 0) {
      log('debug', `"${keyword}" ${pageNum}p: 광고 없음`);
      return [];
    }

    // nclk URL → 실제 광고주 URL 확보
    const resolved = await this._resolveNclkUrls(page, rawAds);
    const ts = new Date().toISOString();
    return resolved.map(ad => ({
      ...ad,
      adType: 'powerlink',
      foundAt: searchUrl,
      scrapedAt: ts,
    }));
  }

  /**
   * nclk.naver.com 리다이렉트 URL → 실제 광고주 최종 URL
   *
   * 방법: 별도 탭에서 goto() → 리다이렉트를 따라가 최종 URL 캡처
   * (URL 파라미터 파싱은 신뢰할 수 없음 - 서버사이드 리다이렉트이기 때문)
   */
  async _resolveNclkUrls(basePage, rawAds) {
    const results = [];
    const context = basePage.context();

    for (const ad of rawAds) {
      if (!ad.nclkUrl) continue;

      // nclk가 아닌 URL은 그대로 사용
      if (!ad.nclkUrl.includes('nclk.naver.com') && !ad.nclkUrl.includes('lavad.naver.com')) {
        const domain = this._extractDomain(ad.nclkUrl);
        if (domain && !domain.includes('naver.com')) {
          results.push({ ...ad, advertiserUrl: ad.nclkUrl, domain });
        }
        continue;
      }

      // 별도 탭으로 nclk URL 방문 → 리다이렉트 따라가기
      let tab;
      try {
        tab = await context.newPage();

        // 불필요한 리소스 차단 (빠른 리다이렉트 추적)
        await tab.route('**/*', route => {
          const type = route.request().resourceType();
          ['image', 'media', 'font', 'stylesheet'].includes(type)
            ? route.abort()
            : route.continue();
        });

        const response = await tab.goto(ad.nclkUrl, {
          waitUntil: 'commit',  // 리다이렉트 시작 시점에 URL 캡처
          timeout: 8000,
        });

        const finalUrl = tab.url();
        const domain = this._extractDomain(finalUrl);

        // 최종 URL이 네이버가 아닌 외부 사이트인지 확인
        if (domain && !domain.includes('naver.com') && finalUrl.startsWith('http')) {
          results.push({ ...ad, advertiserUrl: finalUrl, domain });
          log('debug', `광고주 URL 확보: ${domain}`);
        }
      } catch (err) {
        log('debug', `URL 확보 실패: ${ad.nclkUrl.slice(0, 60)}`, err.message);
      } finally {
        if (tab) await tab.close().catch(() => {});
      }

      await sleep(randomDelay(500, 1500));
    }

    return results;
  }

  _extractDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
  }

  /**
   * 파워링크 "더보기" 버튼 클릭
   *
   * 네이버 파워링크는 기본적으로 3~5개만 표시하고
   * "더보기" 버튼 클릭 시 추가 광고를 XHR로 불러옴
   * Playwright로 실제 클릭 → 동적 로드된 광고까지 수집
   */
  async _clickMoreButtons(page) {
    // "더보기" 버튼 셀렉터 후보 (네이버 DOM 변경에 대비해 여러 개)
    const moreButtonSelectors = [
      // 텍스트 기반 (가장 안정적)
      'button:has-text("더보기")',
      'a:has-text("더보기")',
      // 클래스 기반
      '[class*="more_btn"]',
      '[class*="btn_more"]',
      '[class*="more-btn"]',
      // 파워링크 특화
      '#powerlink_top_area [class*="more"]',
      '#powerlink_bottom_area [class*="more"]',
    ];

    let clicked = false;
    for (const selector of moreButtonSelectors) {
      try {
        const buttons = await page.$$(selector);
        for (const btn of buttons) {
          const isVisible = await btn.isVisible();
          if (!isVisible) continue;

          await btn.scrollIntoViewIfNeeded();
          await sleep(randomDelay(500, 1000));
          await btn.click();
          await page.waitForTimeout(1500);  // XHR 로드 대기
          clicked = true;
          log('debug', `"더보기" 클릭 성공: ${selector}`);
        }
      } catch {
        // 해당 셀렉터 없으면 다음 시도
      }
    }

    // 더보기 클릭 후 추가 스크롤로 lazy load 트리거
    if (clicked) {
      await this._humanScroll(page);
      await page.waitForTimeout(1000);
    }
  }

  async _humanScroll(page) {
    await page.evaluate(async () => {
      for (let i = 0; i < 3; i++) {
        window.scrollBy(0, Math.floor(Math.random() * 300 + 200));
        await new Promise(r => setTimeout(r, Math.random() * 500 + 300));
      }
    });
  }
}
