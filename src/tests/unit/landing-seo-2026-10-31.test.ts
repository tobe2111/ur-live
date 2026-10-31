/**
 * 🧭 대외 랜딩 `/partners` · `/influencer` 의 SEO·GEO — 2026-10-31
 *
 * 대표 *"/partners (사장님향) · /influencer (인플루언서향) 이것들도 SEO, GEO 세팅 빡세게 해줘"*.
 *
 * ## 실측 (라이브, Googlebot·Yeti·OAI-SearchBot 셋 다 같은 결과)
 *     /partners    본문 252자 · a태그 0 · FAQPage 0 · Service 0
 *     /influencer  본문 256자 · a태그 0 · FAQPage 0 (화면에 FAQ 자체가 없었다)
 * `/partners` 의 자주 묻는 질문 여덟 개는 **화면 컴포넌트 안에만** 있었고, 그 답도 접혀 있으면
 * DOM 에서 지워져(`{open && <p>}`) 렌더하는 크롤러조차 못 봤다.
 *
 * ## 고정하는 것
 * ① FAQ 는 SSOT 한 벌 — 화면 · 크롤러 본문 · `FAQPage` 가 같은 배열을 읽는다(갈리면 내용-스키마 불일치)
 * ② 답은 접혀 있어도 DOM 에 있다(`<details>`)
 * ③ 구조화 데이터: 두 랜딩 = `FAQPage`, 입점 = `Service`(대상 사업자). 다른 표면엔 안 낸다
 * ④ 크롤러 본문에 Q&A 전부 + 링크 — 링크는 **그 화면에 실제로 있는 것만**(클로킹 금지)
 * ⑤ 사람을 신분(인플루언서)으로 부르지 않는다 · 검색 스니펫은 잘리지 않는 길이
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 구글·네이버가 색인하는지, AI 답변에 인용되는지(외부 판정 · 수일~수주)
 * - 구글은 2023-08 부터 FAQ 리치결과를 정부·의료 사이트에만 보여 준다 — `FAQPage` 는 리치결과가
 *   아니라 Bing·네이버·AI 검색이 Q&A 구조를 읽게 하려는 것이다
 * - HTMLRewriter 런타임 배선(워커 전용 API)
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { PARTNER_FAQ, REFERRAL_FAQ } from '@/shared/landing-faq'
import { LIFE_FAQ } from '@/shared/life-faq'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { landingFaqFor, landingLinks, landingJsonLdNodes } from '@/worker/utils/landing-seo'
import { buildSurfaceListJsonLd } from '@/worker/utils/surface-list-jsonld'
import { buildStaticSurfaceNoscript } from '@/worker/utils/crawler-noscript'

const ORIGIN = 'https://urdeal.kr'
const meta = (p: string) => ({
  title: CONSUMER_SURFACE_SEO[p].title,
  description: CONSUMER_SURFACE_SEO[p].description,
  canonical: `${ORIGIN}${p}`,
})
const graph = (p: string) => {
  const out = buildSurfaceListJsonLd(p, '', ORIGIN, meta(p), null)
  expect(out, `${p} 가 JSON-LD 를 안 낸다`).not.toBe('')
  return (JSON.parse(out.replace(/\\u003c/g, '<')) as { '@graph': Array<Record<string, unknown>> })['@graph']
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

describe('① FAQ 는 한 벌이다', () => {
  it('SSOT 가 비어 있지 않다 — 0건이면 통과가 아니라 고장', () => {
    expect(PARTNER_FAQ.length).toBeGreaterThanOrEqual(6)
    expect(REFERRAL_FAQ.length).toBeGreaterThanOrEqual(6)
  })

  it('경로 → FAQ 판정 (생활 허브는 종전 그대로)', () => {
    expect(landingFaqFor('/partners')).toBe(PARTNER_FAQ)
    expect(landingFaqFor('/partners/')).toBe(PARTNER_FAQ)
    expect(landingFaqFor('/influencer')).toBe(REFERRAL_FAQ)
    expect(landingFaqFor('/life')).toBe(LIFE_FAQ)
    expect(landingFaqFor('/about')).toEqual([])
    expect(landingFaqFor('/influencer/rankings')).toEqual([])
  })

  it('두 화면이 SSOT 배열을 그린다 — 화면 안에 질문을 다시 적지 않는다', () => {
    const partner = readCode('src/pages/partners/PartnerFaq.tsx')
    expect(partner).toMatch(/PARTNER_FAQ\.map\(/)
    expect(partner, 'PartnerFaq 가 질문 배열을 다시 갖고 있다 — 화면과 FAQPage 가 갈린다').not.toMatch(/const FAQS\s*=/)
    expect(partner).not.toContain(PARTNER_FAQ[0].question)
    expect(readCode('src/pages/InfluencerLandingPage.tsx')).toMatch(/REFERRAL_FAQ\.map\(/)
  })
})

describe('② 답은 접혀 있어도 문서에 있다', () => {
  it.each(['src/pages/partners/PartnerFaq.tsx', 'src/pages/InfluencerLandingPage.tsx'])('%s — <details> 로 감싸고, 열림 조건으로 답을 지우지 않는다', (f) => {
    const src = readCode(f)
    expect(src).toMatch(/<details[\s>]/)
    expect(src).toMatch(/<summary[\s>]/)
    expect(src, '접힌 답을 DOM 에서 지운다 — 렌더하는 크롤러도 못 본다').not.toMatch(/\{\s*open\s*&&\s*\(?\s*<p/)
  })
})

describe('③ 구조화 데이터', () => {
  it('/partners — FAQPage(화면과 같은 Q&A) + Service(대상 사업자)', () => {
    const g = graph('/partners')
    const faq = g.find(n => n['@type'] === 'FAQPage') as { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> }
    expect(faq, 'FAQPage 가 없다').toBeTruthy()
    expect(faq.mainEntity).toHaveLength(PARTNER_FAQ.length)
    expect(faq.mainEntity.map(q => q.name)).toEqual(PARTNER_FAQ.map(f => f.question))
    expect(faq.mainEntity.map(q => q.acceptedAnswer.text)).toEqual(PARTNER_FAQ.map(f => f.answer))
    const svc = g.find(n => n['@type'] === 'Service') as Record<string, any>
    expect(svc, 'Service 가 없다').toBeTruthy()
    expect(svc.audience?.['@type']).toBe('BusinessAudience')
    expect(svc.provider).toEqual({ '@id': `${ORIGIN}/#organization` })
    expect(svc.url).toBe(`${ORIGIN}/partners`)
  })

  it('/influencer — FAQPage(화면과 같은 Q&A), Service 는 내지 않는다', () => {
    const g = graph('/influencer')
    const faq = g.find(n => n['@type'] === 'FAQPage') as { mainEntity: Array<{ name: string }> }
    expect(faq.mainEntity.map(q => q.name)).toEqual(REFERRAL_FAQ.map(f => f.question))
    expect(g.some(n => n['@type'] === 'Service')).toBe(false)
  })

  it('다른 표면엔 이 노드들을 안 낸다 — 그 페이지에 없는 Q&A 를 선언하지 않는다', () => {
    for (const p of ['/', '/about', '/creators', '/influencer/rankings', '/experience']) {
      expect(landingJsonLdNodes(p, ORIGIN, `${ORIGIN}${p}`), p).toEqual([])
    }
  })

  it('@id 가 매달리지 않는다 — 노드마다 고유하고 canonical 기준이다', () => {
    const ids = graph('/partners').map(n => n['@id']).filter(Boolean)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(`${ORIGIN}/partners#faq`)
    expect(ids).toContain(`${ORIGIN}/partners#service`)
  })
})

describe('④ 크롤러 본문', () => {
  it.each([['/partners', PARTNER_FAQ], ['/influencer', REFERRAL_FAQ]] as const)('%s — Q&A 전부가 서버 HTML 에 실린다', (p, faq) => {
    const html = buildStaticSurfaceNoscript(p)
    for (const f of faq) {
      expect(html, `질문 누락: ${f.question}`).toContain(`<dt>${esc(f.question)}</dt>`)
      expect(html, `답 누락: ${f.question}`).toContain(`<dd>${esc(f.answer)}</dd>`)
    }
    // 종전 252자 → 크게 올라야 한다. 숫자는 하한으로만(문구가 다듬어져도 깨지지 않게).
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    expect(text.length, `${p} 본문 ${text.length}자`).toBeGreaterThan(1000)
  })

  it.each(['/partners', '/influencer'])('%s — 링크는 그 화면 헤더에 실제로 있는 것만', (p) => {
    const links = landingLinks(p)
    expect(links.length, '링크 0 — 종전과 같다').toBeGreaterThan(0)
    const page = p === '/partners' ? readCode('src/pages/PartnersPage.tsx') : readCode('src/pages/InfluencerLandingPage.tsx')
    const html = buildStaticSurfaceNoscript(p)
    for (const l of links) {
      expect(page, `${p} 화면에 없는 링크를 크롤러에게만 준다: ${l.href}`).toContain(`to="${l.href}"`)
      expect(html).toContain(`<a href="${l.href}">`)
      expect(l.label.trim().length).toBeGreaterThan(0)
    }
  })

  it('robots 가 막는 경로·도구로는 링크하지 않는다', () => {
    for (const p of ['/partners', '/influencer']) {
      const html = buildStaticSurfaceNoscript(p)
      expect(html).not.toMatch(/href="\/(store\/new|login|agency)/)
    }
  })

  it('목록 밖 표면은 링크를 안 받는다 (종전 출력 byte-동일)', () => {
    expect(landingLinks('/about')).toEqual([])
    expect(landingLinks('/creators')).toEqual([])
  })
})

describe('⑤ 명칭·스니펫', () => {
  it('사람을 신분(인플루언서·크리에이터)으로 부르지 않는다 — 활동 이름으로 말한다', () => {
    const texts = [
      ...REFERRAL_FAQ.flatMap(f => [f.question, f.answer]),
      CONSUMER_SURFACE_SEO['/influencer'].title, CONSUMER_SURFACE_SEO['/influencer'].description,
    ].join('\n')
    expect(texts).not.toMatch(/인플루언서|크리에이터|큐레이터/)
  })

  it.each(['/partners', '/influencer'])('%s — 스니펫이 잘리지 않는 길이(≤160자)이고 제목이 비어 있지 않다', (p) => {
    expect(CONSUMER_SURFACE_SEO[p].description.length).toBeLessThanOrEqual(160)
    expect(CONSUMER_SURFACE_SEO[p].title.length).toBeGreaterThan(10)
  })

  it('소개 몫의 부담 주체가 매장이다 (2026-10-16 대표 확정) — 답이 그걸 말한다', () => {
    const who = REFERRAL_FAQ.find(f => /누가 내나요/.test(f.question))
    expect(who, '부담 주체 질문이 사라졌다').toBeTruthy()
    expect(who!.answer).toMatch(/^매장이 냅니다/)
  })
})
