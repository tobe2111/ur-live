// 네이버 파워링크 광고 셀렉터 (네이버 DOM 구조 기반)
export const NAVER_SELECTORS = {
  // 파워링크 광고 컨테이너
  powerLink: {
    container: '#powerlink_top_area, #powerlink_bottom_area, .ad_area',
    item: '.bx, .advertisement_area',
    title: '.title_area a, .ad_tit',
    displayUrl: '.url_area, .ad_url',
    description: '.dsc_area, .ad_dsc',
    link: '.title_area a[href], a.lnk_tit',
  },
  // 쇼핑검색광고
  shopping: {
    container: '#shoppingResult, .shopping_ad_wrap',
    item: '.goods_item',
  },
  // 브랜드검색
  brand: {
    container: '#brand_layer',
  },
};

export const NAVER_SEARCH_URL = 'https://search.naver.com/search.naver';

export const DEFAULT_DELAY = {
  betweenRequests: [2000, 5000],  // ms (min, max)
  betweenKeywords: [5000, 10000],
  betweenPages: [3000, 7000],
  afterBlock: [30000, 60000],
};

export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

export const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// 이메일 수집에서 제외할 도메인 (스팸/자동생성 이메일)
export const EXCLUDED_EMAIL_DOMAINS = [
  'example.com', 'test.com', 'dummy.com',
  'noreply', 'no-reply', 'donotreply',
  'sentry.io', 'githubusercontent.com',
  'w3.org', 'schema.org',
];

// 이메일이 있을 가능성이 높은 페이지 경로
export const CONTACT_PAGE_PATHS = [
  '/contact', '/contact-us', '/contactus',
  '/about', '/about-us', '/aboutus',
  '/company', '/info', '/csr',
  '/고객센터', '/문의', '/연락처',
  '/support', '/help',
];

export const MAX_PAGES_PER_KEYWORD = 3;    // 키워드당 최대 페이지 수
export const MAX_URLS_PER_KEYWORD = 20;    // 키워드당 최대 광고주 URL 수
export const CONCURRENT_CRAWLERS = 3;      // 동시 크롤링 수
export const REQUEST_TIMEOUT = 15000;      // ms
