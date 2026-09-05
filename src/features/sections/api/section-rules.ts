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
import { consumerVisibleProductSql } from '@/shared/db/consumer-visible-product'
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
 * 🗓️ 2026-09-04 (대표 "마감 개념은 없어"): '마감 임박순' 소스를 뺐다. 그 규칙은 마감이 있는
 * 상품에만 WHERE 를 걸었는데, 마감이 사라지자 후보가 영구히 0 이라 빈 줄만 만들었다.
 */
/**
 * 🏆 **인기 점수** — 결제·리뷰·클릭 종합 (2026-09-03 대표 "리뷰 수, 클릭수, 결제 수로 총합 판정").
 *
 * ## 왜 그냥 더하면 안 되나
 * 세 신호의 자릿수가 다르다(라이브 실측: 결제 최대 259 · 리뷰 최대 34 · 클릭 최대 0).
 * 생값을 더하면 **결제 하나가 사실상 혼자 결정**해서 종전(sold_count DESC)과 같아진다.
 * 그래서 각 신호를 **같은 후보군의 최대값 대비 0~1 로 정규화**한 뒤 가중합한다.
 *
 * ## 정규화 분모는 후보군과 **같은 WHERE** 로 구한다
 * 다른 조건으로 최대값을 구하면 화면에 없는 상품이 분모를 정해 점수가 왜곡된다.
 * 그래서 아래 쿼리는 조건 문자열을 **한 번 만들어 두 곳(본문·분모 서브쿼리)에 그대로** 쓴다 —
 * 베끼면 반드시 갈린다(오늘 유어샵 핀에서 정확히 그 사고가 났다).
 *
 * ## 조작된 값도 그대로 쓴다 (대표 확정)
 * 리뷰는 자동 시딩이 돌고 판매량도 시드값이 있다. 대표가 *"조작을 한 리뷰숫자라도 마찬가지"* 로
 * 확정했으므로 저장된 값을 그대로 신뢰한다 — 진짜/시드를 가르지 않는다.
 *
 * ## 가중치는 어드민 조정 대상
 * `platform_settings` 의 세 키. 구조는 코드가, 값은 어드민이 갖는다(이 레포 방침).
 * 클릭은 집계가 방금 생겨 한동안 0 이다 — 그동안은 결제·리뷰 둘로만 계산된다(정상).
 */
export const POPULAR_WEIGHT_KEYS = {
  sold: 'popular_weight_sold',
  review: 'popular_weight_review',
  view: 'popular_weight_view',
} as const
export const POPULAR_WEIGHT_DEFAULTS = { sold: 3, review: 2, view: 1 } as const

/** 가중치 읽기 — 한 왕복. 실패·부재는 기본값(섹션 하나 때문에 홈이 죽으면 안 된다). */
export async function resolvePopularWeights(DB: D1Database): Promise<{ sold: number; review: number; view: number }> {
  const out = { ...POPULAR_WEIGHT_DEFAULTS } as { sold: number; review: number; view: number }
  try {
    const keys = Object.values(POPULAR_WEIGHT_KEYS)
    const rows = await DB.prepare(
      `SELECT key, value FROM platform_settings WHERE key IN (${keys.map(() => '?').join(',')})`,
    ).bind(...keys).all<{ key: string; value: string }>()
    for (const r of rows.results ?? []) {
      const n = Number(r.value)
      if (!Number.isFinite(n) || n < 0) continue
      if (r.key === POPULAR_WEIGHT_KEYS.sold) out.sold = n
      else if (r.key === POPULAR_WEIGHT_KEYS.review) out.review = n
      else if (r.key === POPULAR_WEIGHT_KEYS.view) out.view = n
    }
  } catch { /* 컬럼·테이블 부재 → 기본값 */ }
  return out
}

/** 정규화 가중합. 분모 0 은 `MAX(분모,1)` 로 막는다(신호가 전부 0 이어도 나눗셈이 산다). */
export function popularScoreSql(w: { sold: number; review: number; view: number }): string {
  return `(
        ${w.sold} * (COALESCE(p.sold_count,0)   * 1.0 / MAX(mx.ms, 1))
      + ${w.review} * (COALESCE(p.review_count,0) * 1.0 / MAX(mx.mr, 1))
      + ${w.view} * (COALESCE(p.view_count,0)   * 1.0 / MAX(mx.mv, 1))
      )`
}

const RULES: Record<Exclude<SectionSource, 'manual'>, { order: string; where?: string }> = {
  popular: { order: 'COALESCE(p.sold_count,0) DESC, p.created_at DESC' },
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
    // 🧱 후보 조건은 **한 번 만들어** 본문과 정규화 분모에 똑같이 쓴다 — 베끼면 갈린다.
    const catsIn = cats.map(() => '?').join(',')
    const conds = async (a: 'p' | 'p2') => `${a}.category IN (${catsIn})
        AND ${a}.is_active = 1
        AND ${a}.group_buy_status = 'active'
        AND ${consumerVisibleProductSql(a)}
        ${(rule.where ?? '').replaceAll('p.', `${a}.`)}${await mainScopeFor(env.DB, 'products', a)}`
    const whereMain = await conds('p')

    // 🏆 인기순만 정규화 분모가 필요하다(다른 정렬은 단일 컬럼이라 분모가 무의미).
    //   분모는 CROSS JOIN 한 번 — 신호마다 서브쿼리를 두면 같은 스캔을 세 번 한다.
    let joinSql = ''
    let orderSql = rule.order
    const binds: string[] = [...cats]
    if (source === 'popular') {
      const w = await resolvePopularWeights(env.DB)
      joinSql = `CROSS JOIN (
        SELECT MAX(COALESCE(p2.sold_count,0)) ms, MAX(COALESCE(p2.review_count,0)) mr, MAX(COALESCE(p2.view_count,0)) mv
        FROM products p2 WHERE ${await conds('p2')}
      ) mx`
      orderSql = `${popularScoreSql(w)} DESC, p.created_at DESC`
      binds.push(...cats) // 분모 서브쿼리 몫
    }

    const rows = await env.DB.prepare(`
      SELECT ${CARD_COLS}
      FROM products p
      ${joinSql}
      WHERE ${whereMain}
      ORDER BY CASE WHEN ${demoSlugSql('p')} THEN 1 ELSE 0 END, ${orderSql}
      LIMIT ${limit}
    `).bind(...binds).all<Record<string, unknown>>()
    return rows.results ?? []
  } catch {
    // 컬럼 부재·테이블 부재 등 — 그 줄만 비고 홈은 계속 그려진다.
    return []
  }
}
