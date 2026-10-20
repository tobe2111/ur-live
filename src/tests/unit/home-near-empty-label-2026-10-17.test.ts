/**
 * 📍 2026-10-17 대표 — "두가지 해주고":
 *   ① 거리·가격 필터로 0건일 때 "없어요" 가 거짓말이었다 — 인기순 1페이지(50건)만 걸러 보고 단정했다.
 *      거리 필터는 서버에 가까운 후보(near)를 받고, 그래도 0이면 끝 페이지까지 더 찾아본 뒤에야 말한다.
 *   ② PC 홈 목록 제목과 왼쪽 위치 칸이 같은 곳을 다른 이름으로 불렀다 — 이름을 한 함수에서만 만든다.
 * ⚠️ 못 보는 것: 실제 렌더·네트워크(배선은 소스로 고정) · 서버 near 정렬 자체.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { homeLocationLabel, homeFeedTitle } from '@/pages/pc-home/home-location-label'
import { stripComments } from '../helpers/source-text'

const feed = stripComments(readFileSync('src/pages/main-home/GroupBuyFeed.tsx', 'utf8'))
const bar = stripComments(readFileSync('src/pages/pc-home/PcHomeLocationBar.tsx', 'utf8'))
const page = stripComments(readFileSync('src/pages/pc-home/PcHomePage.tsx', 'utf8'))

describe('① 필터 0건은 끝까지 찾아본 뒤에만 "없어요"', () => {
  it('거리 필터가 켜지면 서버에 가까운 후보를 요청한다', () => {
    expect(feed).toMatch(/const nearKey = \(sort === 'near' \|\| filters\?\.maxKm != null\) && userLoc/)
    expect(feed).toMatch(/const serverSort = nearKey \? '' : sort/)
  })
  it('가까운 후보 요청엔 위치 없는 SSR 시드를 쓰지 않는다', () => {
    expect(feed).toMatch(/initialData: nearKey \? undefined : ssrInitial/)
  })
  it('거리 기준이면 섹션에 뜬 것을 뒤로 미루지 않는다', () => {
    expect(feed).toMatch(/deferSeeded\(sortBand\(src\), nearKey \? NO_DEFER : sectionIds\)/)
  })
  it('필터로 0건이고 끝이 아니면 다음 페이지를 더 받는다', () => {
    expect(feed).toMatch(/const hunting = [^\n]*sorted\.length === 0 && !reachedEnd/)
    expect(feed).toMatch(/if \(hunting && !loading && !loadingMore\) void loadMore\(\)/)
  })
  it('찾는 동안엔 "없어요" 대신 찾는 중이라고 말한다', () => {
    expect(feed).toMatch(/hunting \? '조건에 맞는 이용권을 찾고 있어요…'/)
  })
})

describe('② 제목과 위치 칸이 같은 이름', () => {
  const cases = [
    { located: true, dongLabel: '동탄5동', region: {} },
    { located: true, dongLabel: null, region: {} },
    { located: false, region: { regionKey: 'seoul' } },
    { located: false, region: {} },
  ]
  it('제목은 위치 칸 이름을 그대로 품는다', () => {
    for (const c of cases) expect(homeFeedTitle(c)).toContain(homeLocationLabel(c))
  })
  it('현 위치 이름', () => {
    expect(homeLocationLabel(cases[0])).toBe('동탄5동')
    expect(homeFeedTitle(cases[0])).toBe('동탄5동 근처 이용권')
    expect(homeLocationLabel(cases[1])).toBe('내 주변')
    expect(homeFeedTitle(cases[1]), "'내 주변 근처 이용권' 은 말이 겹친다").toBe('내 주변 이용권')
    expect(homeLocationLabel(cases[3])).toBe('전국')
  })
  it('두 화면이 같은 함수를 쓴다(손으로 조립 금지)', () => {
    expect(bar).toMatch(/homeLocationLabel\(\{ located, dongLabel: locatedLabel, region: value \}\)/)
    expect(page).toMatch(/homeFeedTitle\(\{ located: !!userLoc, dongLabel: dong\?\.dong, region \}\)/)
    expect(page).not.toMatch(/'이 지역 동네 딜'|'내 주변 가까운 딜'/)
  })
})
