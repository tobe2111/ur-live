/**
 * Sitemap routes
 *
 * GET /sitemap.xml — SEO 검색엔진용 사이트맵 (정적 + 동적 URL)
 *
 * 🛡️ 2026-04-27: TD-006 partial split — worker/index.ts 인라인 핸들러 제거.
 */
import { Hono } from 'hono';
import { consumerVisibleProductSql } from '../../shared/db/consumer-visible-product';
import { canonicalShopPath } from '../../shared/seo/shop-canonical';
import { buildLlmsTxt } from '../../shared/seo/llms-txt'
import { AGENT_SEARCH_GATE } from '../../shared/agent-search'
import { AGENT_CHECKOUT_GATE } from '../../shared/agent-checkout'
import { settingOn } from '../utils/owner-nudges'
import { buildLlmsCatalog } from '../../shared/seo/llms-catalog'
import { REGION_DIGEST_KV_KEY, digestRowsOf } from '../../shared/seo/region-digest'
import { indexNowKeyPath, isValidIndexNowKey } from '../../shared/seo/indexnow'
import type { Env } from '@/worker/types/env';
// 🏠 본진 몰 격리 — 운영자 SaaS 몰 상품이 유어딜 도메인으로 SEO 색인되는 것을 막는다.
//   색인은 배포로 못 되돌린다(회수 시점의 통제권이 검색엔진에 있음) → 첫 몰 개설보다 먼저 들어가야 하는 가드.
//   ⚠️ worker 값(value) import 는 alias 금지 — 상대경로(esbuild worker 빌드가 alias 를 못 푼다).
import { mainScopeFor } from '../utils/consumer-scope';
// 🗺️ 2026-08-03 (대표 — 도시별 색인): 지역 URL 발행. 페이지의 `noindex` 판정과 **같은 집계**를 쓴다 —
//   따로 세면 sitemap 이 제출한 URL 을 페이지가 noindex 로 막는 모순이 생긴다(색인 신뢰도 하락).
import { computeRegionStats } from '../../features/group-buy/api/regions.routes';
import { regionPath } from '../../shared/constants/region-slugs';
import { REGION_PAGES_ENABLED } from '../../shared/feature-flags';
// 🔒 2026-10-11 실측: sitemap 이 **사업자등록증 PNG** 를 구글 이미지에 색인 요청하고 있었다(/pass/2916).
//   `products.image_url` 을 그대로 실어 보낸 탓. 서류 업로드는 어느 것도 검색엔진에 넘기지 않는다.
import { isIndexableImageUrl } from '../../shared/seo/indexable-image';
// 🏨 정본 상세 주소 SSOT — 숙소 이용권은 `/stays/:id`(상세 canonical 과 같은 함수).
import { canonicalDetailPath } from '../../shared/product-flow';
// 🎁 교환권 필터 카테고리 SSOT — canonical 이 믿는 집합과 **같은 목록**을 읽는다.
import { VOUCHER_FILTER_CATEGORIES } from '../../shared/seo/consumer-surfaces';
import { HOME_SERVICE_CATEGORIES } from '../../shared/home-service-categories';
import { lifeCategoryPath } from '../../shared/life-seo';
// 🎁 facet 주소 조립 + 재고 문턱 SSOT — canonical·허브 내부 링크와 **같은 함수**를 지난다.
import { voucherFacetPath, voucherFacetsByStock } from '../../shared/seo/voucher-facet';
import { VOUCHER_CATEGORY_SQL_IN } from '../../shared/constants/voucher-categories';

/**
 * 🎁 교환권 facet 제출 — **집계가 비었을 때의 폴백**(2026-10-18 재규정).
 *
 * 2026-07-29 ~ 2026-10-17 에는 이 셋이 **제출 목록 그 자체**였다. 그런데 라이브 실측(2026-10-18)에서
 * 교환권 **2,260건이 20종**으로 갈라져 있고 `VOUCHER_FILTER_CATEGORIES` 20종과 **정확히 일치**하며
 * **전부 재고 5건 이상**이었다 ⇒ **17종이 발견 경로 0** 이었다(sitemap 미제출 + 허브 a태그 0).
 * 게다가 이 셋은 **상위 3종도 아니었다** — 상위는 커피/음료 775 · 치킨 278 · 편의점 274 인데
 * `베이커리/도넛`(202)은 6위이고 치킨·피자(222)·버거(206)가 더 많은데 빠져 있었다. 2026-07-29 주석이
 * *"라이브 실측 상위 카테고리만 남긴 것"* 이라 적어 둔 그 실측이 **낡아 있었다.**
 *
 * ⇒ 이제 제출 목록은 **D1 집계**가 정한다(아래 facet 블록). 손으로 적은 목록은 *그 집계가 실패했을
 *   때만* 쓰인다 — 집계 실패를 "재고 0" 으로 읽어 **이미 색인된 3건을 빼는 쪽이 더 나쁘기** 때문이다
 *   (부재 ≠ 재고 0 — `region-digest.ts` 가 같은 규율을 지킨다).
 * 🔴 값은 `VOUCHER_FILTER_CATEGORIES`(canonical·제목 접두가 믿는 집합)에서 **골라 온다**. 손으로
 *   적으면 둘이 갈리고, 갈리면 *제출한 URL 의 정본이 다른 곳을 가리키는* 모순이 조용히 생긴다
 *   (2026-10-12 오전에 `/pass`↔`/stays` 로 그 대가를 치렀다).
 */
const SITEMAP_VOUCHER_FALLBACK: readonly string[] = ['편의점', '커피/음료', '베이커리/도넛']
  .filter((c) => VOUCHER_FILTER_CATEGORIES.includes(c))

/** 제출 facet 의 우선순위 — 재고 상위 3종에 가중, 나머지는 바닥값. */
function facetPriority(rank: number): number {
  return [0.75, 0.7, 0.65][rank] ?? 0.6
}

interface GroupBuyRow { id: number; category: string | null; deal_only: number | null; image_url: string | null; updated_at: string }

const sitemapRoutes = new Hono<{ Bindings: Env }>();


