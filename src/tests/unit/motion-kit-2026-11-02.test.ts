/**
 * 🎬 작은 움직임 키트 (2026-11-02 대표 *"이전에 만든 모션그래픽 다 적용해줘"* + D 묶음 *"셋 다 넣기"*)
 *
 * 지키는 것:
 *   ① 움직임은 레이아웃을 건드리지 않는다(transform·opacity·stroke 만) · '동작 줄이기' 면 꺼진다.
 *   ② (유달이 몸짓은 2026-11-02 대표 *"유달이는 빼고"* 로 넣지 않는다 — 종전 둥실 그대로.)
 *   ③ 숫자 올라가기는 늦게 온 값에서 시작하고, 끝은 정확한 값이며, "아직 모름" 을 망가뜨리지 않는다.
 *   ④ 잠금 파일(BottomNav · GroupBuyFeedCard)의 로딩 계약은 그대로다 — 미리 받기 · 링크 기본 동작 폴백.
 *   ⑤ 사용 완료 도장은 **보는 중에 찍힐 때만** 쾅 — 열 때 이미 쓴 표는 조용하다.
 *
 * ⚠️ 못 보는 것: 움직임이 보기 좋은지 · 실제 폰에서 끊기는지 · 브라우저가 사진을 실제로 이어 그리는지
 *   (View Transitions 는 jsdom 에 없다) — 그건 배포 뒤 폰에서 본다(docs/locks/loading/2026-11-02-…).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { renderHook, act } from '@testing-library/react'
import { useCountUp } from '@/pages/user-profile/useCountUp'
import { canRunDealTransition } from '@/lib/deal-view-transition'
import { noteQrOrigin, takeQrOrigin } from '@/pages/my-vouchers/qr-origin'
import { flyToCart } from '@/lib/fly-to-cart'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import RollingNumber from '@/components/ui/RollingNumber'
import { stripComments } from '../helpers/source-text'

const R = (p: string) => readFileSync(p, 'utf8')
const css = stripComments(R('src/index.css'))
// 화면별로만 받는 CSS 는 부품 파일 안의 injectMotionCss(…) 문자열이다 — 그 문자열들을 모은다.
const LAZY_USERS = ['src/components/voucher/ScanFrame.tsx', 'src/components/search/SearchStates.tsx', 'src/pages/restaurant-map/SheetFilterBar.tsx', 'src/pages/group-buy/DetailGallery.tsx', 'src/components/MyReferralCard.tsx', 'src/pages/my-vouchers/QRModal.tsx', 'src/components/voucher/VoucherScanner.tsx', 'src/components/curator/PinButton.tsx', 'src/pages/SellerMealVoucherNewPage.tsx', 'src/pages/user-profile/seller-section/StoreNotifications.tsx', 'src/pages/seller-orders/MobileOrderList.tsx', 'src/pages/my-vouchers/GiftVoucherSheet.tsx', 'src/pages/my-vouchers/WalletRow.tsx', 'src/components/seller/PhotoGalleryEditor.tsx', 'src/components/ui/RollingNumber.tsx', 'src/pages/group-buy/PassHeadCard.tsx', 'src/pages/restaurant-map/useKakaoMap.ts', 'src/pages/product-detail/ProductReviews.tsx', 'src/pages/group-buy/pay-spin-css.ts', 'src/pages/checkout/OrderSummary.tsx', 'src/pages/wishlist/WishlistMobile.tsx', 'src/pages/mobile-home/BackToTop.tsx', 'src/pages/user-profile/profile-edit/EditRow.tsx', 'src/components/charts/svg-charts.tsx', 'src/pages/curator-page/CuratorHeader.tsx', 'src/pages/PaymentSuccessPage.tsx', 'src/pages/PaymentFailPage.tsx', 'src/pages/pc-home/PcHomeLocationBar.tsx', 'src/pages/user-profile/MyStats.tsx', 'src/pages/VoucherGiftReceivePage.tsx', 'src/pages/NotificationsPage.tsx', 'src/pages/seller-orders/OrderNumber.tsx', 'src/pages/agency-console/AgencyPayoutSheet.tsx', 'src/pages/SellerReviewsPage.tsx', 'src/pages/mobile-home/MapPill.tsx', 'src/pages/user-profile/profile-edit/ProfileEditSheet.tsx', 'src/pages/CouponClaimPage.tsx', 'src/components/search/SortFilterBar.tsx']
const lazyCss = LAZY_USERS.flatMap((f) => [...R(f).matchAll(/injectMotionCss\('[\w-]+', `([^`]*)`\)/g)].map((m) => m[1])).join('\n')
const kit = css.slice(css.indexOf('.ur-burst {'), css.indexOf('.ur-tab-bar {')) + lazyCss

describe('① 움직임 키트 CSS', () => {
  it('키트 키프레임은 transform · opacity (+ 배경색 · 선 그리기) 만 움직인다 — 크기·위치는 안 건드린다', () => {
    const frames = [...kit.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\}\s*\}/g)]
    expect(frames.length).toBeGreaterThanOrEqual(7)
    for (const [, name, body] of frames) {
      const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1])
      // 예외 하나: 찜 목록에서 **빠지는** 줄은 높이를 접어야 아래 줄이 툭 끊기지 않고 올라온다(사라지는 줄이라 밀릴 글자가 없다).
      // 예외 둘: 지도 알약 → 지도 화면 전환은 브라우저가 찍은 새 화면(::view-transition-new)을 원으로 여는 것이라 clip-path 다(그 장면은 레이아웃이 없는 그림이다).
      const allowed = name === 'ur-wish-out' ? ['transform', 'opacity', 'max-height', 'margin-top'] : name === 'ur-map-reveal' ? ['clip-path'] : ['transform', 'opacity', 'background-color', 'stroke-dashoffset']
      for (const p of props) expect(allowed, name).toContain(p)
    }
    expect(frames.filter(([, n]) => n === 'ur-wish-out' || n === 'ur-map-reveal').length, '예외는 이름으로 둘만').toBeLessThanOrEqual(2)
  })
  it('화면별 CSS 문자열은 등록한 곳 전부 있고, 문자열마다 동작 줄이기 끔을 함께 갖는다', () => {
    for (const f of LAZY_USERS) {
      const calls = [...R(f).matchAll(/injectMotionCss\('[\w-]+', `([^`]*)`\)/g)].map((m) => m[1])
      expect(calls.length, f).toBeGreaterThan(0)
      for (const c of calls) expect(c, f).toContain('@media (prefers-reduced-motion: reduce)')
    }
  })
  it('부품 안 CSS 의 "끄기" 규칙은 동작 줄이기 조건 안에만 있다 — 밖에 있으면 그 움직임이 늘 꺼진다', () => {
    // 🩸 2026-11-02: 파일 → 문자열로 옮기며 여러 줄 끄기 규칙의 조각이 조건 **밖**으로 새어
    //   정가 줄 긋기·D-day 깜빡임·입력칸 흔들림·사진 올리기·선물 상자가 **아무에게도 안 움직였다**(에러 0).
    for (const f of LAZY_USERS) {
      for (const m of R(f).matchAll(/injectMotionCss\('([\w-]+)', `([^`]*)`\)/g)) {
        const head = m[2].split('@media (prefers-reduced-motion')[0]
        expect(head, `${f} ${m[1]}`).not.toMatch(/(animation|transition)\s*:\s*none/)
      }
    }
  })
  it('끄기 조건이 선택자 목록에 삼켜지지 않는다 — `,@media` 면 그 조건 전체가 무효가 된다', () => {
    // 🩸 2026-11-02 실측: 옛 공용 규칙의 선택자 조각(`.ur-slam, … .ur-flash,`)이 여섯 파일의 문자열 앞에 붙어
    //   `…,@media (prefers-reduced-motion…){…}` 가 됐다. 브라우저는 그 규칙을 통째로 버린다 — 동작 줄이기를 켠 사람에게도 움직였다.
    const files = execSync("git ls-files 'src/*.ts' 'src/*.tsx' 'src/**/*.ts' 'src/**/*.tsx'", { encoding: 'utf8' }).split('\n').filter((f) => f && !f.includes('/tests/'))
    let n = 0
    for (const f of files) {
      for (const m of R(f).matchAll(/injectMotionCss\('([\w-]+)', `([^`]*)`\)/g)) { n++; expect(m[2], `${f} ${m[1]}`).not.toMatch(/,\s*@media/) }
    }
    expect(n, '검사한 움직임 문자열 수').toBeGreaterThan(20)
  })
  it('같은 이름의 움직임 CSS 는 내용도 같다 — 먼저 불린 쪽만 꽂히므로 다르면 뒤쪽 화면의 움직임이 조용히 사라진다', () => {
    const files = execSync("git ls-files 'src/*.ts' 'src/*.tsx' 'src/**/*.ts' 'src/**/*.tsx'", { encoding: 'utf8' }).split('\n').filter((f) => f && !f.includes('/tests/'))
    const byId = new Map<string, Set<string>>()
    for (const f of files) for (const m of R(f).matchAll(/injectMotionCss\('([\w-]+)', `([^`]*)`\)/g)) {
      if (!byId.has(m[1])) byId.set(m[1], new Set())
      byId.get(m[1])!.add(m[2])
    }
    for (const [id, bodies] of byId) expect(bodies.size, id).toBe(1)
  })
  it('목록 → 상세 전환 코드는 첫 화면 묶음에 없다 — 카드가 보이거나 닿을 때 받고, 안 왔으면 종전 링크 이동', () => {
    const card = R('src/pages/main-home/GroupBuyFeedCard.tsx')
    expect(card).not.toMatch(/^import [^\n]*from '@\/lib\/deal-view-transition'/m)
    expect(card).toContain("import('@/lib/deal-view-transition').then((m) => { dealVT = m })")
    expect(card).toContain('function prefetchPassChunk() {\n  warmDealTransition()')
    expect(card).toContain('=> !!dealVT && dealVT.canRunDealTransition(e)')
  })
  it('결제 처리 중 원의 CSS 는 상세 청크에 한 번만 — 모바일 바·PC 상자가 같은 파일을 쓴다', () => {
    for (const f of ['src/pages/group-buy/DealBottomBar.tsx', 'src/pages/group-buy/DealPurchaseBox.tsx']) {
      expect(R(f), f).toContain("import './pay-spin-css'")
      expect(R(f), f).not.toContain("injectMotionCss('ur-m-pay'")
    }
  })
  it('동작 줄이기면 키트 클래스와 화면 전환이 전부 꺼진다', () => {
    const reduceOf = (s: string) => s.split(/@media \(prefers-reduced-motion: reduce\)\s*/).slice(1).map((x) => x.slice(0, 700)).join('\n')
    const off = reduceOf(css) + reduceOf(lazyCss)
    for (const c of ['ur-pin-pop', 'ur-flash', 'ur-roll-in-up', 'ur-roll-out-down', 'ur-gift-mark', 'ur-strike::after', 'ur-blink-once', 'ur-shake', 'ur-slam', 'ur-thud', 'ur-popin', 'ur-rise', 'ur-press', 'ur-ring', 'ur-burst i', 'ur-tab-bar']) {
      expect(off, c).toContain(c)
    }
    // 화면 전환 CSS 는 전환 코드가 받을 때 꽂는다 — 거기에도 동작 줄이기 끔이 있어야 한다.
    expect(R('src/lib/deal-view-transition.ts')).toMatch(/prefers-reduced-motion: reduce\)\{::view-transition-group\(\*\)[^}]*animation:none!important/)
  })
})

