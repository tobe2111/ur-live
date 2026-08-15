import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MAP_SCREEN_PATHS, isMapScreenPath } from '@/shared/map-surface'

/** 주석 제거 — 배선은 **코드**에 있어야 한다(주석에만 남아도 통과하는 함정 차단). */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const read = (p: string) => strip(readFileSync(join(process.cwd(), p), 'utf8'))

const HOME_ROUTE = read('src/pages/pc-home/HomeRoute.tsx')
const NAV = read('src/components/main/DesktopTopNav.tsx')
const APP = read('src/App.tsx')

/**
 * 🗺️ **홈은 `<lg` 에서 지도 화면이다** (2026-08-14 — 대표 태블릿 스크린샷 "로고 2개·버튼 겹침").
 *
 * `HomeRoute` 가 `lg` 미만에서 `RestaurantMapPage` 를 렌더하므로 **`/` 와 `/map` 은 태블릿·모바일에서
 * 같은 화면**이다. 그런데 그 사실이 두 곳에 각각 손으로 적혀 있었고, 둘 다 `/map` 만 넣고 `/` 를 빠뜨렸다:
 *
 * | 빠진 곳 | 실측 증상 |
 * |---|---|
 * | `DesktopTopNav.LEGACY_OWN_HEADER` | 768~1023 에서 상단바 2개(로고 2개) — 되돌려-검증에서 로고 2→4 |
 * | `App.tsx mapFullScreen` | **전 폭**(390 포함) 문서가 뷰포트보다 56px 큼 → 바텀시트가 밀림 |
 *
 * ⇒ 목록을 `map-surface.ts` 하나로 합치고, **그 목록이 `HomeRoute` 의 실제 분기와 어긋나면 실패**한다.
 *
 * ⚠️ 이 테스트가 **못 보는 것**: 실제 픽셀 겹침(브라우저가 필요하다 — 이번엔 Playwright 로 로컬
 *   dev 서버를 띄워 확인했고, 되돌리면 `bars=2 · logos=4`, 고치면 `bars=0 · 넘침 0` 이었다).
 *   여기서 고정하는 것은 **"세 곳이 같은 사실을 말한다"** 는 배선뿐이다.
 */
describe('🗺️ 홈(<lg)=지도 화면 — 목록 하나로 합쳐졌는가', () => {
  it('🔒 HomeRoute 가 <lg 에서 RestaurantMapPage 를 렌더하면 `/` 는 지도 경로다', () => {
    // 분기 자체가 코드에 있는지 먼저 확인(없으면 아래 단정이 공허해진다)
    expect(HOME_ROUTE).toMatch(/min-width:\s*1024px/)
    const rendersMapBelowLg = /isDesktop\s*\?[\s\S]{0,200}RestaurantMapPage/.test(HOME_ROUTE)
    expect(rendersMapBelowLg, 'HomeRoute 의 lg 분기를 못 찾았다 — 코드가 바뀌었으면 이 테스트도 갱신할 것').toBe(true)
    expect(isMapScreenPath('/'), '홈이 <lg 에서 지도인데 `/` 가 MAP_SCREEN_PATHS 에 없다').toBe(true)
    expect(isMapScreenPath('/map')).toBe(true)
    expect(isMapScreenPath('/vouchers')).toBe(false)
  })

  it('🔌 DesktopTopNav 의 <lg 자체헤더 목록은 SSOT 에서 받는다(손으로 두 벌 금지)', () => {
    expect(NAV).toMatch(/LEGACY_OWN_HEADER\s*=\s*\[\s*\.\.\.MAP_SCREEN_PATHS/)
    expect(NAV).toMatch(/from '@\/shared\/map-surface'/)
    // 지도 경로를 목록에 **직접** 다시 적으면 또 갈라진다
    const decl = NAV.match(/LEGACY_OWN_HEADER\s*=\s*\[[^\]]*\]/)?.[0] ?? ''
    expect(decl, 'LEGACY_OWN_HEADER 선언을 못 찾았다').not.toBe('')
    expect(decl).not.toMatch(/'\/map'|'\/restaurant-map'/)
  })

  it('🔌 App.tsx 하단여백 게이트도 같은 SSOT 를 쓴다', () => {
    expect(APP).toMatch(/const mapFullScreen = isMapScreenPath\(location\.pathname\)/)
    expect(APP).toMatch(/from '@\/shared\/map-surface'/)
  })

  it('🔒 SSOT 가 비면 실패 — 목록이 사라진 채 통과하는 것 차단', () => {
    expect(MAP_SCREEN_PATHS.length).toBeGreaterThanOrEqual(2)
    expect([...MAP_SCREEN_PATHS]).toContain('/')
  })
})
