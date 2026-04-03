import * as cheerio from 'cheerio';
import {
  NAVER_SEARCH_URL,
  DEFAULT_DELAY,
  MAX_PAGES_PER_KEYWORD,
  MAX_URLS_PER_KEYWORD,
} from '../utils/constants.js';
import { sleep, randomDelay, resolveNaverAdUrl, log } from '../utils/helpers.js';

/**
 * 네이버 검색광고(파워링크) 스크레이퍼
 *
 * 동작 방식:
 *  1. 키워드로 네이버 검색
 *  2. 파워링크(검색광고) 영역에서 광고주 정보 추출
 *  3. 실제 광고주 URL 반환
 */
export class NaverAdScraper {
  constructor(pageSession) {
    this.session = pageSession;
  }

  /**
   * 키워드로 네이버 검색 후 파워링크 광고 추출
   * @param {string} keyword
   * @returns {Promise<AdResult[]>}
   */
  async scrapeKeyword(keyword) {
    const results = [];
    const seen = new Set();

    for (let page = 1; page <= MAX_PAGES_PER_KEYWORD; page++) {
      try {
        const pageResults = await this._scrapePage(keyword, page);

        for (const r of pageResults) {
          const key = r.advertiserUrl || r.displayUrl;
          if (key && !seen.has(key)) {
            seen.add(key);
            results.push(r);
          }
        }

        if (results.length >= MAX_URLS_PER_KEYWORD) break;
        if (pageResults.length === 0) break;  // 더 이상 광고 없음

        // 페이지 간 딜레이
        await sleep(randomDelay(...DEFAULT_DELAY.betweenPages));
      } catch (err) {
        log('warn', `키워드 "${keyword}" ${page}페이지 스크래핑 실패`, err.message);
        break;
      }
    }

    log('info', `키워드 "${keyword}": 광고주 ${results.length}개 발견`);
    return results.slice(0, MAX_URLS_PER_KEYWORD);
  }

  async _scrapePage(keyword, page) {
    const url = `${NAVER_SEARCH_URL}?query=${encodeURIComponent(keyword)}&start=${(page - 1) * 10 + 1}`;
    log('debug', `네이버 검색: ${keyword} (${page}페이지)`);

    const pageObj = await this.session.open(url);

    // 봇 감지 확인
    const title = await pageObj.title();
    if (title.includes('차단') || title.includes('blocked') || title.includes('robot')) {
      log('warn', '봇 차단 감지. 대기 중...');
      await sleep(randomDelay(...DEFAULT_DELAY.afterBlock));
      throw new Error('봇 차단');
    }

    // 인간처럼 스크롤
    await this._humanScroll(pageObj);

    const html = await pageObj.content();
    return this._parseAds(html, url);
  }

  /**
   * HTML에서 파워링크 광고 파싱
   * 네이버의 DOM 구조에 맞춰 여러 셀렉터 시도
   */
  _parseAds(html, pageUrl) {
    const $ = cheerio.load(html);
    const results = [];

    // 방법 1: 파워링크 상단/하단 광고 영역 (일반 검색)
    const adContainers = [
      '#powerlink_top_area .bx',
      '#powerlink_bottom_area .bx',
      '.ad_area .bx',
      '[data-type="ad"] .bx',
      // 최신 네이버 DOM
      '.api_subject_bx[data-cr-gdid]',
      'li[data-cr-gdid]',
    ];

    for (const selector of adContainers) {
      $(selector).each((_, el) => {
        const ad = this._parseAdElement($, el, pageUrl);
        if (ad) results.push(ad);
      });
      if (results.length > 0) break;
    }

    // 방법 2: data 속성 기반 파싱 (네이버 동적 렌더링 결과)
    if (results.length === 0) {
      $('a[href*="lavad.naver.com"], a[href*="nclk.naver.com"]').each((_, el) => {
        const href = $(el).attr('href');
        const advertiserUrl = resolveNaverAdUrl(href);
        if (advertiserUrl && !advertiserUrl.includes('naver.com')) {
          const title = $(el).text().trim() || $(el).attr('title');
          results.push({
            keyword: '',
            title,
            advertiserUrl,
            displayUrl: advertiserUrl,
            description: '',
            adType: 'powerlink',
            foundAt: pageUrl,
            scrapedAt: new Date().toISOString(),
          });
        }
      });
    }

    return results;
  }

  _parseAdElement($, el, pageUrl) {
    try {
      const $el = $(el);

      // 제목 링크 추출
      const titleEl = $el.find('.title_area a, .ad_tit a, .lnk_tit').first();
      const title = titleEl.text().trim();
      let href = titleEl.attr('href') || $el.find('a').first().attr('href');

      if (!href) return null;

      // 네이버 광고 추적 URL → 실제 URL
      const advertiserUrl = resolveNaverAdUrl(href);
      if (!advertiserUrl || advertiserUrl.includes('naver.com')) return null;

      const displayUrl = $el.find('.url_area, .ad_url, .dsc_url').text().trim();
      const description = $el.find('.dsc_area, .ad_dsc, .dsc_txt_wrap').text().trim();

      return {
        title,
        advertiserUrl,
        displayUrl: displayUrl || advertiserUrl,
        description,
        adType: 'powerlink',
        foundAt: pageUrl,
        scrapedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  async _humanScroll(page) {
    // 사람처럼 스크롤 (봇 감지 우회)
    await page.evaluate(async () => {
      for (let i = 0; i < 3; i++) {
        window.scrollBy(0, Math.floor(Math.random() * 300 + 200));
        await new Promise(r => setTimeout(r, Math.random() * 500 + 300));
      }
    });
  }
}

/**
 * @typedef {Object} AdResult
 * @property {string} title - 광고 제목
 * @property {string} advertiserUrl - 광고주 실제 URL
 * @property {string} displayUrl - 표시 URL
 * @property {string} description - 광고 설명
 * @property {string} adType - 광고 유형
 * @property {string} foundAt - 발견된 검색 URL
 * @property {string} scrapedAt - 수집 시각
 */
