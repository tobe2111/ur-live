/**
 * 🗺️ 2026-08-03 (대표 — "도시별로도 보이게 + 구글에 페이지가 쭉 나오게"): 지역별 딜 집계.
 *
 * `app.route('/api/regions', regionsRoutes)` 에 등록.
 * ⚠️ 이 파일 내부 경로에 `/api/regions` 를 포함하지 말 것(더블 prefix).
 *
 * 왜 별도 파일인가: `group-buy-public.routes.ts` 는 로딩 최적화 잠금 파일이다
 * (Cache-Control/CDN-Cache-Control 분리 · tiers 서버 parse · SSR 0-RTT 캐시키).
 * 여기에 엔드포인트를 얹으면 그 잠금 표면을 매번 건드리게 되므로 파일을 나눈다.
 *
 * 왜 하나의 SSOT 인가: **지역 페이지 · 지역 인덱스 · sitemap · noindex 판정**이 전부
 * "이 지역에 딜이 몇 개인가"에 걸려 있다. 각자 세면 반드시 갈라진다 —
 * sitemap 이 제출한 URL 이 페이지에선 0건이면 그게 곧 soft-404 이고, 크롤 예산만 태운다.
 *
 * 집계 정의는 홈 피드(`group-buy-public.routes.ts` GET /products)의 WHERE 와 **일치시킨다**:
 *   category ∈ VOUCHER_CATEGORIES · is_active=1 · group_buy_status='active'
 *   · 도매 원본 제외
 * 여기에 **데모 딜 제외**를 추가한다 — 데모는 홈에서 후순위로 밀릴 뿐 목록엔 남지만,
 * 색인 판정에 세면 **가짜 상품으로 thin 지역이 색인 문턱을 넘는다**(색인은 되돌리기 비싸다).
 */

import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { cacheGet } from '@/worker/utils/cache'
import { safeError } from '@/worker/utils/safe-error'
import { VOUCHER_CATEGORIES } from '@/shared/constants/voucher-categories'
import { demoSlugSql } from '@/shared/constants/demo-products'
import { mainScopeFor } from '@/worker/utils/consumer-scope'
import {
  parseRegionFromAddress,
  REGION_INDEX_MIN_DEALS,
  SIDO_LIST,
  type SidoStat,
  type SigunguStat,
} from '@/shared/constants/region-slugs'

export const regionsRoutes = new Hono<{ Bindings: Env }>()

/** 지역 집계 — 라우트/sitemap 이 공유하는 순수 계산부(워커 안에서 직접 호출 가능). */
export async function computeRegionStats(env: Env): Promise<SidoStat[]> {
  // 🏠 본진 몰 격리 — 운영자 SaaS 몰(`mall_id`) 상품이 유어딜 지역 집계에 섞이면
  //   **그 상품 기준으로 sitemap 지역 URL 이 발행된다.** 색인은 배포로 못 되돌리므로
  //   (회수 시점의 통제권이 검색엔진에 있다) 집계 단계에서 막는다.
  //   ⚠️ 2026-08-03 `sitemap-mall-scope` 테스트가 이 누락을 잡았다 — 처음엔 없었다.
  //   홈 피드(group-buy-public)는 아직 이 조건이 없어 집계가 피드보다 **조금 보수적**일 수 있는데,
  //   방향이 안전하다(과소집계 → 빈 URL 을 제출하지 않음). 반대였다면 빈 페이지를 색인 요청하게 된다.
  const productScope = await mainScopeFor(env.DB, 'products', 'p')
  const rows = await env.DB.prepare(`
    SELECT p.restaurant_address AS addr
    FROM products p
    WHERE p.category IN (${VOUCHER_CATEGORIES.map(() => '?').join(',')})
      AND p.is_active = 1
      AND p.group_buy_status = 'active'
      AND NOT (COALESCE(p.is_supply_product,0) = 1 AND COALESCE(p.supply_source_id,0) = 0)
      AND NOT ${demoSlugSql('p')}
      AND p.restaurant_address IS NOT NULL
      AND TRIM(p.restaurant_address) <> ''${productScope}
  `).bind(...VOUCHER_CATEGORIES).all<{ addr: string }>()

  // 주소 → {시도, 시군구} 파싱은 클라이언트 필터와 **같은 함수**를 쓴다.
  // 서버가 세는 규칙과 페이지가 거르는 규칙이 다르면 "25개라더니 20개"가 난다.
  const bySido = new Map<string, { count: number; sigungu: Map<string, number> }>()
  for (const r of rows.results ?? []) {
    const ref = parseRegionFromAddress(r.addr)
    if (!ref) continue
    let entry = bySido.get(ref.sido)
    if (!entry) { entry = { count: 0, sigungu: new Map() }; bySido.set(ref.sido, entry) }
    entry.count += 1
    if (ref.sigungu) entry.sigungu.set(ref.sigungu, (entry.sigungu.get(ref.sigungu) ?? 0) + 1)
  }

  // SIDO_LIST 순서 고정 — 응답 순서가 요청마다 흔들리면 캐시·스냅샷 테스트가 불안정해진다.
  const out: SidoStat[] = []
  for (const sido of SIDO_LIST) {
    const entry = bySido.get(sido)
    if (!entry) continue
    const sigungu: SigunguStat[] = [...entry.sigungu.entries()]
      .map(([name, count]) => ({ sigungu: name, count, indexable: count >= REGION_INDEX_MIN_DEALS }))
      .sort((a, b) => b.count - a.count || a.sigungu.localeCompare(b.sigungu, 'ko'))
    out.push({
      sido,
      count: entry.count,
      indexable: entry.count >= REGION_INDEX_MIN_DEALS,
      sigungu,
    })
  }
  return out
}

// GET /api/regions — 지역별 활성 딜 집계(공개)
regionsRoutes.get('/', async (c) => {
  try {
    // 상품 등록/마감이 분 단위로 바뀌지 않는 집계 — 10분 캐시로 D1 왕복을 줄인다.
    const data = await cacheGet(
      c.env.SESSION_KV,
      'region_stats:v1',
      () => computeRegionStats(c.env),
      { ttl: 600, staleWhileRevalidate: 300 },
    )
    // 브라우저는 짧게, 엣지는 길게(로딩 최적화 룰의 Cache-Control/CDN-Cache-Control 분리와 동일 철학).
    c.header('Cache-Control', 'public, max-age=60')
    c.header('CDN-Cache-Control', 'public, max-age=600')
    return c.json({ success: true, data, min_deals_for_index: REGION_INDEX_MIN_DEALS })
  } catch (err) {
    return safeError(c, err, '지역 정보를 불러오지 못했습니다', '[regions]')
  }
})
