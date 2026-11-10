/**
 * 👤 마이 하위 화면 여섯(주문내역·쿠폰함·내 리뷰·내 숙소 예약·딜 사용 내역·내 단골 가게) 서버 첫 화면 (2026-11-10).
 *
 * 지키는 것:
 *   ① 서버 HTML = 공용 머리줄(`subPageHeadHtml`, 좁은 칸) + 로더 아래 · 뿌리는 `SUB_PAGE_CLS`
 *   ② 제목이 화면이 실제로 쓰는 한국어 문구와 같다(번역 파일 · 화면 소스 리터럴) — 다르면 마운트 때 제목이 바뀐다
 *   ③ 세션 쿠키가 있을 때만 · 폰만: 워커 분기 · `firstScreenApplies` · 표면은 알림과 같은 CSS
 *   ④ 화면이 여전히 `SubPageHeader` + `SUB_PAGE_CLS` 를 쓴다(전제)
 * ⚠️ 못 보는 것: 쿠키는 있는데 세션이 만료된 사람(머리줄이 잠깐 보이고 로그인으로 간다) · 한국어가 아닌 사용자의 제목(마운트 때 번역으로 바뀐다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildMySubFirstScreen, MY_SUB_ROOT_CLS } from '@/worker/utils/notifications-first-screen'
import { subPageHeadHtml } from '@/worker/utils/sub-page-head-html'
import { MY_SUB_PAGES, mySubPageOf } from '@/shared/my-sub-pages'
import { SUB_PAGE_CLS, SUB_PAGE_HEAD } from '@/shared/sub-page-head'
import { firstScreenApplies, criticalSurfaceOf, cssFirstApplies } from '@/worker/utils/css-first-boot'

const LOADER = '<div style="min-height:100dvh">LOADER</div>'
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const KO = JSON.parse(readFileSync('public/locales/ko/translation.json', 'utf8'))
const src = (f: string) => readFileSync(`src/pages/${f}.tsx`, 'utf8')

describe('① 서버 HTML', () => {
  it('머리줄(좁은 칸) + 제목 + 로더 아래', () => {
    const html = buildMySubFirstScreen('쿠폰함', LOADER)
    const d = document.createElement('div'); d.innerHTML = html
    const root = d.querySelector('#ur-first-screen > div')!
    expect(root.getAttribute('class')).toBe(MY_SUB_ROOT_CLS); expect(MY_SUB_ROOT_CLS).toBe('bg-warm'); expect(SUB_PAGE_CLS).toContain(MY_SUB_ROOT_CLS) // 한 화면 높이는 뺀다(로더가 화면 밖으로 밀린다)
    expect(root.innerHTML).toBe(subPageHeadHtml('쿠폰함'))
    expect(root.querySelector('header > div')!.getAttribute('class')).toContain(SUB_PAGE_HEAD.rowCols)
    expect(root.querySelector('h1')!.textContent).toBe('쿠폰함')
    expect(html).toContain('min-height:34dvh'); expect(html.indexOf('LOADER')).toBeGreaterThan(html.indexOf('</header>'))
  })
})

describe('② 제목 = 화면의 한국어 문구', () => {
  it('번역 파일을 쓰는 화면', () => {
    expect(MY_SUB_PAGES['/my-orders']).toBe(KO.myOrders.title); expect(MY_SUB_PAGES['/orders']).toBe(KO.myOrders.title)
    expect(MY_SUB_PAGES['/my-coupons']).toBe(KO.myCoupons.title)
    expect(MY_SUB_PAGES['/my-reviews']).toBe(KO.myReviews.title)
    expect(src('MyOrdersPage')).toContain("<SubPageHeader title={t('myOrders.title')}")
    expect(src('MyCouponsPage')).toContain("<SubPageHeader title={t('myCoupons.title')}")
    expect(src('MyReviewsPage')).toContain("<SubPageHeader title={t('myReviews.title')}")
  })
  it('문구를 직접 적는 화면', () => {
    expect(src('MyStaysPage')).toContain(`<SubPageHeader title="${MY_SUB_PAGES['/my-stays']}"`)
    expect(src('MyDealHistoryPage')).toContain(`<SubPageHeader title="${MY_SUB_PAGES['/my-deal-history']}"`)
    expect(src('MyFollowsPage')).toContain(`<SubPageHeader title="${MY_SUB_PAGES['/my/follows']}"`)
  })
  it('경로 판정 — 끝 슬래시는 같은 화면 · 하위 경로와 다른 화면은 아니다', () => {
    expect(mySubPageOf('/my-orders/')).toBe('주문내역'); expect(mySubPageOf('/my-orders/12')).toBeNull()
    expect(mySubPageOf('/wishlist')).toBeNull(); expect(mySubPageOf('/')).toBeNull(); expect(mySubPageOf('/notifications')).toBeNull()
  })
})

describe('③ 세션 쿠키가 있을 때만 · 폰만', () => {
  it('워커 분기', () => {
    const w = readFileSync('src/worker/index.ts', 'utf8') // raw — worker/index.ts 엔 주석 제거기를 쓰지 않는다
    expect(w).toContain("} else if (authed && mySubPageOf(url.pathname) && shouldRenderMobileFirstScreen(c.req.header('user-agent'))) { const mySubFirst = buildMySubFirstScreen(mySubPageOf(url.pathname)!, urdealLoaderHtml);")
  })
  it.each(Object.keys(MY_SUB_PAGES))('firstScreenApplies %s', (p) => {
    expect(firstScreenApplies(p, PHONE, true)).toBe(true)
    expect(firstScreenApplies(p, PHONE, false)).toBe(false)
    expect(firstScreenApplies(p, PC, true)).toBe(false)
    expect(cssFirstApplies(p, PHONE, false)).toBe(true)
    expect(criticalSurfaceOf(p)).toBe('notifications')
  })
})

describe('④ 전제 — 화면이 공용 머리줄과 뿌리를 쓴다', () => {
  it.each(['MyOrdersPage', 'MyCouponsPage', 'MyReviewsPage', 'MyStaysPage', 'MyDealHistoryPage', 'MyFollowsPage'])('%s', (f) => {
    expect(src(f)).toContain("import SubPageHeader, { SUB_PAGE_CLS } from '@/components/ui/sub-page-header'")
    expect(src(f)).toMatch(/<div className=\{(?:SUB_PAGE_CLS|`\$\{SUB_PAGE_CLS\}[^`]*`)\}>/)
  })
})