describe('③ 숫자 올라가기', () => {
  afterEach(() => { vi.useRealTimers() })
  it('값이 아직 없으면 그대로 돌려준다', () => {
    const { result } = renderHook(() => useCountUp(undefined as number | undefined))
    expect(result.current).toBeUndefined()
  })
  it('늦게 온 값에서 시작해 정확한 값으로 끝난다', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, { durationMs: 400 }), { initialProps: { v: undefined as number | undefined } })
    rerender({ v: 482000 })
    expect(result.current).toBe(0)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current).toBe(482000)
    rerender({ v: 500000 }) // 그 뒤 바뀐 값은 다시 올라가지 않고 바로
    expect(result.current).toBe(500000)
  })
})

describe('④ 잠금 파일 계약', () => {
  const card = R('src/pages/main-home/GroupBuyFeedCard.tsx')
  it('카드: 미리 받기 세 줄 불변 + 전환은 맡을 수 있을 때만', () => {
    expect(card).toContain('onMouseEnter={() => { prefetch(p.id); prefetchDetailChunk() }}')
    expect(card).toContain('onTouchStart={() => { prefetch(p.id); prefetchDetailChunk() }}')
    expect(card).toContain('onFocus={() => { prefetch(p.id); prefetchDetailChunk() }}')
    expect(card).toMatch(/if \(!canRunDealTransition\(e\)\) return\s*\n\s*e\.preventDefault\(\)/)
  })
  it('전환을 맡지 않는 클릭: 수정키 · 가운데 버튼 · 이미 막힌 클릭 · API 없음', () => {
    const base = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false }
    expect(canRunDealTransition({ ...base, metaKey: true })).toBe(false)
    expect(canRunDealTransition({ ...base, ctrlKey: true })).toBe(false)
    expect(canRunDealTransition({ ...base, button: 1 })).toBe(false)
    expect(canRunDealTransition({ ...base, defaultPrevented: true })).toBe(false)
    expect(canRunDealTransition(base)).toBe(false) // jsdom 엔 startViewTransition 이 없다 → 종전 링크 동작
  })
  it('상세 첫 사진만 이름을 받고, 기다림은 300ms 상한', () => {
    const gal = R('src/pages/group-buy/DetailGallery.tsx')
    expect(gal).toContain("data-vt-hero={i === 0 ? '' : undefined}")
    expect(gal).toContain('viewTransitionName: i === 0 ? DEAL_HERO_VT : undefined')
    expect(gal, '상세는 이름 상수만 받는다').toContain("from '@/lib/deal-vt-name'")
    expect(R('src/lib/deal-view-transition.ts')).toMatch(/const HERO_WAIT_MS = 300\b/)
  })
  it('하단 탭: 누름 반응은 클릭에서만, linkshop·prefetch 계약 불변', () => {
    const nav = R('src/components/main/BottomNav.tsx')
    expect(nav).toMatch(/onClick=\{\(\) => \{ setPress\(/)
    expect(nav).toContain('onPointerDown={warm}')
    expect(nav).toContain("cur.startsWith('/profile/') || cur.startsWith('/s/')")
  })
})

describe('⑤ 사용 완료 도장', () => {
  it('폴링이 used 로 바뀔 때만 justUsed 가 켜지고, 도장·카드가 그것에 묶인다', () => {
    const qr = R('src/pages/my-vouchers/QRModal.tsx')
    expect(qr).toMatch(/if \(newStatus === 'used'\) \{\s*\n\s*setJustUsed\(true\)/)
    expect(qr).toContain("${justUsed ? 'ur-slam' : ''}")
    expect(qr).toContain("${justUsed ? 'ur-thud' : ''}")
  })
})

describe('⑥ 3·4차 — 동작 계약', () => {
  afterEach(() => { vi.useRealTimers() })
  it('숫자 굴림: 처음엔 안 움직이고, 바뀌면 굴러간 뒤 끝은 새 값 하나만 남는다', () => {
    vi.useFakeTimers()
    const { container, rerender } = render(createElement(RollingNumber, { value: 1 }))
    expect(container.querySelector('.ur-roll-in-up')).toBeNull()
    rerender(createElement(RollingNumber, { value: 2 }))
    expect(container.querySelector('.ur-roll-in-up')?.textContent).toBe('2')
    expect(container.querySelector('.ur-roll-out-up')?.textContent).toBe('1')
    act(() => { vi.advanceTimersByTime(400) })
    expect(container.textContent).toBe('2')
    rerender(createElement(RollingNumber, { value: 1 }))
    expect(container.querySelector('.ur-roll-in-down')).not.toBeNull()
  })
  it('QR 시작점은 한 번만 꺼내지고, 0.8초가 지나면 버려진다', () => {
    const el = document.createElement('button'); document.body.appendChild(el)
    noteQrOrigin(el)
    expect(takeQrOrigin()).not.toBeNull()
    expect(takeQrOrigin()).toBeNull()
    vi.useFakeTimers({ toFake: ['performance'] })
    noteQrOrigin(el)
    vi.advanceTimersByTime(900)
    expect(takeQrOrigin()).toBeNull()
  })
  it('장바구니 아이콘이 화면에 없으면 아무것도 날리지 않는다', () => {
    const btn = document.createElement('button'); document.body.appendChild(btn)
    const before = document.body.children.length
    flyToCart(btn)
    expect(document.body.children.length).toBe(before)
  })
  it('매장을 바꾸면(resetKey) 숫자가 다시 올라간다', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ v, k }) => useCountUp(v, { durationMs: 300, resetKey: k }), { initialProps: { v: 100 as number | undefined, k: 1 } })
    act(() => { vi.advanceTimersByTime(800) })
    expect(result.current).toBe(100)
    rerender({ v: 50, k: 2 })
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current).toBeLessThan(50)
    act(() => { vi.advanceTimersByTime(800) })
    expect(result.current).toBe(50)
  })
  it('공용 시트: 닫기(배경·X·Esc)는 내려가는 길로, 뒤로가기는 즉시 — 그리고 닫힘 클래스가 뒤에 정의돼 이긴다', () => {
    const sheet = R('src/pages/user-profile/seller-section/Sheet.tsx')
    expect(sheet).toContain("onClick={requestClose} aria-hidden=\"true\"")
    expect(sheet).toContain("if (e.key === 'Escape') requestClose()")
    expect(sheet).toMatch(/onPop = \(\) => \{[^}]*onClose\(\)/)
    expect(css.indexOf('.ur-sheet-out {')).toBeGreaterThan(css.indexOf('.ur-sheet-in {'))
  })
  it('리뷰 리워드: 서버가 실제로 적립한 금액만 보낸다(건너뛰면 0)', () => {
    const r = R('src/features/reviews/api/reviews.routes.ts')
    expect(r).toContain('let paidReward = 0;')
    expect(r).toContain('reward_amount: paidReward,')
    const assignAt = r.indexOf('paidReward = Number.isFinite(rewardAmount)')
    expect(assignAt).toBeGreaterThan(r.indexOf('if (existingProductReward)'))
  })
})

