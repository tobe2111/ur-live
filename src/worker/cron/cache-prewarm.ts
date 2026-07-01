/**
 * Cache Pre-warm Cron
 *
 * 🛡️ 2026-05-23 (Task 3): 배포 후 / cache expire 후 첫 사용자의 cold-start 제거.
 *
 * 문제:
 *   - 새 배포 시 모든 cache 비어있음 → 첫 사용자가 D1 hit (수백 ms 대기).
 *   - Hot endpoint (홈 / 상품 목록 / 공구) 의 TTL 이 expire 되면 같은 문제 재발.
 *
 * 해결:
 *   5분 cron 에서 hot endpoint 들을 fetch → publicCache 가 자동으로 edge + KV 채움.
 *   결과: 항상 cache 가 warm 상태 → 사용자는 절대 D1 cold-start 안 만남.
 *
 * 비용:
 *   - 5분마다 10개 GET = 일 2880 req → KV write 일 ~2880 회 (무료 한도 1000/day 초과 가능).
 *   - publicCache 의 KV TTL = edge TTL × 6. 5분 주기 prewarm 이면
 *     edge TTL 5분+ 인 endpoint 는 자연스럽게 다음 prewarm 까지 hit.
 *   - 너무 빈번하면 KV write 한도 초과 — endpoint 수와 빈도 균형 필요.
 *
 * 향후 튜닝:
 *   - 새 페이지 추가 시 HOT_PATHS 에 가장 트래픽 많은 endpoint 추가
 *   - KV write 한도 도달 시 prewarm 주기 줄이거나 (10-15분) endpoint 수 줄임
 */

import { logInfo, logError } from '../utils/logger';
import { normalizeSupplyProductData } from '../../features/supply/api/supply-visibility';

interface PrewarmEnv {
  FRONTEND_URL?: string;
  DB?: D1Database;
}

/**
 * 핵심 hot endpoint 목록 — 5분마다 fetch 해서 cache warm 유지.
 *
 * 선정 기준:
 *   1) 메인 페이지에서 즉시 호출되는 endpoint
 *   2) D1 query 부하 큰 endpoint (multiple JOIN, COUNT)
 *   3) edge cache TTL ≥ 60s 인 endpoint (5분 prewarm 주기와 정합)
 */
const HOT_PATHS: readonly string[] = [
  '/api/home/bundle',
  '/api/home/categories',
  '/api/products?limit=20',
  '/api/streams',
  '/api/streams?status=live&limit=10',
  // 🛡️ 2026-05-27 (Step P1-2): LiveListPage SSR key 와 정확히 일치.
  '/api/streams?status=live&limit=20',
  '/api/banners',
  '/api/group-buy/products',
  // 🛡️ 2026-05-27 (loading P0): SSR inject key 와 정확히 일치 (path+query).
  //   이 key 를 cron 이 warm 하지 않으면 readKvCacheForSSR miss → 첫 사용자 skeleton.
  '/api/group-buy/products?status=active&category=all',
  // 🛡️ 2026-06-04 [LOADING_ADDITIVE]: 동네딜(/group-buy) SSR 슬롯 key — 클라 요청과 정확히 일치.
  '/api/group-buy/products?status=active',
  // 🏭 2026-06-10 [LOADING_ADDITIVE]: SPA 진입(하단바 탭) 시 클라가 쏘는 실제 key — limit=200 라이브쿼리.
  //   SSR 미주입 경로(대부분의 탭 진입)가 이 key 로 fetch → cron warm 으로 cold D1 제거.
  '/api/group-buy/products?status=active&limit=200',
  // 🏭 2026-06-04 [LOADING_ADDITIVE]: 동네딜 '유저 공구'(community) 탭 — 클라 요청과 정확히 일치.
  //   30s 엣지캐시라 organic 방문 사이 만료 → cold D1. 5분 cron warm 으로 탭 전환 즉시 응답.
  '/api/community-group-buy/list?status=proposed&sort=popular&limit=20',
  // 🏭 2026-06-10 [LOADING_ADDITIVE] (사용자 신고 — 도매몰 상품 느림): guest 카탈로그/배너/몰 브랜딩 warm.
  //   카탈로그 클라 기본 요청은 trailing '?' (`/api/wholesale/catalog?`) — 캐시키 정확 일치 위해 두 형태 모두.
  '/api/wholesale/catalog?',
  '/api/wholesale/catalog',
  '/api/wholesale/banners',
  '/api/wholesale/mall',
  '/api/wholesale/board/posts?type=notice',
  // 🛡️ 2026-05-27 (loading P1): 메인 카테고리 칩 4개 prewarm — 칩 클릭 시 cold D1 회피.
  //   카테고리 정의: GroupBuyFeed.tsx CATEGORIES (meal/stay/beauty/etc).
  '/api/group-buy/products?status=active&category=meal_voucher',
  '/api/group-buy/products?status=active&category=stay_voucher',
  '/api/group-buy/products?status=active&category=beauty_voucher',
  '/api/group-buy/products?status=active&category=etc_voucher',
  // VouchersPage / BrowsePage SSR inject 대응 — first-paint warm 유지.
  '/api/products?page=1&limit=20&deal_only=1&sort=price_low',
  '/api/products?page=1&limit=20&exclude_deal_only=1',
  // 🏭 2026-06-04 [LOADING_ADDITIVE]: 홈(MAIN 슬롯) 기본 카테고리 = '커피/음료' SSR key.
  //   worker/index.ts MAIN 슬롯 path + 클라(URLSearchParams) 인코딩과 1:1 일치 (%2F/%EC..).
  //   이 key 를 warm 하지 않으면 홈 첫 사용자 SSR miss → skeleton.
  '/api/products?page=1&limit=20&deal_only=1&sort=price_low&category=%EC%BB%A4%ED%94%BC%2F%EC%9D%8C%EB%A3%8C',
  // 🛡️ 2026-05-27: VouchersPage 카테고리 칩 — 2번째 endpoint warm 유지.
  '/api/vouchers/categories',
  '/api/group-buy/live-ticker',
  '/api/sections',
  '/api/shorts',
  '/api/currency/rates',
  // 📝 2026-07-01: 블로그 공개 목록 — 이 fetch 가 maybeSyncBlogSeed() 를 트리거해 배포 후
  //   버전 재시드를 cron 이 먼저 수행(첫 방문자 콜드 동기화 제거) + 공개 목록 캐시 warm.
  '/api/blog/public',
] as const;

