/**
 * ← 뒤로가기 한 벌 — 2026-11-03 대표 *"페이지 이동이 지금 이상적인지 봐줘 특히 뒤로가기"*.
 *
 * 라이브 실측: 링크로 바로 들어온 화면(이용권 상세·숙소·지도·쇼츠·약관…)에서 머리줄 ← 를 누르면
 * 9곳 전부 **앱 밖으로** 나갔다. 화면마다 `navigate(-1)` 을 손으로 적었고, 막으려던 몇 곳은
 * `history.length`·`document.referrer` 로 판정해서 그것도 틀렸다(앱 밖 칸까지 센다).
 * ⇒ 판정은 `useSafeBack`(라우터 `history.state.idx`) 한 곳이다.
 *
 * 이 시험이 지키는 것:
 *  ① 코드(주석 제외)에 `navigate(-1)` 이 허용 목록 밖에 없다.
 *  ② 뒤로 판정에 `window.history.length` 를 쓰지 않는다(referrer 판정은 MobileHeader 한 곳이었고 이번에 걷었다 — 기계 판정이 오탐이라 시험엔 안 넣었다).
 *  ③ `canGoBackInApp` 의 판정 자체 — idx 0 · 없음 · 비숫자는 false, 1 이상만 true.
 *
 * ⚠️ 못 보는 것: fallback 이 그 화면에 *맞는 자리*인지(사람이 고른다) · 손으로 `history.back()` 부르는 곳
 *   · `<Link to="/">` 처럼 뒤로 *모양*의 버튼이 push 하는 경우.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { canGoBackInApp } from '@/hooks/useSafeBack'
import { decideTabNav } from '@/lib/tab-nav'
import { stripComments } from '../helpers/source-text'

/** 허용 — 사유가 있는 곳만. 늘리지 말 것. */
const ALLOW = new Set([
  'src/hooks/useSafeBack.ts', // SSOT 자신
  'src/pages/user-profile/seller-section/ToolPageSheet.tsx', // 시트 안 이력(sheet-history) — 앱 이력 칸이 늘 있다
  'src/components/main/BottomNav.tsx', // 탭 → 홈은 아래가 홈일 때만 -1 (tab-nav.ts decideTabNav 가 판정)
])

const files = execSync("git ls-files 'src/*.ts' 'src/*.tsx' 'src/**/*.ts' 'src/**/*.tsx'", { encoding: 'utf8' })
  .split('\n').filter(Boolean).filter((f) => !f.startsWith('src/tests/'))

describe('뒤로가기 SSOT (useSafeBack)', () => {
  it('검사 대상이 충분하다(glob 이 눈멀지 않았다)', () => {
    expect(files.length).toBeGreaterThan(1500)
  })

  it('① navigate(-1) 은 허용 목록 밖에 없다', () => {
    const bad = files.filter((f) => !ALLOW.has(f) && /navigate\(\s*-1\s*\)/.test(stripComments(readFileSync(f, 'utf8'))))
    expect(bad).toEqual([])
  })

  it('② 뒤로 판정에 window.history.length 를 쓰지 않는다', () => {
    const bad = files.filter((f) => /window\.history\.length/.test(stripComments(readFileSync(f, 'utf8'))))
    expect(bad).toEqual([])
  })

  describe('③ canGoBackInApp', () => {
    const orig = window.history.state
    afterEach(() => window.history.replaceState(orig, ''))
    const at = (state: unknown) => { window.history.replaceState(state, ''); return canGoBackInApp() }
    it('앱 안 칸이 있으면 true', () => { expect(at({ idx: 1 })).toBe(true); expect(at({ idx: 7, usr: null })).toBe(true) })
    it('처음 연 칸(링크로 바로 들어옴)은 false', () => { expect(at({ idx: 0 })).toBe(false) })
    it('라우터 표식이 없으면 false(바깥에서 쌓은 칸)', () => {
      expect(at(null)).toBe(false); expect(at({ modalOpen: true })).toBe(false); expect(at({ idx: '3' })).toBe(false)
    })
  })
})

