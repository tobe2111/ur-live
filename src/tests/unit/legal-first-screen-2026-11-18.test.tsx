/**
 * ⚖️ 환불 및 교환/반품 정책(`/refund`) · 이용약관(`/terms`) 서버 첫 화면 (2026-11-18 — 라이브 폰 첫 그림 1.5~3.0s · 2.1~4.0s).
 *
 * 지키는 것:
 *   ① 서버 본문 = 화면 본문 **바이트 단위로 같다**(같은 트리·같은 상수에서 그린다) — 실제 React 렌더와 대조
 *   ② 화면이 같은 상수를 쓴다 — 손으로 다시 적은 클래스·문구가 없다(정책 문구 두 벌 금지)
 *   ③ 머리줄 모양(같은 클래스 · 뒤로 칸 24px) · 노드 id `ur-first-screen` · 로더는 아래
 *   ④ PC 는 [상단 네비 + 같은 본문](두 경로는 pc-fullbleed — 액자 없음) · 워커 배선 · 첫 화면 CSS 자격 · 표면 `legal` ↔ 생성기
 *   ⑤ 청크 preload(route-surface · PRELOAD_ONLY_ROUTES · registerBootPage)
 * ⚠️ 못 보는 것: 실제 픽셀(jsdom) · 다국어 사용자(서버는 한국어 — 두 화면 모두 번역 키가 없다).
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

vi.mock('@/components/SEO', () => ({ default: () => null }))
import RefundPolicyPage from '@/pages/RefundPolicyPage'
import TermsOfServicePage from '@/pages/TermsOfServicePage'
import { buildLegalFirstScreen, refundPageHtml, termsPageHtml, legalPathOf } from '@/worker/utils/legal-first-screen'
import { REFUND_BODY, REFUND_CLS, REFUND_COPY, refundText } from '@/shared/refund-policy-content'
import { TERMS_CLS } from '@/shared/terms-page'
import { CONSUMER_TERMS } from '@/pages/terms/consumer-terms-content'
import { COMPANY } from '@/shared/company-info'
import { VOUCHER_VALIDITY_LABEL } from '@/shared/voucher-validity'
import { PC_TOPNAV_FRAME } from '@/shared/pc-topnav-frame'
import { firstScreenApplies, criticalSurfaceOf, criticalCssFor } from '@/worker/utils/css-first-boot'
import { routeSurface } from '@/shared/route-surface'
import { isFullBleedPcPath } from '@/shared/pc-fullbleed'
// @ts-expect-error — .mjs 생성기(타입 없음)
import { SURFACE_ROOTS, ROOTS } from '../../../scripts/generate-critical-css.mjs'
// @ts-expect-error — .mjs 생성기(타입 없음)
import { PRELOAD_ONLY_ROUTES } from '../../../scripts/generate-route-chunk-map.mjs'

const LOADER = '<div style="min-height:100dvh">LOADER</div>'
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const dom = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return d }
/** 📧 서버는 이메일 글자를 `<!--email_off-->` 로 감싼다(Cloudflare 가리기 제외) — 대조 전에 걷어 낸다. */
const noEmailOff = (h: string) => h.replace(/<!--\/?email_off-->/g, '')
const appRoot = (Page: () => JSX.Element) => render(<MemoryRouter><Page /></MemoryRouter>).container.firstElementChild as HTMLElement

describe.each([
  ['/refund', RefundPolicyPage, refundPageHtml, REFUND_CLS],
  ['/terms', TermsOfServicePage, termsPageHtml, TERMS_CLS],
] as const)('%s', (_path, Page, serverHtml, C) => {
  const app = appRoot(Page as () => JSX.Element)
  const srv = dom(noEmailOff((serverHtml as () => string)())).firstElementChild as HTMLElement

  it('① 본문 = 화면 본문(바이트 동일) · 뿌리 클래스 같다', () => {
    expect(srv.getAttribute('class')).toBe(C.root)
    expect(app.getAttribute('class')).toBe(C.root)
    const a = app.querySelector(`:scope > [class="${C.content}"]`)!, s = srv.querySelector(`:scope > [class="${C.content}"]`)!
    expect(a, '화면 본문 틀').not.toBeNull(); expect(s, '서버 본문 틀').not.toBeNull()
    expect(s.innerHTML).toBe(a.innerHTML)
    expect(s.textContent!.length).toBeGreaterThan(800)
  })

  it('③ 머리줄 — 같은 클래스 · 제목 · 뒤로 칸은 같은 24px 빈 칸', () => {
    const ah = app.firstElementChild!, sh = srv.firstElementChild!
    expect(sh.getAttribute('class')).toBe(C.header); expect(ah.getAttribute('class')).toBe(C.header)
    const ar = ah.firstElementChild!, sr = sh.firstElementChild!
    expect(sr.getAttribute('class')).toBe(C.headerRow); expect(ar.getAttribute('class')).toBe(C.headerRow)
    expect(sr.children.length).toBe(ar.children.length)
    expect(sr.children[0].getAttribute('class')).toBe(C.back); expect(ar.children[0].getAttribute('class')).toBe(C.back)
    expect(sr.children[0].firstElementChild!.getAttribute('class')).toBe(`${C.backIcon} block`)
    expect(ar.children[0].querySelector('svg')!.getAttribute('class')).toContain(C.backIcon)
    expect(sr.querySelector('h1')!.outerHTML).toBe(ar.querySelector('h1')!.outerHTML)
    expect(sr.children[2].outerHTML).toBe(ar.children[2].outerHTML)
  })
})

