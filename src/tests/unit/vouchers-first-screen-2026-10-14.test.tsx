/**
 * 🎟️ 교환권 목록(`/vouchers`)의 **서버가 그리는 첫 화면** 〔2026-10-14〕
 *
 * 대표: *"더 개선할 것 … 대기업급으로 개선점 모두 찾아줘"* → *"모두 순서대로 진행"*.
 * 실사용자 vitals 에서 교환권의 LCP 요소가 로딩 마스코트였다 — 시드는 HTML 에 와 있는데 로더가 덮고 있었다.
 *
 * ## 지키는 것 — 두 벌이 갈리는 것
 * 워커는 React 를 못 돌려 목록 줄 마크업이 두 벌이 된다. 갈려도 에러가 안 난다 — 마운트 때 조용히 튄다.
 * ⇒ 목록 타일은 **진짜 `VoucherTile` 을 렌더해** 대조하고, 페이지 크롬은 **소스에서 클래스를 읽어** 대조한다.
 * 그리고 첫 화면이 비로그인 화면이므로 **로그인 흔적이 있으면 걷어내는 스크립트**가 실제로 도는지 잰다.
 *
 * ## 못 막는 것
 * - jsdom 은 레이아웃이 없다 — 픽셀은 재생 측정(`replaycls`/박스 대조)이 판정한다.
 * - 아이콘 자리는 같은 치수의 빈 span 이다(가로만 차지) — 아이콘 크기를 바꾸면 그 span 도 같이 바꿀 것.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VoucherTile } from '@/pages/vouchers/shared'
import { VOUCHER_TILE_ABOVE_FOLD, VOUCHER_TILE_CLASS } from '@/shared/voucher-tile'
import {
  buildVouchersFirstScreen, VOUCHERS_FS_CLASS as C, VOUCHERS_FS_ROWS, soldLabelOf, vouchersFirstScreenGuardScript,
} from '@/worker/utils/vouchers-first-screen'
import { stripComments } from '../helpers/source-text'
import { VOUCHERS_DEFAULT_CATEGORY } from '@/shared/seo/voucher-facet'

const root = process.cwd()
const code = (p: string) => stripComments(fs.readFileSync(path.join(root, p), 'utf8'))
const LOADER = '<div class="ur-loader" style="min-height:100dvh">loader</div>'

/** 라이브 시드 모양(`/api/products?...deal_only=1&sort=price_low`). */
const RICH = {
  id: 2192, name: '퍼페티)츄파춥스300', brand_name: 'GS25',
  image_url: 'https://bizimg.giftishow.com/Resource/goods/2023/G00002231234/a.jpg',
  price: 300, original_price: 400, discount_rate: 0, sold_count: 1234, dominant_color: '#aabbcc',
}
const BARE = { id: 2193, name: '네이버페이 포인트 500원', image_url: 'https://media.ur-team.com/x.jpg', price: 500 }
const seed = (rows: unknown[]) => JSON.stringify({ success: true, data: rows })

