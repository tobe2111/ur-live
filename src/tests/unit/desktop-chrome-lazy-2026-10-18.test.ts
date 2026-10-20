/**
 * 🖥️ PC 상단 네비를 폰 첫 방문에서 뺀다 · PC 는 첫 렌더 전에 받는다 〔2026-10-18〕
 *
 * 대표 *"다 이상적으로 해줘"*(첫 방문 화면 코드 무게). PC 상단 네비(+계정 메뉴·앱 받기 모달·알림 드롭다운,
 * raw ~33KB)는 폰에선 마운트조차 안 되는데 정적 import 라 폰의 첫 방문 묶음에 실려 왔다. 셀러 라우트 표
 * (raw 28KB)도 같은 모양이었다. 둘을 떼니 **모든 화면의 첫 방문이 brotli 약 6KB 줄었다**(check-surface-budgets).
 *
 * 지키는 것:
 *   ① 네비는 동적 import(`lazyPage`) · 자기 청크(`app-desktop-chrome`)
 *   ② 넓은 화면이면 `main.tsx` 가 **첫 렌더 전에** 받는다 — 안 그러면 PC 에서 네비가 늦게 끼어들며 본문을 민다
 *   ③ 좁은 화면은 아예 안 받는다
 *   ④ 묶음기가 네비·셀러 표가 끌고 오던 공용 모듈을 **종전 봉투에 둔다** — 흩어지면 청크 순환이 줄줄이 생겼다(실측 셋)
 *
 * ⚠️ 못 보는 것: 실제 청크 배치(빌드가 정한다 — critical-chunks·chunk-cycles·surface-budgets 가 본다) ·
 *   PC 에서 상한(2.5초) 안에 못 받았을 때 한 번 늦게 뜨는 것(폴백).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const code = (p: string) => stripComments(readFileSync(p, 'utf-8'))
const loads = vi.hoisted(() => ({ n: 0 }))
vi.mock('@/components/main/DesktopTopNav', () => { loads.n++; return { default: () => null } })

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); loads.n = 0 })

describe('① 동적 import · 자기 청크', () => {
  it('정적 import 가 없다', () => {
    const c = code('src/components/main/ConsumerTopChrome.tsx')
    expect(c).not.toMatch(/import DesktopTopNav from/)
    expect(c).toMatch(/const DesktopTopNav = lazyPage\(\(\) => import\('\.\/DesktopTopNav'\)\)/)
  })
  it('vite 가 네비와 그것만 쓰는 부품을 app-desktop-chrome 으로', () => {
    expect(code('vite.config.ts')).toMatch(/DesktopTopNav\|AccountMenu\|AppDownloadModal\|NotificationDropdown\)\\\.tsx\/\.test\(id\)\) return 'app-desktop-chrome'/)
  })
})

describe('②③ 부팅 준비', () => {
  it('main.tsx 가 createRoot 전에 기다린다', () => {
    const m = code('src/main.tsx')
    const a = m.indexOf('warmDesktopChrome()')
    const b = m.indexOf('ReactDOM.createRoot(rootElement)')
    expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(a)
    expect(m).toMatch(/await Promise\.all\(\[preloadBootPage\(bootSurface\(\)\), warmDesktopChrome\(\)\]\)/)
  })
  it('넓으면 받고 좁으면 안 받는다', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }))
    let mod = await import('@/components/main/ConsumerTopChrome')
    await mod.warmDesktopChrome()
    expect(loads.n, '폰이 PC 네비를 받는다').toBe(0)
    vi.resetModules()
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} }))
    mod = await import('@/components/main/ConsumerTopChrome')
    await mod.warmDesktopChrome()
    expect(loads.n, 'PC 가 첫 렌더 전에 네비를 안 받는다').toBe(1)
  })
})

describe('④ 묶음기', () => {
  it('네비·셀러 표는 엔트리 폐쇄로 센다(끌고 오던 공용 모듈 배치 불변)', async () => {
    const { ENTRY_DYNAMIC } = await import('../../../scripts/surface-chunks.mjs')
    const hit = (p: string) => (ENTRY_DYNAMIC as RegExp[]).some((re) => re.test(p))
    expect(hit('/x/src/components/main/DesktopTopNav.tsx')).toBe(true)
    expect(hit('/x/src/routes/seller.routes.tsx')).toBe(true)
    expect(hit('/x/src/pages/AdminPage.tsx')).toBe(false)
    expect(code('scripts/surface-chunks.mjs')).toMatch(/for \(const d of info\?\.dynamicallyImportedIds \?\? \[\]\) if \(ENTRY_DYNAMIC\.some/)
  })
})

describe('⑤ 알림 시트는 벨을 누를 때만 받는다', () => {
  it('시트·패널은 자기 봉투이고 묶음기가 그 이름을 지킨다(lz-common 으로 옮기지 않는다)', async () => {
    const { LAZY_ENVELOPES } = await import('../../../scripts/surface-chunks.mjs')
    expect((LAZY_ENVELOPES as Set<string>).has('app-notification-panel')).toBe(true)
    expect(code('scripts/surface-chunks.mjs')).toMatch(/if \(!groupable \|\| LIBRARY_ENVELOPES\.has\(name\) \|\| LAZY_ENVELOPES\.has\(name\)\) return name/)
    expect(code('vite.config.ts')).toMatch(/Notification\(Panel\|Sheet\)\\\.tsx\/\.test\(id\)\) return 'app-notification-panel'/)
  })
})

