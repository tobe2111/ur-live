/**
 * ❓ 자주 묻는 질문(`/faq`) 서버 첫 화면 (2026-11-10 — 라이브 폰 첫 그림 2.9s · HTML 0.3~0.5s).
 *
 * 지키는 것:
 *   ① 서버 HTML 이 `shared/faq-page.ts`·`shared/sub-page-head.ts` 의 클래스·문구를 쓰고, 뿌리는 `SUB_PAGE_CLS` · 머리줄이 첫 자식
 *   ② `FAQPage`·`SubPageHeader` 도 같은 상수를 쓴다 — 손으로 다시 적은 클래스 문자열이 없다(갈리면 마운트 때 모양이 바뀐다)
 *   ③ 질문 줄 = `CONCEPT_FAQ` 전부(같은 순서) · 분류 칩 = 전체 + 고유 분류(첫 칩만 켜짐) · **답변 본문은 없다**(모션 CSS 전엔 펼쳐 보인다)
 *   ④ 머리줄은 스크롤 0 상태(h1 숨김 · 큰 제목 scale(1))
 *   ⑤ PC 면 [네비 높이 예약] + [430 액자] · 워커 배선(UA 는 빌더 인자) · `firstScreenApplies` 폰·PC · 표면 `faq` ↔ 생성기 ROOTS
 * ⚠️ 못 보는 것: 실제 픽셀(jsdom) · 다국어 사용자(서버는 한국어 기본값 — 다른 첫 화면과 같은 전제).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { buildFaqFirstScreen, faqCategories, subPageHeadHtml } from '@/worker/utils/faq-first-screen'
import { FAQ_CLS, FAQ_COPY } from '@/shared/faq-page'
import { SUB_PAGE_CLS, SUB_PAGE_HEAD, subPageTitleTransform } from '@/shared/sub-page-head'
import { CONCEPT_FAQ } from '@/shared/seo/concept-content'
import { PC_HOME_FS } from '@/shared/pc-home-first-screen'
import { GUEST_PC_FRAME } from '@/worker/utils/guest-first-screen'
import { firstScreenApplies, criticalSurfaceOf, criticalCssFor } from '@/worker/utils/css-first-boot'
// @ts-expect-error — .mjs 생성기(타입 없음)
import { SURFACE_ROOTS } from '../../../scripts/generate-critical-css.mjs'

const src = (f: string) => stripComments(readFileSync(f, 'utf8'))
const PAGE = src('src/pages/FAQPage.tsx'), HEAD = src('src/components/ui/sub-page-header.tsx')
const LOADER = '<div style="min-height:100dvh">LOADER</div>'
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const dom = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return d }
const html = buildFaqFirstScreen(LOADER)

describe('① 서버 HTML = 상수', () => {
  it.each(Object.entries(FAQ_CLS).filter(([k]) => !['aInner', 'aText'].includes(k)))('FAQ 클래스 %s', (_k, v) => { expect(html).toContain(v) })
  it.each(Object.entries(SUB_PAGE_HEAD).filter(([k]) => !['headerCollapsed', 'rowColsWide', 'h1Shown', 'rightWide'].includes(k)))('머리줄 클래스 %s', (_k, v) => { expect(html).toContain(v) })
  it('문구 전부 · 뿌리 · 머리줄이 첫 자식 · 로더는 아래', () => {
    for (const v of Object.values(FAQ_COPY)) expect(html).toContain(v)
    const root = dom(html).querySelector('#ur-first-screen > div')!
    expect(root.getAttribute('class')).toBe(SUB_PAGE_CLS)
    expect(root.firstElementChild!.tagName).toBe('HEADER')
    expect(root.children[2].getAttribute('class')).toBe(FAQ_CLS.content)
    expect(html).toContain('min-height:34dvh'); expect(html.indexOf('LOADER')).toBeGreaterThan(html.lastIndexOf('</div>') - 200)
  })
})

describe('② 화면·부품이 같은 상수를 쓴다', () => {
  it('FAQPage — 손으로 적은 클래스 0 · 문구는 상수 기본값', () => {
    for (const k of Object.keys(FAQ_CLS) as Array<keyof typeof FAQ_CLS>) {
      expect(PAGE, k).toContain(`FAQ_CLS.${k}`)
      expect(PAGE, `손으로 적은 ${k}`).not.toContain(`"${FAQ_CLS[k]}"`)
    }
    for (const k of ['title', 'catAll', 'heroTitle', 'heroDesc', 'searchPlaceholder', 'supportTitle', 'supportDesc', 'supportHours', 'supportHoursValue', 'supportEmail', 'supportEmailValue'] as const) expect(PAGE, k).toContain(`defaultValue: FAQ_COPY.${k}`)
    expect(PAGE).toContain('{FAQ_COPY.badge}')
  })
  it('SubPageHeader — 머리줄 상수 전부 · 큰 제목 변형 함수', () => {
    for (const k of Object.keys(SUB_PAGE_HEAD) as Array<keyof typeof SUB_PAGE_HEAD>) {
      expect(HEAD, k).toContain(`SUB_PAGE_HEAD.${k}`)
      expect(HEAD, `손으로 적은 ${k}`).not.toContain(`'${SUB_PAGE_HEAD[k]}'`)
    }
    expect(HEAD).toContain('style={subPageTitleTransform(k)}')
    expect(HEAD).toContain("export { SUB_PAGE_CLS, SUB_PAGE_HEADER_CLS }")
  })
})

describe('③ 질문 · 칩 · 답변', () => {
  const d = dom(html)
  it('질문 줄 = CONCEPT_FAQ 전부, 같은 순서 · 답변 본문 없음(칸은 inert 로 비운다)', () => {
    const items = Array.from(d.querySelectorAll(`.${FAQ_CLS.item.split(' ')[0]}`)).filter((e) => e.getAttribute('class') === FAQ_CLS.item)
    expect(items.length).toBe(CONCEPT_FAQ.length)
    items.forEach((it, i) => {
      expect(it.querySelector('p:nth-of-type(2), p + p')!.textContent).toBe(CONCEPT_FAQ[i].question)
      const a = it.querySelector('.ur-faq-a')!
      expect(a.getAttribute('aria-hidden')).toBe('true'); expect(a.hasAttribute('inert')).toBe(true); expect(a.innerHTML).toBe('')
    })
    for (const f of CONCEPT_FAQ) expect(html, '답변 본문은 서버가 안 그린다').not.toContain(f.answer.slice(0, 24))
  })
  it('분류 칩 = 전체 + 고유 분류(배열 순서) · 첫 칩만 켜짐', () => {
    const cats = faqCategories()
    expect(cats[0]).toBe(FAQ_COPY.catAll); expect(new Set(cats).size).toBe(cats.length)
    expect(cats.slice(1)).toEqual(Array.from(new Set(CONCEPT_FAQ.map((f) => f.category))))
    const chips = Array.from(d.querySelector(`[class="${FAQ_CLS.chips}"]`)!.children)
    expect(chips.map((c) => c.textContent)).toEqual(cats)
    expect(chips[0].getAttribute('class')).toBe(`${FAQ_CLS.chip} ${FAQ_CLS.chipOn}`)
    expect(chips.slice(1).every((c) => c.getAttribute('class') === `${FAQ_CLS.chip} ${FAQ_CLS.chipOff}`)).toBe(true)
  })
})

describe('④ 머리줄 = 스크롤 0 상태', () => {
  it('h1 숨김 · 큰 제목 scale(1) opacity 1 · 제목은 FAQ 제목', () => {
    const h = dom(subPageHeadHtml('제목X'))
    expect(h.querySelector('h1')!.getAttribute('class')).toBe(`${SUB_PAGE_HEAD.h1} ${SUB_PAGE_HEAD.h1Hidden}`)
    expect(h.querySelector('h1')!.textContent).toBe('제목X')
    const p = h.querySelector(`p`)!
    expect(p.getAttribute('class')).toBe(SUB_PAGE_HEAD.title)
    expect(p.getAttribute('style')).toContain(subPageTitleTransform(0).transform); expect(p.getAttribute('style')).toContain('opacity:1')
    expect(subPageTitleTransform(1)).toEqual({ transform: 'scale(0.65) translateY(-10px)', opacity: 0 })
    expect(dom(html).querySelector('h1')!.textContent).toBe(FAQ_COPY.title)
  })
})

describe('⑤ PC · 배선', () => {
  it('PC = 네비 예약 + 액자 · 폰은 그대로', () => {
    const fs = dom(buildFaqFirstScreen(LOADER, false)).querySelector('#ur-first-screen')!
    expect(fs.children[0].getAttribute('class')).toBe(PC_HOME_FS.topnav)
    expect(fs.children[1].getAttribute('class')).toBe(GUEST_PC_FRAME.cls); expect(fs.children[1].getAttribute('style')).toBe(`--app-frame:${GUEST_PC_FRAME.width}`)
    expect(fs.children[1].firstElementChild!.getAttribute('class')).toBe(SUB_PAGE_CLS)
    const m = dom(html).querySelector('#ur-first-screen')!
    expect(m.children.length).toBe(1); expect(buildFaqFirstScreen(LOADER)).toBe(buildFaqFirstScreen(LOADER, true))
  })
  it('워커 분기(UA 는 빌더 인자) · 첫 화면 CSS 자격 폰·PC · 표면 faq ↔ 생성기', () => {
    const w = readFileSync('src/worker/index.ts', 'utf8') // ⚠️ worker/index.ts 엔 stripComments 금지(source-text 머리말)
    expect(w).toContain("url.pathname === '/faq') { const faqFirst = buildFaqFirstScreen(urdealLoaderHtml, shouldRenderMobileFirstScreen(c.req.header('user-agent')))")
    expect(w).toContain('el.setInnerContent(faqFirst + faqNs, { html: true })')
    expect(firstScreenApplies('/faq', PHONE)).toBe(true); expect(firstScreenApplies('/faq/', PHONE)).toBe(true); expect(firstScreenApplies('/faq', PC)).toBe(true)
    expect(firstScreenApplies('/faq/x', PHONE)).toBe(false)
    expect(criticalSurfaceOf('/faq')).toBe('faq'); expect(criticalCssFor('/faq', 'FULL', 'HOME', { faq: 'F' })).toBe('F')
    expect(SURFACE_ROOTS.faq).toEqual(['src/worker/utils/faq-first-screen.ts'])
  })
})
