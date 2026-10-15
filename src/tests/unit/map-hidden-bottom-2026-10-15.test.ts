/**
 * 🗺️ 시트에 가려진 지도 타일은 받지 않는다 〔2026-10-15〕
 *
 * 대표 *"1, 2 둘 다 진행"* — 1번. 모바일 첫 화면의 아래 240px 는 peek 시트가 덮는데, 지도 칸을 화면 끝까지
 * 두면 아무도 못 보는 타일을 함께 받았다(로컬 실측: 아이폰 12 → 9장 · 갤럭시 12 → 9장 · 픽셀 15 → 12장,
 * 시트 밑 타일 3 → 0). 그래서 지도를 만들 때 칸 아래를 시트 위(+모서리 반경)까지만 두고, 이용권을 골라
 * 카드로 바뀔 때 위쪽 내용이 안 움직이게 펴는지 를 본다.
 *
 * 못 막는 것: 실제 타일 수·화면 모양(브라우저 실측 — 카드 화면은 종전과 픽셀 동일 확인) · 카카오의 relayout 동작(외부).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { SHEET_PEEK_VISIBLE_PX, SHEET_CORNER_PX, SHEET_SNAP_TRANSLATE } from '@/pages/restaurant-map/useSheetDrag'

const hook = stripComments(fs.readFileSync('src/pages/restaurant-map/useKakaoMap.ts', 'utf8'))
const page = stripComments(fs.readFileSync('src/pages/RestaurantMapPage.tsx', 'utf8'))

describe('① 지도를 만들 때 시트에 가려진 아래를 뺀다', () => {
  it('peek · 선택 없음 · hiddenBottomPx>0 일 때 생성 전에 style.bottom', () => {
    const i = hook.indexOf('new window.kakao.maps.Map(mapRef.current')
    expect(i).toBeGreaterThan(0)
    const before = hook.slice(Math.max(0, i - 500), i)
    expect(before).toMatch(/const hb = hiddenBottomPxRef\.current/)
    expect(before).toMatch(/hb > 0 && sheetSnapRef\.current === 'peek' && selectedIdRef\.current == null/)
    expect(before).toMatch(/mapRef\.current\.style\.bottom = `\$\{hb\}px`/)
  })
  it('페이지는 모바일에서만 [peek − 모서리 반경] 을 넘긴다(PC 는 0)', () => {
    expect(page).toMatch(/hiddenBottomPx: isLgNow\(\) \? 0 : SHEET_PEEK_VISIBLE_PX - SHEET_CORNER_PX/)
    expect(SHEET_PEEK_VISIBLE_PX - SHEET_CORNER_PX).toBe(216)
  })
  it('peek 시트 위치와 같은 값(SSOT)', () => {
    expect(SHEET_SNAP_TRANSLATE.peek).toContain(`${SHEET_PEEK_VISIBLE_PX}px`)
  })
})

describe('② 카드가 뜨면 펴고, 위쪽 내용은 안 움직인다', () => {
  it('카드 기준 pan 은 오프셋을 계산하기 전에 편다', () => {
    const i = hook.indexOf('const panToProduct = useCallback(')
    const body = hook.slice(i, hook.indexOf('const offsetY', i))
    expect(body).toMatch(/if \(snap === 'card'\) releaseHiddenBottom\(\)/)
  })
  it('선택이 생기거나 PC 폭이 되면 그리기 전에(layout effect) 편다', () => {
    expect(hook).toMatch(/useLayoutEffect\(\(\) => \{\s*if \(selected \|\| hiddenBottomPx === 0\) releaseHiddenBottom\(\)/)
  })
  it('펼 때 중심을 늘어난 높이의 절반만큼 내린다(위 고정)', () => {
    const i = hook.indexOf('const releaseHiddenBottom = useCallback(')
    const body = hook.slice(i, hook.indexOf('}, [])', i))
    expect(body).toMatch(/el\.style\.bottom = ''/)
    expect(body).toMatch(/pt\.y \+ delta \/ 2/)
    expect(body).toMatch(/map\.relayout\(\)\s*map\.setCenter\(target\)/)
  })
  it('오프셋은 화면 높이가 아니라 지도 칸 높이 기준', () => {
    expect(hook).toMatch(/centerOffsetForSheet\(snap \?\? sheetSnapRef\.current, mapRef\.current\?\.clientHeight\)/)
  })
  it('페이지 ResizeObserver 는 이미 펴서 맞춘 높이면 다시 relayout 하지 않는다(진행 중 pan 보호)', () => {
    expect(page).toMatch(/if \(el\.clientHeight === layoutHeightRef\.current && el\.clientWidth === lastW\) return/)
  })
})

describe('③ 보이는 타일이 다 뜬 뒤 한가할 때 가려진 아래를 미리 받는다 (2차)', () => {
  const tilesStart = hook.indexOf("const onTiles = () =>")
  const onTiles = hook.slice(tilesStart, hook.indexOf("addListener(mapInstance.current, 'tilesloaded'", tilesStart))
  it('첫 tilesloaded 뒤에 한가할 때 예약한다(첫 화면 전에는 안 편다)', () => {
    expect(tilesStart).toBeGreaterThan(0)
    expect(onTiles).toMatch(/whenIdle\(prefetchHiddenBottom\)/)
  })
  it('데이터 절약 모드면 미리 받지 않는다', () => {
    const i = hook.indexOf('const prefetchHiddenBottom = useCallback(')
    const body = hook.slice(i, hook.indexOf('}, [])', i))
    expect(body).toMatch(/if \(!hiddenBottomRef\.current \|\| prefersDataSaving\(\)\) return/)
    expect(hook).toMatch(/function prefersDataSaving\(\)[\s\S]{0,200}saveData/)
  })
  it('지도가 움직이는 중이면 펴지 않고 다음 idle 로 미룬다', () => {
    const i = hook.indexOf('const prefetchHiddenBottom = useCallback(')
    const body = hook.slice(i, hook.indexOf('}, [])', i))
    expect(body).toMatch(/if \(movingRef\.current\) \{ pendingReleaseRef\.current = true; return \}/)
    expect(hook).toMatch(/for \(const ev of \['dragstart', 'zoom_start', 'center_changed'\]\)/)
    const idle = hook.slice(hook.indexOf("addListener(mapInstance.current, 'idle'"), hook.indexOf('const markMoving'))
    expect(idle).toMatch(/movingRef\.current = false/)
    expect(idle).toMatch(/if \(pendingReleaseRef\.current\) \{ pendingReleaseRef\.current = false; prefetchHiddenBottom\(\) \}/)
  })
  it('사파리(requestIdleCallback 없음)도 미룬 뒤 실행한다', () => {
    expect(hook).toMatch(/function whenIdle\([\s\S]{0,300}if \(ric\) ric\(cb, \{ timeout: 3000 \}\)\s*else setTimeout\(cb, 300\)/)
  })
})
