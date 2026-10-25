/**
 * 🏠 사장님 생활 서비스 검색 노출 (2026-10-25 대표 "seo, geo 에 노출 잘 되게끔").
 * 수리 전 라이브(Googlebot): `/life` 제목=홈 제목 · 본문 8자 · sitemap 0 · 업종 페이지 robots 차단.
 * ⚠️ 못 보는 것: 구글·네이버가 실제로 색인하는지(수일~수주) · HTMLRewriter 런타임 배선.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolveConsumerSurfaceSeo } from '@/shared/seo/consumer-surfaces'
import { buildStaticSurfaceNoscript } from '@/worker/utils/crawler-noscript'
import { buildSurfaceListJsonLd } from '@/worker/utils/surface-list-jsonld'
import { HOME_SERVICE_CATEGORIES } from '@/shared/home-service'
import { readCode } from '../helpers/source-text'

const O = 'https://urdeal.kr'
const walk = (v: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] => {
  if (Array.isArray(v)) v.forEach((x) => walk(x, out))
  else if (v && typeof v === 'object') { out.push(v as Record<string, unknown>); Object.values(v).forEach((x) => walk(x, out)) }
  return out
}

describe('서버 메타', () => {
  it('/life 는 사장님 대상 제목 · 자기 canonical', () => {
    const m = resolveConsumerSurfaceSeo('/life', '', O)!
    expect(m.pageTitle).toContain('사장님 생활 서비스')
    expect(m.canonical).toBe(`${O}/life`)
    expect(m.noindex).toBeFalsy()
  })
  it('업종 페이지마다 고유 제목·설명 (17개 전부)', () => {
    const titles = new Set<string>()
    for (const d of HOME_SERVICE_CATEGORIES) {
      const m = resolveConsumerSurfaceSeo(`/life/request/${d.key}`, '?utm=x', O)!
      expect(m, d.key).toBeTruthy()
      expect(m.pageTitle).toContain(d.label)
      expect(m.description).toBe(d.blurb)
      expect(m.canonical).toBe(`${O}/life/request/${d.key}`)
      titles.add(m.pageTitle)
    }
    expect(titles.size).toBe(HOME_SERVICE_CATEGORIES.length)
  })
  it('없는 업종은 메타를 지어내지 않는다', () => {
    expect(resolveConsumerSurfaceSeo('/life/request/nope', '', O)).toBeNull()
  })
})

describe('크롤러 본문', () => {
  it('/life 는 문장 + 업종 링크 전부', () => {
    const html = buildStaticSurfaceNoscript('/life')
    expect(html).toContain('비교해서 고른 한 곳에만')
    for (const d of HOME_SERVICE_CATEGORIES) expect(html).toContain(`href="/life/request/${d.key}"`)
  })
  it('업종 페이지는 그 요청서가 묻는 질문 + 같은 분류 링크', () => {
    const html = buildStaticSurfaceNoscript('/life/request/signage')
    expect(html).toContain('간판 제작·교체 견적')
    expect(html).toContain('간판 종류')
    expect(html).toContain('href="/life/request/store_pest"')
    expect(html).not.toContain('href="/life/request/move"')
  })
})

describe('구조화 데이터', () => {
  const ld = (p: string) => {
    const m = resolveConsumerSurfaceSeo(p, '', O)!
    return walk(JSON.parse(buildSurfaceListJsonLd(p, '', O, m, null)))
  }
  it('허브는 업종 Service 목록', () => {
    expect(ld('/life').filter((n) => n['@type'] === 'Service')).toHaveLength(HOME_SERVICE_CATEGORIES.length)
  })
  it('업종은 Service(대상 사업자) + 빵부스러기 마지막이 그 업종', () => {
    const nodes = ld('/life/request/kitchen_hood')
    const svc = nodes.find((n) => n['@type'] === 'Service')!
    expect((svc.audience as Record<string, unknown>)['@type']).toBe('BusinessAudience')
    const bc = nodes.find((n) => n['@type'] === 'BreadcrumbList')!
    const items = bc.itemListElement as Array<{ name: string; item: string }>
    expect(items.map((i) => i.name)).toContain('생활 서비스')
    expect(items[items.length - 1].item).toBe(`${O}/life/request/kitchen_hood`)
  })
})

describe('robots · sitemap', () => {
  const robots = readFileSync('public/robots.txt', 'utf8').split('\n').filter((l) => !l.startsWith('#'))
  it('업종 페이지는 열고, 개인 요청 목록은 막는다', () => {
    expect(robots).toContain('Disallow: /life/requests')
    expect(robots).not.toContain('Disallow: /life/request')
    expect(robots.some((l) => l === 'Disallow: /life')).toBe(false)
  })
  it('sitemap 이 허브와 업종을 제출한다', () => {
    const src = readCode('src/worker/routes/sitemap.routes.ts')
    expect(src).toMatch(/loc: '\/life'/)
    expect(src).toMatch(/HOME_SERVICE_CATEGORIES\.map\(\(d\) => \(\{ loc: lifeCategoryPath\(d\.key\)/)
  })
})
