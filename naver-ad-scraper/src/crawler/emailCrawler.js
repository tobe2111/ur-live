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
 * 광고주 웹사이트 이메일/연락처 크롤러 (개선판)
 *
 * 이메일 추출 한계와 현실:
 *  - 광고주의 ~40%는 이메일을 공개하지 않음 (카카오채널/채팅으로 대체)
 *  - 일부는 이미지로 이메일 표시 → 추출 불가
 *  - 일부는 JS로 이메일 난독화 → innerText로 보완
 *
 * 수집 항목: 이메일, 전화번호, 카카오채널, 네이버톡톡, 인스타그램, 사업자등록번호
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
      bizRegNo: '',      // 사업자등록번호 (추가)
      companyName: '',
      crawledAt: new Date().toISOString(),
      status: 'pending',
      error: null,
    };

    try {
      // 메인 페이지 수집
      await this._crawlPage(url, result);

      // 이메일 없으면 문의/연락처 페이지도 탐색
      if (result.emails.length === 0) {
        await this._crawlContactPages(url, result);
      }

      result.emails = [...new Set(result.emails)];
      result.phones = [...new Set(result.phones)];

      // 이메일이 없어도 전화번호·카카오채널이 있으면 'contact_found'
      const hasAnyContact = result.emails.length > 0 || result.phones.length > 0
        || result.kakaoChannel || result.naverTalk;
      result.status = result.emails.length > 0 ? 'found'
        : hasAnyContact ? 'contact_found'
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
    } catch {
      return;
    }

    // 동적 렌더링 대기 (React/Vue SPA 대응)
    await page.waitForTimeout(2000);

    // ── Playwright evaluate()로 DOM 직접 접근 ──────────────────
    const extracted = await page.evaluate(() => {
      const emails = new Set();
      const phones = new Set();
      let kakaoChannel = '';
      let naverTalk = '';
      let instagram = '';
      let bizRegNo = '';
      let companyName = '';

      const emailPattern = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
      const phonePattern = /(?:0\d{1,2})[\s\-.]?\d{3,4}[\s\-.]?\d{4}/g;

      // ★ 전략 1 (최고 신뢰도): 푸터 영역 집중 파싱
      // 한국 전자상거래법상 사업자 정보는 반드시 하단에 표시해야 함
      // → 회사명, 사업자등록번호, 대표자, 고객센터 이메일이 여기에 있음
      const footerCandidates = [
        ...document.querySelectorAll('footer, [class*="footer"], [id*="footer"]'),
        ...document.querySelectorAll('[class*="company-info"], [class*="companyInfo"]'),
        ...document.querySelectorAll('[class*="bottom"], [id*="bottom"]'),
        ...document.querySelectorAll('[class*="법적고지"], [class*="사업자"]'),
      ];
      for (const el of footerCandidates) {
        const text = el.innerText || '';
        (text.match(emailPattern) || []).forEach(e => emails.add(e.toLowerCase()));
        (text.match(phonePattern) || []).forEach(p => phones.add(p.replace(/\s/g, '')));
        if (!bizRegNo) {
          const bizMatch = text.match(/사업자\s*(?:등록\s*)?번호\s*[:\s]*([\d]{3}[-\s]?[\d]{2}[-\s]?[\d]{5})/);
          if (bizMatch) bizRegNo = bizMatch[1].replace(/[\s-]/g, '');
        }
        if (!companyName) {
          const coMatch = text.match(/(?:상호|회사명|법인명)\s*[:\s]*([^\n,]{2,30})/);
          if (coMatch) companyName = coMatch[1].trim();
        }
      }

      // ★ 전략 2: mailto: 링크 (클릭 가능한 이메일 - 신뢰도 높음)
      document.querySelectorAll('a[href^="mailto:"]').forEach(el => {
        const email = el.href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
        if (email.includes('@')) emails.add(email);
      });

      // 전략 3: body 전체 텍스트 (innerText → JS 렌더링 결과 포함)
      const bodyText = document.body.innerText || '';
      (bodyText.match(emailPattern) || []).forEach(e => emails.add(e.toLowerCase()));
      (bodyText.match(phonePattern) || []).forEach(p => phones.add(p.replace(/\s/g, '')));

      // 전략 4: JSON-LD 구조화 데이터
      document.querySelectorAll('script[type="application/ld+json"]').forEach(el => {
        try {
          const json = JSON.stringify(JSON.parse(el.textContent));
          (json.match(emailPattern) || []).forEach(e => emails.add(e.toLowerCase()));
        } catch {}
      });

      // ★ 전략 4-b: @ 기호 주변 컨텍스트에서 이메일 추출
      // 일반 정규식으로 놓친 케이스 보완
      // 예) "이메일 : admin @company.com" (공백 포함)
      //     "cs（앳）company.co.kr" (앳 한글 표기) → 아래에서 치환
      const atBlocks = bodyText
        .replace(/\（앳\）|\[앳\]|\(at\)|\[at\]/gi, '@')   // 한글/영어 앳 표기 치환
        .replace(/\s@\s/g, '@')                              // "user @ domain" → "user@domain"
        .split('\n')
        .filter(line => line.includes('@'));

      for (const line of atBlocks) {
        (line.match(emailPattern) || []).forEach(e => emails.add(e.toLowerCase()));
      }

      // 전략 5: 카카오채널 / 네이버톡톡 / 인스타그램
      document.querySelectorAll('a').forEach(el => {
        const href = el.href || '';
        if (!kakaoChannel && (href.includes('pf.kakao.com') || href.includes('kakao.com/o/'))) kakaoChannel = href;
        if (!naverTalk && href.includes('talk.naver.com')) naverTalk = href;
        if (!instagram && href.includes('instagram.com/')) instagram = href;
      });

      // 회사명 보완
      if (!companyName) {
        companyName = (
          document.querySelector('meta[property="og:site_name"]')?.content ||
          document.querySelector('meta[name="application-name"]')?.content ||
          document.title.split(/[-|·\/]/)[0].trim()
        ).substring(0, 100);
      }

      return {
        emails: [...emails],
        phones: [...phones],
        kakaoChannel,
        naverTalk,
        instagram,
        bizRegNo,
        companyName,
      };
    });

    // 결과 병합
    extracted.emails.forEach(e => {
      if (!this._isJunkEmail(e)) result.emails.push(e);
    });
    extracted.phones.forEach(p => result.phones.push(p));
    if (!result.kakaoChannel) result.kakaoChannel = extracted.kakaoChannel;
    if (!result.naverTalk) result.naverTalk = extracted.naverTalk;
    if (!result.instagram) result.instagram = extracted.instagram;
    if (!result.bizRegNo) result.bizRegNo = extracted.bizRegNo;
    if (!result.companyName) result.companyName = extracted.companyName;

    // 이미지 이메일은 alt 텍스트에서 시도
    const htmlContent = await page.content();
    const $ = cheerio.load(htmlContent);
    $('img[alt*="@"]').each((_, el) => {
      const alt = $(el).attr('alt') || '';
      extractEmails(alt).forEach(e => {
        if (!this._isJunkEmail(e)) result.emails.push(e);
      });
    });

    await sleep(randomDelay(...DEFAULT_DELAY.betweenRequests));
  }

  async _crawlContactPages(baseUrl, result) {
    const origin = new URL(baseUrl).origin;

    // 메인 페이지에서 문의/연락처 링크 먼저 추출
    const contactLinks = await this._findContactLinks(baseUrl, origin);

    // ★ 개인정보처리방침·이용약관 페이지 우선 탐색
    // 전자상거래법/개인정보보호법 의무 고지 → 개인정보관리책임자 이메일 반드시 포함
    const legalPaths = [
      '/privacy', '/privacy-policy', '/개인정보처리방침', '/개인정보보호방침',
      '/policy/privacy', '/terms', '/이용약관',
    ];

    // 고정 경로 + 법적 페이지 + 메인 페이지에서 발견된 링크
    const candidates = [
      ...legalPaths.map(p => origin + p),   // 법적 고지 페이지 최우선
      ...CONTACT_PAGE_PATHS.map(p => origin + p),
      ...contactLinks,
    ];

    const tried = new Set([baseUrl]);
    let found = false;

    for (const url of candidates.slice(0, 6)) {
      if (tried.has(url) || found) continue;
      tried.add(url);
      try {
        const beforeCount = result.emails.length;
        await this._crawlPage(url, result);
        if (result.emails.length > beforeCount) {
          found = true;
          break;
        }
        await sleep(randomDelay(...DEFAULT_DELAY.betweenRequests));
      } catch {}
    }
  }

  async _findContactLinks(url, origin) {
    try {
      const page = await this.session.open(url, { timeout: REQUEST_TIMEOUT });
      return await page.evaluate((origin, keywords) => {
        const links = new Set();
        document.querySelectorAll('a[href]').forEach(el => {
          const href = el.href || '';
          const text = (el.textContent + (el.title || '') + (el.getAttribute('aria-label') || '')).toLowerCase();
          const isContact = keywords.some(k => text.includes(k));
          if (isContact && href.startsWith(origin) && href !== origin) {
            links.add(href.split('?')[0]);  // 쿼리스트링 제거
          }
        });
        return [...links];
      }, origin, ['문의', '연락', 'contact', 'about', '회사소개', '고객센터', 'support', '소개', '오시는길', 'cs']);
    } catch {
      return [];
    }
  }

  /**
   * 쓰레기 이메일 필터링
   * (Cloudflare, 이미지 CDN, 코드 예시 등)
   */
  _isJunkEmail(email) {
    const JUNK = [
      'example.com', 'test.com', 'dummy', 'noreply', 'no-reply', 'donotreply',
      'sentry.io', 'w3.org', 'schema.org', 'localhost', '.png', '.jpg', '.gif',
      'cloudflare', 'amazonaws', 'googlemail', 'facebook.com',
      'wixpress.com', 'cafe24.com',
    ];
    return JUNK.some(j => email.includes(j));
  }
}
