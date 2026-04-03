import * as cheerio from 'cheerio';
import {
  CONTACT_PAGE_PATHS,
  DEFAULT_DELAY,
  REQUEST_TIMEOUT,
} from '../utils/constants.js';
import {
  extractEmails,
  normalizeUrl,
  extractDomain,
  sleep,
  randomDelay,
  log,
} from '../utils/helpers.js';

/**
 * 광고주 웹사이트 이메일 크롤러
 *
 * 전략:
 *  1. 메인 페이지에서 이메일 추출
 *  2. 문의/회사소개/연락처 페이지 탐색
 *  3. <meta>, <a href="mailto:">, 텍스트 모두 검색
 *  4. robots.txt 확인
 */
export class EmailCrawler {
  constructor(pageSession) {
    this.session = pageSession;
    this.robotsCache = new Map();
  }

  /**
   * URL에서 이메일 수집
   * @param {string} url - 광고주 URL
   * @returns {Promise<CrawlResult>}
   */
  async crawl(url) {
    const result = {
      url,
      domain: extractDomain(url),
      emails: [],
      phone: '',
      kakaoChannel: '',
      naverTalk: '',
      companyName: '',
      crawledAt: new Date().toISOString(),
      status: 'pending',
      error: null,
    };

    try {
      // robots.txt 확인
      const allowed = await this._checkRobots(url);
      if (!allowed) {
        result.status = 'robots_blocked';
        log('debug', `robots.txt 차단: ${url}`);
        return result;
      }

      // 메인 페이지 크롤링
      const mainEmails = await this._crawlPage(url, result);
      result.emails.push(...mainEmails);

      // 이메일이 없으면 문의/연락처 페이지 탐색
      if (result.emails.length === 0) {
        const contactEmails = await this._crawlContactPages(url, result);
        result.emails.push(...contactEmails);
      }

      // 중복 제거
      result.emails = [...new Set(result.emails)];
      result.status = result.emails.length > 0 ? 'found' : 'not_found';

      log('debug', `크롤링 완료: ${result.domain} → 이메일 ${result.emails.length}개`, result.emails.join(', '));
    } catch (err) {
      result.status = 'error';
      result.error = err.message;
      log('warn', `크롤링 실패: ${url}`, err.message);
    }

    return result;
  }

