/**
 * 🦶 홈 크롤러 푸터 — `utils/home-footer-noscript.ts` 머리말이 이유를 적어 뒀다.
 *
 * 지키는 것:
 *  ① 크롤러에게 주는 글자 = PC 화면의 `SiteFooter` 글자(링크·순서·라벨·소개·법적 고지). 갈리면 클로킹이다.
 *  ② `<noscript>` 로 싸서 사람 화면엔 그려지지 않는다.
 *  ③ 워커 홈 분기가 첫 화면이 있을 때도, 폴백(로더)일 때도 붙인다.
 * 못 보는 것: 네이버가 그 글을 실제로 쓰는지(외부 판정) · `SiteFooter` 를 조건부로 그리는 새 분기
 * (지금은 `REFERRAL_GROUP_DISCOUNT_DISABLED` 하나뿐이고 아래가 그 조건을 따라간다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  homeFooterNoscript, homeFooterGroups, HOME_FOOTER_TAGLINE_LINES, HOME_FOOTER_LEGAL,
  HOME_FOOTER_PARTNERSHIP,
} from '@/worker/utils/home-footer-noscript'
import { REFERRAL_GROUP_DISCOUNT_DISABLED } from '@/shared/feature-flags'

const FOOTER = readFileSync('src/components/main/SiteFooter.tsx', 'utf8')
const WORKER = readFileSync('src/worker/index.ts', 'utf8')

/** 화면 푸터의 `<a href>` 를 순서대로 — 조건부 링크는 같은 조건으로 거른다. */
function footerAnchors(): { href: string; label: string }[] {
  let src = FOOTER
  if (REFERRAL_GROUP_DISCOUNT_DISABLED) src = src.replace(/\{!REFERRAL_GROUP_DISCOUNT_DISABLED && \([\s\S]*?\)\}/, '')
  return [...src.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
    .map(m => ({ href: m[1], label: m[2].replace(/\s*→\s*$/, '').trim() }))
}

describe('홈 크롤러 푸터 = 화면 푸터', () => {
  it('① 링크가 순서·라벨까지 같다', () => {
    const screen = footerAnchors()
    expect(screen.length).toBeGreaterThan(15) // 0 이면 파싱이 깨진 것이다(통과가 아니라 실패)
    const crawler = [HOME_FOOTER_PARTNERSHIP, ...homeFooterGroups().flatMap(g => g.links)]
    expect(crawler.map(l => `${l.href} ${l.label}`)).toEqual(screen.map(l => `${l.href} ${l.label}`))
  })

  it('① 묶음 제목·소개 문단·법적 고지가 화면 글자 그대로다', () => {
    for (const g of homeFooterGroups()) expect(FOOTER).toContain(`<h3 className={colTitle}>${g.title}</h3>`)
    expect(FOOTER).toContain(`${HOME_FOOTER_TAGLINE_LINES[0]}<br />${HOME_FOOTER_TAGLINE_LINES[1]}`)
    const text = FOOTER.replace(/\s+/g, ' ')
    for (const line of HOME_FOOTER_LEGAL) expect(text).toContain(line)
  })

  it('② <noscript> 로 싸고 탈출한다', () => {
    const html = homeFooterNoscript()
    expect(html.startsWith('<noscript><footer>')).toBe(true)
    expect(html.endsWith('</footer></noscript>')).toBe(true)
    expect(html).toContain('<strong>유어딜</strong>')
    expect(html).toContain('<a href="/blog">블로그</a>')
    expect(html).toContain('<a href="/terms/seller">판매자 약관</a>')
    // 단 하나의 noscript — 중첩·조기 닫힘이 없다
    expect(html.match(/<\/?noscript>/g)).toEqual(['<noscript>', '</noscript>'])
    expect(html).not.toMatch(/<script/i)
  })

  it('③ 워커 홈 분기가 첫 화면·폴백 둘 다에 붙인다', () => {
    expect(WORKER).toMatch(/setInnerContent\(\(homeFirst \|\| urdealLoaderHtml\) \+ homeFooterNoscript\(\)/)
    expect(WORKER).toMatch(/import \{ homeFooterNoscript \} from '\.\/utils\/home-footer-noscript'/)
  })
})
