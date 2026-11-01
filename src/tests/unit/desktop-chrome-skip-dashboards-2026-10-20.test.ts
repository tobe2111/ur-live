/**
 * 🧢 상단 네비가 안 뜨는 화면에선 PC 네비 코드를 기다리지 않는다 〔2026-10-20〕
 *
 * 라이브 실측(urdeal.kr/admin, 1440px, 어드민 로그인): 첫 렌더 전에 `app-desktop-chrome` · `lucide-desktop` ·
 * `lz-common` · `lucide-home` · `lz-home-homePc` + `-vouchers` · `-map` · `-urshorts` 를 받았고, 그 뒤에야
 * `app-routes-admin` → `AdminPage` 가 출발했다. `main.tsx` 의 `warmDesktopChrome()`(2026-10-18)이
 * "넓은 화면인가" 만 보고, 그 네비가 **그려지지 않는 주소**(대시보드·결제·랜딩·몰)를 몰랐기 때문이다.
 * 에러가 안 나고 화면도 안 깨진다 — 어드민·셀러·에이전시의 첫 렌더가 조용히 늦을 뿐이다.
 *
 * 지키는 것:
 *   ① 숨김 판정은 한 함수(`consumerChromeHiddenByPath`) — App.tsx 의 `hideBottomNav` 와 부팅 준비가 같이 쓴다
 *      (갈리면 네비가 뜨는 화면에서 늦게 끼어들거나[밀림], 안 뜨는 화면에서 기다린다)
 *   ② 대시보드 주소에선 받지 않는다 · 소비자 홈·상세에선 종전대로 받는다(반대 방향 — 여기가 깨지면 PC 밀림)
 *
 * ⚠️ 못 보는 것: `?embed=1` 유어샵(세션 저장소로 갈려 주소만으론 모른다 — 그 경우는 종전대로 받는다, 손해는 낭비뿐) ·
 *   실제 몇 ms 빨라지는지(라이브 프레임으로 잰다).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { consumerChromeHiddenByPath, isFullScreenPath } from '@/lib/consumer-chrome'

const code = (p: string) => stripComments(readFileSync(p, 'utf-8'))
const loads = vi.hoisted(() => ({ n: 0 }))
vi.mock('@/components/main/DesktopTopNav', () => { loads.n++; return { default: () => null } })

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); loads.n = 0 })

async function warmAt(path: string): Promise<number> {
  // tests/setup.ts 가 window.location 을 가짜 객체로 바꿔 둔다 — history 로는 안 움직인다.
  vi.stubGlobal('location', { ...window.location, pathname: path })
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} }))
  // vi.mock 팩토리는 워커당 한 번만 돈다(resetModules 로도 다시 안 돈다) — 매번 doMock 으로 새로 건다.
  vi.resetModules(); loads.n = 0
  vi.doMock('@/components/main/DesktopTopNav', () => { loads.n++; return { default: () => null } })
  const mod = await import('@/components/main/ConsumerTopChrome')
  await mod.warmDesktopChrome()
  return loads.n
}

describe('① 숨김 판정은 한 함수', () => {
  it('대시보드·결제·쇼핑상세·유어애즈는 숨김 · 소비자 표면은 아님 (몰은 App.tsx 가 더한다)', () => {
    for (const p of ['/admin', '/admin/orders', '/seller', '/agency', '/checkout', '/products/12', '/ads', '/ads/x']) {
      expect(consumerChromeHiddenByPath(p), p).toBe(true)
    }
    for (const p of ['/', '/vouchers', '/pass/2919', '/map', '/u/jiwon1228', '/stays/2887']) {
      expect(consumerChromeHiddenByPath(p), p).toBe(false)
    }
  })
  it('접두사는 경계까지 본다 (/partnership 은 /partners 가 아니다)', () => {
    expect(isFullScreenPath('/partners')).toBe(true)
    expect(isFullScreenPath('/partnership')).toBe(false)
  })
  it('App.tsx 와 부팅 준비가 같은 함수를 부른다', () => {
    expect(code('src/App.tsx')).toMatch(/const hideBottomNav = consumerChromeHiddenByPath\(location\.pathname\) \|\| embedHideNav\s*\|\| mallSurface/)
    expect(code('src/App.tsx')).not.toMatch(/fullScreenPrefixes\s*=\s*\[/)
    expect(code('src/components/main/ConsumerTopChrome.tsx')).toMatch(/consumerChromeHiddenByPath\(location\.pathname\)\) return Promise\.resolve\(\)/)
  })
})

describe('② 받는가', () => {
  it('어드민·셀러·에이전시·결제에선 받지 않는다', async () => {
    for (const p of ['/admin', '/seller/orders', '/agency', '/checkout']) expect(await warmAt(p), p).toBe(0)
  })
  it('소비자 홈·상세에선 종전대로 첫 렌더 전에 받는다 (빠지면 PC 에서 네비가 늦게 끼어든다)', async () => {
    for (const p of ['/', '/pass/2919', '/vouchers']) expect(await warmAt(p), p).toBe(1)
  })
})

/**
 * ③ 〔2026-10-20 E4 후속〕 같은 봉투를 부르는 **두 번째 자리** — `MobileAppLayout` 이 모듈이 실행되는 순간
 *   넓은 화면이면 사이드바를 미리 받았다. 기다리지는 않지만(첫 렌더를 안 막는다) 배포 뒤 라이브 `/admin` 에서
 *   `app-desktop-chrome`(555ms)이 `app-routes-admin`(597ms)·`AdminPage`(707ms)보다 먼저 출발하는 것이 그대로였다.
 *   ①②만 보고 "끝났다" 고 했으면 놓쳤다 — 판정은 받은 청크 목록으로 한다.
 */
async function sidebarPrefetchAt(path: string): Promise<number> {
  vi.stubGlobal('location', { ...window.location, pathname: path })
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} }))
  vi.resetModules(); loads.n = 0
  vi.doMock('@/components/DesktopLiveSidebar', () => { loads.n++; return { default: () => null } })
  await import('@/components/MobileAppLayout')
  await new Promise((r) => setTimeout(r, 0))
  return loads.n
}

describe('③ 사이드바 미리받기도 같은 판정', () => {
  it('어드민·셀러·에이전시에선 모듈 실행 때 받지 않는다', async () => {
    for (const p of ['/admin', '/seller/orders', '/agency']) expect(await sidebarPrefetchAt(p), p).toBe(0)
  })
  it('소비자 화면에선 종전대로 받는다 (반대 방향)', async () => {
    for (const p of ['/', '/vouchers']) expect(await sidebarPrefetchAt(p), p).toBe(1)
  })
  it('배선: 폭 조건과 숨김 판정이 함께 있다', () => {
    expect(code('src/components/MobileAppLayout.tsx')).toMatch(/matchMedia\?\.\('\(min-width: 768px\)'\)\.matches && !consumerChromeHiddenByPath\(window\.location\.pathname\)\) void loadSidebar\(\)/)
  })
})
