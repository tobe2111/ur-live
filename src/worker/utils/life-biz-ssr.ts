/**
 * 🏠 생활 업체 소개 페이지(`/life/biz/:id`) — 서버 메타·크롤러 본문 (2026-10-26 대표 "4번도 해줘").
 *
 * 사장님이 이 링크를 카톡으로 돌리는 순간 카드가 "유어딜 홈" 이면 의미가 없다 → 업체 이름·업종·지역·별점을
 * 카드와 검색에 싣는다. 값은 전부 공개 API(`/api/home-service/pros/:id`)가 고른 것뿐이라 전화번호는
 * 애초에 여기 도착하지 않는다(그 API 가 phone 을 안 꺼낸다 — 시험이 고정).
 *
 * 🔒 내용이 얇은 업체(소개 짧음 + 유어딜 후기 0)는 noindex — 이름만 있는 페이지 수백 개를 색인 요청하면
 *   구글이 thin content 로 본다. 카톡 카드는 noindex 와 무관하게 정상으로 나간다(공유는 그대로 된다).
 *   같은 판정을 sitemap 이 SQL 로 쓴다(`LIFE_BIZ_MIN_INTRO` 한 상수).
 * 🔒 지어내지 않는다 — 주소·전화·가격대가 없으므로 `LocalBusiness` 에도 그 필드를 안 쓴다.
 *   별점은 후기가 실제로 있을 때만(0건에 ratingValue 를 쓰면 "0점 업체" 라고 말하는 것이다).
 */
import { categoryDef, type HomeServiceCategory } from '../../shared/home-service-categories'
import {
  LIFE_BIZ_MIN_INTRO, lifeBizIndexable, lifeBizTitle, lifeBizDescription, lifeBizRating, lifeBizCategoryLabels, lifeBizAreaList,
  type LifeBizSeoInput,
} from '../../shared/seo/life-biz-seo'
import { lifeCategoryPath } from '../../shared/life-seo'
import { LIFE_HUB_PATH, LIFE_HUB_SEO } from '../../shared/seo/life-hub-seo'
import { withSiteName } from '../../shared/seo/consumer-surfaces'
import type { SurfaceRewriteMeta } from './surface-ssr-meta'
import { esc } from './crawler-noscript-rows'

export { LIFE_BIZ_MIN_INTRO, lifeBizIndexable }

export interface LifeBizView extends LifeBizSeoInput {
  id: number
  verified?: boolean
  reviews?: { avg: number | null; count: number; recent?: { rating: number; body: string; reviewer: string }[] } | null
  chosen_count?: number
}

/** 시드 봉투(`{ success, data }`)에서 뷰를 꺼낸다 — 모양이 다르면 null(추측해서 그리지 않는다). */
export function lifeBizViewOf(payload: unknown): LifeBizView | null {
  const d = (payload as { data?: LifeBizView } | null)?.data
  if (!d || typeof d !== 'object' || typeof d.name !== 'string' || !d.name.trim() || !Number(d.id)) return null
  return d
}

export function buildLifeBizMeta(payload: unknown, origin: string, pathname: string): SurfaceRewriteMeta | null {
  const v = lifeBizViewOf(payload)
  if (!v) return null
  const canonical = `${origin}${pathname}`
  const cats = lifeBizCategoryLabels(v)
  const first = (v.categories || []).find((k) => categoryDef(k as HomeServiceCategory))
  const crumbs = [
    { name: '유어딜', item: `${origin}/` },
    { name: LIFE_HUB_SEO.crumb, item: `${origin}${LIFE_HUB_PATH}` },
    ...(first ? [{ name: categoryDef(first as HomeServiceCategory)!.label, item: `${origin}${lifeCategoryPath(first)}` }] : []),
    { name: v.name, item: canonical },
  ]
  const rc = Number(v.reviews?.count || 0)
  const biz: Record<string, unknown> = {
    '@type': 'LocalBusiness', '@id': `${canonical}#biz`, name: v.name, url: canonical,
    description: lifeBizDescription(v),
  }
  const area = lifeBizAreaList(v)
  if (area.length) biz.areaServed = area.slice(0, 10)
  if (cats.length) biz.knowsAbout = cats
  if (rc > 0 && v.reviews?.avg != null) {
    biz.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(Number(v.reviews.avg).toFixed(1)), reviewCount: rc, bestRating: 5, worstRating: 1 }
  }
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })) },
      biz,
    ],
  }
  const rating = lifeBizRating(v)
  return {
    pageTitle: withSiteName(lifeBizTitle(v)),
    title: `${lifeBizTitle(v)}${rating ? ` ${rating}` : ''}`,
    description: lifeBizDescription(v),
    canonical,
    ogType: 'profile',
    jsonLd: JSON.stringify(ld).replace(/<\//g, '<\\/'),
    noindex: !lifeBizIndexable(v),
  }
}

/** 크롤러 본문 — 화면과 같은 글(이름·업종·지역·소개·후기). JS 가 돌면 렌더되지 않는다. */
export function buildLifeBizNoscript(payload: unknown): string {
  const v = lifeBizViewOf(payload)
  if (!v) return ''
  const cats = (v.categories || []).filter((k) => categoryDef(k as HomeServiceCategory))
  const catLinks = cats.map((k) => `<li><a href="${esc(lifeCategoryPath(k))}">${esc(categoryDef(k as HomeServiceCategory)!.label)}</a></li>`).join('')
  const al = lifeBizAreaList(v)
  const area = al.length > 3 ? `${al.slice(0, 3).join(', ')} 외 ${al.length - 3}곳` : al.join(', ')
  const reviews = (v.reviews?.recent || []).slice(0, 5).map((r) => `<li>★${Number(r.rating)} ${esc(r.reviewer)}: ${esc(r.body)}</li>`).join('')
  return `<noscript><h1>${esc(v.name)}</h1>${v.intro ? `<p>${esc(v.intro)}</p>` : ''}`
    + (catLinks ? `<h2>하는 일</h2><ul>${catLinks}</ul>` : '')
    + (area ? `<p>지역: ${esc(area)}</p>` : '')
    + (reviews ? `<h2>유어딜 후기</h2><ul>${reviews}</ul>` : '')
    + `</noscript>`
}
