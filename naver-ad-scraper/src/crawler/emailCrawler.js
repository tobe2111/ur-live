import * as cheerio from 'cheerio';
import { CONTACT_PAGE_PATHS, DEFAULT_DELAY, REQUEST_TIMEOUT } from '../utils/constants.js';
import { extractEmails, extractDomain, sleep, randomDelay, log } from '../utils/helpers.js';
import { filterValidEmails, isValidBizRegNo } from '../utils/validator.js';

/**
 * 광고주 웹사이트 연락처 크롤러 (최종판)
 *
 * 수집 항목:
 *  이메일, 전화번호(복수), 카카오채널, 네이버톡톡, 인스타그램,
 *  사업자등록번호, 대표자명, 회사명, 주소
 *
 * 이메일 추출 전략 (신뢰도 순):
 *  1. 풋터 집중 파싱 (전자상거래법 의무 고지 - 가장 신뢰도 높음)
 *  2. 개인정보처리방침 페이지 (개인정보관리책임자 이메일 법적 의무)
 *  3. mailto: 링크
 *  4. @ 기호 포함 행 스캔 (난독화 이메일 포함)
 *  5. JSON-LD 구조화 데이터
 *  6. 문의/연락처 페이지
 */
export class EmailCrawler {
  constructor(pageSession) {
    this.session = pageSession;
    this.robotsCache = new Map();
  }

  async crawl(url) {
    const result = {
      url,
      domain: extractDomain(url),
      emails: [],
      phones: [],
      kakaoChannel: '',
      naverTalk: '',
      instagram: '',
      bizRegNo: '',
      representative: '',  // 대표자명
      address: '',         // 주소
      companyName: '',
      crawledAt: new Date().toISOString(),
      status: 'pending',
      error: null,
    };

    try {
      // 1. 메인 페이지
      await this._crawlPage(url, result);

      // 2. 이메일 없으면 추가 페이지 탐색
      if (result.emails.length === 0) {
        await this._crawlSecondaryPages(url, result);
      }

      // 3. DNS MX 검증으로 가짜 이메일 제거
      result.emails = await filterValidEmails([...new Set(result.emails)]);
      result.phones = [...new Set(result.phones)];

      const hasContact = result.emails.length > 0 || result.phones.length > 0
        || result.kakaoChannel || result.naverTalk;

      result.status = result.emails.length > 0 ? 'found'
        : hasContact ? 'contact_found'
        : 'not_found';

      log('debug', `[${result.domain}] 이메일:${result.emails.length} 전화:${result.phones.length} 카카오:${result.kakaoChannel ? '✓' : '-'}`);
    } catch (err) {
      result.status = 'error';
      result.error = err.message;
      log('warn', `크롤링 실패: ${url}`, err.message);
    }

    return result;
  }

