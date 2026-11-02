/**
 * 🎬 에이전시 위젯 모션 간판 (2026-11-02 대표 *"에이전시 위젯에는 모션그래픽도 넣어서 최대한 고급지게 만들어주고"*)
 *
 * 지키는 것:
 *   ① 스크립트 0 — 모션은 전부 CSS(위젯 문서는 CSP nonce 를 몰라 스크립트가 막힌다. 넣으면 되는 척만 한다)
 *   ② 움직임을 꺼 달라는 사람(`prefers-reduced-motion`)에겐 다 멈추고 숫자는 끝값으로
 *   ③ 숫자는 화면 읽기용 글자로도 들어 있다 — CSS 카운터는 보조 기술이 못 읽는다
 *   ④ 흐르는 띠는 4장 이상일 때만, 이어 붙인 사본은 탭 이동·화면 읽기에서 빠진다(같은 링크를 두 번 듣지 않게)
 *   ⑤ 🔴 반대 방향 — 유어샵·매장·지역·이용권·제휴 위젯 문서엔 이 스타일이 한 줄도 안 섞인다
 *   ⑥ '판매 중 이용권' 수는 위젯에 실린 장수가 아니라 같은 노출 조건의 전체 수다
 *
 * ⚠️ 못 보는 것: 실제로 부드럽게 움직이는지 · 예쁜지(그려서 봐야 한다 — out/embed-preview).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { renderAgency, AGENCY_MARQUEE_MIN } from '@/worker/utils/embed-agency'
import { renderStrip, renderSingle, renderPartner, toEmbedCard, type EmbedRow } from '@/worker/utils/embed-widget'
import { PARTNER_CSS, PARTNER_SLIDES, PARTNER_IDENTITY } from '@/worker/utils/embed-partner-motion'

const ROW = { id: 1, name: '닭도리탕', price: 31000, original_price: 35000, restaurant_name: '달빛한스푼', category: 'meal_voucher' } as EmbedRow
const cards = (n: number) => Array.from({ length: n }, (_, i) => toEmbedCard({ ...ROW, id: i + 1 }, 'agency'))
const agency = (n: number) => renderAgency({ theme: 'auto', title: 't', brand: '한빛', storeCount: 3, liveCount: 9, cards: cards(n) })

describe('🎬 에이전시 위젯 모션', () => {
  it('① 스크립트 0 · 모션은 CSS', () => {
    const html = agency(6)
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/\son[a-z]+=/i)
    expect(html).toContain('@keyframes ag-flow')
    expect(html).toContain('@property --n')
  })

  it('② 움직임 줄이기 설정이면 전부 멈추고 숫자는 끝값', () => {
    const html = agency(6)
    expect(html).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\.ag \*,\.ag \*::before,\.ag \*::after\{animation:none!important;transition:none!important\}\.ag \.k \.ct::before\{counter-reset:n var\(--to\)\}\}/)
  })

  it('③ 숫자는 글자로도 있다', () => {
    const html = agency(1)
    expect(html).toContain('<span class="sr">3곳</span>')
    expect(html).toContain('<span class="sr">9개</span>')
  })

  it(`④ 흐르는 띠는 ${AGENCY_MARQUEE_MIN}장 이상만, 사본은 숨긴다`, () => {
    const few = agency(AGENCY_MARQUEE_MIN - 1)
    expect(few).not.toContain('class="vp mq"')
    expect(few).not.toContain('aria-hidden="true" tabindex="-1"')
    const many = agency(AGENCY_MARQUEE_MIN)
    expect(many).toContain('class="vp mq"')
    expect((many.match(/<a class="c"/g) || []).length).toBe(AGENCY_MARQUEE_MIN * 2)
    expect((many.match(/aria-hidden="true" tabindex="-1"/g) || []).length).toBe(AGENCY_MARQUEE_MIN)
  })

  it('⑤ 🔴 다른 위젯 문서엔 모션 스타일이 안 섞인다', () => {
    const c = cards(5)
    for (const html of [
      renderStrip({ kind: 'ushop', theme: 'light', title: 't', moreHref: '/u/x', cards: c }),
      renderStrip({ kind: 'store', theme: 'dark', title: 't', moreHref: '/s/x', cards: c }),
      renderSingle('light', c[0]),
    ]) {
      expect(html).not.toContain('ag-')
      expect(html).not.toContain('@property')
      expect(html).toMatch(/\.one \.logo\{font-size:13px\}<\/style>/) // BASE_CSS 끝 바로 뒤에서 닫힌다(덧붙은 것 0)
    }
  })

  it('⑥ 판매 중 이용권 수는 같은 노출 조건의 전체 수', () => {
    const r = readFileSync('src/worker/routes/embed.routes.ts', 'utf8')
    const block = r.slice(r.indexOf("embedRoutes.get('/embed/agency/:id'"), r.indexOf('// ── 매장'))
    expect(block).toMatch(/SELECT COUNT\(\*\) AS n FROM products p[\s\S]*?AND \$\{LIVE\}`\)/)
    expect(block).toMatch(/ap\.agency_id != \?\)[\s\S]*?SELECT COUNT/) // 다른 에이전시 담당분 제외도 같다
    expect(block).toMatch(/liveCount: Math\.max\(Number\(live\?\.n \|\| 0\), cards\.length\)/)
  })
})

/**
 * 🎬 제휴사 입점 위젯 (2026-11-02 대표 확정 *"4번형태로 가되 유어딜의 정체성 한줄 고정"*)
 *   ⑦ 정체성 한 줄은 무대 **밖**에 있다 — 장면이 넘어가도 그대로 선다(안에 넣으면 같이 사라진다)
 *   ⑧ 장면 = 체험단의 한계 → 유어딜 장점, 세 장 · 음수 지연(첫 프레임에 1번 장이 서 있다) · 스크립트 0
 *   ⑨ 움직임 줄이기면 1번 장만 정지 · 📱 폰 폭(≤480)에서 설명 줄을 빼 360 안에 든다
 *   ⑩ 🔴 에이전시 모션과 섞이지 않는다 · 요율 숫자 0
 * ⚠️ 못 보는 것: 실제 높이(브라우저 레이아웃) — 2026-11-02 Playwright 실측 300~760px 전부 문서 360, 장면이 무대 안에 들었다.
 */
