/**
 * 🔗 생활 요청 공유 페이지(`/life/q/:token`) — 서버 메타·크롤러 본문 (2026-10-25 대표 "4번은 노출해줘").
 *
 * 카톡·커뮤니티에 링크가 붙는 순간 카드가 "유어딜 홈" 이면 아무도 안 누른다 → 요청 제목·지역·남은 자리를
 * 카드에 싣는다. 값은 전부 공개 API(`/api/home-service/share/:token`)가 `publicShareView` 로 고른 것뿐이라
 * 이름·연락처·상세 주소·메모·사진은 애초에 여기 도착하지 않는다.
 *
 * 🔒 마감(손님이 골랐거나 자리가 찼거나 취소)은 noindex — 검색에서 와도 할 수 있는 일이 없다.
 *   본문엔 같은 업종 요청서 링크를 둬 흘러가게 한다(시안 규칙).
 */
import { shareDescription, type ShareView } from '../../shared/home-service-share'
import { lifeCategoryPath } from '../../shared/life-seo'
import { LIFE_HUB_PATH, LIFE_HUB_SEO } from '../../shared/seo/life-hub-seo'
import { withSiteName } from '../../shared/seo/consumer-surfaces'
import type { SurfaceRewriteMeta } from './surface-ssr-meta'
import { esc } from './crawler-noscript-rows'

/** 시드 봉투(`{ success, data }`)에서 뷰를 꺼낸다 — 모양이 다르면 null(추측해서 그리지 않는다). */
export function lifeShareViewOf(payload: unknown): ShareView | null {
  const d = (payload as { data?: ShareView } | null)?.data
  if (!d || typeof d !== 'object' || typeof d.title !== 'string' || typeof d.category !== 'string') return null
  return d
}

export function buildLifeShareMeta(payload: unknown, origin: string, pathname: string): SurfaceRewriteMeta | null {
  const v = lifeShareViewOf(payload)
  if (!v) return null
  const canonical = `${origin}${pathname}`
  const crumbs = [
    { name: '유어딜', item: `${origin}/` },
    { name: LIFE_HUB_SEO.crumb, item: `${origin}${LIFE_HUB_PATH}` },
    { name: v.label, item: `${origin}${lifeCategoryPath(v.category)}` },
    { name: v.title, item: canonical },
  ]
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })),
  }
  return {
    pageTitle: withSiteName(v.title),
    title: v.open ? `${v.title} · 남은 자리 ${v.seatsLeft}/${v.maxQuotes}` : `${v.title} (마감)`,
    description: shareDescription(v),
    canonical,
    jsonLd: JSON.stringify(ld).replace(/<\//g, '<\\/'),
    noindex: !v.open,
  }
}

/** 크롤러 본문 — 화면과 같은 글(제목·지역·고른 답·남은 자리). JS 가 돌면 렌더되지 않는다. */
export function buildLifeShareNoscript(payload: unknown): string {
  const v = lifeShareViewOf(payload)
  if (!v) return ''
  const rows = v.rows.map((r) => `<li>${esc(r.label)}: ${esc(r.value)}</li>`).join('')
  const seat = v.open
    ? `<p>남은 견적 자리 ${v.seatsLeft}/${v.maxQuotes}. 먼저 보낸 ${v.maxQuotes}곳까지만 견적을 낼 수 있어요.</p>`
    : '<p>마감된 요청이에요.</p>'
  const link = `<a href="${esc(lifeCategoryPath(v.category))}">${esc(v.label)} 견적 요청하기</a>`
  return `<noscript><h1>${esc(v.title)}</h1><p>${esc(v.region)}${v.date ? ` · 희망 ${esc(v.date)}` : ''}</p><ul>${rows}</ul>${seat}${link}</noscript>`
}