/**
 * 모든 hot endpoint 를 fetch 하여 publicCache 가 edge + KV 를 채우게 함.
 *
 * 5분 cron 의 일부로 호출. 에러 발생해도 다른 cron 작업에 영향 없도록 try-catch.
 *
 * fetch 는 자기 자신 (FRONTEND_URL) 을 호출 — Cloudflare Worker 의 sub-request 로 카운트.
 * 무료 plan 의 sub-request 한도 (50 req/invocation) 안에 안전히 들어옴.
 */
export async function handleCachePrewarm(env: PrewarmEnv): Promise<void> {
  const baseUrl = env.FRONTEND_URL || 'https://live.ur-team.com';

  // 🏎️ 2026-06-19 (A: 카탈로그 행 근본수정): products 정규화를 읽기 경로에서 빼 cron 으로 이전.
  //   self-fetch(아래 HOT_PATHS) 보다 먼저 실행 → 정규화된 데이터로 캐시/ KV 워밍. 멱등·실패 무시.
  if (env.DB) {
    await normalizeSupplyProductData(env.DB).catch(() => { /* best-effort */ });
  }

  let success = 0;
  let failed = 0;

  // 병렬 fetch — 5분 cron 안에서 충분히 처리
  await Promise.all(
    HOT_PATHS.map(async (path) => {
      try {
        const url = `${baseUrl}${path}`;
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            // 'cf-cache-prewarm' header 는 analytics 에서 prewarm 트래픽 구분용
            'User-Agent': 'ur-live-cache-prewarm/1.0',
            'x-prewarm': '1',
          },
          // 같은 worker 가 응답해도 OK — publicCache 가 자동으로 edge + KV 채움
          cf: {
            // 새 응답을 받기 위해 cache 우회 X — 오히려 cache 채우기가 목적
            cacheTtl: 0,
            cacheEverything: false,
          },
        } as RequestInit & { cf?: Record<string, unknown> });
        if (res.ok) {
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }),
  );

  if (failed > 0) {
    logError(`[cron:cache-prewarm] partial failure`, { success, failed, total: HOT_PATHS.length });
  } else {
    logInfo(`[cron:cache-prewarm] warmed ${success}/${HOT_PATHS.length} paths`);
  }

  // 🏭 2026-06-18 (전수조사 — 도매 카탈로그 cold/느림 근본원인): caches.default 는 요청 URL의 origin 으로
  //   키가 갈린다. 위 prewarm 은 FRONTEND_URL(=live.ur-team.com) origin 만 데우는데, 실제 도매 사용자는
  //   utongstart.com 호스트로 접속 → /catalog 핸들러의 early-match/put 키가 utongstart origin 이라
  //   prewarm 이 채운 live origin 캐시와 영영 불일치 → utongstart 도매몰은 prewarm 혜택 0(매 요청 cold D1).
  //   도매 전용 path 만 utongstart origin 으로도 한 번 더 데운다(additive, HOT 24+dynamic≈20+WS 5 ≈ 49 < 50).
  //   단일 몰(mall 1)이라 응답 내용 동일 — origin 키만 추가로 채움. 실패해도 무시(저영향).
  const WS_PREWARM_PATHS: readonly string[] = [
    '/api/wholesale/catalog?',
    '/api/wholesale/catalog',
    '/api/wholesale/banners',
    '/api/wholesale/mall',
  ];
  const WS_PREWARM_ORIGINS = ['https://utongstart.com'];
  await Promise.all(
    WS_PREWARM_ORIGINS.flatMap((origin) =>
      WS_PREWARM_PATHS.map(async (path) => {
        try {
          await fetch(`${origin}${path}`, {
            method: 'GET',
            headers: { 'User-Agent': 'ur-live-cache-prewarm/1.0', 'x-prewarm': '1' },
            cf: { cacheTtl: 0, cacheEverything: false },
          } as RequestInit & { cf?: Record<string, unknown> });
        } catch { /* prewarm best-effort */ }
      }),
    ),
  );

  // 🛡️ 2026-05-27 (loading P0): 인기 셀러 + 인기 상품 detail dynamic prewarm.
  //   메인/카테고리 페이지에서 가장 많이 클릭되는 detail / 셀러 페이지 미리 채움.
  //   첫 사용자도 SSR inject hit 보장 → 0 RTT first paint.
  //   sub-request 한도 50/invocation 안전 (HOT 13 + dynamic 20 = 33).
  if (env.DB) {
    try {
      // Top 10 인기 셀러 (recent 30일 매출 기준 — 없으면 sellers.id 최신순 fallback)
      const sellersResult = await env.DB.prepare(
        `SELECT id, username FROM sellers
          WHERE status = 'approved' AND username IS NOT NULL AND username != ''
          ORDER BY id DESC LIMIT 10`
      ).all<{ id: number; username: string }>().catch(() => ({ results: [] as { id: number; username: string }[] }))
      // 🛡️ 2026-05-27: Top 10 큐레이터 (핀 가진 user) — /u/:handle 페이지 warm.
      const curatorsResult = await env.DB.prepare(
        `SELECT u.handle FROM users u
          WHERE u.handle IS NOT NULL AND u.handle != ''
            AND EXISTS (SELECT 1 FROM product_pins pp WHERE pp.user_id = u.id)
          ORDER BY u.id DESC LIMIT 10`
      ).all<{ handle: string }>().catch(() => ({ results: [] as { handle: string }[] }))
      // Top 10 활성 공구 (group_buy_status='active' + sold_count DESC)
      const productsResult = await env.DB.prepare(
        `SELECT id FROM products
          WHERE is_active = 1 AND (group_buy_status = 'active' OR deal_only = 1)
          ORDER BY COALESCE(sold_count, 0) DESC, created_at DESC LIMIT 10`
      ).all<{ id: number }>().catch(() => ({ results: [] as { id: number }[] }))

      const dynamicPaths: string[] = []
      for (const s of sellersResult.results ?? []) {
        if (s.username) dynamicPaths.push(`/api/sellers/${s.username}/public`)
        // 🛡️ 2026-06-04 [LOADING_ADDITIVE]: 링크샵 기본탭(상품) sub-data warm — SellerPublicPage 첫 진입 cold D1 제거.
        if (Number.isFinite(s.id)) dynamicPaths.push(`/api/products?seller_id=${s.id}&limit=20`)
      }
      for (const p of productsResult.results ?? []) {
        if (Number.isFinite(p.id)) dynamicPaths.push(`/api/group-buy/products/${p.id}`)
      }
      for (const c of curatorsResult.results ?? []) {
        if (c.handle) dynamicPaths.push(`/api/curator/${c.handle}`)
      }

      let dynSuccess = 0, dynFailed = 0
      await Promise.all(
        dynamicPaths.map(async (path) => {
          try {
            const r = await fetch(`${baseUrl}${path}`, {
              method: 'GET',
              headers: { 'User-Agent': 'ur-live-cache-prewarm/1.0', 'x-prewarm': '1' },
            })
            if (r.ok) dynSuccess++; else dynFailed++
          } catch { dynFailed++ }
        })
      )
      if (dynamicPaths.length > 0) {
        logInfo(`[cron:cache-prewarm] dynamic warmed ${dynSuccess}/${dynamicPaths.length} (sellers + products detail)`)
      }
    } catch (e) {
      logError('[cron:cache-prewarm] dynamic prewarm failed', { error: String(e) })
    }
  }
}