describe('⑦ 6차 — 동작 계약', () => {
  it('결제 버튼: 처리 중엔 도는 원이 뜨고 글자도 남는다(화면 읽기 도구용) — 모바일·PC 둘 다', () => {
    for (const f of ['src/pages/group-buy/DealBottomBar.tsx', 'src/pages/group-buy/DealPurchaseBox.tsx']) {
      const src = R(f)
      expect(src, f).not.toContain("joining ? '처리 중…'")
      expect(src, f).toContain('<span className="ur-pay-spin" aria-hidden="true" />처리 중…')
    }
  })
  it('찜 목록: 빠진 줄은 300ms 동안 원래 자리에 남아 밀려 나가고, 화면 읽기 도구에선 숨긴다', () => {
    const src = R('src/pages/wishlist/WishlistMobile.tsx')
    expect(src).toContain('const rows = useLeavingRows(items)')
    expect(src).toContain("className={leaving ? 'ur-wish-out' : undefined} aria-hidden={leaving || undefined}")
    expect(src).toMatch(/out\.splice\(Math\.min\(g\.at, out\.length\), 0/)
  })
  it('새 주문: 처음 도착한 목록은 새 주문이 아니다 — 보는 동안 생긴 것만 움직인다', () => {
    const src = R('src/pages/seller-orders/MobileOrderList.tsx')
    expect(src).toContain('const first = seen.current == null || seen.current.size === 0')
    expect(src).toContain('if (!num || !seen.current || seen.current.size === 0) return false')
    expect(src).toContain("${isNewOrder(o.order_number) ? 'ur-order-new")
  })
  it('유어샵 공유: 체크는 링크 복사로 끝났을 때만 — 카카오·폰 시트로 보냈으면 false', () => {
    const src = R('src/pages/CuratorPage.tsx')
    expect(src).toContain('if (await shareViaKakao(ushopCardPayload(card))) return false')
    expect(src).toMatch(/url: fullUrl \}\); return false \}/)
    expect(src).toMatch(/linkCopied[^\n]*\n\s*return true/)
    expect(R('src/pages/curator-page/CuratorHeader.tsx')).toContain('if ((await share()) === true) { setCopied(true)')
  })
  it('차트: 막대는 아래에서 자라고(기준점 아래) 선은 길이 1 로 정규화돼 그려진다', () => {
    const src = R('src/components/charts/svg-charts.tsx')
    expect(src).toContain('transform-box: fill-box; transform-origin: bottom;')
    expect(src).toContain('<polyline className="ur-chart-line" pathLength={1}')
    expect(src).toContain('className="ur-chart-bar"')
  })
  it('등록 단계: 칸 움직임은 끝나면 흔적을 안 남긴다(backwards) — 안의 지도·창이 기준 상자를 잃지 않게', () => {
    const src = R('src/pages/SellerMealVoucherNewPage.tsx')
    expect(src).toContain('.ur-step-fwd { animation: ur-step-fwd .3s cubic-bezier(.2,1,.3,1) backwards; }')
    expect(src).toContain("<div key={step} className={`space-y-4 ${stepDir.current < 0 ? 'ur-step-back' : 'ur-step-fwd'}`}>")
  })
  it('지갑 탭(잠금 허가): 밑줄 하나가 미끄러지고, 측정 전엔 종전 밑줄 — 깜빡임 0', () => {
    const src = R('src/pages/MyVouchersPage.tsx')
    expect(src).toContain("{tab === key && !tabBar && <span aria-hidden=\"true\" className=\"absolute left-0 right-0 -bottom-px h-[2.5px] bg-brand\" />}")
    expect(src).toContain('className="ur-tab-bar absolute left-0 -bottom-px h-[2.5px] bg-brand pointer-events-none"')
    expect(src).toContain('prev?.x === next?.x && prev?.w === next?.w ? prev : next')
  })
  it('결제 결과(잠금 허가): 성공 카드는 올라오고 실패 표시는 흔들린다 — 취소는 안 흔든다', () => {
    const ok = R('src/pages/PaymentSuccessPage.tsx')
    expect(ok).toContain('<AlertIcon className="ur-pr-shake h-20 w-20')
    expect(ok).toContain('<div className="ur-pr-rise bg-white dark:bg-[#1D1F29]')
    expect(R('src/pages/PaymentFailPage.tsx')).toContain("${isUserCancel ? '' : 'ur-pr-shake '}")
  })
  it('홈 지도 알약(8차 B·C): 내리는 동안 접히고, 누르면 그 자리에서 지도가 퍼진다 — 못 하는 경우는 종전 링크', () => {
    const src = R('src/pages/mobile-home/MapPill.tsx')
    expect(src).toContain('to="/map"')
    expect(src).toContain("window.addEventListener('scroll', onScroll, { passive: true })")
    expect(src).toContain("if (typeof doc.startViewTransition !== 'function') return")
    expect(src).toContain("if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return")
    expect(src).toMatch(/catch \{\s*done\(\)\s*navigate\('\/map'\)/)
    expect(src).toContain('onPointerDown={preconnectMapTiles}')
  })
  it('쿠폰 받기 화면: 끝없이 통통 튀던 상자가 한 번만 톡 — 움직임은 한 번', () => {
    const src = R('src/pages/CouponClaimPage.tsx')
    expect(src).not.toContain('animate-bounce')
    expect(src).toContain('shadow-lg ur-cp-pop')
  })
  it('프로필 사진: 새로 고른 사진만 커지며 들어온다(처음 연 사진은 그대로)', () => {
    const src = R('src/pages/user-profile/profile-edit/ProfileEditSheet.tsx')
    expect(src).toContain('const [photoChanged, setPhotoChanged] = useState(false)')
    expect(src).toMatch(/setImage\(url\)\n\s*setPhotoChanged\(true\)/)
  })
})
