/**
 * 📍 2026-10-19 대표 "응 둘 다 해줘" — 지도에서도 필터 0건 "없어요"가 정직한지.
 *   지도는 필터를 켜면 전체를 받는다(useFeedWindow → loadAll). 구멍이 둘 있었다:
 *   ① 전체를 받는 도중 0건이면 유달이 "이용권이 없어요" 가 먼저 떴다(맞는 것은 뒤 페이지에 있다).
 *   ② 1페이지가 오기 전에 필터를 켜면 loadAll 이 no-op(page 0)이었고 다시 안 불렸다 → 영영 1페이지만 거름.
 * ⚠️ 못 보는 것: 실제 렌더·네트워크 실패 시 문구(실패면 hunting 이 풀려 종전 빈 화면으로 떨어진다 — 의도).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const win = stripComments(readFileSync('src/pages/restaurant-map/useFeedWindow.ts', 'utf8'))
const page = stripComments(readFileSync('src/pages/RestaurantMapPage.tsx', 'utf8'))

describe('지도 — 필터 0건은 다 받아 본 뒤에만', () => {
  it('1페이지 도착 뒤 loadAll 을 다시 부른다', () => {
    expect(win).toMatch(/if \(needsAll && !isLoading\) void loadAll\(\)/)
    expect(win).toMatch(/\[needsAll, loadAll, isLoading\]/)
  })
  it('전체를 받는 중이면 아직 단정하지 않는다', () => {
    expect(win).toMatch(/const stillHunting = needsAll && !reachedEnd && \(isLoading \|\| loadingMore\)/)
  })
  it('목록 두 곳(리스트·지도 시트) 모두 찾는 중엔 빈 화면 대신 로딩', () => {
    expect(page).toMatch(/loading=\{loading \|\| \(stillHunting && displayList\.length === 0\)\}/)
    expect(page).toMatch(/loading=\{loading \|\| \(stillHunting && viewportList\.length === 0\)\}/)
  })
  it('카운트도 찾는 중엔 "0곳" 대신 모름', () => {
    expect((page.match(/filteredCount=\{\(loading \|\| stillHunting\) && displayList\.length === 0 \? null/g) || []).length).toBe(2)
  })
})
