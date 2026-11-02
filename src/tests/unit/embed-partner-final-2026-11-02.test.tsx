/**
 * 🤝 제휴사 입점 위젯 최종안 (2026-11-02 대표 확정 *"E2 형광펜 + P1 판매 수 + P3 +1 … 이번 주 판매 xxx장 바탕색 검정"*)
 *
 * 지키는 것:
 *   ① 문구 — 제목 "성과 없는 체험단은 그만! / 인플루언서와 함께(형광펜) 파세요" · 정체성 한 줄 · 업종 넷
 *   ② SVG 사본이 원본 React 부품(sns-logos · category-icons)과 같다 — 워커는 React 를 못 써서 사본을 둔다
 *   ③ 장면은 업종 넷이 같은 순서로 맞물린다(업종 단어 · 알림 · 줄 밝힘 · +1) · 음수 지연 · 스크립트 0
 *   ④ 판매 수 상자는 검정 · 숫자는 되돌아가지 않게 길게 센다
 *   ⑤ 움직임 줄이기 · 폰 폭(≤480)에서 휴대폰 대신 한 줄 알림
 *   ⑥ 가상 예시 — 대표 실명·실제 가게 이름이 들어가지 않는다 · 성과 숫자 주장 0
 *
 * ⚠️ 못 보는 것: 실제 높이(브라우저) — 2026-11-02 Playwright 실측 300~760px 전부 문서 360, 왼쪽 칸 여유 14px 이상.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement as h } from 'react'
import { renderPartner } from '@/worker/utils/embed-widget'
import { PARTNER_CSS, PARTNER_SCENES, PARTNER_IDENTITY, PARTNER_SVG } from '@/worker/utils/embed-partner-motion'
import { InstagramLogo, TikTokLogo, YouTubeLogo } from '@/components/icons/sns-logos'
import { MealIcon, StayIcon, BeautyIcon, LeisureIcon } from '@/components/icons/category-icons'

const html = renderPartner('light', '한빛', 3)
const text = html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const noSize = (m: string) => m.replace(/^<svg([^>]*)>/, (_, a: string) => `<svg${a.replace(/ (width|height)="\d+"/g, '')}>`)

describe('🤝 제휴사 입점 위젯 최종안', () => {
  it('① 문구', () => {
    expect(html).toContain('<span class="ln">성과 없는 체험단은 그만!</span><span class="ln"><span class="em-m">인플루언서와 함께</span> 파세요</span>')
    expect(text).toContain(PARTNER_IDENTITY)
    expect(PARTNER_SCENES.map((s) => s.cat)).toEqual(['음식점', '숙소', '네일샵', 'PT'])
    expect(text).toContain('한빛 추천')
  })

  it('② SVG 사본 = 원본', () => {
    const pairs = [
      ['instagram', InstagramLogo], ['tiktok', TikTokLogo], ['youtube', YouTubeLogo],
      ['meal', MealIcon], ['stay', StayIcon], ['beauty', BeautyIcon], ['leisure', LeisureIcon],
    ] as const
    for (const [k, C] of pairs) expect(PARTNER_SVG[k]).toBe(noSize(renderToStaticMarkup(h(C as never, { size: 16 }))))
  })

  it('③ 장면 넷이 같은 박자 · 음수 지연 · 스크립트 0', () => {
    const n = PARTNER_SCENES.length
    expect((html.match(/<div class="toast t\d">/g) || []).length).toBe(n)
    expect((html.match(/<span class="plus">\+1<\/span>/g) || []).length).toBe(n)
    for (const [sel, i0] of [['.pt .cats .c', 1], ['.pt .toast.t', 1], ['.pt .mlive .m', 1]] as const) {
      expect(PARTNER_CSS).toContain(`${sel}${i0}{animation-delay:0s}${sel}${i0 + 1}{animation-delay:-9s}${sel}${i0 + 2}{animation-delay:-6s}${sel}${i0 + 3}{animation-delay:-3s}`)
    }
    expect(PARTNER_CSS).toContain('.pt .it:nth-child(5){animation-delay:0s}.pt .it:nth-child(6){animation-delay:-9s}.pt .it:nth-child(7){animation-delay:-6s}.pt .it:nth-child(8){animation-delay:-3s}')
    expect(PARTNER_CSS).toContain('.pt .it:nth-child(5) .plus{animation-delay:0s}.pt .it:nth-child(6) .plus{animation-delay:-9s}')
    expect(html).not.toMatch(/<script/i)
  })

  it('④ 판매 수 상자는 검정 · 길게 센다', () => {
    expect(PARTNER_CSS).toMatch(/\.pt \.tally\{[^}]*background:#16181C/)
    expect(PARTNER_CSS).toContain('animation:cnt 900s steps(300,start) infinite')
    expect(html).toContain('<div class="tally">이번 주 판매 <b></b>장</div>')
  })

  it('⑤ 움직임 줄이기 · 폰 폭', () => {
    expect(PARTNER_CSS.trim().split('\n').pop()).toMatch(/^@media \(prefers-reduced-motion:reduce\)\{\.pt \*,\.pt \*::before,\.pt \*::after\{animation:none!important\}.*\.pt \.em-m\{background-size:100% 100%\}\}$/)
    expect(PARTNER_CSS).toMatch(/@media \(max-width:480px\)\{\.pt \.mlive\{display:block\}[^\n]*\.pt \.phone\{display:none\}/)
  })

  it('⑥ 가상 예시 · 숫자 주장 0', () => {
    for (const real of ['정지원', '달빛한스푼', '리스터코퍼레이션', 'jiwon']) expect(html.replace('한빛', '')).not.toContain(real)
    expect(text).not.toMatch(/\d+\s*배/)
    expect(text).not.toContain('—')
  })
})