  async _crawlPage(url, result) {
    let page;
    try {
      page = await this.session.open(url, { timeout: REQUEST_TIMEOUT, blockResources: true });
    } catch { return; }

    // JS 렌더링 대기
    await page.waitForTimeout(2000);

    const extracted = await page.evaluate(() => {
      const emailPat = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
      const phonePat = /(?:0\d{1,2})[\s\-.]?\d{3,4}[\s\-.]?\d{4}/g;
      const emails = new Set();
      const phones = new Set();
      let kakaoChannel = '', naverTalk = '', instagram = '';
      let bizRegNo = '', representative = '', address = '', companyName = '';

      // ★ 전략 1: 풋터 집중 (전자상거래법 의무 고지)
      // 상호, 사업자번호, 대표자, 주소, CS 이메일이 여기 있음
      const footerEls = [
        ...document.querySelectorAll('footer, #footer, .footer, [class*="footer"], [id*="footer"]'),
        ...document.querySelectorAll('[class*="company"], [class*="bottom-info"], [class*="bottomInfo"]'),
        ...document.querySelectorAll('[class*="corp-info"], [class*="corpInfo"], [class*="bizInfo"]'),
        ...document.querySelectorAll('[class*="법적고지"], [class*="사업자정보"]'),
      ];

      for (const el of footerEls) {
        const text = el.innerText || '';

        // 이메일
        (text.match(emailPat) || []).forEach(e => emails.add(e.toLowerCase()));

        // 전화번호
        (text.match(phonePat) || []).forEach(p => phones.add(p.replace(/\s/g, '')));

        // 사업자등록번호
        if (!bizRegNo) {
          const m = text.match(/사업자\s*(?:등록\s*)?번호\s*[:\s]*([\d]{3}[\s\-]?[\d]{2}[\s\-]?[\d]{5})/);
          if (m) bizRegNo = m[1].replace(/[\s\-]/g, '');
        }

        // 대표자
        if (!representative) {
          const m = text.match(/대표(?:자|이사)\s*[:\s]*([가-힣a-zA-Z]{2,10})/);
          if (m) representative = m[1].trim();
        }

        // 주소
        if (!address) {
          const m = text.match(/(?:주소|소재지)\s*[:\s]*([^\n]{5,60})/);
          if (m) address = m[1].trim();
        }

        // 상호
        if (!companyName) {
          const m = text.match(/(?:상호|회사명|법인명|업체명)\s*[:\s]*([^\n,]{2,30})/);
          if (m) companyName = m[1].trim();
        }
      }

      // ★ 전략 2: mailto: 링크
      document.querySelectorAll('a[href^="mailto:"]').forEach(el => {
        const e = el.href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
        if (e.includes('@')) emails.add(e);
      });

      // ★ 전략 3: @ 기호 포함 행 스캔 (난독화 이메일 포함)
      // "admin @ company.com", "(at)", "[앳]" 등 처리
      const bodyText = (document.body.innerText || '')
        .replace(/\（앳\）|\[앳\]|\(at\)|\（at\）/gi, '@')
        .replace(/\s@\s/g, '@');

      bodyText.split('\n').filter(l => l.includes('@')).forEach(line => {
        (line.match(emailPat) || []).forEach(e => emails.add(e.toLowerCase()));
      });

      // 전화번호 (body 전체)
      (bodyText.match(phonePat) || []).forEach(p => phones.add(p.replace(/\s/g, '')));

      // ★ 전략 4: JSON-LD 구조화 데이터
      document.querySelectorAll('script[type="application/ld+json"]').forEach(el => {
        try {
          const json = JSON.stringify(JSON.parse(el.textContent));
          (json.match(emailPat) || []).forEach(e => emails.add(e.toLowerCase()));
          const phoneMatch = json.match(/"telephone"\s*:\s*"([^"]+)"/);
          if (phoneMatch) phones.add(phoneMatch[1]);
          const addressMatch = json.match(/"streetAddress"\s*:\s*"([^"]+)"/);
          if (addressMatch && !address) address = addressMatch[1];
          const repMatch = json.match(/"name"\s*:\s*"([^"]+)".*?"founder"/s);
          if (repMatch && !representative) representative = repMatch[1];
        } catch {}
      });

      // ★ 전략 5: 소셜/채널 링크
      document.querySelectorAll('a[href]').forEach(el => {
        const href = el.href || '';
        if (!kakaoChannel && (href.includes('pf.kakao.com') || href.includes('kakao.com/o/'))) kakaoChannel = href;
        if (!naverTalk && href.includes('talk.naver.com')) naverTalk = href;
        if (!instagram && /instagram\.com\/[^?#]+/.test(href)) instagram = href.split('?')[0];
      });

      // 회사명 보완 (메타 → 타이틀)
      if (!companyName) {
        companyName = (
          document.querySelector('meta[property="og:site_name"]')?.content ||
          document.querySelector('meta[name="application-name"]')?.content ||
          document.title.split(/[-|·\/]/)[0].trim()
        ).substring(0, 60);
      }

      return {
        emails: [...emails],
        phones: [...phones],
        kakaoChannel, naverTalk, instagram,
        bizRegNo, representative, address, companyName,
      };
    });

