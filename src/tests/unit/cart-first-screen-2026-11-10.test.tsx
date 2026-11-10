/**
 * 🧺 장바구니(`/cart`) 서버 첫 화면 (2026-11-10 — 라이브 폰 첫 그림 2.1s · HTML 0.3~0.5s).
 *
 * 지키는 것:
 *   ① 서버 HTML = `shared/cart-page.ts` 클래스·문구(개수 없음 · 닫기는 22px 빈 칸) · 로더는 아래
 *   ② `CartHeader` 가 같은 상수를 쓰고, `CartPage` **로딩 분기**도 같은 뿌리 + 머리줄(흰 바탕 + 큰 로더로 바뀌지 않는다)
 *   ③ 워커 분기(세션 조건 없음 · UA 는 빌더 인자) · `firstScreenApplies` 폰·PC · 표면 `cart` ↔ 생성기 ROOTS
 *   ④ PC 면 [네비 높이 예약] + [430 액자]
 * ⚠️ 못 보는 것: 개수·전체선택 줄은 데이터 뒤에 머리줄 아래로 붙는다(아래로만 자란다 — 픽셀은 배포 뒤 실측).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { buildCartFirstScreen } from '@/worker/utils/cart-first-screen'
import { CART_CLS, CART_COPY, CART_BACK_ICON, CART_EMPTY_CLS, CART_EMPTY_ICON } from '@/shared/cart-page'
import { PC_HOME_FS } from '@/shared/pc-home-first-screen'
import { GUEST_PC_FRAME } from '@/worker/utils/guest-first-screen'
import { firstScreenApplies, criticalSurfaceOf, criticalCssFor } from '@/worker/utils/css-first-boot'
// @ts-expect-error — .mjs 생성기(타입 없음)
import { SURFACE_ROOTS } from '../../../scripts/generate-critical-css.mjs'

const src = (f: string) => stripComments(readFileSync(f, 'utf8'))
const HEADER = src('src/components/cart/CartHeader.tsx'), PAGE = src('src/pages/CartPage.tsx'), EMPTY = src('src/components/cart/EmptyCart.tsx')
const LOADER = '<div style="min-height:100dvh">LOADER</div>'
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const dom = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return d }
const html = buildCartFirstScreen(LOADER)

describe('① 서버 HTML', () => {
  it.each(Object.entries(CART_CLS).filter(([k]) => k !== 'count'))('클래스 %s', (_k, v) => { expect(html).toContain(v) })
  it('뿌리 · 머리줄 · 제목(개수 없음) · 닫기 22px 빈 칸 · 로더 아래', () => {
    const root = dom(html).querySelector('#ur-first-screen > div')!
    expect(root.getAttribute('class')).toBe(CART_CLS.root)
    expect(root.firstElementChild!.getAttribute('class')).toBe(CART_CLS.header)
    const h1 = root.querySelector('h1')!
    expect(h1.getAttribute('class')).toBe(CART_CLS.title); expect(h1.textContent!.trim()).toBe(CART_COPY.title); expect(h1.querySelector('span')).toBeNull()
    const icon = root.querySelector(`.${CART_CLS.back.split(' ')[0]} > span`)!
    expect(icon.getAttribute('style')).toBe(`width:${CART_BACK_ICON}px;height:${CART_BACK_ICON}px`)
    expect(html).toContain('min-height:34dvh'); expect(html.indexOf('LOADER')).toBeGreaterThan(html.indexOf('</div>'))
  })
})

describe('② 화면이 같은 상수를 쓴다', () => {
  it('CartHeader — 제목 줄 상수 전부 · 아이콘 크기 상수', () => {
    for (const k of ['header', 'headerRow', 'back', 'backIcon', 'title', 'count', 'spacer'] as const) {
      expect(HEADER, k).toContain(`CART_CLS.${k}`)
      expect(HEADER, `손으로 적은 ${k}`).not.toContain(`"${CART_CLS[k]}"`)
    }
    expect(HEADER).toContain('<X size={CART_BACK_ICON}'); expect(HEADER).toContain("defaultValue: CART_COPY.title"); expect(HEADER).toContain("defaultValue: CART_COPY.back")
  })
  it('CartPage — 로딩 분기가 완성 화면과 같은 뿌리 + 머리줄, fullScreen 로더가 아니다', () => {
    const loading = PAGE.slice(PAGE.indexOf('if (loading) {'), PAGE.indexOf('return (', PAGE.indexOf('if (loading) {') + 20) + 400)
    expect(loading).toContain('<div className={CART_CLS.root}>')
    expect(loading).toContain('<CartHeader itemCount={0}')
    expect(loading).toContain("<BrandLoader label={t('cart.loading', { defaultValue: CART_COPY.loading })} />")
    expect(loading).not.toContain('fullScreen'); expect(loading).not.toContain('bg-white')
    expect((PAGE.match(/className=\{CART_CLS\.root\}/g) || []).length).toBe(2)
  })
})

describe('③ 배선', () => {
  it('워커: /cart 분기 — 세션 조건 없음 · UA 는 빌더 인자', () => {
    const w = readFileSync('src/worker/index.ts', 'utf8') // ⚠️ worker/index.ts 엔 stripComments 금지(source-text 머리말)
    expect(w).toContain("} else if (url.pathname === '/cart') { const cartFirst = buildCartFirstScreen(urdealLoaderHtml, shouldRenderMobileFirstScreen(c.req.header('user-agent')), authed)")
  })
  it('첫 화면 CSS 자격 폰·PC · 표면 cart ↔ 생성기', () => {
    expect(firstScreenApplies('/cart', PHONE)).toBe(true); expect(firstScreenApplies('/cart/', PHONE)).toBe(true); expect(firstScreenApplies('/cart', PC)).toBe(true)
    expect(firstScreenApplies('/cart/x', PHONE)).toBe(false); expect(firstScreenApplies('/checkout', PHONE)).toBe(false)
    expect(criticalSurfaceOf('/cart')).toBe('cart'); expect(criticalCssFor('/cart', 'FULL', 'HOME', { cart: 'C' })).toBe('C')
    expect(SURFACE_ROOTS.cart).toEqual(['src/worker/utils/cart-first-screen.ts'])
  })
})

describe('⑤ 비로그인 = 머리줄 + 빈 장바구니(로더 없음) · 로그인 = 머리줄 + 로더', () => {
  const guest = buildCartFirstScreen(LOADER, true, false)
  it('비로그인 HTML 에 빈 장바구니 전부 · 로더 없음 · 가방 아이콘 36px 빈 칸', () => {
    for (const v of Object.values(CART_EMPTY_CLS)) expect(guest).toContain(v)
    for (const k of ['empty', 'emptySubtitle', 'continueShop'] as const) expect(guest).toContain(CART_COPY[k])
    expect(guest).not.toContain('LOADER')
    const root = dom(guest).querySelector('#ur-first-screen > div')!
    expect(root.children[1].getAttribute('class')).toBe(CART_EMPTY_CLS.wrap)
    expect(root.querySelector(`.${CART_EMPTY_CLS.iconBox.split(' ')[0]} > span`)!.getAttribute('style')).toBe(`width:${CART_EMPTY_ICON}px;height:${CART_EMPTY_ICON}px`)
  })
  it('로그인(기본값) HTML 엔 빈 장바구니가 없고 로더가 있다', () => {
    expect(html).not.toContain(CART_COPY.empty); expect(html).toContain('LOADER')
    expect(buildCartFirstScreen(LOADER)).toBe(buildCartFirstScreen(LOADER, true, true))
  })
  it('EmptyCart 가 같은 상수를 쓴다', () => {
    for (const k of Object.keys(CART_EMPTY_CLS) as Array<keyof typeof CART_EMPTY_CLS>) {
      expect(EMPTY, k).toContain(`CART_EMPTY_CLS.${k}`)
      expect(EMPTY, `손으로 적은 ${k}`).not.toContain(`"${CART_EMPTY_CLS[k]}"`)
    }
    expect(EMPTY).toContain('<BagIcon size={CART_EMPTY_ICON}')
    for (const k of ['empty', 'emptySubtitle', 'continueShop'] as const) expect(EMPTY).toContain(`defaultValue: CART_COPY.${k}`)
  })
})

describe('④ PC', () => {
  it('네비 예약 + 액자 · 폰은 그대로', () => {
    const fs = dom(buildCartFirstScreen(LOADER, false)).querySelector('#ur-first-screen')!
    expect(fs.children[0].getAttribute('class')).toBe(PC_HOME_FS.topnav)
    expect(fs.children[1].getAttribute('class')).toBe(GUEST_PC_FRAME.cls); expect(fs.children[1].getAttribute('style')).toBe(`--app-frame:${GUEST_PC_FRAME.width}`)
    expect(dom(html).querySelector('#ur-first-screen')!.children.length).toBe(1)
  })
})