describe('② 화면이 같은 상수를 쓴다(문구 두 벌 금지)', () => {
  const REF = stripComments(readFileSync('src/pages/RefundPolicyPage.tsx', 'utf8'))
  const DOC = stripComments(readFileSync('src/pages/terms/TermsDocument.tsx', 'utf8'))
  it('환불 화면 — 본문은 트리에서 · 손으로 적은 className 0 · 정책 문구가 페이지 파일에 없다', () => {
    expect(REF).toContain('REFUND_BODY.map(')
    expect(REF).not.toMatch(/className="/)
    for (const k of Object.keys(REFUND_CLS)) expect(REF, k).toContain(`REFUND_CLS.${k}`)
    expect(REF).toContain('{REFUND_COPY.title}')
    for (const s of ['결제 금액 전액', '배송비 부담 안내', '대한통운', '전자상거래 등에서의 소비자보호']) expect(REF, s).not.toContain(s)
  })
  it('환불 트리 — 회사 값·유효기간은 SSOT 에서(손으로 적지 않는다)', () => {
    const t = refundText(REFUND_BODY)
    expect(t).toContain(COMPANY.bizRegNo); expect(t).toContain(COMPANY.address); expect(t).toContain(VOUCHER_VALIDITY_LABEL)
    const SRC = stripComments(readFileSync('src/shared/refund-policy-content.ts', 'utf8'))
    expect(SRC).toContain('COMPANY.bizRegNo'); expect(SRC).toContain('COMPANY.address'); expect(SRC).toContain('VOUCHER_VALIDITY_LABEL')
    expect(SRC).not.toContain('479-09-02930')
    expect(REFUND_COPY.title).toBe('환불 및 교환/반품 정책')
  })
  it('약관 문서 — 손으로 적은 className 0 · 상수 전부', () => {
    expect(DOC).not.toMatch(/className="/)
    expect(DOC).not.toMatch(/className=\{[^}]*'[a-z]/) // 삼항 안의 손 클래스도
    for (const k of Object.keys(TERMS_CLS)) expect(DOC, k).toContain(`TERMS_CLS.${k}`)
    expect(DOC).toContain('termsEffectiveLine(doc.effective, doc.version)')
  })
  it('약관 서버 본문 — 조항 전부(같은 순서) · 사업자 줄', () => {
    const h = dom(termsPageHtml())
    expect(Array.from(h.querySelectorAll('h2')).map((x) => x.textContent)).toEqual(CONSUMER_TERMS.sections.map((s) => s.title))
    expect(h.textContent).toContain(CONSUMER_TERMS.footer)
  })
  it('🏢 약관 하단 사업자 줄 = COMPANY(신고번호 부산금정 — 2026-11-18 대표 "2번은 부산금정으로") · 손으로 적은 값 0', () => {
    expect(CONSUMER_TERMS.footer).toContain(`통신판매업신고 제${COMPANY.mailOrderNo}호`)
    for (const v of [COMPANY.bizRegNo, COMPANY.address, COMPANY.email, COMPANY.ceo]) expect(CONSUMER_TERMS.footer).toContain(v)
    const TT = stripComments(readFileSync('src/pages/terms/terms-biz-footer.ts', 'utf8'))
    expect(TT).not.toContain('0540'); expect(TT).not.toContain('479-09-02930'); expect(TT).toContain('COMPANY.mailOrderNo')
    expect(stripComments(readFileSync('src/pages/terms/terms-types.ts', 'utf8'))).not.toContain('사업자 정보')
  })
})

describe('③ 첫 화면 노드 · 로더 · 이메일', () => {
  it.each(['/refund', '/terms'] as const)('%s — #ur-first-screen 안에 화면 · 로더는 아래(34dvh) · 이메일은 email_off', (p) => {
    const html = buildLegalFirstScreen(p, LOADER)
    const fs = dom(html).querySelector('#ur-first-screen')!
    expect(fs.children.length).toBe(1)
    expect(fs.firstElementChild!.getAttribute('class')).toBe(p === '/refund' ? REFUND_CLS.root : TERMS_CLS.root)
    expect(html).toContain('min-height:34dvh'); expect(html.indexOf('LOADER')).toBeGreaterThan(html.indexOf('</h1>'))
    expect(html).toContain('<!--email_off-->'); expect(html).not.toMatch(/[^>]jiwon@ur-team\.com(?!<!--\/email_off-->)/)
  })
})

describe('④ PC · 배선', () => {
  it('두 경로는 PC 풀너비(액자 없음) → [상단 네비 + 같은 본문] · 폰은 본문만', () => {
    for (const p of ['/refund', '/terms'] as const) {
      expect(isFullBleedPcPath(p), p).toBe(true)
      const fs = dom(buildLegalFirstScreen(p, LOADER, p)).querySelector('#ur-first-screen')!
      expect(fs.children.length).toBe(2)
      expect(fs.children[0].getAttribute('class')).toBe(PC_TOPNAV_FRAME.outer)
      expect(fs.children[1].getAttribute('class')).toBe(p === '/refund' ? REFUND_CLS.root : TERMS_CLS.root)
      expect(fs.innerHTML).not.toContain('app-framed')
    }
  })
  it('워커 분기(UA → pcPath) · noscript 는 뒤에', () => {
    const w = readFileSync('src/worker/index.ts', 'utf8') // ⚠️ worker/index.ts 엔 stripComments 금지(source-text 머리말)
    expect(w).toContain("import { buildLegalFirstScreen, legalPathOf } from './utils/legal-first-screen';")
    expect(w).toContain("else if (legalPathOf(url.pathname)) { const legalFirst = buildLegalFirstScreen(legalPathOf(url.pathname)!, urdealLoaderHtml, shouldRenderMobileFirstScreen(c.req.header('user-agent')) ? undefined : url.pathname);")
    expect(w).toContain('el.setInnerContent(legalFirst + legalNs, { html: true })')
  })
  it('판정 — 두 경로만(약관 하위 문서는 아니다)', () => {
    expect(legalPathOf('/refund')).toBe('/refund'); expect(legalPathOf('/terms/')).toBe('/terms')
    expect(legalPathOf('/terms/seller')).toBeNull(); expect(legalPathOf('/refund-policy')).toBeNull()
  })
  it('첫 화면 CSS 자격 폰·PC · 표면 legal ↔ 생성기 ROOTS·SURFACE_ROOTS', () => {
    for (const p of ['/refund', '/terms', '/refund/', '/terms/']) {
      expect(firstScreenApplies(p, PHONE), p).toBe(true); expect(firstScreenApplies(p, PC), p).toBe(true)
    }
    expect(firstScreenApplies('/terms/seller', PHONE)).toBe(false)
    expect(criticalSurfaceOf('/refund')).toBe('legal'); expect(criticalSurfaceOf('/terms')).toBe('legal')
    expect(criticalCssFor('/terms', 'FULL', 'HOME', { legal: 'L' })).toBe('L')
    expect(SURFACE_ROOTS.legal).toEqual(['src/worker/utils/legal-first-screen.ts'])
    expect(ROOTS).toContain('src/worker/utils/legal-first-screen.ts')
  })
})

describe('⑤ 청크 preload', () => {
  it('route-surface · PRELOAD_ONLY_ROUTES · registerBootPage', () => {
    expect(routeSurface('/refund', true, false)).toBe('refund'); expect(routeSurface('/terms', true, false)).toBe('terms')
    expect(PRELOAD_ONLY_ROUTES.refund).toEqual(['src/pages/RefundPolicyPage.tsx'])
    expect(PRELOAD_ONLY_ROUTES.terms).toEqual(['src/pages/TermsOfServicePage.tsx'])
    const APP = readFileSync('src/App.tsx', 'utf8')
    expect(APP).toContain("const TermsOfServicePage = lazyPage(() => import('./pages/TermsOfServicePage')); registerBootPage('terms', TermsOfServicePage.load)")
    expect(APP).toContain("registerBootPage('refund', RefundPolicyPage.load)")
  })
})
