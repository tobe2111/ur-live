/**
 * 🧭 **위치 없이 '가까운 순'은 존재할 수 없다** (2026-09-09 — 대표 신고)
 *
 * 대표: *"딜 50개 아래에 있는 쪽 이용권들은 거리순으로 정렬이 안되어있는데?"*
 *
 * ## 실측으로 확인한 것
 * - **서버는 멀쩡하다**: `?near=37.2005,127.0980`(동탄) → 0.1km · 0.2km · 0.3km … 정확히 거리순.
 * - **클라가 `near` 를 안 보내고 있었다**: 위치가 없으면 `near=null` 인데 `sort` 도 **비워져서**
 *   서버 기본 순서가 오고, 클라 재정렬도 `userLoc` 가드에 걸려 건너뛴다 ⇒ **아무 정렬도 안 된 목록**이
 *   "거리순" 라벨을 달고 나온다. 에러도 빈 화면도 없다 — 화면이 거짓말을 한다.
 * - 헤더의 동네 이름(`ur_near_dong_v1`)은 **localStorage 에 따로 남아** 위치가 없어도 계속 보인다
 *   ⇒ 사용자는 위치가 잡힌 줄 안다. 이 구멍이 눈에 안 띈 이유다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * 실제 GPS 권한 흐름 · 서버 거리 랭킹의 정확도(그건 라이브 실측으로 확인했다) · 렌더.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { effectiveSort, NO_LOCATION_FALLBACK } from '@/pages/restaurant-map/effective-sort'

describe('🧭 정렬이 사라지는 상태를 만들지 않는다', () => {
  it('위치가 없으면 거리순이 다른 정렬로 내려간다', () => {
    expect(effectiveSort('distance', false)).toBe(NO_LOCATION_FALLBACK)
    expect(effectiveSort('distance', false)).not.toBe('distance')
  })

  it('위치가 있으면 거리순 그대로', () => {
    expect(effectiveSort('distance', true)).toBe('distance')
  })

  it('나머지 정렬은 위치와 무관하게 그대로', () => {
    for (const s of ['discount', 'price', 'rating'] as const) {
      expect(effectiveSort(s, true)).toBe(s)
      expect(effectiveSort(s, false)).toBe(s)
    }
  })

  it('폴백은 서버 sort 화이트리스트 안의 값이어야 한다', () => {
    // 서버가 모르는 값을 보내면 그 요청은 조용히 기본 순서가 된다 — 지금 고치는 그 증상 그대로다.
    expect(['popular', 'newest', 'deadline', 'discount', 'price', 'rating']).toContain(NO_LOCATION_FALLBACK)
  })
})

describe('🔌 배선 — 서버 요청과 클라 재정렬이 같은 함수를 쓴다', () => {
    /**
   * 🔴 주석 제거는 **레포 SSOT** 를 쓴다. 직접 쓴 정규식은 문자열/정규식 리터럴 안의 `/*` 를
   *   블록주석 시작으로 보고 **파일 가운데를 통째로 삼킨다** — 이번에 실제로 밟았다
   *   (`RestaurantMapPage` 에서 검사 대상 줄이 증발해 가짜 빨간불).
   */
  const read = (p: string) => stripComments(readFileSync(p, 'utf8'))
  const FEED = 'src/pages/restaurant-map/useFeedWindow.ts'
  const PAGE = 'src/pages/RestaurantMapPage.tsx'

  it('서버 요청이 effectiveSort 를 거친다', () => {
    const f = read(FEED)
    expect(f, `${FEED}: 원래 sortBy 를 그대로 쓰면 위치 없는 거리순에서 sort 가 비워진다`)
      .toMatch(/const eff = effectiveSort\(sortBy, !!userLoc\)/)
    expect(f).toMatch(/const sort = eff === 'distance' \? '' : eff/)
    expect(f).toMatch(/const near = eff === 'distance' \? userLoc : null/)
    expect(f, '한 곳이라도 raw sortBy 로 남으면 서버와 클라가 갈린다')
      .not.toMatch(/sortBy === 'distance' \? /)
  })

  it('클라 재정렬도 같은 함수를 쓴다', () => {
    const p = read(PAGE)
    expect(p, `${PAGE}: 클라만 raw sortBy 로 정렬하면 서버가 준 순서와 어긋난다`)
      .toMatch(/const eff = effectiveSort\(sortBy, !!userLoc\)/)
    expect(p).toMatch(/if \(eff === 'distance' && userLoc\)/)
    expect(p).toMatch(/if \(eff === 'discount'\)/)
  })

  it('거리순을 고르면 위치를 요청한다 (막다른 상태를 애초에 안 만든다)', () => {
    const p = read(PAGE)
    expect(p, `${PAGE}: 요청이 없으면 사용자는 "거리순"을 골라 놓고 영문을 모른 채 기본 순서를 본다`)
      .toMatch(/s === 'distance' && !userLoc && !nearMeMode\) requestNearMe\(\)/)
    expect(p, '정렬 UI 가 chooseSort 를 거쳐야 그 요청이 실제로 걸린다')
      .toMatch(/setSortBy=\{chooseSort\}/)
  })
})