describe('🎬 제휴사 입점 위젯', () => {
  const html = renderPartner('light', '한빛', 3)
  it('⑦ 정체성 한 줄은 무대 밖에 고정', () => {
    expect(html).toContain(`<p class="id">${PARTNER_IDENTITY}</p><div class="stage">`)
    const stage = html.slice(html.indexOf('<div class="stage">'), html.indexOf('<div class="ft">'))
    expect(stage).not.toContain('class="id"')
  })
  it('⑧ 장면 셋 · 음수 지연 · 스크립트 0', () => {
    expect((html.match(/<section class="sl">/g) || []).length).toBe(PARTNER_SLIDES.length)
    expect(PARTNER_SLIDES.length).toBe(3)
    for (const s of PARTNER_SLIDES) { expect(html).toContain(s.no); expect(html).toContain(s.yes) }
    expect(PARTNER_CSS).toContain('.pt .sl:nth-child(1){animation-delay:-0s}')
    expect(PARTNER_CSS).toContain('.pt .sl:nth-child(2){animation-delay:-8s}')
    expect(PARTNER_CSS).toContain('.pt .sl:nth-child(3){animation-delay:-4s}')
    expect(PARTNER_CSS).toMatch(/@keyframes pt-scene\{0%\{opacity:1/) // 첫 프레임 = 보이는 상태
    expect(html).not.toMatch(/<script/i)
  })
  it('⑨ 움직임 줄이기 · 폰 폭', () => {
    expect(PARTNER_CSS).toMatch(/@media \(prefers-reduced-motion:reduce\)\{[^@]*\.pt \.sl:nth-child\(n\+2\)\{display:none\}/)
    expect(PARTNER_CSS).toMatch(/@media \(max-width:480px\)\{[^@]*\.pt \.ds\{display:none\}/)
  })
  it('⑩ 에이전시 모션과 섞이지 않는다 · 요율 숫자 0', () => {
    expect(html).not.toContain('ag-')
    expect(agency(5)).not.toContain('pt-scene')
    const text = html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ')
    expect(text).not.toMatch(/\d+(\.\d+)?\s*%/)
    expect(text).not.toContain('—')
  })
})
