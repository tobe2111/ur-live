/**
 * 🗺️ 지도(`/map`) 서버 첫 화면 (2026-11-09 대표 "계속 최적화") — 라이브 첫 글자 2.9초(번역 키 원문)를 껍데기로 바꾼다.
 *   두 벌(서버 HTML ↔ `MapTopBar`·`SheetFilterBar`·`RestaurantMapPage` 소스)이 갈리면 빨간불.
 *   고정하는 것: ① 상단 바·칩·시트 머리의 클래스가 진짜 컴포넌트 렌더와 같다 ② 글자가 ko 사전과 같다
 *   ③ 시트 자리(top·peek transform)가 `useSheetDrag` 상수 그대로 ④ 워커 배선(폰 UA·쿼리 없음) ⑤ CSS-first·critical 표면
 *   ⑥ 번역 키가 첫 그림에 원문으로 뜨지 않게 defaultValue. 못 보는 것: 픽셀(jsdom) · 실제 FCP(라이브).
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import MapTopBar from '@/pages/restaurant-map/MapTopBar'
import SheetFilterBar from '@/pages/restaurant-map/SheetFilterBar'
import { buildMapFirstScreen, MAP_FS_CLASS as C, MAP_FS_TEXT, MAP_FS_CHIP_LABELS } from '@/worker/utils/map-first-screen'
import { MAP_VOUCHER_DEFS } from '@/pages/restaurant-map/voucher-types'
import { SHEET_BASE_TOP, SHEET_SNAP_TRANSLATE } from '@/pages/restaurant-map/useSheetDrag'
import { cssFirstApplies, criticalSurfaceOf, firstScreenApplies } from '@/worker/utils/css-first-boot'
import { readRaw } from '../helpers/source-text'

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const noop = () => {}
const server = () => { const d = document.createElement('div'); d.innerHTML = buildMapFirstScreen(); return d }
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/map']}>{ui}</MemoryRouter></QueryClientProvider>).container

describe('① 상단 바·칩 — MapTopBar(overlay) 와 같은 클래스', () => {
  // testing-library 가 it 마다 언마운트하므로 렌더는 it 안에서.
  const topBar = () => wrap(<MapTopBar search="" setSearch={noop} searchFocused={false} setSearchFocused={noop} searchHistory={[]} setSearchHistory={noop} pushSearchHistory={noop}
    voucherType="all" setVoucherType={noop} nearMeMode={false} requestNearMe={noop} activeFilterCount={0} onOpenFilter={noop} />)
  it('바·안쪽·1행·뒤로 칸·검색 상자', () => {
    const r = topBar(); const s = server()
    const rBar = r.firstElementChild as HTMLElement; const sBar = s.querySelector(`div.light-island`)!
    expect(sBar.className).toBe(rBar.className)
    expect(sBar.firstElementChild!.className).toBe(rBar.firstElementChild!.className)
    const rRow1 = rBar.querySelector(':scope > div > div')!; const sRow1 = sBar.querySelector(':scope > div > div')!
    expect(sRow1.className).toBe(rRow1.className)
    expect((sRow1.firstElementChild as HTMLElement).className).toBe((rRow1.firstElementChild as HTMLElement).className) // 뒤로 칸
    expect(s.querySelector('input')!.className).toBe(r.querySelector('input')!.className)
    // placeholder 글자는 jsdom 에 사전이 없어 키 원문이 나온다 — 글자는 아래 ko 사전 대조가 맡는다.
  })
  it('칩 줄 — 개수·클래스·라벨이 같다(전체 선택)', () => {
    const r = topBar(); const s = server()
    const pick = (root: HTMLElement) => Array.from(root.querySelectorAll('div')).find((d) => d.className.includes('overflow-x-auto scrollbar-hide'))!
    const rChipRow = pick(r); const sChipRow = pick(s)
    expect(sChipRow.className).toBe(rChipRow.className)
    const rc = Array.from(rChipRow.children).map((e) => e.className); const sc = Array.from(sChipRow.children).map((e) => e.className)
    expect(sc).toEqual(rc)
    expect(rc.length).toBe(2 + MAP_VOUCHER_DEFS.length) // 필터 + 내 주변 + 카테고리
    // 카테고리 라벨은 defaultLabel(= ko 값)로 그려진다 — 내 주변은 jsdom 에서 키 원문이라 뺀다.
    const rLabels = Array.from(rChipRow.children).slice(2).map((e) => e.textContent!.trim()); const sLabels = Array.from(sChipRow.children).slice(2).map((e) => e.textContent!.trim())
    expect(sLabels).toEqual(rLabels)
    for (const v of MAP_VOUCHER_DEFS) expect(MAP_FS_CHIP_LABELS[v.key], v.key).toBeDefined()
  })
})

describe('② 시트 머리 — SheetFilterBar(hideChips) 와 같은 클래스·글자', () => {
  it('개수(…곳)·정렬(할인율순) 줄', () => {
    const r = wrap(<SheetFilterBar activeFilterCount={0} onOpenFilter={noop} nearMeMode={false} requestNearMe={noop} voucherType="all" setVoucherType={noop}
      filteredCount={null} userLoc={null} sortBy="discount" setSortBy={noop} favorites={[]} showFavoritesOnly={false} setShowFavoritesOnly={noop} hideChips />)
    const s = server()
    const rBar = r.firstElementChild as HTMLElement; const sBar = s.querySelector(`div[role="dialog"] > div:nth-child(2)`)!
    expect(sBar.className).toBe(rBar.className)
    const rRow = rBar.firstElementChild!; const sRow = sBar.firstElementChild!
    expect(sRow.className).toBe(rRow.className)
    expect(sRow.textContent!.replace(/\s+/g, '')).toBe(rRow.textContent!.replace(/\s+/g, ''))
    expect(sRow.querySelector('.ur-count-in')!.className).toBe(rRow.querySelector('.ur-count-in')!.className)
    expect((sRow.lastElementChild as HTMLElement).className).toBe((rRow.lastElementChild as HTMLElement).className)
  })
  it('③ 시트 자리·손잡이·지도 대기 블록이 페이지 소스·useSheetDrag 와 같다', () => {
    const s = server(); const sheet = s.querySelector('div[role="dialog"]') as HTMLElement
    expect(sheet.className).toBe(C.sheet)
    expect(sheet.getAttribute('style')).toContain(`top:${SHEET_BASE_TOP}`); expect(sheet.getAttribute('style')).toContain(`transform:${SHEET_SNAP_TRANSLATE.peek}`)
    const page = readRaw('src/pages/RestaurantMapPage.tsx')
    expect(page).toContain(`className="${C.sheet}"`)
    expect(page).toContain(`<Screen fixed className="${C.screen.replace('h-[100dvh] ', '')}">`)
    expect(page).toContain(`className="${C.mapWait}"`); expect(page).toContain(`className="${C.mapWaitTitle}"`); expect(page).toContain(`className="${C.mapWaitSub}"`)
    expect(page).toContain(`className="${C.handleWrap}"`)
    expect(readRaw('src/components/ui/screen.tsx')).toContain('fixed ? "h-[100dvh]" : "min-h-[100dvh]"')
  })
  it('글자는 ko 사전 값 그대로 · ⑥ 첫 그림에 번역 키 원문이 안 뜬다(defaultValue)', () => {
    const ko = JSON.parse(readFileSync('public/locales/ko/translation.json', 'utf8'))
    expect(ko.restaurantMap.mapLoading).toBe(MAP_FS_TEXT.mapLoading); expect(ko.restaurantMap.sdkLoading).toBe(MAP_FS_TEXT.sdkLoading)
    expect(ko.restaurantMap.searchPlaceholder).toBe(MAP_FS_TEXT.searchPlaceholder); expect(ko.restaurantMap.nearMe).toBe(MAP_FS_TEXT.nearMe)
    expect(ko.map.sheet.count).toBe(MAP_FS_TEXT.count); expect(ko.restaurantMap.sort.discount).toBe(MAP_FS_TEXT.sortDefault)
    for (const v of MAP_VOUCHER_DEFS) expect(ko.map.voucher[v.labelKey.split('.').pop()!], v.key).toBe(MAP_FS_CHIP_LABELS[v.key])
    const page = readRaw('src/pages/RestaurantMapPage.tsx')
    expect(page).toContain("t('restaurantMap.mapLoading', { defaultValue: '지도를 불러오는 중...' })")
    expect(page).toContain("t('restaurantMap.sdkLoading', { defaultValue: '카카오맵 SDK 로딩 중' })")
  })
})

describe('④⑤ 배선', () => {
  it('워커: 쿼리 없음 → 껍데기 + 크롤러 noscript (폰 = 종전 · PC = 패널 판 — 2026-11-12)', () => {
    expect(readRaw('src/worker/index.ts')).toContain("else if (url.pathname === '/map' && !url.search) { const mapFirst = buildMapFirstScreen(shouldRenderMobileFirstScreen(c.req.header('user-agent')) ? undefined : '/map');")
    expect(readRaw('src/worker/index.ts')).toMatch(/const mapNs = buildStaticSurfaceNoscript\(url\.pathname, crawlerPayload\);/)
  })
  it('CSS-first 표면 · critical CSS 표면 map', () => {
    expect(cssFirstApplies('/map', MOBILE_UA)).toBe(true); expect(criticalSurfaceOf('/map')).toBe('map')
    expect(readRaw('scripts/generate-critical-css.mjs')).toMatch(/map: \['src\/worker\/utils\/map-first-screen\.ts'\]/)
  })
  it('첫 화면은 lg:hidden 으로 감싼다(PC 는 좌측 패널 분할이라 모양이 다르다)', () => {
    expect(buildMapFirstScreen().startsWith('<div id="ur-first-screen"><div class="lg:hidden">')).toBe(true)
  })
  describe('🖥️ 2026-11-12 PC 판 — 상단 네비(딜 카테고리 없음) + 왼쪽 패널(MapTopBar panel) + 지도 자리', () => {
    const pc = buildMapFirstScreen('/map')
    const top = readRaw('src/pages/restaurant-map/MapTopBar.tsx')
    it('패널 클래스가 MapTopBar 소스와 글자 그대로 같다', () => {
      for (const k of ['panel', 'panelInner', 'panelGrid', 'panelBtnOff', 'panelBtnOn', 'panelBtn', 'panelLabel', 'panelCatLabel'] as const) expect(top, k).toContain(C[k])
      expect(top).toContain("'text-gray-400 dark:text-gray-500'") // 검색 아이콘 색
      expect(top).toContain("const PANEL_SURF = 'bg-white dark:bg-[#11141C] border border-gray-200 dark:border-[#2C2F35] shadow-sm'")
    })
    it('PC 판엔 lg:hidden 감싸기가 없고 네비 · 패널 · 지도 자리가 있다', () => {
      expect(pc).not.toContain('<div class="lg:hidden">')
      expect(pc).toContain('동네딜, 교환권, 상품 검색')
      expect(pc).toContain(C.panelGrid)
      expect(pc).toContain('style="top:0"')
      expect(pc).toContain(MAP_FS_TEXT.mapLoading)
    })
    it('지도 네비엔 딜 카테고리가 없다(앱 hideDealCats)', () => {
      const nav = pc.slice(0, pc.indexOf(C.screen)) // 네비 부분만(패널 칩에도 '전체' 가 있다)
      expect(nav).toContain('>동네딜<'); expect(nav).not.toContain('>전체<'); expect(nav).not.toContain('>식사<')
    })
    it('칩 9칸 — 필터 · 내 주변 · 카테고리(짧은 라벨), 전체가 켜짐', () => {
      const d = document.createElement('div'); d.innerHTML = pc
      const cells = Array.from(d.querySelectorAll(`[class="${C.panelGrid}"] > span`)).map((x) => x.textContent)
      expect(cells.slice(0, 3)).toEqual(['필터', '내 주변', '전체'])
      expect(cells).toContain('뷰티')
    })
    it('PC 에 첫 화면 CSS 를 넣는다(그리는 곳엔 CSS 도)', () => {
      expect(firstScreenApplies('/map', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(true)
    })
  })
})
