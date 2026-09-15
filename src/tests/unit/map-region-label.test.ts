/**
 * 📍 **지도 시트 지역명 (안 R1)** — 2026-09-09 대표 확정
 *   *"지금은 내 위치 기준이라고 뜨는데 지역명이 나올 수 있나? 예를 들어서 동탄 6동 기준 이런 식으로?"*
 *
 * 지키는 것은 셋이다.
 * 1. **줌에 안 맞는 이름을 말하지 않는다** — 화성시 전체가 보이는데 "동탄6동"이면 거짓말이다.
 * 2. **지오코딩이 첫 화면을 안 막는다** — idle 디바운스 + 같은 자리면 재호출 없음.
 * 3. **문구가 갈리지 않는다** — 시트가 자기 규칙을 다시 짜면 이름과 줌이 어긋난다.
 *
 * ⚠️ 이 파일이 **못 보는 것**: 카카오가 실제로 돌려주는 이름(라이브 API). 표의 매핑이 옳은지는
 *   눈으로 봐야 한다 — 여기서는 "레벨이 바뀌면 단계가 바뀐다"는 규칙만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import {
  mapRegionLabel,
  regionDepth,
  shouldRefetchRegion,
  MAP_REGION_MAX_LEVEL,
} from '@/shared/map-region-label'
import { readCode, sliceFrom } from '../helpers/source-text'

const 화성 = { region1: '경기', region2: '화성시', region3: '동탄6동' }

describe('📍 줌에 맞는 행정 단위', () => {
  it('동네 줌(~6)은 행정동을 말한다 — 대표가 든 예가 이 구간이다', () => {
    for (const lv of [1, 3, 5, 6]) expect(mapRegionLabel(lv, 화성)).toBe('동탄6동')
  })

  it('여러 동이 보이면(7~8) 시군구로 올라간다', () => {
    for (const lv of [7, 8]) expect(mapRegionLabel(lv, 화성)).toBe('화성시')
  })

  it('시·군이 여럿 보이면(9~10) 시도로 올라간다', () => {
    for (const lv of [9, 10]) expect(mapRegionLabel(lv, 화성)).toBe('경기')
  })

  it('전국 뷰(11+)는 이름을 안 만든다 — 한 점의 시도가 화면을 대표하지 못한다', () => {
    for (const lv of [11, 12, 14]) expect(mapRegionLabel(lv, 화성)).toBeNull()
    expect(MAP_REGION_MAX_LEVEL).toBe(10)
  })

  it('단계가 비면 한 칸 위로 — 빈 문자열을 그리면 시트가 "  16곳" 이 된다', () => {
    expect(mapRegionLabel(3, { region1: '경기', region2: '화성시', region3: '' })).toBe('화성시')
    expect(mapRegionLabel(3, { region1: '경기', region2: null, region3: '  ' })).toBe('경기')
    expect(mapRegionLabel(3, { region1: '', region2: '', region3: '' })).toBeNull()
  })

  it('입력이 없으면 null — 지어내지 않는다', () => {
    expect(mapRegionLabel(5, null)).toBeNull()
    expect(mapRegionLabel(Number.NaN, 화성)).toBeNull()
  })
})

describe('📍 다시 물어볼 때만 묻는다 (idle 은 팬마다 온다)', () => {
  const at = (lat: number, lng: number, level: number) => ({ lat, lng, level })

  it('첫 호출은 무조건 묻는다', () => {
    expect(shouldRefetchRegion(null, at(37.2, 127.1, 5), 0.02)).toBe(true)
  })

  it('제자리 + 같은 줌 구간이면 안 묻는다', () => {
    expect(shouldRefetchRegion(at(37.2, 127.1, 5), at(37.2001, 127.1001, 6), 0.02)).toBe(false)
  })

  it('줌 구간이 바뀌면 이름 단계가 달라지므로 다시 묻는다', () => {
    expect(shouldRefetchRegion(at(37.2, 127.1, 6), at(37.2, 127.1, 7), 0.02)).toBe(true)
  })

  it('임계는 화면 폭에 비례한다 — 고정 미터면 시 단위 줌에서 1픽셀 움직여도 다시 묻는다', () => {
    const prev = at(37.2, 127.1, 5)
    // 같은 0.004° 이동이 좁은 화면에선 "많이 움직임", 넓은 화면에선 "제자리".
    expect(shouldRefetchRegion(prev, at(37.204, 127.1, 5), 0.004)).toBe(true)
    expect(shouldRefetchRegion(prev, at(37.204, 127.1, 5), 0.4)).toBe(false)
  })

  it('규칙 구간은 표와 1:1', () => {
    expect([1, 6].map(regionDepth)).toEqual([3, 3])
    expect([7, 8].map(regionDepth)).toEqual([2, 2])
    expect([9, 10].map(regionDepth)).toEqual([1, 1])
    expect(regionDepth(11)).toBe(0)
  })
})

describe('📍 배선 — 화면이 자기 규칙을 다시 짜지 않는다', () => {
  const hook = readCode('src/pages/restaurant-map/useViewportRegion.ts')
  const bar = readCode('src/pages/restaurant-map/SheetFilterBar.tsx')
  const page = readCode('src/pages/RestaurantMapPage.tsx')

  it('시트는 지역명이 있으면 그것을, 없으면 종전 "이 지역"을 쓴다', () => {
    const line = sliceFrom(bar, 'regionLabel ||', undefined, 120)
    expect(line).toContain('이 지역')
  })

  it('"내 위치 기준"은 뺐다 — 오른쪽 정렬 칩이 이미 같은 말을 한다(안 R1)', () => {
    expect(bar).not.toContain('nearMeLabel')
  })

  it('페이지가 훅을 지도 모드에서만 켜고 시트에 내려 준다', () => {
    expect(page).toContain('useViewportRegion({')
    expect(sliceFrom(page, 'useViewportRegion({', '})', 200)).toContain("mode === 'map'")
    expect(page).toContain('regionLabel={viewportRegion}')
  })

  it('훅은 idle 을 디바운스한다 — 안 하면 팬 한 번에 지오코딩이 수십 번 나간다', () => {
    const idle = sliceFrom(hook, 'const onIdle', 'addListener', 400)
    expect(idle).toContain('setTimeout')
    expect(idle).toContain('clearTimeout')
  })

  it('전국 줌이면 묻지도 않는다 (SSOT 가 정한 구간을 훅이 그대로 읽는다)', () => {
    expect(hook).toContain('regionDepth(level) === 0')
  })

  it('빈 결과에 이름을 지우지 않는다 — 팬 도중 문구가 깜빡이면 그게 더 나쁘다', () => {
    const cb = sliceFrom(hook, 'coord2RegionCode(', '})', 900)
    // 실패/빈 배열은 return 으로 빠지고, setLabel 은 이름이 있을 때만 부른다.
    expect(cb).toContain('result.length === 0) return')
    expect(cb).toContain('if (next2) setLabel(next2)')
    expect(cb).not.toContain('setLabel(null)')
  })

  it('언마운트 뒤 콜백이 상태를 만지지 않는다', () => {
    expect(sliceFrom(hook, 'coord2RegionCode(', 'setLabel', 400)).toContain('if (!alive) return')
  })
})