function workerRows(rows: unknown[]): HTMLElement[] {
  const host = document.createElement('div')
  host.innerHTML = buildVouchersFirstScreen(seed(rows), LOADER, 'n0')
  return [...host.querySelectorAll(`#ur-first-screen [class="${C.list}"] > div`)] as HTMLElement[]
}
function reactRow(p: unknown, idx = 0): HTMLElement {
  const qc = new QueryClient()
  const { container } = render(
    <QueryClientProvider client={qc}><MemoryRouter><VoucherTile p={p as never} aboveFold={idx < VOUCHER_TILE_ABOVE_FOLD} /></MemoryRouter></QueryClientProvider>,
  )
  return container.firstElementChild as HTMLElement
}
const toks = (el: Element | null) => (el?.getAttribute('class') || '').split(/\s+/).filter(Boolean).sort()
/** 요소의 모양을 [태그 무관 · 클래스 · 직접 글자] 로 펼친다 — 구조와 순서가 같아야 한다. */
function shape(el: Element): unknown {
  return {
    cls: toks(el),
    text: [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim(),
    kids: [...el.children].filter(k => k.tagName !== 'IMG').map(shape),
  }
}

// 🎟️ 2026-10-14 대표 B안 — 목록이 한 줄 행(VoucherRow) → 3열 타일(VoucherTile). 불변식은 그대로: 워커 타일 = 진짜 타일.
describe('① 목록 타일 = 진짜 VoucherTile', () => {
  for (const [label, p] of [['정가·브랜드·구매수·대표색 있음', RICH], ['최소 모양', BARE]] as const) {
    it(`${label} — 클래스·구조·글자가 같다`, () => {
      const w = workerRows([p])[0]
      const r = reactRow(p)
      expect(w, '워커가 줄을 안 그렸다').toBeTruthy()
      expect(shape(w)).toEqual(shape(r))
    })
  }
  it('사진 속성이 같다(eager·lazy 경계 포함)', () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({ ...RICH, id: 3000 + i, price: 100 + i }))
    const ws = workerRows(rows)
    expect(ws.length).toBe(VOUCHERS_FS_ROWS)
    rows.forEach((p, i) => {
      const wi = ws[i].querySelector('img')!
      const ri = reactRow(p, i).querySelector('img')!
      for (const a of ['src', 'srcset', 'sizes', 'alt', 'width', 'height', 'loading', 'decoding', 'class']) {
        expect(wi.getAttribute(a), `${i}:${a}`).toBe(ri.getAttribute(a))
      }
      expect(wi.style.opacity, `${i}:opacity`).toBe(ri.style.opacity)
      // 🐢 의도적 차이 — 첫 화면 사진은 CSS·JS 에 회선을 양보한다(머리말 실측).
      expect(wi.getAttribute('fetchpriority'), `${i}:fetchpriority`).toBe('low')
    })
  })
  it('대표색은 사진 칸 배경으로 — 같은 값', () => {
    const w = workerRows([RICH])[0].firstElementChild as HTMLElement
    const r = reactRow(RICH).firstElementChild as HTMLElement
    expect(w.style.backgroundColor).toBe(r.style.backgroundColor)
    expect(w.style.backgroundColor).not.toBe('')
  })
  it('구매수 표기 규칙이 같다', () => {
    for (const n of [7, 1234, 15000]) {
      const r = reactRow({ ...RICH, sold_count: n })
      expect(r.textContent).toContain(`구매 ${soldLabelOf(n)}`)
    }
  })
  it('화면과 같은 정렬(낮은 가격순)로 앞 줄만', () => {
    const ws = workerRows([{ ...BARE, id: 1, price: 900 }, { ...BARE, id: 2, price: 100 }])
    expect(ws[0].textContent).toContain('100')
    expect(ws[1].textContent).toContain('900')
  })
})

