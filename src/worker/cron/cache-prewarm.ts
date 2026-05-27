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

interface PrewarmEnv {
  FRONTEND_URL?: string;
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
  '/api/banners',
  '/api/group-buy/products',
  // 🛡️ 2026-05-27 (loading P0): SSR inject key 와 정확히 일치 (path+query).
  //   이 key 를 cron 이 warm 하지 않으면 readKvCacheForSSR miss → 첫 사용자 skeleton.
  '/api/group-buy/products?status=active&category=all',
  // VouchersPage / BrowsePage SSR inject 대응 — first-paint warm 유지.
  '/api/products?page=1&limit=20&deal_only=1&sort=price_low',
  '/api/products?page=1&limit=20&exclude_deal_only=1',
  // 🛡️ 2026-05-27: VouchersPage 카테고리 칩 — 2번째 endpoint warm 유지.
  '/api/vouchers/categories',
  '/api/group-buy/live-ticker',
  '/api/sections',
  '/api/shorts',
  '/api/currency/rates',
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
}
