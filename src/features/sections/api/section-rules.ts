/**
 * 🏠 2026-08-04 (대표 시안 승인 "좋다 이렇게 가자"): **규칙 기반 홈 섹션** 해석기.
 *
 * `homepage_sections.source` 가 `'manual'` 이 아니면 상품을 질의로 고른다.
 * 기존 수동 큐레이션(`section_products`)은 **그대로 남아 있고 기본값이다** — 이건 추가일 뿐이다.
 *
 * ## 왜 규칙인가
 * 시안의 "지금 인기 / 오늘 마감 임박 / 주말에 떠나는 숙소"는 목록이 아니라 **질의**다.
 * 수동 큐레이션으로 만들면 어드민이 매일 손봐야 하고, 안 손보는 순간 홈 최상단이
 * 낡은 채로 방치된다. 규칙은 상품이 들어오고 나가는 대로 저절로 맞는다.
 *
 * ## 상품 선정 조건은 홈 피드와 **같아야** 한다
 * 홈 그리드(`group-buy-public` GET /products)와 다른 조건을 쓰면 "홈엔 있는데 섹션엔 없다"가
 * 생기고, 그건 사용자에게 버그로 보인다. 그래서 아래 WHERE 는 그 라우트를 그대로 따른다:
 *   category ∈ VOUCHER_CATEGORIES · is_active=1 · group_buy_status='active' · 도매 원본 제외
 * 여기에 **본진 몰 격리**(운영자 SaaS 몰 상품 배제)를 더한다 — 2026-08-03 에 지역 집계에서
 * 이 조건을 빠뜨렸다가 `sitemap-mall-scope` 가 잡았다. 소비자 집계 쿼리의 기본값으로 생각할 것.
 */

import type { Env } from '@/worker/types/env'
import { VOUCHER_CATEGORIES } from '@/shared/constants/voucher-categories'
import { demoSlugSql } from '@/shared/constants/demo-products'
import { mainScopeFor } from '@/worker/utils/consumer-scope'
import {
  clampSectionLimit,
  normalizeSectionSource,
  type SectionSource,
} from '@/shared/constants/home-showcase'

/**
 * 홈 카드가 실제로 쓰는 컬럼만 — `SELECT *` 는 D1 100컬럼 한도에 걸린다(2026-06-10 사고).
 *
 * ⚠️ `deal_only` 는 **화면에 안 쓰이지만 반드시 실어야 한다** — 카드가 어디로 링크할지는
 *    `canonicalDetailPath` SSOT 가 `deal_only`+`category` 로 정한다. 빼면 교환권(딜 결제)이
 *    이용권 상세로 가고, 그건 `check-payment-flow-ssot` 가 막으려는 바로 그 사고다.
 */
/**
 * 카드 한 장을 그리는 데 필요한 최소 컬럼.
 * ⭐ 2026-08-19: `avg_rating`·`review_count` 추가 — 섹션 카드도 피드와 **같은 컴포넌트**를 쓰는데
 *   이 둘이 없어 섹션에서만 평점 줄이 비어 있었다.
 * ⚠️ 설명은 **SQL 문자열 밖**에 둔다 — 안에 쓰면 워커 번들과 D1 쿼리에 매번 실려 나간다.
 */
export const CARD_COLS = `
  p.id, p.name, p.price, p.original_price, p.image_url, p.category,
  p.discount_rate, p.sold_count, p.dominant_color,
  p.avg_rating, p.review_count,
  p.deal_only,
  p.restaurant_name, p.restaurant_address, p.slug,
  p.images
`

/**
 * 정렬 화이트리스트. **사용자 입력을 ORDER BY 에 그대로 넣지 않는다** — 값은 여기서만 온다.
 *
 * `deadline` 은 마감이 있는 상품만 의미가 있어 WHERE 를 함께 건다. 마감 없는 상품까지 섞으면
 * "오늘 마감 임박" 줄에 마감 없는 딜이 올라와 제목이 거짓말이 된다.
 */
const RULES: Record<Exclude<SectionSource, 'manual'>, { order: string; where?: string }> = {
  popular: { order: 'COALESCE(p.sold_count,0) DESC, p.created_at DESC' },
  deadline: {
    order: 'p.group_buy_deadline ASC',
    where: `AND p.group_buy_deadline IS NOT NULL AND p.group_buy_deadline > datetime('now')`,
  },
  newest: { order: 'p.created_at DESC' },
  category: { order: 'COALESCE(p.sold_count,0) DESC, p.created_at DESC' },
}

export interface SectionRuleQuery {
  source: SectionSource
  /** source='category' 일 때의 카테고리 키 */
  sourceValue?: string | null
  limit?: number | null
}

/**
 * 규칙 하나를 실행해 상품 배열을 반환. `manual` 이면 빈 배열(호출부가 section_products 를 쓴다).
 * 실패는 빈 배열로 흡수한다 — 섹션 하나가 홈 전체를 죽이면 안 된다.
 */
export async function resolveSectionProducts(
  env: Env,
  q: SectionRuleQuery,
): Promise<Record<string, unknown>[]> {
  const source = normalizeSectionSource(q.source)
  if (source === 'manual') return []

  const rule = RULES[source]
  if (!rule) return []

  const limit = clampSectionLimit(q.limit)

  // 카테고리 지정은 화이트리스트 안에서만 — 아니면 전체 이용권으로 폴백(빈 줄보다 낫다).
  const wanted = (q.sourceValue || '').trim()
  const cats: readonly string[] =
    source === 'category' && (VOUCHER_CATEGORIES as readonly string[]).includes(wanted)
      ? [wanted]
      : VOUCHER_CATEGORIES

  try {
    const productScope = await mainScopeFor(env.DB, 'products', 'p')
    const rows = await env.DB.prepare(`
      SELECT ${CARD_COLS}
      FROM products p
      WHERE p.category IN (${cats.map(() => '?').join(',')})
        AND p.is_active = 1
        AND p.group_buy_status = 'active'
        AND NOT (COALESCE(p.is_supply_product,0) = 1 AND COALESCE(p.supply_source_id,0) = 0)
        ${rule.where ?? ''}${productScope}
      ORDER BY CASE WHEN ${demoSlugSql('p')} THEN 1 ELSE 0 END, ${rule.order}
      LIMIT ${limit}
    `).bind(...cats).all<Record<string, unknown>>()
    return rows.results ?? []
  } catch {
    // 컬럼 부재·테이블 부재 등 — 그 줄만 비고 홈은 계속 그려진다.
    return []
  }
}