describe('② 페이지 크롬 클래스 = 소스', () => {
  it('VouchersPage — 페이지 · reveal 그룹 · 정렬 줄 · 목록', () => {
    const s = code('src/pages/VouchersPage.tsx')
    for (const k of ['page', 'reveal', 'sortBar', 'sortTitle', 'sortCount', 'listWrap'] as const) {
      expect(s, k).toContain(C[k])
    }
    // 🎟️ B안: 목록 격자는 SSOT 상수 — 페이지와 워커가 같은 값을 쓴다(문자열 사본이면 갈린다).
    //   ⚠️ 스켈레톤도 같은 격자를 쓴다 — 그 자리로 통과하지 않게 **목록 렌더 자리**에 앵커한다.
    expect(s, 'list').toMatch(/className=\{VOUCHER_TILE_CLASS\.grid\}>\s*\{displayProducts\.slice\(0, embedVisible\)[\s\S]{0,120}<VoucherTile /)
    expect(C.list).toBe(VOUCHER_TILE_CLASS.grid)
  })
  // 🔀 2026-11-01 재조준 — 대표 확정 A안으로 머리가 **배너(196px) → 한 줄(56px)** 이 됐다.
  //   지키려던 불변식은 그대로다: *"서버 첫 화면과 화면 부품이 같은 클래스를 쓴다"*(두 벌이면 마운트 때 밀린다).
  //   앵커만 `VouchersHero` → `shared/vouchers-top-row` 로 옮겼다.
  it('머리 한 줄 = VOUCHERS_TOP_ROW (A안, 2026-11-01)', async () => {
    const { VOUCHERS_TOP_ROW } = await import('@/shared/vouchers-top-row')
    expect(C.topRow).toBe(VOUCHERS_TOP_ROW.row)
    expect(C.topRule).toBe(VOUCHERS_TOP_ROW.rule)
    expect(C.topGuest).toBe(VOUCHERS_TOP_ROW.guest)
    expect(C.topIcBtn).toBe(VOUCHERS_TOP_ROW.icbtn)
    // 높이를 정하는 것은 `row` 의 h-14 하나다 — 숫자를 다른 곳에 또 적으면 두 벌이 된다.
    expect(VOUCHERS_TOP_ROW.row).toMatch(/\bh-14\b/)
    // 🔴 서버 첫 화면은 **비로그인 화면**이라 잔액이 아니라 할 수 있는 일을 말한다(0 을 적지 않는다).
    const fs = code('src/worker/utils/vouchers-first-screen.ts')
    expect(fs).toContain('딜 모으기')
    expect(fs).not.toMatch(/C\.topRow[\s\S]{0,400}내 딜/)
    // 🔴 배너는 더 이상 머리가 아니다 — 되살아나면 첫 상품이 다시 196px 아래로 내려간다.
    expect(fs).not.toContain('heroBannerHtml')
    expect(fs).not.toContain('bannersOfSlot')
  })
  it('칩 예약 · 정렬 버튼', async () => {
    // 🔀 2026-11-01 — 잔액 바(`DealBalanceCard`) 단언은 위 '머리 한 줄' 로 옮겼다. A안에서 교환권 머리는
    //   그 카드를 쓰지 않는다(그 부품은 **마이가 계속 쓴다** — 그래서 지우지 않았고 여기서만 안 본다).
    const res = code('src/pages/vouchers/TopChromeReserve.tsx')
    // 🗂️ 2026-10-25 D안: 칩 줄 클래스는 SSOT `VOUCHER_CAT_TAB` — 워커와 예약이 같은 상수를 쓴다.
    const { VOUCHER_CAT_TAB } = await import('@/shared/voucher-tile')
    expect(C.chipWrap).toBe(VOUCHER_CAT_TAB.wrap); expect(C.chip).toBe(`${VOUCHER_CAT_TAB.tab} ${VOUCHER_CAT_TAB.on}`)
    expect(res).toContain('VOUCHER_CAT_TAB.wrap'); expect(res).toContain('VOUCHER_CAT_TAB.tab')
    const sort = code('src/components/ui/sort-menu.tsx')
    expect(sort).toContain(C.sortBtn)
  })
  // ☕ 2026-10-14 (대표 *"첫 화면은 이렇게 떠줘"* — 커피/음료 + 브랜드 로고 줄, '브랜드로 찾기' 제거)
  it('브랜드 로고 줄 예약 = `BrandStripReserve` · 제목 = 기본 카테고리', () => {
    const res = code('src/pages/vouchers/TopChromeReserve.tsx')
    for (const k of ['brandRow', 'brandItem', 'brandTile', 'brandLabel'] as const) expect(res, k).toContain(C[k])
    expect(res, 'brandWrap(바깥 패딩 + invisible)').toContain(C.brandWrap)
    const html = buildVouchersFirstScreen(seed([RICH]), LOADER, 'n0')
    expect(html).toContain(`class="${C.brandWrap}"`)
    expect(html, '칩 줄 다음, 정렬 줄 앞').toMatch(new RegExp(`${C.chip.split(' ')[0]}[\\s\\S]*${C.brandTile.split(' ')[0]}[\\s\\S]*${VOUCHERS_DEFAULT_CATEGORY.replace('/', '\\/')} 교환권`))
    expect(html).not.toContain('전체 교환권')
  })
})

describe('③ 로그인 흔적 · 넓은 화면이면 걷어낸다', () => {
  beforeEach(() => { localStorage.clear(); document.body.innerHTML = '' })
  const run = () => {
    document.body.innerHTML = buildVouchersFirstScreen(seed([RICH]), LOADER, 'n0')
    const js = vouchersFirstScreenGuardScript('n0').replace(/^<script[^>]*>|<\/script>$/g, '')
    new Function(js)()
    return document.getElementById('ur-first-screen')
  }
  it('비로그인 · 좁은 화면 → 남긴다', () => { expect(run()).not.toBeNull() })
  it('user_id 가 있으면 걷어낸다', () => { localStorage.setItem('user_id', '3'); expect(run()).toBeNull() })
  it('옛 키 userId 도 본다(getUserIdSync 와 같은 두 키)', () => { localStorage.setItem('userId', '3'); expect(run()).toBeNull() })
  it('getUserIdSync 가 보는 키가 바뀌면 이 시험을 다시 조준할 것', () => {
    const auth = code('src/utils/auth.ts')
    expect(auth).toMatch(/getUserIdSync\(\)[^{]*\{\s*return localStorage\.getItem\('user_id'\) \|\| localStorage\.getItem\('userId'\)/)
  })
  it('넓은 화면 판정이 페이지의 isPc 와 같은 질의다', () => {
    expect(code('src/pages/VouchersPage.tsx')).toContain("useMediaQuery('(min-width: 1024px)')")
    expect(vouchersFirstScreenGuardScript('n')).toContain("(min-width: 1024px)")
  })
  it('스크립트에 nonce 가 붙는다(CSP strict-dynamic)', () => {
    expect(vouchersFirstScreenGuardScript('abc')).toMatch(/^<script nonce="abc">/)
  })
})

describe('④ 폴백과 배선', () => {
  it('시드가 비거나 깨지면 빈 문자열(종전 로더)', () => {
    expect(buildVouchersFirstScreen('{', LOADER, 'n')).toBe('')
    expect(buildVouchersFirstScreen(seed([]), LOADER, 'n')).toBe('')
    expect(buildVouchersFirstScreen(JSON.stringify({ success: false, data: [RICH] }), LOADER, 'n')).toBe('')
  })
  it('글자를 탈출한다', () => {
    const html = buildVouchersFirstScreen(seed([{ ...BARE, name: 'a<b>&"x', brand_name: '<i>' }]), LOADER, 'n')
    expect(html).not.toContain('<b>'); expect(html).not.toContain('<i>')
  })
  it('대표색은 #rrggbb 만', () => {
    const html = buildVouchersFirstScreen(seed([{ ...RICH, dominant_color: 'red;background:url(x)' }]), LOADER, 'n')
    expect(html).not.toContain('url(x)')
  })
  it('로더는 그 아래 짧게', () => {
    const html = buildVouchersFirstScreen(seed([RICH]), LOADER, 'n')
    expect(html.indexOf('ur-first-screen')).toBeLessThan(html.indexOf('ur-loader'))
    expect(html).toContain('min-height:34dvh')
  })
  // 🔁 2026-10-18 재조준: 성공 분기가 `vouchersFirst` 하나이던 것이 삼항이 됐다(첫 화면 + facet
  //   `<noscript>`). 불변식 넷은 그대로라 **한 줄 전체를 정규식으로 박던 것**을 조각으로 나눈다 —
  //   성공 분기에 무엇이 더 실리는지는 그 PR 의 가드가 보고, 여기서는 **게이트·호출·폴백**만 지킨다.
  //   (한 줄 통째 앵커는 그 줄을 건드리는 모든 변경에 거짓 빨간불을 낸다 — 실제로 냈다.)
  it('워커 배선: /vouchers 하나 · 폰 UA · nonce · 폴백은 종전(크롤러 요약 + 로더)', () => {
    const w = code('src/worker/index.ts')
    const line = w.split('\n').find(l => l.includes("ssrSlot === 'VOUCHERS' && ssrPayload"))
    expect(line, 'VOUCHERS 첫 화면 분기가 사라졌다').toBeTruthy()
    expect(line!).toContain("url.pathname === '/vouchers' && shouldRenderMobileFirstScreen(c.req.header('user-agent'))")
    expect(line!).toContain('const vouchersFirst = buildVouchersFirstScreen(ssrPayload, urdealLoaderHtml, nonce)') // 🔀 2026-11-01 A안 — 머리에 배너가 없어 보조 시드 인자가 빠졌다
    expect(line!).toContain("rb = rb.on('#root', { element(el) { el.setInnerContent(vouchersFirst")
    expect(line!, '🔴 첫 화면을 못 그리면 **크롤러 요약**이 나와야 한다(본문이 통째로 비는 것 차단)')
      .toContain('buildStaticSurfaceNoscript(url.pathname, crawlerPayload) + urdealLoaderHtml')
  })
})

describe('⑤ 시작 개수 = 세 줄(9) — 초기값과 리셋이 같은 상수', () => {
  // 🩸 2026-10-14 라이브 실측: 초기값만 9 로 바꿨더니 카테고리·브랜드 리셋 effect 가 **마운트에서도**
  //   돌아 `embedded ? 12 : 8` 로 덮어써 첫 화면이 8 장(마지막 줄 두 칸)이었다. 빌드·시험 전부 초록이었다.
  const src = stripComments(fs.readFileSync(path.join(process.cwd(), 'src/pages/VouchersPage.tsx'), 'utf8'))
  it('시작 개수 상수는 /vouchers 9', () => {
    expect(src).toMatch(/const EMBED_INITIAL = embedded \? 12 : 9\b/)
  })
  it('리셋은 같은 상수를 쓴다(숫자를 손으로 적지 않는다)', () => {
    const calls = src.match(/setEmbedVisible\(([^)]*)\)/g) ?? []
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.filter(c => /setEmbedVisible\(\s*embedded\s*\?/.test(c))).toEqual([])
    expect(src).toMatch(/setEmbedVisible\(EMBED_INITIAL\)/)
  })
})