/** 하단 탭 이력 — 대표 승인 ③(2026-11-03): 어느 탭에서든 뒤로 한 번이면 홈, 한 번 더면 앱 밖. */
describe('④ 하단 탭 이력 (decideTabNav)', () => {
  const TABS = ['/', '/vouchers', '/my-vouchers', '/u/me', '/user/profile']
  /** 탭을 차례로 누른 뒤 이력 칸을 돌려준다 — 브라우저 이력을 흉내낸다. */
  function simulate(start: string, taps: string[]) {
    const stack: { path: string; urTab: boolean; fromHome: boolean }[] = [{ path: start, urTab: false, fromHome: false }]
    let i = 0
    for (const target of taps) {
      const cur = stack[i]
      const a = decideTabNav({ target, cur: cur.path, curIsTab: cur.path === '/' || cur.urTab || TABS.includes(cur.path), curFromHome: cur.fromHome, canBack: i > 0 })
      if (a.kind === 'back') { i -= 1; continue }
      const entry = { path: target, urTab: true, fromHome: a.fromHome }
      if (a.kind === 'replace') stack[i] = entry
      else { stack.splice(i + 1); stack.push(entry); i += 1 }
    }
    return stack.slice(0, i + 1).map((e) => e.path)
  }
  it('라이브에서 잰 7번 탭 → 뒤로 한 번이면 홈', () => {
    expect(simulate('/', ['/vouchers', '/my-vouchers', '/vouchers', '/u/me', '/', '/user/profile', '/vouchers'])).toEqual(['/', '/vouchers'])
  })
  it('탭 → 홈 은 새 칸을 쌓지 않고 아래 홈으로 돌아간다', () => {
    expect(simulate('/', ['/vouchers', '/u/me', '/'])).toEqual(['/'])
  })
  it('같은 탭을 다시 눌러도 칸이 안 쌓인다', () => {
    expect(simulate('/', ['/vouchers', '/vouchers', '/vouchers'])).toEqual(['/', '/vouchers'])
  })
  it('상세 화면에서 탭으로 가면 그 상세로 돌아올 길이 남는다', () => {
    expect(simulate('/pass/1', ['/vouchers'])).toEqual(['/pass/1', '/vouchers'])
  })
  it('링크로 바로 들어온 탭 화면에서 홈을 누르면 replace(뒤에 앱 밖이 남지 않게)', () => {
    expect(decideTabNav({ target: '/', cur: '/vouchers', curIsTab: true, curFromHome: false, canBack: false })).toEqual({ kind: 'replace', fromHome: false })
  })
})

/** 결제 뒤 뒤로 — 대표 승인 ②(2026-11-03): 완료 화면에서 폰 뒤로를 눌러도 이미 쓴 결제창을 다시 띄우지 않는다. */
describe('⑤ 결제를 마친 주문의 결제창은 비킨다', () => {
  afterEach(() => sessionStorage.clear())
  it('표시 → 확인', async () => {
    const { markOrderPaid, isOrderPaid } = await import('@/lib/paid-orders')
    expect(isOrderPaid('A1')).toBe(false)
    markOrderPaid('A1')
    expect(isOrderPaid('A1')).toBe(true)
    expect(isOrderPaid('')).toBe(false)
  })
  it('최근 20건만 남긴다', async () => {
    const { markOrderPaid, isOrderPaid } = await import('@/lib/paid-orders')
    for (let i = 0; i < 25; i++) markOrderPaid(`O${i}`)
    expect(isOrderPaid('O0')).toBe(false)
    expect(isOrderPaid('O24')).toBe(true)
  })
  it('완료 화면 둘이 승인 성공 때 표시하고, 결제창은 초기화 전에 확인한다', () => {
    const confirm = stripComments(readFileSync('src/pages/GroupBuyConfirmPaymentPage.tsx', 'utf8'))
    expect(confirm).toMatch(/setState\('success'\)\s*\n\s*markOrderPaid\(orderId\)/)
    const stay = stripComments(readFileSync('src/pages/StayCheckoutReturnPage.tsx', 'utf8'))
    expect(stay).toMatch(/setState\('success'\)\s*\n\s*markOrderPaid\(tossOrderId\)/)
    const pay = stripComments(readFileSync('src/pages/TossWidgetPayPage.tsx', 'utf8'))
    expect(pay).toMatch(/if \(initializedRef\.current\) return\s*\n\s*if \(isOrderPaid\(orderId\)\) \{ goBack\(\); return \}/)
    expect(pay, 'bfcache 로 되살아난 결제창도 비켜야 한다').toMatch(/e\.persisted && isOrderPaid\(orderId\)/)
  })
})
