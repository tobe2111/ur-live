/**
 * Sitemap routes
 *
 * GET /sitemap.xml — SEO 검색엔진용 사이트맵 (정적 + 동적 URL)
 *
 * 🛡️ 2026-04-27: TD-006 partial split — worker/index.ts 인라인 핸들러 제거.
 */
import { Hono } from 'hono';
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
    { loc: '/browse', priority: 0.9, changefreq: 'daily' },
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
    { loc: `/vouchers?category=${encodeURIComponent('편의점')}`, priority: 0.75, changefreq: 'weekly' },
    { loc: `/vouchers?category=${encodeURIComponent('커피/음료')}`, priority: 0.7, changefreq: 'weekly' },
    { loc: `/vouchers?category=${encodeURIComponent('베이커리/도넛')}`, priority: 0.65, changefreq: 'weekly' },
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
    // 📜 약관·정책 — 유입은 적지만 **신뢰 신호**다(전자상거래 사업자 확인, 검색엔진 품질 평가).
    { loc: '/terms', priority: 0.3, changefreq: 'yearly' },
    { loc: '/privacy', priority: 0.3, changefreq: 'yearly' },
    { loc: '/refund', priority: 0.3, changefreq: 'yearly' },
    // 🧨 도매몰(유통스타트) 페이지는 여기 없다 — 2026-06-26 에 호스트 분리로 뺐고, 2026-10-11 철거(#1710)로
    //   서비스 자체가 사라졌다. 그 네 URL 은 이제 410 Gone 이다(`isRetiredSurface`). 되살리지 말 것.
  ];

  if (DB) {
    try {
      // 🏠 본진 몰 격리 조건(운영자 몰 상품/셀러 제외). 컬럼 부재 환경이면 빈 문자열 — 그 경우 몰 자체가 없다.
      const productScope = await mainScopeFor(DB, 'products');
      const sellerScope = await mainScopeFor(DB, 'sellers', 's');

      // 🛡️ 2026-05-15: 진행 중 공동구매 — 가장 높은 우선순위 (시간 민감)
      const groupBuys = await DB.prepare(
        `SELECT id, image_url, updated_at FROM products
         WHERE category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')
           AND is_active = 1
           AND group_buy_status IN ('active','achieved')
           AND NOT (COALESCE(is_supply_product,0) = 1 AND COALESCE(supply_source_id,0) = 0)${productScope}
         ORDER BY updated_at DESC LIMIT 500`
      ).all<{ id: number; image_url: string | null; updated_at: string }>().catch(() => ({ results: [] as Array<{ id: number; image_url: string | null; updated_at: string }> }));
      for (const g of groupBuys.results || []) {
        urls.push({
          loc: `/pass/${g.id}`,
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
           AND category NOT IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')
           AND NOT (COALESCE(is_supply_product,0) = 1 AND COALESCE(supply_source_id,0) = 0)${productScope}
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
      const sellers = await DB.prepare(
        `SELECT s.id AS id, s.username AS username, u.handle AS handle
           FROM sellers s LEFT JOIN users u ON u.id = s.linked_user_id
          WHERE s.status = 'approved'${sellerScope}
            AND ( EXISTS (SELECT 1 FROM products p WHERE p.seller_id = s.id AND p.is_active = 1)
               OR EXISTS (SELECT 1 FROM product_pins pp WHERE pp.user_id = s.linked_user_id) )
          ORDER BY s.id DESC LIMIT 200`
      ).all<{ id: number; username: string; handle: string | null }>()
        .catch(() => ({ results: [] as Array<{ id: number; username: string; handle: string | null }> }));
      // 🛍️ 2026-10-11: 아래 '유저 유어샵' 블록이 **같은 URL 을 다시 적지 않게** 내보낸 것을 기억한다.
      const emittedShopLocs = new Set<string>();
      for (const s of sellers.results || []) {
        const loc = s.handle ? `/u/${s.handle}` : `/s/${s.username || s.id}`;
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
      //   ⚠️ 몰 스코프(`mainScopeFor`)를 걸지 않는다 — `users` 에는 `mall_id` 가 없고(유저는 몰에 속하지
      //      않는다), 우리가 제출하는 것은 상품 URL 이 아니라 **유어딜 본진 표면**인 `/u/{handle}` 이다.
      //   `product_pins` 는 lazy CREATE 라 실패해도 뒤 블록이 죽지 않게 catch(위 블록과 동일).
      const shopUsers = await DB.prepare(
        `SELECT u.handle AS handle
           FROM users u
          WHERE u.handle IS NOT NULL AND TRIM(u.handle) <> ''
            AND EXISTS (SELECT 1 FROM product_pins pp WHERE pp.user_id = u.id)
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
      const blogs = await DB.prepare(
        `SELECT slug FROM blog_posts WHERE is_published = 1 ORDER BY id DESC LIMIT 100`
      ).all<{ slug: string }>().catch(() => ({ results: [] as { slug: string }[] }));
      for (const b of blogs.results || []) {
        if (b.slug) urls.push({ loc: `/blog/${b.slug}`, priority: 0.5, changefreq: 'monthly' });
      }
    } catch {
      // DB 쿼리 실패해도 정적 URL 은 응답
    }
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

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(u => {
    // 🔒 초크포인트 — 출처가 무엇이든 여기를 지나야 `<image:loc>` 가 된다.
    //   위 공구 분기에도 같은 판정이 있지만 **그건 대체(OG 카드)용**이고 이 줄이 마지막 방어다.
    const rawImg = u.image ? (u.image.startsWith('http') ? u.image : origin + u.image) : '';
    const imgLoc = isIndexableImageUrl(rawImg) ? rawImg : '';
    const imageBlock = imgLoc ? `\n    <image:image><image:loc>${xmlEscape(imgLoc)}</image:loc></image:image>` : '';
    const lastmodBlock = u.lastmod ? `\n    <lastmod>${xmlEscape(u.lastmod.replace(' ', 'T'))}Z</lastmod>` : '';
    return `  <url>\n    <loc>${xmlEscape(origin + u.loc)}</loc>${lastmodBlock}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>${imageBlock}\n  </url>`;
  }).join('\n')}
</urlset>`;

  return c.body(xml, 200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  });
});

export { sitemapRoutes };
