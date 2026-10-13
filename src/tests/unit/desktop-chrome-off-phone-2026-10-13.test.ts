/**
 * 🖥️ PC 전용 부품을 폰이 받지 않는다 (2026-10-13 — 대표 "더 개선할 것 찾아봐").
 *   ① 프로모 바: CSS 로만 숨겨서 폰의 모든 하드로드가 `/api/promo-bar` 를 불렀다 → 넓은 화면에서만 마운트.
 *   ② PC 사이드바: `hidden md:flex` 인데 정적 import 라 셸 청크에 실렸다 → lazy + 넓은 화면에서만 + 별도 봉투.
 *   ⚠️ 못 보는 것: PC 에서 사이드바가 늦게 뜨는 체감(fixed 라 본문은 안 밀린다) · DesktopTopNav(아직 셸 — PC 밀림 때문에 보류).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { FORBIDDEN, judge } from '../../../scripts/check-surface-chunk-runtime.mjs'

const read = (p: string) => readFileSync(p, 'utf8')

describe('프로모 바', () => {
  const s = read('src/components/main/ConsumerTopChrome.tsx')
  it('넓은 화면에서만 마운트한다(폰은 요청 0)', () => {
    expect(s).toMatch(/const wide = useMediaQuery\('\(min-width: 768px\)'\)/)
    expect(s).toMatch(/\{wide && <PromoBar \/>\}/)
    expect(s).not.toMatch(/<div className="hidden md:block"><PromoBar \/><\/div>/)
  })
})

describe('PC 사이드바', () => {
  const s = read('src/components/MobileAppLayout.tsx')
  it('정적 import 하지 않는다', () => {
    expect(s).not.toMatch(/^import DesktopLiveSidebar/m)
    expect(s).toMatch(/const DesktopLiveSidebar = lazy\(loadSidebar\)/)
  })
  it('넓은 화면에서만 마운트한다', () => {
    expect(s).toMatch(/\{showSidebar && wideForSidebar && <Suspense fallback=\{null\}><DesktopLiveSidebar \/><\/Suspense>\}/)
  })
  it('셸 봉투가 아니라 자기 봉투로 간다', () => {
    const v = read('vite.config.ts')
    expect(v).toMatch(/if \(id\.includes\('\/src\/components\/DesktopLiveSidebar'\)\) return 'app-desktop-chrome'/)
    const shell = v.slice(v.indexOf("id.includes('/src/components/FrameWrapper')"), v.indexOf(") return 'app-shell'"))
    expect(shell).not.toContain('DesktopLiveSidebar')
  })
  it('폰 첫 화면에서 그 봉투를 받으면 런타임 검사가 빨간불', () => {
    expect(FORBIDDEN.some((re) => re.test('app-desktop-chrome'))).toBe(true)
    expect(judge(['app-desktop-chrome.js'], 'home', { home: ['h.tsx'] })).toHaveLength(1)
  })
})