    this._mergeExtracted(result, extracted);

    // img alt에 이메일 있는 경우 (이미지로 표시한 이메일)
    const html = await page.content();
    const $ = cheerio.load(html);
    $('img[alt*="@"]').each((_, el) => {
      extractEmails($(el).attr('alt') || '').forEach(e => {
        if (!this._isJunk(e)) result.emails.push(e);
      });
    });

    await sleep(randomDelay(...DEFAULT_DELAY.betweenRequests));
  }

  /**
   * 개인정보처리방침 + 문의 페이지 추가 탐색
   * 개인정보보호법 → 개인정보관리책임자 이메일 법적 의무 표시
   */
  async _crawlSecondaryPages(baseUrl, result) {
    const origin = new URL(baseUrl).origin;

    // 메인 페이지에서 링크 수집
    const foundLinks = await this._extractContactLinks(baseUrl, origin);

    // 탐색 우선순위: 법적 의무 페이지 → 일반 문의 페이지
    const priorities = [
      // 개인정보처리방침 (개인정보관리책임자 이메일 반드시 포함)
      '/privacy', '/privacy-policy', '/개인정보처리방침', '/개인정보보호방침',
      '/policy/privacy', '/terms/privacy',
      // 이용약관 (간혹 이메일 포함)
      '/terms', '/이용약관',
      // 문의/연락처
      ...CONTACT_PAGE_PATHS,
    ];

    const candidates = [
      ...priorities.map(p => origin + p),
      ...foundLinks,
    ];

    const tried = new Set([baseUrl]);
    for (const url of candidates.slice(0, 8)) {
      if (tried.has(url) || result.emails.length > 0) break;
      tried.add(url);
      try {
        await this._crawlPage(url, result);
        await sleep(randomDelay(...DEFAULT_DELAY.betweenRequests));
      } catch {}
    }
  }

  async _extractContactLinks(url, origin) {
    try {
      const page = await this.session.open(url, { timeout: REQUEST_TIMEOUT });
      return await page.evaluate((origin, keywords) => {
        const links = new Set();
        document.querySelectorAll('a[href]').forEach(el => {
          const href = el.href || '';
          const text = (el.textContent + (el.title || '')).toLowerCase();
          if (keywords.some(k => text.includes(k)) && href.startsWith(origin)) {
            links.add(href.split('?')[0]);
          }
        });
        return [...links];
      }, origin, ['문의', '연락', 'contact', 'about', '고객센터', '소개', 'cs', '서비스센터']);
    } catch { return []; }
  }

  _mergeExtracted(result, ex) {
    ex.emails.forEach(e => { if (!this._isJunk(e)) result.emails.push(e); });
    ex.phones.forEach(p => result.phones.push(p));
    if (!result.kakaoChannel) result.kakaoChannel = ex.kakaoChannel;
    if (!result.naverTalk) result.naverTalk = ex.naverTalk;
    if (!result.instagram) result.instagram = ex.instagram;
    if (!result.bizRegNo && ex.bizRegNo) result.bizRegNo = ex.bizRegNo;
    if (!result.representative) result.representative = ex.representative;
    if (!result.address) result.address = ex.address;
    if (!result.companyName) result.companyName = ex.companyName;
  }

  _isJunk(email) {
    const JUNK = [
      'example.com', 'test.com', 'dummy', 'noreply', 'no-reply',
      'sentry.io', 'w3.org', 'schema.org', 'localhost',
      'cloudflare', 'amazonaws', 'facebook.com',
      'wixpress.com', 'cafe24.com', 'imweb.me', 'modoo.at',
    ];
    return JUNK.some(j => email.includes(j));
  }
}
