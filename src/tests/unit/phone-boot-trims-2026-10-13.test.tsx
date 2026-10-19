/**
 * 📱 2026-10-13 — 폰 부팅 중 쓰지 않는 일 둘을 덜어 낸다(재생 프로파일, CPU 4배).
 *   ① PC 상단 네비(`hidden md:block`)를 폰에서 렌더하지 않는다 — 렌더 75ms.
 *   ② 정수 가격은 Intl 포매터 없이 쉼표만 — 첫 `new Intl.NumberFormat('ko-KR')` 65ms.
 *
 * ⚠️ 못 보는 것: 실제 폰의 절대 ms(재생 비율만 믿을 것) · 네비가 PC 에서 첫 프레임에 뜨는지는
 *   matchMedia 동기 초기값을 믿는다(useMediaQuery 의 계약).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'

vi.mock('@/components/main/DesktopTopNav', () => ({ default: () => <header data-testid="desk" /> }))
vi.mock('@/components/main/PromoBar', () => ({ default: () => <div data-testid="promo" /> }))

import ConsumerTopChrome, { warmDesktopChrome } from '@/components/main/ConsumerTopChrome'
import { formatNumber } from '@/utils/format'

function setWidth(wide: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: wide, media: q, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

afterEach(cleanup)

describe('① PC 상단 네비는 넓은 화면에서만 마운트', () => {
  it('폰(768 미만): 네비·프로모 둘 다 없다', async () => {
    // 🖥️ 2026-10-18: 네비가 lazy 라 **받아 두지 않으면** 넓이 판정 없이도 첫 렌더엔 안 뜬다 — 그러면 이 검사가
    //   헛돈다. 먼저 받아 둔 뒤(PC 로 들어왔다가 창을 좁힌 경우) 좁은 화면에서도 안 그리는지 본다.
    setWidth(true)
    await warmDesktopChrome()
    setWidth(false)
    const r = render(<ConsumerTopChrome />)
    expect(r.queryByTestId('desk')).toBeNull()
    expect(r.queryByTestId('promo')).toBeNull()
  })
  // 🖥️ 2026-10-18 재조준: 네비는 이제 lazy(폰 첫 방문 −33KB raw)다. 지키려던 것 — **PC 첫 렌더부터 네비가 있다** —
  //   은 그대로이고, 그 일을 이제 `main.tsx` 가 createRoot 전에 부르는 `warmDesktopChrome()` 이 한다
  //   (받아 둔 lazyPage 는 첫 렌더에 동기로 그린다). 상세 `desktop-chrome-lazy-2026-10-18.test.ts`.
  it('PC: 준비된 뒤 첫 렌더부터 네비가 있다(늦게 끼어들지 않는다)', async () => {
    setWidth(true)
    await warmDesktopChrome()
    const r = render(<ConsumerTopChrome />)
    expect(r.getByTestId('desk')).toBeTruthy()
  })
  it('네비는 lazyPage 이고 main.tsx 가 첫 렌더 전에 준비한다', () => {
    const src = readFileSync('src/components/main/ConsumerTopChrome.tsx', 'utf8')
    expect(src).toMatch(/const DesktopTopNav = lazyPage\(\(\) => import\('\.\/DesktopTopNav'\)\)/)
    expect(readFileSync('src/main.tsx', 'utf8')).toMatch(/warmDesktopChrome\(\)\]\)/)
  })
})

describe('② 정수 빠른 경로 — Intl 과 같은 문자열', () => {
  const ints = [0, 1, 9, 10, 99, 100, 999, 1000, 1234, 12345, 123456, 1234567, 100000000, 9007199254740991,
    -1, -999, -1000, -1234567, -9007199254740991, 300, 31000, 209000]
  for (const n of ints) {
    it(`${n}`, () => expect(formatNumber(n)).toBe(new Intl.NumberFormat('ko-KR').format(n)))
  }
  it('문자열 정수도 같다', () => expect(formatNumber('31000')).toBe('31,000'))
  it('소수·-0·안전범위 밖은 Intl 그대로', () => {
    for (const n of [1.5, 1234.567, -0, 2 ** 60, 0.1]) expect(formatNumber(n)).toBe(new Intl.NumberFormat('ko-KR').format(n))
  })
  it('다른 로캘은 빠른 경로를 안 탄다', () => {
    expect(formatNumber(1234567, 'de-DE')).toBe(new Intl.NumberFormat('de-DE').format(1234567))
  })
  it('정수 경로에서 Intl.NumberFormat 을 만들지 않는다', async () => {
    // 모듈 캐시를 비운 새 사본 — 앞 시험이 만든 포매터 캐시가 남아 있으면 스파이가 헛돈다.
    vi.resetModules()
    const fresh = await import('@/utils/format')
    const spy = vi.spyOn(Intl, 'NumberFormat')
    fresh.formatNumber(424242, 'ko-KR')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