  /**
   * 단일 페이지에서 이메일/연락처 추출
   */
  async _crawlPage(url, result) {
    const page = await this.session.open(url, { timeout: REQUEST_TIMEOUT, blockResources: true });

    // 동적 콘텐츠 로드 대기
    await page.waitForTimeout(1500);

    const html = await page.content();
    const $ = cheerio.load(html);

    // 회사명 추출
    if (!result.companyName) {
      result.companyName = this._extractCompanyName($);
    }

    // 전화번호 추출
    if (!result.phone) {
      result.phone = this._extractPhone($);
    }

    // 카카오채널 / 네이버톡톡 추출
    this._extractMessengers($, result);

    // 이메일 추출 (다양한 방법)
    const emails = new Set();

    // 1. mailto: 링크
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const email = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
      if (email && email.includes('@')) emails.add(email);
    });

    // 2. 텍스트 전체 검색 (이메일 패턴)
    const bodyText = $('body').text();
    extractEmails(bodyText).forEach(e => emails.add(e));

    // 3. meta 태그 (contact info)
    $('meta[name*="email"], meta[property*="email"]').each((_, el) => {
      const content = $(el).attr('content') || '';
      extractEmails(content).forEach(e => emails.add(e));
    });

    // 4. JSON-LD 구조화 데이터
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html());
        const json = JSON.stringify(data);
        extractEmails(json).forEach(e => emails.add(e));
      } catch {}
    });

    await sleep(randomDelay(...DEFAULT_DELAY.betweenRequests));
    return [...emails];
  }

  /**
   * 문의/연락처 페이지 탐색
   */
  async _crawlContactPages(baseUrl, result) {
    const emails = new Set();
    const domain = new URL(baseUrl).origin;

    // 가능한 문의 페이지 후보 생성
    const candidates = [
      ...CONTACT_PAGE_PATHS.map(p => domain + p),
      ...await this._findContactLinks(baseUrl),
    ];

    const tried = new Set([baseUrl]);

    for (const candidateUrl of candidates.slice(0, 5)) {  // 최대 5개 페이지
      if (tried.has(candidateUrl)) continue;
      tried.add(candidateUrl);

      try {
        const pageEmails = await this._crawlPage(candidateUrl, result);
        pageEmails.forEach(e => emails.add(e));
        if (emails.size > 0) break;  // 이메일 찾으면 중단
        await sleep(randomDelay(...DEFAULT_DELAY.betweenRequests));
      } catch {
        // 해당 페이지가 없으면 무시
      }
    }

    return [...emails];
  }

  /**
   * 메인 페이지에서 문의/연락처 링크 추출
   */
  async _findContactLinks(url) {
    try {
      const page = await this.session.open(url, { timeout: REQUEST_TIMEOUT });
      const html = await page.content();
      const $ = cheerio.load(html);
      const links = [];

      $('a').each((_, el) => {
        const href = $(el).attr('href');
        const text = ($(el).text() + $(el).attr('title') + $(el).attr('aria-label')).toLowerCase();
        const isContact = ['문의', '연락', 'contact', 'about', '회사', '고객센터', 'support', '소개'].some(k => text.includes(k));
        if (isContact && href) {
          const resolved = normalizeUrl(href, url);
          if (resolved) links.push(resolved);
        }
      });

      return [...new Set(links)];
    } catch {
      return [];
    }
  }

  _extractCompanyName($) {
    return (
      $('meta[property="og:site_name"]').attr('content') ||
      $('meta[name="application-name"]').attr('content') ||
      $('title').text().split(/[-|·]/)[0].trim() ||
      ''
    ).substring(0, 100);
  }

  _extractPhone($) {
    const text = $('body').text();
    // 한국 전화번호 패턴
    const match = text.match(/(?:0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4})/);
    return match ? match[0].replace(/\s/g, '') : '';
  }

  _extractMessengers($, result) {
    $('a[href*="pf.kakao.com"], a[href*="kakao.com/o/"]').each((_, el) => {
      result.kakaoChannel = $(el).attr('href') || '';
    });
    $('a[href*="talk.naver.com"]').each((_, el) => {
      result.naverTalk = $(el).attr('href') || '';
    });
  }

  /**
   * robots.txt 준수 확인
   */
  async _checkRobots(url) {
    try {
      const { origin } = new URL(url);
      if (this.robotsCache.has(origin)) {
        return this.robotsCache.get(origin);
      }

      const robotsUrl = `${origin}/robots.txt`;
      const page = await this.session.open(robotsUrl, { timeout: 5000, blockResources: false });
      const text = await page.evaluate(() => document.body.innerText || '');

      // 간단한 robots.txt 파싱 (Disallow: / 패턴 확인)
      const isBlocked = text.split('\n').some(line => {
        const l = line.trim().toLowerCase();
        return l.startsWith('disallow: /') && l.includes('user-agent: *');
      });

      this.robotsCache.set(origin, !isBlocked);
      return !isBlocked;
    } catch {
      return true;  // robots.txt 없으면 허용
    }
  }
}

/**
 * @typedef {Object} CrawlResult
 * @property {string} url
 * @property {string} domain
 * @property {string[]} emails
 * @property {string} phone
 * @property {string} kakaoChannel
 * @property {string} naverTalk
 * @property {string} companyName
 * @property {string} crawledAt
 * @property {string} status - 'found' | 'not_found' | 'error' | 'robots_blocked'
 * @property {string|null} error
 */
