/**
 * 🏠 생활 업체 소개(`/life/biz/:id`) — 제목·설명·색인 여부 SSOT (2026-10-26).
 * 서버 메타(`worker/utils/life-biz-ssr.ts`)와 화면 `<SEO>`(`LifeBizPage`)가 **같은 함수**를 쓴다 —
 * 두 벌이면 JS 를 도는 구글과 서버 HTML 만 읽는 네이버·AI 검색봇이 다른 제목을 받는다.
 */
import { categoryDef, type HomeServiceCategory } from '../home-service-categories'

/** 이 글자 수 이상의 소개가 있거나 유어딜 후기가 1건 이상이면 색인한다. sitemap 이 같은 값을 SQL 로 쓴다. */
export const LIFE_BIZ_MIN_INTRO = 20

export interface LifeBizSeoInput {
  name: string
  intro?: string | null
  categories?: string[]
  areas?: { sido?: string | null; sigungu?: string | null }[]
  reviews?: { avg: number | null; count: number } | null
}

export function lifeBizIndexable(v: LifeBizSeoInput): boolean {
  return (v.intro || '').trim().length >= LIFE_BIZ_MIN_INTRO || Number(v.reviews?.count || 0) > 0
}

export function lifeBizCategoryLabels(v: LifeBizSeoInput): string[] {
  return (v.categories || []).map((k) => categoryDef(k as HomeServiceCategory)?.label).filter((s): s is string => !!s)
}

export function lifeBizAreaList(v: LifeBizSeoInput): string[] {
  return (v.areas || []).map((r) => [r.sido, r.sigungu].filter(Boolean).join(' ')).filter(Boolean)
}

/** 별점 문구 — 후기가 실제로 있을 때만(0건이면 null, 0점으로 보이지 않게). */
export function lifeBizRating(v: LifeBizSeoInput): string | null {
  const rc = Number(v.reviews?.count || 0)
  return rc > 0 && v.reviews?.avg != null ? `★${Number(v.reviews.avg).toFixed(1)}` : null
}

/** 검색 결과 제목 — `{업체} · {업종 둘}` (사이트 이름은 호출부가 붙인다). */
export function lifeBizTitle(v: LifeBizSeoInput): string {
  const cats = lifeBizCategoryLabels(v)
  return `${v.name}${cats.length ? ` · ${cats.slice(0, 2).join('·')}` : ''}`
}

export function lifeBizDescription(v: LifeBizSeoInput): string {
  const parts: string[] = []
  const r = lifeBizRating(v)
  if (r) parts.push(`${r}(후기 ${Number(v.reviews?.count)})`)
  const cats = lifeBizCategoryLabels(v)
  if (cats.length) parts.push(cats.slice(0, 3).join('·'))
  const a = lifeBizAreaList(v)
  if (a.length) parts.push(a.length > 3 ? `${a.slice(0, 3).join(', ')} 외 ${a.length - 3}곳` : a.join(', '))
  const intro = (v.intro || '').replace(/\s+/g, ' ').trim()
  const body = intro || '유어딜에서 견적을 요청하면 이 업체가 견적을 보내요.'
  return `${parts.length ? `${parts.join(' · ')} · ` : ''}${body}`.slice(0, 160)
}
