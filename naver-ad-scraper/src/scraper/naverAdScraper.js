// dns import는 validator.js에서 처리 (이 파일에서는 미사용)
import {
  NAVER_SEARCH_URL,
  DEFAULT_DELAY,
  MAX_PAGES_PER_KEYWORD,
  MAX_URLS_PER_KEYWORD,
} from '../utils/constants.js';
import { sleep, randomDelay, log } from '../utils/helpers.js';

/**
 * 네이버 파워링크 광고 스크레이퍼 (최종판)
 *
 * 전략 (신뢰도 순):
 *  1. 네트워크 인터셉트 → Naver 광고 API JSON 응답 직접 파싱
 *  2. Playwright evaluate() → 실제 렌더링된 DOM에서 추출
 *  3. "더보기" 버튼 클릭 → 추가 광고 로드
 *  4. nclk 리다이렉트 → 실제 광고주 URL 확보
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
          if (r.advertiserUrl && !seen.has(r.advertiserUrl)) {
            seen.add(r.advertiserUrl);
            results.push({ ...r, keyword });
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

    // 봇 차단 확인
    const title = await page.title();
    if (/차단|blocked|robot/i.test(title)) {
      await sleep(randomDelay(...DEFAULT_DELAY.afterBlock));
      throw new Error('봇 차단 감지');
    }

    // 네트워크 인터셉트 설정 (광고 API JSON 포착)
    const interceptedAds = [];
    page.on('response', async (response) => {
      try {
        const url = response.url();
        // 네이버 광고 API 엔드포인트 패턴
        if (
          url.includes('search.naver.com') &&
          response.headers()['content-type']?.includes('json')
        ) {
          const json = await response.json().catch(() => null);
          if (json) {
            const ads = this._parseAdJson(json);
            interceptedAds.push(...ads);
          }
        }
      } catch {}
    });

    // 광고 로드 대기
    await page.waitForTimeout(2500);
    await this._humanScroll(page);

    // "더보기" 버튼 클릭 → 숨겨진 파워링크 추가 로드
    await this._clickMoreButtons(page);

    // ── 광고 추출: 인터셉트 > DOM > fallback 순 ─────────────────
    let rawAds = [];

    // 1차: 인터셉트된 JSON
    if (interceptedAds.length > 0) {
      log('debug', `네트워크 인터셉트 성공: ${interceptedAds.length}개`);
      rawAds = interceptedAds;
    }

    // 2차: Playwright evaluate()로 DOM 직접 파싱
    const domAds = await this._extractFromDom(page);
    // DOM에서 나온 것 중 인터셉트에 없는 것 추가 (중복 제거)
    const seenNclk = new Set(rawAds.map(a => a.nclkUrl));
    for (const ad of domAds) {
      if (!seenNclk.has(ad.nclkUrl)) {
        rawAds.push(ad);
        seenNclk.add(ad.nclkUrl);
      }
    }

    if (rawAds.length === 0) {
      log('debug', `"${keyword}" ${pageNum}p: 광고 없음`);
      return [];
    }

    // nclk URL → 실제 광고주 URL
    const resolved = await this._resolveNclkUrls(page, rawAds);
    const ts = new Date().toISOString();
    return resolved.map(ad => ({ ...ad, adType: 'powerlink', foundAt: searchUrl, scrapedAt: ts }));
  }

  // ── JSON 응답에서 광고 데이터 파싱 ───────────────────────────────
  _parseAdJson(json) {
    const ads = [];
    // 네이버 광고 API 응답 구조는 변동이 잦으므로 재귀 탐색
    const visit = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      // 광고 아이템 특징: nclk URL + 제목 필드 동시 존재
      if (
        (obj.clickUrl || obj.landingUrl || obj.adUrl) &&
        (obj.title || obj.adTitle || obj.headline)
      ) {
        const nclkUrl = obj.clickUrl || obj.landingUrl || obj.adUrl;
        if (nclkUrl && (nclkUrl.includes('nclk') || nclkUrl.includes('lavad'))) {
          ads.push({
            title: obj.title || obj.adTitle || obj.headline || '',
            nclkUrl,
            displayUrl: obj.displayUrl || obj.siteUrl || '',
            description: obj.description || obj.adDescription || obj.body || '',
          });
        }
      }
      if (Array.isArray(obj)) obj.forEach(visit);
      else Object.values(obj).forEach(v => { if (typeof v === 'object') visit(v); });
    };
    try { visit(json); } catch {}
    return ads;
  }

  // ── DOM에서 광고 추출 ──────────────────────────────────────────
  async _extractFromDom(page) {
    return await page.evaluate(() => {
      const ads = [];
      const emailPattern = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

      // 방법 1: data-cr-gdid (네이버 광고 고유 식별자)
      document.querySelectorAll('[data-cr-gdid]').forEach(el => {
        const linkEl = el.querySelector('a.lnk_tit, a[class*="tit"], a[class*="link"]') || el.querySelector('a');
        if (!linkEl?.href) return;
        ads.push({
          title: linkEl.textContent.trim(),
          nclkUrl: linkEl.href,
          displayUrl: el.querySelector('[class*="url"]')?.textContent.trim() || '',
          description: el.querySelector('[class*="dsc"], [class*="desc"]')?.textContent.trim() || '',
        });
      });

      if (ads.length > 0) return ads;

      // 방법 2: nclk/lavad URL을 가진 링크 (광고 클릭 추적 URL)
      document.querySelectorAll('a[href*="nclk.naver.com"], a[href*="lavad.naver.com"]').forEach(el => {
        // 광고 배지 확인 (조상 중 '광고' 텍스트 있는지)
        let hasAdBadge = false;
        let parent = el.parentElement;
        for (let i = 0; i < 8; i++) {
          if (!parent) break;
          if (parent.textContent.includes('광고')) { hasAdBadge = true; break; }
          parent = parent.parentElement;
        }
        if (!hasAdBadge) return;

        ads.push({
          title: el.textContent.trim() || el.title || '',
          nclkUrl: el.href,
          displayUrl: '',
          description: '',
        });
      });

      return ads;
    });
  }

  // ── nclk URL → 실제 광고주 최종 URL ────────────────────────────
  async _resolveNclkUrls(basePage, rawAds) {
    const results = [];
    const context = basePage.context();

    for (const ad of rawAds) {
      if (!ad.nclkUrl) continue;

      // nclk가 아닌 URL은 그대로
      if (!ad.nclkUrl.includes('nclk.naver.com') && !ad.nclkUrl.includes('lavad.naver.com')) {
        const domain = _domain(ad.nclkUrl);
        if (domain && !domain.includes('naver.com')) {
          results.push({ ...ad, advertiserUrl: ad.nclkUrl, domain });
        }
        continue;
      }

      let tab;
      try {
        tab = await context.newPage();

        // 이미지/폰트/미디어 차단 → 빠른 리다이렉트 추적
        await tab.route('**/*', route => {
          ['image', 'media', 'font', 'stylesheet'].includes(route.request().resourceType())
            ? route.abort()
            : route.continue();
        });

        await tab.goto(ad.nclkUrl, { waitUntil: 'commit', timeout: 8000 });
        const finalUrl = tab.url();
        const domain = _domain(finalUrl);

        if (domain && !domain.includes('naver.com') && finalUrl.startsWith('http')) {
          results.push({ ...ad, advertiserUrl: finalUrl, domain });
          log('debug', `광고주: ${domain}`);
        }
      } catch (err) {
        log('debug', `리다이렉트 실패`, err.message.slice(0, 60));
      } finally {
        await tab?.close().catch(() => {});
      }

      await sleep(randomDelay(400, 900));
    }

    return results;
  }

  // ── 더보기 버튼 클릭 ─────────────────────────────────────────────
  async _clickMoreButtons(page) {
    const selectors = [
      'button:has-text("더보기")',
      'a:has-text("더보기")',
      '[class*="more_btn"]',
      '[class*="btn_more"]',
      '#powerlink_top_area [class*="more"]',
      '#powerlink_bottom_area [class*="more"]',
    ];

    for (const sel of selectors) {
      try {
        for (const btn of await page.$$(sel)) {
          if (!(await btn.isVisible())) continue;
          await btn.scrollIntoViewIfNeeded();
          await sleep(randomDelay(400, 800));
          await btn.click();
          await page.waitForTimeout(1500);
          log('debug', `더보기 클릭: ${sel}`);
        }
      } catch {}
    }
  }

  async _humanScroll(page) {
    await page.evaluate(async () => {
      for (let i = 0; i < 4; i++) {
        window.scrollBy(0, Math.floor(Math.random() * 400 + 200));
        await new Promise(r => setTimeout(r, Math.random() * 600 + 200));
      }
    });
  }
}

function _domain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}
