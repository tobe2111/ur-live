/**
 * 🏃 2026-11-04 대표 *"마이페이지도 리스터코퍼레이션 에이전시 명 그 부분이나 몇몇 부분만 유독 늦게 떠"* —
 * 에이전시 구역의 조회를 마이 첫 렌더에서 미리 출발시키고, `agencyRequest` 가 같은 GET 을 처음 부를 때 한 번만 쓴다.
 * 지키는 것: ① 에이전시 로그인이 없으면 아무것도 안 부른다 ② 미리 받은 응답은 한 번만 ③ 토큰이 다르면 쓰지 않는다
 *   ④ POST 는 절대 미리 받은 것을 쓰지 않는다.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { warmAgencyRequests, takeAgencyWarm, AGENCY_WARM_PATHS } from '@/lib/agency-presence'
import { agencyRequest } from '@/pages/agency-console/agency-api'

const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify({ success: true, url }), { status: 200 }))

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear()
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  for (const p of AGENCY_WARM_PATHS) takeAgencyWarm(p, '')
})
afterEach(() => vi.unstubAllGlobals())

describe('에이전시 조회 미리 출발', () => {
  it('① 에이전시 로그인이 없으면 아무것도 안 부른다', () => {
    warmAgencyRequests()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('② 미리 받은 것은 한 번만 — 두 번째는 새로 받는다', async () => {
    localStorage.setItem('agency_console_token', 'tok')
    warmAgencyRequests()
    expect(fetchMock).toHaveBeenCalledTimes(AGENCY_WARM_PATHS.length)
    const a = await agencyRequest('/me')
    expect(a.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(AGENCY_WARM_PATHS.length) // 새 요청 없음
    await agencyRequest('/me')
    expect(fetchMock).toHaveBeenCalledTimes(AGENCY_WARM_PATHS.length + 1)
  })

  it('③ 토큰이 다르면 쓰지 않는다', () => {
    localStorage.setItem('agency_console_token', 'tok')
    warmAgencyRequests()
    expect(takeAgencyWarm('/me', 'other')).toBeNull()
  })

  it('④ POST 는 미리 받은 응답을 쓰지 않는다', async () => {
    localStorage.setItem('agency_console_token', 'tok')
    warmAgencyRequests()
    await agencyRequest('/me', { method: 'POST', body: {} })
    expect(fetchMock).toHaveBeenCalledTimes(AGENCY_WARM_PATHS.length + 1)
  })
})