// 📉 2026-09-02: sitemap 은 캐시 미들웨어가 없어 Yeti/Googlebot/Bingbot·uptime 프로브가 부를 때마다 D1 을 다시 읽었다
//   (products 500+500 · sellers 200 + EXISTS 2개 · blog 100 · computeRegionStats 무제한). .xml 은 CF 기본 캐시 확장자가 아니다.
//   캐시 키가 호스트를 포함한다(2026-10-12 이후 호스트별 분기는 없다 — 도매 sitemap 제거). 미들웨어는 `worker/index.ts` 에서
//   `app.route` 앞에 건다(이 모듈은 유닛이 직접 부르므로 `caches.default` 에 묶지 않는다).
sitemapRoutes.get('/sitemap.xml', async (c) => {
  const reqUrl = new URL(c.req.url);
  const origin = reqUrl.origin;
  // 🧨 2026-10-12 [SEO] 도매(utongstart) 전용 sitemap 분기 **제거** — 대표 *"SEO 측면에서 … 모두 해줘"*.
  //   2026-06-08 에 utongstart.com 호스트면 `/wholesale`·`/intro`·`/join`·`/oem` 네 URL 을 `priority 1.0~0.7`
  //   로 발행했다. 도매몰 철거(#1710) 뒤 그 넷은 **410 Gone** 이고(`isRetiredSurface`), 게다가 그 도메인은
  //   Cloudflare 실측으로 **어느 Pages 프로젝트에도 연결돼 있지 않아** 이 sitemap 을 받을 수 있는 요청 자체가
  //   없었다. 색인해 달라고 선언하면서 410 을 주는 모순을 남기지 않기 위해 통째로 걷는다.
  //   ⚠️ 소비자(urdeal.kr) sitemap 은 무접촉 — 실측 453건에 wholesale 은 이미 0건이었다.
  const DB = c.env.DB as D1Database | undefined;
  const urls: Array<{ loc: string; priority: number; changefreq: string; image?: string; lastmod?: string }> = [
    // 정적 페이지
    { loc: '/', priority: 1.0, changefreq: 'daily' },
    // 🛍️ 2026-10-14 — 0.9 → 0.5. **본문이 43자**인데 우선순위가 `/stays`(0.85 · 439자)보다 높았다.
    //   빌더 결함이 아니다 — 소비자 쇼핑 카탈로그가 실제로 **1건**이고(`/api/products?exclude_deal_only=1`
    //   → total 1) 본문은 그 1건을 정확히 싣는다. 즉 **기계는 멀쩡하고 데이터가 없다**.
    //   거기에 쇼핑 탭은 2026-07-10 대표 결정으로 **숨김**(`SHOPPING_TAB_HIDDEN`) 상태다 ⇒ 내비에서
    //   치운 표면을 검색엔진에는 두 번째로 높은 우선순위로 밀어 넣고 있었다.
    //   ⚠️ `noindex` 로 가리지 않는다 — 카탈로그가 늘면 본문도 **저절로** 늘어나는 자가 치유형이고,
    //      색인을 버리면 쇼핑 재개 때 처음부터 쌓아야 한다(복구 수주). `/influencer/rankings`·
    //      `/partnership` 에 쓴 noindex 는 **자가 치유되지 않는** 표면에 쓴 처방이다.
    //   ⚠️ 문구로 메우는 길은 막혀 있다 — `BrowsePage.tsx` 에 옮길 산문이 **한 줄도 없다**(렌더되는
    //      한글은 `가격대`·`상세보기`·`상품명, 브랜드명`·`상품이 없습니다` 네 라벨뿐).
    //   롤백: 숫자 하나 환원(쇼핑 재개 시).
    { loc: '/browse', priority: 0.5, changefreq: 'daily' },
    // 🚫 라이브커머스 영구중단(LIVE_COMMERCE_SUSPENDED) — /live·/shorts 는 sitemap 미노출(폐기 기능 URL 크롤 방지).
    // 🔎 2026-07-28 (네이버 수집 점검): '/search' 제거 — robots.txt 가 `Disallow: /search` 로 막는데
    //   사이트맵이 제출하고 있었음(상호 모순 → 서치어드바이저/서치콘솔 '수집제한' 오류 유발, 사이트맵
    //   신뢰도 하락). '/login' 도 제거 — 로그인 폼은 색인 가치 0(검색 유입 대상 아님).
    //   ⚠️ 사이트맵에 URL 추가 시 robots.txt Disallow 와 교차 확인할 것.
    { loc: '/blog', priority: 0.6, changefreq: 'daily' },
    // 🆕 2026-07-27 모집/소개 표면 — 그간 sitemap 미등재라 **구글이 존재 자체를 몰랐음**(푸터 링크만
    //   있어 사실상 유입 0). 크리에이터 모집은 동의 리드 확보의 유일한 정문이라 우선순위 높게.
    { loc: '/creators', priority: 0.85, changefreq: 'weekly' },
    { loc: '/creators/apply', priority: 0.8, changefreq: 'weekly' },
    { loc: '/partners', priority: 0.7, changefreq: 'weekly' },
    { loc: '/about', priority: 0.6, changefreq: 'monthly' },
    // 🚫 2026-07-29: '/group-buy' 제거 — 그 라우트는 실제로 `<Navigate to="/" replace/>`(App.tsx:726)
    //   라 **콘텐츠가 없는 리다이렉트**다. 그런데 sitemap 은 priority 0.95·hourly 로 두 번째로 높게
    //   제출하고 있었다(이미 있는 '/' 와 중복 신호 + 리다이렉트 URL 제출은 수집 신뢰도를 깎는다).
    //   동네딜 목록은 홈('/')이 담당한다 — 2026-07-10 에 GroupBuyListPage 가 미라우팅으로 정리됐다.
    // 🛡️ 2026-05-21: 교환권 (KT Alpha 기프티쇼) 메인 + 주요 카테고리 명시
    { loc: '/vouchers', priority: 0.9, changefreq: 'daily' },
    // 🔎 2026-07-29 **카테고리 값 전면 교체 — 기존 6개는 전부 0건이었다(soft-404).**
    //   `/vouchers?category=` 는 **한글 표시 카테고리**로 필터하는데(VouchersPage:287, 워커 MAIN 슬롯도
    //   `&category=커피/음료`), sitemap 은 영문 슬러그(cafe·convenience·restaurant·beauty·department·
    //   mobile)를 제출하고 있었다 → 어느 상품과도 매칭되지 않아 **빈 목록 6개를 색인 요청**한 셈이다.
    //   아래는 라이브 실측(`/api/products?deal_only=1`) 상위 카테고리만 남긴 것 — 재고가 실제로 있는 값.
    //   ⚠️ 값을 바꿀 때는 반드시 라이브 분포를 다시 확인할 것(카테고리는 공급사 데이터라 바뀐다).
    //   🔗 2026-10-12: 값을 **`VOUCHER_FILTER_CATEGORIES`(SSOT)에서 골라 온다.** 종전엔 여기 손으로 적힌
    //      3개와 canonical 이 믿는 값이 따로였고, canonical 쪽은 **아무 값이나** 통과시켜
    //      `?category=테스트123` 이 자기 자신을 정본이라 선언했다(본문 43자). 이제 제출분이 허용분의
    //      **부분집합임을 구조로 보장**한다 — SSOT 에서 사라진 값은 아래 `filter` 가 떨어뜨린다.
    // 🎁 facet 은 **아래 DB 블록**이 재고를 세어 제출한다(집계 실패 시 폴백) — 2026-10-18.
    { loc: '/map', priority: 0.7, changefreq: 'daily' },
    // 🔎 2026-08-26 (대표 "SEO 도 우리 서비스에 맞게") — **메타는 있는데 사이트맵에 없던 8개 표면.**
    //   `CONSUMER_SURFACE_SEO` 에 title/description 을 갖추고, 인증 게이트도 없고, robots 도 안 막는데
    //   **사이트맵이 제출하지 않아 검색엔진이 존재 자체를 몰랐다** — 내부 링크(푸터/네비)만으로는
    //   네이버 Yeti 가 사실상 도달하지 못한다. 크롤 예산을 새로 쓰는 게 아니라, 이미 만들어 둔
    //   페이지를 발견 가능하게 만드는 것이다.
    //   ⚠️ 추가 전 확인한 것(다음에 늘릴 때도 이 3개를 볼 것):
    //     ① App.tsx 에 라우트가 실제로 있는가(`check-sitemap-routes` 가 강제)
    //     ② `ProtectedRoute` 가 아닌가 — 로그인 벽은 크롤러에게 soft-404 다
    //     ③ robots.txt 가 그 prefix 를 막고 있지 않은가(`/influencer` 는 `/influencer/` 만 차단이라 통과)
    { loc: '/stays', priority: 0.85, changefreq: 'daily' },        // 숙소 이용권 — 실재고 있는 카테고리
    { loc: '/experience', priority: 0.7, changefreq: 'daily' },    // 무료 체험단 응모 — 검색 유입 강한 키워드
    { loc: '/new-openings', priority: 0.7, changefreq: 'daily' },  // 우리 동네 새로 생긴 가게(공공 데이터)
    { loc: '/area-report', priority: 0.6, changefreq: 'weekly' },  // 상권 리포트 허브(지역별은 아래 동적 블록)
    { loc: '/influencer', priority: 0.7, changefreq: 'weekly' },   // 소개로 수익 랜딩
    { loc: '/introduce', priority: 0.6, changefreq: 'monthly' },   // 서비스 소개
    { loc: '/faq', priority: 0.6, changefreq: 'weekly' },          // FAQPage JSON-LD 보유 → 리치 결과 후보
    // 🏠 2026-10-25 사장님 생활 서비스 — 허브 + 업종 견적 페이지(요청서). 업종 목록은 SSOT 에서 파생.
    { loc: '/life', priority: 0.8, changefreq: 'weekly' },
    ...HOME_SERVICE_CATEGORIES.map((d) => ({ loc: lifeCategoryPath(d.key), priority: 0.6, changefreq: 'monthly' })),
    // 📜 약관·정책 — 유입은 적지만 **신뢰 신호**다(전자상거래 사업자 확인, 검색엔진 품질 평가).
    // 🧾 2026-10-13: 색인 대상(`CONSUMER_SURFACE_SEO` 에 항목 있고 noindex 아님)인데 제출이 빠져
    //   있던 둘. **본문이 있는 것만** 넣는다(실측 Googlebot: `/join` 134자 · `/terms/seller` 229자 —
    //   `surfaceCopyFor`·약관 본문 SSOT 가 그리고 있다). 같은 전수에서 나온 나머지 다섯은
    //   크롤러 본문이 **6자**라 제출하지 않았다(제출하면 soft-404 를 쌓는다 — 그 짝 주장이
    //   이 파일의 규율이다): `/gdpr` · `/influencer/rankings` · `/urshorts`, 그리고
    //   `/terms/influencer` · `/terms/group-buy` 는 **초안이라 noindex 로 돌렸다**.
    // 🧾 2026-10-14 — 그 다섯 중 **셋이 정리됐다**(대표 "다 해주고 머지 후 또 개선점 찾아"):
    //   · `/gdpr` 은 **본문을 얻어 제출 자격이 생겼다**(6자 → 382자. 영문 법정 문서의 `<p>` 통째
    //     문장을 `surface-copy` 로 옮겼다 — `/urshorts` 와 **같은 순서**다: 본문이 먼저, 제출은 그다음).
    //   · `/influencer/rankings` 는 **noindex 로 돌렸다** — 그 화면의 글자가 제목+라벨 **20자**뿐이고
    //     나머지는 로그인·데이터가 있어야 그려지는 표라, 본문을 **정직하게 채울 수가 없다**(사유는
    //     `consumer-surfaces.ts` 의 그 항목). 같은 질의는 `/influencer`(제출 중)가 받는다.
    //   · `/partnership` 도 **noindex** — 4줄 문의 폼이고 의도는 `/partners` 가 받는다(원래 미제출).
    //   ⇒ 남은 미제출 색인 대상은 없다. 다음에 늘릴 때도 **본문 실측 → 제출** 순서를 지킬 것.
    // 🎬 2026-10-13: `/urshorts` 는 크롤러 본문이 6자 → 465자(실측, 라이브 시드로 빌더를 돌렸다)가
    //   되어서야 제출 자격을 얻었다. 그 전에 넣으면 soft-404 를 쌓는다.
    { loc: '/urshorts', priority: 0.6, changefreq: 'daily' },
    { loc: '/join', priority: 0.5, changefreq: 'monthly' },
    { loc: '/terms/seller', priority: 0.3, changefreq: 'yearly' },
    { loc: '/terms', priority: 0.3, changefreq: 'yearly' },
    // ⚖️ 2026-10-14 — 이 둘은 **반대 방향의 짝 주장 위반**이었다: 제출은 하고 있는데 크롤러 본문이
    //   **6자**였다(라이브 Googlebot 실측 · 형제 `/terms` 는 같은 빌더로 323자). 위 2026-10-13 기록이
    //   "미제출 색인 대상" 만 훑어서 **이 방향을 한 번도 안 셌다** — 규율은 양방향이다:
    //   *제출 ⇒ 본문* 과 *본문 ⇒ 제출*. 지금은 `surface-copy` 가 각각 470자·252자를 낸다
    //   (`/refund` 는 2026-10-13 결재로 코드의 현행 규칙대로 다시 쓰인 뒤의 글이다).
    //   가드 `legal-surface-body-2026-10-14.test.ts` ③ 이 이 두 줄과 본문 길이를 **함께** 잠근다.
    { loc: '/privacy', priority: 0.3, changefreq: 'yearly' },
    { loc: '/refund', priority: 0.3, changefreq: 'yearly' },
    { loc: '/gdpr', priority: 0.3, changefreq: 'yearly' },         // 영문 개인정보·GDPR (2026-10-14 본문 382자 확보 후 제출)
    // 🧨 도매몰(유통스타트) 페이지는 여기 없다 — 2026-06-26 에 호스트 분리로 뺐고, 2026-10-11 철거(#1710)로
    //   서비스 자체가 사라졌다. 그 네 URL 은 이제 410 Gone 이다(`isRetiredSurface`). 되살리지 말 것.
  ];

  // 🎁 facet 집계가 실제로 제출한 개수. 0 이면 **집계 실패**로 보고 폴백한다 — "재고 0" 이 아니다.
  let facetsEmitted = 0;

  if (DB) {
    try {
      // 🏠 본진 몰 격리 조건(운영자 몰 상품/셀러 제외). 컬럼 부재 환경이면 빈 문자열 — 그 경우 몰 자체가 없다.
      const productScope = await mainScopeFor(DB, 'products');
      const sellerScope = await mainScopeFor(DB, 'sellers', 's');

      /* 🎁 교환권 facet 제출 — **재고를 세어 정한다**(2026-10-18, 대표 착수 승인).
       *
       * 🔑 **같은 WHERE 로 센다** — facet 본문은 `/api/products?deal_only=1&category=X`(워커 VOUCHERS
       *   슬롯 시드, `voucherFacetSeedPath`)가 만들고, 그 쿼리의 술어가 `ProductRepository.findAll`
       *   의 것이다. 여기서 다른 기준으로 세면 *제출했는데 본문이 비는* 짝 주장 위반이 생긴다
       *   (2026-10-12 에 유어샵·쇼핑 상세에서 그 대가를 치렀다). 가시성 조각은 `consumerVisibleProductSql`
       *   SSOT 를 그대로 쓴다(인라인으로 베끼면 두 벌이 된다).
       * 🔴 **`gift_catalog` JOIN 으로 세지 않는다** — `/api/vouchers/categories`(화면 칩)는 그 JOIN 을
       *   쓰는데, 실측에서 `건강/식품/주방` 3건이 거기엔 **안 걸리고** facet 에는 **걸렸다**(0 ↔ 3).
       *   제출의 짝은 *본문*이므로 본문을 만드는 쪽 기준이 맞다(그 3건은 `VOUCHER_FILTER_CATEGORIES`
       *   에 없어 canonical 이 `/vouchers` 로 통합한다 — 설계대로이고 제출되지 않는다).
       * 💰 비용: `GROUP BY` 한 번. 이 라우트는 이미 products 500+500 · sellers · blog 를 읽고
       *   `publicCache(3600)` 로 캐시된다(크롤러만 부른다). */
      const facetRows = await DB.prepare(
        `SELECT category, COUNT(*) AS n FROM products
         WHERE is_active = 1 AND deal_only = 1
           AND category IS NOT NULL AND category != ''
           AND ${consumerVisibleProductSql('products')}${productScope}
         GROUP BY category`
      ).all<{ category: string | null; n: number | null }>()
        .catch(() => ({ results: [] as Array<{ category: string | null; n: number | null }> }));
      const facets = voucherFacetsByStock(facetRows.results || []);
      facets.forEach((f, i) => {
        urls.push({ loc: voucherFacetPath(f.category), priority: facetPriority(i), changefreq: 'weekly' });
      });
      facetsEmitted = facets.length;

      // 🛡️ 2026-05-15: 진행 중 공동구매 — 가장 높은 우선순위 (시간 민감)
      // 🏨 `category`·`deal_only` 는 `canonicalDetailPath` 가 정본 주소를 정하는 데 쓴다(아래).
      const groupBuys = await DB.prepare(
        `SELECT id, category, deal_only, image_url, updated_at FROM products
         WHERE category IN (${VOUCHER_CATEGORY_SQL_IN})
           AND is_active = 1
           AND group_buy_status IN ('active','achieved')
           AND ${consumerVisibleProductSql('products')}${productScope}
         ORDER BY updated_at DESC LIMIT 500`
      ).all<GroupBuyRow>().catch(() => ({ results: [] as GroupBuyRow[] }));
      for (const g of groupBuys.results || []) {
        // 🏨 2026-10-12 (대표 "둘 다 잠금 해제하고 가장 이상적으로"): `loc` 을 **정본 주소 SSOT** 로.
        //   종전엔 전 카테고리를 `/pass/${id}` 로 하드코딩해서, 숙소 이용권 49건이 sitemap 은 `/pass/`
        //   를 제출하는데 `/stays` ItemList·`/region` 항목은 `canonicalDetailPath` 대로 `/stays/` 를
        //   가리켰다 — **같은 상품을 두 URL 로 말하는 모순 신호**다. 둘을 같은 함수로 모은다.
        const loc = canonicalDetailPath({ id: g.id, deal_only: g.deal_only, category: g.category });
        if (!loc) continue; // 판정 불가(이 쿼리 범위 밖) — 지어낸 주소를 제출하지 않는다
        urls.push({
          loc,
          priority: 0.9,
          changefreq: 'hourly',
          // 🔒 비공개 서류(사업자등록증 등)가 커버로 들어온 상품은 OG 카드로 대체 — 색인은 못 되돌린다.
          image: (isIndexableImageUrl(g.image_url) && g.image_url) || `${origin}/api/og/group-buy/${g.id}`,
          lastmod: g.updated_at,
        });
      }

      // 활성 상품 최신 500개 (voucher 카테고리는 위에서 처리됨)
      // 🔎 2026-07-29 (소비자 SEO 실측): **`deal_only = 1`(교환권) 제외 — 색인 결정 우회를 막는다.**
      //   기존 조건은 `category NOT IN (*_voucher)` 뿐이라, KT-Alpha 기프티콘처럼 카테고리가
      //   '피자'·'치킨'·'용역서비스' 인 교환권이 전부 통과했다. 실측: 제출된 500건 중 ~485건이 그것이었고
      //   (`seller_id` 없음 · 이미지 `bizimg.giftishow.com`), 소비자 쇼핑 카탈로그에는 15건뿐이었다.
      //   교환권 상세는 `/vouchers/:id` 에서 **의도적으로 noindex**(2026-07-07)인데 같은 상품을
      //   `/products/:id` 로 색인 요청하고 있었다 — 한 상품이 두 URL 로 갈려 한쪽만 막힌 상태였다.
      //   같은 커밋에서 `buildProductMeta` 도 deal_only 를 noindex 로 맞춰 두 경로가 일치한다.
      const products = await DB.prepare(
        `SELECT id FROM products
         WHERE is_active = 1
           AND COALESCE(deal_only, 0) = 0
           AND category NOT IN (${VOUCHER_CATEGORY_SQL_IN})
           AND ${consumerVisibleProductSql('products')}${productScope}
         ORDER BY id DESC LIMIT 500`
      ).all<{ id: number }>();
      for (const p of products.results || []) {
        urls.push({ loc: `/products/${p.id}`, priority: 0.8, changefreq: 'weekly' });
      }

      // 활성 셀러 공개 프로필 — 🔗 2026-06-17 유어샵 URL 통일: 연결 유저 handle 있으면 /u/{handle}(통일 canonical),
      //   없으면 기존 /s/{username} (둘 다 워커가 처리). 검색엔진이 통일 URL 을 인덱싱.
      // 🔎 2026-07-29 (대표 "소비자 SEO 점검" — 라이브 실측): **내용이 있는 유어샵만** 제출한다.
      //   실측: sitemap 의 storefront 8건이 전부 `active_products = 0` 이었고, 그중 6건은 QA 계정이었다
      //   (`테스트 상점`·`테스트상호001`·`검증상호`·`최종테스트상호`·`테스트상호4`·`최종확인상호`).
      //   `status='approved'` 만 보면 승인은 났으나 아직 아무것도 안 올린 매장까지 전부 들어온다 →
      //   크롤러는 빈 페이지를 받아 soft-404 로 집계하고 그만큼 크롤 예산이 진짜 상품에서 빠진다.
      //   ⚠️ 이름 패턴('테스트' 등)으로 거르지 않는다 — 상호에 '테스트'가 든 실제 사업자를 지우게 되고,
      //      새 QA 계정 이름은 또 다르다. **콘텐츠 유무**가 유일하게 자기유지되는 기준이다:
      //      상품 1개 이상 || 유어샵 핀 1개 이상(핀만 있는 큐레이터형 유어샵 보존 — `/u/jiwon1228` 이 그 경우).
      //      매장이 상품을 올리면 다음 sitemap 부터 자동으로 다시 들어온다(수동 관리 0).
      //   `product_pins` 는 lazy CREATE 라 없는 환경이 있을 수 있어 실패해도 뒤 블록(블로그)이 죽지 않게 catch.
      // 🩸 2026-10-14: 아래 첫 EXISTS 에만 `consumerVisibleProductSql` 이 **없었다** — 핀 분기는
      //   2026-10-12 에 같은 이유로 좁혔는데 이쪽이 빠져 있었다. 도매 원본처럼 소비자에게 안 보이는
      //   상품만 가진 매장이 통과하면 `buildSellerNoscript` 가 `''` 를 주므로 **제출한 URL 에 본문이
      //   없다**(그 짝 주장이 깨지는 세 번째 자리 — ①핀 행≠보이는 핀 ②사업자 유어샵 폴백 다음).
      // 🩸 그리고 이 주석을 처음엔 **템플릿 리터럴 안**(= SQL 본문)에 넣어 tsc 가 TS1005 로 막았다.
      //   SQL 문자열에 `//` 를 쓰면 주석이 아니라 **쿼리 텍스트**다.
      const sellers = await DB.prepare(
        `SELECT s.id AS id, s.username AS username, u.handle AS handle
           FROM sellers s LEFT JOIN users u ON u.id = s.linked_user_id
          WHERE s.status = 'approved'${sellerScope}
            AND ( EXISTS (SELECT 1 FROM products p WHERE p.seller_id = s.id AND p.is_active = 1
                            AND ${consumerVisibleProductSql('p')})
               OR EXISTS (SELECT 1 FROM product_pins pp JOIN products pq ON pq.id = pp.product_id
                           WHERE pp.user_id = s.linked_user_id AND pq.is_active = 1
                             AND ${consumerVisibleProductSql('pq')}) )
          ORDER BY s.id DESC LIMIT 200`
      ).all<{ id: number; username: string; handle: string | null }>()
        .catch(() => ({ results: [] as Array<{ id: number; username: string; handle: string | null }> }));
      // 🛍️ 2026-10-11: 아래 '유저 유어샵' 블록이 **같은 URL 을 다시 적지 않게** 내보낸 것을 기억한다.
      const emittedShopLocs = new Set<string>();
      for (const s of sellers.results || []) {
        // 🏪 2026-10-14 — 규칙은 `shared/seo/shop-canonical` 한 곳. 페이지 메타가 같은 함수를 써서
        //   **제출한 URL 과 그 페이지의 canonical 이 갈릴 수 없다**(종전엔 메타가 요청된 별칭을
        //   그대로 정본이라 말해 `/s/` 와 `/profile/` 이 서로를 모른 채 색인 경쟁했다).
        const loc = canonicalShopPath(s.handle, s.username, s.id) || `/s/${s.id}`;
        emittedShopLocs.add(loc);
        urls.push({ loc, priority: 0.7, changefreq: 'weekly' });
      }

      // 🛍️ 2026-10-11 (대표 "또 개선할 부분은?" — 라이브 실측): **사업자 아닌 유저의 유어샵이 통째로 빠져 있었다.**
      //   위 쿼리는 `FROM sellers` 로 시작한다 — 그런데 명칭 SSOT 가 *"유저 = 회원가입한 누구나.
      //   **유어샵(`/u/{handle}`) 자동 생성**"* 이라고 정의하므로, 셀러에서 출발하는 쿼리는 **구조적으로**
      //   사업자 아닌 유어샵에 닿을 수 없다(셀러 행이 아예 없다). 에러가 날 자리도 아니라 아무도 모른다.
      //   실측(D1): 핀 있는 유어샵 **4곳**(`jiwon1228` 6핀 · `jongmun` 2핀 · `user31` · `user40`) 중
      //   sitemap 이 `/u/` 로 내보낸 것은 **`user40` 하나**였다 — 그 하나만 승인 셀러가 연결돼 있어서다.
      //   즉 **3곳이 색인 요청에서 빠졌고**, 그중엔 핀이 가장 많은(6개) 유어샵이 들어 있었다.
      //   유어샵은 **공유해서 퍼지는 것**이라(2026-10-09 가 서버 첫 화면까지 그려 둔 표면) 색인 누락의
      //   대가가 가장 큰 자리다.
      //   ⚠️ 콘텐츠 기준은 위 블록과 **같다** — 핀 1개 이상. 사업자가 아니면 `products.seller_id` 로 매달린
      //      상품이 없으므로 핀이 유일한 콘텐츠다. 이름 패턴으로 거르지 않는 이유도 같다(위 ⚠️).
      //   🔑 그리고 이 기준은 **워커 첫 화면 빌더와 짝이다** — `buildCuratorFirstScreen` 은
      //      `pins.length === 0` 이면 `''` 를 돌려주므로, 핀 0 인 유어샵을 제출하면 크롤러가 받는 것은
      //      로더뿐이다(= soft-404). 핀 ≥ 1 만 내보내면 **제출한 URL 은 전부 본문이 있다.**
      //   🩸 **2026-10-12 — 그 "짝" 주장이 세 군데서 깨져 있었다**(라이브 Googlebot 실측: sitemap 이
      //      제출한 유어샵 6건 중 **5건이 본문 6자**). ① 여기서 센 것은 `product_pins` **행**인데
      //      API 의 `pins` 는 `p.is_active = 1 AND consumerVisibleProductSql` 를 통과한 것만이다 ⇒
      //      *"핀 행이 있다" ≠ "핀이 보인다"*(`/u/user31`·`/u/jongmun` 이 그 경우 — 담은 상품이
      //      비활성화됐다). ⇒ 이 EXISTS 를 **활성 상품에 매달린 핀**으로 좁혔다(상품이 다시 켜지면
      //      다음 sitemap 부터 자동 복귀 — 수동 관리 0). ② 그 빌더는 `pins.length === 0` 말고도
      //      **`linked_seller` 가 있으면** `''` 를 준다(React 가 `SellerPublicPage` 를 그리므로) —
      //      `/u/user40` 이 그 경우였고 이 주석은 그 분기를 몰랐다. ③ `/s/:username`(SELLER 슬롯)은
      //      첫 화면 빌더가 **아예 없다**. ②③ 는 sitemap 이 아니라 **본문 쪽**에서 메운다(②는
      //      `curatorNoscriptFromPayload` 폴백, ③은 `buildSellerNoscript`).
      //   ✅ **2026-10-14 — ③ 도 해소됐고, 이 주석이 그걸 몰라 거짓이 됐다.** 여기 *"페이로드에
      //      상품이 안 담겨 **미해소**"* 라고 적혀 있었는데 라이브 실측(Googlebot UA)으로 뒤집혔다:
      //      SELLER 시드에 **`products` 배열이 있고**(`/s/store_mux…` 1,178B · 1건) 본문도
      //      `/s/store_mux…` **64자** · `/s/store_mt9…` **78자**로 나온다(`buildSellerNoscript`,
      //      `worker/index.ts` 의 `ssrSlot === 'SELLER'` 폴백에 배선됨). ②도 함께 확인했다 —
      //      `/u/user40` 본문 58자(핀 1건·소개 없음 = 그 가게의 정직한 최소 본문).
      //      🧭 **고쳐진 뒤 남은 "미해소" 표기는 다음 세션을 같은 자리로 다시 보낸다**(실제로
      //      2026-10-14 세션이 이 줄을 믿고 한 사이클 다시 팠다). 해소하면 같은 커밋에서 지울 것.
      //   ⚠️ 그래도 이 블록이 **색인 요청을 줄이는** 방향이라는 점을 잊지 말 것 — 기준을 더 조이면
      //      멀쩡한 유어샵이 색인에서 빠지고 돌아오는 데 수주다. 조일 때는 **본문이 실제로 비는지**를
      //      라이브로 먼저 재고 조인다(이번이 그 순서였다).
      //   ⚠️ 몰 스코프(`mainScopeFor`)를 걸지 않는다 — `users` 에는 `mall_id` 가 없고(유저는 몰에 속하지
      //      않는다), 우리가 제출하는 것은 상품 URL 이 아니라 **유어딜 본진 표면**인 `/u/{handle}` 이다.
      //   `product_pins` 는 lazy CREATE 라 실패해도 뒤 블록이 죽지 않게 catch(위 블록과 동일).
      const shopUsers = await DB.prepare(
        `SELECT u.handle AS handle
           FROM users u
          WHERE u.handle IS NOT NULL AND TRIM(u.handle) <> ''
            AND EXISTS (SELECT 1 FROM product_pins pp JOIN products pq ON pq.id = pp.product_id
                         WHERE pp.user_id = u.id AND pq.is_active = 1
                           AND ${consumerVisibleProductSql('pq')})
          ORDER BY u.id DESC LIMIT 200`
      ).all<{ handle: string }>()
        .catch(() => ({ results: [] as Array<{ handle: string }> }));
      for (const u of shopUsers.results || []) {
        const loc = `/u/${u.handle}`;
        if (emittedShopLocs.has(loc)) continue; // 승인 셀러가 연결된 유어샵은 위에서 이미 내보냈다
        emittedShopLocs.add(loc);
        urls.push({ loc, priority: 0.7, changefreq: 'weekly' });
      }

      // 🚫 2026-07-29: 라이브 스트림 블록 제거 — **전부 404 를 제출하고 있었다.**
      //   `LIVE_COMMERCE_SUSPENDED = true`(영구 중단, 2026-06-17 대표 확정)이고 앱에 `/live` 라우트가
      //   **아예 없는데**(App.tsx·routes 전수 0건), 여기서 `live_streams` 를 읽어 `/live/{id}` 를 최대 100개,
      //   그것도 `changefreq: 'hourly'`(이 사이트맵에서 가장 잦은 주기)로 발행하고 있었다.
      //   위 정적 목록(line 52)은 "라이브커머스 영구중단 → /live·/shorts 미노출"이라고 **이미 적어 놨는데**
      //   동적 섹션만 정리에서 빠졌다 — 주석과 코드가 어긋난 채 남은 전형적인 형태다.
      //   되살릴 일이 생기면 라우트부터 복구할 것(URL 이 없으면 사이트맵 신뢰도만 깎인다).

      // 🗺️ 2026-08-03 지역 페이지 — 딜이 `REGION_INDEX_MIN_DEALS` 이상인 곳만 제출.
      //   ⚠️ 문턱을 낮추지 말 것: 빈 지역 URL 을 대량 제출하면 크롤 예산을 먹고 soft-404 로 집계되어
      //   사이트 전체 색인 품질이 깎인다. 그리고 그 손해는 배포로 되돌아오지 않는다.
      //   플래그 OFF 면 지역 URL 을 아예 발행하지 않는다(전면 롤백 경로).
      if (REGION_PAGES_ENABLED) {
        try {
          const regionStats = await computeRegionStats({ DB } as Env);
          urls.push({ loc: '/region', priority: 0.8, changefreq: 'daily' });
          for (const r of regionStats) {
            if (!r.indexable) continue;
            urls.push({ loc: regionPath({ sido: r.sido }), priority: 0.85, changefreq: 'daily' });
            for (const s of r.sigungu) {
              if (!s.indexable) continue;
              urls.push({ loc: regionPath({ sido: r.sido, sigungu: s.sigungu }), priority: 0.75, changefreq: 'daily' });
            }
          }
        } catch {
          // 집계 실패해도 나머지 sitemap 은 정상 발행 — 지역 URL 만 이번 회차에 빠진다.
        }
      }

      // 블로그 글
      // 🗓️ 2026-10-12: `updated_at` 을 함께 받아 **`lastmod`** 로 낸다 — 종전엔 블로그 22건이
      //   453개 중 `lastmod` 없는 94건에 속해, 시드 재동기화로 본문이 바뀌어도 "다시 읽어라"는
      //   신호가 0 이었다(상품 359건은 이미 `g.updated_at` 으로 내고 있었다 — 블로그만 빠졌다).
      //   🔑 같은 커밋에서 `published_at` 재작성을 멈춘 것과 **짝**이다: 발행일이 배포마다
      //   흔들리던 동안에는 어느 날짜도 신뢰할 수 없어 `lastmod` 를 붙여도 거짓이 됐다.
      const blogs = await DB.prepare(
        `SELECT slug, updated_at FROM blog_posts WHERE is_published = 1 ORDER BY id DESC LIMIT 100`
      ).all<{ slug: string; updated_at?: string }>().catch(() => ({ results: [] as { slug: string; updated_at?: string }[] }));
      for (const b of blogs.results || []) {
        if (b.slug) urls.push({ loc: `/blog/${b.slug}`, priority: 0.5, changefreq: 'monthly', lastmod: b.updated_at });
      }
    } catch {
      // DB 쿼리 실패해도 정적 URL 은 응답
    }
  }

  // 🎁 **집계가 아무것도 못 냈을 때만** 폴백 3개. DB 부재·쿼리 실패·스키마 미적용이 여기로 온다.
  //   🔴 이 방향이 중요하다 — 0 을 "재고 0" 으로 읽어 제출을 비우면 **이미 색인된 3건이 빠지고**
  //      색인은 돌아오는 데 수주다. 반대로 facet 이 하나라도 집계됐으면 그 결과를 믿는다
  //      (재고가 정말 줄어든 경우를 폴백으로 덮으면 빈 목록을 색인 요청하게 된다).
  if (facetsEmitted === 0) {
    SITEMAP_VOUCHER_FALLBACK.forEach((c, i) => {
      urls.push({ loc: voucherFacetPath(c), priority: facetPriority(i), changefreq: 'weekly' });
    });
  }

  // 🔎 2026-07-20 XML 이스케이프 — 상품 이미지 URL 의 `&`(예: ?width=836&height=607) 등이
  //   미이스케이프로 들어가면 sitemap XML 이 깨져 네이버/구글이 파싱 실패("시스템 오류").
  //   loc/image:loc 에 반드시 적용. & 를 가장 먼저 치환(이중 이스케이프 방지).
  const xmlEscape = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * 🔒 2026-10-13 — `<loc>` **마지막 방어선**: 비ASCII 를 퍼센트 인코딩한다.
 *
 * 사이트맵 규격은 `<loc>` 이 URL-escape 돼 있기를 요구한다(날것 한글은 규격 위반이다).
 * 그리고 더 나쁜 것은 **페이지가 선언하는 canonical 과 표기가 갈리는 것**이었다 —
 * 실측(2026-10-13): sitemap `/region/서울` ↔ 페이지 canonical `/region/%EC%84%9C%EC%9A%B8`.
 * 조립은 `regionPath` 한 곳으로 모았고(그게 근본 처방), 이 함수는 **새 경로가 또 날것으로
 * 들어오는 것**을 막는 그물이다.
 *
 * ⚠️ 멱등이다 — 이미 인코딩된 문자열은 전부 ASCII 라 그대로 지난다(`%` 가 `%25` 로 두 번
 *    인코딩되지 않는다). 그래서 `encodeURI`/`encodeURIComponent` 를 통째로 쓰지 않는다:
 *    전자는 이미 인코딩된 `%EC` 를 다시 먹고, 후자는 `:`·`/`·`?` 까지 깨뜨린다.
 */
function asciiLoc(u: string): string {
  // eslint-disable-next-line no-control-regex
  return u.replace(/[^\x00-\x7F]/g, (ch) => encodeURIComponent(ch));
}

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(u => {
    // 🔒 초크포인트 — 출처가 무엇이든 여기를 지나야 `<image:loc>` 가 된다.
    //   위 공구 분기에도 같은 판정이 있지만 **그건 대체(OG 카드)용**이고 이 줄이 마지막 방어다.
    const rawImg = u.image ? (u.image.startsWith('http') ? u.image : origin + u.image) : '';
    const imgLoc = isIndexableImageUrl(rawImg) ? rawImg : '';
    const imageBlock = imgLoc ? `\n    <image:image><image:loc>${xmlEscape(imgLoc)}</image:loc></image:image>` : '';
    const lastmodBlock = u.lastmod ? `\n    <lastmod>${xmlEscape(u.lastmod.replace(' ', 'T'))}Z</lastmod>` : '';
    return `  <url>\n    <loc>${xmlEscape(asciiLoc(origin + u.loc))}</loc>${lastmodBlock}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>${imageBlock}\n  </url>`;
  }).join('\n')}
</urlset>`;

  return c.body(xml, 200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  });
});

export { sitemapRoutes };

// 🤖 2026-10-12 (대표 "나머진 다 해줘"): `/llms.txt` — AI 에이전트·검색이 읽는 사이트 요약.
//   종전 404. 내용은 전부 SSOT(`CONCEPT_ABOUT_LINES`·`CONCEPT_FAQ`·`CONSUMER_SURFACE_SEO`)에서
//   생성한다 — 손으로 적으면 화면·구조화 데이터와 어긋나는 네 번째 사본이 된다.
//   `sitemapRoutes` 에 얹은 이유: `app.route('/', sitemapRoutes)` 라 `worker/index.ts` 무접촉이다.
sitemapRoutes.get('/llms.txt', async (c) => {
  // 🤖 2026-10-20 — AI 비서 검색 창구가 켜져 있으면 그 주소도 적는다(꺼지면 안 적는다 — 404 를 가리키지 않는다).
  const DB = c.env.DB
  const [agentSearch, agentCheckout] = DB
    ? await Promise.all([AGENT_SEARCH_GATE, AGENT_CHECKOUT_GATE].map(k => settingOn(DB, k).catch(() => false)))
    : [false, false]
  const body = buildLlmsTxt(new URL(c.req.url).origin, { agentSearch, agentCheckout })
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // robots.txt 와 같은 성격 — 자주 안 바뀌고 크롤러가 반복해 읽는다.
      'Cache-Control': 'public, max-age=3600',
    },
  })
})

// 🗂️ 2026-10-19 (대표 *"AI 비서들이 참고하는 '할인 이용권 공급처' 를 목표로"*): `/llms-full.txt` — 지금 살 수 있는
//   이용권 목록. cron 이 매시 올려 두는 지역 요약(KV)만 읽는다(DB 조회 0). 근거·규율: `shared/seo/llms-catalog.ts`.
//   🔴 요약이 없으면(KV 미바인딩·cron 전) **빈 목록을 내지 않는다** — "파는 게 없다" 는 거짓말이 된다. 503 + 짧은 재시도.
/** epoch ms → 'YYYY-MM-DD HH:MM' (한국시간). 기계가 읽기 쉬운 고정 형식 — 로케일 문자열은 런타임마다 다르다. */
const CATALOG_TYPE = 'text/plain; charset=utf-8'
function kstStamp(ms: number): string {
  return new Date(ms + 9 * 3600_000).toISOString().slice(0, 16).replace('T', ' ')
}
sitemapRoutes.get('/llms-full.txt', async (c) => {
  const origin = new URL(c.req.url).origin
  let raw: string | null = null
  let at: number | null = null
  try {
    const r = await c.env.CACHE_KV?.getWithMetadata<{ at?: number }>(REGION_DIGEST_KV_KEY)
    raw = r?.value ?? null
    at = typeof r?.metadata?.at === 'number' ? r.metadata.at : null
  } catch { raw = null }
  const body = raw ? buildLlmsCatalog(digestRowsOf(raw), origin, at ? kstStamp(at) : null) : null
  if (!body) {
    return new Response(`# 유어딜 할인 이용권 목록\n${origin}\n\n목록을 갱신하는 중입니다. 잠시 뒤 다시 읽어 주세요. 지금은 지역 페이지(${origin}/region)와 지도(${origin}/map)에서 볼 수 있습니다.\n`, {
      status: 503,
      headers: { 'Content-Type': CATALOG_TYPE, 'Retry-After': '600', 'Cache-Control': 'no-store' },
    })
  }
  return new Response(body, {
    headers: {
      'Content-Type': CATALOG_TYPE,
      // 요약이 매시 갱신되므로 엣지에 30분까지 — 그 이상 두면 기준 시각이 낡는다.
      'Cache-Control': 'public, max-age=600, s-maxage=1800',
    },
  })
})

// 🔔 2026-10-14 (대표 "다 해주고"): IndexNow **소유 증명 키 파일**.
//   규격상 `https://<host>/<key>.txt` 에 그 키가 그대로 적혀 있어야 제출이 접수된다.
//   🔑 **키는 비밀이 아니다** — 공개되는 것이 규격이고, 그래서 env 값을 그대로 돌려준다.
//   `/{무엇}.txt` 를 통째로 잡지 않고 **env 키와 정확히 같은 이름일 때만** 응답한다 —
//   안 그러면 `/robots.txt`·`/llms.txt`·몰 슬러그와 다툰다.
//   ⚠️ 게이트(`INDEXNOW_ENABLED`)와 무관하게 응답한다: 키 파일이 먼저 있어야 대표가 게이트를
//     켠 **그 순간** 제출이 접수된다(파일이 없으면 첫 제출이 통째로 거절된다).
sitemapRoutes.get('/:file{[A-Za-z0-9-]{8,128}\\.txt}', (c) => {
  const key = (c.env.INDEXNOW_KEY || '').trim()
  if (!isValidIndexNowKey(key) || c.req.path !== indexNowKeyPath(key)) return c.notFound()
  return new Response(key, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  })
})
