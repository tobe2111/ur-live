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
import { PARTNER_MOTION_CSS } from '@/worker/utils/embed-partner-motion'

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
      expect(html).toMatch(/\.pt \.go\{[^}]*\}<\/style>/) // BASE_CSS 끝 바로 뒤에서 닫힌다(덧붙은 것 0)
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
 * 🎬 제휴사 입점 위젯 모션 (같은 날 대표 *"에이전시도 그렇고 제휴사가 더 급해"*)
 *   ⑦ 확정 시안 B 의 마크업은 그대로 — 모션은 문서 끝에 붙는 CSS 뿐이다
 *   ⑧ 스크립트 0 · 움직임 줄이기면 전부 멈추고 줄은 그어진 상태로
 *   ⑨ 📱 좁은 폭에서 문서가 붙인 iframe 높이(360)를 넘지 않게 치수를 줄인다(종전 340px 에서 409px — 버튼이 잘렸다)
 *   ⑩ 🔴 에이전시 모션과 섞이지 않는다
 * ⚠️ 못 보는 것: 실제 높이(브라우저 레이아웃) — 2026-11-02 Playwright 실측 320~760px 전부 360 이었다(300 이하는 넘친다).
 */
describe('🎬 제휴사 입점 위젯 모션', () => {
  const html = renderPartner('light', '한빛', 3)
  it('⑦ 마크업은 그대로, 모션 CSS 는 BASE 뒤에 붙는다', () => {
    expect(html).toMatch(/<div class="col old"><b>체험단<\/b><span>음식은 공짜로<\/span><span>후기만 남고<\/span><span>매출은 0원<\/span><\/div><div class="col new"><b>유어딜 이용권<\/b>/)
    expect(html).toContain(PARTNER_MOTION_CSS + '</style>')
  })
  it('⑧ 스크립트 0 · 움직임 줄이기면 멈춤', () => {
    expect(html).not.toMatch(/<script/i)
    expect(PARTNER_MOTION_CSS).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\.pt \*,\.pt \*::before,\.pt \*::after\{animation:none!important;transition:none!important\}\.pt \.old span::after\{transform:none\}\}/)
  })
  it('⑨ 좁은 폭 압축 블록이 있다', () => {
    expect(PARTNER_MOTION_CSS).toMatch(/@media \(max-width:500px\)\{\.pt\{padding:6px\}[^@]*\.pt \.in\{padding:16px 18px\}[^@]*\.pt \.cmp\{margin:14px 0\}/)
  })
  it('⑩ 에이전시 모션과 섞이지 않는다', () => {
    expect(html).not.toContain('ag-')
    expect(agency(5)).not.toContain('pm-')
  })
})
